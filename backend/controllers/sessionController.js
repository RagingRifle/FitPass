const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const logger = require('../lib/logger');
const { H4_GYM_IDS } = require('../config/constants');
/**
 * FitPrime / FitPass session-based check-in controller.
 *
 * Endpoints:
 *   POST   /api/member-portal/sessions/check-in      member scans a gym QR -> 1 session deducted
 *   GET    /api/member-portal/sessions/status        current session state for the mobile timer
 *   GET    /api/member-portal/sessions/history       member's check-in history with filters
 *   POST   /api/sessions/admin-adjust                admin manually adds/removes sessions
 *   GET    /api/sessions/member-summary/:memberId    admin views member session summary
 *   GET    /api/sessions/analytics                   fitpass_admin/superadmin views global analytics
 *   GET    /api/sessions/partner-visits              partner views read-only check-in audit for their gym
 */
const { z } = require('zod');
const prisma = require('../config/prisma');
const Gym = require('../models/Gym');
const Member = require('../models/Member');
const { logAudit } = require('../utils/auditLogger');
const { expireIfDue, attemptCheckIn } = require('../utils/sessionHelpers');

// Helper: load + lazily expire a member from the authed user's memberId or email fallback.
const loadMemberForUser = async (req) => {
  let member = null;
  if (req.user?.memberId) {
    member = await prisma.member.findUnique({ where: { id: req.user.memberId } });
  }
  if (!member && req.user?.email) {
    member = await prisma.member.findFirst({ where: { email: req.user.email } });
    if (member && req.user?._id) {
      await prisma.user.update({ where: { id: req.user._id }, data: { memberId: member.id, role: 'member' } }).catch(() => {});
    }
  }
  return member ? await expireIfDue(member) : null;
};

// Helper: Log FitPass check-in attempts to the dedicated audit trail
const logFitPassAttempt = async ({
  member,
  gym,
  branch = null,
  accessStatus,
  failureReason = null,
  sessionsDeducted = 0,
  qrCodeUsed = '',
  deviceInfo = null,
}) => {
  try {
    const sessionsUsedBefore = (member.sessionsTotal || 0) - (member.sessionsRemaining || 0);
    const remainingSessionsAfter = (member.sessionsRemaining || 0) - (accessStatus === 'Success' ? 1 : 0);

    await prisma.fitPassAuditLog.create({
      data: {
        memberId: member.id,
        memberName: member.name || 'Unknown',
        fitPassMembershipId: member.planId,
        organizationId: member.gymId,
        branchId: member.branchId || null,
        gymIdVisited: gym.id,
        gymName: gym.name || '',
        branchIdVisited: branch ? branch.id : null,
        branchNameVisited: branch ? branch.name || '' : null,
        accessStatus,
        failureReason,
        totalPurchasedSessions: member.sessionsTotal || 0,
        sessionsUsedBefore: sessionsUsedBefore >= 0 ? sessionsUsedBefore : 0,
        sessionsDeducted,
        remainingSessionsAfter: remainingSessionsAfter >= 0 ? remainingSessionsAfter : 0,
        membershipExpiryDate: member.expiryDate,
        qrCodeUsed,
        deviceInfo: deviceInfo || null,
        createdBySystem: true,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to log fitpass attempt');
  }
};

// @desc    Check in to a gym by scanning its QR (deducts 1 session instantly)
// @route   POST /api/member-portal/sessions/check-in
// @access  Private/Member
const checkIn = catchAsync(async (req, res, next) => {
  const { gymId, branchId, deviceInfo } = req.body;
  const qrCodeUsed = JSON.stringify({ gymId, branchId });

  try {
    // 1. Load member profile
    const member = await loadMemberForUser(req);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member profile not found.' });
    }

    // Resolve target gymId fallback if QR scanned standard code or missing gymId
    let effectiveGymId = gymId;
    if (!effectiveGymId || effectiveGymId === 'H4_GYM_STANDARD_QR' || effectiveGymId === 'HOME_GYM' || req.body?.qrCode === 'H4_GYM_STANDARD_QR') {
      effectiveGymId = member.gymId || H4_GYM_IDS[1];
    }

    // 2. Fetch associated membership plan
    let plan = member.planId ? await prisma.plan.findUnique({ where: { id: member.planId } }).catch(() => null) : null;
    if (!plan) {
      plan = { gymId: member.gymId || effectiveGymId, name: 'H4 Standard Plan' };
    }

    // Fetch target gym details
    let gym = await prisma.gym.findUnique({ where: { id: effectiveGymId } }).catch(() => null);
    if (!gym && member.gymId) {
      gym = await prisma.gym.findUnique({ where: { id: member.gymId } }).catch(() => null);
    }
    if (!gym) {
      gym = await prisma.gym.findFirst({ where: { status: 'Active' } });
    }
    if (!gym) {
      return res.status(404).json({ success: false, message: 'Gym not found for this QR code.' });
    }

    // Fetch target branch details if provided
    let branch = null;
    if (branchId) {
      branch = await prisma.branch.findUnique({ where: { id: branchId } });
      if (!branch) {
        return res.status(404).json({ success: false, message: 'Branch not found.' });
      }
      if (branch.gymId !== gymId) {
        return res.status(400).json({ success: false, message: 'Branch does not belong to the scanned gym.' });
      }
    }

    const isFitPass = plan.gymId === 'SYSTEM';

    // NORMAL GYM MEMBER ACCESS RULES
    if (!isFitPass) {
      const isHomeGym = member.gymId === gymId && (member.branchId ? member.branchId === branchId : true);
      if (!isHomeGym) {
        // Record failed attempt in FitPass log
        await logFitPassAttempt({
          member,
          gym,
          branch,
          accessStatus: 'Failed',
          failureReason: 'Access denied: Normal members can only check in to their registered home branch.',
          sessionsDeducted: 0,
          qrCodeUsed,
          deviceInfo,
        });

        return res.status(403).json({
          success: false,
          message: 'Access denied: Normal members can only check in to their registered home branch.',
        });
      }

      // Record traditional CRM attendance for home check-in
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existingAttendance = await prisma.attendance.findFirst({
        where: {
          memberId: member.id,
          gymId: member.gymId,
          branchId: member.branchId || null,
          date: {
            gte: today,
            lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      });

      if (existingAttendance) {
        return res.status(400).json({ success: false, message: 'Attendance already marked for today.' });
      }

      const now = new Date();
      const checkInTime = now.toTimeString().split(' ')[0];
      const isSessionPlan = (plan.sessions || 0) > 0 || (member.sessionsTotal || 0) > 0;
      if (isSessionPlan && (member.sessionsRemaining || 0) <= 0) {
        return res.status(400).json({
          success: false,
          message: `You have no sessions remaining out of ${member.sessionsTotal || plan.sessions}. Please renew or top up your plan.`,
        });
      }

      const attendanceData = {
        memberId: member.id,
        date: now,
        checkInTime,
        gymId: member.gymId,
        branchId: member.branchId || null,
      };
      let attendance;
      let checkedInMember = member;
      if (isSessionPlan) {
        const result = await prisma.$transaction(async (tx) => {
          const updatedMember = await tx.member.update({
            where: { id: member.id },
            data: {
              sessionsRemaining: (member.sessionsRemaining || 0) - 1,
              lastCheckInAt: now,
            },
          });
          const createdAttendance = await tx.attendance.create({ data: attendanceData });
          return { member: updatedMember, attendance: createdAttendance };
        });
        checkedInMember = result.member;
        attendance = result.attendance;
      } else {
        attendance = await prisma.attendance.create({ data: attendanceData });
      }

      await logAudit(req, 'ATTENDANCE_MARKED', 'Attendance', attendance.id, `Checked in at home branch via QR scan.`, member.name);

      return res.status(200).json({
        success: true,
        message: isSessionPlan
          ? `Check-in successful. 1 session deducted. ${checkedInMember.sessionsRemaining} session(s) remaining.`
          : 'Check-in successful at home branch.',
        sessionsRemaining: checkedInMember.sessionsRemaining ?? 0,
        sessionsTotal: checkedInMember.sessionsTotal ?? member.sessionsTotal ?? 0,
        gym: { id: gym.id, name: gym.name },
        branch: branch ? { id: branch.id, name: branch.name } : null,
      });
    }

    // FITPASS MEMBER VALIDATION PIPELINE
    const now = new Date();

    // 3. Membership status is active
    if (member.status !== 'Active') {
      await logFitPassAttempt({
        member,
        gym,
        branch,
        accessStatus: 'Failed',
        failureReason: 'Membership is suspended or inactive.',
        sessionsDeducted: 0,
        qrCodeUsed,
        deviceInfo,
      });
      return res.status(403).json({ success: false, message: 'Membership is suspended or inactive.' });
    }

    // 4. Membership has not expired
    if (new Date(member.expiryDate) < now) {
      await logFitPassAttempt({
        member,
        gym,
        branch,
        accessStatus: 'Failed',
        failureReason: 'Membership has expired.',
        sessionsDeducted: 0,
        qrCodeUsed,
        deviceInfo,
      });
      return res.status(403).json({ success: false, message: 'Membership has expired.' });
    }

    // 5. Sessions are available
    if (!member.sessionsRemaining || member.sessionsRemaining <= 0) {
      await logFitPassAttempt({
        member,
        gym,
        branch,
        accessStatus: 'Failed',
        failureReason: 'No sessions remaining.',
        sessionsDeducted: 0,
        qrCodeUsed,
        deviceInfo,
      });
      return res.status(402).json({ success: false, message: 'No sessions remaining.' });
    }

    // 6. Target gym is an active partner
    if (gym.status !== 'Active') {
      await logFitPassAttempt({
        member,
        gym,
        branch,
        accessStatus: 'Failed',
        failureReason: 'Target gym is not an active FitPass partner.',
        sessionsDeducted: 0,
        qrCodeUsed,
        deviceInfo,
      });
      return res.status(403).json({ success: false, message: 'Target gym is not an active FitPass partner.' });
    }

    if (branch && !branch.fitPassEnabled) {
      await logFitPassAttempt({
        member,
        gym,
        branch,
        accessStatus: 'Failed',
        failureReason: 'Target branch is not participating in FitPass.',
        sessionsDeducted: 0,
        qrCodeUsed,
        deviceInfo,
      });
      return res.status(403).json({ success: false, message: 'Target branch is not participating in FitPass.' });
    }

    // 7. Cooldown/active session gates are satisfied
    if (member.currentSessionEndsAt && new Date(member.currentSessionEndsAt) > now) {
      await logFitPassAttempt({
        member,
        gym,
        branch,
        accessStatus: 'Failed',
        failureReason: 'Active session already running.',
        sessionsDeducted: 0,
        qrCodeUsed,
        deviceInfo,
      });
      return res.status(409).json({
        success: false,
        message: 'You already have an active session.',
        sessionEndsAt: member.currentSessionEndsAt,
      });
    }

    if (member.cooldownEndsAt && new Date(member.cooldownEndsAt) > now) {
      await logFitPassAttempt({
        member,
        gym,
        branch,
        accessStatus: 'Failed',
        failureReason: 'Cooldown is active.',
        sessionsDeducted: 0,
        qrCodeUsed,
        deviceInfo,
      });
      return res.status(429).json({
        success: false,
        message: 'Cooldown active. You can check in again after the cooldown ends.',
        cooldownEndsAt: member.cooldownEndsAt,
      });
    }

    // 8. Grant access and record visit atomically (session count deduction)
    const outcome = await attemptCheckIn(member, gym, branch);
    if (!outcome.ok) {
      const g = outcome.gate;
      await logFitPassAttempt({
        member,
        gym,
        branch,
        accessStatus: 'Failed',
        failureReason: g.message || 'Atomic check-in failed.',
        sessionsDeducted: 0,
        qrCodeUsed,
        deviceInfo,
      });
      return res.status(g.code).json({
        success: false,
        message: g.message,
      });
    }

    // Log successful visit
    await logFitPassAttempt({
      member,
      gym,
      branch,
      accessStatus: 'Success',
      failureReason: null,
      sessionsDeducted: 1,
      qrCodeUsed,
      deviceInfo,
    });

    await logAudit(req, 'CHECK_IN', 'Member', member.id,
      `Checked in at ${gym.name}${branch ? ` - ${branch.name}` : ''}; ${outcome.member.sessionsRemaining} session(s) remaining.`).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Check-in successful. 1 session deducted.',
      sessionsRemaining: outcome.member.sessionsRemaining,
      sessionStartsAt: outcome.sessionCheckIn.startedAt,
      sessionEndsAt: outcome.sessionEndsAt,
      cooldownEndsAt: outcome.cooldownEndsAt,
      gym: { id: gym.id, name: gym.name },
      ...(branch ? { branch: { id: branch.id, name: branch.name } } : {}),
    });
  } catch (error) {
    logger.error({ err: error }, 'Check-in error');
    return res.status(500).json({ success: false, message: 'Check-in failed.' });
  }
});

// @desc    Get the member's current session state (for the mobile live timer)
// @route   GET /api/member-portal/sessions/status
// @access  Private/Member
const getSessionStatus = catchAsync(async (req, res, next) => {
  try {
    const member = await loadMemberForUser(req);
    if (!member) {
      // A FitPass account may be created before its first subscription. Keep
      // the portal usable so the member can browse and purchase a plan; the
      // Member row is created after the first successful plan purchase.
      return res.json({
        success: true,
        sessionsRemaining: 0,
        sessionsTotal: 0,
        currentSessionEndsAt: null,
        currentSessionGymId: null,
        cooldownEndsAt: null,
        planName: null,
        expiryDate: null,
        planStatus: 'Inactive',
        lastCheckInAt: null,
      });
    }

    const now = new Date();
    const active = !!(member.currentSessionEndsAt && new Date(member.currentSessionEndsAt) > now);
    const inCooldown = !!(member.cooldownEndsAt && new Date(member.cooldownEndsAt) > now);
    const membershipExpired = Boolean(member.expiryDate && new Date(member.expiryDate) <= now);

    let planName = null;
    if (member.planId) {
      const plan = await prisma.plan.findUnique({ where: { id: member.planId } }).catch(() => null);
      if (plan) planName = plan.name;
    }
    if (!planName && (member.sessionsRemaining || 0) > 0) {
      planName = 'FitPass Standard';
    }

    return res.json({
      success: true,
      sessionsRemaining: membershipExpired ? 0 : (member.sessionsRemaining || 0),
      sessionsTotal: member.sessionsTotal || (member.sessionsRemaining || 10),
      currentSessionEndsAt: active ? member.currentSessionEndsAt : null,
      currentSessionGymId: active ? member.currentSessionGymId : null,
      cooldownEndsAt: inCooldown ? member.cooldownEndsAt : null,
      planName,
      expiryDate: member.expiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      planStatus: membershipExpired ? 'Expired' : member.status === 'Active' && (member.sessionsRemaining || 0) > 0 ? 'Active' : 'Inactive',
      lastCheckInAt: member.lastCheckInAt || null,
    });
  } catch (error) {
    logger.error({ err: error }, 'Session status error');
    return res.status(500).json({ success: false, message: 'Could not load session status.' });
  }
});

// @desc    Get the member's check-in history with filters
// @desc    Get the member's check-in history with filters
// @route   GET /api/member-portal/sessions/history
// @access  Private/Member
const getSessionHistory = catchAsync(async (req, res, next) => {
  try {
    const member = await loadMemberForUser(req);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member profile not found.' });
    }

    const memberId = member.id;
    const { startDate, endDate, gymId, branchId, status } = req.query;

    const [sessions, auditLogs, attendances, gyms] = await Promise.all([
      prisma.sessionCheckIn.findMany({
        where: { memberId },
        orderBy: { startedAt: 'desc' },
        take: 100,
      }).catch(() => []),
      prisma.fitPassAuditLog.findMany({
        where: { memberId, accessStatus: 'Success' },
        orderBy: { checkInTimestamp: 'desc' },
        take: 100,
      }).catch(() => []),
      prisma.attendance.findMany({
        where: { memberId },
        orderBy: { date: 'desc' },
        take: 100,
      }).catch(() => []),
      prisma.gym.findMany().catch(() => []),
    ]);

    const gymMap = new Map();
    gyms.forEach(g => gymMap.set(g.id, g.name));

    const items = [];
    const usedTimeKeys = new Set();

    // 1. Process session check-ins as primary source
    sessions.forEach(s => {
      const timeKey = s.startedAt ? Math.floor(new Date(s.startedAt).getTime() / 120000) : 0;
      let gymName = s.gymName;
      if (!gymName || gymName === 'Partner Gym' || gymName.includes('Partner')) {
        gymName = gymMap.get(s.gymId) || 'Partner Gym';
      }
      const isNowActive = s.status === 'active' && s.expiresAt && new Date(s.expiresAt) > new Date();

      items.push({
        id: s.id,
        _id: s.id,
        gymId: s.gymId,
        gymName: gymName,
        branchId: s.branchId || null,
        branchName: s.branchName || null,
        startedAt: s.startedAt ? s.startedAt.toISOString() : new Date().toISOString(),
        date: s.startedAt ? s.startedAt.toISOString() : new Date().toISOString(),
        endedAt: s.expiresAt ? s.expiresAt.toISOString() : null,
        status: isNowActive ? 'Active' : 'Completed',
        sessionsDeducted: 1,
      });

      if (timeKey) usedTimeKeys.add(timeKey);
    });

    // 2. Process audit logs for check-ins not already captured in sessionCheckIn
    auditLogs.forEach(a => {
      const timeKey = a.checkInTimestamp ? Math.floor(new Date(a.checkInTimestamp).getTime() / 120000) : 0;
      if (!usedTimeKeys.has(timeKey)) {
        let gymName = a.gymName;
        if (!gymName || gymName === 'Partner Gym' || gymName.includes('Partner')) {
          gymName = gymMap.get(a.gymIdVisited) || 'Partner Gym';
        }

        items.push({
          id: a.id,
          _id: a.id,
          gymId: a.gymIdVisited || '',
          gymName: gymName,
          branchId: a.branchIdVisited || null,
          branchName: a.branchNameVisited || null,
          startedAt: a.checkInTimestamp ? a.checkInTimestamp.toISOString() : new Date().toISOString(),
          date: a.checkInTimestamp ? a.checkInTimestamp.toISOString() : new Date().toISOString(),
          endedAt: null,
          status: 'Completed',
          sessionsDeducted: a.sessionsDeducted || 1,
        });
        if (timeKey) usedTimeKeys.add(timeKey);
      }
    });

    // 3. Process home branch attendances
    attendances.forEach(att => {
      const timeKey = att.date ? Math.floor(new Date(att.date).getTime() / 120000) : 0;
      if (!usedTimeKeys.has(timeKey)) {
        const gymName = gymMap.get(att.gymId) || 'Home Gym';
        items.push({
          id: att.id,
          _id: att.id,
          gymId: att.gymId,
          gymName: gymName,
          branchId: att.branchId || null,
          branchName: null,
          startedAt: att.date ? att.date.toISOString() : new Date().toISOString(),
          date: att.date ? att.date.toISOString() : new Date().toISOString(),
          endedAt: null,
          status: 'Completed',
          sessionsDeducted: 0,
        });
        if (timeKey) usedTimeKeys.add(timeKey);
      }
    });

    items.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    let filtered = items;
    if (startDate || endDate) {
      const startMs = startDate ? new Date(startDate).getTime() : 0;
      const endMs = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Infinity;
      filtered = filtered.filter(i => {
        const t = new Date(i.startedAt).getTime();
        return t >= startMs && t <= endMs;
      });
    }

    if (status && status !== 'ALL') {
      filtered = filtered.filter(i => i.status.toLowerCase() === status.toLowerCase());
    }
    if (gymId) {
      filtered = filtered.filter(i => i.gymId === gymId);
    }
    if (branchId) {
      filtered = filtered.filter(i => i.branchId === branchId);
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const startIndex = (page - 1) * limit;
    const paginatedData = filtered.slice(startIndex, startIndex + limit);

    return res.json({
      success: true,
      data: paginatedData,
      history: paginatedData,
      total: filtered.length,
      meta: {
        page,
        limit,
        total: filtered.length,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Session history error');
    return res.status(500).json({ success: false, message: 'Could not load history.' });
  }
});

// @desc    Get member's FitPass summary for admins
// @route   GET /api/sessions/member-summary/:memberId
// @access  Private/Admin, Partner, SuperAdmin
const getMemberFitPassSummary = catchAsync(async (req, res, next) => {
  try {
    const { memberId } = req.params;

    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    // Role-based tenant isolation scoping
    if (req.user.role === 'partner' && member.gymId !== req.user.gymId) {
      return res.status(403).json({ success: false, message: 'Access denied: Member belongs to another organization.' });
    }
    if (req.user.role === 'admin' && (member.gymId !== req.user.gymId || member.branchId !== req.user.branchId)) {
      return res.status(403).json({ success: false, message: 'Access denied: Member belongs to another branch.' });
    }

    const successfulVisits = await prisma.fitPassAuditLog.findMany({
      where: {
        memberId,
        accessStatus: 'Success'
      },
      orderBy: { checkInTimestamp: 'desc' },
    });

    const totalVisits = successfulVisits.length;
    const lastVisit = successfulVisits[0] || null;

    // Frequently visited gyms calculation
    const gymCounts = {};
    successfulVisits.forEach(v => {
      const key = v.gymIdVisited;
      if (!gymCounts[key]) {
        gymCounts[key] = {
          gymId: v.gymIdVisited,
          gymName: v.gymName,
          count: 0,
        };
      }
      gymCounts[key].count += 1;
    });

    const frequentlyVisitedGyms = Object.values(gymCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return res.json({
      success: true,
      summary: {
        totalPurchasedSessions: member.sessionsTotal || 0,
        sessionsUsed: (member.sessionsTotal || 0) - (member.sessionsRemaining || 0),
        remainingSessions: member.sessionsRemaining || 0,
        expiryDate: member.expiryDate,
        lastGymVisited: lastVisit ? `${lastVisit.gymName}${lastVisit.branchNameVisited ? ` - ${lastVisit.branchNameVisited}` : ''}` : 'None',
        totalVisits,
        frequentlyVisitedGyms,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Member fitpass summary error');
    return res.status(500).json({ success: false, message: 'Could not load member summary.' });
  }
});

// @desc    Get FitPass analytics for admins
// @route   GET /api/sessions/analytics
// @access  Private/Admin, Partner, SuperAdmin
const getFitPassAnalytics = catchAsync(async (req, res, next) => {
  try {
    const logsFilter = { accessStatus: 'Success' };
    if (req.user.role === 'partner') {
      logsFilter.gymIdVisited = req.user.gymId;
    } else if (req.user.role === 'admin') {
      logsFilter.gymIdVisited = req.user.gymId;
      if (req.user.branchId) {
        logsFilter.branchIdVisited = req.user.branchId;
      }
    } else if ((req.user.role === 'fitpass_admin' || req.user.role === 'superadmin') && req.user.gymId && req.user.gymId !== 'SYSTEM') {
      logsFilter.gymIdVisited = req.user.gymId;
      if (req.user.branchId) {
        logsFilter.branchIdVisited = req.user.branchId;
      }
    }

    const successfulVisits = await prisma.fitPassAuditLog.findMany({
      where: logsFilter,
    });

    const fitPassPlans = await prisma.plan.findMany({
      where: { gymId: 'SYSTEM' },
      select: { id: true },
    });
    const fitPassPlanIds = fitPassPlans.map(p => p.id);

    let fitPassMembers = [];
    const isGlobal = !req.user.gymId || req.user.gymId === 'SYSTEM';
    if (isGlobal) {
      fitPassMembers = await prisma.member.findMany({
        where: {
          planId: { in: fitPassPlanIds }
        }
      });
    } else {
      const visitedMemberIds = [...new Set(successfulVisits.map(v => v.memberId))];
      fitPassMembers = await prisma.member.findMany({
        where: {
          id: { in: visitedMemberIds }
        }
      });
    }

    const totalFitPassMembers = fitPassMembers.length;
    const now = new Date();

    const activeFitPassMembers = fitPassMembers.filter(m => m.status === 'Active' && new Date(m.expiryDate) > now).length;
    const expiredFitPassMembers = fitPassMembers.filter(m => m.status === 'Expired' || new Date(m.expiryDate) <= now).length;

    let totalSessionsSold = 0;
    let remainingSessions = 0;
    fitPassMembers.forEach(m => {
      totalSessionsSold += m.sessionsTotal || 0;
      remainingSessions += m.sessionsRemaining || 0;
    });
    const totalSessionsUsed = totalSessionsSold - remainingSessions;

    // Most Visited Gyms
    const gymCounts = {};
    successfulVisits.forEach(v => {
      const key = v.gymIdVisited;
      if (!gymCounts[key]) {
        gymCounts[key] = {
          gymId: v.gymIdVisited,
          gymName: v.gymName,
          count: 0,
        };
      }
      gymCounts[key].count += 1;
    });
    const mostVisitedPartnerGyms = Object.values(gymCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Daily & Monthly Check-ins
    const dailyCheckIns = {};
    const monthlyCheckIns = {};
    successfulVisits.forEach(v => {
      const dateStr = v.checkInTimestamp.toISOString().split('T')[0];
      const monthStr = dateStr.substring(0, 7);

      dailyCheckIns[dateStr] = (dailyCheckIns[dateStr] || 0) + 1;
      monthlyCheckIns[monthStr] = (monthlyCheckIns[monthStr] || 0) + 1;
    });

    const dailyCheckInsList = Object.entries(dailyCheckIns)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    const monthlyCheckInsList = Object.entries(monthlyCheckIns)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const memberVisitCounts = {};
    successfulVisits.forEach(v => {
      memberVisitCounts[v.memberId] = (memberVisitCounts[v.memberId] || 0) + 1;
    });
    const visitCountsList = Object.values(memberVisitCounts);
    const totalMembersWhoVisited = visitCountsList.length;
    const avgVisitsPerMember = totalMembersWhoVisited > 0
      ? (visitCountsList.reduce((sum, val) => sum + val, 0) / totalMembersWhoVisited).toFixed(1)
      : 0;

    return res.json({
      success: true,
      analytics: {
        totalFitPassMembers,
        activeFitPassMembers,
        expiredFitPassMembers,
        totalSessionsSold,
        totalSessionsUsed,
        remainingSessions,
        mostVisitedPartnerGyms,
        dailyCheckIns: dailyCheckInsList,
        monthlyCheckIns: monthlyCheckInsList,
        avgVisitsPerMember: parseFloat(avgVisitsPerMember),
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Fitpass analytics error');
    return res.status(500).json({ success: false, message: 'Could not load FitPass analytics.' });
  }
});

// Zod schema for manual session-adjust
const adminAdjustSchema = z.object({
  memberId: z.string().min(1, 'Member id is required'),
  delta: z
    .number()
    .int('Delta must be a whole number')
    .refine((n) => n !== 0, 'Delta must not be zero'),
  reason: z
    .string()
    .min(5, 'A reason (min 5 chars) is required for session adjustments')
    .max(300, 'Reason is too long (max 300 chars)'),
});

// @desc    Admin manually adjusts a member's session balance (emergency credit-back)
// @route   POST /api/sessions/admin-adjust
// @access  Private/Admin, Receptionist
const adminAdjustSessions = catchAsync(async (req, res, next) => {
  try {
    const { memberId, delta, reason } = adminAdjustSchema.parse(req.body);

    const member = await Member.findOne({ _id: memberId, gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }) });
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found in your gym.' });
    }

    const before = member.sessionsRemaining || 0;
    const after = Math.max(0, before + delta);

    await Member.findByIdAndUpdate(member._id, { sessionsRemaining: after });

    await logAudit(req, 'SESSION_ADJUSTED', 'Member', member._id,
      `Sessions ${before} -> ${after} (${delta >= 0 ? '+' : ''}${delta}). Reason: ${reason}`,
      member.name || '');

    return res.json({
      success: true,
      message: `Session balance updated from ${before} to ${after}.`,
      sessionsRemaining: after,
    });
  } catch (error) {
    if (error?.issues) {
      return res.status(400).json({ success: false, message: error.issues[0].message });
    }
    logger.error({ err: error }, 'Admin session adjust error');
    return res.status(500).json({ success: false, message: 'Could not adjust sessions.' });
  }
});

/**
 * @desc    Get FitPass check-in audit for a partner's own gym (read-only)
 * @route   GET /api/sessions/partner-visits
 * @access  Private/Partner only — strictly scoped to req.user.gymId
 */
const getPartnerVisitLog = catchAsync(async (req, res, next) => {
  try {
    const gymId = req.user.gymId;
    if (!gymId) {
      return res.status(403).json({ success: false, message: 'No gym associated with this account.' });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize) || 50);
    const skip = (page - 1) * pageSize;

    const where = {
      gymIdVisited: gymId,
      accessStatus: 'Success',
    };

    // Optional date range filter
    if (req.query.from || req.query.to) {
      where.checkInTimestamp = {};
      if (req.query.from) where.checkInTimestamp.gte = new Date(req.query.from);
      if (req.query.to)   where.checkInTimestamp.lte = new Date(req.query.to);
    }

    const [total, visits] = await Promise.all([
      prisma.fitPassAuditLog.count({ where }),
      prisma.fitPassAuditLog.findMany({
        where,
        orderBy: { checkInTimestamp: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          memberName: true,
          checkInTimestamp: true,
          branchNameVisited: true,
          sessionsDeducted: true,
          accessStatus: true,
        },
      }),
    ]);

    return res.json({
      success: true,
      data: visits,
      meta: { page, pageSize, total },
    });
  } catch (error) {
    logger.error({ err: error }, 'Partner visit log error');
    return res.status(500).json({ success: false, message: 'Could not load visit log.' });
  }
});

module.exports = {
  checkIn,
  getSessionStatus,
  getSessionHistory,
  getMemberFitPassSummary,
  getFitPassAnalytics,
  adminAdjustSessions,
  adminAdjustSchema,
  getPartnerVisitLog,
};

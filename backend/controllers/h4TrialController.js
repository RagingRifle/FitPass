const catchAsync = require('../utils/catchAsync');
const prisma = require('../config/prisma');
const { H4_GYM_IDS } = require('../config/constants');
const { logAudit } = require('../utils/auditLogger');

const isH4Gym = async (gymId) => {
  if (!gymId) return false;
  if (H4_GYM_IDS.includes(String(gymId))) return true;
  const gym = await prisma.gym.findUnique({ where: { id: String(gymId) }, select: { name: true } }).catch(() => null);
  return Boolean(gym?.name?.toLowerCase().includes('h4'));
};

const adminGymId = async (req) => {
  const candidate = req.tenantFilter?.gymId || (req.user?.gymId && req.user.gymId !== 'SYSTEM' ? req.user.gymId : '');
  if (candidate && await isH4Gym(candidate)) return String(candidate);
  if (req.user?.role === 'superadmin') {
    const h4Gym = await prisma.gym.findFirst({
      where: { OR: [{ id: { in: H4_GYM_IDS } }, { name: { contains: 'H4', mode: 'insensitive' } }] },
      select: { id: true },
    }).catch(() => null);
    if (h4Gym?.id) return h4Gym.id;
  }
  return '';
};

const listCoupons = catchAsync(async (req, res) => {
  const gymId = await adminGymId(req);
  if (!gymId) return res.status(403).json({ message: 'Select an H4 gym to manage trial codes.' });
  const rows = await prisma.h4TrialCoupon.findMany({ where: { gymId }, orderBy: { createdAt: 'desc' } });
  res.json(rows);
});

const createCoupon = catchAsync(async (req, res) => {
  const gymId = await adminGymId(req);
  if (!gymId) return res.status(403).json({ message: 'Select an H4 gym to manage trial codes.' });
  const code = String(req.body.code || '').trim().toUpperCase();
  const startsAt = new Date(req.body.startsAt);
  const endsAt = new Date(req.body.endsAt);
  const trialDays = Number(req.body.trialDays);
  const checkInLimit = Number(req.body.checkInLimit);
  const maxRedemptions = req.body.maxRedemptions === '' || req.body.maxRedemptions == null ? null : Number(req.body.maxRedemptions);
  if (!/^[A-Z0-9-]{4,32}$/.test(code)) return res.status(400).json({ message: 'Use 4–32 letters, numbers, or hyphens for the referral code.' });
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) return res.status(400).json({ message: 'Set an end time after the start time.' });
  if (!Number.isInteger(trialDays) || trialDays < 1 || trialDays > 90) return res.status(400).json({ message: 'Trial access must be between 1 and 90 days.' });
  if (!Number.isInteger(checkInLimit) || checkInLimit < 1 || checkInLimit > 90) return res.status(400).json({ message: 'Check-ins must be between 1 and 90.' });
  if (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1)) return res.status(400).json({ message: 'Redemption limit must be a positive whole number.' });
  try {
    const workoutAccess = req.body.workoutAccess === true || req.body.workoutAccess === 'true';
    const coupon = await prisma.h4TrialCoupon.create({ data: { gymId, code, startsAt, endsAt, trialDays, checkInLimit, workoutAccess, maxRedemptions, createdBy: String(req.user.id || req.user._id || '') } });
    await logAudit(req, 'H4_TRIAL_CODE_CREATED', 'H4TrialCoupon', coupon.id, `Created H4 trial code ${code}`, code);
    res.status(201).json(coupon);
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ message: 'That referral code is already in use.' });
    throw error;
  }
});

const deactivateCoupon = catchAsync(async (req, res) => {
  const gymId = await adminGymId(req);
  if (!gymId) return res.status(403).json({ message: 'Select an H4 gym to manage trial codes.' });
  const updated = await prisma.h4TrialCoupon.updateMany({ where: { id: req.params.id, gymId }, data: { isActive: false } });
  if (!updated.count) return res.status(404).json({ message: 'Trial code not found.' });
  res.json({ success: true });
});

const resolveMember = async (user) => {
  if (user.memberId) {
    const member = await prisma.member.findUnique({ where: { id: user.memberId } });
    if (member) return member;
  }
  const clauses = [];
  if (user.email) clauses.push({ email: { equals: user.email.trim(), mode: 'insensitive' } });
  if (user.phone) clauses.push({ phone: user.phone });
  if (!clauses.length) return null;
  const matches = await prisma.member.findMany({ where: { OR: clauses }, orderBy: { updatedAt: 'desc' } });
  let member = null;
  for (const match of matches) if (await isH4Gym(match.gymId)) { member = match; break; }
  if (member && user.id) await prisma.user.update({ where: { id: user.id }, data: { memberId: member.id } }).catch(() => {});
  return member;
};

const redeemCoupon = catchAsync(async (req, res) => {
  if (req.user.role !== 'member') return res.status(403).json({ message: 'Member account required.' });
  const member = await resolveMember(req.user);
  if (!member || !(await isH4Gym(member.gymId))) return res.status(403).json({ message: 'H4 trial codes are available to H4 members only.' });
  const code = String(req.body.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ message: 'Enter a referral code.' });
  const now = new Date();
  const coupon = await prisma.h4TrialCoupon.findFirst({ where: { gymId: member.gymId, code, isActive: true } });
  if (!coupon || now < coupon.startsAt || now > coupon.endsAt) return res.status(400).json({ message: 'This referral code is unavailable or outside its valid time window.' });
  if (member.expiryDate && new Date(member.expiryDate) > now && member.status === 'Active') return res.status(409).json({ message: 'Your H4 membership is already active.' });
  if (member.trialEndsAt && new Date(member.trialEndsAt) > now) return res.status(409).json({ message: 'You already have an active trial.' });
  const prior = await prisma.h4TrialRedemption.findUnique({ where: { couponId_memberId: { couponId: coupon.id, memberId: member.id } } });
  if (prior) return res.status(409).json({ message: 'This referral code has already been used on your account.' });
  const expiresAt = new Date(now.getTime() + coupon.trialDays * 86400000);
  try {
    const redemption = await prisma.$transaction(async tx => {
      const update = await tx.h4TrialCoupon.updateMany({
        where: { id: coupon.id, isActive: true, startsAt: { lte: now }, endsAt: { gte: now }, ...(coupon.maxRedemptions == null ? {} : { redemptionCount: { lt: coupon.maxRedemptions } }) },
        data: { redemptionCount: { increment: 1 } },
      });
      if (!update.count) throw Object.assign(new Error('This referral code has reached its redemption limit.'), { statusCode: 409 });
      const created = await tx.h4TrialRedemption.create({ data: { couponId: coupon.id, memberId: member.id, gymId: member.gymId, expiresAt, checkInLimit: coupon.checkInLimit, workoutAccess: coupon.workoutAccess } });
      await tx.member.update({ where: { id: member.id }, data: { trialEndsAt: expiresAt, trialCheckInsLimit: coupon.checkInLimit, trialCheckInsUsed: 0, trialWorkoutAccess: coupon.workoutAccess, trialCouponCode: coupon.code } });
      return created;
    });
    res.json({ success: true, trial: { expiresAt: redemption.expiresAt, checkInLimit: redemption.checkInLimit, checkInsUsed: 0, workoutAccess: redemption.workoutAccess, code: coupon.code } });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ message: 'This referral code has already been used on your account.' });
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    throw error;
  }
});

module.exports = { listCoupons, createCoupon, deactivateCoupon, redeemCoupon };

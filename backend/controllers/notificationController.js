const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const logger = require('../lib/logger');
const Notification = require('../models/Notification');
const Member = require('../models/Member');
const User = require('../models/User');
const prisma = require('../config/prisma');
const { H4_GYM_IDS } = require('../config/constants');

const getH4GymIds = async () => {
    const gyms = await prisma.gym.findMany({
        where: {
            OR: [
                { id: { in: H4_GYM_IDS } },
                { name: { contains: 'h4', mode: 'insensitive' } },
            ],
        },
        select: { id: true },
    });
    const gymIds = new Set(gyms.map(gym => gym.id));
    return [
        ...H4_GYM_IDS.filter(id => gymIds.has(id)),
        ...gyms.map(gym => gym.id).filter(id => !H4_GYM_IDS.includes(id)),
    ];
};

const getSharedSettingsGymId = (gymIds) => (
    H4_GYM_IDS.find(id => gymIds.includes(id)) || gymIds[0]
);

const isAssignedBranchAdmin = (user) => user?.role === 'h4_branch_admin'
    || Boolean(user?.userBranchId)
    || user?.isH4BranchAdmin === true;

const reminderSettingsSelect = {
    inactivityReminderDays: true,
    inactivityReminderRepeatDaily: true,
    leadReminderDaysBefore: true,
    leadReminderRepeatDaily: true,
    dueReminderDaysAfter: true,
    dueReminderRepeatDaily: true,
    notifyNewProductToMembers: true,
};

const getH4GymId = async (req) => {
    if (!['h4_admin', 'h4_branch_admin', 'admin', 'superadmin'].includes(req.user?.role)
        && !isAssignedBranchAdmin(req.user)) return null;
    const gymId = String(
        req.user.role === 'superadmin'
            ? req.tenantFilter?.gymId || req.user.gymId || ''
            : req.user.gymId || ''
    );
    if (gymId && gymId !== 'SYSTEM') {
        if (H4_GYM_IDS.includes(gymId)) return gymId;
        const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { id: true, name: true } });
        return gym?.name?.toLowerCase().includes('h4') ? gym.id : null;
    }
    if (req.user.role === 'superadmin') {
        const h4Gym = await prisma.gym.findFirst({
            where: { OR: [{ id: { in: H4_GYM_IDS } }, { name: { contains: 'H4', mode: 'insensitive' } }] },
            select: { id: true },
        }).catch(() => null);
        return h4Gym?.id || null;
    }
    return null;
};

const getBranchReminderSettings = async (req, gymId) => {
    const branchId = String(req.user?.userBranchId || req.user?.branchId || '');
    if (!branchId) return null;
    const branch = await prisma.branch.findFirst({
        where: { id: branchId, gymId },
        select: { id: true, gymId: true, ...reminderSettingsSelect },
    });
    if (!branch) return null;
    const base = await prisma.gymSettings.upsert({
        where: { gymId },
        update: {},
        create: { gymId },
        select: { gymId: true, ...reminderSettingsSelect },
    });
    return {
        gymId,
        branchId: branch.id,
        ...Object.fromEntries(Object.keys(reminderSettingsSelect).map((field) => [
            field,
            branch[field] ?? base[field],
        ])),
    };
};

const getReminderSettings = catchAsync(async (req, res) => {
    const gymId = await getH4GymId(req);
    if (!gymId) return res.status(403).json({ message: 'Select an H4 gym to manage reminders.' });
    if (isAssignedBranchAdmin(req.user)) {
        const settings = await getBranchReminderSettings(req, gymId);
        if (!settings) return res.status(403).json({ message: 'Your assigned H4 branch could not be found.' });
        return res.json(settings);
    }
    const gymIds = await getH4GymIds();
    if (!gymIds.includes(gymId)) return res.status(403).json({ message: 'The selected H4 gym was not found.' });

    const sharedGymId = getSharedSettingsGymId(gymIds);
    const settingsRows = await Promise.all(gymIds.map(id => prisma.gymSettings.upsert({
        where: { gymId: id },
        update: {},
        create: { gymId: id },
        select: { gymId: true, ...reminderSettingsSelect },
    })));
    const settings = settingsRows.find(row => row.gymId === sharedGymId);
    return res.json(settings);
});

const updateReminderSettings = catchAsync(async (req, res) => {
    const gymId = await getH4GymId(req);
    if (!gymId) return res.status(403).json({ message: 'Select an H4 gym to manage reminders.' });

    const updates = {};
    for (const field of ['inactivityReminderDays', 'leadReminderDaysBefore', 'dueReminderDaysAfter']) {
        if (req.body[field] === undefined) continue;
        const days = Number(req.body[field]);
        const minimum = field === 'dueReminderDaysAfter' ? 0 : 1;
        if (!Number.isInteger(days) || days < minimum || days > 365) {
            return res.status(400).json({ message: `${field} must be between ${minimum} and 365 days.` });
        }
        updates[field] = days;
    }

    for (const field of ['inactivityReminderRepeatDaily', 'leadReminderRepeatDaily', 'dueReminderRepeatDaily', 'notifyNewProductToMembers']) {
        if (req.body[field] === undefined) continue;
        if (typeof req.body[field] !== 'boolean') {
            return res.status(400).json({ message: `${field} must be true or false.` });
        }
        updates[field] = req.body[field];
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: 'At least one reminder setting is required.' });
    }

    if (isAssignedBranchAdmin(req.user)) {
        const branchId = String(req.user.userBranchId || req.user.branchId || '');
        if (!branchId) return res.status(403).json({ message: 'An assigned H4 branch is required to manage reminders.' });
        const saved = await prisma.branch.updateMany({
            where: { id: branchId, gymId },
            data: updates,
        });
        if (!saved.count) return res.status(403).json({ message: 'Your assigned H4 branch could not be found.' });
        const settings = await getBranchReminderSettings(req, gymId);
        return res.json({ message: 'Branch reminder settings saved.', settings });
    }

    const gymIds = await getH4GymIds();
    if (!gymIds.includes(gymId)) return res.status(403).json({ message: 'The selected H4 gym was not found.' });
    const sharedGymId = getSharedSettingsGymId(gymIds);
    const settingsRows = await prisma.$transaction(gymIds.map(id => prisma.gymSettings.upsert({
        where: { gymId: id },
        update: updates,
        create: { gymId: id, ...updates },
        select: { gymId: true, ...reminderSettingsSelect },
    })));
    const settings = settingsRows.find(row => row.gymId === sharedGymId);
    return res.json({ message: 'Reminder settings saved.', settings });
});

// @desc    Get unread notifications and auto-generate alerts
// @route   GET /api/notifications
// @access  Private
const getNotifications = catchAsync(async (req, res, next) => {
    try {
        // 1. Auto-generate alerts before fetching
        await generateAutomatedAlerts(req.user);

        const notifications = await Notification.find({ recipientId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(20);

        res.json(notifications);
    } catch (error) { next(error); }
});

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id
// @access  Private
const markAsRead = catchAsync(async (req, res, next) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (notification && notification.recipientId === req.user._id) {
            notification.read = true;
            await notification.save();
            res.json({ message: 'Marked as read' });
        } else {
            res.status(404).json({ success: false, message: 'Notification not found' });
        }
    } catch (error) { next(error); }
});

// @desc    Create gym-wide announcement
// @route   POST /api/notifications/announcement
// @access  Private/Admin
const createAnnouncement = catchAsync(async (req, res, next) => {
    try {
        const { message } = req.body;

        if (!message) {
            res.status(400);
            return res.json({ success: false, message: 'Message is required' });
        }

        // Find all users in this gym
        const users = await User.find({ gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }) });

        const notifications = users.map(user => ({
            recipientId: user._id,
            gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }),
            type: 'announcement',
            message: `Gym Announcement: ${message}`
        }));

        await Notification.insertMany(notifications);
        res.status(201).json({ message: 'Announcement sent to all users' });
    } catch (error) { next(error); }
});

const { runDailyRemindersIfDue } = require('../utils/dailyReminders');

// Helper logic to find members with expiries or dues
const generateAutomatedAlerts = async (user) => {
    try {
        await runDailyRemindersIfDue();
        const today = new Date();
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(today.getDate() + 3);

        // Only run this check occasionally or for certain triggers
        // For simplicity, we'll check members for local gym

        // 1. Check for Expiries
        const memberScope = { gymId: user.gymId, ...(user.branchId && { branchId: user.branchId }) };
        const expiringMembers = await Member.find({
            ...memberScope,
            expiryDate: { $lte: threeDaysFromNow, $gt: today },
            status: 'Active'
        });
        const canReceiveMemberAlerts = ['admin', 'receptionist', 'h4_admin', 'h4_branch_admin'].includes(user.role)
            || isAssignedBranchAdmin(user);

        // Each notification is an independent dedupe-then-create against a
        // different message, so these can run concurrently instead of
        // serially awaiting one member at a time.
        if (canReceiveMemberAlerts) {
            await Promise.all(expiringMembers.map(member => {
                const msg = `Member ${member.name}'s plan is expiring on ${member.expiryDate.toLocaleDateString()}`;
                return createUniqueNotification(user._id, user.gymId, 'expiry', msg);
            }));
        }

        // 2. Check for Dues (only for staff)
        if (canReceiveMemberAlerts) {
            const allMembers = await Member.find(memberScope);
            const membersWithDues = allMembers.filter(member => member.planPrice > member.paidAmount);

            await Promise.all(membersWithDues.map(member => {
                const msg = `Member ${member.name} has a pending balance of ₹${member.planPrice - member.paidAmount}`;
                return createUniqueNotification(user._id, user.gymId, 'payment', msg);
            }));
        }
    } catch (error) {
        logger.error({ err: error }, 'Generate automated alerts failed');
    }
};

const createUniqueNotification = async (recipientId, gymId, type, message) => {
    try {
        // Check if a similar unread notification already exists to avoid spam
        const exists = await Notification.findOne({
            recipientId,
            type,
            message,
            read: false
        });

        if (!exists) {
            await Notification.create({ recipientId, gymId, type, message });
        }
    } catch (error) {
        logger.error({ err: error }, 'Create unique notification failed');
    }
};

const resolveFilteredH4Members = async (req, gymId, filters = {}) => {
    const branchLocked = isAssignedBranchAdmin(req.user);
    const effectiveBranchId = branchLocked
        ? String(req.user.userBranchId || req.user.branchId || '')
        : String(filters.branchId || '').trim();

    const where = {
        gymId,
        ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        ...(filters.status ? { status: String(filters.status) } : {}),
        ...(filters.planId ? { planId: String(filters.planId) } : {}),
    };

    const inactiveDays = filters.inactiveDays !== '' && filters.inactiveDays != null
        ? Number(filters.inactiveDays)
        : null;
    if (Number.isInteger(inactiveDays) && inactiveDays > 0) {
        const now = new Date();
        const cutoff = new Date(
            (Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86400000)
                - inactiveDays + 1) * 86400000
        );
        where.OR = [
            { lastCheckInAt: { lt: cutoff } },
            { lastCheckInAt: null, joinDate: { lt: cutoff } },
        ];
    }

    const search = String(filters.search || '').trim().toLowerCase();
    const members = await prisma.member.findMany({
        where,
        orderBy: { name: 'asc' },
        select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            registrationNumber: true,
            status: true,
            branchId: true,
            branchName: true,
            planName: true,
            planPrice: true,
            paidAmount: true,
            lastCheckInAt: true,
        },
    });

    const filtered = members.filter(member => {
        if (filters.hasPendingDues && !(Number(member.planPrice || 0) > Number(member.paidAmount || 0))) {
            return false;
        }
        if (search) {
            const hay = [member.name, member.phone, member.email, member.registrationNumber]
                .map(v => String(v || '').toLowerCase())
                .join(' ');
            if (!hay.includes(search)) return false;
        }
        return true;
    });

    const memberIds = filtered.map(m => m.id);
    const linkedUsers = memberIds.length
        ? await prisma.user.findMany({
            where: { memberId: { in: memberIds }, isActive: true, status: 'Active' },
            select: { id: true, memberId: true },
        })
        : [];
    const userByMemberId = new Map(linkedUsers.map(u => [u.memberId, u.id]));

    return filtered.map(member => ({
        ...member,
        dueAmount: Math.max(0, Number(member.planPrice || 0) - Number(member.paidAmount || 0)),
        hasAppAccount: userByMemberId.has(member.id),
        recipientUserId: userByMemberId.get(member.id) || null,
    }));
};

const previewCustomNotificationRecipients = catchAsync(async (req, res) => {
    const gymId = await getH4GymId(req);
    if (!gymId) return res.status(403).json({ message: 'Select an H4 gym to preview recipients.' });
    const members = await resolveFilteredH4Members(req, gymId, req.body || {});
    res.json({
        totalMatched: members.length,
        appReachableCount: members.filter(m => m.hasAppAccount).length,
        members: members.slice(0, 150),
    });
});

const sendCustomNotification = catchAsync(async (req, res) => {
    const gymId = await getH4GymId(req);
    if (!gymId) return res.status(403).json({ message: 'Select an H4 gym to send notifications.' });

    const message = String(req.body?.message || '').trim();
    if (!message) {
        return res.status(400).json({ message: 'Notification message is required.' });
    }
    const type = String(req.body?.type || 'custom').trim() || 'custom';
    const explicitMemberIds = Array.isArray(req.body?.memberIds)
        ? req.body.memberIds.map(String).filter(Boolean)
        : [];

    let recipientUserIds = [];
    let matchedCount = 0;

    if (explicitMemberIds.length > 0) {
        const branchLocked = isAssignedBranchAdmin(req.user);
        const scopedMembers = await prisma.member.findMany({
            where: {
                gymId,
                id: { in: explicitMemberIds },
                ...(branchLocked ? { branchId: String(req.user.userBranchId || req.user.branchId || '') } : {}),
            },
            select: { id: true },
        });
        matchedCount = scopedMembers.length;
        const users = scopedMembers.length
            ? await prisma.user.findMany({
                where: { memberId: { in: scopedMembers.map(m => m.id) }, isActive: true, status: 'Active' },
                select: { id: true },
            })
            : [];
        recipientUserIds = [...new Set(users.map(u => u.id))];
    } else {
        const members = await resolveFilteredH4Members(req, gymId, req.body?.filters || {});
        matchedCount = members.length;
        recipientUserIds = [...new Set(members.map(m => m.recipientUserId).filter(Boolean))];
    }

    if (recipientUserIds.length > 0) {
        await prisma.notification.createMany({
            data: recipientUserIds.map(recipientId => ({
                recipientId,
                gymId,
                type,
                message,
            })),
        });
    }

    res.status(201).json({
        success: true,
        matchedCount,
        sentCount: recipientUserIds.length,
        message: recipientUserIds.length > 0
            ? `Sent notification to ${recipientUserIds.length} member app account${recipientUserIds.length === 1 ? '' : 's'}.`
            : 'No matching members currently have an active mobile app account.',
    });
});

module.exports = {
    getNotifications,
    markAsRead,
    createAnnouncement,
    getReminderSettings,
    updateReminderSettings,
    previewCustomNotificationRecipients,
    sendCustomNotification,
};

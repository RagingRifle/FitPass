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

const reminderSettingsSelect = {
    inactivityReminderDays: true,
    inactivityReminderRepeatDaily: true,
    leadReminderDaysBefore: true,
    leadReminderRepeatDaily: true,
};

const getH4GymId = async (req) => {
    if (!['h4_admin', 'superadmin'].includes(req.user?.role)) return null;
    const gymId = String(
        req.user.role === 'superadmin'
            ? req.tenantFilter?.gymId || req.user.gymId || ''
            : req.user.gymId || ''
    );
    if (!gymId || gymId === 'SYSTEM') return null;
    if (H4_GYM_IDS.includes(gymId)) return gymId;
    const gym = await prisma.gym.findUnique({ where: { id: gymId }, select: { id: true, name: true } });
    return gym?.name?.toLowerCase().includes('h4') ? gym.id : null;
};

const getReminderSettings = catchAsync(async (req, res) => {
    const gymId = await getH4GymId(req);
    if (!gymId) return res.status(403).json({ message: 'Select an H4 gym to manage reminders.' });
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
    const gymIds = await getH4GymIds();
    if (!gymIds.includes(gymId)) return res.status(403).json({ message: 'The selected H4 gym was not found.' });

    const updates = {};
    for (const field of ['inactivityReminderDays', 'leadReminderDaysBefore']) {
        if (req.body[field] === undefined) continue;
        const days = Number(req.body[field]);
        const minimum = 1;
        if (!Number.isInteger(days) || days < minimum || days > 365) {
            return res.status(400).json({ message: `${field} must be between ${minimum} and 365 days.` });
        }
        updates[field] = days;
    }

    for (const field of ['inactivityReminderRepeatDaily', 'leadReminderRepeatDaily']) {
        if (req.body[field] === undefined) continue;
        if (typeof req.body[field] !== 'boolean') {
            return res.status(400).json({ message: `${field} must be true or false.` });
        }
        updates[field] = req.body[field];
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: 'At least one reminder setting is required.' });
    }

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

// Helper logic to find members with expiries or dues
const generateAutomatedAlerts = async (user) => {
    try {
        const today = new Date();
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(today.getDate() + 3);

        // Only run this check occasionally or for certain triggers
        // For simplicity, we'll check members for local gym

        // 1. Check for Expiries
        const expiringMembers = await Member.find({
            gymId: user.gymId,
            expiryDate: { $lte: threeDaysFromNow, $gt: today },
            status: 'Active'
        });

        // Each notification is an independent dedupe-then-create against a
        // different message, so these can run concurrently instead of
        // serially awaiting one member at a time.
        if (user.role === 'admin' || user.role === 'receptionist') {
            await Promise.all(expiringMembers.map(member => {
                const msg = `Member ${member.name}'s plan is expiring on ${member.expiryDate.toLocaleDateString()}`;
                return createUniqueNotification(user._id, user.gymId, 'expiry', msg);
            }));
        }

        // 2. Check for Dues (only for staff)
        if (user.role === 'admin' || user.role === 'receptionist') {
            const allMembers = await Member.find({ gymId: user.gymId });
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

module.exports = {
    getNotifications,
    markAsRead,
    createAnnouncement,
    getReminderSettings,
    updateReminderSettings,
};

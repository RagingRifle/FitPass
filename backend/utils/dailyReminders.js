const prisma = require('../config/prisma');
const { H4_GYM_IDS } = require('../config/constants');
const logger = require('../lib/logger');
const {
    createReminderDedupeKey,
    getDaysSince,
    getDaysUntil,
    getUtcDateKey,
} = require('./reminderSchedule');

const THROTTLE_MS = 5 * 60 * 1000;
let lastRunAt = 0;
let inFlightRun = null;

const createScheduledNotification = async ({ recipientId, gymId, type, message, dedupeKey }) => {
    try {
        await prisma.notification.create({
            data: { recipientId, gymId, type, message, dedupeKey }
        });
        return true;
    } catch (error) {
        if (error?.code === 'P2002') return false;
        throw error;
    }
};

/**
 * Generates deduplicated lead follow-up and inactive-member reminder
 * notifications for all configured gyms and H4 branches.
 */
const runDailyReminders = async () => {
    const h4Gyms = await prisma.gym.findMany({
        where: {
            OR: [
                { id: { in: H4_GYM_IDS } },
                { name: { contains: 'h4', mode: 'insensitive' } },
            ],
        },
        select: { id: true },
    });
    await Promise.all(h4Gyms.map(gym => prisma.gymSettings.upsert({
        where: { gymId: gym.id },
        update: {},
        create: { gymId: gym.id },
    })));

    const configs = await prisma.gymSettings.findMany({
        select: {
            gymId: true,
            inactivityReminderDays: true,
            inactivityReminderRepeatDaily: true,
            leadReminderDaysBefore: true,
            leadReminderRepeatDaily: true,
        }
    });

    const today = new Date();
    for (const config of configs) {
        const gym = H4_GYM_IDS.includes(config.gymId)
            ? { name: 'H4' }
            : await prisma.gym.findUnique({ where: { id: config.gymId }, select: { name: true } });
        const isH4Gym = Boolean(gym?.name?.toLowerCase().includes('h4'));
        const [users, superAdmins, branches] = await Promise.all([
            prisma.user.findMany({
                where: { gymId: config.gymId, isActive: true, status: 'Active' },
                select: { id: true, name: true, role: true, memberId: true, branchId: true }
            }),
            isH4Gym
                ? prisma.user.findMany({
                    where: { role: 'superadmin', isActive: true, status: 'Active' },
                    select: { id: true, name: true, role: true, memberId: true, branchId: true }
                })
                : Promise.resolve([]),
            isH4Gym
                ? prisma.branch.findMany({
                    where: { gymId: config.gymId },
                    select: {
                        id: true,
                        inactivityReminderDays: true,
                        inactivityReminderRepeatDaily: true,
                        leadReminderDaysBefore: true,
                        leadReminderRepeatDaily: true
                    }
                })
                : Promise.resolve([])
        ]);

        for (const branch of isH4Gym ? [null, ...branches] : [null]) {
            const branchId = branch?.id || null;
            const branchScope = isH4Gym ? { branchId } : {};
            const branchConfig = {
                ...config,
                ...(branch ? {
                    inactivityReminderDays: branch.inactivityReminderDays ?? config.inactivityReminderDays,
                    inactivityReminderRepeatDaily: branch.inactivityReminderRepeatDaily ?? config.inactivityReminderRepeatDaily,
                    leadReminderDaysBefore: branch.leadReminderDaysBefore ?? config.leadReminderDaysBefore,
                    leadReminderRepeatDaily: branch.leadReminderRepeatDaily ?? config.leadReminderRepeatDaily
                } : {})
            };
            const inactivityDays = Math.max(1, Number(branchConfig.inactivityReminderDays) || 5);
            const leadDaysBefore = Math.max(0, Number(branchConfig.leadReminderDaysBefore) || 0);

            const leads = isH4Gym ? await prisma.lead.findMany({
                where: {
                    gymId: config.gymId,
                    ...branchScope,
                    followUpDate: { not: null },
                    status: { notIn: ['Converted', 'Closed', 'Lost'] }
                },
                select: { id: true, name: true, phone: true, followUpDate: true, assignedTo: true }
            }) : [];

            const adminUsers = [
                ...users.filter(user => {
                    if (!['admin', 'h4_admin', 'h4_branch_admin'].includes(user.role)) return false;
                    if (!isH4Gym) return true;
                    if (!user.branchId) return ['admin', 'h4_admin'].includes(user.role);
                    return String(user.branchId) === String(branchId || '');
                }),
                ...superAdmins
            ];

            for (const lead of leads) {
                const daysUntil = getDaysUntil(lead.followUpDate, today);
                if (daysUntil > leadDaysBefore) continue;

                const assignedStaff = users.filter(user => (
                    (user.id === lead.assignedTo || user.name === lead.assignedTo)
                    && (!isH4Gym || !user.branchId || String(user.branchId) === String(branchId || ''))
                ));
                const recipients = [...adminUsers, ...assignedStaff];
                const timing = daysUntil > 0
                    ? `in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`
                    : daysUntil === 0
                        ? 'today'
                        : `${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'} overdue`;

                for (const recipient of new Map(recipients.map(user => [user.id, user])).values()) {
                    const dedupeKey = createReminderDedupeKey({
                        type: 'lead_followup',
                        subjectId: lead.id,
                        recipientId: recipient.id,
                        cycleKey: getUtcDateKey(lead.followUpDate),
                        repeatDaily: branchConfig.leadReminderRepeatDaily,
                        today
                    });
                    await createScheduledNotification({
                        recipientId: recipient.id,
                        gymId: config.gymId,
                        type: 'lead_followup',
                        message: `Follow up with ${lead.name} (${lead.phone}); follow-up is ${timing}.`,
                        dedupeKey
                    });
                }
            }

            const activityCutoff = new Date(
                (Math.floor(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) / 86400000)
                    - inactivityDays + 1) * 86400000
            );
            const members = await prisma.member.findMany({
                where: {
                    gymId: config.gymId,
                    ...branchScope,
                    status: 'Active',
                    OR: [
                        { lastCheckInAt: { lt: activityCutoff } },
                        { lastCheckInAt: null, joinDate: { lt: activityCutoff } }
                    ]
                },
                select: { id: true, name: true, lastCheckInAt: true, joinDate: true }
            });

            const memberUsers = users.filter(user => user.memberId);
            const staffRecipients = users.filter(user => {
                if (!['admin', 'h4_admin', 'h4_branch_admin', 'receptionist'].includes(user.role)) return false;
                if (!isH4Gym) return true;
                if (!user.branchId) return ['admin', 'h4_admin'].includes(user.role);
                return String(user.branchId) === String(branchId || '');
            });

            for (const member of members) {
                const lastActivity = member.lastCheckInAt || member.joinDate;
                const daysSince = getDaysSince(lastActivity, today);
                if (daysSince < inactivityDays) continue;

                const recipients = [
                    ...staffRecipients,
                    ...superAdmins,
                    ...memberUsers.filter(user => user.memberId === member.id)
                ];
                for (const recipient of new Map(recipients.map(user => [user.id, user])).values()) {
                    const isStaff = recipient.role !== 'member';
                    const dedupeKey = createReminderDedupeKey({
                        type: 'inactive_member',
                        subjectId: member.id,
                        recipientId: recipient.id,
                        cycleKey: getUtcDateKey(lastActivity),
                        repeatDaily: branchConfig.inactivityReminderRepeatDaily,
                        today
                    });
                    await createScheduledNotification({
                        recipientId: recipient.id,
                        gymId: config.gymId,
                        type: 'inactive_member',
                        message: isStaff
                            ? `${member.name} has not checked in for ${daysSince} days.`
                            : `We have missed you at the gym. It has been ${daysSince} days since your last check-in.`,
                        dedupeKey
                    });
                }
            }
        }
    }
};

/**
 * Throttled wrapper so notification polling catches up on today's reminders
 * even if the server was restarted after the 09:00 cron window.
 */
const runDailyRemindersIfDue = async () => {
    const now = Date.now();
    if (inFlightRun) return inFlightRun;
    if (now - lastRunAt < THROTTLE_MS) return;
    lastRunAt = now;
    inFlightRun = runDailyReminders()
        .catch(error => {
            logger.error({ err: error }, '[InactivityReminder] Daily reminders failed.');
        })
        .finally(() => {
            inFlightRun = null;
        });
    return inFlightRun;
};

module.exports = {
    runDailyReminders,
    runDailyRemindersIfDue,
};

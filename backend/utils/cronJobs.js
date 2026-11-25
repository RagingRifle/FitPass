const cron = require('node-cron');
const Member = require('../models/Member');
const { sendEmail, sendWhatsApp } = require('./notificationService');
const logger = require('../lib/logger');
const { autoUnfreezeDueMembers } = require('../controllers/freezeController');
const prisma = require('../config/prisma');
const { H4_GYM_IDS } = require('../config/constants');
const {
    createReminderDedupeKey,
    getDaysSince,
    getDaysUntil,
    getUtcDateKey,
} = require('./reminderSchedule');

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

const startCronJobs = () => {
    // Scheduled membership pauses resume automatically at their chosen time.
    cron.schedule('*/5 * * * *', async () => {
        try {
            const resumed = await autoUnfreezeDueMembers();
            if (resumed) logger.info(`[MembershipFreeze] Automatically resumed ${resumed} scheduled pause(s).`);
        } catch (error) {
            logger.error({ err: error }, '[MembershipFreeze] Automatic resume job failed.');
        }
    });

    // Send configured lead and inactive-member reminders to the in-app inbox.
    cron.schedule('0 9 * * *', async () => {
        try {
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
                const inactivityDays = Math.max(1, Number(config.inactivityReminderDays) || 5);
                const leadDaysBefore = Math.max(0, Number(config.leadReminderDaysBefore) || 0);
                const gym = H4_GYM_IDS.includes(config.gymId)
                    ? { name: 'H4' }
                    : await prisma.gym.findUnique({ where: { id: config.gymId }, select: { name: true } });
                const isH4Gym = Boolean(gym?.name?.toLowerCase().includes('h4'));
                const [users, superAdmins, leads] = await Promise.all([
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
                    isH4Gym ? prisma.lead.findMany({
                        where: {
                            gymId: config.gymId,
                            followUpDate: { not: null },
                            status: { notIn: ['Converted', 'Closed', 'Lost'] }
                        },
                        select: { id: true, name: true, phone: true, followUpDate: true, assignedTo: true }
                    }) : Promise.resolve([])
                ]);
                const adminUsers = [
                    ...users.filter(user => ['admin', 'h4_admin'].includes(user.role)),
                    ...superAdmins
                ];

                for (const lead of leads) {
                    const daysUntil = getDaysUntil(lead.followUpDate, today);
                    if (daysUntil > leadDaysBefore) continue;

                    const recipients = [
                        ...adminUsers,
                        ...users.filter(user => (
                            user.id === lead.assignedTo || user.name === lead.assignedTo
                        ))
                    ];
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
                            repeatDaily: config.leadReminderRepeatDaily,
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
                        status: 'Active',
                        OR: [
                            { lastCheckInAt: { lt: activityCutoff } },
                            { lastCheckInAt: null, joinDate: { lt: activityCutoff } }
                        ]
                    },
                    select: { id: true, name: true, lastCheckInAt: true, joinDate: true }
                });
                const memberUsers = users.filter(user => user.memberId);
                for (const member of members) {
                    const lastActivity = member.lastCheckInAt || member.joinDate;
                    const daysSince = getDaysSince(lastActivity, today);
                    if (daysSince < inactivityDays) continue;

                    const recipients = [
                        ...users.filter(user => ['admin', 'h4_admin', 'receptionist'].includes(user.role)),
                        ...superAdmins,
                        ...memberUsers.filter(user => user.memberId === member.id)
                    ];
                    for (const recipient of recipients) {
                        const isStaff = recipient.role !== 'member';
                        const dedupeKey = createReminderDedupeKey({
                            type: 'inactive_member',
                            subjectId: member.id,
                            recipientId: recipient.id,
                            cycleKey: getUtcDateKey(lastActivity),
                            repeatDaily: config.inactivityReminderRepeatDaily,
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
        } catch (error) { logger.error({ err: error }, '[InactivityReminder] Daily reminders failed.'); }
    });

    // Run every day at midnight (00:00)
    cron.schedule('0 0 * * *', async () => {
        logger.info('--- Running Daily Gym CRM Maintenance Job ---');

        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // 1. Auto Update Status (Active -> Expired)
            const expiredResult = await Member.updateMany(
                { status: 'Active', expiryDate: { $lt: today } },
                { status: 'Expired' }
            );
            logger.info(`Auto-Status Update: ${expiredResult.modifiedCount} members shifted to Expired.`);

            // 2. Expiry Reminders (7 Days & 1 Day)
            const reminderDates = [7, 1];

            for (const days of reminderDates) {
                const targetDateStart = new Date(today);
                targetDateStart.setDate(today.getDate() + days);
                const targetDateEnd = new Date(targetDateStart);
                targetDateEnd.setDate(targetDateStart.getDate() + 1);

                const membersToExpire = await Member.find({
                    status: 'Active',
                    expiryDate: { $gte: targetDateStart, $lt: targetDateEnd }
                });

                logger.info(`Found ${membersToExpire.length} members expiring in ${days} days.`);

                for (const member of membersToExpire) {
                    const subject = `Gym Membership Expiry Reminder - ${days} day(s) left!`;
                    const messageText = `Hi ${member.name}, your gym membership will expire in ${days} day(s) on ${member.expiryDate.toLocaleDateString()}. Please renew soon to continue your fitness journey!`;
                    const htmlContent = `
                        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px;">
                            <h2 style="color: #6366f1;">Membership Expiry Reminder</h2>
                            <p>Hi <strong>${member.name}</strong>,</p>
                            <p>Your gym membership is set to expire in <strong>${days} day(s)</strong> on <strong>${member.expiryDate.toLocaleDateString()}</strong>.</p>
                            <p>Don't stop your progress! Renew your plan today at the front desk or via the app.</p>
                            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                            <p style="font-size: 0.8rem; color: #64748b;">Best regards,<br>The Gym Management Team</p>
                        </div>
                    `;

                    // Send Email
                    if (member.email) {
                        try {
                            await sendEmail({
                                email: member.email,
                                subject: subject,
                                html: htmlContent
                            });
                        } catch (err) {
                            logger.error({ err }, `Failed to send expiry reminder email to ${member.name}`);
                        }
                    }

                    // Send WhatsApp (Simulation)
                    await sendWhatsApp({
                        phone: member.phone,
                        message: messageText
                    });
                }
            }

            logger.info('--- Maintenance Job Completed ---');
        } catch (error) {
            logger.error({ err: error }, 'Error in daily maintenance cron job');
        }
    });

    // --- FitPrime session auto-expiry (every minute) ---
    // Bulk-reconcile sessions whose clock has run out. The lazy expireIfDue()
    // helper in sessionHelpers.js already handles this on read for correctness,
    // so this cron only exists to clean up rows and member fields in the
    // background for sessions that are never read again.
    //
    // NOTE: intentionally does NOT call logAudit() -- session-expiry volume would
    // flood the admin AuditLogs UI. Operational visibility stays in console logs only.
    cron.schedule('* * * * *', async () => {
        const runWithRetry = async (fn, retries = 2, delay = 3000) => {
            for (let i = 1; i <= retries; i++) {
                try {
                    return await fn();
                } catch (err) {
                    if (i === retries) throw err;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        };

        try {
            const now = new Date();
            const prisma = require('../config/prisma');

            // 1. Expire the SessionCheckIn rows.
            const expiredRows = await runWithRetry(() =>
                prisma.sessionCheckIn.updateMany({
                    where: { status: 'active', expiresAt: { lte: now } },
                    data: { status: 'expired' },
                })
            );

            if (expiredRows && expiredRows.count > 0) {
                // 2. Clear the now-expired active session fields on those members.
                const justExpired = await runWithRetry(() =>
                    prisma.sessionCheckIn.findMany({
                        where: { status: 'expired', expiresAt: { lte: now } },
                        select: { memberId: true, expiresAt: true },
                        distinct: ['memberId'],
                    })
                );
                for (const row of justExpired) {
                    await prisma.member.updateMany({
                        where: { id: row.memberId, currentSessionEndsAt: row.expiresAt },
                        data: { currentSessionEndsAt: null, currentSessionGymId: null },
                    }).catch(() => {});
                }
                logger.info(`[SessionExpiry] Expired ${expiredRows.count} session(s).`);
            }
        } catch (error) {
            // Silently handle transient socket timeouts in background cron
            if (error?.code !== 'P1008') {
                logger.error({ message: error.message }, '[SessionExpiry] background sync issue');
            }
        }
    });

    logger.info('Cron jobs scheduled logic initialized.');
};

module.exports = startCronJobs;

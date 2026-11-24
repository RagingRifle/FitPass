const cron = require('node-cron');
const Member = require('../models/Member');
const { sendEmail, sendWhatsApp } = require('./notificationService');
const logger = require('../lib/logger');
const { autoUnfreezeDueMembers } = require('../controllers/freezeController');
const prisma = require('../config/prisma');

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

    // Send an in-app reminder to inactive members and their gym administrators.
    cron.schedule('0 9 * * *', async () => {
        try {
            const configs = await prisma.gymSettings.findMany({ select: { gymId: true, inactivityReminderDays: true } });
            for (const config of configs) {
                const days = Math.max(1, Number(config.inactivityReminderDays) || 7);
                const cutoff = new Date(Date.now() - days * 86400000);
                const members = await prisma.member.findMany({ where: { gymId: config.gymId, status: 'Active', OR: [{ lastCheckInAt: { lt: cutoff } }, { lastCheckInAt: null, joinDate: { lt: cutoff } }] }, select: { id: true, name: true, lastCheckInAt: true } });
                if (!members.length) continue;
                const users = await prisma.user.findMany({ where: { gymId: config.gymId, OR: [{ role: { in: ['admin', 'h4_admin', 'receptionist'] } }, { memberId: { in: members.map(m => m.id) } }] }, select: { id: true, role: true, memberId: true } });
                for (const member of members) {
                    const memberUsers = users.filter(user => user.memberId === member.id);
                    const recipients = [...users.filter(user => ['admin', 'h4_admin', 'receptionist'].includes(user.role)), ...memberUsers];
                    for (const recipient of recipients) {
                        const message = ['admin', 'h4_admin', 'receptionist'].includes(recipient.role)
                            ? `${member.name} has not checked in for ${days} days.`
                            : `We have missed you at the gym. It has been ${days} days since your last check-in.`;
                        const exists = await prisma.notification.findFirst({ where: { recipientId: recipient.id, type: 'inactive_member', message, read: false } });
                        if (!exists) await prisma.notification.create({ data: { recipientId: recipient.id, gymId: config.gymId, type: 'inactive_member', message } });
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

const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../../config/db');
const Branch = require('../../models/Branch');
const Member = require('../../models/Member');
const User = require('../../models/User');
const Payment = require('../../models/Payment');

const DAY = 24 * 60 * 60 * 1000;
const scenarios = [
    { type: 'NEW_MEMBER', daysAgo: 3, source: 'Offline', method: 'Cash', amountFactor: 1 },
    { type: 'NEW_MEMBER', daysAgo: 21, source: 'Referral', method: 'UPI', amountFactor: 0.85 },
    { type: 'NEW_MEMBER', daysAgo: 52, source: 'Online', method: 'Bank Transfer', amountFactor: 1 },
    { type: 'RENEWAL', daysAgo: 10, source: 'Walk-in', method: 'Cash', amountFactor: 0.9 },
    { type: 'RENEWAL', daysAgo: 74, source: 'WhatsApp', method: 'UPI', amountFactor: 1 },
    { type: 'UPGRADE', daysAgo: 36, source: 'Instagram', method: 'Card', amountFactor: 1.15 },
    { type: 'UPGRADE', daysAgo: 128, source: 'Offline', method: 'Bank Transfer', amountFactor: 1.1 },
    { type: 'BALANCE_COLLECTION', daysAgo: 5, source: 'Online', method: 'UPI', amountFactor: 0.2 },
    { type: 'BALANCE_COLLECTION', daysAgo: 93, source: 'Offline', method: 'Cash', amountFactor: 0.15 },
    { type: 'NEW_MEMBER', daysAgo: 0, source: 'Online', method: 'UPI', amountFactor: 0.95 },
    { type: 'NEW_MEMBER', daysAgo: 1, source: 'Referral', method: 'Cash', amountFactor: 1 },
    { type: 'RENEWAL', daysAgo: 0, source: 'Offline', method: 'Card', amountFactor: 0.9 },
    { type: 'UPGRADE', daysAgo: 1, source: 'WhatsApp', method: 'Bank Transfer', amountFactor: 1.2 },
    { type: 'BALANCE_COLLECTION', daysAgo: 1, source: 'Online', method: 'UPI', amountFactor: 0.18 },
];

async function seedSalesDiversity() {
    try {
        await connectDB();
        const branches = await Branch.find({}).lean();
        let added = 0;
        let skipped = 0;

        for (const branch of branches) {
            const branchId = String(branch.id || branch._id);
            const gymId = String(branch.gymId);
            const members = await Member.find({ gymId, branchId }).sort({ createdAt: 1 }).lean();
            if (!members.length) continue;
            const gymStaff = await User.find({ gymId }).lean();
            const collectors = gymStaff.filter(person => ['admin', 'h4_admin', 'receptionist', 'trainer'].includes(person.role)
                && (!person.branchId || String(person.branchId) === branchId));

            for (let index = 0; index < scenarios.length; index += 1) {
                const scenario = scenarios[index];
                const transactionId = `TXN-${branchId.slice(0, 6)}-${scenario.type}-${String(index + 1).padStart(2, '0')}`;
                const existing = await Payment.findOne({ transactionId }).lean();
                if (existing) { skipped += 1; continue; }

                const member = members[index % members.length];
                const collector = collectors[index % Math.max(collectors.length, 1)];
                const basePrice = Math.max(Number(member.planPrice) || 0, 2500);
                const amount = Math.max(250, Math.round(basePrice * scenario.amountFactor / 50) * 50);
                await Payment.create({
                    memberId: String(member.id || member._id),
                    amount,
                    method: scenario.method,
                    date: new Date(Date.now() - scenario.daysAgo * DAY),
                    transactionId,
                    gymId,
                    branchId,
                    saleType: scenario.type,
                    source: scenario.source,
                    staffId: collector ? String(collector.id || collector._id) : null,
                    staffName: collector?.name || 'Front desk'
                });
                added += 1;
            }
        }
        console.log(`Sales activity ready: added ${added} varied records, skipped ${skipped} already-present records.`);
    } catch (error) {
        console.error('Could not add varied sales records:', error.message);
        process.exitCode = 1;
    } finally {
        const prisma = require('../../config/prisma');
        try {
            await Promise.race([prisma.$disconnect(), new Promise(resolve => setTimeout(resolve, 1500))]);
        } catch { /* A short-lived seeder should still exit if the pool does not close promptly. */ }
        process.exit(process.exitCode || 0);
    }
}

seedSalesDiversity();

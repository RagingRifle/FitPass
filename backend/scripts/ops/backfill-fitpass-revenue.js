const prisma = require('../../config/prisma');

const applyChanges = process.argv.includes('--apply');
const backfillSource = 'Historical FitPass subscription backfill';
const backfillMethod = 'Historical backfill';

const getBackfillAmount = (member, plan) => (
    Number(member.planPrice) > 0 ? Number(member.planPrice) : Number(plan.price)
);

const getBackfillTransactionId = (member) => (
    `fitpass-backfill:${member.id}:${member.planId}:${member.expiryDate.toISOString()}`
);

const main = async () => {
    const now = new Date();
    const plans = await prisma.plan.findMany({
        where: { gymId: 'SYSTEM', sessions: { gt: 0 } },
        select: { id: true, price: true }
    });
    const planById = new Map(plans.map(plan => [plan.id, plan]));
    const planIds = [...planById.keys()];

    const members = planIds.length
        ? await prisma.member.findMany({
            where: {
                gymId: 'SYSTEM',
                planId: { in: planIds },
                status: 'Active',
                expiryDate: { gt: now }
            },
            select: {
                id: true,
                planId: true,
                planPrice: true,
                joinDate: true,
                expiryDate: true
            }
        })
        : [];

    const existingPayments = members.length
        ? await prisma.payment.findMany({
            where: { memberId: { in: members.map(member => member.id) } },
            select: { id: true, memberId: true, gymId: true, amount: true, transactionId: true }
        })
        : [];
    const paymentsByMember = new Map();
    for (const payment of existingPayments) {
        const payments = paymentsByMember.get(payment.memberId) || [];
        payments.push(payment);
        paymentsByMember.set(payment.memberId, payments);
    }

    const summary = {
        activeSubscriptionsChecked: members.length,
        alreadyCountedInFitPass: 0,
        needsReviewOtherGymPayments: 0,
        invalidPlanPrice: 0,
        wouldBackfill: 0,
        estimatedRevenue: 0
    };
    const actions = [];

    for (const member of members) {
        const plan = planById.get(member.planId);
        const amount = getBackfillAmount(member, plan);
        const payments = paymentsByMember.get(member.id) || [];
        const marker = getBackfillTransactionId(member);

        if (!Number.isFinite(amount) || amount <= 0) {
            summary.invalidPlanPrice += 1;
            continue;
        }

        if (payments.some(payment => payment.transactionId === marker)) {
            summary.alreadyCountedInFitPass += 1;
            continue;
        }

        if (payments.some(payment => payment.gymId === 'SYSTEM' && Number(payment.amount) > 0)) {
            summary.alreadyCountedInFitPass += 1;
            continue;
        }

        if (payments.some(payment => payment.gymId !== 'SYSTEM' && Number(payment.amount) > 0)) {
            summary.needsReviewOtherGymPayments += 1;
            continue;
        }

        const zeroSystemPayment = payments.find(payment => payment.gymId === 'SYSTEM' && Number(payment.amount) === 0);
        summary.wouldBackfill += 1;
        summary.estimatedRevenue += amount;
        actions.push({ member, amount, marker, zeroSystemPayment });
    }

    console.log(`Mode: ${applyChanges ? 'APPLY' : 'PREVIEW (no changes)'}`);
    console.log(`Active subscriptions checked: ${summary.activeSubscriptionsChecked}`);
    console.log(`Already counted in FitPass: ${summary.alreadyCountedInFitPass}`);
    console.log(`Skipped for review (positive payment under another gym): ${summary.needsReviewOtherGymPayments}`);
    console.log(`Skipped (no valid plan price): ${summary.invalidPlanPrice}`);
    console.log(`Subscriptions to backfill: ${summary.wouldBackfill}`);
    console.log(`Estimated revenue to add: INR ${summary.estimatedRevenue.toFixed(2)}`);

    if (!applyChanges) {
        console.log('Preview only. Re-run with --apply to write the listed backfill entries.');
        return;
    }

    let applied = 0;
    for (const { member, amount, marker, zeroSystemPayment } of actions) {
        await prisma.$transaction(async (tx) => {
            const existingMarker = await tx.payment.findFirst({ where: { transactionId: marker } });
            if (existingMarker) return;

            const paymentData = {
                amount,
                method: backfillMethod,
                date: member.joinDate,
                gymId: 'SYSTEM',
                branchId: null,
                transactionId: marker,
                saleType: 'LEGACY',
                source: backfillSource
            };

            if (zeroSystemPayment) {
                await tx.payment.update({ where: { id: zeroSystemPayment.id }, data: paymentData });
            } else {
                await tx.payment.create({
                    data: {
                        ...paymentData,
                        memberId: member.id
                    }
                });
            }

            await tx.member.update({
                where: { id: member.id },
                data: {
                    paidAmount: amount,
                    ...(Number(member.planPrice) > 0 ? {} : { planPrice: amount })
                }
            });
        });
        applied += 1;
    }

    console.log(`Backfilled subscriptions: ${applied}`);
};

main()
    .catch((error) => {
        console.error('FitPass revenue backfill failed:', error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());

const catchAsync = require('../utils/catchAsync');
const prisma = require('../config/prisma');
const { H4_GYM_IDS } = require('../config/constants');

const DEFAULT_RATE = 50;

const assertPayoutAccess = req => {
    if (req.user.role === 'superadmin') return;
    if (req.user.role === 'fitpass_admin' && req.user.fitPassPayoutAccess === true) return;
    const error = new Error('FitPass branch payout access has not been enabled for this account.');
    error.statusCode = 403;
    throw error;
};

const parseDate = (value, endOfDay = false) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const [, year, month, day] = match.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date;
};

const roundMoney = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const derivePayout = ({ grossRevenue, paidAmount, operatingCosts }) => {
    const gross = roundMoney(grossRevenue);
    const paid = roundMoney(paidAmount);
    const costs = roundMoney(operatingCosts);
    return {
        grossRevenue: gross,
        paidAmount: paid,
        operatingCosts: costs,
        retainedAmount: roundMoney(gross - paid),
        netProfit: roundMoney(gross - paid - costs),
        status: paid <= 0 ? 'Unpaid' : paid < gross ? 'Partial' : 'Paid',
        paidAt: paid > 0 ? new Date() : null,
    };
};

const getEligibleBranches = async () => {
    const [gyms, branches] = await Promise.all([
        prisma.gym.findMany({ where: { id: { notIn: H4_GYM_IDS } }, select: { id: true, name: true, status: true } }),
        prisma.branch.findMany({ where: { isActive: true, fitPassEnabled: true, gymId: { notIn: H4_GYM_IDS } }, select: { id: true, name: true, gymId: true, fitPassEnabled: true } })
    ]);
    const gymMap = new Map(gyms.filter(gym => String(gym.name).toLowerCase() !== 'h4' && gym.status === 'Active').map(gym => [gym.id, gym]));
    return branches.filter(branch => gymMap.has(branch.gymId)).map(branch => ({
        id: branch.id,
        name: branch.name,
        gymId: branch.gymId,
        gymName: gymMap.get(branch.gymId).name,
    })).sort((a, b) => `${a.gymName} ${a.name}`.localeCompare(`${b.gymName} ${b.name}`));
};

const getSettings = async () => {
    const settings = await prisma.fitPassPayoutSettings.findUnique({ where: { id: 'global' } });
    return settings || { id: 'global', defaultRatePerCheckIn: DEFAULT_RATE };
};

const getFitPassPayoutDashboard = catchAsync(async (req, res) => {
    assertPayoutAccess(req);
    const { from, to, gymId, branchId, status, search } = req.query;
    const fromDate = from ? parseDate(from) : null;
    const toDate = to ? parseDate(to, true) : null;
    if ((from && !fromDate) || (to && !toDate) || (fromDate && toDate && fromDate > toDate)) {
        return res.status(400).json({ success: false, message: 'Choose a valid date range.' });
    }
    const where = {};
    if (fromDate) where.periodEnd = { gte: fromDate };
    if (toDate) where.periodStart = { lte: toDate };
    if (gymId) where.gymId = gymId;
    if (branchId) where.branchId = branchId;
    if (status && ['Unpaid', 'Partial', 'Paid'].includes(status)) where.status = status;
    if (search?.trim()) where.OR = [
        { gymName: { contains: search.trim(), mode: 'insensitive' } },
        { branchName: { contains: search.trim(), mode: 'insensitive' } },
    ];

    const [records, branches, settings] = await Promise.all([
        prisma.fitPassBranchPayout.findMany({ where, orderBy: [{ periodStart: 'desc' }, { gymName: 'asc' }, { branchName: 'asc' }], take: 1000 }),
        getEligibleBranches(),
        getSettings()
    ]);
    const summary = records.reduce((acc, row) => {
        acc.checkIns += row.checkInCount;
        acc.grossRevenue += row.grossRevenue;
        acc.paidAmount += row.paidAmount;
        acc.retainedAmount += row.retainedAmount;
        acc.netProfit += row.netProfit;
        return acc;
    }, { checkIns: 0, grossRevenue: 0, paidAmount: 0, retainedAmount: 0, netProfit: 0, records: records.length });
    Object.keys(summary).forEach(key => { if (key !== 'records' && key !== 'checkIns') summary[key] = roundMoney(summary[key]); });
    res.json({ records, branches, settings, summary });
});

const updateFitPassPayoutSettings = catchAsync(async (req, res) => {
    assertPayoutAccess(req);
    const rate = Number(req.body.defaultRatePerCheckIn);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1_000_000) return res.status(400).json({ success: false, message: 'Enter a valid non-negative rate per check-in.' });
    const settings = await prisma.fitPassPayoutSettings.upsert({
        where: { id: 'global' },
        create: { id: 'global', defaultRatePerCheckIn: roundMoney(rate), updatedBy: req.user.id },
        update: { defaultRatePerCheckIn: roundMoney(rate), updatedBy: req.user.id }
    });
    res.json({ success: true, data: settings });
});

const getFitPassPayoutPreview = catchAsync(async (req, res) => {
    assertPayoutAccess(req);
    const branchId = String(req.query.branchId || '');
    const startDate = parseDate(req.query.startDate);
    const endDate = parseDate(req.query.endDate, true);
    if (!branchId || !startDate || !endDate || startDate > endDate) return res.status(400).json({ success: false, message: 'Select a branch and valid period to preview.' });
    const branch = (await getEligibleBranches()).find(item => item.id === branchId);
    if (!branch) return res.status(404).json({ success: false, message: 'Choose an active FitPass-enabled partner branch.' });
    const [checkInCount, settings] = await Promise.all([
        prisma.fitPassAuditLog.count({ where: { branchIdVisited: branchId, accessStatus: 'Success', checkInTimestamp: { gte: startDate, lte: endDate } } }),
        getSettings()
    ]);
    res.json({ checkInCount, defaultRatePerCheckIn: settings.defaultRatePerCheckIn, estimatedRevenue: roundMoney(checkInCount * settings.defaultRatePerCheckIn) });
});

const createFitPassBranchPayout = catchAsync(async (req, res) => {
    assertPayoutAccess(req);
    const { branchId, startDate, endDate, ratePerCheckIn, manualRevenue = null, paidAmount = 0, operatingCosts = 0, paymentReference = '', notes = '' } = req.body;
    const periodStart = parseDate(startDate);
    const periodEnd = parseDate(endDate, true);
    if (!branchId || !periodStart || !periodEnd || periodStart > periodEnd) return res.status(400).json({ success: false, message: 'Select a branch and valid settlement period.' });
    const eligibleBranches = await getEligibleBranches();
    const branch = eligibleBranches.find(item => item.id === branchId);
    if (!branch) return res.status(404).json({ success: false, message: 'Choose an active FitPass-enabled partner branch.' });
    const settings = await getSettings();
    const rate = ratePerCheckIn === undefined ? settings.defaultRatePerCheckIn : Number(ratePerCheckIn);
    const customRevenue = manualRevenue === '' || manualRevenue === null || manualRevenue === undefined ? null : Number(manualRevenue);
    const paid = Number(paidAmount);
    const costs = Number(operatingCosts);
    if (![rate, paid, costs].every(Number.isFinite) || rate < 0 || paid < 0 || costs < 0 || (customRevenue !== null && (!Number.isFinite(customRevenue) || customRevenue < 0))) {
        return res.status(400).json({ success: false, message: 'Rates, revenue, payout and costs must be valid non-negative amounts.' });
    }
    const checkInCount = await prisma.fitPassAuditLog.count({
        where: { branchIdVisited: branchId, accessStatus: 'Success', checkInTimestamp: { gte: periodStart, lte: periodEnd } }
    });
    const grossRevenue = customRevenue === null ? checkInCount * rate : customRevenue;
    const totals = derivePayout({ grossRevenue, paidAmount: paid, operatingCosts: costs });
    try {
        const payout = await prisma.fitPassBranchPayout.create({
            data: {
                gymId: branch.gymId, gymName: branch.gymName, branchId: branch.id, branchName: branch.name,
                periodStart, periodEnd, checkInCount, ratePerCheckIn: roundMoney(rate), manualRevenue: customRevenue,
                ...totals, paymentReference: String(paymentReference).trim() || null, notes: String(notes).trim() || null,
                createdBy: req.user.id
            }
        });
        res.status(201).json({ success: true, data: payout });
    } catch (error) {
        if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'A payout record already exists for this branch and period. Edit that record instead.' });
        throw error;
    }
});

const updateFitPassBranchPayout = catchAsync(async (req, res) => {
    assertPayoutAccess(req);
    const current = await prisma.fitPassBranchPayout.findUnique({ where: { id: req.params.id } });
    if (!current || current.isDemo) return res.status(404).json({ success: false, message: 'Payout record not found.' });
    const rate = req.body.ratePerCheckIn === undefined ? current.ratePerCheckIn : Number(req.body.ratePerCheckIn);
    const customRevenue = req.body.manualRevenue === undefined ? current.manualRevenue : (req.body.manualRevenue === '' || req.body.manualRevenue === null ? null : Number(req.body.manualRevenue));
    const paid = req.body.paidAmount === undefined ? current.paidAmount : Number(req.body.paidAmount);
    const costs = req.body.operatingCosts === undefined ? current.operatingCosts : Number(req.body.operatingCosts);
    if (![rate, paid, costs].every(Number.isFinite) || rate < 0 || paid < 0 || costs < 0 || (customRevenue !== null && (!Number.isFinite(customRevenue) || customRevenue < 0))) {
        return res.status(400).json({ success: false, message: 'Rates, revenue, payout and costs must be valid non-negative amounts.' });
    }
    const grossRevenue = customRevenue === null ? current.checkInCount * rate : customRevenue;
    const totals = derivePayout({ grossRevenue, paidAmount: paid, operatingCosts: costs });
    const updated = await prisma.fitPassBranchPayout.update({
        where: { id: current.id },
        data: {
            ratePerCheckIn: roundMoney(rate), manualRevenue: customRevenue, ...totals,
            paymentReference: req.body.paymentReference === undefined ? current.paymentReference : String(req.body.paymentReference).trim() || null,
            notes: req.body.notes === undefined ? current.notes : String(req.body.notes).trim() || null,
        }
    });
    res.json({ success: true, data: updated });
});

module.exports = {
    getFitPassPayoutDashboard,
    updateFitPassPayoutSettings,
    getFitPassPayoutPreview,
    createFitPassBranchPayout,
    updateFitPassBranchPayout,
};

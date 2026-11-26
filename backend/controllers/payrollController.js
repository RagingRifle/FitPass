const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const prisma = require('../config/prisma');
const TrainerSalary = require('../models/TrainerSalary');
const PtCommission = require('../models/PtCommission');
const Payroll = require('../models/Payroll');
const User = require('../models/User');
const PtSession = require('../models/PtSession');
const Payment = require('../models/Payment');

const PAYROLL_EMPLOYEE_ROLES = ['trainer', 'staff', 'receptionist'];
const DEFAULT_SALES_POINT_RULES = Object.freeze({ NEW_MEMBER: 5, RENEWAL: 3, UPGRADE: 10, BALANCE_COLLECTION: 0, LEGACY: 0 });

// @desc    Upsert Trainer Salary Configuration
// @route   POST /api/payroll/salary-structure
// @access  Private (Admin)
const upsertSalaryStructure = catchAsync(async (req, res, next) => {
    try {
        const {
            trainerId, fixedSalary, commissionPt, salesAmountPerPoint = 1000,
            incentivePerPoint = 0, salesPointRules = DEFAULT_SALES_POINT_RULES,
            incentiveEnabled = true, incentiveMultiplier
        } = req.body;

        if (!trainerId) {
            return res.status(400).json({ success: false, message: 'Trainer ID is required' });
        }
        const multiplier = incentiveMultiplier === undefined ? Number(incentivePerPoint) : Number(incentiveMultiplier);
        const numericRates = [fixedSalary, commissionPt, salesAmountPerPoint, incentivePerPoint, multiplier].map(Number);
        if (numericRates.some(rate => !Number.isFinite(rate) || rate < 0) || Number(salesAmountPerPoint) <= 0) {
            return res.status(400).json({ success: false, message: 'Enter valid non-negative salary rates and a sales amount per point greater than zero.' });
        }
        if (!salesPointRules || typeof salesPointRules !== 'object' || Array.isArray(salesPointRules)
            || Object.values(salesPointRules).some(points => !Number.isInteger(Number(points)) || Number(points) < 0)) {
            return res.status(400).json({ success: false, message: 'Enter non-negative points for each sale type.' });
        }

        // Validate trainer exists
        const trainerQuery = { _id: trainerId, gymId: req.user.gymId, role: { $in: PAYROLL_EMPLOYEE_ROLES }, ...(req.user.branchId && { branchId: req.user.branchId }) };
        if (req.user.branchId) {
            trainerQuery.branchId = req.user.branchId;
        }
        const trainer = await User.findOne(trainerQuery);
        if (!trainer || !PAYROLL_EMPLOYEE_ROLES.includes(trainer.role)) {
            return res.status(404).json({ success: false, message: 'Staff member not found' });
        }

        const salaryQuery = { trainerId, gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }) };
        if (req.user.branchId) {
            salaryQuery.branchId = req.user.branchId;
        }
        let salary = await TrainerSalary.findOne(salaryQuery);

        if (salary) {
            salary.fixedSalary = Number(fixedSalary);
            salary.commissionPt = Number(commissionPt);
            salary.salesAmountPerPoint = Number(salesAmountPerPoint);
            salary.incentivePerPoint = multiplier;
            salary.salesPointRules = salesPointRules;
            salary.incentiveEnabled = Boolean(incentiveEnabled);
            salary.incentiveMultiplier = multiplier;
            const updated = await salary.save();
            return res.json(updated);
        } else {
            const created = await TrainerSalary.create({
                trainerId,
                fixedSalary: Number(fixedSalary),
                commissionPt: Number(commissionPt),
                salesAmountPerPoint: Number(salesAmountPerPoint),
                incentivePerPoint: multiplier,
                salesPointRules,
                incentiveEnabled: Boolean(incentiveEnabled),
                incentiveMultiplier: multiplier,
                gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }),
                branchId: req.user.branchId || null
            });
            return res.status(201).json(created);
        }
    } catch (error) { next(error); }
});

// @desc    Get Salary Configuration for a Trainer
// @route   GET /api/payroll/salary-structure/:trainerId
// @access  Private (Admin/Trainer)
const getSalaryStructure = catchAsync(async (req, res, next) => {
    try {
        const { trainerId } = req.params;

        if (req.user.role === 'trainer' && req.user.id !== trainerId) {
            return res.status(403).json({ success: false, message: 'Not authorized to view this structure' });
        }

        const query = { trainerId, gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }) };
        if (req.user.branchId) {
            query.branchId = req.user.branchId;
        }
        const salary = await TrainerSalary.findOne(query);

        if (!salary) {
            return res.json({
                trainerId,
                fixedSalary: 0,
                commissionPt: 0,
                salesAmountPerPoint: 1000,
                incentivePerPoint: 0,
                salesPointRules: DEFAULT_SALES_POINT_RULES,
                incentiveEnabled: true,
                incentiveMultiplier: 0,
                gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId })
            });
        }

        res.json(salary);
    } catch (error) { next(error); }
});

// Trainer-only performance summary. The identity and tenant scope always come
// from the authenticated account, never from a client supplied staffId.
const getTrainerPerformance = catchAsync(async (req, res, next) => {
    try {
        if (req.user.role !== 'trainer') return res.status(403).json({ success: false, message: 'Trainer access is required.' });
        const now = new Date();
        const period = ['month', 'year', 'all', 'custom'].includes(req.query.period) ? req.query.period : 'month';
        const dateFrom = (value) => {
            const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
            return new Date(year, month - 1, day, 0, 0, 0, 0);
        };
        let from;
        let to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        if (period === 'year') from = new Date(now.getFullYear(), 0, 1);
        else if (period === 'all') from = new Date(2000, 0, 1);
        else if (period === 'custom' && req.query.from) from = dateFrom(req.query.from);
        else from = new Date(now.getFullYear(), now.getMonth(), 1);
        if (period === 'custom' && req.query.to) to = new Date(dateFrom(req.query.to).getTime() + 86_399_999);
        if (period === 'custom' && req.query.from && req.query.to && from > to) {
            return res.status(400).json({ success: false, message: 'The start date must be before the end date.' });
        }

        const [salary, sales] = await Promise.all([
            TrainerSalary.findOne({ trainerId: req.user.id, gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }) }).lean(),
            Payment.find({ gymId: req.user.gymId, staffId: req.user.id, date: { $gte: from, $lte: to }, ...(req.user.branchId && { branchId: req.user.branchId }) }).sort({ date: 1 }).limit(10000).lean()
        ]);
        const rules = salary?.salesPointRules && typeof salary.salesPointRules === 'object' ? salary.salesPointRules : DEFAULT_SALES_POINT_RULES;
        const breakdown = {};
        const timeline = {};
        let totalAmount = 0;
        let totalPoints = 0;
        const memberIds = new Set();
        const useMonthlyTimeline = to.getTime() - from.getTime() > 62 * 86_400_000;
        for (const payment of sales) {
            const saleType = Object.prototype.hasOwnProperty.call(rules, payment.saleType) ? payment.saleType : 'LEGACY';
            const points = Math.max(0, Number(rules[saleType] || 0));
            const amount = Number(payment.amount || 0);
            const date = new Date(payment.date);
            const key = useMonthlyTimeline
                ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const typeRow = breakdown[saleType] || (breakdown[saleType] = { saleType, transactions: 0, amount: 0, points: 0 });
            typeRow.transactions += 1; typeRow.amount += amount; typeRow.points += points;
            const timeRow = timeline[key] || (timeline[key] = { key, transactions: 0, amount: 0, points: 0 });
            timeRow.transactions += 1; timeRow.amount += amount; timeRow.points += points;
            totalAmount += amount; totalPoints += points;
            if (payment.memberId) memberIds.add(String(payment.memberId));
        }
        const multiplier = Math.max(0, Number(salary?.incentiveMultiplier) || Number(salary?.incentivePerPoint) || 0);
        const incentiveEnabled = salary?.incentiveEnabled !== false;
        res.json({
            success: true,
            period,
            from,
            to,
            summary: {
                transactions: sales.length,
                salesAmount: Math.round(totalAmount * 100) / 100,
                points: totalPoints,
                membersConverted: memberIds.size,
                incentiveEnabled,
                incentiveMultiplier: multiplier,
                projectedIncentive: incentiveEnabled ? Math.round(totalPoints * multiplier * 100) / 100 : 0,
                fixedSalary: Number(salary?.fixedSalary || 0)
            },
            rules,
            breakdown: Object.values(breakdown),
            timeline: Object.values(timeline).sort((a, b) => a.key.localeCompare(b.key))
        });
    } catch (error) { next(error); }
});

// @desc    Generate/Recalculate Monthly Payroll
// @route   POST /api/payroll/generate
// @access  Private (Admin)
const generateMonthlyPayroll = catchAsync(async (req, res, next) => {
    try {
        const { trainerId, month, year, incentives } = req.body;

        if (!trainerId || !month || !year) {
            return res.status(400).json({ success: false, message: 'Trainer ID, Month (1-12), and Year are required' });
        }

        const employeeQuery = { _id: trainerId, gymId: req.user.gymId, role: { $in: PAYROLL_EMPLOYEE_ROLES }, ...(req.user.branchId && { branchId: req.user.branchId }) };
        if (req.user.branchId) employeeQuery.branchId = req.user.branchId;
        const employee = await User.findOne(employeeQuery).lean();
        if (!employee) return res.status(404).json({ success: false, message: 'Staff member not found in this branch' });

        // Get trainer salary config
        const configQuery = { trainerId, gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }) };
        if (req.user.branchId) {
            configQuery.branchId = req.user.branchId;
        }
        const salaryConfig = await TrainerSalary.findOne(configQuery);
        const fixedSalary = salaryConfig ? salaryConfig.fixedSalary : 0;
        const commissionRate = salaryConfig ? salaryConfig.commissionPt : 0;
        const salesAmountPerPoint = Math.max(Number(salaryConfig?.salesAmountPerPoint) || 1000, 1);
        const incentiveMultiplier = Math.max(Number(salaryConfig?.incentiveMultiplier) || Number(salaryConfig?.incentivePerPoint) || 0, 0);

        // Calculate commissions: Sum amount from PtCommission logged in this month & year
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);

        const salesQuery = {
            gymId: req.user.gymId,
            staffId: trainerId,
            date: { $gte: startDate, $lte: endDate },
            ...(req.user.branchId && { branchId: req.user.branchId })
        };
        if (req.user.branchId) salesQuery.branchId = req.user.branchId;
        const salesPayments = await Payment.find(salesQuery).lean();
        const configuredRules = salaryConfig?.salesPointRules && typeof salaryConfig.salesPointRules === 'object'
            ? salaryConfig.salesPointRules
            : null;
        const salesTotal = salesPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        const salesPoints = configuredRules
            ? salesPayments.reduce((sum, payment) => sum + Math.max(0, Number(configuredRules[payment.saleType] ?? 0)), 0)
            : Math.floor(salesTotal / salesAmountPerPoint);
        const salesIncentive = salaryConfig?.incentiveEnabled === false
            ? 0
            : Math.round(salesPoints * incentiveMultiplier * 100) / 100;

        // Fetch commissions matching dates
        const commQuery = {
            trainerId,
            gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }),
            date: {
                $gte: startDate,
                $lte: endDate
            }
        };
        if (req.user.branchId) {
            commQuery.branchId = req.user.branchId;
        }
        const commissionsList = await PtCommission.find(commQuery);
        const calculatedCommissions = commissionsList.reduce((sum, item) => sum + item.amount, 0);

        // Also calculate auto-commissions from completed PtSessions in this period if no manual commissions exist
        let finalCommissions = calculatedCommissions;
        if (commissionsList.length === 0 && commissionRate > 0) {
            const sessQuery = {
                trainerId,
                gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }),
                status: 'Completed',
                sessionDate: {
                    $gte: startDate,
                    $lte: endDate
                }
            };
            if (req.user.branchId) {
                sessQuery.branchId = req.user.branchId;
            }
            const completedSessions = await PtSession.find(sessQuery);
            finalCommissions = completedSessions.length * commissionRate;

            // Log these auto-calculated commissions so they persist. Single
            // batched INSERT instead of one round-trip per session.
            if (completedSessions.length > 0) {
                await prisma.ptCommission.createMany({
                    data: completedSessions.map(s => ({
                        trainerId,
                        sessionId: s._id,
                        amount: commissionRate,
                        date: s.sessionDate,
                        gymId: req.user.gymId,
                        branchId: req.user.branchId || null
                    }))
                });
            }
        }

        const finalIncentives = incentives !== undefined ? Number(incentives) : 0;
        const totalAmount = fixedSalary + finalCommissions + finalIncentives + salesIncentive;

        // Check if payroll record already exists for this month
        const payrollQuery = {
            trainerId,
            month: Number(month),
            year: Number(year),
            gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId })
        };
        if (req.user.branchId) {
            payrollQuery.branchId = req.user.branchId;
        }
        let payroll = await Payroll.findOne(payrollQuery);

        if (payroll) {
            // Update existing
            payroll.fixedSalary = fixedSalary;
            payroll.commissions = finalCommissions;
            payroll.salesPoints = salesPoints;
            payroll.salesIncentive = salesIncentive;
            payroll.incentives = finalIncentives;
            payroll.totalAmount = totalAmount;
            const updated = await payroll.save();
            return res.json(updated);
        } else {
            // Create new
            const created = await Payroll.create({
                trainerId,
                month: Number(month),
                year: Number(year),
                fixedSalary,
                commissions: finalCommissions,
                salesPoints,
                salesIncentive,
                incentives: finalIncentives,
                totalAmount,
                status: 'Pending',
                gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }),
                branchId: req.user.branchId || null
            });
            return res.status(201).json(created);
        }
    } catch (error) { next(error); }
});

// @desc    Get Payroll Records
// @route   GET /api/payroll
// @access  Private (Admin/Trainer)
const getPayrolls = catchAsync(async (req, res, next) => {
    try {
        let query = { ...req.tenantFilter };

        if (req.user.role === 'trainer') {
            query.trainerId = req.user.id;
        } else if (req.query.trainerId) {
            query.trainerId = req.query.trainerId;
        }

        if (req.query.month) query.month = Number(req.query.month);
        if (req.query.year) query.year = Number(req.query.year);

        // Strict pagination parameters with hard cap at 100
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
        const skip = (page - 1) * limit;

        const total = await Payroll.countDocuments(query);
        const payrolls = await Payroll.find(query)
            .sort({ year: -1, month: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Batched Trainer lookup ONLY
        const trainerIds = [...new Set(payrolls.map(p => p.trainerId).filter(Boolean))];
        const trainerQuery = { _id: { $in: trainerIds } };
        if (req.user.branchId) Object.assign(trainerQuery, { gymId: req.user.gymId, branchId: req.user.branchId });
        const trainers = trainerIds.length > 0
            ? await User.find(trainerQuery).select('id name email role phone').lean()
            : [];

        const trainerMap = new Map((trainers || []).map(t => [t._id ? t._id.toString() : t.id, t]));

        const formatted = payrolls.map(p => {
            const t = p.trainerId ? trainerMap.get(p.trainerId.toString()) : null;
            return {
                ...p,
                trainer: t ? { id: t.id || t._id, name: t.name, email: t.email, role: t.role } : null
            };
        });

        res.json({
            success: true,
            data: formatted,
            meta: { page, limit, total }
        });
    } catch (error) { next(error); }
});

// @desc    Update Payroll Status / Process Payment
// @route   PUT /api/payroll/:id
// @access  Private (Admin)
const updatePayrollStatus = catchAsync(async (req, res, next) => {
    try {
        const { status, incentives } = req.body;
        const query = { _id: req.params.id, gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }) };
        if (req.user.branchId) {
            query.branchId = req.user.branchId;
        }
        const payroll = await Payroll.findOne(query);

        if (!payroll) {
            return res.status(404).json({ success: false, message: 'Payroll record not found' });
        }

        if (incentives !== undefined) {
            payroll.incentives = Number(incentives);
            payroll.totalAmount = payroll.fixedSalary + payroll.commissions + (payroll.salesIncentive || 0) + payroll.incentives;
        }

        if (status) {
            payroll.status = status;
            if (status === 'Paid') {
                payroll.paymentDate = new Date();
            } else {
                payroll.paymentDate = null;
            }
        }

        const updated = await payroll.save();
        res.json(updated);
    } catch (error) { next(error); }
});

// @desc    Record manual commission entry
// @route   POST /api/payroll/commission
// @access  Private (Admin)
const addCommission = catchAsync(async (req, res, next) => {
    try {
        const { trainerId, amount, date, sessionId } = req.body;

        if (!trainerId || amount === undefined) {
            return res.status(400).json({ success: false, message: 'Trainer ID and Amount are required' });
        }

        // Validate trainer
        const trQuery = { _id: trainerId, gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }) };
        if (req.user.branchId) {
            trQuery.branchId = req.user.branchId;
        }
        const trainer = await User.findOne(trQuery);
        if (!trainer || !PAYROLL_EMPLOYEE_ROLES.includes(trainer.role)) {
            return res.status(404).json({ success: false, message: 'Staff member not found' });
        }

        const commission = await PtCommission.create({
            trainerId,
            sessionId: sessionId || null,
            amount: Number(amount),
            date: date ? new Date(date) : new Date(),
            gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }),
            branchId: req.user.branchId || null
        });

        res.status(201).json(commission);
    } catch (error) { next(error); }
});

module.exports = {
    upsertSalaryStructure,
    getSalaryStructure,
    getTrainerPerformance,
    generateMonthlyPayroll,
    getPayrolls,
    updatePayrollStatus,
    addCommission
};

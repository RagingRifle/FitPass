const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Member = require('../models/Member');
const Plan = require('../models/Plan');
const Attendance = require('../models/Attendance');
const prisma = require('../config/prisma');
const { jsonToCsv } = require('../utils/csvUtils');
const { resolveBranchScope, resolveReportFilters } = require('../utils/reportFilters');

// @desc    Download monthly revenue report
// @route   GET /api/reports/revenue
// @access  Private/Admin
const getRevenueReport = catchAsync(async (req, res, next) => {
    const { month, year } = req.query;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const branchId = await resolveBranchScope(req);
    const query = {
        gymId: req.user.gymId, ...(branchId && { branchId }),
        date: { $gte: start, $lte: end }
    };
    const payments = await Payment.find(query).populate('memberId', 'name');

    const data = payments.map(p => ({
        Date: p.date.toISOString().split('T')[0],
        Member: p.memberId?.name || 'Unknown',
        Amount: p.amount,
        Method: p.method
    }));

    const csv = jsonToCsv(data, ['Date', 'Member', 'Amount', 'Method']);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=revenue_report_${month}_${year}.csv`);
    res.status(200).send(csv);
});

// @desc    Download monthly expense report
// @route   GET /api/reports/expenses
// @access  Private/Admin
const getExpenseReport = catchAsync(async (req, res, next) => {
    const { month, year } = req.query;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const branchId = await resolveBranchScope(req);
    const query = {
        gymId: req.user.gymId, ...(branchId && { branchId }),
        date: { $gte: start, $lte: end }
    };
    const expenses = await Expense.find(query);

    const data = expenses.map(e => ({
        Date: e.date.toISOString().split('T')[0],
        Title: e.title,
        Category: e.category,
        Amount: e.amount
    }));

    const csv = jsonToCsv(data, ['Date', 'Title', 'Category', 'Amount']);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=expense_report_${month}_${year}.csv`);
    res.status(200).send(csv);
});

// @desc    Get report summary dashboard data
// @route   GET /api/reports/summary?year=YYYY
// @access  Private/Admin
const getReportSummary = catchAsync(async (req, res, next) => {
    try {
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const gymId = req.user.gymId;
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
        const { branchId, startDate, endDate } = await resolveReportFilters(req, { start: yearStart, end: yearEnd });

        const baseQuery = {
            gymId,
            ...(branchId && { branchId }),
        };

        const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        // ─── Year boundaries ──────────────────────────────────────────────
        const rangeStart = startDate;
        const rangeEnd = endDate;

        // ─── Current month boundaries ─────────────────────────────────────
        const now = new Date();

        // ─── Last 90 days ─────────────────────────────────────────────────
        const monthBuckets = [];
        for (let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1); cursor <= rangeEnd; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
            const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
            monthBuckets.push({ key, month: `${MONTH_NAMES[cursor.getMonth()]}${rangeStart.getFullYear() !== rangeEnd.getFullYear() ? ` ${String(cursor.getFullYear()).slice(-2)}` : ''}` });
        }

        // ══════════════════════════════════════════════════════════════════
        // 1. Revenue by month  (Payment)
        // ══════════════════════════════════════════════════════════════════
        const payments = await Payment.find({
            ...baseQuery,
            date: { $gte: rangeStart, $lte: rangeEnd },
        });

        const revenueMap = Object.fromEntries(monthBuckets.map(({ key }) => [key, 0]));
        payments.forEach((p) => {
            const date = new Date(p.date);
            const key = `${date.getFullYear()}-${date.getMonth()}`;
            revenueMap[key] = (revenueMap[key] || 0) + (p.amount || 0);
        });

        // ══════════════════════════════════════════════════════════════════
        // 2. Expenses by month  (Expense)
        // ══════════════════════════════════════════════════════════════════
        const expenses = await Expense.find({
            ...baseQuery,
            date: { $gte: rangeStart, $lte: rangeEnd },
        });

        const expenseMap = Object.fromEntries(monthBuckets.map(({ key }) => [key, 0]));
        expenses.forEach((e) => {
            const date = new Date(e.date);
            const key = `${date.getFullYear()}-${date.getMonth()}`;
            expenseMap[key] = (expenseMap[key] || 0) + (e.amount || 0);
        });

        const revenueByMonth = monthBuckets.map(({ key, month }) => ({
            month,
            revenue:  parseFloat(revenueMap[key].toFixed(2)),
            expenses: parseFloat(expenseMap[key].toFixed(2)),
            profit:   parseFloat((revenueMap[key] - expenseMap[key]).toFixed(2)),
        }));

        // ══════════════════════════════════════════════════════════════════
        // 3. New members by month  (Member)
        // ══════════════════════════════════════════════════════════════════
        const newMembersAll = await Member.find({
            ...baseQuery,
            joinDate: { $gte: rangeStart, $lte: rangeEnd },
        });

        const newMemberMap = Object.fromEntries(monthBuckets.map(({ key }) => [key, 0]));
        newMembersAll.forEach((m) => {
            const date = new Date(m.joinDate);
            const key = `${date.getFullYear()}-${date.getMonth()}`;
            newMemberMap[key] = (newMemberMap[key] || 0) + 1;
        });

        const newMembersByMonth = monthBuckets.map(({ key, month }) => ({
            month,
            count: newMemberMap[key],
        }));

        // ══════════════════════════════════════════════════════════════════
        // 4. Attendance by day of week  (last 90 days)
        // ══════════════════════════════════════════════════════════════════
        const attendanceRecords = await Attendance.find({
            ...baseQuery,
            date: { $gte: rangeStart, $lte: rangeEnd },
        });

        const dayMap = {};
        DAY_NAMES.forEach((d) => { dayMap[d] = 0; });
        attendanceRecords.forEach((a) => {
            const dayName = DAY_NAMES[new Date(a.date).getDay()];
            dayMap[dayName] = (dayMap[dayName] || 0) + 1;
        });

        // Ordered Mon→Sun
        const orderedDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const attendanceByDay = orderedDays.map((day) => ({
            day,
            count: dayMap[day] || 0,
        }));

        // ══════════════════════════════════════════════════════════════════
        // 5. Plan popularity  (Member grouped by planId → Prisma plan name)
        // ══════════════════════════════════════════════════════════════════
        const allMembers = await Member.find(baseQuery);
        const membersInRange = await Member.find({ ...baseQuery, joinDate: { $gte: rangeStart, $lte: rangeEnd } });

        const planCountMap = {}; // { planId: { count, revenue, fallbackName } }
        membersInRange.forEach((m) => {
            if (!m.planId) return;
            if (!planCountMap[m.planId]) {
                planCountMap[m.planId] = { count: 0, revenue: 0, fallbackName: m.planName || '' };
            }
            planCountMap[m.planId].count   += 1;
            planCountMap[m.planId].revenue += m.planPrice || 0;
            if (!planCountMap[m.planId].fallbackName && m.planName) {
                planCountMap[m.planId].fallbackName = m.planName;
            }
        });

        // Sort descending by member count, take top 6
        const topPlanIds = Object.entries(planCountMap)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 6)
            .map(([id]) => id);

        // Batch-fetch plan names from Prisma (PostgreSQL)
        const prismaPlans = await prisma.plan.findMany({
            where: { id: { in: topPlanIds } },
            select: { id: true, name: true },
        });

        const planNameById = {};
        prismaPlans.forEach((p) => { planNameById[p.id] = p.name; });

        // Check MongoDB Plan for any missing ones
        const missingIds = topPlanIds.filter((id) => !planNameById[id]);
        if (missingIds.length > 0) {
            try {
                const mongoPlans = await Plan.find({ _id: { $in: missingIds } });
                mongoPlans.forEach((p) => {
                    const pid = p.id || String(p._id);
                    if (p.name) planNameById[pid] = p.name;
                });
            } catch (err) {
                // ignore
            }
        }

        const planPopularity = topPlanIds.map((id) => {
            const rawName = planNameById[id] || planCountMap[id]?.fallbackName;
            const isIdLike = !rawName && (!id || id.length >= 20 || /^[0-9a-fA-F-]{16,}$/.test(id));
            const name = rawName || (isIdLike ? 'Custom Membership' : (id || 'Standard Plan'));
            return {
                name,
                members: planCountMap[id].count,
                revenue: parseFloat(planCountMap[id].revenue.toFixed(2)),
            };
        });

        // ══════════════════════════════════════════════════════════════════
        // 6. Expense by category  (year-scoped)
        // ══════════════════════════════════════════════════════════════════
        const categoryMap = {};
        expenses.forEach((e) => {
            const cat = e.category || 'Uncategorized';
            categoryMap[cat] = (categoryMap[cat] || 0) + (e.amount || 0);
        });

        const expenseByCategory = Object.entries(categoryMap)
            .map(([category, amount]) => ({
                category,
                amount: parseFloat(amount.toFixed(2)),
            }))
            .sort((a, b) => b.amount - a.amount);

        // ══════════════════════════════════════════════════════════════════
        // 7. Member status summary
        // ══════════════════════════════════════════════════════════════════
        const statusMap = {};
        allMembers.forEach((m) => {
            const s = (m.status || 'Unknown').toLowerCase();
            statusMap[s] = (statusMap[s] || 0) + 1;
        });

        const memberStatusSummary = {
            active:  statusMap['active']  || 0,
            expired: statusMap['expired'] || 0,
            total:   allMembers.length,
        };

        // ══════════════════════════════════════════════════════════════════
        // 8. Top metrics
        // ══════════════════════════════════════════════════════════════════
        const totalRevenue  = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

        const attendanceThisMonth = attendanceRecords.length;
        const newMembersThisMonth = newMembersAll.length;

        const avgRevenuePerMember = memberStatusSummary.active > 0
            ? parseFloat((totalRevenue / memberStatusSummary.active).toFixed(2))
            : 0;

        const topMetrics = {
            totalRevenue:            parseFloat(totalRevenue.toFixed(2)),
            totalExpenses:           parseFloat(totalExpenses.toFixed(2)),
            netProfit:               parseFloat((totalRevenue - totalExpenses).toFixed(2)),
            avgRevenuePerMember,
            totalAttendanceThisMonth: attendanceThisMonth,
            newMembersThisMonth,
        };

        // ══════════════════════════════════════════════════════════════════
        // Response
        // ══════════════════════════════════════════════════════════════════
        res.status(200).json({
            revenueByMonth,
            newMembersByMonth,
            attendanceByDay,
            planPopularity,
            expenseByCategory,
            memberStatusSummary,
            topMetrics,
            filters: { startDate: rangeStart, endDate: rangeEnd, branchId: branchId || '' },
        });
    } catch (err) { next(err); }
});

module.exports = {
    getRevenueReport,
    getExpenseReport,
    getReportSummary,
};

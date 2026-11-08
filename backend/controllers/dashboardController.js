const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const logger = require('../lib/logger');
const Member = require('../models/Member');
const Attendance = require('../models/Attendance');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const prisma = require('../config/prisma');
const { dedupeMembers } = require('../utils/memberIdentity');

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private/Admin
const getDashboardStats = catchAsync(async (req, res, next) => {
    const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        const prisma = require('../config/prisma');

        if (req.user.role === 'partner') {
            // Partner Stats: attendance and session history
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const [
                todayAttendanceCount,
                todaySessionsCount,
                traditionalCheckins,
                sessionCheckins,
                membersForStats,
                activeLiveSessionsRaw
            ] = await Promise.all([
                Attendance.countDocuments({
                    gymId: req.user.gymId,
                    date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
                }),
                prisma.sessionCheckIn.count({
                    where: {
                        gymId: req.user.gymId,
                        startedAt: { gte: today, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
                    }
                }),
                prisma.attendance.findMany({
                    where: { gymId: req.user.gymId, date: { gte: startOfMonth } },
                    orderBy: { date: 'desc' },
                    take: 30
                }),
                prisma.sessionCheckIn.findMany({
                    where: { gymId: req.user.gymId, startedAt: { gte: startOfMonth } },
                    orderBy: { startedAt: 'desc' },
                    take: 30
                }),
                Member.find({ gymId: req.user.gymId }).select('name email phone status expiryDate createdAt updatedAt').lean(),
                prisma.member.findMany({
                    where: {
                        currentSessionGymId: req.user.gymId,
                        currentSessionEndsAt: { gt: new Date() }
                    },
                    select: { id: true, name: true, phone: true, currentSessionEndsAt: true },
                    orderBy: { currentSessionEndsAt: 'asc' }
                })
            ]);

            const uniqueMembers = dedupeMembers(membersForStats);
            const totalMembers = uniqueMembers.length;
            const activeMembers = uniqueMembers.filter(member => member.status === 'Active' && (!member.expiryDate || new Date(member.expiryDate) > new Date())).length;

            // Fetch recent attendance history for this month (both traditional and FitPrime sessions)
            let recentCheckins = [];
            try {
                // Populate member names
                const memberIds = [...new Set([
                    ...traditionalCheckins.map(c => c.memberId),
                    ...sessionCheckins.map(c => c.memberId)
                ])];

                const members = await prisma.member.findMany({
                    where: { id: { in: memberIds } },
                    select: { id: true, name: true, phone: true }
                });
                const memberMap = {};
                members.forEach(m => memberMap[m.id] = m);

                const mappedTraditional = traditionalCheckins.map(a => ({
                    id: a.id,
                    memberName: memberMap[a.memberId]?.name || 'Unknown',
                    memberPhone: memberMap[a.memberId]?.phone || '',
                    date: a.date,
                    checkInTime: a.checkInTime,
                    type: 'Traditional'
                }));

                const mappedSessions = sessionCheckins.map(s => ({
                    id: s.id,
                    memberName: memberMap[s.memberId]?.name || 'Unknown',
                    memberPhone: memberMap[s.memberId]?.phone || '',
                    date: s.startedAt,
                    checkInTime: new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    type: 'FitPrime'
                }));

                recentCheckins = [...mappedTraditional, ...mappedSessions]
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .slice(0, 50);
            } catch (err) {
                logger.error({ err }, 'Prisma error building recent check-in history');
            }

                const activeLiveSessions = activeLiveSessionsRaw.map(s => ({
                    id: s.id,
                    memberName: s.name,
                    memberPhone: s.phone,
                    expiresAt: s.currentSessionEndsAt
                }));

            return res.json({
                todayAttendanceCount,
                todaySessionsCount,
                recentCheckins,
                activeLiveSessions,
                // Supply real counts for members
                totalMembers, activeMembers, 
                expiredMembers: 0, expiringSoonCount: 0,
                newMembersThisMonth: 0, monthlyRevenue: 0, monthlyExpenses: 0, monthlyProfit: 0,
                revenueTrend: [], planBreakdown: [], methodBreakdown: [], inactiveMembersCount: 0
            });
        }

        // Super Admin / Gym Stats
        const queryFilter = { ...req.tenantFilter };
        
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        sixMonthsAgo.setHours(0, 0, 0, 0);
        
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const prismaWhere = { ...req.tenantFilter };

        const [
            membersForStats,
            todayAttendanceCount,
            todaySessionsCount,
            revenueData,
            expenseData,
            revenueTrend,
            planBreakdown,
            methodBreakdown,
            recentlyActiveIds,
            traditionalCheckins,
            sessionCheckins
        ] = await Promise.all([
            Member.find(queryFilter).select('name email phone status expiryDate createdAt updatedAt').lean(),
            Attendance.countDocuments({
                ...queryFilter,
                date: {
                    $gte: today,
                    $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                }
            }),
            prisma.sessionCheckIn.count({
                where: {
                    ...prismaWhere,
                    startedAt: {
                        gte: today,
                        lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                    }
                }
            }),
            Payment.aggregate([
                { $match: { ...queryFilter, date: { $gte: startOfMonth } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Expense.aggregate([
                { $match: { ...queryFilter, date: { $gte: startOfMonth } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]),
            Payment.aggregate([
                { $match: { ...queryFilter, date: { $gte: sixMonthsAgo } } },
                {
                    $group: {
                        _id: { month: { $month: '$date' }, year: { $year: '$date' } },
                        total: { $sum: '$amount' }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]),
            Payment.aggregate([
                { $match: { ...queryFilter } },
                { $lookup: { from: 'members', localField: 'memberId', foreignField: '_id', as: 'member' } },
                { $unwind: '$member' },
                { $lookup: { from: 'plans', localField: 'member.planId', foreignField: '_id', as: 'plan' } },
                { $unwind: '$plan' },
                { $group: { _id: '$plan.name', value: { $sum: '$amount' } } }
            ]),
            Payment.aggregate([
                { $match: { ...queryFilter } },
                { $group: { _id: '$method', value: { $sum: '$amount' } } }
            ]),
            Attendance.distinct('memberId', {
                ...queryFilter,
                date: { $gte: sevenDaysAgo }
            }),
            prisma.attendance.findMany({
                where: { ...prismaWhere, date: { gte: startOfMonth } },
                orderBy: { date: 'desc' },
                take: 30
            }),
            prisma.sessionCheckIn.findMany({
                where: { ...prismaWhere, startedAt: { gte: startOfMonth } },
                orderBy: { startedAt: 'desc' },
                take: 30
            })
        ]);

        const uniqueMembers = dedupeMembers(membersForStats);
        const activeNow = (member) => member.status === 'Active' && (!member.expiryDate || new Date(member.expiryDate) > new Date());
        const totalMembers = uniqueMembers.length;
        const activeMembers = uniqueMembers.filter(activeNow).length;
        const expiredMembers = uniqueMembers.filter(member => member.status === 'Expired' || (member.expiryDate && new Date(member.expiryDate) <= new Date())).length;
        const expiringSoonCount = uniqueMembers.filter(member => activeNow(member) && member.expiryDate && new Date(member.expiryDate) <= nextWeek).length;
        const newMembersThisMonth = uniqueMembers.filter(member => new Date(member.createdAt || member.joinDate || 0) >= startOfMonth).length;

        const monthlyRevenue = revenueData.length > 0 ? revenueData[0].total : 0;
        const monthlyExpenses = expenseData.length > 0 ? expenseData[0].total : 0;
        const monthlyProfit = monthlyRevenue - monthlyExpenses;

        const inactiveMembersCount = await Member.countDocuments({
            ...queryFilter,
            status: 'Active',
            _id: { $nin: recentlyActiveIds }
        });

        // Populate member names for recent check-ins
        let recentCheckins = [];
        try {
            const memberIds = [...new Set([
                ...traditionalCheckins.map(c => c.memberId),
                ...sessionCheckins.map(c => c.memberId)
            ])];

            const members = await prisma.member.findMany({
                where: { id: { in: memberIds } },
                select: { id: true, name: true, phone: true }
            });
            const memberMap = {};
            members.forEach(m => memberMap[m.id] = m);

            const mappedTraditional = traditionalCheckins.map(a => ({
                id: a.id,
                memberName: memberMap[a.memberId]?.name || 'Unknown',
                memberPhone: memberMap[a.memberId]?.phone || '',
                date: a.date,
                checkInTime: a.checkInTime,
                type: 'Traditional'
            }));

            const mappedSessions = sessionCheckins.map(s => ({
                id: s.id,
                memberName: memberMap[s.memberId]?.name || 'Unknown',
                memberPhone: memberMap[s.memberId]?.phone || '',
                date: s.startedAt,
                checkInTime: new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: 'FitPrime'
            }));

            recentCheckins = [...mappedTraditional, ...mappedSessions]
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 50);
        } catch (err) {
            logger.error({ err }, 'Prisma error building recent check-in history');
        }

        res.json({
            totalMembers, activeMembers, expiredMembers, expiringSoonCount,
            newMembersThisMonth, todayAttendanceCount, todaySessionsCount, monthlyRevenue, monthlyExpenses,
            monthlyProfit, revenueTrend, planBreakdown, methodBreakdown, inactiveMembersCount,
            recentCheckins
        });
});

const getHistory = catchAsync(async (req, res, next) => {
    const { period, date } = req.query;
        let start = new Date();
        let end = new Date();

        if (period === 'today') {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        } else if (period === 'yesterday') {
            start.setDate(start.getDate() - 1);
            start.setHours(0, 0, 0, 0);
            end.setDate(end.getDate() - 1);
            end.setHours(23, 59, 59, 999);
        } else if (period === 'week') {
            start.setDate(start.getDate() - start.getDay());
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        } else if (period === 'month') {
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        } else if (period === 'year') {
            start.setMonth(0, 1);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        } else if (period === 'custom' && date) {
            start = new Date(date);
            start.setHours(0, 0, 0, 0);
            end = new Date(date);
            end.setHours(23, 59, 59, 999);
        } else {
            // default to month
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        }

        let history = [];

        if (req.user.role === 'partner' || req.user.role === 'admin' || req.user.role === 'superadmin') {
            const prismaWhere = {};
            if (req.user.gymId) {
                prismaWhere.gymId = req.user.gymId;
            }
            if (req.user.branchId) {
                prismaWhere.branchId = req.user.branchId;
            }

            const traditionalCheckins = await prisma.attendance.findMany({
                where: {
                    ...prismaWhere,
                    date: { gte: start, lte: end }
                }
            });

            const sessionCheckins = await prisma.sessionCheckIn.findMany({
                where: {
                    ...prismaWhere,
                    startedAt: { gte: start, lte: end }
                }
            });

            const memberIds = [...new Set([
                ...traditionalCheckins.map(c => c.memberId),
                ...sessionCheckins.map(c => c.memberId)
            ])];

            const members = await prisma.member.findMany({
                where: { id: { in: memberIds } },
                select: { id: true, name: true, phone: true }
            });
            
            const memberMap = {};
            members.forEach(m => memberMap[m.id] = m);

            const mappedTraditional = traditionalCheckins.map(a => ({
                id: a._id?.toString() || a.id,
                memberName: memberMap[a.memberId]?.name || 'Unknown',
                memberPhone: memberMap[a.memberId]?.phone || '',
                date: a.date,
                checkInTime: a.checkInTime,
                type: 'Traditional'
            }));

            const mappedSessions = sessionCheckins.map(s => ({
                id: s.id,
                memberName: memberMap[s.memberId]?.name || 'Unknown',
                memberPhone: memberMap[s.memberId]?.phone || '',
                date: s.startedAt,
                checkInTime: new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                type: 'FitPrime'
            }));

            history = [...mappedTraditional, ...mappedSessions].sort((a, b) => new Date(b.date) - new Date(a.date));
        }

        res.json({ success: true, data: history });
});

module.exports = {
    getDashboardStats,
    getHistory,
};


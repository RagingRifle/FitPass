const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const TrainerAttendance = require('../models/TrainerAttendance');
const User = require('../models/User');
const prisma = require('../config/prisma');

const parseDateOnly = value => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const [, year, month, day] = match.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date;
};

const eachDate = (start, end) => {
    const dates = [];
    for (let date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) dates.push(new Date(date));
    return dates;
};

// @desc    Check In Trainer
// @route   POST /api/trainer-attendance/checkin
// @access  Private (Trainer/Admin)
const checkInTrainer = catchAsync(async (req, res, next) => {
    try {
        const trainerId = req.user.role === 'trainer' ? req.user.id : req.body.trainerId;
        
        if (!trainerId) {
            return res.status(400).json({ success: false, message: 'Trainer ID is required' });
        }

        // Validate trainer exists
        const trainerQuery = { _id: trainerId, gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }) };
        if (req.user.branchId) {
            trainerQuery.branchId = req.user.branchId;
        }
        const trainer = await User.findOne(trainerQuery);
        if (!trainer || trainer.role !== 'trainer') {
            return res.status(404).json({ success: false, message: 'Trainer not found' });
        }
        const trainerBranchId = trainer.branchId || req.user.branchId || null;

        // Prevent overlapping shifts while allowing multiple completed shifts in one day.
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        const shiftCountExpected = Number(trainer.shiftsPerDay) === 2 ? 2 : 1;

        const existingQuery = {
            trainerId,
            gymId: req.user.gymId, branchId: trainerBranchId,
            checkOutTime: null,
            status: { $ne: 'Leave' },
            date: { $gte: todayStart, $lte: todayEnd }
        };

        const existing = await TrainerAttendance.findOne(existingQuery);

        if (existing) {
            return res.status(400).json({ success: false, message: 'Check out of the active shift before starting another shift' });
        }

        const leaveQuery = { ...existingQuery };
        delete leaveQuery.checkOutTime;
        delete leaveQuery.status;
        const leaveRecord = await TrainerAttendance.findOne({ ...leaveQuery, status: 'Leave' });
        if (leaveRecord) return res.status(400).json({ success: false, message: 'A leave marker exists for today. Ask an admin to remove it before checking in.' });

        const shiftsAlreadyRecorded = await TrainerAttendance.countDocuments({
            trainerId, gymId: req.user.gymId, date: { $gte: todayStart, $lte: todayEnd }, status: { $ne: 'Leave' },
            branchId: trainerBranchId
        });
        if (shiftsAlreadyRecorded >= shiftCountExpected) return res.status(400).json({ success: false, message: `You have already recorded all ${shiftCountExpected} shift${shiftCountExpected === 1 ? '' : 's'} for today.` });

        const attendance = await TrainerAttendance.create({
            trainerId,
            date: new Date(),
            checkInTime: new Date(),
            gymId: req.user.gymId,
            branchId: trainerBranchId,
            status: 'Present', shiftNumber: shiftsAlreadyRecorded + 1, shiftCountExpected,
            shiftType: shiftCountExpected === 2 ? 'half' : 'full'
        });

        res.status(201).json(attendance);
    } catch (error) { next(error); }
});

// @desc    Check Out Trainer
// @route   POST /api/trainer-attendance/checkout
// @access  Private (Trainer/Admin)
const checkOutTrainer = catchAsync(async (req, res, next) => {
    try {
        const trainerId = req.user.role === 'trainer' ? req.user.id : req.body.trainerId;

        if (!trainerId) {
            return res.status(400).json({ success: false, message: 'Trainer ID is required' });
        }

        const query = {
            trainerId,
            gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }),
            checkOutTime: null,
            status: { $ne: 'Leave' }
        };
        if (req.user.branchId) {
            query.branchId = req.user.branchId;
        }

        // Find active check-in (where checkOutTime is null)
        const attendance = await TrainerAttendance.findOne(query);

        if (!attendance) {
            return res.status(400).json({ success: false, message: 'No active check-in found for this trainer' });
        }

        const checkOutTime = new Date();
        const checkInTime = new Date(attendance.checkInTime);
        const diffMs = checkOutTime - checkInTime;
        const workingHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2)); // in hours

        attendance.checkOutTime = checkOutTime;
        attendance.workingHours = workingHours;

        const updated = await attendance.save();
        res.json(updated);
    } catch (error) { next(error); }
});

// @desc    Get Trainer Attendance Logs
// @route   GET /api/trainer-attendance
// @access  Private (Admin/Trainer)
const getTrainerAttendance = catchAsync(async (req, res, next) => {
    try {
        let query = { ...req.tenantFilter };

        if (req.user.role === 'trainer') {
            query.trainerId = req.user.id;
        } else if (req.query.trainerId) {
            query.trainerId = req.query.trainerId;
        }

        if (req.query.branchId) query.branchId = req.query.branchId;
        if (req.query.from || req.query.to) {
            const timezoneOffset = Number(req.query.timezoneOffset) || 0;
            const localDayStart = value => {
                const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
                return new Date(Date.UTC(year, month - 1, day) + timezoneOffset * 60_000);
            };
            query.date = {};
            if (req.query.from) query.date.$gte = localDayStart(req.query.from);
            if (req.query.to) query.date.$lte = new Date(localDayStart(req.query.to).getTime() + 86_400_000 - 1);
        }

        // Keep history bounded while supporting annual views with multiple shifts per day.
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 1000);
        const skip = (page - 1) * limit;

        const total = await TrainerAttendance.countDocuments(query);
        const logs = await TrainerAttendance.find(query)
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Batched Trainer lookup ONLY
        const trainerIds = [...new Set(logs.map(l => l.trainerId).filter(Boolean))];
        const trainers = trainerIds.length > 0
            ? await User.find({ _id: { $in: trainerIds } }).select('id name email role phone shiftsPerDay').lean()
            : [];

        const trainerMap = new Map((trainers || []).map(t => [t._id ? t._id.toString() : t.id, t]));

        const formatted = logs.map(log => {
            const t = log.trainerId ? trainerMap.get(log.trainerId.toString()) : null;
            return {
                ...log,
                trainer: t ? { id: t.id || t._id, name: t.name, email: t.email, shiftsPerDay: t.shiftsPerDay || 1 } : null,
                shiftCountExpected: log.shiftCountExpected || t?.shiftsPerDay || 1,
                shiftNumber: log.shiftNumber || 1,
                shiftType: log.shiftType || ((log.shiftCountExpected || t?.shiftsPerDay) === 2 ? 'half' : 'full')
            };
        });

        res.json({
            success: true,
            data: formatted,
            meta: { page, limit, total }
        });
    } catch (error) { next(error); }
});

// @desc    Mark a trainer as on leave for one calendar day
// @route   POST /api/trainer-attendance/leave
const markTrainerLeave = catchAsync(async (req, res, next) => {
    const { trainerId, date, reason = '' } = req.body;
    if (!trainerId || !date) return res.status(400).json({ success: false, message: 'Trainer and leave date are required' });

    const timezoneOffset = Number(req.body.timezoneOffset) || 0;
    const [year, month, day] = String(date).slice(0, 10).split('-').map(Number);
    const leaveDate = new Date(Date.UTC(year, month - 1, day) + timezoneOffset * 60_000);
    if (Number.isNaN(leaveDate.getTime())) return res.status(400).json({ success: false, message: 'Invalid leave date' });
    const trainerQuery = { _id: trainerId, gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }) };
    const trainer = await User.findOne(trainerQuery);
    if (!trainer || trainer.role !== 'trainer') return res.status(404).json({ success: false, message: 'Trainer not found in your branch' });

    const dayStart = new Date(leaveDate);
    const dayEnd = new Date(leaveDate.getTime() + 86_400_000 - 1);
    const where = { trainerId, gymId: req.user.gymId, branchId: req.user.branchId || trainer.branchId || null, date: { $gte: dayStart, $lte: dayEnd } };
    const existing = await TrainerAttendance.find(where);
    if (existing.some(log => log.status !== 'Leave')) return res.status(409).json({ success: false, message: 'This trainer already has attendance shifts on that date.' });
    if (existing.some(log => log.status === 'Leave')) return res.status(409).json({ success: false, message: 'Leave is already marked for that date.' });

    const leave = await TrainerAttendance.create({
        trainerId, date: dayStart, checkInTime: dayStart, checkOutTime: dayStart, workingHours: 0,
        status: 'Leave', leaveReason: String(reason).trim() || null,
        gymId: req.user.gymId, branchId: req.user.branchId || trainer.branchId || null
    });
    res.status(201).json({ success: true, data: leave });
});

const getTrainerLeaveRequests = catchAsync(async (req, res) => {
    const where = { gymId: req.user.gymId, ...(req.user.branchId ? { branchId: req.user.branchId } : {}) };
    if (req.user.role === 'trainer') where.trainerId = req.user.id;
    if (req.query.status && ['Pending', 'Approved', 'Rejected'].includes(req.query.status)) where.status = req.query.status;
    const requests = await prisma.trainerLeaveRequest.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
    const trainerIds = [...new Set(requests.map(request => request.trainerId))];
    const trainers = trainerIds.length ? await User.find({ _id: { $in: trainerIds } }).select('id name email').lean() : [];
    const trainerMap = new Map(trainers.map(trainer => [String(trainer._id || trainer.id), trainer]));
    res.json(requests.map(request => ({ ...request, trainer: trainerMap.get(String(request.trainerId)) || null })));
});

const createTrainerLeaveRequest = catchAsync(async (req, res) => {
    const startDate = parseDateOnly(req.body.startDate);
    const endDate = parseDateOnly(req.body.endDate);
    if (!startDate || !endDate || startDate > endDate) return res.status(400).json({ success: false, message: 'Enter a valid leave date range.' });
    if (Math.round((endDate - startDate) / 86_400_000) > 60) return res.status(400).json({ success: false, message: 'Leave requests can cover up to 61 days.' });
    const overlap = await prisma.trainerLeaveRequest.findFirst({
        where: {
            trainerId: req.user.id,
            gymId: req.user.gymId,
            status: { in: ['Pending', 'Approved'] },
            startDate: { lte: endDate },
            endDate: { gte: startDate }
        }
    });
    if (overlap) return res.status(409).json({ success: false, message: 'You already have a pending or approved request covering one or more of these days.' });
    const request = await prisma.trainerLeaveRequest.create({
        data: {
            trainerId: req.user.id,
            startDate,
            endDate,
            reason: String(req.body.reason || '').trim() || null,
            status: 'Pending',
            gymId: req.user.gymId,
            branchId: req.user.branchId || null
        }
    });
    res.status(201).json({ success: true, data: request });
});

const reviewTrainerLeaveRequest = catchAsync(async (req, res) => {
    const request = await prisma.trainerLeaveRequest.findFirst({ where: { id: req.params.id, gymId: req.user.gymId, ...(req.user.branchId ? { branchId: req.user.branchId } : {}) } });
    if (!request) return res.status(404).json({ success: false, message: 'Leave request not found in this branch.' });
    if (request.status !== 'Pending') return res.status(409).json({ success: false, message: 'This leave request has already been reviewed.' });
    const decision = req.body.status;
    if (!['Approved', 'Rejected'].includes(decision)) return res.status(400).json({ success: false, message: 'Choose approve or reject.' });

    const update = {
        status: decision,
        reviewedBy: req.user.id,
        reviewedAt: new Date(),
        adminNote: String(req.body.adminNote || '').trim() || null
    };
    let attendanceRows = null;

    if (decision === 'Approved') {
        const approvedStartDate = parseDateOnly(req.body.startDate) || request.startDate;
        const approvedEndDate = parseDateOnly(req.body.endDate) || request.endDate;
        if (approvedStartDate > approvedEndDate) return res.status(400).json({ success: false, message: 'The approved start date must be on or before the end date.' });
        if (Math.round((approvedEndDate - approvedStartDate) / 86_400_000) > 60) return res.status(400).json({ success: false, message: 'Approved leave can cover up to 61 days.' });

        const overlap = await prisma.trainerLeaveRequest.findFirst({
            where: {
                id: { not: request.id },
                trainerId: request.trainerId,
                gymId: request.gymId,
                status: 'Approved',
                approvedStartDate: { lte: approvedEndDate },
                approvedEndDate: { gte: approvedStartDate }
            }
        });
        if (overlap) return res.status(409).json({ success: false, message: 'The edited dates overlap another approved leave.' });

        const dates = eachDate(approvedStartDate, approvedEndDate);
        const timezoneOffset = Number(req.body.timezoneOffset) || 0;
        attendanceRows = dates.map(date => {
            const dayStart = new Date(date.getTime() + timezoneOffset * 60_000);
            const dayEnd = new Date(dayStart.getTime() + 86_400_000 - 1);
            return { date, dayStart, dayEnd };
        });
        const existingAttendance = await TrainerAttendance.find({
            trainerId: request.trainerId,
            gymId: request.gymId,
            branchId: request.branchId,
            date: { $gte: attendanceRows[0].dayStart, $lte: attendanceRows[attendanceRows.length - 1].dayEnd }
        }).lean();
        if (existingAttendance.some(row => row.status !== 'Leave')) return res.status(409).json({ success: false, message: 'The approved range includes a day with a recorded shift.' });
        if (existingAttendance.some(row => row.status === 'Leave')) return res.status(409).json({ success: false, message: 'The approved range includes an existing leave marker.' });

        update.approvedStartDate = approvedStartDate;
        update.approvedEndDate = approvedEndDate;
    }

    const updated = await prisma.$transaction(async transaction => {
        if (attendanceRows) {
            await transaction.trainerAttendance.createMany({
                data: attendanceRows.map(({ dayStart }) => ({
                    trainerId: request.trainerId,
                    date: dayStart,
                    checkInTime: dayStart,
                    checkOutTime: dayStart,
                    workingHours: 0,
                    status: 'Leave',
                    leaveReason: request.reason,
                    gymId: request.gymId,
                    branchId: request.branchId
                }))
            });
        }
        return transaction.trainerLeaveRequest.update({ where: { id: request.id }, data: update });
    });
    res.json({ success: true, data: updated });
});

const getMyTrainerConfig = catchAsync(async (req, res) => {
    if (req.user.role !== 'trainer') return res.status(403).json({ message: 'Trainer account required.' });
    const trainer = await User.findById(req.user.id).select('shiftsPerDay').lean();
    res.json({ shiftsPerDay: Number(trainer?.shiftsPerDay) === 2 ? 2 : 1 });
});

module.exports = {
    checkInTrainer,
    checkOutTrainer,
    getTrainerAttendance,
    getMyTrainerConfig,
    markTrainerLeave,
    getTrainerLeaveRequests,
    createTrainerLeaveRequest,
    reviewTrainerLeaveRequest
};

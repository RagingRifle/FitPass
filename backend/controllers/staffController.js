const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const User = require('../models/User');
const Member = require('../models/Member');
const MemberTrainerAssignment = require('../models/MemberTrainerAssignment');

// @desc    Get all staff members
// @route   GET /api/staff
// @access  Private/Admin
const getStaff = catchAsync(async (req, res, next) => {
    try {
        const query = {
            role: { $in: ['admin', 'trainer', 'receptionist'] },
            ...req.tenantFilter
        };

        const staff = await User.find(query).select('-password').lean();
        const { getStaffCode } = require('../utils/idGenerator');
        const formattedStaff = staff.map((s, idx) => ({
            ...s,
            empid: getStaffCode(s, idx),
            displayId: getStaffCode(s, idx)
        }));
        res.json(formattedStaff);
    } catch (error) { next(error); }
});

// @desc    Create a new staff member
// @route   POST /api/staff
// @access  Private/Admin
const createStaff = catchAsync(async (req, res, next) => {
    try {
        const { name, email, password, role, trainerMemberLimit, trainerPermissions, branchId } = req.body;
        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        if (!['admin', 'trainer', 'receptionist'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }
        let assignedBranchId = req.user.branchId || branchId || null;
        if (role === 'trainer' && !assignedBranchId) return res.status(400).json({ message: 'Choose a branch for this trainer account.' });
        if (req.user.branchId && assignedBranchId !== req.user.branchId) return res.status(403).json({ message: 'You can only create staff in your assigned branch.' });
        if (assignedBranchId) {
            const branch = await require('../config/prisma').branch.findFirst({ where: { id: assignedBranchId, gymId: req.user.gymId } });
            if (!branch) return res.status(400).json({ message: 'Choose a branch that belongs to your gym.' });
        }

        const existingUser = await User.findOne({ email: email.trim().toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        const staff = await User.create({
            name,
            email: email.trim().toLowerCase(),
            password,
            role,
            ...(role === 'trainer' ? {
                trainerMemberLimit: Math.max(1, Math.min(100, Number(trainerMemberLimit) || 10)),
                trainerPermissions: normalizeTrainerPermissions(trainerPermissions)
            } : {}),
            gymId: req.user.gymId,
            branchId: assignedBranchId
        });

        // H4 floor trainers start with the active roster at their branch. Managers
        // can rebalance that roster later through the trainer assignment screen.
        if (role === 'trainer' && req.user.role === 'h4_admin') {
            const roster = await Member.find({ gymId: req.user.gymId, branchId: req.user.branchId || null, status: 'Active' }).select('id').lean();
            const staffId = staff._id || staff.id;
            const alreadyAssigned = await MemberTrainerAssignment.find({ gymId: req.user.gymId, branchId: req.user.branchId || null }).select('memberId').lean();
            const assignedIds = new Set(alreadyAssigned.map((item) => String(item.memberId)));
            const available = roster.filter((member) => !assignedIds.has(String(member.id || member._id))).slice(0, staff.trainerMemberLimit || 10);
            await Promise.all(available.map(async (member) => {
                const memberId = member._id || member.id;
                await MemberTrainerAssignment.create({ memberId, trainerId: staffId, gymId: req.user.gymId, branchId: req.user.branchId || null });
            }));
        }

        const result = { ...staff };
        delete result.password;

        res.status(201).json(result);
    } catch (error) { next(error); }
});

// @desc    Update a staff member
// @route   PUT /api/staff/:id
// @access  Private/Admin
const updateStaff = catchAsync(async (req, res, next) => {
    try {
        const { name, email, password, role, trainerMemberLimit, trainerPermissions, branchId } = req.body;
        const query = { _id: req.params.id, gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }) };
        if (req.user.branchId) {
            query.branchId = req.user.branchId;
        }
        const staff = await User.findOne(query);

        if (!staff) {
            return res.status(404).json({ message: 'Staff member not found' });
        }

        if (email && email.trim().toLowerCase() !== staff.email) {
            const existingUser = await User.findOne({ email: email.trim().toLowerCase() });
            if (existingUser) {
                return res.status(400).json({ message: 'User with this email already exists' });
            }
            staff.email = email.trim().toLowerCase();
        }

        staff.name = name || staff.name;
        if (role) {
            if (!['admin', 'trainer', 'receptionist'].includes(role)) {
                return res.status(400).json({ message: 'Invalid role' });
            }
            staff.role = role;
        }

        if (staff.role === 'trainer') {
            if (branchId && String(branchId) !== String(staff.branchId || '')) {
                if (req.user.branchId && String(branchId) !== String(req.user.branchId)) return res.status(403).json({ message: 'You can only assign a trainer within your branch.' });
                const branch = await require('../config/prisma').branch.findFirst({ where: { id: branchId, gymId: req.user.gymId } });
                if (!branch) return res.status(400).json({ message: 'Choose a branch that belongs to your gym.' });
                if (await MemberTrainerAssignment.countDocuments({ trainerId: staff._id || staff.id, gymId: req.user.gymId })) return res.status(409).json({ message: 'Reassign this trainer’s members before changing their branch.' });
                staff.branchId = branchId;
            }
            if (trainerMemberLimit !== undefined) {
                const nextLimit = Math.max(1, Math.min(100, Number(trainerMemberLimit) || 1));
                const currentLoad = await MemberTrainerAssignment.countDocuments({ trainerId: staff._id || staff.id, gymId: req.user.gymId });
                if (nextLimit < currentLoad) return res.status(400).json({ message: `This trainer already has ${currentLoad} assigned members. Reassign members before lowering the limit.` });
                staff.trainerMemberLimit = nextLimit;
            }
            if (trainerPermissions !== undefined) staff.trainerPermissions = normalizeTrainerPermissions(trainerPermissions);
        }

        if (password) {
            staff.password = password;
        }

        const updatedStaff = await staff.save();
        const result = { ...updatedStaff };
        delete result.password;

        res.json(result);
    } catch (error) { next(error); }
});

// @desc    Delete a staff member
// @route   DELETE /api/staff/:id
// @access  Private/Admin
const deleteStaff = catchAsync(async (req, res, next) => {
    try {
        const query = { _id: req.params.id, gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }) };
        if (req.user.branchId) {
            query.branchId = req.user.branchId;
        }
        const staff = await User.findOne(query);
        if (!staff) {
            return res.status(404).json({ message: 'Staff member not found' });
        }

        if (staff.id === req.user.id) {
            return res.status(400).json({ message: 'You cannot delete your own account' });
        }

        await staff.deleteOne();
        res.json({ message: 'Staff member removed' });
    } catch (error) { next(error); }
});

module.exports = {
    getStaff,
    createStaff,
    updateStaff,
    deleteStaff
};

function normalizeTrainerPermissions(input = {}) {
    const allowed = ['assignWorkout', 'assignDiet', 'recordAssessment', 'scheduleClasses', 'manageClassBookings', 'setClassPricing'];
    return Object.fromEntries(allowed.map((key) => [key, input[key] !== false]));
}

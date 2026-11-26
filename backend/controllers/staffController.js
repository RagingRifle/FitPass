const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const User = require('../models/User');
const Member = require('../models/Member');
const MemberTrainerAssignment = require('../models/MemberTrainerAssignment');
const prisma = require('../config/prisma');
const { H4_GYM_IDS } = require('../config/constants');

const resolveStaffGymId = async (req) => {
    if (req.user.role !== 'superadmin') return String(req.user.gymId || '');
    const selectedGymId = String(req.tenantFilter?.gymId || '');
    if (!selectedGymId) return '';
    if (H4_GYM_IDS.includes(selectedGymId)) return selectedGymId;
    const gym = await prisma.gym.findUnique({ where: { id: selectedGymId }, select: { name: true } }).catch(() => null);
    return gym?.name?.toLowerCase().includes('h4') ? selectedGymId : '';
};

const isH4Gym = async (gymId) => {
    if (H4_GYM_IDS.includes(String(gymId))) return true;
    const gym = await prisma.gym.findUnique({ where: { id: String(gymId) }, select: { name: true } });
    return gym?.name?.toLowerCase().includes('h4') || false;
};

// @desc    Get all staff members
// @route   GET /api/staff
// @access  Private/Admin
const getStaff = catchAsync(async (req, res, next) => {
    try {
        const gymId = await resolveStaffGymId(req);
        if (!gymId) return res.status(403).json({ message: 'Select the H4 division to manage H4 staff.' });
        const h4Scope = ['h4_admin', 'h4_branch_admin'].includes(req.user.role) || await isH4Gym(gymId);
        const branchScoped = req.user.role === 'h4_branch_admin' || req.user.role === 'h4_admin' && Boolean(req.user.branchId) || req.user.isH4BranchAdmin;
        const query = {
            role: { $in: h4Scope ? branchScoped ? ['trainer'] : ['trainer', 'h4_admin', 'h4_branch_admin'] : ['admin', 'trainer', 'receptionist'] },
            ...req.tenantFilter,
            gymId
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
        const { name, email, password, role, trainerMemberLimit, trainerPermissions, shiftsPerDay, branchId } = req.body;
        const gymId = await resolveStaffGymId(req);
        if (!gymId) return res.status(403).json({ message: 'Select the H4 division to manage H4 staff.' });
        const h4Scope = ['h4_admin', 'h4_branch_admin'].includes(req.user.role) || await isH4Gym(gymId);
        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const allowedRoles = h4Scope ? ['trainer'] : ['admin', 'trainer', 'receptionist'];
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }
        let assignedBranchId = req.user.branchId || branchId || null;
        if (role === 'trainer' && !assignedBranchId) return res.status(400).json({ message: 'Choose a branch for this trainer account.' });
        if (req.user.branchId && assignedBranchId !== req.user.branchId) return res.status(403).json({ message: 'You can only create staff in your assigned branch.' });
        if (assignedBranchId) {
            const branch = await prisma.branch.findFirst({ where: { id: assignedBranchId, gymId } });
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
                shiftsPerDay: Number(shiftsPerDay) === 2 ? 2 : 1,
                trainerPermissions: normalizeTrainerPermissions(trainerPermissions)
            } : {}),
            gymId,
            branchId: assignedBranchId,
            isVerified: true,
            isActive: true,
            status: 'Active'
        });

        // H4 floor trainers start with the active roster at their branch. Managers
        // can rebalance that roster later through the trainer assignment screen.
        if (role === 'trainer' && (['h4_admin', 'h4_branch_admin'].includes(req.user.role) || req.user.role === 'superadmin')) {
            const trainerBranchId = assignedBranchId || req.user.branchId || null;
            const roster = await Member.find({ gymId, branchId: trainerBranchId, status: 'Active' }).select('id').lean();
            const staffId = staff._id || staff.id;
            const alreadyAssigned = await MemberTrainerAssignment.find({ gymId, branchId: trainerBranchId }).select('memberId').lean();
            const assignedIds = new Set(alreadyAssigned.map((item) => String(item.memberId)));
            const available = roster.filter((member) => !assignedIds.has(String(member.id || member._id))).slice(0, staff.trainerMemberLimit || 10);
            await Promise.all(available.map(async (member) => {
                const memberId = member._id || member.id;
                await MemberTrainerAssignment.create({ memberId, trainerId: staffId, gymId, branchId: trainerBranchId });
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
        const { name, email, password, role, trainerMemberLimit, trainerPermissions, shiftsPerDay, branchId } = req.body;
        const gymId = await resolveStaffGymId(req);
        if (!gymId) return res.status(403).json({ message: 'Select the H4 division to manage H4 staff.' });
        const query = { _id: req.params.id, gymId, ...(req.user.branchId && { branchId: req.user.branchId }) };
        if (req.user.branchId) {
            query.branchId = req.user.branchId;
        }
        const staff = await User.findOne(query);

        if (!staff) {
            return res.status(404).json({ message: 'Staff member not found' });
        }
        if (['h4_admin', 'h4_branch_admin'].includes(staff.role)) {
            return res.status(403).json({ message: 'Manage H4 administrator accounts in the Admins Directory.' });
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
            const h4Scope = ['h4_admin', 'h4_branch_admin'].includes(req.user.role) || await isH4Gym(gymId);
            const allowedRoles = h4Scope ? ['trainer'] : ['admin', 'trainer', 'receptionist'];
            if (!allowedRoles.includes(role)) {
                return res.status(400).json({ message: 'Invalid role' });
            }
            staff.role = role;
        }

        if (staff.role === 'trainer') {
            if (shiftsPerDay !== undefined) {
                if (![1, 2, '1', '2'].includes(shiftsPerDay)) return res.status(400).json({ message: 'Choose one or two shifts per day.' });
                staff.shiftsPerDay = Number(shiftsPerDay);
            }
            if (branchId && String(branchId) !== String(staff.branchId || '')) {
                if (req.user.branchId && String(branchId) !== String(req.user.branchId)) return res.status(403).json({ message: 'You can only assign a trainer within your branch.' });
                const branch = await prisma.branch.findFirst({ where: { id: branchId, gymId } });
                if (!branch) return res.status(400).json({ message: 'Choose a branch that belongs to your gym.' });
                if (await MemberTrainerAssignment.countDocuments({ trainerId: staff._id || staff.id, gymId })) return res.status(409).json({ message: 'Reassign this trainer’s members before changing their branch.' });
                staff.branchId = branchId;
            }
            if (trainerMemberLimit !== undefined) {
                const nextLimit = Math.max(1, Math.min(100, Number(trainerMemberLimit) || 1));
                const currentLoad = await MemberTrainerAssignment.countDocuments({ trainerId: staff._id || staff.id, gymId });
                if (nextLimit < currentLoad) return res.status(400).json({ message: `This trainer already has ${currentLoad} assigned members. Reassign members before lowering the limit.` });
                staff.trainerMemberLimit = nextLimit;
            }
            if (trainerPermissions !== undefined) staff.trainerPermissions = normalizeTrainerPermissions(trainerPermissions);
        }

        if (password) {
            staff.password = password;
        }
        // Staff credentials are issued by an administrator; email OTP is not
        // part of this account-provisioning flow.
        staff.isVerified = true;

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
        const gymId = await resolveStaffGymId(req);
        if (!gymId) return res.status(403).json({ message: 'Select the H4 division to manage H4 staff.' });
        const query = { _id: req.params.id, gymId, ...(req.user.branchId && { branchId: req.user.branchId }) };
        if (req.user.branchId) {
            query.branchId = req.user.branchId;
        }
        const staff = await User.findOne(query);
        if (!staff) {
            return res.status(404).json({ message: 'Staff member not found' });
        }
        if (['h4_admin', 'h4_branch_admin'].includes(staff.role)) {
            return res.status(403).json({ message: 'Manage H4 administrator accounts in the Admins Directory.' });
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

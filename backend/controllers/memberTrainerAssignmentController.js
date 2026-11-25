const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const MemberTrainerAssignment = require('../models/MemberTrainerAssignment');
const User = require('../models/User');
const Member = require('../models/Member');

// @desc    Assign a trainer to a member
// @route   POST /api/trainer-assignments
// @access  Private/Admin
const assignTrainer = catchAsync(async (req, res, next) => {
    try {
        const { memberId, trainerId } = req.body;

        if (!memberId || !trainerId) {
            return res.status(400).json({ success: false, message: 'Member ID and Trainer ID are required' });
        }

        // Validate member exists in the same gym
        const member = await Member.findOne({ _id: memberId, gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }) });
        if (!member) {
            return res.status(404).json({ success: false, message: 'Member not found' });
        }

        // Validate trainer exists in the same gym and has role 'trainer'
        const trainer = await User.findOne({ _id: trainerId, gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }), role: 'trainer' });
        if (!trainer) {
            return res.status(404).json({ success: false, message: 'Trainer not found or user is not a trainer' });
        }

        // Check if assignment already exists
        const existingAssignment = await MemberTrainerAssignment.findOne({
            memberId,
            trainerId,
            gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId })
        });

        if (existingAssignment) {
            return res.status(400).json({ success: false, message: 'Trainer is already assigned to this member' });
        }

        const currentLoad = await MemberTrainerAssignment.countDocuments({ trainerId, gymId: req.user.gymId });
        if (currentLoad >= (trainer.trainerMemberLimit || 10)) {
            return res.status(409).json({ success: false, message: `This trainer has reached the ${trainer.trainerMemberLimit || 10}-member assignment limit.` });
        }

        const assignment = await MemberTrainerAssignment.create({
            memberId,
            trainerId,
            assignedDate: new Date(),
            gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId })
        });

        res.status(201).json(assignment);
    } catch (error) { next(error); }
});

// @desc    Get all trainer assignments
// @route   GET /api/trainer-assignments
// @access  Private/Admin/Trainer
const getAssignments = catchAsync(async (req, res, next) => {
    try {
        const query = { gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }) };
        if (req.user.role === 'trainer') query.trainerId = req.user.id;

        // Strict pagination parameters with hard cap at 100
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
        const skip = (page - 1) * limit;

        const total = await MemberTrainerAssignment.countDocuments(query);
        const assignments = await MemberTrainerAssignment.find(query)
            .sort({ assignedDate: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
        
        // Batched multi-entity lookup (Member + Trainer)
        const memberIds = [...new Set(assignments.map(a => a.memberId).filter(Boolean))];
        const trainerIds = [...new Set(assignments.map(a => a.trainerId).filter(Boolean))];

        const [members, trainers] = await Promise.all([
            memberIds.length > 0 ? Member.find({ _id: { $in: memberIds } }).select('id name phone email registrationNumber heightCm status').lean() : [],
            trainerIds.length > 0 ? User.find({ _id: { $in: trainerIds } }).select('id name email role phone').lean() : []
        ]);

        const memberMap = new Map((members || []).map(m => [m._id ? m._id.toString() : m.id, m]));
        const trainerMap = new Map((trainers || []).map(t => [t._id ? t._id.toString() : t.id, t]));

        const populated = assignments.map(assoc => {
            const m = assoc.memberId ? memberMap.get(assoc.memberId.toString()) : null;
            const t = assoc.trainerId ? trainerMap.get(assoc.trainerId.toString()) : null;
            return {
                ...assoc,
                member: m ? { id: m.id || m._id, name: m.name, phone: m.phone, email: m.email } : null,
                trainer: t ? { id: t.id || t._id, name: t.name, email: t.email } : null
            };
        });

        res.json({
            success: true,
            data: populated,
            meta: { page, limit, total }
        });
    } catch (error) { next(error); }
});

// @desc    Remove a trainer assignment
// @route   DELETE /api/trainer-assignments/:id
// @access  Private/Admin
const removeAssignment = catchAsync(async (req, res, next) => {
    try {
        const assignment = await MemberTrainerAssignment.findOne({ _id: req.params.id, gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }) });

        if (assignment) {
            await assignment.deleteOne();
            res.json({ message: 'Trainer assignment removed' });
        } else {
            res.status(404).json({ success: false, message: 'Assignment not found' });
        }
    } catch (error) { next(error); }
});

module.exports = {
    assignTrainer,
    getAssignments,
    removeAssignment
};

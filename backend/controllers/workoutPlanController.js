const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const WorkoutPlan = require('../models/WorkoutPlan');
const Member = require('../models/Member');
const User = require('../models/User');
const { H4_GYM_IDS } = require('../config/constants');

const getPlanGymScope = (req) => {
    const gymId = String(req.user?.gymId || '');
    const h4Scope = req.user?.role === 'h4_admin' || H4_GYM_IDS.includes(gymId);
    return { gymId, gymIds: h4Scope ? [...new Set([...H4_GYM_IDS, gymId].filter(Boolean))] : [gymId] };
};
const parseMemberIds = (plan) => {
    try {
        const ids = plan.memberIds ? JSON.parse(plan.memberIds) : [];
        return [...new Set([plan.memberId, ...(Array.isArray(ids) ? ids : [])].filter(Boolean).map(String))];
    } catch {
        return plan.memberId ? [String(plan.memberId)] : [];
    }
};

// Return only the fields needed by the assignment picker. Trainers may assign
// across their gym (the plan creation check is gym-wide), while admins retain
// their selected branch scope.
const getAssignableMembers = catchAsync(async (req, res, next) => {
    try {
        const { gymId, gymIds } = getPlanGymScope(req);
        if (!gymId) {
            return res.status(400).json({ success: false, message: 'Select a gym before loading assignable members.' });
        }

        const query = { gymId: gymIds.length > 1 ? { $in: gymIds } : gymId };
        if (req.user.role !== 'trainer' && req.user.branchId) query.branchId = req.user.branchId;

        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 100);
        const skip = (page - 1) * limit;
        const [total, members] = await Promise.all([
            Member.countDocuments(query),
            Member.find(query)
                .select('id registrationNumber name phone email branchId')
                .sort({ name: 1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        res.json({
            members,
            page,
            pages: Math.ceil(total / limit),
            total
        });
    } catch (error) { next(error); }
});

// @desc    Create a workout plan for a member
// @route   POST /api/workout-plans
// @access  Private/Admin/Trainer
const createPlan = catchAsync(async (req, res, next) => {
    try {
        const requestedIds = Array.isArray(req.body.memberIds) ? req.body.memberIds : [req.body.memberId];
        const memberIds = [...new Set(requestedIds.filter(Boolean).map(String))];
        const { name, startDate, endDate, exercises } = req.body;

        if (!memberIds.length || !name) {
            return res.status(400).json({ success: false, message: 'Select at least one member and enter a plan name.' });
        }

        const { gymId, gymIds } = getPlanGymScope(req);
        const members = await Promise.all(memberIds.map((id) => Member.findById(id).lean()));
        const invalidIndex = members.findIndex((member) => !member || !gymIds.includes(String(member.gymId)) || (req.user.role !== 'trainer' && req.user.branchId && String(member.branchId || '') !== String(req.user.branchId)));
        if (invalidIndex !== -1) {
            return res.status(404).json({ success: false, message: 'One or more selected members are outside your gym or branch.' });
        }
        const member = members[0];
        const memberBranches = [...new Set(members.map((item) => String(item.branchId || '')))];

        const plan = await WorkoutPlan.create({
            memberId: memberIds[0],
            memberIds: JSON.stringify(memberIds),
            trainerId: req.user.role === 'trainer' ? req.user.id : (req.body.trainerId || null),
            name,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            exercises: exercises ? (typeof exercises === 'string' ? exercises : JSON.stringify(exercises)) : null,
            gymId,
            branchId: req.user.branchId || (memberBranches.length === 1 ? member.branchId || null : null)
        });

        const recipients = await User.find({ memberId: { $in: memberIds } }).lean();
        await Promise.all(recipients.map((recipient) => require('../models/Notification').create({ recipientId: recipient.id || recipient._id, gymId: member.gymId, type: 'plan_update', message: `A workout plan was added: ${name}.` })));

        res.status(201).json(plan);
    } catch (error) { next(error); }
});

// @desc    Get all workout plans
// @route   GET /api/workout-plans
// @access  Private/Admin/Trainer/Member
const getPlans = catchAsync(async (req, res, next) => {
    try {
        // Query by gymId so workout plans are accessible across all branches of the gym
        const { gymId, gymIds } = getPlanGymScope(req);
        let query = { gymId: gymIds.length > 1 ? { $in: gymIds } : gymId };

        if (req.query.branchId) {
            query.branchId = req.query.branchId;
        }

        // If member is fetching, only show their plans
        if (req.user.role === 'member') {
            // Some older member logins were created before memberId was linked
            // to the profile. Resolve the profile before querying plans so a
            // valid assigned plan does not look missing to that member.
            let linkedMember = req.user.memberId
                ? await Member.findOne({ _id: req.user.memberId, gymId: { $in: gymIds } })
                : null;
            if (!linkedMember) {
                const identity = [];
                if (req.user.email) identity.push({ email: req.user.email });
                if (req.user.phone) identity.push({ phone: req.user.phone });
                if (identity.length) linkedMember = await Member.findOne({ gymId: { $in: gymIds }, $or: identity });
            }
            const linkedMemberId = linkedMember ? String(linkedMember.id || linkedMember._id) : '__unlinked_member__';
            query.$or = [{ memberId: linkedMemberId }, { memberIds: { $regex: `"${linkedMemberId}"` } }];
        } else if (req.user.role === 'trainer') {
            query.trainerId = req.user.id;
        }

        if (req.query.memberId && req.user.role !== 'member') {
            query.memberId = req.query.memberId;
        }

        // Strict pagination parameters with hard cap at 100
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
        const skip = (page - 1) * limit;

        const total = await WorkoutPlan.countDocuments(query);
        const plans = await WorkoutPlan.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Batched multi-entity lookup (Trainer + Member)
        const memberIds = [...new Set(plans.flatMap(parseMemberIds))];
        const trainerIds = [...new Set(plans.map(p => p.trainerId).filter(Boolean))];

        const [members, trainers] = await Promise.all([
            memberIds.length > 0 ? Member.find({ _id: { $in: memberIds } }).select('id registrationNumber name phone email').lean() : [],
            trainerIds.length > 0 ? User.find({ _id: { $in: trainerIds } }).select('id name email role phone').lean() : []
        ]);

        const memberMap = new Map((members || []).flatMap(m => [[String(m._id || m.id), m], [String(m.id || m._id), m]]));
        const trainerMap = new Map((trainers || []).map(t => [t._id ? t._id.toString() : t.id, t]));

        const formatted = plans.map(p => {
            let parsedExercises = p.exercises;
            if (p.exercises && typeof p.exercises === 'string') {
                try {
                    parsedExercises = JSON.parse(p.exercises);
                } catch (e) {}
            }
            const assignedMemberIds = parseMemberIds(p);
            const assignedMembers = assignedMemberIds.map((id) => memberMap.get(id)).filter(Boolean);
            const m = assignedMembers.find((assigned) => String(assigned.id || assigned._id) === String(p.memberId)) || assignedMembers[0] || null;
            const t = p.trainerId ? trainerMap.get(p.trainerId.toString()) : null;

            return {
                ...p,
                memberIds: assignedMemberIds,
                members: assignedMembers.map((assigned) => ({ id: assigned.id || assigned._id, registrationNumber: assigned.registrationNumber, name: assigned.name, phone: assigned.phone, email: assigned.email })),
                exercises: parsedExercises,
                member: m ? { id: m.id || m._id, registrationNumber: m.registrationNumber, name: m.name, phone: m.phone, email: m.email } : null,
                trainer: t ? { id: t.id || t._id, name: t.name, email: t.email } : null
            };
        });

        res.json({
            success: true,
            data: formatted,
            meta: { page, limit, total }
        });
    } catch (error) { next(error); }
});

// @desc    Get single workout plan
// @route   GET /api/workout-plans/:id
// @access  Private/Admin/Trainer/Member
const getPlanById = catchAsync(async (req, res, next) => {
    try {
        const { gymIds } = getPlanGymScope(req);
        const plan = await WorkoutPlan.findOne({ _id: req.params.id, gymId: gymIds.length > 1 ? { $in: gymIds } : gymIds[0] });

        if (plan) {
            // Check member authorization
            const assignedMemberIds = parseMemberIds(plan);
            if (req.user.role === 'member' && !assignedMemberIds.includes(String(req.user.memberId))) {
                return res.status(403).json({ success: false, message: 'Not authorized to view this plan' });
            }

            if (plan.exercises && typeof plan.exercises === 'string') {
                try {
                    plan.exercises = JSON.parse(plan.exercises);
                } catch (e) {}
            }

            const memberObj = await Member.findOne({ _id: plan.memberId });
            const trainerObj = plan.trainerId ? await User.findOne({ _id: plan.trainerId }).select('-password') : null;

            res.json({
                ...plan,
                memberIds: assignedMemberIds,
                member: memberObj || null,
                trainer: trainerObj || null
            });
        } else {
            res.status(404).json({ success: false, message: 'Workout plan not found' });
        }
    } catch (error) { next(error); }
});

// @desc    Update workout plan
// @route   PUT /api/workout-plans/:id
// @access  Private/Admin/Trainer
const updatePlan = catchAsync(async (req, res, next) => {
    try {
        const { name, startDate, endDate, exercises, trainerId } = req.body;
        const { gymIds } = getPlanGymScope(req);

        const plan = await WorkoutPlan.findOne({ _id: req.params.id, gymId: gymIds.length > 1 ? { $in: gymIds } : gymIds[0] });

        if (plan) {
            const requestedIds = Array.isArray(req.body.memberIds) ? req.body.memberIds : parseMemberIds(plan);
            const memberIds = [...new Set(requestedIds.filter(Boolean).map(String))];
            if (!memberIds.length) return res.status(400).json({ success: false, message: 'A workout plan must be assigned to at least one member.' });
            const members = await Promise.all(memberIds.map((id) => Member.findById(id).lean()));
            const invalidIndex = members.findIndex((member) => !member || !gymIds.includes(String(member.gymId)) || (req.user.role !== 'trainer' && req.user.branchId && String(member.branchId || '') !== String(req.user.branchId)));
            if (invalidIndex !== -1) return res.status(404).json({ success: false, message: 'One or more selected members are outside your gym or branch.' });
            plan.memberId = memberIds[0];
            plan.memberIds = JSON.stringify(memberIds);
            plan.name = name || plan.name;
            if (startDate !== undefined) plan.startDate = startDate ? new Date(startDate) : null;
            if (endDate !== undefined) plan.endDate = endDate ? new Date(endDate) : null;
            if (exercises !== undefined) {
                plan.exercises = typeof exercises === 'string' ? exercises : JSON.stringify(exercises);
            }
            if (trainerId !== undefined) plan.trainerId = trainerId || null;

            const updatedPlan = await plan.save();
            const recipients = await User.find({ memberId: { $in: memberIds } }).lean();
            await Promise.all(recipients.map((recipient) => require('../models/Notification').create({ recipientId: recipient.id || recipient._id, gymId: plan.gymId, type: 'plan_update', message: `Your workout plan "${updatedPlan.name}" was updated.` })));
            if (updatedPlan.exercises && typeof updatedPlan.exercises === 'string') {
                try {
                    updatedPlan.exercises = JSON.parse(updatedPlan.exercises);
                } catch (e) {}
            }
            res.json(updatedPlan);
        } else {
            res.status(404).json({ success: false, message: 'Workout plan not found' });
        }
    } catch (error) { next(error); }
});

// @desc    Delete workout plan
// @route   DELETE /api/workout-plans/:id
// @access  Private/Admin/Trainer
const deletePlan = catchAsync(async (req, res, next) => {
    try {
        const { gymIds } = getPlanGymScope(req);
        const plan = await WorkoutPlan.findOne({ _id: req.params.id, gymId: gymIds.length > 1 ? { $in: gymIds } : gymIds[0] });

        if (plan) {
            const memberIds = parseMemberIds(plan);
            const planName = plan.name;
            const gymId = plan.gymId;
            await plan.deleteOne();
            const recipients = await User.find({ memberId: { $in: memberIds } }).lean();
            await Promise.all(recipients.map((recipient) => require('../models/Notification').create({ recipientId: recipient.id || recipient._id, gymId, type: 'plan_update', message: `Your workout plan "${planName}" was removed.` })));
            res.json({ message: 'Workout plan removed' });
        } else {
            res.status(404).json({ success: false, message: 'Workout plan not found' });
        }
    } catch (error) { next(error); }
});

// @desc    Log a completed workout for a member (notifies coach/trainer)
// @route   POST /api/workout-plans/log
// @access  Private/Member/Trainer
const logCompletedWorkout = catchAsync(async (req, res, next) => {
    try {
        const { planId, exercises, notes } = req.body;
        let memberId = req.user?.memberId;
        let gymId = req.user?.gymId;
        let memberName = req.user?.name || '';

        try {
            if (memberId) {
                const m = await Member.findById(memberId).select('gymId name');
                if (m) {
                    if (m.gymId) gymId = m.gymId;
                    if (m.name) memberName = m.name;
                }
            }
            if (!memberId && req.user?.email) {
                const m = await Member.findOne({ email: req.user.email }).select('id gymId name');
                if (m) {
                    memberId = m._id || m.id;
                    if (m.gymId) gymId = m.gymId;
                    if (m.name) memberName = m.name;
                }
            }
        } catch (err) {}

        const AuditLog = require('../models/AuditLog');
        const Notification = require('../models/Notification');

        let planName = 'Daily Fitness Workout';
        let trainerId = null;

        if (planId) {
            const plan = await WorkoutPlan.findOne({ _id: planId, gymId });
            if (plan) {
                planName = plan.name || planName;
                trainerId = plan.trainerId || null;
            }
        }

        const exerciseCount = Array.isArray(exercises) ? exercises.length : 0;
        const detailsText = `Member ${memberName || 'Athlete'} completed workout: "${planName}" (${exerciseCount} exercises completed). ${notes ? 'Notes: ' + notes : ''}`;

        // Create Audit Log entry for Coach / Admin to view
        await AuditLog.create({
            gymId: gymId || H4_GYM_IDS[1],
            userId: req.user?.id || req.user?._id || null,
            userName: memberName || req.user?.name || 'Member',
            userEmail: req.user?.email || '',
            userRole: 'member',
            action: 'WORKOUT_COMPLETED',
            entity: 'WorkoutPlan',
            entityId: planId || '',
            entityName: planName,
            details: detailsText
        }).catch(() => null);

        // If trainer assigned, notify trainer
        if (trainerId) {
            await Notification.create({
                recipientId: trainerId,
                gymId: gymId || H4_GYM_IDS[1],
                type: 'WORKOUT_LOGGED',
                message: `${memberName || 'Your member'} completed workout: "${planName}"!`,
                read: false
            }).catch(() => null);
        }

        res.status(200).json({
            success: true,
            message: '🎉 Workout session logged successfully! Your coach has been notified.',
            completedAt: new Date().toISOString()
        });
    } catch (error) { next(error); }
});

module.exports = {
    getAssignableMembers,
    createPlan,
    getPlans,
    getPlanById,
    updatePlan,
    deletePlan,
    logCompletedWorkout
};

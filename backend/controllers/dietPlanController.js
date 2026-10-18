const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const DietPlan = require('../models/DietPlan');
const Member = require('../models/Member');
const User = require('../models/User');
const { H4_GYM_IDS } = require('../config/constants');

const getGymScope = (req) => {
    const gymId = String(req.user?.gymId || '');
    const isH4Scope = req.user?.role === 'h4_admin' || H4_GYM_IDS.includes(gymId);
    const gymIds = isH4Scope ? [...new Set([...H4_GYM_IDS, gymId].filter(Boolean))] : [gymId];
    return { gymId, gymIds, isH4Scope };
};

const loadMembersForAssignment = async (memberIds, gymIds, branchId, existingIds = []) => {
    // Use findById for each member here. Apart from avoiding adapter edge cases
    // with Mongo-style `$in`, this lets us distinguish a legacy assignment
    // from a newly added member and validate each one against the active scope.
    const existing = new Set(existingIds.map(String));
    const records = await Promise.all(memberIds.map((id) => Member.findById(id).lean()));
    const found = records.filter(Boolean);
    const valid = found.filter((member) => {
        const gymMatches = gymIds.includes(String(member.gymId || ''));
        const branchMatches = !branchId || String(member.branchId || '') === String(branchId);
        return (gymMatches && branchMatches) || existing.has(String(member.id || member._id));
    });
    return { found, valid };
};

// @desc    Create a diet plan for a member
// @route   POST /api/diet-plans
// @access  Private/Admin/Trainer
const createPlan = catchAsync(async (req, res, next) => {
    try {
        const memberIds = [...new Set((Array.isArray(req.body.memberIds) ? req.body.memberIds : [req.body.memberId]).filter(Boolean).map(String))];
        const { name, startDate, endDate, meals } = req.body;

        if (!memberIds.length || !name) {
            return res.status(400).json({ success: false, message: 'At least one member and a plan name are required' });
        }

        const { gymId, gymIds } = getGymScope(req);
        const { found: assignedMembers, valid } = await loadMembersForAssignment(memberIds, gymIds, req.user.branchId);
        if (valid.length !== memberIds.length) {
            return res.status(404).json({ success: false, message: 'One or more members were not found in this gym' });
        }
        const member = assignedMembers[0];

        const plan = await DietPlan.create({
            memberId: memberIds[0],
            memberIds: JSON.stringify(memberIds),
            trainerId: req.user.role === 'trainer' ? req.user.id : (req.body.trainerId || null),
            name,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            meals: meals ? (typeof meals === 'string' ? meals : JSON.stringify(meals)) : null,
            gymId,
            branchId: req.user.branchId || (new Set(assignedMembers.map((item) => String(item.branchId || ''))).size === 1 ? member.branchId || null : null)
        });

        const Notification = require('../models/Notification');
        const recipients = await User.find({ memberId: { $in: memberIds } }).lean();
        await Promise.all(recipients.map((recipient) => Notification.create({ recipientId: recipient.id || recipient._id, gymId: member.gymId, type: 'plan_update', message: `A diet plan was added: ${name}.` })));

        res.status(201).json(plan);
    } catch (error) { next(error); }
});

// @desc    Get all diet plans
// @route   GET /api/diet-plans
// @access  Private/Admin/Trainer/Member
const getPlans = catchAsync(async (req, res, next) => {
    try {
        // Query by gymId so plans are accessible across all branches of the gym
        const { gymId, gymIds, isH4Scope } = getGymScope(req);
        let query = { gymId: isH4Scope ? { $in: gymIds } : gymId };

        if (req.query.branchId) {
            query.branchId = req.query.branchId;
        }

        // If member is fetching, only show their plans
        if (req.user.role === 'trainer') {
            query.trainerId = req.user.id;
        }

        if (req.user.role === 'member') {
            const memberId = String(req.user.memberId || '');
            query.$or = [{ memberId }, { memberIds: { $regex: `\"${memberId}\"` } }];
        } else if (req.query.memberId) {
            query.memberId = req.query.memberId;
        }

        // Strict pagination parameters with hard cap at 100
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
        const skip = (page - 1) * limit;

        const total = await DietPlan.countDocuments(query);
        const plans = await DietPlan.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Batched multi-entity lookup (Trainer + Member)
        const memberIds = [...new Set(plans.flatMap((p) => {
            try { return [...(p.memberIds ? JSON.parse(p.memberIds) : []), p.memberId].filter(Boolean).map(String); }
            catch (error) { return [p.memberId].filter(Boolean).map(String); }
        }))];
        const trainerIds = [...new Set(plans.map(p => p.trainerId).filter(Boolean))];

        const [members, trainers] = await Promise.all([
            memberIds.length > 0 ? Member.find({ _id: { $in: memberIds } }).select('id name phone email').lean() : [],
            trainerIds.length > 0 ? User.find({ _id: { $in: trainerIds } }).select('id name email role phone').lean() : []
        ]);

        const memberMap = new Map();
        (members || []).forEach((member) => {
            [member.id, member._id].filter(Boolean).forEach((id) => memberMap.set(String(id), member));
        });
        const trainerMap = new Map((trainers || []).map(t => [t._id ? t._id.toString() : t.id, t]));

        const formatted = plans.map(p => {
            let parsedMeals = p.meals;
            if (p.meals && typeof p.meals === 'string') {
                try {
                    parsedMeals = JSON.parse(p.meals);
                } catch (e) {}
            }
            let assignedMemberIds = [p.memberId].filter(Boolean).map(String);
            try { if (p.memberIds) assignedMemberIds = JSON.parse(p.memberIds).map(String); } catch (error) {}
            const assignedMembers = assignedMemberIds.map((id) => memberMap.get(String(id))).filter(Boolean);
            const m = assignedMembers.find((member) => String(member.id || member._id) === String(p.memberId)) || assignedMembers[0] || null;
            const t = p.trainerId ? trainerMap.get(p.trainerId.toString()) : null;

            return {
                ...p,
                meals: parsedMeals,
                memberIds: assignedMemberIds,
                members: assignedMembers.map((member) => ({ id: member.id || member._id, name: member.name, phone: member.phone, email: member.email })),
                member: m ? { id: m.id || m._id, name: m.name, phone: m.phone, email: m.email } : null,
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

// @desc    Get single diet plan
// @route   GET /api/diet-plans/:id
// @access  Private/Admin/Trainer/Member
const getPlanById = catchAsync(async (req, res, next) => {
    try {
        const { gymId, gymIds, isH4Scope } = getGymScope(req);
        const plan = await DietPlan.findOne({ _id: req.params.id, gymId: isH4Scope ? { $in: gymIds } : gymId });

        if (plan) {
            let assignedMemberIds = [plan.memberId].filter(Boolean).map(String);
            try { if (plan.memberIds) assignedMemberIds = JSON.parse(plan.memberIds).map(String); } catch (error) {}
            if (req.user.role === 'member' && !assignedMemberIds.includes(String(req.user.memberId))) {
                return res.status(403).json({ success: false, message: 'Not authorized to view this plan' });
            }

            if (plan.meals && typeof plan.meals === 'string') {
                try {
                    plan.meals = JSON.parse(plan.meals);
                } catch (e) {}
            }

            const memberObj = await Member.findOne({ _id: plan.memberId });
            const trainerObj = plan.trainerId ? await User.findOne({ _id: plan.trainerId }).select('-password') : null;

            res.json({
                ...plan,
                member: memberObj || null,
                trainer: trainerObj || null
            });
        } else {
            res.status(404).json({ success: false, message: 'Diet plan not found' });
        }
    } catch (error) { next(error); }
});

// @desc    Update diet plan
// @route   PUT /api/diet-plans/:id
// @access  Private/Admin/Trainer
const updatePlan = catchAsync(async (req, res, next) => {
    try {
        const { memberId, name, startDate, endDate, meals, trainerId } = req.body;

        const { gymId, gymIds, isH4Scope } = getGymScope(req);
        const plan = await DietPlan.findOne({ _id: req.params.id, gymId: isH4Scope ? { $in: gymIds } : gymId });

        if (plan) {
            let priorMemberIds = [plan.memberId].filter(Boolean).map(String);
            try { if (plan.memberIds) priorMemberIds = JSON.parse(plan.memberIds).map(String); } catch (error) {}
            if (memberId !== undefined || req.body.memberIds !== undefined) {
                const nextMemberIds = [...new Set((Array.isArray(req.body.memberIds) ? req.body.memberIds : [memberId]).filter(Boolean).map(String))];
                if (!nextMemberIds.length) return res.status(400).json({ success: false, message: 'At least one member must be assigned' });
                let currentMemberIds = [plan.memberId].filter(Boolean).map(String);
                try { if (plan.memberIds) currentMemberIds = JSON.parse(plan.memberIds).map(String); } catch (error) {}
                const { found: assignedMembers, valid } = await loadMembersForAssignment(
                    nextMemberIds, gymIds, req.user.branchId, currentMemberIds
                );
                if (valid.length !== nextMemberIds.length) return res.status(404).json({ success: false, message: 'One or more newly added members are outside this gym or branch' });
                plan.memberId = nextMemberIds[0];
                plan.memberIds = JSON.stringify(nextMemberIds);
                const branchIds = new Set(assignedMembers.map((item) => String(item.branchId || '')));
                plan.branchId = req.user.branchId || (branchIds.size === 1 ? assignedMembers[0].branchId || null : null);
            }
            plan.name = name || plan.name;
            if (startDate !== undefined) plan.startDate = startDate ? new Date(startDate) : null;
            if (endDate !== undefined) plan.endDate = endDate ? new Date(endDate) : null;
            if (meals !== undefined) {
                plan.meals = typeof meals === 'string' ? meals : JSON.stringify(meals);
            }
            if (trainerId !== undefined) plan.trainerId = trainerId || null;

            const updatedPlan = await plan.save();
            let assignedIds = [...new Set([...priorMemberIds, plan.memberId].filter(Boolean))];
            try { if (plan.memberIds) assignedIds = [...new Set([...assignedIds, ...JSON.parse(plan.memberIds).map(String)])]; } catch (error) {}
            const recipients = await User.find({ memberId: { $in: assignedIds } }).lean();
            await Promise.all(recipients.map((recipient) => require('../models/Notification').create({ recipientId: recipient.id || recipient._id, gymId: plan.gymId, type: 'plan_update', message: `Your diet plan "${updatedPlan.name}" was updated.` })));
            if (updatedPlan.meals && typeof updatedPlan.meals === 'string') {
                try {
                    updatedPlan.meals = JSON.parse(updatedPlan.meals);
                } catch (e) {}
            }
            res.json(updatedPlan);
        } else {
            res.status(404).json({ success: false, message: 'Diet plan not found' });
        }
    } catch (error) { next(error); }
});

// @desc    Delete diet plan
// @route   DELETE /api/diet-plans/:id
// @access  Private/Admin/Trainer
const deletePlan = catchAsync(async (req, res, next) => {
    try {
        const { gymId, gymIds, isH4Scope } = getGymScope(req);
        const plan = await DietPlan.findOne({ _id: req.params.id, gymId: isH4Scope ? { $in: gymIds } : gymId });

        if (plan) {
            let assignedIds = [plan.memberId];
            try { if (plan.memberIds) assignedIds = JSON.parse(plan.memberIds); } catch (error) {}
            const planName = plan.name;
            const gymId = plan.gymId;
            await plan.deleteOne();
            const recipients = await User.find({ memberId: { $in: assignedIds } }).lean();
            await Promise.all(recipients.map((recipient) => require('../models/Notification').create({ recipientId: recipient.id || recipient._id, gymId, type: 'plan_update', message: `Your diet plan "${planName}" was removed.` })));
            res.json({ message: 'Diet plan removed' });
        } else {
            res.status(404).json({ success: false, message: 'Diet plan not found' });
        }
    } catch (error) { next(error); }
});

// @desc    Log a completed daily nutrition & hydration goal for member (notifies coach & admin)
// @route   POST /api/diet-plans/log
// @access  Private/Member/Trainer
const logCompletedNutrition = catchAsync(async (req, res, next) => {
    try {
        const { planId, calories, protein, waterCups, notes } = req.body;
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

        let planName = 'Daily Nutrition & Hydration';
        let trainerId = null;

        if (planId) {
            const plan = await DietPlan.findOne({ _id: planId, gymId });
            if (plan) {
                planName = plan.name || planName;
                trainerId = plan.trainerId || null;
            }
        }

        const detailsText = `Member ${memberName || 'Athlete'} logged daily nutrition target: "${planName}" (${calories || 0} kcal, ${protein || 0}g protein, ${waterCups || 0}/12 water glasses). ${notes ? 'Notes: ' + notes : ''}`;

        // Create Audit Log entry for Coach & Admin
        await AuditLog.create({
            gymId: gymId || H4_GYM_IDS[1],
            userId: req.user?.id || req.user?._id || null,
            userName: memberName || req.user?.name || 'Member',
            userEmail: req.user?.email || '',
            userRole: 'member',
            action: 'NUTRITION_COMPLETED',
            entity: 'DietPlan',
            entityId: planId || '',
            entityName: planName,
            details: detailsText
        }).catch(() => null);

        if (trainerId) {
            await Notification.create({
                recipientId: trainerId,
                gymId: gymId || H4_GYM_IDS[1],
                type: 'NUTRITION_LOGGED',
                message: `${memberName || 'Your member'} hit their nutrition & hydration goal for "${planName}"!`,
                read: false
            }).catch(() => null);
        }

        res.status(200).json({
            success: true,
            message: '🎉 Daily nutrition & hydration goals logged! Admin & Coach notified.',
            completedAt: new Date().toISOString()
        });
    } catch (error) { next(error); }
});

module.exports = {
    createPlan,
    getPlans,
    getPlanById,
    updatePlan,
    deletePlan,
    logCompletedNutrition
};

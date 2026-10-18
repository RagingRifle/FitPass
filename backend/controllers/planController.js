const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Plan = require('../models/Plan');
const { logAudit } = require('../utils/auditLogger');
const { H4_GYM_IDS } = require('../config/constants');

const getPlanScope = (req) => {
    const currentGymId = String(req.user?.gymId || '');
    const where = { gymId: req.user?.role === 'h4_admin'
        ? { $in: [...new Set([...H4_GYM_IDS, currentGymId].filter(Boolean))] }
        : currentGymId };
    if (req.user?.branchId) where.$or = [{ branchId: req.user.branchId }, { branchId: null }];
    return where;
};

// @desc    Create a new plan (traditional gym membership plan)
// @route   POST /api/plans
// @access  Private/Admin
const createPlan = catchAsync(async (req, res, next) => {
    try {
        const { name, duration, price } = req.body;

        if (req.user.role === 'fitpass_admin') {
            return res.status(403).json({ success: false, message: 'FitPass session plans are managed from FitPass Plans.' });
        }

        if (!name || duration === undefined || price === undefined) {
            res.status(400);
            return res.json({ success: false, message: 'Name, duration, and price are required' });
        }

        const gymId = String(req.user.gymId || '');
        if (!gymId || gymId === 'SYSTEM') {
            return res.status(400).json({ success: false, message: 'Select an H4 or partner gym before creating a gym membership plan. FitPass session plans use the FitPass plans section.' });
        }

        const plan = await Plan.create({
            name,
            duration: Number(duration),
            price: Number(price),
            gymId,
            branchId: req.user.branchId || null
        });

        if (plan) {
            await logAudit(req, 'PLAN_CREATED', 'Plan', plan._id, `Created plan: ${name}`, name);
            res.status(201).json(plan);
        } else {
            res.status(400).json({ success: false, message: 'Invalid plan data' });
        }
    } catch (error) { next(error); }
});

// @desc    Get gym membership plans for the current gym/division
// @route   GET /api/plans
// @access  Private/Admin
const getPlans = catchAsync(async (req, res, next) => {
    try {
        const currentGymId = String(req.user.gymId || '');
        const isH4Scope = req.user.role === 'h4_admin' || H4_GYM_IDS.includes(currentGymId);
        let query;
        if (isH4Scope) {
            query = { $or: [
                { gymId: { $in: [...new Set([...H4_GYM_IDS, currentGymId].filter(Boolean))] } },
                // Legacy H4 duration plans were sometimes saved under SYSTEM.
                // FitPass catalogs filter for positive session counts, so only
                // these old non-session plans appear in the H4 management UI.
                { gymId: 'SYSTEM', sessions: { $in: [null, 0] } },
            ] };
            const branchId = req.tenantFilter?.branchId || req.user.branchId;
            if (branchId) query = { $and: [query, { $or: [{ branchId }, { branchId: null }] }] };
        } else if (req.user.role === 'superadmin') {
            // Super admins must choose a gym; the unscoped plan catalog must
            // never mix FitPass and H4 subscriptions together.
            query = req.tenantFilter?.gymId ? { gymId: req.tenantFilter.gymId } : { gymId: '__NO_GYM_SELECTED__' };
        } else if (currentGymId && currentGymId !== 'SYSTEM') {
            query = { gymId: currentGymId };
            const branchId = req.tenantFilter?.branchId || req.user.branchId;
            if (branchId) query.$or = [{ branchId }, { branchId: null }];
        } else {
            // FitPass global session tiers are managed through /superadmin/plans
            // and offered to members through /member-portal/fitprime-plans.
            query = { gymId: '__NO_GYM_SELECTED__' };
        }
        const plans = await Plan.find(query).lean();
        res.json(plans);
    } catch (error) { next(error); }
});

// @desc    Get single plan
// @route   GET /api/plans/:id
// @access  Private/Admin
const getPlanById = catchAsync(async (req, res, next) => {
    try {
        if (!req.user.gymId || req.user.gymId === 'SYSTEM') return res.status(404).json({ success: false, message: 'Gym membership plan not found. FitPass plans are managed in the FitPass plans section.' });
        const query = { _id: req.params.id, ...getPlanScope(req) };
        const plan = await Plan.findOne(query);

        if (plan) {
            res.json(plan);
        } else {
            res.status(404).json({ success: false, message: 'Plan not found' });
        }
    } catch (error) { next(error); }
});

// @desc    Update plan
// @route   PUT /api/plans/:id
// @access  Private/Admin
const updatePlan = catchAsync(async (req, res, next) => {
    try {
        if (!req.user.gymId || req.user.gymId === 'SYSTEM') return res.status(404).json({ success: false, message: 'Gym membership plan not found. FitPass plans are managed in the FitPass plans section.' });
        const { name, duration, price } = req.body;

        const query = { _id: req.params.id, ...getPlanScope(req) };
        const plan = await Plan.findOne(query);

        if (plan) {
            plan.name = name || plan.name;
            if (duration !== undefined && duration !== '') {
                plan.duration = Number(duration);
            }
            if (price !== undefined && price !== '') {
                plan.price = Number(price);
            }

            const updatedPlan = await plan.save();
            await logAudit(req, 'PLAN_UPDATED', 'Plan', plan._id, `Updated plan: ${updatedPlan.name}`, updatedPlan.name);
            res.json(updatedPlan);
        } else {
            res.status(404).json({ success: false, message: 'Plan not found' });
        }
    } catch (error) { next(error); }
});

// @desc    Delete plan
// @route   DELETE /api/plans/:id
// @access  Private/Admin
const deletePlan = catchAsync(async (req, res, next) => {
    try {
        if (!req.user.gymId || req.user.gymId === 'SYSTEM') return res.status(404).json({ success: false, message: 'Gym membership plan not found. FitPass plans are managed in the FitPass plans section.' });
        const query = { _id: req.params.id, ...getPlanScope(req) };
        const plan = await Plan.findOne(query);

        if (plan) {
            await logAudit(req, 'PLAN_DELETED', 'Plan', plan._id, `Deleted plan: ${plan.name}`, plan.name);
            await plan.deleteOne();
            res.json({ message: 'Plan removed' });
        } else {
            res.status(404).json({ success: false, message: 'Plan not found' });
        }
    } catch (error) { next(error); }
});

module.exports = {
    createPlan,
    getPlans,
    getPlanById,
    updatePlan,
    deletePlan,
};

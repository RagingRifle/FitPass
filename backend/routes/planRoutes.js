const express = require('express');
const router = express.Router();
const {
    createPlan,
    getPlans,
    getPlanById,
    updatePlan,
    deletePlan,
} = require('../controllers/planController');
const { protect, authorize } = require('../middleware/authMiddleware');
const tenantFilter = require('../middleware/tenantFilter');
const validate = require('../middleware/validate');
const { z } = require('zod');

const createPlanSchema = z.object({
    name: z.string().min(1, 'Plan name is required').max(100),
    duration: z.coerce.number().min(0, 'Duration cannot be negative'),
    price: z.coerce.number().min(0, 'Price cannot be negative'),
    description: z.string().optional(),
    sessions: z.coerce.number().optional()
});

const updatePlanSchema = createPlanSchema.partial();

router.route('/')
    .get(protect, authorize('admin', 'receptionist', 'trainer', 'superadmin', 'h4_admin', 'fitpass_admin'), tenantFilter, getPlans)
    .post(protect, authorize('admin', 'h4_admin', 'superadmin', 'fitpass_admin'), tenantFilter, validate({ body: createPlanSchema }), createPlan);

router.route('/:id')
    .get(protect, authorize('admin', 'receptionist', 'trainer', 'superadmin', 'h4_admin', 'fitpass_admin'), tenantFilter, getPlanById)
    .put(protect, authorize('admin', 'h4_admin', 'superadmin', 'fitpass_admin'), tenantFilter, validate({ body: updatePlanSchema }), updatePlan)
    .delete(protect, authorize('admin', 'h4_admin', 'superadmin', 'fitpass_admin'), tenantFilter, deletePlan);

module.exports = router;

const express = require('express');
const router = express.Router();
const {
    createPlan,
    getPlans,
    getPlanById,
    updatePlan,
    deletePlan,
} = require('../controllers/dietPlanController');
const { createNutritionLog, getNutritionLogs } = require('../controllers/progressLogController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/logs', protect, authorize('admin', 'h4_admin', 'trainer', 'member', 'superadmin'), getNutritionLogs);
router.post('/log', protect, authorize('admin', 'h4_admin', 'trainer', 'member', 'superadmin'), createNutritionLog);

router.route('/')
    .get(protect, authorize('admin', 'h4_admin', 'receptionist', 'trainer', 'member'), getPlans)
    .post(protect, authorize('admin', 'h4_admin', 'trainer'), createPlan);

router.route('/:id')
    .get(protect, authorize('admin', 'h4_admin', 'receptionist', 'trainer', 'member'), getPlanById)
    .put(protect, authorize('admin', 'h4_admin', 'trainer'), updatePlan)
    .delete(protect, authorize('admin', 'h4_admin', 'trainer'), deletePlan);

module.exports = router;

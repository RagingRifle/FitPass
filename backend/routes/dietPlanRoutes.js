const express = require('express');
const router = express.Router();
const {
    createPlan,
    getPlans,
    getPlanById,
    updatePlan,
    deletePlan,
    logCompletedNutrition
} = require('../controllers/dietPlanController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/log', protect, logCompletedNutrition);

router.route('/')
    .get(protect, authorize('admin', 'h4_admin', 'receptionist', 'trainer', 'member'), getPlans)
    .post(protect, authorize('admin', 'h4_admin', 'trainer'), createPlan);

router.route('/:id')
    .get(protect, authorize('admin', 'h4_admin', 'receptionist', 'trainer', 'member'), getPlanById)
    .put(protect, authorize('admin', 'h4_admin', 'trainer'), updatePlan)
    .delete(protect, authorize('admin', 'h4_admin', 'trainer'), deletePlan);

module.exports = router;

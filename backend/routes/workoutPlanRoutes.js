const express = require('express');
const router = express.Router();
const {
    getAssignableMembers,
    createPlan,
    getPlans,
    getPlanById,
    updatePlan,
    deletePlan
} = require('../controllers/workoutPlanController');
const { createWorkoutLog, getWorkoutLogs } = require('../controllers/progressLogController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/logs', protect, authorize('admin', 'h4_admin', 'trainer', 'member', 'superadmin'), getWorkoutLogs);
router.post('/log', protect, authorize('admin', 'h4_admin', 'trainer', 'member', 'superadmin'), createWorkoutLog);

router.route('/')
    .get(protect, authorize('admin', 'h4_admin', 'receptionist', 'trainer', 'member'), getPlans)
    .post(protect, authorize('admin', 'h4_admin', 'trainer'), createPlan);

router.get('/assignable-members', protect, authorize('admin', 'h4_admin', 'trainer'), getAssignableMembers);

router.route('/:id')
    .get(protect, authorize('admin', 'h4_admin', 'receptionist', 'trainer', 'member'), getPlanById)
    .put(protect, authorize('admin', 'h4_admin', 'trainer'), updatePlan)
    .delete(protect, authorize('admin', 'h4_admin', 'trainer'), deletePlan);

module.exports = router;

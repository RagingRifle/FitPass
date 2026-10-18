const express = require('express');
const router = express.Router();
const {
    getAssignableMembers,
    createPlan,
    getPlans,
    getPlanById,
    updatePlan,
    deletePlan,
    logCompletedWorkout
} = require('../controllers/workoutPlanController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/log', protect, logCompletedWorkout);

router.route('/')
    .get(protect, authorize('admin', 'h4_admin', 'receptionist', 'trainer', 'member'), getPlans)
    .post(protect, authorize('admin', 'h4_admin', 'trainer'), createPlan);

router.get('/assignable-members', protect, authorize('admin', 'h4_admin', 'trainer'), getAssignableMembers);

router.route('/:id')
    .get(protect, authorize('admin', 'h4_admin', 'receptionist', 'trainer', 'member'), getPlanById)
    .put(protect, authorize('admin', 'h4_admin', 'trainer'), updatePlan)
    .delete(protect, authorize('admin', 'h4_admin', 'trainer'), deletePlan);

module.exports = router;

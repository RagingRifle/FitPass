const express = require('express');
const router = express.Router();
const {
    assignTrainer,
    getAssignments,
    removeAssignment
} = require('../controllers/memberTrainerAssignmentController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, authorize('admin', 'receptionist', 'trainer', 'h4_admin', 'fitpass_admin'), getAssignments)
    .post(protect, authorize('admin', 'h4_admin', 'fitpass_admin'), assignTrainer);

router.route('/:id')
    .delete(protect, authorize('admin', 'h4_admin', 'fitpass_admin'), removeAssignment);

module.exports = router;

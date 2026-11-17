const express = require('express');
const router = express.Router();
const {
    assignTrainer,
    getAssignments,
    removeAssignment
} = require('../controllers/memberTrainerAssignmentController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, authorize('admin', 'receptionist', 'trainer', 'partner', 'h4_admin', 'fitpass_admin'), getAssignments)
    .post(protect, authorize('admin', 'partner', 'h4_admin', 'fitpass_admin'), assignTrainer);

router.route('/:id')
    .delete(protect, authorize('admin', 'partner', 'h4_admin', 'fitpass_admin'), removeAssignment);

module.exports = router;

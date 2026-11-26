const express = require('express');
const router = express.Router();
const {
    checkInTrainer,
    checkOutTrainer,
    getTrainerAttendance,
    getMyTrainerConfig,
    markTrainerLeave,
    getTrainerLeaveRequests,
    createTrainerLeaveRequest,
    reviewTrainerLeaveRequest
} = require('../controllers/trainerAttendanceController');
const { protect, authorize } = require('../middleware/authMiddleware');
const tenantFilter = require('../middleware/tenantFilter');

router.route('/')
    .get(protect, authorize('admin', 'receptionist', 'trainer', 'h4_admin', 'h4_branch_admin'), tenantFilter, getTrainerAttendance);
router.get('/config', protect, authorize('trainer'), getMyTrainerConfig);

router.post('/checkin', protect, authorize('admin', 'receptionist', 'trainer', 'h4_admin', 'h4_branch_admin'), checkInTrainer);
router.post('/checkout', protect, authorize('admin', 'receptionist', 'trainer', 'h4_admin', 'h4_branch_admin'), checkOutTrainer);
router.post('/leave', protect, authorize('admin', 'h4_admin', 'h4_branch_admin'), tenantFilter, markTrainerLeave);
router.route('/leave-requests')
    .get(protect, authorize('admin', 'receptionist', 'trainer', 'h4_admin', 'h4_branch_admin'), tenantFilter, getTrainerLeaveRequests)
    .post(protect, authorize('trainer'), tenantFilter, createTrainerLeaveRequest);
router.patch('/leave-requests/:id', protect, authorize('admin', 'h4_admin', 'h4_branch_admin'), tenantFilter, reviewTrainerLeaveRequest);

module.exports = router;

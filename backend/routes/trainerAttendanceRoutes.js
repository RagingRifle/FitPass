const express = require('express');
const router = express.Router();
const {
    checkInTrainer,
    checkOutTrainer,
    getTrainerAttendance,
    markTrainerLeave
} = require('../controllers/trainerAttendanceController');
const { protect, authorize } = require('../middleware/authMiddleware');
const tenantFilter = require('../middleware/tenantFilter');

router.route('/')
    .get(protect, authorize('admin', 'receptionist', 'trainer', 'h4_admin'), tenantFilter, getTrainerAttendance);

router.post('/checkin', protect, authorize('admin', 'receptionist', 'trainer', 'h4_admin'), checkInTrainer);
router.post('/checkout', protect, authorize('admin', 'receptionist', 'trainer', 'h4_admin'), checkOutTrainer);
router.post('/leave', protect, authorize('admin', 'h4_admin'), tenantFilter, markTrainerLeave);

module.exports = router;

const express = require('express');
const router = express.Router();
const { 
    getClasses, 
    createClass, 
    deleteClass, 
    getClassBookings, 
    adminBookClass, 
    adminCancelBooking,
    verifyClassAttendee,
    toggleAttendeeStatus
} = require('../controllers/classController');
const { protect, authorize } = require('../middleware/authMiddleware');
const tenantFilter = require('../middleware/tenantFilter');
const validate = require('../middleware/validate');
const { z } = require('zod');

const createClassSchema = z.object({
    name: z.string().min(1, 'Class name is required').max(100),
    type: z.string().min(1, 'Class type is required'),
    description: z.string().optional(),
    trainerName: z.string().optional(),
    scheduleDate: z.string().min(1, 'Schedule date is required'),
    recurrence: z.enum(['none', 'weekly']).optional(),
    repeatUntil: z.string().optional(),
    startTime: z.string().min(1, 'Start time is required'),
    endTime: z.string().min(1, 'End time is required'),
    maxSeats: z.coerce.number().min(1, 'Capacity must be at least 1'),
    bookingDeadline: z.string().optional(),
    isAddOn: z.boolean().optional(),
    priceCoins: z.coerce.number().int().min(0).max(100000).optional(),
    branchId: z.string().optional().nullable(),
    branchIds: z.array(z.string()).optional(),
    gymId: z.string().optional()
});

const bookClassSchema = z.object({
    memberId: z.string().min(1, 'Member ID is required')
});

router.route('/')
    .get(protect, authorize('superadmin', 'fitpass_admin', 'admin', 'trainer', 'receptionist', 'h4_admin', 'h4_branch_admin'), tenantFilter, getClasses)
    .post(protect, authorize('superadmin', 'fitpass_admin', 'admin', 'trainer', 'h4_admin', 'h4_branch_admin'), validate({ body: createClassSchema }), createClass);

router.delete('/:id', protect, authorize('superadmin', 'fitpass_admin', 'admin', 'h4_admin', 'h4_branch_admin'), deleteClass);
router.get('/:id/bookings', protect, authorize('superadmin', 'fitpass_admin', 'admin', 'trainer', 'receptionist', 'h4_admin', 'h4_branch_admin'), getClassBookings);
router.post('/:id/book', protect, authorize('superadmin', 'fitpass_admin', 'admin', 'trainer', 'receptionist', 'h4_admin', 'h4_branch_admin'), validate({ body: bookClassSchema }), adminBookClass);
router.delete('/:id/bookings/:memberId', protect, authorize('superadmin', 'fitpass_admin', 'admin', 'trainer', 'receptionist', 'h4_admin', 'h4_branch_admin'), adminCancelBooking);

// Attendee verification via QR scan or manual roster toggle
router.post('/:id/verify-attendee', protect, authorize('superadmin', 'fitpass_admin', 'admin', 'trainer', 'receptionist', 'h4_admin', 'h4_branch_admin'), verifyClassAttendee);
router.put('/:id/attendees/:memberId', protect, authorize('superadmin', 'fitpass_admin', 'admin', 'trainer', 'receptionist', 'h4_admin', 'h4_branch_admin'), toggleAttendeeStatus);

module.exports = router;

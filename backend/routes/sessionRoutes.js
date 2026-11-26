const express = require('express');
const { z } = require('zod');
const { 
  adminAdjustSessions, 
  adminAdjustSchema,
  getMemberFitPassSummary,
  getFitPassAnalytics,
  getPartnerVisitLog,
} = require('../controllers/sessionController');
const { protect, authorize } = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');

const router = express.Router();

// Manual session adjustment (Admin, Receptionist)
router.post(
  '/admin-adjust',
  protect,
  authorize('admin', 'receptionist', 'h4_admin'),
  validate({ body: adminAdjustSchema }),
  adminAdjustSessions
);

// Get member summary (Admin, Partner, SuperAdmin)
router.get(
  '/member-summary/:memberId',
  protect,
  authorize('admin', 'superadmin', 'fitpass_admin'),
  getMemberFitPassSummary
);

// Get FitPass global analytics (Admin, SuperAdmin, FitPass Admin only — NOT partner)
router.get(
  '/analytics',
  protect,
  authorize('admin', 'superadmin', 'fitpass_admin', 'h4_admin'),
  getFitPassAnalytics
);

// Get FitPass check-in audit log for partner's own gym (read-only, scoped by gymId)
router.get(
  '/partner-visits',
  protect,
  authorize('partner'),
  getPartnerVisitLog
);

// Zod schema reused by memberPortalRoutes.js for the check-in body.
const checkInSchema = z.object({
  gymId: z.string().min(1, 'Gym id from the QR code is required'),
  branchId: z.string().optional(),
  deviceInfo: z.string().optional(),
});

module.exports = router;
module.exports.checkInSchema = checkInSchema;

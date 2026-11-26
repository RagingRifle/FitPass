const express = require('express');
const router = express.Router();
const { getDashboardStats, getHistory } = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/authMiddleware');
const tenantFilter = require('../middleware/tenantFilter');

router.get('/stats', protect, authorize('admin', 'superadmin', 'fitpass_admin', 'h4_admin', 'h4_branch_admin'), tenantFilter, getDashboardStats);
router.get('/history', protect, authorize('admin', 'superadmin', 'fitpass_admin', 'h4_admin', 'h4_branch_admin'), tenantFilter, getHistory);

module.exports = router;

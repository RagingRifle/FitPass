const express = require('express');
const router = express.Router();
const { getAnalytics } = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/authMiddleware');
const tenantFilter = require('../middleware/tenantFilter');

router.get('/', protect, authorize('admin', 'h4_admin', 'h4_branch_admin', 'superadmin', 'fitpass_admin'), tenantFilter, getAnalytics);

module.exports = router;

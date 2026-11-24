const express = require('express');
const { protect, authorize } = require('../middleware/authMiddleware');
const tenantFilter = require('../middleware/tenantFilter');
const { listCoupons, createCoupon, deactivateCoupon } = require('../controllers/h4TrialController');

const router = express.Router();
router.use(protect, authorize('h4_admin', 'admin'), tenantFilter);
router.get('/', listCoupons);
router.post('/', createCoupon);
router.patch('/:id/deactivate', deactivateCoupon);
module.exports = router;

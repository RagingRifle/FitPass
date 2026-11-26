const express = require('express');
const router = express.Router();
const { getRevenueReport, getExpenseReport, getReportSummary } = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);
router.use(authorize('admin', 'h4_admin', 'h4_branch_admin'));

router.get('/revenue', getRevenueReport);
router.get('/expenses', getExpenseReport);
router.get('/summary', getReportSummary);

module.exports = router;

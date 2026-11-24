const express = require('express');
const router = express.Router();
const {
    upsertSalaryStructure,
    getSalaryStructure,
    generateMonthlyPayroll,
    getPayrolls,
    getTrainerPerformance,
    updatePayrollStatus,
    addCommission
} = require('../controllers/payrollController');
const { protect, authorize } = require('../middleware/authMiddleware');
const tenantFilter = require('../middleware/tenantFilter');

router.route('/')
    .get(protect, authorize('admin', 'trainer', 'h4_admin'), tenantFilter, getPayrolls);

router.post('/generate', protect, authorize('admin', 'h4_admin'), generateMonthlyPayroll);
router.get('/performance', protect, authorize('trainer'), getTrainerPerformance);
router.post('/salary-structure', protect, authorize('admin', 'h4_admin'), upsertSalaryStructure);
router.get('/salary-structure/:trainerId', protect, authorize('admin', 'trainer', 'h4_admin'), getSalaryStructure);
router.post('/commission', protect, authorize('admin', 'h4_admin'), addCommission);
router.put('/:id', protect, authorize('admin', 'h4_admin'), updatePayrollStatus);

module.exports = router;

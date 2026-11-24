const express = require('express');
const router = express.Router();
const {
    getStaff,
    createStaff,
    updateStaff,
    deleteStaff
} = require('../controllers/staffController');
const { protect, authorize } = require('../middleware/authMiddleware');
const tenantFilter = require('../middleware/tenantFilter');

router.route('/')
    .get(protect, authorize('admin', 'receptionist', 'h4_admin', 'partner', 'superadmin'), tenantFilter, getStaff)
    .post(protect, authorize('admin', 'h4_admin', 'partner', 'superadmin'), tenantFilter, createStaff);

router.route('/:id')
    .put(protect, authorize('admin', 'h4_admin', 'partner', 'superadmin'), tenantFilter, updateStaff)
    .delete(protect, authorize('admin', 'h4_admin', 'partner', 'superadmin'), tenantFilter, deleteStaff);

module.exports = router;

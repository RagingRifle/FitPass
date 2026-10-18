const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { createTemplate, getTemplates, updateTemplate, deleteTemplate } = require('../controllers/dietTemplateController');

router.route('/')
    .get(protect, authorize('admin', 'h4_admin', 'trainer', 'superadmin'), getTemplates)
    .post(protect, authorize('admin', 'h4_admin', 'trainer', 'superadmin'), createTemplate);
router.route('/:id')
    .put(protect, authorize('admin', 'h4_admin', 'trainer', 'superadmin'), updateTemplate)
    .delete(protect, authorize('admin', 'h4_admin', 'trainer', 'superadmin'), deleteTemplate);

module.exports = router;

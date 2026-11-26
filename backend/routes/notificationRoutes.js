const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead, createAnnouncement, getReminderSettings, updateReminderSettings } = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', getNotifications);
router.get('/reminder-settings', authorize('h4_admin', 'h4_branch_admin', 'superadmin'), getReminderSettings);
router.put('/reminder-settings', authorize('h4_admin', 'h4_branch_admin', 'superadmin'), updateReminderSettings);
router.put('/:id', markAsRead);
router.post('/announcement', authorize('admin'), createAnnouncement);

module.exports = router;

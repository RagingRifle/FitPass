const express = require('express');
const router = express.Router();
const {
    getNotifications,
    markAsRead,
    deleteNotification,
    clearNotifications,
    createAnnouncement,
    getReminderSettings,
    updateReminderSettings,
    previewCustomNotificationRecipients,
    sendCustomNotification,
} = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/authMiddleware');
const tenantFilter = require('../middleware/tenantFilter');

router.use(protect);

router.get('/', getNotifications);
router.get('/reminder-settings', authorize('h4_admin', 'h4_branch_admin', 'superadmin'), getReminderSettings);
router.put('/reminder-settings', authorize('h4_admin', 'h4_branch_admin', 'superadmin'), updateReminderSettings);
router.post('/custom/preview', authorize('h4_admin', 'h4_branch_admin', 'admin', 'superadmin'), tenantFilter, previewCustomNotificationRecipients);
router.post('/custom/send', authorize('h4_admin', 'h4_branch_admin', 'admin', 'superadmin'), tenantFilter, sendCustomNotification);
router.delete('/clear', clearNotifications);
router.put('/:id', markAsRead);
router.delete('/:id', deleteNotification);
router.post('/announcement', authorize('admin'), createAnnouncement);

module.exports = router;

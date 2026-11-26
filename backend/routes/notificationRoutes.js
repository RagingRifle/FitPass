const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead, createAnnouncement, getReminderSettings, updateReminderSettings } = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

const denyH4BranchAdmin = (req, res, next) => {
    if (req.user.role === 'h4_branch_admin' || req.user.role === 'h4_admin' && req.user.branchId) {
        res.status(403);
        return next(new Error('Reminder settings are available to overall administrators only.'));
    }
    return next();
};
router.get('/', getNotifications);
router.get('/reminder-settings', authorize('h4_admin', 'superadmin'), denyH4BranchAdmin, getReminderSettings);
router.put('/reminder-settings', authorize('h4_admin', 'superadmin'), denyH4BranchAdmin, updateReminderSettings);
router.put('/:id', markAsRead);
router.post('/announcement', authorize('admin'), createAnnouncement);

module.exports = router;

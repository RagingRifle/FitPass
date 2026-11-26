const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams to access :id from parent
const { freezeMember, unfreezeMember, getFreezeHistory } = require('../controllers/freezeController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/freeze', protect, authorize('admin', 'receptionist', 'h4_admin', 'h4_branch_admin'), freezeMember);
router.post('/unfreeze', protect, authorize('admin', 'receptionist', 'h4_admin', 'h4_branch_admin'), unfreezeMember);
router.get('/freeze-history', protect, authorize('admin', 'receptionist', 'h4_admin', 'h4_branch_admin'), getFreezeHistory);

module.exports = router;

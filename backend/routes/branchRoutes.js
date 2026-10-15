const express = require('express');
const router = express.Router();
const { getPublicBranches, getBranches, createBranch, updateBranch, deleteBranch, getBranchMembers } = require('../controllers/branchController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/public', getPublicBranches);
router.use(protect);
router.route('/')
    .get(authorize('admin', 'receptionist', 'trainer', 'superadmin', 'fitpass_admin', 'h4_admin', 'partner'), getBranches)
    .post(authorize('admin', 'fitpass_admin', 'h4_admin', 'partner', 'superadmin'), createBranch);

router.route('/:id')
    .put(authorize('admin', 'fitpass_admin', 'h4_admin', 'partner', 'superadmin'), updateBranch)
    .delete(authorize('admin', 'fitpass_admin', 'h4_admin', 'partner', 'superadmin'), deleteBranch);

router.get('/:id/members', authorize('admin', 'receptionist', 'trainer', 'superadmin', 'fitpass_admin', 'h4_admin', 'partner'), getBranchMembers);

module.exports = router;

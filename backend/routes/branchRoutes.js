const express = require('express');
const router = express.Router();
const { getPublicBranches, getBranches, createBranch, updateBranch, deleteBranch, getBranchMembers } = require('../controllers/branchController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/public', getPublicBranches);
router.use(protect);
const denyBranchScopedManagement = (req, res, next) => {
    if (req.user.role === 'h4_admin' && req.user.userBranchId) {
        res.status(403);
        return next(new Error('Branch admins cannot manage the H4 branch directory.'));
    }
    return next();
};
router.route('/')
    .get(authorize('admin', 'receptionist', 'trainer', 'superadmin', 'fitpass_admin', 'h4_admin', 'partner'), getBranches)
    .post(authorize('admin', 'fitpass_admin', 'h4_admin', 'partner', 'superadmin'), denyBranchScopedManagement, createBranch);

router.route('/:id')
    .put(authorize('admin', 'fitpass_admin', 'h4_admin', 'partner', 'superadmin'), denyBranchScopedManagement, updateBranch)
    .delete(authorize('admin', 'fitpass_admin', 'h4_admin', 'partner', 'superadmin'), denyBranchScopedManagement, deleteBranch);

router.get('/:id/members', authorize('admin', 'receptionist', 'trainer', 'superadmin', 'fitpass_admin', 'h4_admin', 'partner'), getBranchMembers);

module.exports = router;

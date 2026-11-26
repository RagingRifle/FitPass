const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const {
    getPublicGyms,
    getPublicGymDetails,
    getPublicPostsFeed,
    getMyGymProfile,
    updateMyGymProfile,
    uploadGymProfileImage,
    getMyGymPosts,
    createMyGymPost,
    updateMyGymPost,
    deleteMyGymPost,
    getAdminApprovalQueue,
    reviewProfileStatus,
    reviewPostStatus,
    getDiscoveryAnalytics
} = require('../controllers/discoveryController');

// Public / Member discovery routes
router.get('/gyms', getPublicGyms);
router.get('/gyms/:gymId', getPublicGymDetails);
router.get('/posts', getPublicPostsFeed);

// Partner Gym Admin profile & post management
router.get('/my-profile', protect, authorize('admin', 'superadmin', 'h4_admin'), getMyGymProfile);
router.put('/my-profile', protect, authorize('admin', 'superadmin', 'h4_admin'), updateMyGymProfile);
router.post('/my-profile/image', protect, authorize('admin', 'superadmin', 'h4_admin'), upload.single('image'), uploadGymProfileImage);
router.post('/profiles/:gymId/image', protect, authorize('superadmin', 'fitpass_admin', 'admin'), upload.single('image'), uploadGymProfileImage);

router.get('/my-posts', protect, authorize('admin', 'superadmin', 'h4_admin'), getMyGymPosts);
router.post('/my-posts', protect, authorize('admin', 'superadmin', 'h4_admin'), createMyGymPost);
router.put('/my-posts/:postId', protect, authorize('admin', 'superadmin', 'h4_admin'), updateMyGymPost);
router.delete('/my-posts/:postId', protect, authorize('admin', 'superadmin', 'h4_admin'), deleteMyGymPost);

// Division-wide approval workflow; branch administrators only manage their own branch.
const denyH4BranchAdmin = (req, res, next) => {
    if (req.user.role === 'h4_branch_admin' || req.user.role === 'h4_admin' && req.user.branchId) {
        res.status(403);
        return next(new Error('Only overall administrators can review division-wide content.'));
    }
    return next();
};
router.get('/admin/approval-queue', protect, authorize('superadmin', 'fitpass_admin', 'h4_admin'), denyH4BranchAdmin, getAdminApprovalQueue);
router.patch('/admin/profiles/:gymId/status', protect, authorize('superadmin', 'fitpass_admin', 'h4_admin'), denyH4BranchAdmin, reviewProfileStatus);
router.patch('/admin/posts/:postId/status', protect, authorize('superadmin', 'fitpass_admin', 'h4_admin'), denyH4BranchAdmin, reviewPostStatus);

// Analytics
router.get('/analytics', protect, authorize('admin', 'superadmin', 'fitpass_admin', 'h4_admin'), getDiscoveryAnalytics);

module.exports = router;

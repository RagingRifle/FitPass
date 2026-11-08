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

// FitPass Admin / SuperAdmin approval workflow routes
router.get('/admin/approval-queue', protect, authorize('superadmin', 'fitpass_admin', 'h4_admin'), getAdminApprovalQueue);
router.patch('/admin/profiles/:gymId/status', protect, authorize('superadmin', 'fitpass_admin', 'h4_admin'), reviewProfileStatus);
router.patch('/admin/posts/:postId/status', protect, authorize('superadmin', 'fitpass_admin', 'h4_admin'), reviewPostStatus);

// Analytics
router.get('/analytics', protect, authorize('admin', 'superadmin', 'fitpass_admin', 'h4_admin'), getDiscoveryAnalytics);

module.exports = router;

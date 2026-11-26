const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { getGyms, getGymById, uploadGymImages, getPartneredGyms, updateGymImages, getGymSettings, updateGymSettings } = require('../controllers/gymController');

// Protected route to get all gyms (or gym profile for current gym)
router.get('/', protect, getGyms);

// Public route to get all partnered gyms
router.get('/partnered', getPartneredGyms);

// Public route to get gym details by ID
router.get('/:id', getGymById);

// Protected route for gym admins to upload images (max 4 at once)
router.post('/images', protect, authorize('admin'), upload.array('images', 4), uploadGymImages);

// Protected route for gym admins to reorder or delete images
router.put('/images', protect, authorize('admin'), updateGymImages);

// Protected routes for gym settings
const denyH4BranchAdmin = (req, res, next) => {
    if (req.user.role === 'h4_branch_admin' || req.user.role === 'h4_admin' && req.user.branchId) {
        res.status(403);
        return next(new Error('Gym-wide settings are available to overall administrators only.'));
    }
    return next();
};
router.get('/settings', protect, authorize('admin', 'superadmin', 'h4_admin'), denyH4BranchAdmin, getGymSettings);
router.put('/settings', protect, authorize('admin', 'superadmin', 'h4_admin'), denyH4BranchAdmin, updateGymSettings);

module.exports = router;

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { getProducts, getMyOrders, saveProduct, deleteProduct, permanentlyDeleteProduct, purchaseProduct, getCoinSettings, saveCoinSettings } = require('../controllers/storeController');

router.use(protect);
const denyH4BranchAdmin = (req, res, next) => {
    if (req.user.role === 'h4_branch_admin' || req.user.role === 'h4_admin' && req.user.branchId) {
        res.status(403);
        return next(new Error('H4-wide products and coin settings are available to overall administrators only.'));
    }
    return next();
};
router.get('/products', denyH4BranchAdmin, getProducts);
router.get('/orders', authorize('member'), getMyOrders);
router.get('/coin-settings', denyH4BranchAdmin, getCoinSettings);
router.put('/coin-settings', authorize('admin', 'h4_admin', 'fitpass_admin', 'superadmin'), denyH4BranchAdmin, saveCoinSettings);
router.post('/products', authorize('admin', 'h4_admin', 'fitpass_admin', 'superadmin'), denyH4BranchAdmin, upload.single('image'), saveProduct);
router.put('/products/:id', authorize('admin', 'h4_admin', 'fitpass_admin', 'superadmin'), denyH4BranchAdmin, upload.single('image'), saveProduct);
router.delete('/products/:id', authorize('admin', 'h4_admin', 'fitpass_admin', 'superadmin'), denyH4BranchAdmin, deleteProduct);
router.delete('/products/:id/permanent', authorize('admin', 'h4_admin', 'fitpass_admin', 'superadmin'), denyH4BranchAdmin, permanentlyDeleteProduct);
router.post('/products/:id/purchase', authorize('member'), purchaseProduct);
module.exports = router;

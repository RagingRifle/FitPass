const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { getProducts, getMyOrders, saveProduct, deleteProduct, permanentlyDeleteProduct, purchaseProduct, getCoinSettings, saveCoinSettings } = require('../controllers/storeController');

router.use(protect);
router.get('/products', getProducts);
router.get('/orders', authorize('member'), getMyOrders);
router.get('/coin-settings', getCoinSettings);
router.put('/coin-settings', authorize('admin', 'h4_admin', 'fitpass_admin', 'superadmin'), saveCoinSettings);
router.post('/products', authorize('admin', 'h4_admin', 'fitpass_admin', 'superadmin'), upload.single('image'), saveProduct);
router.put('/products/:id', authorize('admin', 'h4_admin', 'fitpass_admin', 'superadmin'), upload.single('image'), saveProduct);
router.delete('/products/:id', authorize('admin', 'h4_admin', 'fitpass_admin', 'superadmin'), deleteProduct);
router.delete('/products/:id/permanent', authorize('admin', 'h4_admin', 'fitpass_admin', 'superadmin'), permanentlyDeleteProduct);
router.post('/products/:id/purchase', authorize('member'), purchaseProduct);
module.exports = router;

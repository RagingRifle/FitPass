const express = require('express');
const router = express.Router();
const {
    createExpense,
    getExpenses,
    deleteExpense,
    getExpenseCategories,
    createExpenseCategory,
    updateExpenseCategory,
    deleteExpenseCategory
} = require('../controllers/expenseController');
const { protect, authorize } = require('../middleware/authMiddleware');
const tenantFilter = require('../middleware/tenantFilter');
const validate = require('../middleware/validate');
const { z } = require('zod');

const createExpenseSchema = z.object({
    title: z.string().min(1, 'Title is required').max(100),
    amount: z.union([z.number(), z.string()]).transform(Number).refine(value => Number.isFinite(value) && value >= 0, 'Amount cannot be negative'),
    category: z.string().min(1, 'Category is required'),
    description: z.string().optional(),
    date: z.string().optional(),
    branchId: z.string().optional().nullable()
});

const categorySchema = z.object({ name: z.string().trim().min(1).max(50) });

router.use(protect);
router.use(authorize('admin', 'h4_admin'));

router.route('/categories')
    .get(tenantFilter, getExpenseCategories)
    .post(validate({ body: categorySchema }), tenantFilter, createExpenseCategory);

router.route('/categories/:id')
    .put(validate({ body: categorySchema }), tenantFilter, updateExpenseCategory)
    .delete(tenantFilter, deleteExpenseCategory);

router.route('/')
    .post(validate({ body: createExpenseSchema }), createExpense)
    .get(tenantFilter, getExpenses);

router.route('/:id')
    .delete(tenantFilter, deleteExpense);

module.exports = router;

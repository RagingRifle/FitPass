const catchAsync = require('../utils/catchAsync');
const Expense = require('../models/Expense');
const Branch = require('../models/Branch');
const prisma = require('../config/prisma');
const { logAudit } = require('../utils/auditLogger');

const DEFAULT_CATEGORIES = ['Rent', 'Electricity', 'Maintenance', 'Salaries', 'Equipment', 'Marketing', 'Others'];

const getGymId = (req) => {
    if (req.user?.role === 'superadmin') return req.tenantFilter?.gymId || null;
    return req.user?.gymId && req.user.gymId !== 'SYSTEM' ? req.user.gymId : null;
};

const ensureExpenseCategories = async (gymId) => {
    if (!gymId) return;
    const existingExpenses = await prisma.expense.findMany({ where: { gymId }, distinct: ['category'], select: { category: true } });
    const names = [...new Set([...DEFAULT_CATEGORIES, ...existingExpenses.map((row) => row.category?.trim()).filter(Boolean)])];
    await prisma.expenseCategory.createMany({ data: names.map((name) => ({ gymId, name })), skipDuplicates: true });
};

const getExpenseCategories = catchAsync(async (req, res) => {
    const gymId = getGymId(req);
    if (!gymId) return res.status(400).json({ message: 'Select a gym before managing expense categories.' });
    await ensureExpenseCategories(gymId);
    const categories = await prisma.expenseCategory.findMany({ where: { gymId }, orderBy: { name: 'asc' } });
    res.json(categories);
});

const createExpenseCategory = catchAsync(async (req, res) => {
    const gymId = getGymId(req);
    const name = String(req.body.name || '').trim();
    if (!gymId) return res.status(400).json({ message: 'Select a gym before managing expense categories.' });
    if (!name || name.length > 50) return res.status(400).json({ message: 'Category name must be 1 to 50 characters.' });
    const duplicate = await prisma.expenseCategory.findFirst({ where: { gymId, name: { equals: name, mode: 'insensitive' } } });
    if (duplicate) return res.status(409).json({ message: 'That expense category already exists.' });
    const category = await prisma.expenseCategory.create({ data: { gymId, name } });
    res.status(201).json(category);
});

const updateExpenseCategory = catchAsync(async (req, res) => {
    const gymId = getGymId(req);
    const name = String(req.body.name || '').trim();
    if (!gymId) return res.status(400).json({ message: 'Select a gym before managing expense categories.' });
    if (!name || name.length > 50) return res.status(400).json({ message: 'Category name must be 1 to 50 characters.' });
    const category = await prisma.expenseCategory.findFirst({ where: { id: req.params.id, gymId } });
    if (!category) return res.status(404).json({ message: 'Expense category not found.' });
    const duplicate = await prisma.expenseCategory.findFirst({ where: { gymId, id: { not: category.id }, name: { equals: name, mode: 'insensitive' } } });
    if (duplicate) return res.status(409).json({ message: 'That expense category already exists.' });
    const updated = await prisma.$transaction(async (tx) => {
        await tx.expense.updateMany({ where: { gymId, category: category.name }, data: { category: name } });
        return tx.expenseCategory.update({ where: { id: category.id }, data: { name } });
    });
    res.json(updated);
});

const deleteExpenseCategory = catchAsync(async (req, res) => {
    const gymId = getGymId(req);
    if (!gymId) return res.status(400).json({ message: 'Select a gym before managing expense categories.' });
    const category = await prisma.expenseCategory.findFirst({ where: { id: req.params.id, gymId } });
    if (!category) return res.status(404).json({ message: 'Expense category not found.' });
    const usageCount = await prisma.expense.count({ where: { gymId, category: category.name } });
    if (usageCount) return res.status(409).json({ message: 'This category is used by existing expenses. Rename it instead to keep history intact.' });
    await prisma.expenseCategory.delete({ where: { id: category.id } });
    res.json({ message: 'Expense category removed.' });
});

const createExpense = catchAsync(async (req, res) => {
    const gymId = getGymId(req);
    const { title, amount, category, description, date } = req.body;
    if (!gymId) return res.status(400).json({ message: 'Select a gym before adding expenses.' });
    await ensureExpenseCategories(gymId);
    const savedCategory = await prisma.expenseCategory.findFirst({ where: { gymId, name: { equals: String(category || '').trim(), mode: 'insensitive' } } });
    if (!savedCategory) return res.status(400).json({ message: 'Choose an available expense category.' });
    const branchId = req.user.branchId || req.body.branchId || null;
    if (branchId) {
        const branch = await Branch.findOne({ _id: branchId, gymId }).lean();
        if (!branch) return res.status(403).json({ message: 'Choose a branch in this gym.' });
    }
    const expense = await Expense.create({
        gymId,
        branchId,
        title,
        amount: Number(amount),
        category: savedCategory.name,
        description,
        date: date ? new Date(date) : new Date()
    });
    await logAudit(req, 'EXPENSE_ADDED', 'Expense', expense._id, `Added expense: ${title} ₹${amount} (${savedCategory.name})`, title);
    res.status(201).json(expense);
});

const getExpenses = catchAsync(async (req, res) => {
    const query = { ...req.tenantFilter, gymId: getGymId(req) };
    const { from, to, category, branchId, timezoneOffset = 0 } = req.query;
    const offsetMinutes = Number(timezoneOffset) || 0;
    const dayBoundary = (value, endOfDay = false) => {
        const [year, month, day] = value.split('-').map(Number);
        const timestamp = Date.UTC(year, month - 1, day + (endOfDay ? 1 : 0)) - offsetMinutes * 60_000;
        return new Date(timestamp - (endOfDay ? 1 : 0));
    };
    if (from || to) query.date = { ...(from ? { $gte: dayBoundary(from) } : {}), ...(to ? { $lte: dayBoundary(to, true) } : {}) };
    if (category) query.category = category;
    if (req.user.branchId) query.branchId = req.user.branchId;
    else if (branchId) query.branchId = branchId;
    const expenses = await Expense.find(query).sort({ date: -1 });
    res.json(expenses);
});

const deleteExpense = catchAsync(async (req, res) => {
    const query = { _id: req.params.id, ...req.tenantFilter, gymId: getGymId(req) };
    if (req.user.branchId) query.branchId = req.user.branchId;
    const expense = await Expense.findOne(query);
    if (!expense) return res.status(404).json({ message: 'Expense not found.' });
    await logAudit(req, 'EXPENSE_DELETED', 'Expense', expense._id, `Deleted expense: ${expense.title} ₹${expense.amount}`, expense.title);
    await expense.deleteOne();
    res.json({ message: 'Expense removed.' });
});

module.exports = {
    createExpense,
    getExpenses,
    deleteExpense,
    getExpenseCategories,
    createExpenseCategory,
    updateExpenseCategory,
    deleteExpenseCategory
};

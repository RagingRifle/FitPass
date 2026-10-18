const catchAsync = require('../utils/catchAsync');
const DietTemplate = require('../models/DietTemplate');

const parseMeals = (template) => {
    if (template?.meals && typeof template.meals === 'string') {
        try { template.meals = JSON.parse(template.meals); } catch (error) {}
    }
    return template;
};

const createTemplate = catchAsync(async (req, res, next) => {
    try {
        const { name, description, meals } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Template name is required' });
        const template = await DietTemplate.create({
            name, description: description || null,
            meals: meals ? (typeof meals === 'string' ? meals : JSON.stringify(meals)) : null,
            gymId: req.user.gymId, branchId: req.user.branchId || null
        });
        res.status(201).json(parseMeals(template));
    } catch (error) { next(error); }
});

const getTemplates = catchAsync(async (req, res, next) => {
    try {
        const templates = await DietTemplate.find({ gymId: req.user.gymId }).lean();
        res.json(templates.map(parseMeals));
    } catch (error) { next(error); }
});

const updateTemplate = catchAsync(async (req, res, next) => {
    try {
        const template = await DietTemplate.findOne({ _id: req.params.id, gymId: req.user.gymId });
        if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
        const { name, description, meals } = req.body;
        if (name !== undefined) template.name = name;
        if (description !== undefined) template.description = description || null;
        if (meals !== undefined) template.meals = typeof meals === 'string' ? meals : JSON.stringify(meals);
        res.json(parseMeals(await template.save()));
    } catch (error) { next(error); }
});

const deleteTemplate = catchAsync(async (req, res, next) => {
    try {
        const template = await DietTemplate.findOne({ _id: req.params.id, gymId: req.user.gymId });
        if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
        await template.deleteOne();
        res.json({ message: 'Template removed' });
    } catch (error) { next(error); }
});

module.exports = { createTemplate, getTemplates, updateTemplate, deleteTemplate };

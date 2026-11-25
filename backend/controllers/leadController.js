const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Lead = require('../models/Lead');
const Member = require('../models/Member');

const parseFollowUpDate = (value) => value
    ? new Date(`${value}T00:00:00.000Z`)
    : null;

// @desc    Get all leads for gym
// @route   GET /api/leads
const getLeads = catchAsync(async (req, res, next) => {
    try {
        const { status, source } = req.query;
        const filter = { ...req.tenantFilter };
        if (status) filter.status = status === 'Opened' ? { $in: ['Opened', 'New'] } : status === 'Closed' ? { $in: ['Closed', 'Lost'] } : status;
        if (source) filter.source = source;

        const leads = await Lead.find(filter).sort({ createdAt: -1 });
        res.json(leads);
    } catch (err) { next(err); }
});

// @desc    Create a lead
// @route   POST /api/leads
const createLead = catchAsync(async (req, res, next) => {
    try {
        const { name, phone, email, source, interestedPlan, notes, followUpDate, assignedTo } = req.body;
        if (!name || !phone) return res.status(400).json({ message: 'Name and phone are required' });

        const lead = await Lead.create({
            name, phone, email, source, interestedPlan, notes,
            followUpDate: parseFollowUpDate(followUpDate),
            assignedTo,
            gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }),
            branchId: req.user.branchId || null,
            status: 'Opened', comments: []
        });
        res.status(201).json(lead);
    } catch (err) { next(err); }
});

const addLeadComment = catchAsync(async (req, res) => {
    const query = { _id: req.params.id, gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }) };
    const lead = await Lead.findOne(query);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    const comment = String(req.body.comment || '').trim();
    if (!comment) return res.status(400).json({ message: 'Comment is required' });
    lead.comments = [...(Array.isArray(lead.comments) ? lead.comments : []), { id: require('crypto').randomUUID(), comment, author: req.user.name || req.user.email || 'Staff', authorId: String(req.user.id || req.user._id || ''), createdAt: new Date().toISOString() }];
    await lead.save();
    res.status(201).json(lead);
});

// @desc    Update lead status / details
// @route   PUT /api/leads/:id
const updateLead = catchAsync(async (req, res, next) => {
    try {
        const query = { _id: req.params.id, gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }) };
        if (req.user.branchId) query.branchId = req.user.branchId;
        const lead = await Lead.findOne(query);
        if (!lead) return res.status(404).json({ message: 'Lead not found' });

        const { name, phone, email, source, status, interestedPlan, notes, followUpDate, assignedTo, convertedMemberId } = req.body;
        if (name) lead.name = name;
        if (phone) lead.phone = phone;
        if (email !== undefined) lead.email = email;
        if (source) lead.source = source;
        if (status) lead.status = status;
        if (interestedPlan !== undefined) lead.interestedPlan = interestedPlan;
        if (notes !== undefined) lead.notes = notes;
        if (followUpDate !== undefined) lead.followUpDate = parseFollowUpDate(followUpDate);
        if (assignedTo !== undefined) lead.assignedTo = assignedTo;
        if (convertedMemberId !== undefined) lead.convertedMemberId = convertedMemberId;

        await lead.save();
        res.json(lead);
    } catch (err) { next(err); }
});

// @desc    Delete a lead
// @route   DELETE /api/leads/:id
const deleteLead = catchAsync(async (req, res, next) => {
    try {
        const query = { _id: req.params.id, gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }) };
        if (req.user.branchId) query.branchId = req.user.branchId;
        const lead = await Lead.findOneAndDelete(query);
        if (!lead) return res.status(404).json({ message: 'Lead not found' });
        res.json({ message: 'Lead deleted' });
    } catch (err) { next(err); }
});

// @desc    Get lead pipeline summary (counts by status)
// @route   GET /api/leads/summary
const getLeadSummary = catchAsync(async (req, res, next) => {
    try {
        const matchStage = { ...req.tenantFilter };

        const statusCounts = await Lead.aggregate([
            { $match: matchStage },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        const sourceCounts = await Lead.aggregate([
            { $match: matchStage },
            { $group: { _id: '$source', count: { $sum: 1 } } }
        ]);

        // Follow-up due today or overdue
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const followUpDue = await Lead.countDocuments({
            ...matchStage,
            followUpDate: { $lte: today },
            status: { $nin: ['Converted', 'Lost', 'Closed'] }
        });

        // Conversion rate
        const total = await Lead.countDocuments(matchStage);
        const converted = statusCounts.find(s => s._id === 'Converted')?.count || 0;
        const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : 0;

        res.json({ statusCounts, sourceCounts, followUpDue, total, converted, conversionRate });
    } catch (err) { next(err); }
});

module.exports = { getLeads, createLead, addLeadComment, updateLead, deleteLead, getLeadSummary };

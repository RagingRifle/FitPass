const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Branch = require('../models/Branch');
const Member = require('../models/Member');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { logAudit } = require('../utils/auditLogger');
const { z } = require('zod');

const branchDetailsSchema = z.object({
    name: z.string().min(1).max(160).optional(),
    shortDescription: z.string().max(300).optional(),
    description: z.string().max(5000).optional(),
    address: z.string().max(500).optional(),
    phone: z.string().max(40).optional(),
    email: z.string().email().or(z.literal('')).optional(),
    website: z.string().max(300).optional(),
    managerName: z.string().max(160).optional(),
    openingTime: z.string().max(20).optional(),
    closingTime: z.string().max(20).optional(),
    workingDays: z.array(z.string().max(20)).max(7).optional(),
    weeklySchedule: z.record(z.string(), z.object({ closed: z.boolean().optional(), open: z.string().max(20).optional(), close: z.string().max(20).optional() })).optional(),
    scheduleExceptions: z.array(z.object({ date: z.string().max(20), closed: z.boolean(), open: z.string().max(20).optional(), close: z.string().max(20).optional(), reason: z.string().max(300).optional() })).max(100).optional(),
    amenities: z.array(z.string().max(100)).max(50).optional(),
    equipments: z.array(z.string().max(100)).max(50).optional(),
    fitPassEnabled: z.boolean().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
});

// Public branch directory used only to let staff choose their workplace at sign in.
const getPublicBranches = catchAsync(async (req, res, next) => {
    try {
        const branches = await Branch.find({}).lean();
        const gyms = await Promise.all([...new Set(branches.map((branch) => String(branch.gymId || '')).filter(Boolean))]
            .map(async (id) => [id, await require('../models/Gym').findById(id).lean()]));
        const gymNames = new Map(gyms.map(([id, gym]) => [id, gym?.name || 'Gym']));
        res.json(branches.map(({ _id, id, name, gymId }) => ({ id: _id || id, name, gymId, gymName: gymNames.get(String(gymId)) || 'Gym' })));
    } catch (err) { next(err); }
});

// @desc    Get all branches for a gym
// @route   GET /api/branches
const getBranches = catchAsync(async (req, res, next) => {
    try {
        const query = {};
        const isH4BranchAdmin = req.user.role === 'h4_admin' && req.user.userBranchId;
        if (!isH4BranchAdmin && req.user.gymId && req.user.gymId !== 'SYSTEM') {
            query.gymId = req.user.gymId;
        }

        const isHQAdmin = ['superadmin', 'fitpass_admin', 'partner', 'admin'].includes(req.user.role)
            || (req.user.role === 'h4_admin' && !req.user.userBranchId);
        if (!isHQAdmin && req.user.userBranchId) {
            query._id = req.user.userBranchId;
        }

        const branches = await Branch.find(query).lean();

        // Attach member/revenue counts per branch
        const enriched = await Promise.all(branches.map(async (b) => {
            const gymFilter = b.gymId ? { gymId: b.gymId } : {};
            const memberCount = await Member.countDocuments({ ...gymFilter, branchId: b._id });
            const revenueAgg = await Payment.aggregate([
                { $match: { ...gymFilter, branchId: b._id } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);
            return { ...b, memberCount, totalRevenue: revenueAgg[0]?.total || 0 };
        }));

        const gymIds = [...new Set(enriched.map((branch) => String(branch.gymId || '')).filter(Boolean))];
        const gyms = gymIds.length ? await require('../config/prisma').gym.findMany({ where: { id: { in: gymIds } }, select: { id: true, name: true } }) : [];
        const gymNames = new Map(gyms.map((gym) => [String(gym.id), gym.name]));

        res.json(enriched.map((branch) => ({ ...branch, gymName: gymNames.get(String(branch.gymId || '')) || '' })));
    } catch (err) { next(err); }
});

const createBranch = catchAsync(async (req, res, next) => {
    try {
        const isHQAdmin = ['superadmin', 'fitpass_admin', 'partner', 'admin'].includes(req.user.role)
            || (req.user.role === 'h4_admin' && !req.user.userBranchId);
        if (!isHQAdmin && req.user.userBranchId) {
            return res.status(403).json({ message: 'Branch administrators cannot create branches' });
        }
        const parsed = branchDetailsSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
        const { name, address, phone, email, managerName, fitPassEnabled, latitude, longitude, ...details } = parsed.data;
        if (!name) return res.status(400).json({ message: 'Branch name is required' });

        const branch = await Branch.create({
            name,
            ...details,
            address,
            phone,
            email,
            managerName,
            gymId: req.user.gymId,
            fitPassEnabled: fitPassEnabled !== undefined ? fitPassEnabled : true,
            latitude: latitude !== undefined ? Number(latitude) : null,
            longitude: longitude !== undefined ? Number(longitude) : null
        });

        // Automatically provision Branch Admin login credentials using email & mobile number
        if (email || phone) {
            const userEmail = (email || `${phone.replace(/\D/g, '')}@branch.com`).trim().toLowerCase();
            const initialPassword = phone ? phone.trim() : email.trim();

            const existingUser = await User.findOne({ email: userEmail });
            if (!existingUser && initialPassword) {
                await User.create({
                    name: managerName || `${name} Admin`,
                    email: userEmail,
                    password: initialPassword,
                    phone: phone || '',
                    role: req.user.role === 'h4_admin' ? 'h4_admin' : 'admin',
                    gymId: req.user.gymId,
                    branchId: branch._id || branch.id,
                    isVerified: true
                });
            }
        }

        await logAudit(req, 'BRANCH_CREATED', 'Branch', branch._id, `Branch "${name}" created with initial credentials (${email || phone})`, name);
        res.status(201).json(branch);
    } catch (err) { next(err); }
});

// @desc    Update a branch
// @route   PUT /api/branches/:id
const updateBranch = catchAsync(async (req, res, next) => {
    try {
        const isH4BranchAdmin = req.user.role === 'h4_admin' && req.user.userBranchId;
        if (isH4BranchAdmin && String(req.params.id) !== String(req.user.userBranchId)) {
            return res.status(403).json({ message: 'Branch admins can only edit their assigned branch.' });
        }
        const filter = { _id: req.params.id };
        if (isH4BranchAdmin) filter._id = req.user.userBranchId;
        if (!isH4BranchAdmin && req.user.gymId && req.user.gymId !== 'SYSTEM') {
            filter.gymId = req.user.gymId;
        }
        const parsed = branchDetailsSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
        const branch = await Branch.findOneAndUpdate(
            filter,
            parsed.data,
            { new: true }
        );
        if (!branch) return res.status(404).json({ message: 'Branch not found' });
        await logAudit(req, 'BRANCH_UPDATED', 'Branch', branch._id, `Branch "${branch.name}" updated`, branch.name);
        res.json(branch);
    } catch (err) { next(err); }
});

// @desc    Delete a branch
// @route   DELETE /api/branches/:id
const deleteBranch = catchAsync(async (req, res, next) => {
    try {
        const isHQAdmin = ['superadmin', 'fitpass_admin', 'partner', 'admin'].includes(req.user.role)
            || (req.user.role === 'h4_admin' && !req.user.userBranchId);
        if (!isHQAdmin && req.user.userBranchId) {
            return res.status(403).json({ message: 'Branch administrators cannot delete branches' });
        }
        const filter = { _id: req.params.id };
        if (req.user.gymId && req.user.gymId !== 'SYSTEM') {
            filter.gymId = req.user.gymId;
        }
        const branch = await Branch.findOneAndDelete(filter);
        if (!branch) return res.status(404).json({ message: 'Branch not found' });
        await logAudit(req, 'BRANCH_DELETED', 'Branch', branch._id, `Branch "${branch.name}" deleted`, branch.name);
        res.json({ message: 'Branch deleted' });
    } catch (err) { next(err); }
});

// @desc    Get members for a specific branch
// @route   GET /api/branches/:id/members
const getBranchMembers = catchAsync(async (req, res, next) => {
    try {
        const isHQAdmin = ['superadmin', 'fitpass_admin', 'partner', 'admin'].includes(req.user.role)
            || (req.user.role === 'h4_admin' && !req.user.userBranchId);
        if (!isHQAdmin && req.user.userBranchId && req.user.userBranchId !== req.params.id) {
            return res.status(403).json({ message: 'Access denied to this branch\'s members' });
        }
        const filter = { branchId: req.params.id };
        if (req.user.gymId && req.user.gymId !== 'SYSTEM') {
            filter.gymId = req.user.gymId;
        }
        const members = await Member.find(filter)
            .populate('planId', 'name').sort({ createdAt: -1 });
        res.json(members);
    } catch (err) { next(err); }
});

module.exports = { getPublicBranches, getBranches, createBranch, updateBranch, deleteBranch, getBranchMembers };

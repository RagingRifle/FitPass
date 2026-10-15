const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Branch = require('../models/Branch');
const Member = require('../models/Member');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { logAudit } = require('../utils/auditLogger');

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
        if (req.user.gymId && req.user.gymId !== 'SYSTEM') {
            query.gymId = req.user.gymId;
        }

        const isHQAdmin = ['superadmin', 'h4_admin', 'fitpass_admin', 'partner', 'admin'].includes(req.user.role);
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

        res.json(enriched);
    } catch (err) { next(err); }
});

const createBranch = catchAsync(async (req, res, next) => {
    try {
        const isHQAdmin = ['superadmin', 'h4_admin', 'fitpass_admin', 'partner', 'admin'].includes(req.user.role);
        if (!isHQAdmin && req.user.userBranchId) {
            return res.status(403).json({ message: 'Branch administrators cannot create branches' });
        }
        const { name, address, phone, email, managerName, fitPassEnabled, latitude, longitude } = req.body;
        if (!name) return res.status(400).json({ message: 'Branch name is required' });

        const branch = await Branch.create({
            name,
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
        const isHQAdmin = ['superadmin', 'h4_admin', 'fitpass_admin', 'partner', 'admin'].includes(req.user.role);
        if (!isHQAdmin && req.user.userBranchId) {
            return res.status(403).json({ message: 'Branch administrators cannot modify branches' });
        }
        const filter = { _id: req.params.id };
        if (req.user.gymId && req.user.gymId !== 'SYSTEM') {
            filter.gymId = req.user.gymId;
        }
        const branch = await Branch.findOneAndUpdate(
            filter,
            req.body,
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
        const isHQAdmin = ['superadmin', 'h4_admin', 'fitpass_admin', 'partner', 'admin'].includes(req.user.role);
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
        const isHQAdmin = ['superadmin', 'h4_admin', 'fitpass_admin', 'partner', 'admin'].includes(req.user.role);
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

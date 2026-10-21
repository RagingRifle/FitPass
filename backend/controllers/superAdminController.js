const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const logger = require('../lib/logger');
const { z } = require('zod');
const prisma = require('../config/prisma');
const User = require('../models/User');
const Gym = require('../models/Gym');
const Plan = require('../models/Plan');
const generateToken = require('../utils/generateToken');
const { logAudit } = require('../utils/auditLogger');
const { DEFAULT_SESSION_DURATION_MINUTES, H4_GYM_IDS } = require('../config/constants');

// --- zod schemas (validation lives at the controller boundary; routes apply
//     them via the shared validate middleware where convenient, but for the
//     superadmin mutations we parse here to keep the controller self-contained) ---
const createGymSchema = z.object({
    gymName: z.string().min(1, 'Gym name is required').max(120),
    gymAddress: z.string().max(300).optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    // Per-gym default session duration for FitPrime check-ins (minutes).
    defaultSessionDurationMinutes: z.number().int().min(15).max(600).optional(),
    adminName: z.string().min(1, 'Admin name is required').max(120),
    adminEmail: z.string().email('A valid admin email is required'),
    adminPassword: z.string().min(6, 'Admin password must be at least 6 characters'),
});

const updateGymSchema = z.object({
    name: z.string().min(1).max(120).optional(),
    address: z.string().max(300).optional(),
    phone: z.string().max(40).optional(),
    email: z.string().email().or(z.literal('')).optional(),
    status: z.enum(['Active', 'Inactive']).optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    defaultSessionDurationMinutes: z.number().int().min(15).max(600).optional(),
    adminPassword: z.string().min(6, 'Admin password must be at least 6 characters').optional(),
});

const fitPrimePlanSchema = z.object({
    name: z.string().min(1, 'Plan name is required').max(120),
    sessions: z.number().int().positive('Sessions must be a positive whole number'),
    price: z.number().nonnegative('Price must be zero or positive'),
});

// @desc    Create a partner gym and admin user
// @route   POST /api/superadmin/gyms
// @access  Private (Super Admin)
const createPartnerGym = catchAsync(async (req, res, next) => {
    const parsed = createGymSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400);
        throw new Error(parsed.error.issues[0].message);
    }
    const { gymName, gymAddress, latitude, longitude, defaultSessionDurationMinutes, adminName, adminEmail, adminPassword } = parsed.data;

    if (gymName && (gymName.toLowerCase() === 'h4' || gymName.toLowerCase().includes('h4'))) {
        res.status(400);
        throw new Error('H4 is a separate division and cannot be created as a FitPass partner.');
    }

    const normalizedEmail = adminEmail.trim().toLowerCase();
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    const gym = await Gym.create({
        name: gymName,
        address: gymAddress || '',
        latitude: latitude !== undefined ? latitude : null,
        longitude: longitude !== undefined ? longitude : null,
        defaultSessionDurationMinutes: defaultSessionDurationMinutes || DEFAULT_SESSION_DURATION_MINUTES,
    });

    const user = await User.create({
        name: adminName,
        email: normalizedEmail,
        password: adminPassword,
        gymId: gym._id,
        role: 'admin'
    });

    if (user) {
        await logAudit(req, 'GYM_CREATED', 'Gym', gym._id, `Super admin created partner gym: ${gymName}`, gymName);
        res.status(201).json({
            gym: {
                _id: gym._id,
                name: gym.name,
                address: gym.address,
                latitude: gym.latitude,
                longitude: gym.longitude,
                defaultSessionDurationMinutes: gym.defaultSessionDurationMinutes,
            },
            admin: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            }
        });
    } else {
        res.status(400);
        throw new Error('Invalid data');
    }
});

// @desc    Update a partner gym (incl. default session duration setting)
// @route   PUT /api/superadmin/gyms/:id
// @access  Private (Super Admin)
const updatePartnerGym = catchAsync(async (req, res, next) => {
    const parsed = updateGymSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400);
        throw new Error(parsed.error.issues[0].message);
    }

    const targetId = req.params.id;
    let gym = await Gym.findById(targetId);

    if (!gym) {
        const branch = await prisma.branch.findUnique({ where: { id: targetId } });
        if (!branch) {
            res.status(404);
            throw new Error('Gym or Branch not found');
        }
        const updates = parsed.data;
        const branchData = {};
        if (updates.name !== undefined) branchData.name = updates.name.replace(/\s*\([^)]*\)/g, '').trim();
        if (updates.address !== undefined) branchData.address = updates.address;
        if (updates.phone !== undefined) branchData.phone = updates.phone;
        if (updates.email !== undefined) branchData.email = updates.email;
        if (updates.status !== undefined) branchData.isActive = updates.status === 'Active';

        const updatedBranch = await prisma.branch.update({
            where: { id: targetId },
            data: branchData
        });
        await logAudit(req, 'BRANCH_UPDATED', 'Branch', updatedBranch.id, `Updated branch: ${updatedBranch.name}`, updatedBranch.name);
        return res.json({
            _id: updatedBranch.id,
            name: updatedBranch.name,
            address: updatedBranch.address,
            phone: updatedBranch.phone,
            email: updatedBranch.email,
            status: updatedBranch.isActive ? 'Active' : 'Inactive',
        });
    }

    const updates = parsed.data;
    if (updates.name !== undefined) gym.name = updates.name;
    if (updates.address !== undefined) gym.address = updates.address;
    if (updates.phone !== undefined) gym.phone = updates.phone;
    if (updates.email !== undefined) gym.email = updates.email;
    if (updates.status !== undefined) gym.status = updates.status;
    if (updates.latitude !== undefined) gym.latitude = updates.latitude;
    if (updates.longitude !== undefined) gym.longitude = updates.longitude;
    if (updates.defaultSessionDurationMinutes !== undefined) {
        gym.defaultSessionDurationMinutes = updates.defaultSessionDurationMinutes;
    }
    await gym.save();

    if (updates.adminPassword) {
        const adminUser = await User.findOne({ gymId: gym._id, role: 'admin' });
        if (adminUser) {
            adminUser.password = updates.adminPassword;
            await adminUser.save();
        }
    }

    await logAudit(req, 'GYM_UPDATED', 'Gym', gym._id, `Updated gym settings: ${gym.name}`, gym.name);

    res.json({
        _id: gym._id,
        name: gym.name,
        address: gym.address,
        phone: gym.phone,
        email: gym.email,
        status: gym.status,
        latitude: gym.latitude,
        longitude: gym.longitude,
        defaultSessionDurationMinutes: gym.defaultSessionDurationMinutes,
    });
});

// @desc    Get all partner gyms
// @route   GET /api/superadmin/gyms
// @access  Private (Super Admin)
const getPartnerGyms = catchAsync(async (req, res, next) => {
    const allGyms = await Gym.find({}).lean();
    // Exclude H4 gyms from partner list
    const gyms = allGyms.filter(g => !g.name || !g.name.toLowerCase().includes('h4'));
    const users = await User.find({ role: 'admin' });

    const gymsWithAdmins = gyms.map(gym => {
        const admins = users.filter(u => u.gymId?.toString() === gym._id?.toString() || u.gymId === gym._id);
        return {
            ...gym,
            admins: admins.map(a => ({ _id: a._id, name: a.name, email: a.email }))
        };
    });

    try {
        const fitPassBranches = await prisma.branch.findMany({
            where: { fitPassEnabled: true }
        });

        const branchItems = fitPassBranches.map(branch => {
            const parentGym = allGyms.find(g => (g._id || g.id) === branch.gymId);
            const parentName = parentGym ? parentGym.name : 'H4';
            return {
                _id: branch.id,
                id: branch.id,
                name: `${branch.name} (${parentName})`,
                isBranch: true,
                parentGymId: branch.gymId,
                address: branch.address,
                phone: branch.phone,
                email: branch.email,
                status: branch.isActive ? 'Active' : 'Inactive',
                latitude: branch.latitude,
                longitude: branch.longitude,
                admins: []
            };
        });

        res.json([...gymsWithAdmins, ...branchItems]);
    } catch (err) {
        logger.error({ err }, 'Failed to include fitpass branches in partner list');
        res.json(gymsWithAdmins);
    }
});

// @desc    Get or create H4 gym
// @route   GET /api/superadmin/h4-gym
// @access  Private (Super Admin)
const getOrCreateH4Gym = catchAsync(async (req, res, next) => {
    let gym = await Gym.findOne({ name: 'H4' });
    if (!gym) {
        gym = await Gym.create({
            name: 'H4',
            address: 'H4 Head Office',
            phone: '555-0100',
            email: 'h4@gymcrm.com'
        });
        await logAudit(req, 'GYM_CREATED', 'Gym', gym._id, `System automatically created H4 Gym`, 'H4');
    }
    res.json(gym);
});

// @desc    Delete a partner gym or disable branch FitPass access
// @route   DELETE /api/superadmin/gyms/:id
// @access  Private (Super Admin)
const deletePartnerGym = catchAsync(async (req, res, next) => {
    const targetId = req.params.id;
    const gym = await Gym.findById(targetId);

    if (!gym) {
        const branch = await prisma.branch.findUnique({ where: { id: targetId } });
        if (branch) {
            await prisma.branch.update({
                where: { id: targetId },
                data: { fitPassEnabled: false }
            });
            await logAudit(req, 'BRANCH_DISABLED_FITPASS', 'Branch', branch.id, `Disabled FitPass for branch: ${branch.name}`, branch.name);
            return res.json({ message: 'Branch removed from FitPass network' });
        }
        res.status(404);
        throw new Error('Gym or Branch not found');
    }

    try {
        await prisma.gymPost.deleteMany({ where: { gymId: targetId } });
        await prisma.gymProfileViewLog.deleteMany({ where: { gymId: targetId } });
        await prisma.gymProfile.deleteMany({ where: { gymId: targetId } });
    } catch (e) {
        logger.warn({ err: e }, 'Non-critical cleanup error during gym delete');
    }

    await User.deleteMany({ gymId: gym._id, role: 'admin' });
    await gym.deleteOne();
    await logAudit(req, 'GYM_DELETED', 'Gym', gym._id, `Super admin deleted partner gym: ${gym.name}`, gym.name);
    res.json({ message: 'Gym and associated admins removed' });
});

// @desc    Create a FitPrime Plan (session-based global plan)
// @route   POST /api/superadmin/plans
// @access  Private (Super Admin)
const createFitPrimePlan = catchAsync(async (req, res, next) => {
    const parsed = fitPrimePlanSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400);
        throw new Error(parsed.error.issues[0].message);
    }
    const { name, sessions, price } = parsed.data;

    const plan = await Plan.create({
        name,
        sessions,
        price,
        // Legacy duration fields are nulled for SYSTEM plans; sessions are the
        // source of truth for FitPrime plans.
        duration: 0,
        durationUnit: 'sessions',
        gymId: 'SYSTEM'
    });

    await logAudit(req, 'PLAN_CREATED', 'Plan', plan._id, `Super admin created FitPrime plan: ${name} (${sessions} sessions)`, name);

    res.status(201).json(plan);
});

// @desc    Update a FitPrime Plan
// @route   PUT /api/superadmin/plans/:id
// @access  Private (Super Admin)
const updateFitPrimePlan = catchAsync(async (req, res, next) => {
    const plan = await Plan.findOne({ _id: req.params.id, gymId: 'SYSTEM' });
    if (!plan) {
        res.status(404);
        throw new Error('Plan not found');
    }

    const parsed = fitPrimePlanSchema.partial().safeParse(req.body);
    if (!parsed.success) {
        res.status(400);
        throw new Error(parsed.error.issues[0].message);
    }
    const { name, sessions, price } = parsed.data;
    if (name !== undefined) plan.name = name;
    if (sessions !== undefined) plan.sessions = sessions;
    if (price !== undefined) plan.price = price;
    await plan.save();

    await logAudit(req, 'PLAN_UPDATED', 'Plan', plan._id, `Updated FitPrime plan: ${plan.name} (${plan.sessions} sessions)`, plan.name);

    res.json(plan);
});

// @desc    Delete a FitPrime Plan
// @route   DELETE /api/superadmin/plans/:id
// @access  Private (Super Admin)
const deleteFitPrimePlan = catchAsync(async (req, res, next) => {
    const plan = await Plan.findOne({ _id: req.params.id, gymId: 'SYSTEM' });
    if (!plan) {
        res.status(404);
        throw new Error('Plan not found');
    }
    await plan.deleteOne();
    await logAudit(req, 'PLAN_DELETED', 'Plan', plan._id, `Deleted FitPrime plan: ${plan.name}`, plan.name);
    res.json({ message: 'Plan removed' });
});

// @desc    Get all FitPrime Plans
// @route   GET /api/superadmin/plans
// @access  Private (Super Admin)
const getFitPrimePlans = catchAsync(async (req, res, next) => {
    const plans = await Plan.find({ gymId: 'SYSTEM', sessions: { $gt: 0 } });
    res.json(plans);
});

// --- dedicated admin management ---
const createAdminSchema = z.object({
    name: z.string().min(1, 'Name is required').max(120),
    email: z.string().email('A valid email is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.enum(['fitpass_admin', 'h4_admin']),
});

const updateAdminSchema = z.object({
    name: z.string().min(1).max(120).optional(),
    password: z.string().min(6, 'Password must be at least 6 characters').optional(),
    status: z.enum(['Active', 'Inactive']).optional(),
});

// @desc    Get all dedicated admins (fitpass_admin, h4_admin)
// @route   GET /api/superadmin/admins
// @access  Private (Super Admin)
const getDedicatedAdmins = catchAsync(async (req, res, next) => {
    const admins = await User.find({ role: { $in: ['fitpass_admin', 'h4_admin'] } }).select('-password').lean();
    res.json(admins);
});

// @desc    Create a dedicated admin account
// @route   POST /api/superadmin/admins
// @access  Private (Super Admin)
const createDedicatedAdmin = catchAsync(async (req, res, next) => {
    const parsed = createAdminSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400);
        throw new Error(parsed.error.issues[0].message);
    }
    const { name, email, password, role } = parsed.data;

    const normalizedEmail = email.trim().toLowerCase();
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    let gymId = 'SYSTEM';
    if (role === 'h4_admin') {
        const h4Gym = await Gym.findOne({ name: 'H4' });
        gymId = h4Gym ? h4Gym._id : H4_GYM_IDS[0];
    }

    const admin = await User.create({
        name,
        email: normalizedEmail,
        password,
        role,
        gymId,
        isVerified: true,
    });

    if (admin) {
        await logAudit(req, 'ADMIN_CREATED', 'User', admin._id, `Super admin created dedicated admin: ${name} (${role})`, name);
        res.status(201).json({
            _id: admin._id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            gymId: admin.gymId,
        });
    } else {
        res.status(400);
        throw new Error('Invalid data');
    }
});

// @desc    Update a dedicated admin account
// @route   PUT /api/superadmin/admins/:id
// @access  Private (Super Admin)
const updateDedicatedAdmin = catchAsync(async (req, res, next) => {
    const parsed = updateAdminSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400);
        throw new Error(parsed.error.issues[0].message);
    }

    const admin = await User.findOne({ _id: req.params.id, role: { $in: ['fitpass_admin', 'h4_admin'] } });
    if (!admin) {
        res.status(404);
        throw new Error('Admin not found');
    }

    const updates = parsed.data;
    if (updates.name !== undefined) admin.name = updates.name;
    if (updates.password !== undefined) admin.password = updates.password;
    if (updates.status !== undefined) {
        admin.status = updates.status;
        admin.isActive = updates.status === 'Active';
    }
    await admin.save();

    await logAudit(req, 'ADMIN_UPDATED', 'User', admin._id, `Updated dedicated admin: ${admin.name}`, admin.name);

    res.json({
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        status: admin.status,
    });
});

// @desc    Delete a dedicated admin account
// @route   DELETE /api/superadmin/admins/:id
// @access  Private (Super Admin)
const deleteDedicatedAdmin = catchAsync(async (req, res, next) => {
    const admin = await User.findOne({ _id: req.params.id, role: { $in: ['fitpass_admin', 'h4_admin'] } });
    if (!admin) {
        res.status(404);
        throw new Error('Admin not found');
    }
    await admin.deleteOne();
    await logAudit(req, 'ADMIN_DELETED', 'User', admin._id, `Super admin deleted dedicated admin: ${admin.name}`, admin.name);
    res.json({ message: 'Dedicated admin removed' });
});

// ─── SuperAdmin FitPass Analytics Endpoints ───────────────────────────────

// @desc    Get paginated FitPass audit log with rich filters
// @route   GET /api/superadmin/fitpass/audit-log
// @access  Private (superadmin, fitpass_admin)
const getFitPassAuditLog = catchAsync(async (req, res, next) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize) || 50);
    const skip = (page - 1) * pageSize;

    const where = {};

    // Optional filters
    if (req.query.status) where.accessStatus = req.query.status;
    if (req.query.gymId) where.gymIdVisited = req.query.gymId;
    if (req.query.memberId) {
        where.memberId = req.query.memberId;
    } else if (req.query.memberName) {
        where.memberName = { contains: req.query.memberName, mode: 'insensitive' };
    }
    if (req.query.from || req.query.to) {
        where.checkInTimestamp = {};
        if (req.query.from) where.checkInTimestamp.gte = new Date(req.query.from);
        if (req.query.to) {
            const to = new Date(req.query.to);
            to.setHours(23, 59, 59, 999);
            where.checkInTimestamp.lte = to;
        }
    }

    const [total, logs] = await Promise.all([
        prisma.fitPassAuditLog.count({ where }),
        prisma.fitPassAuditLog.findMany({
            where,
            orderBy: { checkInTimestamp: 'desc' },
            skip,
            take: pageSize,
        }),
    ]);

    res.json({
        success: true,
        data: logs,
        meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
});

// @desc    Get all FitPass member roster with stats
// @route   GET /api/superadmin/fitpass/members
// @access  Private (superadmin, fitpass_admin)
const getFitPassMemberRoster = catchAsync(async (req, res, next) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize) || 50);
    const skip = (page - 1) * pageSize;

    // Get all SYSTEM plan IDs
    const fitPassPlans = await prisma.plan.findMany({
        where: { gymId: 'SYSTEM', sessions: { gt: 0 } },
        select: { id: true, name: true, sessions: true, price: true },
    });
    const fitPassPlanIds = fitPassPlans.map(p => p.id);

    const h4Gym = await prisma.gym.findFirst({ where: { name: 'H4' } });
    const h4GymId = h4Gym ? h4Gym.id : H4_GYM_IDS[0];
    const excludedH4GymIds = [...new Set([...H4_GYM_IDS, h4GymId])];

    const now = new Date();

    const [members, fitpassAccounts] = await Promise.all([
        prisma.member.findMany({
            where: { gymId: { notIn: excludedH4GymIds } },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true, name: true, phone: true, email: true, status: true,
                planId: true, joinDate: true, expiryDate: true, sessionsTotal: true,
                sessionsRemaining: true, lastCheckInAt: true, gymId: true,
            },
        }),
        prisma.user.findMany({
            where: { role: 'member', gymId: { notIn: excludedH4GymIds } },
            select: { id: true, name: true, email: true, phone: true, gymId: true, memberId: true, createdAt: true },
        }),
    ]);

    const planMap = Object.fromEntries(fitPassPlans.map(p => [p.id, p]));
    const memberById = new Map(members.map(m => [m.id, m]));
    const memberByContact = new Map();
    members.forEach(m => {
        if (m.email) memberByContact.set(`email:${m.email.toLowerCase()}`, m);
        if (m.phone) memberByContact.set(`phone:${m.phone}`, m);
    });
    const matchedMemberIds = new Set();
    const roster = fitpassAccounts.map(account => {
        const member = (account.memberId && memberById.get(account.memberId))
            || (account.email && memberByContact.get(`email:${account.email.toLowerCase()}`))
            || (account.phone && memberByContact.get(`phone:${account.phone}`));
        if (member) matchedMemberIds.add(member.id);
        const subscribed = Boolean(member && planMap[member.planId]);
        const expired = subscribed && (member.status === 'Expired' || new Date(member.expiryDate) <= now);
        return {
            id: member?.id || account.id,
            userId: account.id,
            name: member?.name || account.name,
            phone: member?.phone || account.phone,
            email: member?.email || account.email,
            status: !subscribed ? 'No Subscription' : expired ? 'Expired' : 'Active',
            planId: subscribed ? member.planId : null,
            joinDate: member?.joinDate || account.createdAt,
            expiryDate: member?.expiryDate || null,
            sessionsTotal: member?.sessionsTotal || 0,
            sessionsRemaining: member?.sessionsRemaining || 0,
            sessionsUsed: member ? Math.max(0, (member.sessionsTotal || 0) - (member.sessionsRemaining || 0)) : 0,
            lastCheckInAt: member?.lastCheckInAt || null,
            gymId: member?.gymId || account.gymId,
            plan: subscribed ? planMap[member.planId] : null,
            isExpired: expired,
        };
    });
    members.filter(m => planMap[m.planId] && !matchedMemberIds.has(m.id)).forEach(member => {
        const expired = member.status === 'Expired' || new Date(member.expiryDate) <= now;
        roster.push({ ...member, sessionsUsed: Math.max(0, (member.sessionsTotal || 0) - (member.sessionsRemaining || 0)), plan: planMap[member.planId], isExpired: expired, status: expired ? 'Expired' : 'Active' });
    });

    let filtered = roster;
    if (req.query.status === 'Active') filtered = filtered.filter(m => m.status === 'Active');
    else if (req.query.status === 'Expired') filtered = filtered.filter(m => m.status === 'Expired');
    else if (req.query.status === 'No Subscription') filtered = filtered.filter(m => m.status === 'No Subscription');
    if (req.query.search) {
        const search = req.query.search.toLowerCase();
        filtered = filtered.filter(m => [m.name, m.phone, m.email, m.plan?.name].some(v => String(v || '').toLowerCase().includes(search)));
    }
    const total = filtered.length;
    const pageMembers = filtered.slice(skip, skip + pageSize);

    res.json({
        success: true,
        data: pageMembers,
        plans: fitPassPlans,
        meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
});

// @desc    Get FitPass revenue & plan breakdown analytics
// @route   GET /api/superadmin/fitpass/overview
// @access  Private (superadmin, fitpass_admin)
const getFitPassOverview = catchAsync(async (req, res, next) => {
    const now = new Date();

    // All SYSTEM plans
    const fitPassPlans = await prisma.plan.findMany({
        where: { gymId: 'SYSTEM', sessions: { gt: 0 } },
        select: { id: true, name: true, sessions: true, price: true },
    });
    const fitPassPlanIds = fitPassPlans.map(p => p.id);

    // All FitPass members
    const allMembers = await prisma.member.findMany({
        where: { planId: { in: fitPassPlanIds } },
        select: {
            id: true, status: true, expiryDate: true,
            sessionsTotal: true, sessionsRemaining: true,
            planId: true, planPrice: true, paidAmount: true,
            joinDate: true, lastCheckInAt: true,
        },
    });

    const active = allMembers.filter(m => m.status === 'Active' && new Date(m.expiryDate) > now);
    const expired = allMembers.filter(m => m.status !== 'Active' || new Date(m.expiryDate) <= now);

    // Sessions aggregates
    let totalSessionsSold = 0;
    let totalSessionsRemaining = 0;
    let totalRevenue = 0;
    let totalPaid = 0;

    allMembers.forEach(m => {
        totalSessionsSold += m.sessionsTotal || 0;
        totalSessionsRemaining += m.sessionsRemaining || 0;
        totalRevenue += m.planPrice || 0;
        totalPaid += m.paidAmount || 0;
    });

    // All check-in logs
    const successLogs = await prisma.fitPassAuditLog.findMany({
        where: { accessStatus: 'Success' },
        select: {
            gymIdVisited: true, gymName: true,
            checkInTimestamp: true, memberId: true,
        },
    });
    const failedLogs = await prisma.fitPassAuditLog.findMany({
        where: { accessStatus: 'Failed' },
        select: { checkInTimestamp: true, failureReason: true },
    });

    // Most visited gyms
    const gymCounts = {};
    successLogs.forEach(v => {
        if (!gymCounts[v.gymIdVisited]) {
            gymCounts[v.gymIdVisited] = { gymId: v.gymIdVisited, gymName: v.gymName, count: 0 };
        }
        gymCounts[v.gymIdVisited].count++;
    });
    const mostVisitedGyms = Object.values(gymCounts).sort((a, b) => b.count - a.count).slice(0, 10);

    // Daily traffic (last 30 days)
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const recentLogs = successLogs.filter(v => new Date(v.checkInTimestamp) >= thirtyDaysAgo);
    const dailyMap = {};
    recentLogs.forEach(v => {
        const d = v.checkInTimestamp.toISOString().split('T')[0];
        dailyMap[d] = (dailyMap[d] || 0) + 1;
    });
    const dailyTraffic = Object.entries(dailyMap)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

    // Monthly traffic
    const monthlyMap = {};
    successLogs.forEach(v => {
        const m = v.checkInTimestamp.toISOString().substring(0, 7);
        monthlyMap[m] = (monthlyMap[m] || 0) + 1;
    });
    const monthlyTraffic = Object.entries(monthlyMap)
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month));

    // Plan popularity
    const planPopularity = fitPassPlans.map(plan => {
        const planMembers = allMembers.filter(m => m.planId === plan.id);
        const planRevenue = planMembers.reduce((s, m) => s + (m.paidAmount || 0), 0);
        return {
            planId: plan.id,
            planName: plan.name,
            sessions: plan.sessions,
            price: plan.price,
            memberCount: planMembers.length,
            revenue: planRevenue,
        };
    }).sort((a, b) => b.memberCount - a.memberCount);

    // Avg visits per member
    const memberVisitCounts = {};
    successLogs.forEach(v => {
        memberVisitCounts[v.memberId] = (memberVisitCounts[v.memberId] || 0) + 1;
    });
    const visitsList = Object.values(memberVisitCounts);
    const avgVisits = visitsList.length > 0
        ? (visitsList.reduce((s, c) => s + c, 0) / visitsList.length).toFixed(1)
        : 0;

    // Failure reason breakdown
    const failureMap = {};
    failedLogs.forEach(v => {
        const reason = v.failureReason || 'Unknown';
        failureMap[reason] = (failureMap[reason] || 0) + 1;
    });
    const failureBreakdown = Object.entries(failureMap)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count);

    res.json({
        success: true,
        overview: {
            totalMembers: allMembers.length,
            activeMembers: active.length,
            expiredMembers: expired.length,
            totalSessionsSold,
            totalSessionsUsed: totalSessionsSold - totalSessionsRemaining,
            totalSessionsRemaining,
            totalRevenue,
            totalPaid,
            totalDues: totalRevenue - totalPaid,
            totalCheckIns: successLogs.length,
            totalFailedAttempts: failedLogs.length,
            avgVisitsPerMember: parseFloat(avgVisits),
            utilizationRate: totalSessionsSold > 0
                ? parseFloat(((totalSessionsSold - totalSessionsRemaining) / totalSessionsSold * 100).toFixed(1))
                : 0,
        },
        mostVisitedGyms,
        dailyTraffic,
        monthlyTraffic,
        planPopularity,
        failureBreakdown,
    });
});

// @desc    Adjust FitPass subscriber session credits
// @route   POST /api/superadmin/fitpass/users/:memberId/adjust-sessions
// @access  Private (superadmin, fitpass_admin)
const adjustUserSessions = catchAsync(async (req, res, next) => {
    const { memberId } = req.params;
    const { delta, reason } = req.body;

    if (delta === undefined || isNaN(Number(delta))) {
        res.status(400);
        throw new Error('Valid numeric session delta is required');
    }

    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) {
        res.status(404);
        throw new Error('Member not found');
    }

    const newSessions = Math.max(0, (member.sessionsRemaining || 0) + Number(delta));
    const newTotal = Number(delta) > 0 ? (member.sessionsTotal || 0) + Number(delta) : (member.sessionsTotal || 0);

    const updated = await prisma.member.update({
        where: { id: memberId },
        data: {
            sessionsRemaining: newSessions,
            sessionsTotal: newTotal,
        },
    });

    await logAudit(req, 'FITPASS_SESSIONS_ADJUSTED', 'Member', memberId, `Super admin adjusted sessions by ${delta} (Reason: ${reason || 'Admin adjustment'}). New balance: ${newSessions}`, member.name);

    res.json({
        success: true,
        data: updated,
        message: `Sessions adjusted successfully. New balance: ${newSessions}`,
    });
});

// @desc    Update FitPass subscriber status or extend membership expiry
// @route   PUT /api/superadmin/fitpass/users/:memberId/status
// @access  Private (superadmin, fitpass_admin)
const updateFitpassUserStatus = catchAsync(async (req, res, next) => {
    const { memberId } = req.params;
    const { status, extendDays, expiryDate } = req.body;

    const member = await prisma.member.findUnique({ where: { id: memberId } });
    if (!member) {
        res.status(404);
        throw new Error('Member not found');
    }

    const dataToUpdate = {};
    if (status) dataToUpdate.status = status;

    if (expiryDate) {
        dataToUpdate.expiryDate = new Date(expiryDate);
    } else if (extendDays && !isNaN(Number(extendDays))) {
        const currentExpiry = new Date(member.expiryDate > new Date() ? member.expiryDate : new Date());
        currentExpiry.setDate(currentExpiry.getDate() + Number(extendDays));
        dataToUpdate.expiryDate = currentExpiry;
    }

    const updated = await prisma.member.update({
        where: { id: memberId },
        data: dataToUpdate,
    });

    await logAudit(req, 'FITPASS_USER_UPDATED', 'Member', memberId, `Updated FitPass user status/expiry: ${status || 'No status change'}`, member.name);

    res.json({
        success: true,
        data: updated,
        message: 'Member account updated successfully',
    });
});

module.exports = {
    createPartnerGym,
    updatePartnerGym,
    getPartnerGyms,
    deletePartnerGym,
    createFitPrimePlan,
    updateFitPrimePlan,
    deleteFitPrimePlan,
    getFitPrimePlans,
    getOrCreateH4Gym,
    getDedicatedAdmins,
    createDedicatedAdmin,
    updateDedicatedAdmin,
    deleteDedicatedAdmin,
    getFitPassAuditLog,
    getFitPassMemberRoster,
    getFitPassOverview,
    adjustUserSessions,
    updateFitpassUserStatus,
};

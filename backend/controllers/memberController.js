const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Member = require('../models/Member');
const Plan = require('../models/Plan');
const User = require('../models/User');
const { jsonToCsv } = require('../utils/csvUtils');
const { logAudit } = require('../utils/auditLogger');
const { H4_GYM_IDS } = require('../config/constants');

const migrateLegacyH4Plan = async (plan, targetGymId) => {
    if (!plan || plan.gymId !== 'SYSTEM' || Number(plan.sessions) > 0 || !(Number(plan.duration) > 0)) return false;
    const gymId = String(targetGymId || '');
    let isH4 = H4_GYM_IDS.includes(gymId);
    if (!isH4 && gymId) {
        const Gym = require('../models/Gym');
        const gym = await Gym.findById(gymId).lean();
        isH4 = String(gym?.name || '').toLowerCase().includes('h4');
    }
    if (!isH4) return false;
    plan.gymId = gymId;
    await plan.save();
    return true;
};

// Helper to dynamically build member query based on role restrictions
const buildMemberQuery = async (req, memberId) => {
    const query = { ...req.tenantFilter };
    if (memberId) {
        query._id = memberId;
    }

    if (req.user.role === 'superadmin') {
        return query;
    }

    const currentGymId = String(req.user.gymId || '');
    const isH4Scope = req.user.role === 'h4_admin' || H4_GYM_IDS.includes(currentGymId);
    if (isH4Scope) {
        query.gymId = { $in: [...new Set([...H4_GYM_IDS, currentGymId].filter(Boolean))] };
        if (req.user.branchId) query.branchId = req.user.branchId;
        return query;
    }

    if (req.user.role === 'fitpass_admin') {
        const Gym = require('../models/Gym');
        const h4Gym = await Gym.findOne({ name: 'H4' });
        const h4GymId = h4Gym ? h4Gym._id.toString() : H4_GYM_IDS[0];
        if (req.user.gymId && req.user.gymId !== 'SYSTEM') {
            query.gymId = req.user.gymId;
        } else if (!query.gymId) {
            query.gymId = { $ne: h4GymId };
        }
    }
    return query;
};

// @desc    Create a new member
// @route   POST /api/members
// @access  Private/Admin
const createMember = catchAsync(async (req, res, next) => {
    try {
        const { name, phone, email, planId, joinDate, branchId, gymId } = req.body;

        if (!name || !phone || !planId) {
            res.status(400);
            return res.json({ success: false, message: 'Name, phone, and plan are required' });
        }

        const plan = await Plan.findById(planId);
        if (!plan) {
            res.status(404);
            return res.json({ success: false, message: 'Plan not found' });
        }

        // Check if a user with this email or generated email already exists to prevent unique constraint crash
        const emailCheck = email ? email : `${phone}@gym.com`;
        const existingUser = await User.findOne({ email: emailCheck });
        if (existingUser) {
            res.status(400);
            return res.json({ 
                success: false, 
                message: `A user or member with the email or phone number (${emailCheck}) already exists` 
            });
        }

        const durationDays = plan.duration || (plan.validityDays ? Number(plan.validityDays) : 30);
        const startDate = joinDate ? new Date(joinDate) : new Date();
        const expiryDate = new Date(startDate);
        expiryDate.setDate(startDate.getDate() + durationDays);

        const status = expiryDate < new Date() ? 'Expired' : 'Active';

        let targetGymId;
        if (req.user.gymId && req.user.gymId !== 'SYSTEM') {
            targetGymId = req.user.gymId;
        } else if (gymId) {
            targetGymId = gymId;
        } else if (plan && plan.gymId && plan.gymId !== 'SYSTEM') {
            targetGymId = plan.gymId;
        } else if (plan && plan.gymId === 'SYSTEM') {
            targetGymId = 'SYSTEM';
        } else if (req.tenantFilter && req.tenantFilter.gymId) {
            targetGymId = req.tenantFilter.gymId;
        } else {
            const Gym = require('../models/Gym');
            const h4Gym = await Gym.findOne({ name: 'H4' });
            targetGymId = h4Gym ? h4Gym._id.toString() : H4_GYM_IDS[0];
        }

        if (plan.gymId === 'SYSTEM' && Number(plan.sessions) <= 0) {
            await migrateLegacyH4Plan(plan, targetGymId);
        }
        if (plan.gymId === 'SYSTEM') {
            const fitPassAdminCreate = req.user.role === 'fitpass_admin'
                || (req.user.role === 'superadmin' && String(gymId || '') === 'SYSTEM');
            if (!fitPassAdminCreate || String(targetGymId) !== 'SYSTEM' || !(Number(plan.sessions) > 0)) {
                return res.status(400).json({ success: false, message: 'FitPass session plans are reserved for FitPass members. Use a gym membership plan for H4 registration.' });
            }
        }
        if (String(plan.gymId) !== String(targetGymId)) {
            return res.status(403).json({ success: false, message: 'This plan belongs to a different gym. Choose a plan from the member’s gym.' });
        }

        const targetBranchId = req.user.branchId || branchId || null;
        if (plan.branchId && String(plan.branchId) !== String(targetBranchId || '')) {
            return res.status(403).json({ success: false, message: 'This plan is assigned to a different branch.' });
        }

        const numericDiscount = Math.max(0, Number(req.body.discount) || 0);
        const catalogPrice = Number(plan.price) || 0;
        const netAgreedPrice = req.body.finalPrice !== undefined && req.body.finalPrice !== null && req.body.finalPrice !== ''
            ? Math.max(0, Number(req.body.finalPrice))
            : Math.max(0, catalogPrice - numericDiscount);

        const numericPaid = Number(req.body.paidAmount) || 0;

        const member = await Member.create({
            name,
            phone,
            email: email || null,
            planId,
            joinDate: startDate,
            expiryDate,
            status,
            planPrice: netAgreedPrice,
            paidAmount: numericPaid,
            ...(plan.gymId === 'SYSTEM' ? { sessionsRemaining: Number(plan.sessions) || 0, sessionsTotal: Number(plan.sessions) || 0 } : {}),
            gymId: targetGymId,
            branchId: targetBranchId
        });

        if (member) {
            // Create a User record for the member to allow login
            // Default password is password param or phone number
            const { password, paymentMethod = 'Cash' } = req.body;
            await User.create({
                name: member.name,
                email: emailCheck,
                password: password || member.phone,
                phone: member.phone,
                role: 'member',
                memberId: member._id,
                gymId: targetGymId,
                branchId: targetBranchId
            });

            // If an upfront payment was made during registration, record it in the payment ledger
            if (numericPaid > 0) {
                const Payment = require('../models/Payment');
                await Payment.create({
                    memberId: member._id,
                    amount: numericPaid,
                    method: paymentMethod,
                    date: startDate,
                    gymId: targetGymId,
                    branchId: targetBranchId
                });
            }

            await logAudit(
                req,
                'MEMBER_REGISTERED',
                'Member',
                member._id,
                `Registered new member ${member.name} with plan '${plan.name}' (Catalogue: ₹${catalogPrice}, Discount: ₹${numericDiscount}, Net Fee: ₹${netAgreedPrice}, Paid Upfront: ₹${numericPaid})`,
                member.name
            );

            if (req.body.questionnaire) {
                const q = req.body.questionnaire;
                const details = [
                    q.fitnessGoal && `Goal: ${q.fitnessGoal}`,
                    q.experienceLevel && `Experience: ${q.experienceLevel}`,
                    q.workoutFrequency && `Frequency: ${q.workoutFrequency}`,
                    q.dietPreference && `Diet: ${q.dietPreference}`,
                    q.medicalHistory && `Medical: ${q.medicalHistory}`,
                    (q.emergencyContactName || q.emergencyContactPhone) && `Emergency: ${q.emergencyContactName || ''} (${q.emergencyContactPhone || ''})`,
                    q.specialNotes && `Notes: ${q.specialNotes}`
                ].filter(Boolean).join(' | ');

                if (details) {
                    await logAudit(
                        req,
                        'MEMBER_ASSESSMENT',
                        'Member',
                        member._id,
                        `Onboarding Assessment Questionnaire: ${details}`,
                        member.name
                    );
                }
            }

            res.status(201).json(member);
        } else {
            res.status(400).json({ success: false, message: 'Invalid member data' });
        }
    } catch (error) { next(error); }
});

// @desc    Get all members with pagination and filters
// @route   GET /api/members
// @access  Private/Admin
const getMembers = catchAsync(async (req, res, next) => {
    try {
        const { status, page = 1, limit = 10, search = '' } = req.query;

        const query = await buildMemberQuery(req);

        if (status) query.status = status;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;

        const total = await Member.countDocuments(query);
        const members = await Member.find(query)
            .populate('planId', 'name price')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();

        const memberIds = members.map((member) => member._id || member.id);
        const linkedUsers = memberIds.length
            ? await User.find({ memberId: { $in: memberIds } }).select('memberId profileImageUrl').lean()
            : [];
        const profileImages = new Map(linkedUsers.map((user) => [String(user.memberId), user.profileImageUrl || null]));

        const { getMemberCode } = require('../utils/idGenerator');
        const formattedMembers = members.map((m, idx) => ({
            ...m,
            profileImageUrl: profileImages.get(String(m._id || m.id)) || null,
            empid: getMemberCode(m, skip + idx),
            displayId: getMemberCode(m, skip + idx)
        }));

        res.json({
            members: formattedMembers,
            page: Number(page),
            pages: Math.ceil(total / limit),
            total
        });
    } catch (error) { next(error); }
});

// @desc    Get members expiring soon (within 7 days)
// @route   GET /api/members/expiring-soon
// @access  Private/Admin
const getExpiringSoonMembers = catchAsync(async (req, res, next) => {
    try {
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);

        const query = await buildMemberQuery(req);
        query.status = 'Active';
        query.expiryDate = { $gte: today, $lte: nextWeek };

        const members = await Member.find(query).populate('planId', 'name price').lean();

        res.json(members);
    } catch (error) { next(error); }
});

// @desc    Get single member
// @route   GET /api/members/:id
// @access  Private/Admin
const getPlanById = catchAsync(async (req, res, next) => {
    // Legacy placeholder
});
const getMemberById = catchAsync(async (req, res, next) => {
    try {
        const query = await buildMemberQuery(req, req.params.id);
        const member = await Member.findOne(query)
            .populate('planId', 'name price')
            .lean();

        if (member) {
            res.json(member);
        } else {
            res.status(404).json({ success: false, message: 'Member not found' });
        }
    } catch (error) { next(error); }
});

// @desc    Update member
// @route   PUT /api/members/:id
// @access  Private/Admin
const updateMember = catchAsync(async (req, res, next) => {
    try {
        const { name, phone, email, planId, status, joinDate, branchId, gymId, password, discount = 0, finalPrice, paidAmount = 0, method = 'Cash' } = req.body;

        const query = await buildMemberQuery(req, req.params.id);
        const member = await Member.findOne(query);

        if (member) {
            const oldPhone = member.phone;
            const originalGymId = member.gymId ? member.gymId.toString() : '';

            if (planId) {
                const plan = await Plan.findById(planId);
                const targetGymId = req.user.role === 'superadmin' && gymId ? String(gymId) : String(member.gymId || '');
                if (plan?.gymId === 'SYSTEM' && Number(plan.sessions) <= 0) await migrateLegacyH4Plan(plan, targetGymId);
                const isUnchangedFitPassPlan = String(planId) === String(member.planId?.toString()) && member.gymId === 'SYSTEM';
                if (plan && !isUnchangedFitPassPlan && (plan.gymId === 'SYSTEM' || String(plan.gymId) !== targetGymId)) {
                    return res.status(403).json({ success: false, message: 'Choose a membership plan from the member’s own division and gym.' });
                }
                if (plan?.branchId && member.branchId && String(plan.branchId) !== String(member.branchId)) {
                    return res.status(403).json({ success: false, message: 'This plan is assigned to a different branch.' });
                }
                if (!plan && planId !== member.planId?.toString()) {
                    return res.status(404).json({ success: false, message: 'Plan not found' });
                }
                if (plan) {
                    member.planId = planId;
                    const catPrice = Number(plan.price) || 0;
                    const disc = Math.max(0, Number(discount) || 0);
                    const netAgreed = finalPrice !== undefined && finalPrice !== null && finalPrice !== ''
                        ? Math.max(0, Number(finalPrice))
                        : (disc > 0 ? Math.max(0, catPrice - disc) : (member.planPrice || catPrice));

                    member.planPrice = netAgreed;

                    // Recalculate expiry if plan changes
                    const startDate = joinDate ? new Date(joinDate) : new Date(member.joinDate);
                    const expiryDate = new Date(startDate);
                    expiryDate.setDate(startDate.getDate() + (plan.duration || 30));
                    member.expiryDate = expiryDate;
                    member.status = expiryDate < new Date() ? 'Expired' : 'Active';

                    const numericPaid = Number(paidAmount) || 0;
                    if (numericPaid > 0) {
                        member.paidAmount = (member.paidAmount || 0) + numericPaid;
                        const Payment = require('../models/Payment');
                        await Payment.create({
                            memberId: member._id,
                            amount: numericPaid,
                            method: method || 'Cash',
                            date: new Date(),
                            gymId: member.gymId,
                            branchId: member.branchId || null
                        });
                    }
                }
            }

            member.name = name || member.name;
            member.phone = phone || member.phone;
            member.email = email || member.email;
            if (status) member.status = status;
            
            let divisionSwitched = false;
            let oldDivision = '';
            let newDivision = '';

            if ((req.user.role === 'superadmin' || req.user.role === 'fitpass_admin') && gymId && gymId !== originalGymId) {
                divisionSwitched = true;
                const Gym = require('../models/Gym');
                const oldGym = await Gym.findById(originalGymId);
                const newGym = await Gym.findById(gymId);
                oldDivision = oldGym ? oldGym.name : 'Unknown Division';
                newDivision = newGym ? newGym.name : 'Unknown Division';
                
                member.gymId = gymId;
                member.branchId = null;
            }

            if (branchId !== undefined) {
                member.branchId = branchId || null;
            }

            const updatedMember = await member.save();

            // Handle password update if provided
            if (password && password.trim() !== '') {
                const User = require('../models/User');
                const userDoc = await User.findOne({ 
                    $or: [
                        { phone: oldPhone },
                        { memberId: member._id }
                    ]
                });
                if (userDoc) {
                    userDoc.password = password.trim();
                    userDoc.phone = member.phone;
                    if (email) userDoc.email = email.trim().toLowerCase();
                    await userDoc.save();
                }
            }

            // Sync phone/email changes to auth User account
            if (phone || email) {
                const User = require('../models/User');
                const userDoc = await User.findOne({ 
                    $or: [
                        { phone: oldPhone },
                        { memberId: member._id }
                    ]
                });
                if (userDoc) {
                    if (phone) userDoc.phone = phone;
                    if (email) userDoc.email = email.trim().toLowerCase();
                    await userDoc.save();
                }
            }

            // If division was switched, record an audit trail event
            if (divisionSwitched) {
                await logAudit(
                    req,
                    'MEMBER_DIVISION_SWITCHED',
                    'Member',
                    member._id,
                    `Migrated ${member.name} from division '${oldDivision}' to '${newDivision}'`,
                    member.name
                );
            } else {
                await logAudit(req, 'MEMBER_UPDATED', 'Member', member._id, `Updated details for member ${member.name}`, member.name);
            }

            res.json(updatedMember);
        } else {
            res.status(404).json({ success: false, message: 'Member not found' });
        }
    } catch (error) { next(error); }
});

// @desc    Delete member
// @route   DELETE /api/members/:id
// @access  Private/Admin
const deleteMember = catchAsync(async (req, res, next) => {
    try {
        const query = await buildMemberQuery(req, req.params.id);
        const member = await Member.findOne(query);

        if (member) {
            const memberName = member.name;
            await member.deleteOne();
            await logAudit(req, 'MEMBER_DELETED', 'Member', req.params.id, `Deleted member ${memberName}`, memberName);
            res.json({ message: 'Member removed' });
        } else {
            res.status(404).json({ success: false, message: 'Member not found' });
        }
    } catch (error) { next(error); }
});

// @desc    Export members as CSV
// @route   GET /api/members/export/csv
// @access  Private/Admin
const exportMembersCSV = catchAsync(async (req, res, next) => {
    try {
        const query = await buildMemberQuery(req);
        const members = await Member.find(query).populate('planId', 'name').lean();

        const formattedData = members.map(m => ({
            Name: m.name,
            Phone: m.phone,
            Email: m.email || '',
            Plan: m.planId?.name || '',
            Expiry: m.expiryDate ? m.expiryDate.toISOString().split('T')[0] : '',
            Status: m.status
        }));

        const csv = jsonToCsv(formattedData, ['Name', 'Phone', 'Email', 'Plan', 'Expiry', 'Status']);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=members.csv');
        res.status(200).send(csv);
    } catch (error) { next(error); }
});

// @desc    Get member audit trail (history, division switches, and financial summary)
// @route   GET /api/members/:id/audit-trail
// @access  Private/Superadmin & Admin
const getMemberAuditTrail = catchAsync(async (req, res, next) => {
    try {
        const member = await Member.findById(req.params.id).populate('planId', 'name price');
        if (!member) {
            res.status(404);
            throw new Error('Member not found');
        }

        // Get all payments for this member
        const Payment = require('../models/Payment');
        const payments = await Payment.find({ memberId: member._id.toString() }).sort({ date: -1 }).lean();

        // Get all audit logs relating to this member
        const AuditLog = require('../models/AuditLog');
        const auditLogs = await AuditLog.find({
            $or: [
                { entityId: member._id.toString() },
                { entityName: member.name }
            ]
        }).sort({ createdAt: -1 }).lean();

        // Calculate financial numbers accurately
        const totalPaidFromPayments = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
        const catalogPrice = member.planId ? Number(member.planId.price) : (Number(member.planPrice) || 0);
        const agreedPrice = member.planPrice !== undefined && member.planPrice !== null && member.planPrice > 0 ? Number(member.planPrice) : catalogPrice;
        const discountAmount = Math.max(0, catalogPrice - agreedPrice);
        const currentCyclePaid = member.paidAmount !== undefined && member.paidAmount !== null ? Number(member.paidAmount) : totalPaidFromPayments;
        const pendingAmount = Math.max(0, agreedPrice - currentCyclePaid);

        // Fetch gym name
        const Gym = require('../models/Gym');
        const gym = await Gym.findById(member.gymId);
        const gymName = gym ? gym.name : 'Unknown Gym';

        // Check when division switches happened from audit logs
        const divisionSwitches = auditLogs
            .filter(log => log.action === 'MEMBER_DIVISION_SWITCHED')
            .map(log => ({
                details: log.details,
                timestamp: log.createdAt,
                performedBy: log.userName
            }));

        res.json({
            member: {
                id: member._id,
                name: member.name,
                email: member.email,
                phone: member.phone,
                joinDate: member.joinDate,
                joinMonth: new Date(member.joinDate).toLocaleString('default', { month: 'long', year: 'numeric' }),
                status: member.status,
                gymId: member.gymId,
                gymName: gymName,
                branchId: member.branchId,
                currentPlan: member.planId ? {
                    id: member.planId._id,
                    name: member.planId.name,
                    price: agreedPrice
                } : null,
                financials: {
                    catalogPrice,
                    discountAmount,
                    planPrice: agreedPrice,
                    paidAmount: currentCyclePaid,
                    lifetimePaid: totalPaidFromPayments,
                    pendingAmount: pendingAmount,
                    totalPaymentsCount: payments.length
                }
            },
            payments,
            divisionSwitches,
            auditLogs
        });
    } catch (error) { next(error); }
});

// @desc    Renew a member's plan
// @route   POST /api/members/:id/renew
// @access  Private/Admin
const renewMember = catchAsync(async (req, res, next) => {
    try {
        const { planId, paidAmount = 0, discount = 0, finalPrice, method = 'Cash' } = req.body;
        const member = await Member.findOne(await buildMemberQuery(req, req.params.id));
        if (!member) {
            return res.status(404).json({ success: false, message: 'Member not found' });
        }

        const plan = await Plan.findById(planId || member.planId);
        if (!plan) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }
        if (plan.gymId === 'SYSTEM' && Number(plan.sessions) <= 0) await migrateLegacyH4Plan(plan, member.gymId);
        if (member.gymId === 'SYSTEM' || plan.gymId === 'SYSTEM' || String(plan.gymId) !== String(member.gymId)) {
            return res.status(403).json({ success: false, message: 'FitPass subscriptions are renewed by members in the FitPass portal. Staff renewals must use a plan from the member’s gym.' });
        }
        if (plan.branchId && member.branchId && String(plan.branchId) !== String(member.branchId)) {
            return res.status(403).json({ success: false, message: 'This plan is assigned to a different branch.' });
        }

        const now = new Date();
        const baseDate = member.expiryDate && new Date(member.expiryDate) > now ? new Date(member.expiryDate) : now;
        const newExpiry = new Date(baseDate);
        if (plan.duration) {
            newExpiry.setDate(newExpiry.getDate() + plan.duration);
        } else {
            newExpiry.setDate(newExpiry.getDate() + 30);
        }

        const numericDiscount = Math.max(0, Number(discount) || 0);
        const catalogPrice = Number(plan.price) || 0;
        const netAgreedPrice = finalPrice !== undefined && finalPrice !== null && finalPrice !== ''
            ? Math.max(0, Number(finalPrice))
            : Math.max(0, catalogPrice - numericDiscount);

        member.planId = plan._id;
        member.expiryDate = newExpiry;
        member.status = 'Active';
        member.planPrice = netAgreedPrice;

        if (plan.sessions) {
            member.sessionsRemaining = (member.sessionsRemaining || 0) + plan.sessions;
            member.sessionsTotal = (member.sessionsTotal || 0) + plan.sessions;
        }

        const numericPaid = Number(paidAmount) || 0;
        // When renewing/shifting plan, member's paidAmount for this active plan cycle tracks the amount paid towards netAgreedPrice
        member.paidAmount = numericPaid;

        if (numericPaid > 0) {
            const Payment = require('../models/Payment');
            await Payment.create({
                memberId: member._id,
                amount: numericPaid,
                method,
                date: now,
                gymId: member.gymId,
                branchId: member.branchId || null
            });
        }

        await member.save();
        await logAudit(
            req,
            'MEMBER_RENEWED',
            'Member',
            member._id,
            `Renewed plan '${plan.name}' for ${member.name} (Catalogue: ₹${catalogPrice}, Discount: ₹${numericDiscount}, Net Fee: ₹${netAgreedPrice}, Paid: ₹${numericPaid})`,
            member.name
        );

        res.json({ success: true, member });
    } catch (error) { next(error); }
});

// @desc    Transfer member to a different branch
// @route   PUT /api/members/:id/transfer
// @access  Private/Admin
const transferMember = catchAsync(async (req, res, next) => {
    try {
        const { targetBranchId } = req.body;
        const member = await Member.findById(req.params.id);
        if (!member) {
            return res.status(404).json({ success: false, message: 'Member not found' });
        }

        member.branchId = targetBranchId || null;
        await member.save();

        // Also update linked user account if exists
        await User.updateMany({ memberId: member._id }, { branchId: targetBranchId || null });

        await logAudit(req, 'MEMBER_TRANSFERRED', 'Member', member._id, `Transferred ${member.name} to branch ID ${targetBranchId}`, member.name);

        res.json({ success: true, member });
    } catch (error) { next(error); }
});

module.exports = {
    createMember,
    getMembers,
    getMemberById,
    updateMember,
    deleteMember,
    getExpiringSoonMembers,
    exportMembersCSV,
    getMemberAuditTrail,
    renewMember,
    transferMember,
};


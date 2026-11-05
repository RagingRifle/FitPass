const catchAsync = require('../utils/catchAsync');
const Member = require('../models/Member');

const resumeFrozenMember = async (member, resumeAt = new Date(), automatic = false) => {
    const history = Array.isArray(member.freezeHistory) ? member.freezeHistory : [];
    const openFreeze = [...history].reverse().find(record => !record.unfreezeDate);
    if (!openFreeze) return null;

    const unfreezeDate = new Date(resumeAt);
    const freezeDate = new Date(openFreeze.freezeDate);
    const frozenMs = Math.max(0, unfreezeDate.getTime() - freezeDate.getTime());
    const daysAdded = Math.ceil(frozenMs / (1000 * 60 * 60 * 24));
    const remainingMsAtFreeze = openFreeze.remainingMsAtFreeze !== null
        && openFreeze.remainingMsAtFreeze !== undefined
        && Number.isFinite(Number(openFreeze.remainingMsAtFreeze))
        ? Number(openFreeze.remainingMsAtFreeze)
        : null;

    openFreeze.unfreezeDate = unfreezeDate;
    openFreeze.daysAdded = daysAdded;
    openFreeze.autoUnfrozen = automatic;

    if (remainingMsAtFreeze !== null) {
        member.expiryDate = new Date(unfreezeDate.getTime() + remainingMsAtFreeze);
    } else if (member.expiryDate) {
        // Backward compatibility for freezes created before remaining time was stored.
        const expiry = new Date(member.expiryDate);
        expiry.setDate(expiry.getDate() + daysAdded);
        member.expiryDate = expiry;
    }

    member.scheduledUnfreezeAt = null;
    member.status = member.expiryDate && new Date(member.expiryDate) <= unfreezeDate ? 'Expired' : 'Active';
    await member.save();
    return { daysAdded, newExpiryDate: member.expiryDate };
};

// @desc    Freeze a member's membership
// @route   POST /api/members/:id/freeze
// @access  Private/Admin/Receptionist
const freezeMember = catchAsync(async (req, res, next) => {
    try {
        const query = { _id: req.params.id, gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }) };
        if (req.user.branchId) {
            query.branchId = req.user.branchId;
        }
        const member = await Member.findOne(query);
        if (!member) return res.status(404).json({ message: 'Member not found' });
        if (member.status === 'Frozen') return res.status(400).json({ message: 'Member is already frozen' });

        const { reason, mode = 'manual', scheduledUnfreezeAt } = req.body;
        const shouldSchedule = mode === 'scheduled';
        const scheduledDate = shouldSchedule && scheduledUnfreezeAt ? new Date(scheduledUnfreezeAt) : null;
        if (shouldSchedule && (!scheduledDate || Number.isNaN(scheduledDate.getTime()) || scheduledDate <= new Date())) {
            return res.status(400).json({ message: 'Choose an automatic resume time in the future.' });
        }

        const freezeDate = new Date();
        member.status = 'Frozen';
        member.scheduledUnfreezeAt = scheduledDate;
        member.freezeHistory.push({
            freezeDate,
            reason: reason || '',
            mode: shouldSchedule ? 'scheduled' : 'manual',
            scheduledUnfreezeAt: scheduledDate,
            remainingMsAtFreeze: member.expiryDate ? Math.max(0, new Date(member.expiryDate).getTime() - freezeDate.getTime()) : null
        });
        await member.save();

        res.json({ message: shouldSchedule ? 'Membership paused with automatic resume scheduled.' : 'Membership paused until manually released.', member });
    } catch (error) { next(error); }
});

// @desc    Unfreeze a member's membership (adds frozen days to expiry)
// @route   POST /api/members/:id/unfreeze
// @access  Private/Admin/Receptionist
const unfreezeMember = catchAsync(async (req, res, next) => {
    try {
        const query = { _id: req.params.id, gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }) };
        if (req.user.branchId) {
            query.branchId = req.user.branchId;
        }
        const member = await Member.findOne(query);
        if (!member) return res.status(404).json({ message: 'Member not found' });
        if (member.status !== 'Frozen') return res.status(400).json({ message: 'Member is not frozen' });

        const result = await resumeFrozenMember(member);
        if (!result) return res.status(400).json({ message: 'No active freeze record found' });

        res.json({
            message: `Member unfrozen. Remaining membership time restored (${result.daysAdded} day(s) paused).`,
            daysAdded: result.daysAdded,
            newExpiryDate: result.newExpiryDate,
            member
        });
    } catch (error) { next(error); }
});

// @desc    Get freeze history for a member
// @route   GET /api/members/:id/freeze-history
// @access  Private/Admin/Receptionist
const getFreezeHistory = catchAsync(async (req, res, next) => {
    try {
        const query = { _id: req.params.id, gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }) };
        if (req.user.branchId) {
            query.branchId = req.user.branchId;
        }
        const member = await Member.findOne(query).select('name freezeHistory status scheduledUnfreezeAt');
        if (!member) return res.status(404).json({ message: 'Member not found' });
        res.json({ name: member.name, status: member.status, freezeHistory: member.freezeHistory });
    } catch (error) { next(error); }
});

const autoUnfreezeDueMembers = async (now = new Date()) => {
    const dueMembers = await Member.find({ status: 'Frozen', scheduledUnfreezeAt: { $lte: now } });
    let resumed = 0;
    for (const member of dueMembers) {
        const result = await resumeFrozenMember(member, now, true);
        if (result) resumed += 1;
    }
    return resumed;
};

module.exports = { freezeMember, unfreezeMember, getFreezeHistory, autoUnfreezeDueMembers };

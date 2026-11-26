const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const GymClass = require('../models/GymClass');
const Member = require('../models/Member');
const prisma = require('../config/prisma');
const { verifyMemberPass, verifyBackupPIN } = require('../utils/totpHelper');
const { H4_GYM_IDS } = require('../config/constants');

const isH4GymId = (gymId) => H4_GYM_IDS.includes(String(gymId || ''));
const parseClassBookings = (value) => {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
};
const classStartsAt = (gymClass) => {
    const classDate = new Date(gymClass.scheduleDate).toISOString().slice(0, 10);
    return new Date(`${classDate}T${gymClass.startTime || '00:00'}:00+05:30`);
};
const trainerMay = (req, permission) => req.user?.role !== 'trainer' || req.user?.trainerPermissions?.[permission] !== false;
const canManageClass = (req, gymClass) => {
    if (req.user?.role === 'superadmin') return true;
    if (['h4_admin', 'h4_branch_admin'].includes(req.user?.role)) {
        return String(gymClass.gymId) === String(req.user.gymId)
            && (!req.user.branchId || String(gymClass.branchId || '') === String(req.user.branchId));
    }
    if (req.user?.role === 'fitpass_admin') return !isH4GymId(gymClass.gymId) && (req.user.gymId === 'SYSTEM' || String(gymClass.gymId) === String(req.user.gymId)) && (!req.user.branchId || String(gymClass.branchId || '') === String(req.user.branchId));
    return String(gymClass.gymId) === String(req.user?.gymId) && (!req.user.branchId || String(gymClass.branchId || '') === String(req.user.branchId));
};

const reserveClassSeat = async ({ classId, memberId, memberName, bookedBy }) => {
    const coinRate = await prisma.coinSettings.findUnique({ where: { division: 'fitpass' } }).catch(() => null);
    const migrationRate = coinRate?.coinsPerSession || 10;
    return prisma.$transaction(async (tx) => {
        const [gymClass, member] = await Promise.all([
            tx.gymClass.findUnique({ where: { id: classId } }),
            tx.member.findUnique({ where: { id: memberId } }),
        ]);
        if (!gymClass) throw new AppError('Class not found.', 404);
        if (!member) throw new AppError('Member profile not found.', 404);
        const classIsH4 = isH4GymId(gymClass.gymId);
        const memberIsH4 = isH4GymId(member.gymId);
        if (classIsH4 !== memberIsH4 || (classIsH4 && String(gymClass.gymId) !== String(member.gymId))) throw new AppError('This class is not available to this member.', 404);

        const bookings = parseClassBookings(gymClass.bookings);
        if (bookings.some((booking) => String(booking?.memberId || booking) === String(memberId))) throw new AppError('Already booked this class.', 409);
        if (gymClass.bookingDeadline && new Date() > new Date(gymClass.bookingDeadline)) throw new AppError('Booking for this class has closed.', 409);
        if (classStartsAt(gymClass) <= new Date()) throw new AppError('This class has already started.', 409);
        if (bookings.length >= gymClass.maxSeats) throw new AppError('Class is full.', 409);

        let currentCoins = member.fitpassCoins || 0;
        if (!member.coinsMigrated) {
            const migratedCoins = currentCoins + (member.sessionsRemaining || 0) * migrationRate;
            await tx.member.updateMany({ where: { id: member.id, coinsMigrated: false }, data: { fitpassCoins: migratedCoins, coinsMigrated: true } });
            const refreshed = await tx.member.findUnique({ where: { id: member.id } });
            currentCoins = refreshed?.fitpassCoins || 0;
        }

        const price = gymClass.isAddOn ? Number(gymClass.priceCoins) || 0 : 0;
        if (gymClass.isAddOn && price < 1) throw new AppError('This add-on is not available for booking.', 409);
        if (price > 0) {
            const debit = await tx.member.updateMany({ where: { id: member.id, fitpassCoins: { gte: price } }, data: { fitpassCoins: { decrement: price } } });
            if (!debit.count) throw new AppError(`You need ${price} FitCoins to book this class. Your balance is ${currentCoins}.`, 402, 'INSUFFICIENT_COINS');
        }

        const nextBookings = [...bookings, { memberId, memberName: memberName || member.name || 'Member', bookedAt: new Date(), status: 'Reserved', bookedBy, ...(price > 0 ? { coinsCharged: price } : {}) }];
        const updated = await tx.gymClass.updateMany({ where: { id: gymClass.id, bookings: gymClass.bookings }, data: { bookings: JSON.stringify(nextBookings) } });
        if (!updated.count) throw new AppError('That seat was just taken. Refresh the schedule and try another time.', 409);
        if (price > 0) await tx.classCoinTransaction.createMany({ data: [
            { memberId: member.id, classId: gymClass.id, className: gymClass.name, gymId: gymClass.gymId, branchId: gymClass.branchId, amount: price, direction: 'DEBIT' },
            { memberId: member.id, classId: gymClass.id, className: gymClass.name, gymId: gymClass.gymId, branchId: gymClass.branchId, amount: price, direction: 'PARTNER_EARNING' },
        ] });
        const balance = await tx.member.findUnique({ where: { id: member.id }, select: { fitpassCoins: true } });
        return { seatsAvailable: Math.max(0, gymClass.maxSeats - nextBookings.length), balance: balance?.fitpassCoins || 0, coinsCharged: price, className: gymClass.name, gymId: gymClass.gymId, scheduleDate: gymClass.scheduleDate };
    });
};

const cancelClassSeat = async ({ classId, memberId }) => prisma.$transaction(async (tx) => {
    const gymClass = await tx.gymClass.findUnique({ where: { id: classId } });
    if (!gymClass) throw new AppError('Class not found.', 404);
    const bookings = parseClassBookings(gymClass.bookings);
    const index = bookings.findIndex((booking) => String(booking?.memberId || booking) === String(memberId));
    if (index < 0) throw new AppError('No booking found for this class.', 404);
    if (bookings[index]?.status === 'Attended') throw new AppError('Attended classes cannot be cancelled or refunded.', 409);
    const startsAt = classStartsAt(gymClass);
    if (startsAt <= new Date()) throw new AppError('This booking can no longer be cancelled.', 409);

    const booking = bookings[index];
    const nextBookings = bookings.filter((_, bookingIndex) => bookingIndex !== index);
    const updated = await tx.gymClass.updateMany({ where: { id: gymClass.id, bookings: gymClass.bookings }, data: { bookings: JSON.stringify(nextBookings) } });
    if (!updated.count) throw new AppError('The class roster changed. Refresh and try again.', 409);
    const refund = Number(booking?.coinsCharged) || 0;
    if (refund > 0) {
        await tx.member.update({ where: { id: memberId }, data: { fitpassCoins: { increment: refund } } });
        await tx.classCoinTransaction.createMany({ data: [
            { memberId, classId: gymClass.id, className: gymClass.name, gymId: gymClass.gymId, branchId: gymClass.branchId, amount: refund, direction: 'REFUND' },
            { memberId, classId: gymClass.id, className: gymClass.name, gymId: gymClass.gymId, branchId: gymClass.branchId, amount: refund, direction: 'PARTNER_EARNING_REVERSAL' },
        ] });
    }
    const balance = await tx.member.findUnique({ where: { id: memberId }, select: { fitpassCoins: true } });
    return { seatsAvailable: gymClass.maxSeats - nextBookings.length, balance: balance?.fitpassCoins || 0, coinsRefunded: refund };
});

// Helper: load branch details map
const getBranchesMap = async () => {
    try {
        const branches = await prisma.branch.findMany({ select: { id: true, name: true, address: true, gymId: true, fitPassEnabled: true } });
        const gymIds = [...new Set(branches.map((branch) => branch.gymId).filter(Boolean))];
        const gyms = gymIds.length ? await prisma.gym.findMany({ where: { id: { in: gymIds } }, select: { id: true, name: true } }) : [];
        const gymMap = new Map(gyms.map((gym) => [String(gym.id), gym.name]));
        return new Map(branches.map((branch) => [branch.id, { ...branch, gymName: gymMap.get(String(branch.gymId)) || '' }]));
    } catch {
        return new Map();
    }
};

// @desc    Get all classes for a gym / branch
// @route   GET /api/classes
// @access  Private/Admin/Trainer
const getClasses = catchAsync(async (req, res, next) => {
    try {
        if (req.user.role === 'trainer' && !req.user.branchId) return res.json([]);
        const query = { ...req.tenantFilter, ...(req.query.isAddOn === 'true' ? { isAddOn: true } : {}) };
        const [classes, branchMap] = await Promise.all([
            GymClass.find(query).sort({ scheduleDate: 1 }).lean(),
            getBranchesMap()
        ]);

        const result = classes.map(c => {
            const branch = c.branchId ? branchMap.get(c.branchId) : null;
            const bookingsList = Array.isArray(c.bookings) ? c.bookings : [];
            const attendedCount = bookingsList.filter(b => b && (b.status === 'Attended' || b.attended === true)).length;

            return {
                ...c,
                branchName: branch ? branch.name : 'All Studios / Main',
                branchAddress: branch ? branch.address : '',
                gymName: branch?.gymName || '',
                seatsAvailable: Math.max(0, c.maxSeats - bookingsList.length),
                attendedCount,
                isBookingClosed: !!((c.bookingDeadline && new Date() > new Date(c.bookingDeadline)) || classStartsAt(c) <= new Date())
            };
        });

        res.json(result);
    } catch (error) { next(error); }
});

// @desc    Create a class (supports single or multi-branch assignment)
// @route   POST /api/classes
// @access  Private/Admin/Trainer
const createClass = catchAsync(async (req, res, next) => {
    try {
        const { 
            name, 
            type, 
            description, 
            trainerName, 
            scheduleDate, 
            recurrence = 'none', repeatUntil,
            startTime, 
            endTime, 
            maxSeats, 
            bookingDeadline, 
            branchId, 
            branchIds,
            gymId: reqGymId,
            isAddOn = false,
            priceCoins = 0
        } = req.body;

        if (!name || !type || !scheduleDate || !startTime || !endTime || !maxSeats) {
            return res.status(400).json({ message: 'name, type, scheduleDate, startTime, endTime, maxSeats are required' });
        }
        const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
        if (!timePattern.test(startTime) || !timePattern.test(endTime) || endTime <= startTime) return res.status(400).json({ message: 'Enter a valid start and end time.' });
        const classDate = new Date(scheduleDate);
        if (!Number.isFinite(classDate.getTime()) || new Date(`${classDate.toISOString().slice(0, 10)}T${startTime}:00+05:30`) <= new Date()) return res.status(400).json({ message: 'Choose a future class date and time.' });
        const finalDate = recurrence === 'weekly' ? new Date(repeatUntil) : classDate;
        if (recurrence === 'weekly' && (!repeatUntil || !Number.isFinite(finalDate.getTime()) || finalDate < classDate || (finalDate - classDate) / 86400000 > 365)) return res.status(400).json({ message: 'Choose a repeat-until date within one year.' });

        const userRole = req.user.role;
        const callerGymId = req.user.gymId;
        if (userRole === 'trainer' && !trainerMay(req, 'scheduleClasses')) return res.status(403).json({ message: 'Your manager has disabled class scheduling for your account.' });
        if (userRole === 'trainer' && isAddOn && !trainerMay(req, 'setClassPricing')) return res.status(403).json({ message: 'Your manager has disabled FitCoin pricing for your account.' });
        const globalFitPassManager = userRole === 'fitpass_admin' || (userRole === 'superadmin' && !reqGymId && (!callerGymId || callerGymId === 'SYSTEM'));
        const effectiveGymId = globalFitPassManager ? null : (userRole === 'superadmin' ? (reqGymId || callerGymId) : callerGymId);
        if (isAddOn && isH4GymId(effectiveGymId)) return res.status(400).json({ message: 'Paid add-on classes are available for FitPass partner gyms only.' });
        if (isAddOn && (!Number.isInteger(Number(priceCoins)) || Number(priceCoins) < 1 || Number(priceCoins) > 100000)) return res.status(400).json({ message: 'Set a whole FitCoin price between 1 and 100,000.' });

        // Resolve branch targets
        let targetBranchIds = [];
        if (Array.isArray(branchIds) && branchIds.length > 0) {
            targetBranchIds = branchIds;
        } else if (branchId) {
            targetBranchIds = [branchId];
        } else if (req.user.branchId) {
            targetBranchIds = [req.user.branchId];
        } else {
            targetBranchIds = [null]; // All branches / generic
        }

        if (userRole === 'trainer') {
            if (!req.user.branchId) return res.status(403).json({ message: 'A trainer account must be assigned to a branch before scheduling classes.' });
            if (targetBranchIds.some((id) => id && String(id) !== String(req.user.branchId))) return res.status(403).json({ message: 'Trainers can only schedule classes at their assigned branch.' });
            targetBranchIds = [req.user.branchId];
        }
        const isBranchScopedH4Admin = userRole === 'h4_branch_admin' || userRole === 'h4_admin' && Boolean(req.user.branchId);
        if (isBranchScopedH4Admin) {
            if (!req.user.branchId || targetBranchIds.some((id) => String(id || '') !== String(req.user.branchId))) {
                return res.status(403).json({ message: 'H4 branch administrators can only schedule classes at their assigned branch.' });
            }
            targetBranchIds = [req.user.branchId];
        }
        if (userRole !== 'superadmin' && req.user.branchId && targetBranchIds.some((id) => id && String(id) !== String(req.user.branchId))) {
            return res.status(403).json({ message: 'You can only schedule classes at your assigned branch.' });
        }
        if (isAddOn && targetBranchIds.every((id) => !id) && globalFitPassManager) {
            return res.status(400).json({ message: 'Choose one or more FitPass-enabled partner branches for this add-on class.' });
        }
        if (isAddOn && targetBranchIds.every((id) => !id)) {
            const hasFitPassBranches = await prisma.branch.findFirst({ where: { gymId: effectiveGymId, fitPassEnabled: true }, select: { id: true } });
            if (hasFitPassBranches) return res.status(400).json({ message: 'Choose at least one FitPass-enabled branch for this add-on class.' });
        }

        // Branch and Gym validation according to hierarchy
        const branchRecords = await prisma.branch.findMany({
            where: { id: { in: targetBranchIds.filter(Boolean) } },
            select: { id: true, name: true, gymId: true, fitPassEnabled: true }
        });
        const branchMap = new Map(branchRecords.map(b => [b.id, b]));
        if (targetBranchIds.some((id) => id && (!branchMap.has(id) || (!globalFitPassManager && String(branchMap.get(id).gymId) !== String(effectiveGymId))))) {
            return res.status(400).json({ message: 'Choose branches that belong to your gym.' });
        }
        if (isAddOn && targetBranchIds.some((id) => id && !branchMap.get(id)?.fitPassEnabled)) return res.status(400).json({ message: 'Paid class add-ons can only be scheduled at FitPass-enabled branches.' });
        if (isAddOn && targetBranchIds.some((id) => id && isH4GymId(branchMap.get(id)?.gymId))) return res.status(400).json({ message: 'Paid add-on classes are available for FitPass partner gyms only.' });

        const createdClasses = [];

        for (const bId of targetBranchIds) {
            let effectiveGymId = callerGymId;
            let effectiveBranchId = bId || null;

            if (bId && branchMap.has(bId)) {
                const bInfo = branchMap.get(bId);
                // Permission checks
                if (['h4_admin', 'h4_branch_admin'].includes(userRole) || (userRole === 'admin' && H4_GYM_IDS.includes(callerGymId))) {
                    effectiveGymId = bInfo.gymId || callerGymId;
                } else if (userRole === 'superadmin' || userRole === 'fitpass_admin') {
                    effectiveGymId = bInfo.gymId || reqGymId || callerGymId;
                } else {
                    effectiveGymId = callerGymId;
                }
            } else if (reqGymId && userRole === 'superadmin') {
                effectiveGymId = reqGymId;
            }

            const occurrenceDates = [new Date(classDate)];
            if (recurrence === 'weekly') for (let next = new Date(classDate); (next.setDate(next.getDate() + 7), next <= finalDate);) occurrenceDates.push(new Date(next));
            for (const occurrenceDate of occurrenceDates) {
            const gymClass = await GymClass.create({
                name,
                type,
                description: description || '',
                trainerName: trainerName || '',
                scheduleDate: occurrenceDate,
                startTime,
                endTime,
                maxSeats: Number(maxSeats),
                isAddOn: !!isAddOn,
                priceCoins: isAddOn ? Number(priceCoins) : 0,
                bookingDeadline: bookingDeadline ? new Date(bookingDeadline) : null,
                gymId: effectiveGymId,
                branchId: effectiveBranchId,
                bookings: []
            });

            createdClasses.push(gymClass);
            }
        }

        res.status(201).json(createdClasses.length === 1 ? createdClasses[0] : createdClasses);
    } catch (error) { next(error); }
});

// @desc    Delete a class
// @route   DELETE /api/classes/:id
// @access  Private/Admin
const deleteClass = catchAsync(async (req, res, next) => {
    try {
        const query = { _id: req.params.id };
        if (req.user.role !== 'superadmin' && !(req.user.role === 'fitpass_admin' && req.user.gymId === 'SYSTEM')) {
            query.gymId = req.user.gymId;
            if (req.user.branchId) query.branchId = req.user.branchId;
        }

        const snapshot = await GymClass.findOne(query).lean();
        if (!snapshot) return res.status(404).json({ message: 'Class not found or unauthorized' });
        if (!canManageClass(req, snapshot)) return res.status(403).json({ message: 'This class is outside your gym or branch.' });
        await prisma.$transaction(async (tx) => {
            const current = await tx.gymClass.findUnique({ where: { id: String(snapshot.id || snapshot._id) } });
            if (!current) throw new AppError('Class not found.', 404);
            const deleted = await tx.gymClass.deleteMany({ where: { id: current.id, bookings: current.bookings } });
            if (!deleted.count) throw new AppError('The class roster changed. Refresh and try again.', 409);
            const refunds = parseClassBookings(current.bookings).filter((booking) => booking?.status !== 'Attended' && Number(booking?.coinsCharged) > 0);
            for (const booking of refunds) {
                const memberId = String(booking.memberId || '');
                const amount = Number(booking.coinsCharged);
                if (!memberId) continue;
                await tx.member.update({ where: { id: memberId }, data: { fitpassCoins: { increment: amount } } });
                await tx.classCoinTransaction.createMany({ data: [
                    { memberId, classId: current.id, className: current.name, gymId: current.gymId, branchId: current.branchId, amount, direction: 'REFUND' },
                    { memberId, classId: current.id, className: current.name, gymId: current.gymId, branchId: current.branchId, amount, direction: 'PARTNER_EARNING_REVERSAL' },
                ] });
            }
        });
        res.json({ message: 'Class deleted. Any unpaid reservations were refunded.' });
    } catch (error) { next(error); }
});

// @desc    Get bookings for a class (with attendee status)
// @route   GET /api/classes/:id/bookings
// @access  Private/Admin/Trainer
const getClassBookings = catchAsync(async (req, res, next) => {
    try {
        if (!trainerMay(req, 'manageClassBookings')) return res.status(403).json({ message: 'Your manager has disabled class roster access for your account.' });
        const query = { _id: req.params.id };
        if (req.user.role !== 'superadmin' && req.user.role !== 'h4_admin' && !(req.user.role === 'fitpass_admin' && req.user.gymId === 'SYSTEM')) {
            query.gymId = req.user.gymId;
            if (req.user.branchId) query.branchId = req.user.branchId;
        }

        const gymClass = await GymClass.findOne(query)
            .populate('bookings.memberId', 'name phone email');
        if (!gymClass) return res.status(404).json({ message: 'Class not found' });
        if (!canManageClass(req, gymClass)) return res.status(403).json({ message: 'This class is outside your gym or branch.' });
        if (req.user.role === 'trainer' && String(gymClass.branchId || '') !== String(req.user.branchId || '')) return res.status(403).json({ message: 'This class is outside your assigned branch.' });

        // Normalise bookings with status
        const bookings = (gymClass.bookings || []).map(b => {
            const memberObj = typeof b.memberId === 'object' && b.memberId !== null ? b.memberId : null;
            return {
                memberId: memberObj ? (memberObj._id || memberObj.id) : (b.memberId || ''),
                name: b.memberName || memberObj?.name || 'Member',
                phone: memberObj?.phone || '',
                email: memberObj?.email || '',
                bookedAt: b.bookedAt || new Date(),
                coinsCharged: Number(b.coinsCharged) || 0,
                status: b.status || (b.attended ? 'Attended' : 'Reserved'),
                attendedAt: b.attendedAt || null,
                verifiedByStaffId: b.verifiedByStaffId || null
            };
        });

        res.json({
            ...gymClass.toObject ? gymClass.toObject() : gymClass,
            bookings,
            attendedCount: bookings.filter(b => b.status === 'Attended').length
        });
    } catch (error) { next(error); }
});

const resolveMemberId = async (req) => {
    let memberId = req.user?.memberId;
    let gymId = req.user?.gymId;
    let branchId = req.user?.branchId || null;
    let memberName = req.user?.name || '';

    try {
        if (memberId) {
            const m = await Member.findById(memberId).select('gymId branchId name');
            if (m) {
                if (m.gymId) gymId = m.gymId;
                if (m.branchId) branchId = m.branchId;
                if (m.name) memberName = m.name;
            }
        }
        if (!memberId && req.user?.email) {
            const m = await Member.findOne({ email: req.user.email }).select('id gymId branchId name');
            if (m) {
                memberId = m._id || m.id;
                if (m.gymId) gymId = m.gymId;
                if (m.branchId) branchId = m.branchId;
                if (m.name) memberName = m.name;
            }
        }
    } catch (err) {
        // Fallback
    }
    return { memberId, gymId, branchId, memberName };
};

// @desc    Member views available classes (branch-scoped)
// @route   GET /api/member-portal/classes
// @access  Private/Member
const getMemberClasses = catchAsync(async (req, res, next) => {
    try {
        const { memberId, gymId } = await resolveMemberId(req);
        const member = memberId ? await prisma.member.findUnique({ where: { id: String(memberId) } }) : null;
        const h4Member = isH4GymId(member?.gymId || gymId);
        const query = { gymId: h4Member ? (member?.gymId || gymId) : { $nin: H4_GYM_IDS } };
        query.scheduleDate = { $gte: new Date() };
        const enabledBranches = await prisma.branch.findMany({ where: { fitPassEnabled: true }, select: { id: true } });
        const fitPassBranchIds = new Set(enabledBranches.map((branch) => String(branch.id)));
        let fitpassCoinBalance = member?.fitpassCoins || 0;
        if (member && !h4Member && !member.coinsMigrated) {
            const coinSettings = await prisma.coinSettings.findUnique({ where: { division: 'fitpass' } }).catch(() => null);
            const migratedBalance = fitpassCoinBalance + (member.sessionsRemaining || 0) * (coinSettings?.coinsPerSession || 10);
            await prisma.member.updateMany({ where: { id: member.id, coinsMigrated: false }, data: { fitpassCoins: migratedBalance, coinsMigrated: true } });
            const refreshed = await prisma.member.findUnique({ where: { id: member.id } });
            fitpassCoinBalance = refreshed?.fitpassCoins || 0;
        }

        const [classes, branchMap] = await Promise.all([
            GymClass.find(query).sort({ scheduleDate: 1, startTime: 1 }).lean(),
            getBranchesMap()
        ]);
        const gymIds = [...new Set(classes.map((gymClass) => String(gymClass.gymId)))];
        const gyms = gymIds.length ? await prisma.gym.findMany({ where: { id: { in: gymIds } }, select: { id: true, name: true } }) : [];
        const gymNames = new Map(gyms.map((gym) => [String(gym.id), gym.name]));

        const result = classes.filter((gymClass) => h4Member || !gymClass.branchId || fitPassBranchIds.has(String(gymClass.branchId))).map(c => {
            const branch = c.branchId ? branchMap.get(c.branchId) : null;
            const bookingsList = Array.isArray(c.bookings) ? c.bookings : [];
            const isBooked = memberId ? bookingsList.some(b => b && (b.memberId || b).toString() === memberId.toString()) : false;
            const userBooking = memberId ? bookingsList.find(b => b && (b.memberId || b).toString() === memberId.toString()) : null;

            return {
                ...c,
                id: c._id ? c._id.toString() : c.id,
                branchName: branch ? branch.name : 'Main Studio',
                branchAddress: branch ? branch.address : '',
                gymName: branch?.gymName || gymNames.get(String(c.gymId)) || '',
                imageUrl: c.imageUrl || getImageUrl(c.type, c.name),
                seatsAvailable: Math.max(0, (c.maxSeats || 10) - bookingsList.length),
                isBooked,
                fitpassCoinBalance: h4Member ? null : fitpassCoinBalance,
                bookingStatus: userBooking ? (userBooking.status || (userBooking.attended ? 'Attended' : 'Reserved')) : null,
                isBookingClosed: !!((c.bookingDeadline && new Date() > new Date(c.bookingDeadline)) || classStartsAt(c) <= new Date())
            };
        });

        res.json(result);
    } catch (error) { next(error); }
});

const getMemberClassWallet = catchAsync(async (req, res) => {
    const { memberId } = await resolveMemberId(req);
    if (!memberId) return res.status(404).json({ message: 'Member profile not found.' });
    let member = await prisma.member.findUnique({ where: { id: String(memberId) } });
    if (!member) return res.status(404).json({ message: 'Member profile not found.' });
    if (!isH4GymId(member.gymId) && !member.coinsMigrated) {
        const coinSettings = await prisma.coinSettings.findUnique({ where: { division: 'fitpass' } }).catch(() => null);
        const balance = (member.fitpassCoins || 0) + (member.sessionsRemaining || 0) * (coinSettings?.coinsPerSession || 10);
        await prisma.member.updateMany({ where: { id: member.id, coinsMigrated: false }, data: { fitpassCoins: balance, coinsMigrated: true } });
        member = await prisma.member.findUnique({ where: { id: member.id } });
    }
    res.json({ balance: isH4GymId(member.gymId) ? 0 : member.fitpassCoins || 0 });
});

// @desc    Member books a class slot
// @route   POST /api/member-portal/classes/:id/book
// @access  Private/Member
const bookClass = catchAsync(async (req, res, next) => {
    try {
        const { memberId, memberName } = await resolveMemberId(req);
        if (!memberId) return res.status(404).json({ message: 'Member profile not found' });

        const reservation = await reserveClassSeat({ classId: req.params.id, memberId: String(memberId), memberName, bookedBy: 'member' });

        // Dispatch In-App Notification to gym / branch manager
        try {
            await prisma.notification.create({
                data: {
                    recipientId: reservation.gymId,
                    gymId: reservation.gymId,
                    type: 'CLASS_BOOKING',
                    message: `${memberName || 'A member'} reserved a seat for ${reservation.className} on ${new Date(reservation.scheduleDate).toLocaleDateString()}`
                }
            });
        } catch {
            // Notification error should not fail booking
        }

        res.json({
            message: 'Class booked successfully',
            ...reservation,
            status: 'Reserved'
        });
    } catch (error) { next(error); }
});

// @desc    Member cancels a class booking
// @route   DELETE /api/member-portal/classes/:id/book
// @access  Private/Member
const cancelBooking = catchAsync(async (req, res, next) => {
    try {
        const { memberId } = await resolveMemberId(req);
        if (!memberId) return res.status(404).json({ message: 'Member profile not found' });

        const cancellation = await cancelClassSeat({ classId: req.params.id, memberId: String(memberId) });
        res.json({ message: 'Booking cancelled', ...cancellation });
    } catch (error) { next(error); }
});

// @desc    Trainer / Staff scans member QR to mark class attendance
// @route   POST /api/classes/:id/verify-attendee
// @access  Private/Admin/Trainer
const verifyClassAttendee = catchAsync(async (req, res, next) => {
    if (!trainerMay(req, 'manageClassBookings')) return res.status(403).json({ message: 'Your manager has disabled class attendance access for your account.' });
    const { tokenOrPass, memberId: manualMemberId } = req.body;
    const gymClass = await GymClass.findById(req.params.id);
    if (!gymClass) return res.status(404).json({ message: 'Class session not found' });
    if (!canManageClass(req, gymClass)) return res.status(403).json({ message: 'This class is outside your gym or branch.' });
    if (req.user.role === 'trainer' && String(gymClass.branchId || '') !== String(req.user.branchId || '')) return res.status(403).json({ message: 'This class is outside your assigned branch.' });

    let identifier = manualMemberId;

    if (tokenOrPass) {
        try {
            const parsed = JSON.parse(tokenOrPass);
            identifier = parsed.mid || parsed.memberId || parsed.id || tokenOrPass;
        } catch {
            identifier = tokenOrPass;
        }
    }

    if (!identifier) {
        return res.status(400).json({ message: 'Member ID or pass required' });
    }

    // Resolve member details
    const member = await prisma.member.findFirst({
        where: {
            OR: [
                { id: identifier },
                { phone: identifier }
            ]
        }
    });
    if (!member) return res.status(404).json({ message: 'Member record not found' });
    if (isH4GymId(member.gymId) !== isH4GymId(gymClass.gymId) || (isH4GymId(member.gymId) && String(member.gymId) !== String(gymClass.gymId))) return res.status(404).json({ message: 'Member is outside this class division.' });
    const verifiedMemberId = member.id;

    let bookings = gymClass.bookings || [];
    let bookingIndex = bookings.findIndex(
        b => b && (b.memberId || b).toString() === verifiedMemberId.toString()
    );

    const now = new Date();

    if (bookingIndex !== -1) {
        // Update existing booking status to Attended
        bookings[bookingIndex] = {
            ...bookings[bookingIndex],
            status: 'Attended',
            attended: true,
            attendedAt: now,
            verifiedByStaffId: req.user.id
        };
    } else {
        if (gymClass.isAddOn) return res.status(400).json({ message: 'Members must book and pay for this add-on class before attendance can be marked.' });
        // Walk-in attendee: check seat capacity
        if (bookings.length >= gymClass.maxSeats) {
            return res.status(400).json({ message: 'Class is at maximum capacity' });
        }
        bookings.push({
            memberId: verifiedMemberId,
            memberName: member.name,
            bookedAt: now,
            status: 'Attended',
            attended: true,
            attendedAt: now,
            verifiedByStaffId: req.user.id
        });
    }

    gymClass.bookings = bookings;
    await gymClass.save();

    res.json({
        success: true,
        message: `Attendance marked for ${member.name}`,
        member: { id: member.id, name: member.name },
        status: 'Attended',
        attendedAt: now
    });
});

// @desc    Admin manually toggles attendee status in roster
// @route   PUT /api/classes/:id/attendees/:memberId
// @access  Private/Admin/Trainer
const toggleAttendeeStatus = catchAsync(async (req, res, next) => {
    if (!trainerMay(req, 'manageClassBookings')) return res.status(403).json({ message: 'Your manager has disabled class attendance access for your account.' });
    const { id, memberId } = req.params;
    const { status } = req.body; // 'Attended' or 'Reserved'

    const gymClass = await GymClass.findById(id);
    if (!gymClass) return res.status(404).json({ message: 'Class not found' });
    if (!canManageClass(req, gymClass)) return res.status(403).json({ message: 'This class is outside your gym or branch.' });
    if (req.user.role === 'trainer' && String(gymClass.branchId || '') !== String(req.user.branchId || '')) return res.status(403).json({ message: 'This class is outside your assigned branch.' });

    const bookings = gymClass.bookings || [];
    const index = bookings.findIndex(b => b && (b.memberId || b).toString() === memberId.toString());
    if (index === -1) return res.status(404).json({ message: 'Member booking not found' });

    const newStatus = status === 'Attended' ? 'Attended' : 'Reserved';
    bookings[index] = {
        ...bookings[index],
        status: newStatus,
        attended: newStatus === 'Attended',
        attendedAt: newStatus === 'Attended' ? new Date() : null,
        verifiedByStaffId: newStatus === 'Attended' ? req.user.id : null
    };

    gymClass.bookings = bookings;
    await gymClass.save();

    res.json({
        success: true,
        message: `Attendee status updated to ${newStatus}`,
        bookings
    });
});

// @desc    Admin books a class for a member
// @route   POST /api/classes/:id/book
// @access  Private/Admin or Trainer
const adminBookClass = catchAsync(async (req, res, next) => {
    try {
        if (!trainerMay(req, 'manageClassBookings')) return res.status(403).json({ message: 'Your manager has disabled class roster access for your account.' });
        const { memberId } = req.body;
        if (!memberId) return res.status(400).json({ message: 'Member ID is required' });
        const classScope = await GymClass.findById(req.params.id).lean();
        if (!classScope) return res.status(404).json({ message: 'Class not found' });
        if (!canManageClass(req, classScope)) return res.status(403).json({ message: 'This class is outside your gym or branch.' });
        if (req.user.role === 'trainer' && (!req.user.branchId || String(classScope.branchId || '') !== String(req.user.branchId))) return res.status(403).json({ message: 'Trainers can only manage rosters at their assigned branch.' });
        const member = await prisma.member.findUnique({ where: { id: String(memberId) }, select: { name: true } });
        if (!member) return res.status(404).json({ message: 'Member not found' });
        const reservation = await reserveClassSeat({ classId: req.params.id, memberId: String(memberId), memberName: member.name, bookedBy: req.user.role });

        res.json({
            message: 'Class booked successfully by admin',
            ...reservation,
            bookings: (await GymClass.findById(req.params.id).lean())?.bookings || []
        });
    } catch (error) { next(error); }
});

// @desc    Admin cancels a member booking
// @route   DELETE /api/classes/:id/bookings/:memberId
// @access  Private/Admin or Trainer
const adminCancelBooking = catchAsync(async (req, res, next) => {
    try {
        if (!trainerMay(req, 'manageClassBookings')) return res.status(403).json({ message: 'Your manager has disabled class roster access for your account.' });
        const { memberId } = req.params;
        const classScope = await GymClass.findById(req.params.id).lean();
        if (!classScope) return res.status(404).json({ message: 'Class not found' });
        if (!canManageClass(req, classScope)) return res.status(403).json({ message: 'This class is outside your gym or branch.' });
        if (req.user.role === 'trainer' && String(classScope.branchId || '') !== String(req.user.branchId || '')) return res.status(403).json({ message: 'This class is outside your assigned branch.' });
        const cancellation = await cancelClassSeat({ classId: req.params.id, memberId: String(memberId) });

        res.json({
            message: 'Booking cancelled by admin',
            ...cancellation,
            bookings: (await GymClass.findById(req.params.id).lean())?.bookings || []
        });
    } catch (error) { next(error); }
});

const CLASS_IMAGES = {
    hiit: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop&q=80',
    yoga: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=600&auto=format&fit=crop&q=80',
    strength: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&auto=format&fit=crop&q=80',
    cardio: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&auto=format&fit=crop&q=80',
    combat: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=600&auto=format&fit=crop&q=80',
    pilates: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&auto=format&fit=crop&q=80',
    default: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=600&auto=format&fit=crop&q=80'
};

const getImageUrl = (type, name) => {
    const key = (type || name || '').toLowerCase();
    if (key.includes('hiit')) return CLASS_IMAGES.hiit;
    if (key.includes('yoga')) return CLASS_IMAGES.yoga;
    if (key.includes('strength') || key.includes('barbell')) return CLASS_IMAGES.strength;
    if (key.includes('cardio') || key.includes('zumba')) return CLASS_IMAGES.cardio;
    if (key.includes('combat') || key.includes('boxing')) return CLASS_IMAGES.combat;
    if (key.includes('pilates')) return CLASS_IMAGES.pilates;
    return CLASS_IMAGES.default;
};

module.exports = { 
    getClasses, 
    createClass, 
    deleteClass, 
    getClassBookings, 
    bookClass, 
    cancelBooking, 
    getMemberClasses,
    getMemberClassWallet,
    adminBookClass,
    adminCancelBooking,
    verifyClassAttendee,
    toggleAttendeeStatus
};

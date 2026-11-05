const catchAsync = require('../utils/catchAsync');
const prisma = require('../config/prisma');

const getGymId = (req) => req.user?.gymId && req.user.gymId !== 'SYSTEM' ? req.user.gymId : req.headers['x-gym-id'];
const parseExercises = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
    }
    return [];
};
const getLoggedAt = (value) => {
    const date = value ? new Date(value) : new Date();
    return Number.isNaN(date.getTime()) ? null : date;
};
const buildDateRange = (from, to, offset = 0) => {
    const offsetMinutes = Number(offset) || 0;
    const boundary = (value, nextDay = false) => {
        const [year, month, day] = value.split('-').map(Number);
        const timestamp = Date.UTC(year, month - 1, day + (nextDay ? 1 : 0)) - offsetMinutes * 60_000;
        return new Date(timestamp - (nextDay ? 1 : 0));
    };
    if (!from && !to) return undefined;
    return { ...(from ? { gte: boundary(from) } : {}), ...(to ? { lte: boundary(to, true) } : {}) };
};

async function resolveMember(req, requestedMemberId) {
    const gymId = getGymId(req);
    const memberId = req.user.role === 'member' ? req.user.memberId : requestedMemberId;
    if (!gymId || !memberId) return null;
    return prisma.member.findFirst({
        where: {
            id: String(memberId),
            gymId,
            ...(req.user.branchId ? { branchId: req.user.branchId } : {})
        },
        select: { id: true, name: true, phone: true, registrationNumber: true, gymId: true, branchId: true }
    });
}

async function resolvePlan(kind, planId, member, req) {
    if (!planId) return null;
    const model = kind === 'nutrition' ? prisma.dietPlan : prisma.workoutPlan;
    const plan = await model.findFirst({ where: { id: String(planId), gymId: member.gymId } });
    if (!plan) return null;
    if (kind === 'workout') {
        let assignedMemberIds = [plan.memberId].filter(Boolean).map(String);
        try { if (plan.memberIds) assignedMemberIds = [...assignedMemberIds, ...JSON.parse(plan.memberIds).map(String)]; } catch {}
        if (!assignedMemberIds.includes(member.id)) return null;
    }
    if (kind === 'nutrition') {
        let memberIds = [plan.memberId].filter(Boolean).map(String);
        try { if (plan.memberIds) memberIds = [...memberIds, ...JSON.parse(plan.memberIds).map(String)]; } catch {}
        if (!memberIds.includes(member.id)) return null;
    }
    if (req.user.role === 'trainer' && String(plan.trainerId || '') !== String(req.user.id || '')) return null;
    return plan;
}

const getNutritionLogs = catchAsync(async (req, res) => {
    const gymId = getGymId(req);
    if (!gymId) return res.status(400).json({ message: 'Select a gym to view nutrition progress.' });
    const { memberId, trainerId, branchId, from, to, search = '', timezoneOffset = 0 } = req.query;
    const where = { gymId };
    if (req.user.role === 'member') {
        if (!req.user.memberId) return res.status(403).json({ message: 'This account is not linked to a member profile.' });
        where.memberId = req.user.memberId;
    }
    else if (memberId) where.memberId = memberId;
    if (req.user.role === 'trainer') where.trainerId = req.user.id;
    else if (trainerId) where.trainerId = trainerId;
    if (req.user.branchId) where.branchId = req.user.branchId;
    else if (branchId) where.branchId = branchId;
    const loggedAt = buildDateRange(from, to, timezoneOffset);
    if (loggedAt) where.loggedAt = loggedAt;
    const term = String(search).trim();
    if (term && req.user.role !== 'member') {
        const matchingMembers = await prisma.member.findMany({
            where: { gymId, OR: [
                { name: { contains: term, mode: 'insensitive' } },
                { phone: { contains: term, mode: 'insensitive' } },
                { registrationNumber: { contains: term, mode: 'insensitive' } },
                { id: { contains: term, mode: 'insensitive' } }
            ] }, select: { id: true }
        });
        where.memberId = { in: matchingMembers.map(member => member.id) };
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 1000);
    const logs = await prisma.nutritionLog.findMany({ where, orderBy: { loggedAt: 'desc' }, take: limit });
    const result = await attachProgressIdentity(logs, gymId, 'nutrition');
    res.json(result);
});

const createNutritionLog = catchAsync(async (req, res) => {
    const member = await resolveMember(req, req.body.memberId);
    if (!member) return res.status(404).json({ success: false, message: 'Member not found in your gym or branch.' });
    const plan = await resolvePlan('nutrition', req.body.planId, member, req);
    if (req.body.planId && !plan) return res.status(403).json({ success: false, message: 'The selected diet plan is not assigned to this member.' });
    const loggedAt = getLoggedAt(req.body.loggedAt);
    if (!loggedAt) return res.status(400).json({ success: false, message: 'Enter a valid log date.' });
    const number = (value) => Math.max(0, Number(value) || 0);
    const record = await prisma.nutritionLog.create({ data: {
        memberId: member.id,
        planId: plan?.id || null,
        trainerId: plan?.trainerId || (req.user.role === 'trainer' ? req.user.id : null),
        recordedById: req.user.id || null,
        planName: plan?.name || String(req.body.planName || 'Nutrition log'),
        mealCount: Math.floor(number(req.body.mealCount)),
        completedMeals: Math.floor(Math.min(number(req.body.completedMeals), number(req.body.mealCount))),
        calories: number(req.body.calories),
        protein: number(req.body.protein),
        carbs: number(req.body.carbs),
        fats: number(req.body.fats),
        waterCups: Math.floor(number(req.body.waterCups)),
        notes: String(req.body.notes || '').slice(0, 1000),
        loggedAt,
        gymId: member.gymId,
        branchId: req.user.branchId || member.branchId || null
    } });
    res.status(201).json({ success: true, log: (await attachProgressIdentity([record], member.gymId, 'nutrition'))[0] });
});

const getWorkoutLogs = catchAsync(async (req, res) => {
    const gymId = getGymId(req);
    if (!gymId) return res.status(400).json({ message: 'Select a gym to view training progress.' });
    const { memberId, trainerId, branchId, from, to, search = '' } = req.query;
    const where = { gymId };
    if (req.user.role === 'member') {
        if (!req.user.memberId) return res.status(403).json({ message: 'This account is not linked to a member profile.' });
        where.memberId = req.user.memberId;
    }
    else if (memberId) where.memberId = memberId;
    if (req.user.role === 'trainer') where.trainerId = req.user.id;
    else if (trainerId) where.trainerId = trainerId;
    if (req.user.branchId) where.branchId = req.user.branchId;
    else if (branchId) where.branchId = branchId;
    const loggedAt = buildDateRange(from, to, req.query.timezoneOffset);
    if (loggedAt) where.loggedAt = loggedAt;
    const term = String(search).trim();
    if (term && req.user.role !== 'member') {
        const matchingMembers = await prisma.member.findMany({ where: { gymId, OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { phone: { contains: term, mode: 'insensitive' } },
            { registrationNumber: { contains: term, mode: 'insensitive' } },
            { id: { contains: term, mode: 'insensitive' } }
        ] }, select: { id: true } });
        where.memberId = { in: matchingMembers.map(member => member.id) };
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 1000);
    const logs = await prisma.workoutLog.findMany({ where, orderBy: { loggedAt: 'desc' }, take: limit });
    const result = await attachProgressIdentity(logs, gymId, 'workout');
    res.json(result.map(log => ({ ...log, exercises: parseExercises(log.exercises) })));
});

const createWorkoutLog = catchAsync(async (req, res) => {
    const member = await resolveMember(req, req.body.memberId);
    if (!member) return res.status(404).json({ success: false, message: 'Member not found in your gym or branch.' });
    const plan = await resolvePlan('workout', req.body.planId, member, req);
    if (req.body.planId && !plan) return res.status(403).json({ success: false, message: 'The selected workout plan is not assigned to this member.' });
    const loggedAt = getLoggedAt(req.body.loggedAt);
    if (!loggedAt) return res.status(400).json({ success: false, message: 'Enter a valid log date.' });
    const completed = parseExercises(req.body.exercises);
    const totalExercises = Math.max(0, Math.floor(Number(req.body.totalExercises) || completed.length));
    if (!completed.length) return res.status(400).json({ success: false, message: 'Complete at least one exercise before saving a workout.' });
    const record = await prisma.workoutLog.create({ data: {
        memberId: member.id,
        planId: plan?.id || null,
        trainerId: plan?.trainerId || (req.user.role === 'trainer' ? req.user.id : null),
        recordedById: req.user.id || null,
        planName: plan?.name || String(req.body.planName || 'Training session'),
        trainingDay: String(req.body.trainingDay || '').slice(0, 30),
        completedExercises: completed.length,
        totalExercises: Math.max(completed.length, totalExercises),
        exercises: JSON.stringify(completed),
        durationMinutes: req.body.durationMinutes == null ? null : Math.max(0, Math.floor(Number(req.body.durationMinutes) || 0)),
        notes: String(req.body.notes || '').slice(0, 1000),
        loggedAt,
        gymId: member.gymId,
        branchId: req.user.branchId || member.branchId || null
    } });
    res.status(201).json({ success: true, log: { ...(await attachProgressIdentity([record], member.gymId, 'workout'))[0], exercises: completed } });
});

async function attachProgressIdentity(logs, gymId, kind) {
    const memberIds = [...new Set(logs.map(log => log.memberId).filter(Boolean))];
    const trainerIds = [...new Set(logs.map(log => log.trainerId).filter(Boolean))];
    const actorIds = [...new Set(logs.map(log => log.recordedById).filter(Boolean))];
    const planIds = [...new Set(logs.map(log => log.planId).filter(Boolean))];
    const branchIds = [...new Set(logs.map(log => log.branchId).filter(Boolean))];
    const [members, trainers, actors, plans, branches] = await Promise.all([
        memberIds.length ? prisma.member.findMany({ where: { id: { in: memberIds }, gymId }, select: { id: true, registrationNumber: true, name: true, phone: true } }) : [],
        trainerIds.length ? prisma.user.findMany({ where: { id: { in: trainerIds }, gymId }, select: { id: true, name: true } }) : [],
        actorIds.length ? prisma.user.findMany({ where: { id: { in: actorIds }, gymId }, select: { id: true, name: true } }) : [],
        planIds.length ? (kind === 'nutrition' ? prisma.dietPlan : prisma.workoutPlan).findMany({ where: { id: { in: planIds }, gymId }, select: { id: true, name: true } }) : [],
        branchIds.length ? prisma.branch.findMany({ where: { id: { in: branchIds }, gymId }, select: { id: true, name: true } }) : []
    ]);
    const memberMap = new Map(members.map(member => [member.id, member]));
    const trainerMap = new Map(trainers.map(trainer => [trainer.id, trainer]));
    const actorMap = new Map(actors.map(actor => [actor.id, actor]));
    const planMap = new Map(plans.map(plan => [plan.id, plan]));
    const branchMap = new Map(branches.map(branch => [branch.id, branch]));
    return logs.map(log => ({
        ...log,
        member: memberMap.get(log.memberId) ? { ...memberMap.get(log.memberId), displayId: memberMap.get(log.memberId).registrationNumber || memberMap.get(log.memberId).id } : null,
        trainer: trainerMap.get(log.trainerId) || null,
        recordedBy: actorMap.get(log.recordedById) || null,
        plan: planMap.get(log.planId) || null,
        branch: branchMap.get(log.branchId) || null
    }));
}

module.exports = { getNutritionLogs, createNutritionLog, getWorkoutLogs, createWorkoutLog };

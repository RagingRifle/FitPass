const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const BodyAssessment = require('../models/BodyAssessment');
const Member = require('../models/Member');
const User = require('../models/User');
const { trainerCanManage } = require('../utils/trainerAccess');
const { H4_GYM_IDS } = require('../config/constants');

const isH4Gym = async (gymId) => {
    if (H4_GYM_IDS.includes(String(gymId))) return true;
    const Gym = require('../models/Gym');
    const gym = await Gym.findById(gymId).select('name').lean();
    return String(gym?.name || '').toLowerCase().includes('h4');
};
const toOptionalNumber = (value) => value === undefined || value === null || value === '' ? null : Number(value);
const roundMetric = (value) => Math.round(value * 10) / 10;

// @desc    Create/Record a new Body Assessment
// @route   POST /api/body-assessments
// @access  Private/Admin/Trainer
const createAssessment = catchAsync(async (req, res, next) => {
    try {
        const {
            memberId,
            weight,
            heightCm,
            bmi,
            bodyFat,
            muscleMass,
            bmr,
            waistCm,
            inBodyScore,
            assessmentDate
        } = req.body;

        if (!memberId || weight === undefined || weight === '' || !Number.isFinite(Number(weight)) || Number(weight) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Member ID and a valid weight are required.'
            });
        }

        // Validate member exists
        const isSuper = req.user.role === 'superadmin' || req.user.role === 'fitpass_admin';
        const memberQuery = { _id: memberId };
        if (!isSuper) {
            memberQuery.gymId = req.user.gymId;
            if (req.user.branchId) {
                memberQuery.branchId = req.user.branchId;
            }
        }
        const member = await Member.findOne(memberQuery);
        if (!member) {
            return res.status(404).json({ success: false, message: 'Member not found' });
        }
        if (req.user.role === 'trainer' && !(await trainerCanManage(req, [memberId], 'recordAssessment'))) {
            return res.status(403).json({ success: false, message: 'You need assessment access and an active assignment to this member.' });
        }

        if (await isH4Gym(member.gymId)) {
            let baselineHeight = member.heightCm;
            if (!baselineHeight) {
                const initialHeight = Number(heightCm);
                if (!Number.isFinite(initialHeight) || initialHeight < 80 || initialHeight > 250) {
                    return res.status(400).json({ success: false, message: 'Enter the member’s height in centimeters for their first assessment.' });
                }
                baselineHeight = initialHeight;
            }
            const numericWeight = Number(weight);
            const heightMeters = Number(baselineHeight) / 100;
            const calculatedBmi = roundMetric(numericWeight / (heightMeters * heightMeters));
            const pbf = toOptionalNumber(bodyFat);
            const smm = toOptionalNumber(muscleMass);
            const deviceBmr = toOptionalNumber(bmr);
            const waist = toOptionalNumber(waistCm);
            if (pbf !== null && (!Number.isFinite(pbf) || pbf < 0 || pbf > 75)) return res.status(400).json({ success: false, message: 'Body fat percentage must be between 0 and 75.' });
            if (smm !== null && (!Number.isFinite(smm) || smm <= 0 || smm > numericWeight)) return res.status(400).json({ success: false, message: 'Skeletal muscle mass must be positive and cannot exceed body weight.' });
            if (deviceBmr !== null && (!Number.isFinite(deviceBmr) || deviceBmr < 200 || deviceBmr > 6000)) return res.status(400).json({ success: false, message: 'Enter a valid BMR reading from the device.' });
            if (waist !== null && (!Number.isFinite(waist) || waist < 30 || waist > 250)) return res.status(400).json({ success: false, message: 'Waist measurement must be between 30 and 250 cm.' });

            if (!member.heightCm) {
                member.heightCm = baselineHeight;
                await member.save();
            }

            const targetGymId = member.gymId || req.user.gymId;
            const assessment = await BodyAssessment.create({
                memberId,
                trainerId: req.user.role === 'trainer' ? req.user.id : null,
                weight: numericWeight,
                heightCm: Number(baselineHeight),
                bmi: calculatedBmi,
                bodyFat: pbf,
                muscleMass: smm,
                bmr: deviceBmr,
                waistCm: waist,
                inBodyScore: null,
                assessmentDate: assessmentDate ? new Date(assessmentDate) : new Date(),
                gymId: targetGymId,
                branchId: req.user.branchId || member.branchId || null
            });
            return res.status(201).json(assessment);
        }

        if (bmi === undefined || bodyFat === undefined || muscleMass === undefined || bmr === undefined) {
            return res.status(400).json({ success: false, message: 'BMI, body fat, muscle mass, and BMR are required for this division.' });
        }

        const targetGymId = member.gymId || req.user.gymId;
        const targetBranchId = req.user.branchId || member.branchId || null;

        const assessment = await BodyAssessment.create({
            memberId,
            trainerId: req.user.id,
            weight: Number(weight),
            bmi: Number(bmi),
            bodyFat: Number(bodyFat),
            muscleMass: Number(muscleMass),
            bmr: Number(bmr),
            inBodyScore: inBodyScore !== undefined && inBodyScore !== '' && inBodyScore !== null ? Number(inBodyScore) : null,
            assessmentDate: assessmentDate ? new Date(assessmentDate) : new Date(),
            gymId: targetGymId,
            branchId: targetBranchId
        });

        res.status(201).json(assessment);
    } catch (error) { next(error); }
});

// @desc    Get body assessments history
// @route   GET /api/body-assessments
// @access  Private/Admin/Trainer/Member
const getAssessments = catchAsync(async (req, res, next) => {
    try {
        let query = { ...req.tenantFilter };

        // If member is calling, force show only their assessments
        if (req.user.role === 'member') {
            query.memberId = req.user.memberId;
        } else if (req.user.role === 'trainer') {
            const assigned = await require('../models/MemberTrainerAssignment').find({ trainerId: req.user.id, gymId: req.user.gymId }).select('memberId').lean();
            const assignedIds = assigned.map((item) => String(item.memberId));
            query.memberId = req.query.memberId && assignedIds.includes(String(req.query.memberId)) ? String(req.query.memberId) : { $in: req.query.memberId ? [] : assignedIds };
        } else if (req.query.memberId) {
            query.memberId = req.query.memberId;
        }

        const timezoneOffset = Number(req.query.timezoneOffset) || 0;
        const dateBoundary = (value, nextDay = false) => {
            const [year, month, day] = String(value).split('-').map(Number);
            const timestamp = Date.UTC(year, month - 1, day + (nextDay ? 1 : 0)) - timezoneOffset * 60_000;
            return new Date(timestamp - (nextDay ? 1 : 0));
        };
        if (req.query.from || req.query.to) {
            query.assessmentDate = {
                ...(req.query.from ? { $gte: dateBoundary(req.query.from) } : {}),
                ...(req.query.to ? { $lte: dateBoundary(req.query.to, true) } : {})
            };
        }

        // Strict pagination parameters with hard cap at 100
        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
        const skip = (page - 1) * limit;

        const total = await BodyAssessment.countDocuments(query);
        const assessments = await BodyAssessment.find(query)
            .sort({ assessmentDate: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Batched multi-entity lookup (Trainer + Member)
        const memberIds = [...new Set(assessments.map(a => a.memberId).filter(Boolean))];
        const trainerIds = [...new Set(assessments.map(a => a.trainerId).filter(Boolean))];

        const [members, trainers] = await Promise.all([
            memberIds.length > 0 ? Member.find({ _id: { $in: memberIds } }).select('id registrationNumber name phone email').lean() : [],
            trainerIds.length > 0 ? User.find({ _id: { $in: trainerIds } }).select('id name email role phone').lean() : []
        ]);

        const memberMap = new Map((members || []).map(m => [m._id ? m._id.toString() : m.id, m]));
        const trainerMap = new Map((trainers || []).map(t => [t._id ? t._id.toString() : t.id, t]));

        const formatted = assessments.map(a => {
            const m = a.memberId ? memberMap.get(a.memberId.toString()) : null;
            const t = a.trainerId ? trainerMap.get(a.trainerId.toString()) : null;
            return {
                ...a,
                member: m ? { id: m.id || m._id, displayId: m.registrationNumber || m.id || m._id, name: m.name, phone: m.phone, email: m.email } : null,
                trainer: t ? { id: t.id || t._id, name: t.name, email: t.email } : null
            };
        });

        res.json({
            success: true,
            data: formatted,
            meta: { page, limit, total }
        });
    } catch (error) { next(error); }
});

// @desc    Get single body assessment
// @route   GET /api/body-assessments/:id
// @access  Private/Admin/Trainer/Member
const getAssessmentById = catchAsync(async (req, res, next) => {
    try {
        const query = { _id: req.params.id, gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }), ...(req.user.role === 'trainer' ? { trainerId: req.user.id } : {}) };
        if (req.user.branchId) {
            query.branchId = req.user.branchId;
        }
        const assessment = await BodyAssessment.findOne(query);

        if (assessment) {
            if (req.user.role === 'member' && assessment.memberId !== req.user.memberId) {
                return res.status(403).json({ success: false, message: 'Not authorized to view this assessment' });
            }

            const memberQuery = { _id: assessment.memberId, gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }) };
            if (req.user.branchId) {
                memberQuery.branchId = req.user.branchId;
            }
            const memberObj = await Member.findOne(memberQuery);
            const trainerObj = assessment.trainerId ? await User.findOne({ _id: assessment.trainerId }).select('-password') : null;

            res.json({
                ...assessment,
                member: memberObj ? { id: memberObj.id, name: memberObj.name, phone: memberObj.phone } : null,
                trainer: trainerObj ? { id: trainerObj.id, name: trainerObj.name } : null
            });
        } else {
            res.status(404).json({ success: false, message: 'Assessment not found' });
        }
    } catch (error) { next(error); }
});

// @desc    Update a body assessment record
// @route   PUT /api/body-assessments/:id
// @access  Private/Admin/Trainer
const updateAssessment = catchAsync(async (req, res, next) => {
    try {
        const {
            weight,
            bmi,
            bodyFat,
            muscleMass,
            bmr,
            inBodyScore,
            waistCm,
            assessmentDate
        } = req.body;

        const query = { _id: req.params.id, gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }), ...(req.user.role === 'trainer' ? { trainerId: req.user.id } : {}) };
        if (req.user.branchId) {
            query.branchId = req.user.branchId;
        }
        const assessment = await BodyAssessment.findOne(query);

        if (assessment) {
            if (req.user.role === 'trainer' && !(await trainerCanManage(req, [assessment.memberId], 'recordAssessment'))) return res.status(403).json({ success: false, message: 'You do not have assessment access to this member.' });
            if (weight !== undefined) assessment.weight = Number(weight);
            const h4Assessment = await isH4Gym(assessment.gymId);
            if (h4Assessment) {
                if (!Number.isFinite(Number(assessment.weight)) || Number(assessment.weight) <= 0) return res.status(400).json({ success: false, message: 'Enter a valid weight.' });
                const pbf = bodyFat === undefined ? assessment.bodyFat : toOptionalNumber(bodyFat);
                const smm = muscleMass === undefined ? assessment.muscleMass : toOptionalNumber(muscleMass);
                const deviceBmr = bmr === undefined ? assessment.bmr : toOptionalNumber(bmr);
                const waist = waistCm === undefined ? assessment.waistCm : toOptionalNumber(waistCm);
                if (pbf !== null && pbf !== undefined && (!Number.isFinite(Number(pbf)) || pbf < 0 || pbf > 75)) return res.status(400).json({ success: false, message: 'Body fat percentage must be between 0 and 75.' });
                if (smm !== null && smm !== undefined && (!Number.isFinite(Number(smm)) || smm <= 0 || smm > Number(assessment.weight))) return res.status(400).json({ success: false, message: 'Skeletal muscle mass must be positive and cannot exceed body weight.' });
                if (deviceBmr !== null && deviceBmr !== undefined && (!Number.isFinite(Number(deviceBmr)) || deviceBmr < 200 || deviceBmr > 6000)) return res.status(400).json({ success: false, message: 'Enter a valid BMR reading from the device.' });
                if (waist !== null && waist !== undefined && (!Number.isFinite(Number(waist)) || waist < 30 || waist > 250)) return res.status(400).json({ success: false, message: 'Waist measurement must be between 30 and 250 cm.' });
                if (bodyFat !== undefined) assessment.bodyFat = pbf;
                if (muscleMass !== undefined) assessment.muscleMass = smm;
                if (bmr !== undefined) assessment.bmr = deviceBmr;
                if (waistCm !== undefined) assessment.waistCm = waist;
                const heightMeters = Number(assessment.heightCm) / 100;
                if (heightMeters > 0) assessment.bmi = roundMetric(Number(assessment.weight) / (heightMeters * heightMeters));
            } else {
                if (bmi !== undefined) assessment.bmi = Number(bmi);
                if (bodyFat !== undefined) assessment.bodyFat = Number(bodyFat);
                if (muscleMass !== undefined) assessment.muscleMass = Number(muscleMass);
                if (bmr !== undefined) assessment.bmr = Number(bmr);
                if (inBodyScore !== undefined) assessment.inBodyScore = inBodyScore !== null ? Number(inBodyScore) : null;
            }
            if (assessmentDate !== undefined) assessment.assessmentDate = assessmentDate ? new Date(assessmentDate) : assessment.assessmentDate;

            const updated = await assessment.save();
            res.json(updated);
        } else {
            res.status(404).json({ success: false, message: 'Assessment not found' });
        }
    } catch (error) { next(error); }
});

// @desc    Delete a body assessment record
// @route   DELETE /api/body-assessments/:id
// @access  Private/Admin/Trainer
const deleteAssessment = catchAsync(async (req, res, next) => {
    try {
        const query = { _id: req.params.id, gymId: req.user.gymId, ...(req.user.branchId && { branchId: req.user.branchId }), ...(req.user.role === 'trainer' ? { trainerId: req.user.id } : {}) };
        if (req.user.branchId) {
            query.branchId = req.user.branchId;
        }
        const assessment = await BodyAssessment.findOne(query);

        if (assessment) {
            if (req.user.role === 'trainer' && !(await trainerCanManage(req, [assessment.memberId], 'recordAssessment'))) return res.status(403).json({ success: false, message: 'You do not have assessment access to this member.' });
            await assessment.deleteOne();
            res.json({ message: 'Body assessment removed' });
        } else {
            res.status(404).json({ success: false, message: 'Assessment not found' });
        }
    } catch (error) { next(error); }
});

module.exports = {
    createAssessment,
    getAssessments,
    getAssessmentById,
    updateAssessment,
    deleteAssessment
};

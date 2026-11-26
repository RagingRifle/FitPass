const express = require('express');
const router = express.Router();
const { getLeads, createLead, addLeadComment, updateLead, deleteLead, getLeadSummary } = require('../controllers/leadController');
const { protect, authorize } = require('../middleware/authMiddleware');
const tenantFilter = require('../middleware/tenantFilter');
const validate = require('../middleware/validate');
const catchAsync = require('../utils/catchAsync');
const prisma = require('../config/prisma');
const { H4_GYM_IDS } = require('../config/constants');
const { z } = require('zod');

const ensureH4SuperadminScope = catchAsync(async (req, res, next) => {
    if (req.user.role !== 'superadmin') return next();
    const gymId = String(req.tenantFilter?.gymId || '');
    if (!gymId) return res.status(403).json({ message: 'Select an H4 gym to manage leads.' });
    const gym = H4_GYM_IDS.includes(gymId)
        ? { name: 'H4' }
        : await prisma.gym.findUnique({ where: { id: gymId }, select: { name: true } });
    if (!gym?.name?.toLowerCase().includes('h4')) {
        return res.status(403).json({ message: 'Lead management is only available in the H4 division.' });
    }
    return next();
});

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Follow-up date must be a valid calendar date.');

const createLeadSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    phone: z.string().min(10, 'Phone must be at least 10 digits'),
    email: z.string().email('Please enter a valid email address').optional().or(z.literal('')),
    source: z.string().optional(),
    status: z.string().optional(),
    interestedPlan: z.string().max(120).optional(),
    notes: z.string().optional(),
    convertedMemberId: z.string().optional(),
    followUpDate: dateOnlySchema.optional().or(z.literal('')),
    assignedTo: z.string().max(100).optional(),
});

const updateLeadSchema = createLeadSchema.partial();

// Summary — CRM admins only (partners have no pipeline stats)
router.get('/summary', protect, authorize('admin', 'receptionist', 'h4_admin', 'h4_branch_admin', 'superadmin'), tenantFilter, ensureH4SuperadminScope, getLeadSummary);

// GET leads — admins + partner (read-only, scoped by gymId in controller)
// POST leads — admins only (partners cannot create leads)
router.route('/')
  .get(protect, authorize('admin', 'receptionist', 'h4_admin', 'h4_branch_admin', 'superadmin'), tenantFilter, ensureH4SuperadminScope, getLeads)
  .post(protect, authorize('admin', 'receptionist', 'h4_admin', 'h4_branch_admin', 'superadmin'), tenantFilter, ensureH4SuperadminScope, validate({ body: createLeadSchema }), createLead);

// PUT / DELETE — admins only
router.route('/:id')
  .put(protect, authorize('admin', 'receptionist', 'h4_admin', 'h4_branch_admin', 'superadmin'), tenantFilter, ensureH4SuperadminScope, validate({ body: updateLeadSchema }), updateLead)
  .delete(protect, authorize('admin', 'receptionist', 'h4_admin', 'h4_branch_admin', 'superadmin'), tenantFilter, ensureH4SuperadminScope, deleteLead);

router.post('/:id/comments', protect, authorize('admin', 'receptionist', 'h4_admin', 'h4_branch_admin', 'superadmin'), tenantFilter, ensureH4SuperadminScope, addLeadComment);

module.exports = router;

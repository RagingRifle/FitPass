const express = require('express');
const router = express.Router();
const { getLeads, createLead, addLeadComment, updateLead, deleteLead, getLeadSummary } = require('../controllers/leadController');
const { protect, authorize } = require('../middleware/authMiddleware');
const tenantFilter = require('../middleware/tenantFilter');
const validate = require('../middleware/validate');
const { z } = require('zod');

const createLeadSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    phone: z.string().min(10, 'Phone must be at least 10 digits'),
    email: z.string().email('Please enter a valid email address').optional().or(z.literal('')),
    source: z.string().optional(),
    status: z.string().optional(),
    notes: z.string().optional(),
    convertedMemberId: z.string().optional()
});

const updateLeadSchema = createLeadSchema.partial();

// Summary — CRM admins only (partners have no pipeline stats)
router.get('/summary', protect, authorize('admin', 'receptionist', 'h4_admin'), tenantFilter, getLeadSummary);

// GET leads — admins + partner (read-only, scoped by gymId in controller)
// POST leads — admins only (partners cannot create leads)
router.route('/')
  .get(protect, authorize('admin', 'receptionist', 'h4_admin', 'partner'), tenantFilter, getLeads)
  .post(protect, authorize('admin', 'receptionist', 'h4_admin'), validate({ body: createLeadSchema }), createLead);

// PUT / DELETE — admins only
router.route('/:id')
  .put(protect, authorize('admin', 'receptionist', 'h4_admin'), validate({ body: updateLeadSchema }), updateLead)
  .delete(protect, authorize('admin', 'receptionist', 'h4_admin'), deleteLead);

router.post('/:id/comments', protect, authorize('admin', 'receptionist', 'h4_admin'), addLeadComment);

module.exports = router;

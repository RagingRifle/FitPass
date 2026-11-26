/**
 * Attaches `req.tenantFilter` — an object suitable for spreading into
 * any Prisma/MongooseAdapter query. Controllers use this instead of
 * manually checking gymId/branchId/role.
 *
 * Superadmin (gymId === 'SYSTEM'): empty filter (cross-gym).
 * Gym admin: { gymId: <their gym> }
 * Branch scoped: adds { branchId: <their branch> }
 * Query param override: ?gymId=xxx (for admins with an active tenant selection).
 * Trainers always use the authenticated gym and branch.
 */
const tenantFilter = (req, res, next) => {
    const filter = {};
    const headerGymId = req.headers['x-gym-id'];
    const headerBranchId = req.headers['x-branch-id'];

    if (req.user?.role === 'trainer') {
        if (!req.user.gymId) {
            return res.status(403).json({ success: false, message: 'Trainer gym scope is required' });
        }
        filter.gymId = req.user.gymId;
        if (req.user.branchId) filter.branchId = req.user.branchId;
    } else if (['h4_admin', 'h4_branch_admin'].includes(req.user?.role)) {
        filter.gymId = req.user.gymId;
        const isBranchAdmin = req.user.role === 'h4_branch_admin' || Boolean(req.user.branchId);
        if (isBranchAdmin) {
            if (!req.user.branchId) {
                return res.status(403).json({ success: false, message: 'H4 branch scope is required' });
            }
            filter.branchId = req.user.branchId;
        } else if (req.query.branchId) {
            filter.branchId = req.query.branchId;
        } else if (headerBranchId && headerBranchId !== 'null' && headerBranchId !== 'undefined') {
            filter.branchId = headerBranchId;
        }
    } else if (req.query.gymId) {
        filter.gymId = req.query.gymId;
    } else if (headerGymId && headerGymId !== 'SYSTEM' && headerGymId !== 'null' && headerGymId !== 'undefined') {
        filter.gymId = headerGymId;
    } else if (req.user?.gymId && req.user.gymId !== 'SYSTEM' && req.user.role !== 'superadmin') {
        filter.gymId = req.user.gymId;
    }

    if (req.user?.role !== 'trainer' && !['h4_admin', 'h4_branch_admin'].includes(req.user?.role)) {
        if (req.query.branchId) {
            filter.branchId = req.query.branchId;
        } else if (headerBranchId && headerBranchId !== 'null' && headerBranchId !== 'undefined') {
            filter.branchId = headerBranchId;
        } else if (req.user?.branchId) {
            filter.branchId = req.user.branchId;
        }
    }

    req.tenantFilter = filter;
    next();
};

module.exports = tenantFilter;

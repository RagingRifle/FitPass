const Branch = require('../models/Branch');
const AppError = require('./appError');

const localDateBoundary = (value, endOfDay = false) => {
    if (!value) return null;
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const [, year, month, day] = match.map(Number);
    const date = new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
};

const resolveBranchScope = async (req) => {
    if (req.user?.role === 'h4_branch_admin') return req.user.branchId || null;
    if (req.user?.role !== 'h4_admin') return req.user?.branchId || null;
    if (req.user.userBranchId) return req.user.userBranchId;
    if (!Object.prototype.hasOwnProperty.call(req.query || {}, 'branchId')) return req.user.branchId || null;
    const requestedBranchId = String(req.query.branchId || '').trim();
    if (!requestedBranchId) return null;
    const branch = await Branch.findById(requestedBranchId).lean();
    if (!branch || String(branch.gymId) !== String(req.user.gymId)) {
        throw new AppError('Choose a branch in your H4 gym.', 403, 'BRANCH_SCOPE_DENIED');
    }
    return requestedBranchId;
};

const resolveReportFilters = async (req, defaults) => {
    const startDate = req.query?.startDate ? localDateBoundary(req.query.startDate) : defaults.start;
    const endDate = req.query?.endDate ? localDateBoundary(req.query.endDate, true) : defaults.end;
    if ((req.query?.startDate && !localDateBoundary(req.query.startDate)) || (req.query?.endDate && !localDateBoundary(req.query.endDate, true))) {
        throw new AppError('Enter a valid start and end date.', 400, 'INVALID_DATE_RANGE');
    }
    if (startDate > endDate) throw new AppError('Start date must be on or before the end date.', 400, 'INVALID_DATE_RANGE');
    return { branchId: await resolveBranchScope(req), startDate, endDate };
};

module.exports = { localDateBoundary, resolveBranchScope, resolveReportFilters };

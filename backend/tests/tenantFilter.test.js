const tenantFilter = require('../middleware/tenantFilter');

describe('tenantFilter trainer scope', () => {
    it('uses the authenticated trainer gym and branch instead of client overrides', () => {
        const req = {
            user: { role: 'trainer', gymId: 'gym-assigned', branchId: 'branch-assigned' },
            query: { gymId: 'gym-selected', branchId: 'branch-selected' },
            headers: { 'x-gym-id': 'gym-header', 'x-branch-id': 'branch-header' }
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        tenantFilter(req, res, next);

        expect(req.tenantFilter).toEqual({ gymId: 'gym-assigned', branchId: 'branch-assigned' });
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    it('does not accept a client branch override for a branchless trainer', () => {
        const req = {
            user: { role: 'trainer', gymId: 'gym-assigned', branchId: null },
            query: { gymId: 'gym-selected', branchId: 'branch-selected' },
            headers: { 'x-gym-id': 'gym-header', 'x-branch-id': 'branch-header' }
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        tenantFilter(req, res, next);

        expect(req.tenantFilter).toEqual({ gymId: 'gym-assigned' });
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('rejects trainers without an authenticated gym scope', () => {
        const req = {
            user: { role: 'trainer', branchId: null },
            query: { gymId: 'gym-selected' },
            headers: { 'x-gym-id': 'gym-header' }
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        tenantFilter(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Trainer gym scope is required' });
        expect(next).not.toHaveBeenCalled();
    });

    it('locks H4 branch administrators to their assigned H4 branch', () => {
        const req = {
            user: { role: 'h4_branch_admin', gymId: 'h4-gym', branchId: 'assigned-branch' },
            query: { gymId: 'other-gym', branchId: 'other-branch' },
            headers: { 'x-gym-id': 'header-gym', 'x-branch-id': 'header-branch' }
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        tenantFilter(req, res, next);

        expect(req.tenantFilter).toEqual({ gymId: 'h4-gym', branchId: 'assigned-branch' });
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    it('requires an assigned branch for H4 branch administrators', () => {
        const req = {
            user: { role: 'h4_branch_admin', gymId: 'h4-gym' },
            query: { branchId: 'client-branch' },
            headers: {}
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        tenantFilter(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'H4 branch scope is required' });
        expect(next).not.toHaveBeenCalled();
    });

    it('locks legacy branch-scoped H4 admins to their assigned branch', () => {
        const req = {
            user: { role: 'admin', gymId: 'h4-gym', branchId: 'assigned-branch', isH4BranchAdmin: true },
            query: { gymId: 'other-gym', branchId: 'other-branch' },
            headers: { 'x-gym-id': 'header-gym', 'x-branch-id': 'header-branch' }
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        tenantFilter(req, res, next);

        expect(req.tenantFilter).toEqual({ gymId: 'h4-gym', branchId: 'assigned-branch' });
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    it('does not allow overall H4 admins to override their gym scope', () => {
        const req = {
            user: { role: 'h4_admin', gymId: 'h4-gym', branchId: null },
            query: { gymId: 'other-gym' },
            headers: { 'x-gym-id': 'header-gym' }
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        tenantFilter(req, res, next);

        expect(req.tenantFilter).toEqual({ gymId: 'h4-gym' });
        expect(next).toHaveBeenCalledTimes(1);
    });
});

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
});

const { authorize } = require('../middleware/authMiddleware');

describe('authorize scoped administrators', () => {
    it('denies H4 branch admins routes reserved for overall H4 admins', () => {
        const req = { user: { role: 'h4_branch_admin' } };
        const res = { status: jest.fn().mockReturnThis() };
        const next = jest.fn();

        authorize('admin', 'h4_admin')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'User role h4_branch_admin is not authorized to access this route' }));
    });

    it('allows H4 branch admins only when the route explicitly grants branch-admin access', () => {
        const req = { user: { role: 'h4_branch_admin' } };
        const res = { status: jest.fn().mockReturnThis() };
        const next = jest.fn();

        authorize('h4_branch_admin')(req, res, next);

        expect(next).toHaveBeenCalledWith();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('treats branch-assigned overall H4 admins as branch scoped', () => {
        const req = { user: { role: 'h4_admin', branchId: 'branch-1' } };
        const res = { status: jest.fn().mockReturnThis() };
        const next = jest.fn();

        authorize('h4_admin')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'User role h4_admin is not authorized to access this route' }));
    });

    it('keeps legacy branch-scoped H4 admins limited to explicitly enabled branch routes', () => {
        const req = { user: { role: 'admin', isH4BranchAdmin: true, branchId: 'branch-1' } };
        const res = { status: jest.fn().mockReturnThis() };
        const next = jest.fn();

        authorize('admin')(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'User role admin is not authorized to access this route' }));

        res.status.mockClear();
        next.mockClear();
        authorize('h4_branch_admin')(req, res, next);
        expect(next).toHaveBeenCalledWith();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('restricts FitPass partner admins to routes explicitly granted to partners', () => {
        const req = { user: { role: 'partner' } };
        const res = { status: jest.fn().mockReturnThis() };
        const next = jest.fn();

        authorize('admin', 'h4_admin')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'User role partner is not authorized to access this route' }));
    });

    it('allows FitPass partners on routes explicitly granted to partners', () => {
        const req = { user: { role: 'partner' } };
        const res = { status: jest.fn().mockReturnThis() };
        const next = jest.fn();

        authorize('partner')(req, res, next);

        expect(next).toHaveBeenCalledWith();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('restricts legacy FitPass partner admins to partner routes', () => {
        const req = { user: { role: 'admin', isFitPassPartnerAdmin: true } };
        const res = { status: jest.fn().mockReturnThis() };
        const next = jest.fn();

        authorize('admin')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'User role admin is not authorized to access this route' }));
    });

    it('allows legacy FitPass partner admins on partner routes', () => {
        const req = { user: { role: 'admin', isFitPassPartnerAdmin: true } };
        const res = { status: jest.fn().mockReturnThis() };
        const next = jest.fn();

        authorize('partner')(req, res, next);

        expect(next).toHaveBeenCalledWith();
        expect(res.status).not.toHaveBeenCalled();
    });
});

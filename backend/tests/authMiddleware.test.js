const { authorize } = require('../middleware/authMiddleware');

describe('authorize H4 branch admin', () => {
    it('allows branch administrators wherever H4 administrators are allowed', () => {
        const req = { user: { role: 'h4_branch_admin' } };
        const res = { status: jest.fn().mockReturnThis() };
        const next = jest.fn();

        authorize('admin', 'h4_admin')(req, res, next);

        expect(next).toHaveBeenCalledWith();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('does not grant branch administrators unrelated role access', () => {
        const req = { user: { role: 'h4_branch_admin' } };
        const res = { status: jest.fn().mockReturnThis() };
        const next = jest.fn();

        authorize('fitpass_admin')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'User role h4_branch_admin is not authorized to access this route' }));
    });
});

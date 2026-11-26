jest.mock('../config/prisma', () => ({
    gym: { findUnique: jest.fn() },
    branch: { findFirst: jest.fn() },
}));
jest.mock('../models/User', () => ({
    findOne: jest.fn(),
    create: jest.fn(),
}));
jest.mock('../models/Member', () => ({
    find: jest.fn(),
}));
jest.mock('../models/MemberTrainerAssignment', () => ({
    find: jest.fn(),
    create: jest.fn(),
}));

const { createStaff } = require('../controllers/staffController');

describe('H4 staff roles', () => {
    it.each(['admin', 'receptionist'])('rejects legacy H4 staff role "%s"', async (role) => {
        const req = {
            user: { role: 'h4_admin', gymId: 'h4-gym' },
            body: { name: 'Test Staff', email: 'staff@example.com', password: 'password123', role },
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        const next = jest.fn();

        createStaff(req, res, next);
        await new Promise((resolve) => setImmediate(resolve));

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Invalid role' });
        expect(next).not.toHaveBeenCalled();
    });
});

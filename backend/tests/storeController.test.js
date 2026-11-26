const mockPrisma = {
    member: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
    },
    storeProduct: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
    },
    storeOrder: {
        create: jest.fn(),
        findMany: jest.fn(),
    },
    $transaction: jest.fn(),
};

jest.mock('../config/prisma', () => mockPrisma);

const prisma = require('../config/prisma');
const { registerH4Purchase, getH4Purchases } = require('../controllers/storeController');
const { H4_GYM_IDS } = require('../config/constants');

const callController = (controller, req) => new Promise((resolve, reject) => {
    const res = {
        statusCode: 200,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            resolve({ statusCode: this.statusCode, body });
        },
    };
    controller(req, res, reject);
});

describe('H4 store purchases', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('records a purchase total and decrements available stock by quantity', async () => {
        const product = { id: 'product-1', isActive: true, division: 'h4', priceINR: 75, stock: 8 };
        const tx = {
            storeProduct: {
                findUnique: jest.fn().mockResolvedValue(product),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            storeOrder: {
                create: jest.fn().mockResolvedValue({ id: 'order-1', amountINR: 150 }),
            },
        };
        prisma.member.findUnique.mockResolvedValue({
            id: 'member-1',
            name: 'Member One',
            phone: '9876543210',
            gymId: H4_GYM_IDS[0],
        });
        prisma.storeProduct.findUnique.mockResolvedValue(product);
        prisma.$transaction.mockImplementation(operation => operation(tx));

        const response = await callController(registerH4Purchase, {
            user: { role: 'h4_admin', gymId: H4_GYM_IDS[0] },
            body: { memberId: 'member-1', productId: 'product-1', quantity: 2, paymentMethod: 'UPI' },
        });

        expect(response.statusCode).toBe(201);
        expect(tx.storeProduct.updateMany).toHaveBeenCalledWith({
            where: { id: 'product-1', isActive: true, stock: { gte: 2 } },
            data: { stock: { decrement: 2 } },
        });
        expect(tx.storeOrder.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                memberId: 'member-1',
                productId: 'product-1',
                amountINR: 150,
                quantity: 2,
                paymentMethod: 'UPI',
                division: 'h4',
            }),
        });
    });

    it('filters reports by product, local date range, and admin gym scope', async () => {
        const order = { id: 'order-1', memberId: 'member-1', productId: 'product-1', createdAt: new Date('2025-01-02T08:00:00Z') };
        prisma.member.findMany
            .mockResolvedValueOnce([{ id: 'member-1' }])
            .mockResolvedValueOnce([{ id: 'member-1', name: 'Member One', phone: '9876543210' }]);
        prisma.storeOrder.findMany.mockResolvedValue([order]);

        const response = await callController(getH4Purchases, {
            user: { role: 'admin', gymId: H4_GYM_IDS[0] },
            query: {
                division: 'h4',
                productId: 'product-1',
                dateFrom: '2025-01-02',
                dateTo: '2025-01-02',
                timezoneOffset: '-330',
            },
        });

        expect(response.statusCode).toBe(200);
        expect(prisma.storeOrder.findMany).toHaveBeenCalledWith({
            where: {
                division: 'h4',
                productId: 'product-1',
                memberId: { in: ['member-1'] },
                createdAt: {
                    gte: new Date('2025-01-01T18:30:00.000Z'),
                    lt: new Date('2025-01-02T18:30:00.000Z'),
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        expect(response.body[0].member.name).toBe('Member One');
    });
});

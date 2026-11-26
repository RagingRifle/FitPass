const mockPrisma = {
    member: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
    },
    storeProduct: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
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
const { registerH4Purchase, getStorePurchases, getProducts, saveProduct } = require('../controllers/storeController');
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
        const product = { id: 'product-1', isActive: true, division: 'h4', priceINR: 75, costINR: 50, stock: 8 };
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
                costINR: 100,
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

        const response = await callController(getStorePurchases, {
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

    it('calculates cost price from selling price and fixed margin amount', async () => {
        prisma.storeProduct.findFirst.mockResolvedValue(null);
        prisma.storeProduct.create.mockImplementation(async ({ data }) => ({ id: 'product-1', ...data }));

        const response = await callController(saveProduct, {
            user: { role: 'h4_admin', gymId: H4_GYM_IDS[0] },
            params: {},
            body: {
                name: 'Training shirt',
                division: 'h4',
                priceINR: '1400',
                marginINR: '200',
                isActive: 'true',
            },
        });

        expect(response.statusCode).toBe(200);
        expect(prisma.storeProduct.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                priceINR: 1400,
                costINR: 1200,
                marginINR: 200,
            }),
        });
    });

    it('calculates FitCoin selling price from cost and fixed margin', async () => {
        prisma.storeProduct.findFirst.mockResolvedValue(null);
        prisma.storeProduct.create.mockImplementation(async ({ data }) => ({ id: 'product-2', ...data }));

        const response = await callController(saveProduct, {
            user: { role: 'fitpass_admin' },
            params: {},
            body: {
                name: 'FitPass bottle',
                division: 'fitpass',
                costCoins: '300',
                marginCoins: '50',
                isActive: 'true',
            },
        });

        expect(response.statusCode).toBe(200);
        expect(prisma.storeProduct.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                priceCoins: 350,
                costCoins: 300,
                marginCoins: 50,
                costINR: null,
                marginINR: null,
            }),
        });
    });

    it('returns FitPass orders for reports in FitCoins', async () => {
        const order = { id: 'order-2', memberId: 'member-2', division: 'fitpass', coinsSpent: 350, costCoins: 300 };
        prisma.member.findMany.mockResolvedValue([{ id: 'member-2', name: 'FitPass Member' }]);
        prisma.storeOrder.findMany.mockResolvedValue([order]);

        const response = await callController(getStorePurchases, {
            user: { role: 'fitpass_admin' },
            query: { division: 'fitpass' },
        });

        expect(response.statusCode).toBe(200);
        expect(prisma.storeOrder.findMany).toHaveBeenCalledWith({
            where: { division: 'fitpass' },
            orderBy: { createdAt: 'desc' },
        });
        expect(response.body[0]).toEqual(expect.objectContaining({
            coinsSpent: 350,
            costCoins: 300,
            member: expect.objectContaining({ name: 'FitPass Member' }),
        }));
    });

    it('does not select internal cost and margin fields for member product listings', async () => {
        prisma.storeProduct.findMany.mockResolvedValue([]);

        const response = await callController(getProducts, {
            user: { role: 'member' },
            query: { division: 'fitpass' },
        });

        expect(response.statusCode).toBe(200);
        expect(prisma.storeProduct.findMany).toHaveBeenCalledWith({
            where: { division: 'fitpass', isActive: true },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                description: true,
                priceCoins: true,
                priceINR: true,
                imageUrl: true,
                division: true,
                isActive: true,
                stock: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    });
});

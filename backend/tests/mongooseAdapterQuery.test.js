const { translateQuery } = require('../models/MongooseAdapter');

describe('MongooseAdapter query translation', () => {
    it('translates nested $and and $or filters into Prisma conditions', () => {
        expect(translateQuery({
            $and: [
                { gymId: { $in: ['h4-main', 'h4-west'] } },
                { $or: [{ branchId: 'branch-1' }, { branchId: null }] }
            ]
        })).toEqual({
            AND: [
                { gymId: { in: ['h4-main', 'h4-west'] } },
                { OR: [{ branchId: 'branch-1' }, { branchId: null }] }
            ]
        });
    });
});

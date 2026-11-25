const {
    buildTrainerAssignmentQuery,
    buildAssignmentMemberQuery
} = require('../utils/trainerAssignmentQuery');

describe('trainer assignment queries', () => {
    it('includes legacy branchless assignments for a branch-scoped trainer', () => {
        expect(buildTrainerAssignmentQuery({
            id: 'trainer-1',
            role: 'trainer',
            gymId: 'gym-1',
            branchId: 'branch-1'
        })).toEqual({
            gymId: 'gym-1',
            trainerId: 'trainer-1',
            $or: [{ branchId: 'branch-1' }, { branchId: null }]
        });
    });

    it('limits branch-scoped trainers to members in their own branch or branchless members', () => {
        expect(buildAssignmentMemberQuery({
            id: 'trainer-1',
            role: 'trainer',
            gymId: 'gym-1',
            branchId: 'branch-1'
        }, ['member-1'])).toEqual({
            _id: { $in: ['member-1'] },
            $or: [{ branchId: 'branch-1' }, { branchId: null }]
        });
    });

    it('preserves branch-scoped admin assignment queries', () => {
        expect(buildTrainerAssignmentQuery({
            id: 'admin-1',
            role: 'h4_admin',
            gymId: 'gym-1',
            branchId: 'branch-1'
        })).toEqual({ gymId: 'gym-1', branchId: 'branch-1' });
    });
});

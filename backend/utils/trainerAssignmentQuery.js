function buildTrainerAssignmentQuery(user) {
    const query = { gymId: user.gymId };
    if (user.role === 'trainer') {
        query.trainerId = user.id;
        if (user.branchId) query.$or = [{ branchId: user.branchId }, { branchId: null }];
    } else if (user.branchId) {
        query.branchId = user.branchId;
    }
    return query;
}

function buildAssignmentMemberQuery(user, memberIds) {
    const query = { _id: { $in: memberIds } };
    if (user.role === 'trainer' && user.branchId) {
        query.$or = [{ branchId: user.branchId }, { branchId: null }];
    }
    return query;
}

module.exports = { buildTrainerAssignmentQuery, buildAssignmentMemberQuery };

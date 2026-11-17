const MemberTrainerAssignment = require('../models/MemberTrainerAssignment');

async function trainerCanManage(req, memberIds, permission) {
    if (req.user?.role !== 'trainer') return true;
    if (req.user.trainerPermissions?.[permission] === false) return false;
    const ids = [...new Set(memberIds.map(String))];
    const links = await MemberTrainerAssignment.find({
        trainerId: req.user.id,
        memberId: { $in: ids },
        gymId: req.user.gymId
    }).select('memberId').lean();
    return new Set(links.map((link) => String(link.memberId))).size === ids.length;
}

module.exports = { trainerCanManage };

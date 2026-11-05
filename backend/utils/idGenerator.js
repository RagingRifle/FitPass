/**
 * Universal Sequential EMPID & Member ID Generator / Formatter
 * 
 * Rules:
 * - All Staff (All Branches & Roles): EMP1001, EMP1002, EMP1003...
 * - All Members (Branch & FitPass):   MEM1001, MEM1002, MEM1003...
 * - Sequential global numbering starting at 1001.
 */

function getMemberCode(member, index = 0) {
    if (/^MEM\d{4}$/.test(String(member?.registrationNumber || ''))) return member.registrationNumber;
    const baseNumber = 1001 + (Number(index) || 0);
    return `MEM${baseNumber}`;
}

async function allocateMemberCode() {
    const prisma = require('../config/prisma');
    const sequence = await prisma.idSequence.upsert({
        where: { key: 'member' },
        create: { key: 'member', value: 1001 },
        update: { value: { increment: 1 } }
    });
    if (sequence.value > 9999) throw new Error('The four-digit member ID range is full.');
    return `MEM${String(sequence.value).padStart(4, '0')}`;
}

function getStaffCode(staffUser, index = 0) {
    const baseNumber = 1001 + (Number(index) || 0);
    return `EMP${baseNumber}`;
}

module.exports = {
    getMemberCode,
    allocateMemberCode,
    getStaffCode
};

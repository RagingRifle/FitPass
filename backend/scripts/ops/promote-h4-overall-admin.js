const prisma = require('../../config/prisma');

async function promoteH4OverallAdmin() {
    const user = await prisma.user.findUnique({
        where: { email: 'test@gmail.com' },
        select: { id: true, name: true, role: true, email: true },
    });
    if (!user) throw new Error('test@gmail.com was not found.');
    if (user.name.trim().toLowerCase() !== 'tester') {
        throw new Error('The account name does not match the expected tester account.');
    }
    if (!['admin', 'h4_admin', 'h4_branch_admin'].includes(user.role)) {
        throw new Error(`Cannot promote an account with the unexpected role "${user.role}".`);
    }

    const h4Gym = await prisma.gym.findFirst({
        where: { name: { equals: 'H4', mode: 'insensitive' } },
        select: { id: true },
    });
    if (!h4Gym) throw new Error('The H4 gym record was not found.');

    await prisma.user.update({
        where: { id: user.id },
        data: { role: 'h4_admin', gymId: h4Gym.id, branchId: null },
    });
    console.log('Promoted test@gmail.com to overall H4 admin. Password unchanged.');
}

promoteH4OverallAdmin()
    .catch((error) => {
        console.error(`H4 admin promotion failed: ${error.message}`);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());

const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');

const STAFF_PASSWORD = 'Coach@2026';
const MANAGER_PASSWORD = 'Manager@2026';
const MEMBER_PASSWORD_IS_PHONE = true;

const gymSpecs = [
  { name: 'H4', address: 'H4 Fitness House, Central Avenue', phone: '+91 90000 10000', email: 'hello@h4fitness.example.test' },
  { name: 'Northstar Fitness', address: '18 Lakeview Road, Bengaluru', phone: '+91 90000 20000', email: 'hello@northstar.example.test' },
  { name: 'Urban Motion Club', address: '42 Park Street, Pune', phone: '+91 90000 30000', email: 'hello@urbanmotion.example.test' },
];

const branchSpecs = [
  { gymName: 'H4', name: 'H4 Central', address: '12 Central Avenue', phone: '+91 90000 10001', fitPassEnabled: false },
  { gymName: 'H4', name: 'H4 Riverside', address: '8 Riverwalk Road', phone: '+91 90000 10002', fitPassEnabled: false },
  { gymName: 'Northstar Fitness', name: 'Northstar Downtown', address: '18 Lakeview Road', phone: '+91 90000 20001', fitPassEnabled: true },
  { gymName: 'Urban Motion Club', name: 'Urban Motion East', address: '42 Park Street', phone: '+91 90000 30001', fitPassEnabled: true },
];

const people = [
  ['Aarav Mehta', '9000010101'], ['Isha Kapoor', '9000010102'], ['Kabir Shah', '9000010103'], ['Mira Nair', '9000010104'],
  ['Dev Malhotra', '9000010105'], ['Tara Iyer', '9000010106'], ['Neel Joshi', '9000010107'], ['Riya Menon', '9000010108'],
  ['Arjun Rao', '9000010109'], ['Anaya Bose', '9000010110'], ['Vihaan Das', '9000010111'], ['Diya Patel', '9000010112'],
  ['Reyansh Gupta', '9000010113'], ['Myra Shah', '9000010114'], ['Advik Reddy', '9000010115'], ['Sana Khan', '9000010116'],
];

const dateDaysAgo = (days) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
};

async function getGym(spec) {
  const existing = await prisma.gym.findFirst({ where: { name: spec.name } });
  if (existing) return existing;
  return prisma.gym.create({ data: { ...spec, status: 'Active' } });
}

async function getBranch(spec, gymId) {
  const { gymName, ...branchData } = spec;
  const existing = await prisma.branch.findFirst({ where: { name: branchData.name, gymId } });
  if (existing) return existing;
  return prisma.branch.create({ data: { ...branchData, gymId, isActive: true, openingTime: '06:00 AM', closingTime: '10:00 PM' } });
}

async function ensureUser({ name, email, password, role, gymId, branchId = null, phone = null, memberId = null }) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    create: { name, email, password: passwordHash, role, gymId, branchId, phone, memberId, isVerified: true, isActive: true, status: 'Active' },
    update: { name, password: passwordHash, role, gymId, branchId, phone, memberId, isVerified: true, isActive: true, status: 'Active' },
  });
}

async function ensurePlan(name, gymId, price, duration = 30, extra = {}) {
  const existing = await prisma.plan.findFirst({ where: { name, gymId, branchId: null } });
  if (existing) return existing;
  return prisma.plan.create({ data: { name, gymId, price, duration, durationUnit: 'days', branchId: null, ...extra } });
}

async function seed() {
  const gyms = {};
  for (const spec of gymSpecs) gyms[spec.name] = await getGym(spec);

  const branches = {};
  for (const spec of branchSpecs) {
    const gym = gyms[spec.gymName];
    branches[spec.name] = await getBranch(spec, gym.id);
  }

  const plans = {
    H4: await ensurePlan('H4 All Access · Monthly', gyms.H4.id, 2200),
    Northstar: await ensurePlan('Northstar Complete · Monthly', gyms['Northstar Fitness'].id, 1800),
    Urban: await ensurePlan('Urban Motion Plus · Monthly', gyms['Urban Motion Club'].id, 2000),
    FitPass: await ensurePlan('FitPass Active 12', 'SYSTEM', 1499, 30, { sessions: 12, coinAllowance: 120, coinInputMode: 'sessions' }),
  };

  const credentials = [];
  const fitPassAdmin = await ensureUser({ name: 'FitPass Network Manager', email: 'fitpass.manager@example.test', password: MANAGER_PASSWORD, role: 'fitpass_admin', gymId: 'SYSTEM' });
  credentials.push({ portal: 'FitPass admin', name: fitPassAdmin.name, login: fitPassAdmin.email, password: MANAGER_PASSWORD });

  const h4Admin = await ensureUser({ name: 'H4 Operations Manager', email: 'h4.manager@example.test', password: MANAGER_PASSWORD, role: 'h4_admin', gymId: gyms.H4.id });
  credentials.push({ portal: 'H4 admin', name: h4Admin.name, login: h4Admin.email, password: MANAGER_PASSWORD });

  for (const [gymName, email, name] of [
    ['Northstar Fitness', 'manager.northstar@example.test', 'Northstar Club Manager'],
    ['Urban Motion Club', 'manager.urbanmotion@example.test', 'Urban Motion Manager'],
  ]) {
    const admin = await ensureUser({ name, email, password: MANAGER_PASSWORD, role: 'partner', gymId: gyms[gymName].id });
    credentials.push({ portal: 'FitPass partner admin', name: admin.name, login: admin.email, password: MANAGER_PASSWORD });
  }

  const trainers = [];
  const trainerByBranchId = new Map();
  for (const [index, [branchName, name, email]] of [
    ['H4 Central', 'Rohan Khanna', 'rohan.khanna@example.test'],
    ['H4 Riverside', 'Naina Kapoor', 'naina.kapoor@example.test'],
    ['Northstar Downtown', 'Vikram Sen', 'vikram.sen@example.test'],
    ['Urban Motion East', 'Meera Das', 'meera.das@example.test'],
  ].entries()) {
    const branch = branches[branchName];
    const gymId = gyms[branchName.startsWith('H4') ? 'H4' : branchName.startsWith('Northstar') ? 'Northstar Fitness' : 'Urban Motion Club'].id;
    const trainer = await ensureUser({ name, email, password: STAFF_PASSWORD, role: 'trainer', gymId, branchId: branch.id, phone: `9000020${String(index + 1).padStart(3, '0')}` });
    trainers.push(trainer);
    trainerByBranchId.set(branch.id, trainer.id);
    credentials.push({ portal: branchName.startsWith('H4') ? 'H4 trainer' : 'FitPass trainer', name, login: email, password: STAFF_PASSWORD });
  }

  const receptionistSpecs = [
    ['H4 Central', 'Sana Reception', 'sana.central@example.test', gyms.H4.id],
    ['Northstar Downtown', 'Dev Front Desk', 'dev.northstar@example.test', gyms['Northstar Fitness'].id],
  ];
  for (const [index, [branchName, name, email, gymId]] of receptionistSpecs.entries()) {
    const staff = await ensureUser({ name, email, password: STAFF_PASSWORD, role: 'receptionist', gymId, branchId: branches[branchName].id, phone: `9000021${String(index + 1).padStart(3, '0')}` });
    credentials.push({ portal: branchName.startsWith('H4') ? 'H4 staff' : 'FitPass staff', name, login: email, password: STAFF_PASSWORD });
  }

  const memberPlans = [
    { gymName: 'H4', branchName: 'H4 Central', plan: plans.H4 },
    { gymName: 'H4', branchName: 'H4 Riverside', plan: plans.H4 },
    { gymName: 'Northstar Fitness', branchName: 'Northstar Downtown', plan: plans.Northstar },
    { gymName: 'Urban Motion Club', branchName: 'Urban Motion East', plan: plans.Urban },
  ];
  const memberAccounts = [];

  for (let index = 0; index < people.length; index += 1) {
    const [name, phone] = people[index];
    const scope = memberPlans[index % memberPlans.length];
    const gym = gyms[scope.gymName];
    const branch = branches[scope.branchName];
    const memberPlan = scope.gymName === 'H4' ? scope.plan : plans.FitPass;
    const registrationNumber = `GYM-26-${String(index + 1).padStart(4, '0')}`;
    const email = `member.${String(index + 1).padStart(2, '0')}@example.test`;
    const joinDate = dateDaysAgo(24 + (index % 70));
    const statusOffset = index % 8;
    const expiryDate = statusOffset === 0 ? dateDaysAgo(4) : statusOffset === 1 ? new Date(Date.now() + 4 * 86400000) : new Date(Date.now() + (30 + (index % 45)) * 86400000);
    const memberStatus = statusOffset === 0 ? 'Expired' : 'Active';
    const memberData = {
      registrationNumber, name, phone, email, gymId: gym.id, branchId: branch.id,
      planId: memberPlan.id, joinDate, expiryDate, status: memberStatus,
      planPrice: memberPlan.price, paidAmount: memberPlan.price,
      ...(scope.gymName !== 'H4' ? { sessionsTotal: 12, sessionsRemaining: 6 + (index % 6), fitpassCoins: (6 + (index % 6)) * 10, coinsMigrated: true } : {}),
    };
    const member = await prisma.member.upsert({
      where: { registrationNumber },
      create: memberData,
      update: memberData,
    });
    await ensureUser({ name, email, password: MEMBER_PASSWORD_IS_PHONE ? phone : STAFF_PASSWORD, role: 'member', gymId: gym.id, branchId: branch.id, phone, memberId: member.id });
    memberAccounts.push({ name, email, phone, password: phone, gymName: scope.gymName });

    const trainerId = trainerByBranchId.get(branch.id);
    if (trainerId) {
      const assignment = await prisma.memberTrainerAssignment.findFirst({ where: { memberId: member.id, trainerId, gymId: gym.id } });
      if (!assignment) await prisma.memberTrainerAssignment.create({ data: { memberId: member.id, trainerId, gymId: gym.id, branchId: branch.id } });
    }

    const paymentDate = new Date(joinDate);
    const paymentReference = `TXN-26-${String(index + 1).padStart(5, '0')}`;
    const existingPayment = await prisma.payment.findFirst({ where: { transactionId: paymentReference } });
    if (!existingPayment) {
      await prisma.payment.create({ data: { memberId: member.id, amount: memberPlan.price, method: index % 2 ? 'UPI' : 'Cash', date: paymentDate, gymId: gym.id, branchId: branch.id, transactionId: paymentReference, saleType: 'MEMBERSHIP', source: 'Front Desk' } });
    }

    for (let daysAgo = 1; daysAgo <= 21; daysAgo += 1) {
      if ((daysAgo + index) % 4 !== 0) continue;
      const date = dateDaysAgo(daysAgo);
      const dayStart = new Date(date); const dayEnd = new Date(date); dayEnd.setDate(dayEnd.getDate() + 1);
      const existingAttendance = await prisma.attendance.findFirst({ where: { memberId: member.id, date: { gte: dayStart, lt: dayEnd } } });
      if (!existingAttendance) {
        await prisma.attendance.create({ data: { memberId: member.id, date, checkInTime: `${String(6 + (index % 6)).padStart(2, '0')}:30`, gymId: gym.id, branchId: branch.id } });
      }
    }
  }

  for (const [index, branchName] of branchSpecs.map(item => item.name).entries()) {
    const branch = branches[branchName];
    const gymId = branch.gymId;
    const title = ['Equipment service', 'Utilities', 'Cleaning supplies', 'Group class equipment'][index];
    const existingExpense = await prisma.expense.findFirst({ where: { gymId, branchId: branch.id, title } });
    if (!existingExpense) {
      await prisma.expense.create({ data: { gymId, branchId: branch.id, title, amount: 3200 + index * 850, category: index % 2 ? 'Utilities' : 'Maintenance', date: dateDaysAgo(5 + index), description: 'Monthly operating expense' } });
    }

    for (let leadIndex = 0; leadIndex < 3; leadIndex += 1) {
      const leadPhone = `900003${String(index + 1).padStart(2, '0')}${String(leadIndex + 1).padStart(2, '0')}`;
      const existingLead = await prisma.lead.findFirst({ where: { gymId, branchId: branch.id, phone: leadPhone } });
      if (!existingLead) {
        await prisma.lead.create({ data: {
          name: ['Karan Verma', 'Simran Gill', 'Ishaan Roy'][leadIndex], phone: leadPhone,
          email: `enquiry.${index + 1}.${leadIndex + 1}@example.test`, source: ['Walk-in', 'Instagram', 'Referral'][leadIndex],
          status: ['New', 'Contacted', 'Interested'][leadIndex], interestedPlan: 'Monthly membership',
          notes: 'Asked about membership options and personal training.', gymId, branchId: branch.id,
          assignedTo: branch.managerName || 'Front Desk', followUpDate: new Date(Date.now() + (leadIndex + 1) * 86400000),
        } });
      }
    }

    const classNames = ['Strength Foundations', 'Mobility & Core'];
    for (let classIndex = 0; classIndex < classNames.length; classIndex += 1) {
      const existingClass = await prisma.gymClass.findFirst({ where: { gymId, branchId: branch.id, name: classNames[classIndex] } });
      const scheduleDate = dateDaysAgo(-1 - classIndex);
      const classData = {
        name: classNames[classIndex], type: classIndex === 0 ? 'Strength' : 'Mobility',
        description: classIndex === 0 ? 'A coached full-body strength session for all levels.' : 'A guided mobility and core class focused on control and recovery.',
        trainerName: trainers[index]?.name || 'Coach', scheduleDate, startTime: classIndex === 0 ? '07:00 AM' : '06:00 PM',
        endTime: classIndex === 0 ? '08:00 AM' : '07:00 PM', maxSeats: 18, gymId, branchId: branch.id,
      };
      if (!existingClass) await prisma.gymClass.create({ data: classData });
    }
  }

  console.log('\nShowcase accounts are ready in the configured database.');
  console.log('All staff accounts are verified and can sign in with the listed password.');
  console.log('Member password is the listed phone number.');
  console.table(credentials);
  console.table(memberAccounts.map(({ name, email, phone, password, gymName }) => ({ portal: gymName === 'H4' ? 'H4 member' : 'FitPass member', name, login: email, phone, password })));
  console.log(`\nCreated/updated ${Object.keys(branches).length} branches and ${memberAccounts.length} member accounts.`);
}

seed()
  .catch((error) => {
    console.error('Showcase seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

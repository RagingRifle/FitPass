const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../config/db');
const User = require('../models/User');
const Gym = require('../models/Gym');
const Branch = require('../models/Branch');
const Member = require('../models/Member');
const Plan = require('../models/Plan');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Attendance = require('../models/Attendance');
const Lead = require('../models/Lead');
const GymClass = require('../models/GymClass');
const MaintenanceLog = require('../models/MaintenanceLog');
const BodyAssessment = require('../models/BodyAssessment');
const WorkoutPlan = require('../models/WorkoutPlan');
const DietPlan = require('../models/DietPlan');
const PtPackage = require('../models/PtPackage');
const PtSession = require('../models/PtSession');
const PtCommission = require('../models/PtCommission');
const TrainerSalary = require('../models/TrainerSalary');
const TrainerAttendance = require('../models/TrainerAttendance');
const Payroll = require('../models/Payroll');

const seedOperationsData = async () => {
    try {
        await connectDB();
        console.log('Connected to DB for seeding operations data...');

        // 1. Get or Create Default Gym & Branch
        let gym = await Gym.findOne();
        if (!gym) {
            gym = await Gym.create({
                name: 'Zippy FitPrime Center',
                address: '45 Tech Park Avenue, Suite 100',
                phone: '+91 98765 43210',
                email: 'contact@zippyfit.com'
            });
            console.log('Created Gym:', gym.name);
        }

        let branch = await Branch.findOne({ gymId: gym._id });
        if (!branch) {
            branch = await Branch.create({
                name: 'Main Flagship Branch',
                gymId: gym._id,
                address: '45 Tech Park Avenue',
                phone: '+91 98765 43210'
            });
            console.log('Created Branch:', branch.name);
        }

        const gymId = gym._id.toString();
        const branchId = branch._id.toString();

        // 2. Ensure Admin and Trainers
        let admin = await User.findOne({ gymId, role: 'admin' });
        if (!admin) {
            admin = await User.create({
                name: 'Super Admin Operator',
                email: 'admin@example.com',
                password: 'admin123',
                role: 'admin',
                gymId,
                branchId
            });
        }

        let trainers = await User.find({ gymId, role: 'trainer' });
        if (trainers.length === 0) {
            const t1 = await User.create({
                name: 'Alex Rivera (Head Trainer)',
                email: 'alex.trainer@zippyfit.com',
                password: 'trainer123',
                role: 'trainer',
                phone: '+91 98111 22334',
                gymId,
                branchId
            });
            const t2 = await User.create({
                name: 'Sarah Connor (CrossFit Specialist)',
                email: 'sarah.trainer@zippyfit.com',
                password: 'trainer123',
                role: 'trainer',
                phone: '+91 98222 33445',
                gymId,
                branchId
            });
            trainers = [t1, t2];
            console.log('Created 2 Trainers');
        }

        const trainer1 = trainers[0];
        const trainer2 = trainers[1] || trainers[0];

        // 3. Ensure Membership Plans
        let plans = await Plan.find({ gymId });
        if (plans.length === 0) {
            const p1 = await Plan.create({
                name: 'Gold Annual Pass',
                price: 18000,
                duration: 365,
                durationUnit: 'days',
                gymId,
                branchId
            });
            const p2 = await Plan.create({
                name: 'Quarterly Strength Pass',
                price: 5500,
                duration: 90,
                durationUnit: 'days',
                gymId,
                branchId
            });
            const p3 = await Plan.create({
                name: 'Monthly Flex Pass',
                price: 2200,
                duration: 30,
                durationUnit: 'days',
                gymId,
                branchId
            });
            plans = [p1, p2, p3];
            console.log('Created 3 Plans');
        }

        // 4. Ensure Members
        let members = await Member.find({ gymId });
        const dummyMemberNames = [
            { name: 'Vikram Malhotra', phone: '9898980001', status: 'Active' },
            { name: 'Priya Sharma', phone: '9898980002', status: 'Active' },
            { name: 'Rahul Verma', phone: '9898980003', status: 'Active' },
            { name: 'Ananya Deshmukh', phone: '9898980004', status: 'Active' },
            { name: 'Karan Mehta', phone: '9898980005', status: 'Expired' },
            { name: 'Sneha Patel', phone: '9898980006', status: 'Inactive' },
        ];

        if (members.length < 5) {
            for (let i = 0; i < dummyMemberNames.length; i++) {
                const dm = dummyMemberNames[i];
                const plan = plans[i % plans.length];
                const joinDate = new Date();
                joinDate.setMonth(joinDate.getMonth() - (i + 1));
                const expiryDate = new Date(joinDate);
                expiryDate.setMonth(expiryDate.getMonth() + 3);

                const { allocateMemberCode } = require('../../utils/idGenerator');
                await Member.create({
                    registrationNumber: await allocateMemberCode(),
                    name: dm.name,
                    phone: dm.phone,
                    email: `member${i + 1}@example.com`,
                    status: dm.status,
                    planId: plan._id.toString(),
                    planPrice: plan.price,
                    paidAmount: plan.price,
                    joinDate,
                    expiryDate,
                    gymId,
                    branchId
                });
            }
            members = await Member.find({ gymId });
            console.log(`Ensured ${members.length} Members in Database`);
        }

        const m1 = members[0];
        const m2 = members[1] || m1;
        const m3 = members[2] || m1;

        // 5. Seed Attendance Logs
        const now = new Date();
        const attendanceRecords = await Attendance.countDocuments({ gymId });
        if (attendanceRecords < 10) {
            for (let day = 0; day < 7; day++) {
                const date = new Date(now);
                date.setDate(date.getDate() - day);

                await Attendance.create({
                    memberId: m1._id.toString(),
                    gymId,
                    branchId,
                    date,
                    checkInTime: '09:30 AM'
                });
                await Attendance.create({
                    memberId: m2._id.toString(),
                    gymId,
                    branchId,
                    date,
                    checkInTime: '10:15 AM'
                });
            }
            console.log('Seeded Attendance logs');
        }

        // 6. Seed Trainer Attendance
        const trAttCount = await TrainerAttendance.countDocuments({ gymId });
        if (trAttCount < 5) {
            for (let day = 0; day < 5; day++) {
                const date = new Date(now);
                date.setDate(date.getDate() - day);

                await TrainerAttendance.create({
                    trainerId: trainer1._id.toString(),
                    gymId,
                    branchId,
                    date,
                    checkInTime: new Date(date.setHours(8, 0, 0, 0)),
                    checkOutTime: new Date(date.setHours(16, 0, 0, 0)),
                    workingHours: 8.0
                });
                await TrainerAttendance.create({
                    trainerId: trainer2._id.toString(),
                    gymId,
                    branchId,
                    date,
                    checkInTime: new Date(date.setHours(9, 0, 0, 0)),
                    checkOutTime: new Date(date.setHours(17, 0, 0, 0)),
                    workingHours: 8.0
                });
            }
            console.log('Seeded Trainer Attendance logs');
        }

        // 7. Seed Payments
        const paymentCount = await Payment.countDocuments({ gymId });
        if (paymentCount < 5) {
            await Payment.create({
                memberId: m1._id.toString(),
                amount: 18000,
                method: 'UPI',
                date: new Date(),
                transactionId: 'TXN-1001',
                gymId,
                branchId
            });
            await Payment.create({
                memberId: m2._id.toString(),
                amount: 5500,
                method: 'Credit Card',
                date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
                transactionId: 'TXN-1002',
                gymId,
                branchId
            });
            await Payment.create({
                memberId: m3._id.toString(),
                amount: 2200,
                method: 'Cash',
                date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
                transactionId: 'TXN-1003',
                gymId,
                branchId
            });
            console.log('Seeded Payments');
        }

        // 8. Seed Expenses
        const expenseCount = await Expense.countDocuments({ gymId });
        if (expenseCount < 3) {
            await Expense.create({
                title: 'Electricity & Utility Bill',
                amount: 14500,
                category: 'Utilities',
                date: new Date(),
                description: 'Monthly power backup and AC maintenance',
                gymId,
                branchId
            });
            await Expense.create({
                title: 'Equipment Maintenance Service',
                amount: 6000,
                category: 'Maintenance',
                date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
                description: 'Treadmill belt replacement',
                gymId,
                branchId
            });
            console.log('Seeded Expenses');
        }

        // 9. Seed Leads
        const leadCount = await Lead.countDocuments({ gymId });
        if (leadCount < 4) {
            await Lead.create({
                name: 'Amitabh Sen',
                phone: '9777711111',
                email: 'amitabh@example.com',
                source: 'Instagram Ad',
                status: 'New',
                notes: 'Interested in personal training package',
                gymId,
                branchId
            });
            await Lead.create({
                name: 'Rohan Gupta',
                phone: '9777722222',
                email: 'rohan@example.com',
                source: 'Walk-in',
                status: 'Trial Booked',
                notes: 'Trial session scheduled for tomorrow evening',
                gymId,
                branchId
            });
            await Lead.create({
                name: 'Kavita Roy',
                phone: '9777733333',
                email: 'kavita@example.com',
                source: 'Google Search',
                status: 'Converted',
                notes: 'Purchased Gold Annual Pass',
                gymId,
                branchId
            });
            console.log('Seeded Leads');
        }

        // 10. Seed Gym Classes
        const classCount = await GymClass.countDocuments({ gymId });
        if (classCount < 2) {
            await GymClass.create({
                name: 'HIIT Cardio Blast',
                type: 'Group Fitness',
                description: 'High intensity interval training',
                trainerName: trainer1.name,
                scheduleDate: new Date(),
                startTime: '07:00 AM',
                endTime: '08:00 AM',
                maxSeats: 20,
                gymId,
                branchId
            });
            await GymClass.create({
                name: 'Power Yoga & Stretch',
                type: 'Flexibility',
                description: 'Flexibility and posture alignment',
                trainerName: trainer2.name,
                scheduleDate: new Date(),
                startTime: '06:00 PM',
                endTime: '07:00 PM',
                maxSeats: 15,
                gymId,
                branchId
            });
            console.log('Seeded Gym Classes');
        }

        // 11. Seed Equipment & Maintenance Logs
        const Equipment = require('../models/Equipment');
        const eqCount = await Equipment.countDocuments({ gymId });
        if (eqCount < 3) {
            await Equipment.create({
                name: 'Commercial Treadmill T5',
                brand: 'Jerai Fitness',
                status: 'Functional',
                purchaseDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
                gymId,
                branchId
            });
            await Equipment.create({
                name: 'Leg Press Pro Machine',
                brand: 'Life Fitness',
                status: 'Functional',
                purchaseDate: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
                gymId,
                branchId
            });
            await Equipment.create({
                name: 'Elliptical Trainer E8',
                brand: 'Technogym',
                status: 'Maintenance',
                purchaseDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
                gymId,
                branchId
            });
            console.log('Seeded Equipment Records');
        }

        const maintCount = await MaintenanceLog.countDocuments({ gymId });
        if (maintCount < 2) {
            await MaintenanceLog.create({
                equipmentName: 'Commercial Treadmill T5',
                issueDescription: 'Belt slipping at speed > 12km/h',
                status: 'In Progress',
                cost: 3500,
                loggedDate: new Date(),
                gymId,
                branchId
            });
            console.log('Seeded Maintenance Logs');
        }

        // 12. Seed Body Assessments
        const bodyCount = await BodyAssessment.countDocuments({ gymId });
        if (bodyCount < 2) {
            await BodyAssessment.create({
                memberId: m1._id.toString(),
                trainerId: trainer1._id.toString(),
                weight: 78.5,
                bmi: 24.8,
                bodyFat: 16.5,
                muscleMass: 62.0,
                bmr: 1750,
                assessmentDate: new Date(),
                gymId,
                branchId
            });
            await BodyAssessment.create({
                memberId: m2._id.toString(),
                trainerId: trainer2._id.toString(),
                weight: 62.0,
                bmi: 22.8,
                bodyFat: 21.0,
                muscleMass: 45.2,
                bmr: 1420,
                assessmentDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
                gymId,
                branchId
            });
            console.log('Seeded Body Assessments');
        }

        // 13. Seed Workout Plans
        const workoutCount = await WorkoutPlan.countDocuments({ gymId });
        if (workoutCount < 2) {
            await WorkoutPlan.create({
                memberId: m1._id.toString(),
                trainerId: trainer1._id.toString(),
                name: 'Hypertrophy 4-Day Split',
                exercises: JSON.stringify([
                    { name: 'Barbell Bench Press', sets: 4, reps: 10, weightKg: 80 },
                    { name: 'Incline Dumbbell Press', sets: 3, reps: 12, weightKg: 28 }
                ]),
                gymId,
                branchId
            });
            console.log('Seeded Workout Plans');
        }

        // 14. Seed Diet Plans
        const dietCount = await DietPlan.countDocuments({ gymId });
        if (dietCount < 2) {
            await DietPlan.create({
                memberId: m1._id.toString(),
                trainerId: trainer1._id.toString(),
                name: 'High Protein Muscle Gain',
                meals: JSON.stringify([
                    { time: '08:00 AM', items: 'Oats 80g, 4 Egg Whites, Almonds' },
                    { time: '01:30 PM', items: 'Grilled Chicken 200g, Brown Rice 150g' }
                ]),
                gymId,
                branchId
            });
            console.log('Seeded Diet Plans');
        }

        // 15. Seed PT Packages & PT Sessions
        const ptPkgCount = await PtPackage.countDocuments({ gymId });
        if (ptPkgCount < 2) {
            const ptPkg = await PtPackage.create({
                name: '12 Session PT Transformation',
                sessionCount: 12,
                price: 15000,
                gymId,
                branchId
            });

            await PtSession.create({
                packageId: ptPkg._id.toString(),
                trainerId: trainer1._id.toString(),
                memberId: m1._id.toString(),
                sessionDate: new Date(),
                status: 'Completed',
                notes: 'Focus on chest & triceps heavy hypertrophy',
                gymId,
                branchId
            });
            console.log('Seeded PT Packages & Sessions');
        }

        // 16. Seed Salary Structure & Payroll Slips
        const salCount = await TrainerSalary.countDocuments({ gymId });
        if (salCount < 2) {
            await TrainerSalary.create({
                trainerId: trainer1._id.toString(),
                fixedSalary: 35000,
                commissionPt: 300,
                gymId,
                branchId
            });
            await TrainerSalary.create({
                trainerId: trainer2._id.toString(),
                fixedSalary: 30000,
                commissionPt: 250,
                gymId,
                branchId
            });
            console.log('Seeded Salary Structures');
        }

        const currMonth = new Date().getMonth() + 1;
        const currYear = new Date().getFullYear();
        const payCount = await Payroll.countDocuments({ gymId });
        if (payCount < 2) {
            await Payroll.create({
                trainerId: trainer1._id.toString(),
                month: currMonth,
                year: currYear,
                fixedSalary: 35000,
                commissions: 3600,
                incentives: 2000,
                totalAmount: 40600,
                status: 'Pending',
                gymId,
                branchId
            });
            await Payroll.create({
                trainerId: trainer2._id.toString(),
                month: currMonth,
                year: currYear,
                fixedSalary: 30000,
                commissions: 2250,
                incentives: 1000,
                totalAmount: 33250,
                status: 'Paid',
                paymentDate: new Date(),
                gymId,
                branchId
            });
            console.log('Seeded Payroll Records');
        }

        console.log('✅ SEEDING COMPLETE FOR ALL OPERATIONS MODULES!');
        process.exit(0);
    } catch (err) {
        console.error('Seeding error:', err);
        process.exit(1);
    }
};

seedOperationsData();

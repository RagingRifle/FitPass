const express = require('express');
const helmet = require('helmet');
// Nodemon schema reload trigger comment - Updated for diet completion logging endpoint.
const env = require('./config/env');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const { PLACEHOLDER_SECRETS } = require('./config/constants');

const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const { globalLimiter } = require('./middleware/rateLimiters');
const startCronJobs = require('./utils/cronJobs');
const logger = require('./lib/logger');

dotenv.config();

// --- Boot-time security guard (B1): never start with a missing/placeholder JWT secret ---
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || PLACEHOLDER_SECRETS.includes(jwtSecret)) {
    logger.error('[FATAL] JWT_SECRET is missing or still set to a placeholder value. Generate one with: node scripts/dev/generateSecret.js — then put it in your .env as JWT_SECRET=<value>');
    process.exit(1);
}

connectDB();
startCronJobs();

const app = express();
const requestId = require('./middleware/requestId');

// The API sits behind the local Nginx reverse proxy on the VPS. Trust exactly
// that one hop so Express and express-rate-limit use the original client IP
// from X-Forwarded-For instead of treating every request as localhost.
app.set('trust proxy', 1);

// --- Request ID Context (Phase 6.2) ---
app.use(requestId);

// --- Security headers (B4) ---
app.use(helmet());

// --- Global rate limiter (B2) ---
app.use('/api', globalLimiter);

// --- CORS (B4: tightened for production) ---
// In production only explicit origins are trusted. In dev we also allow
// localhost and local network IPs (for Expo / physical device testing).
const isProd = env.isProduction;
const prodOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const isVercelOrigin = (value) => /^https:\/\/([a-z0-9-]+\.)?vercel\.app$/i.test(value);

app.use(cors({
    credentials: true,
    origin(origin, callback) {
        // Allow non-browser clients (mobile apps, curl) which send no Origin.
        if (!origin) return callback(null, true);
        if (!isProd) {
            // Dev: localhost + RFC1918 LAN (Expo, physical devices).
            if (
                origin.startsWith('http://localhost:') ||
                origin.startsWith('http://192.168.') ||
                origin.startsWith('http://10.') ||
                origin.startsWith('http://172.')
            ) {
                return callback(null, true);
            }
            return callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
        // Prod: explicit allowlist only (ignoring trailing slashes),
        // plus Vercel-hosted frontends used for deployed previews and production.
        const normalizedOrigin = origin.replace(/\/$/, '');
        const hasMatch = prodOrigins.some(o => o.replace(/\/$/, '') === normalizedOrigin);
        if (hasMatch || isVercelOrigin(normalizedOrigin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
}));

app.use(express.json({ limit: '1mb' })); // bound body size -> mild DoS hardening
if (env.isDevelopment) {
    app.use(morgan('dev'));
}

// Universal Health Check
app.get('/', (req, res) => {
    res.status(200).json({ success: true, status: 'Server running' });
});

// Health Check
app.get('/api/health', (req, res) => {
    res.status(200).json({ success: true, status: 'Server running' });
});

// API Versioning rewrite for backward compatibility (preserves HTTP method & body)
app.use((req, res, next) => {
    if (!req.path.startsWith('/api/')) {
        return next();
    }
    const apiPath = req.path.substring(5); // Strips '/api/'
    if (apiPath.startsWith('v1/') || apiPath === 'health') {
        return next();
    }
    // Rewrite /api/X to /api/v1/X internally without HTTP redirect method conversion
    const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    req.url = `/api/v1/${apiPath}${query}`;
    next();
});

// Routes
app.use('/api/v1/auth', require('./routes/authRoutes'));
app.use('/api/v1/plans', require('./routes/planRoutes'));
app.use('/api/v1/members', require('./routes/memberRoutes'));
app.use('/api/v1/members/:id', require('./routes/freezeRoutes'));
app.use('/api/v1/payments', require('./routes/paymentRoutes'));
app.use('/api/v1/attendance', require('./routes/attendanceRoutes'));
app.use('/api/v1/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/v1/expenses', require('./routes/expenseRoutes'));
app.use('/api/v1/member-portal', require('./routes/memberPortalRoutes'));
app.use('/api/v1/tickets', require('./routes/ticketRoutes'));
app.use('/api/v1/reports', require('./routes/reportRoutes'));
app.use('/api/v1/notifications', require('./routes/notificationRoutes'));
app.use('/api/v1/classes', require('./routes/classRoutes'));
app.use('/api/v1/leads', require('./routes/leadRoutes'));
app.use('/api/v1/analytics', require('./routes/analyticsRoutes'));
app.use('/api/v1/audit', require('./routes/auditRoutes'));
app.use('/api/v1/branches', require('./routes/branchRoutes'));
app.use('/api/v1/staff', require('./routes/staffRoutes'));
app.use('/api/v1/superadmin', require('./routes/superAdminRoutes'));
app.use('/api/v1/gyms', require('./routes/gymRoutes'));
app.use('/api/v1/equipments', require('./routes/equipmentRoutes'));
app.use('/api/v1/discovery', require('./routes/discoveryRoutes'));

// FitPrime session admin-adjust (member-facing session routes live under
// member-portal above). Mounted standalone with its own protect/authorize.
app.use('/api/v1/sessions', require('./routes/sessionRoutes'));

app.use('/api/v1/trainer-assignments', require('./routes/memberTrainerAssignmentRoutes'));
app.use('/api/v1/workout-templates', require('./routes/workoutTemplateRoutes'));
app.use('/api/v1/workout-plans', require('./routes/workoutPlanRoutes'));
app.use('/api/v1/diet-plans', require('./routes/dietPlanRoutes'));
app.use('/api/v1/diet-templates', require('./routes/dietTemplateRoutes'));
app.use('/api/v1/pt-packages', require('./routes/ptPackageRoutes'));
app.use('/api/v1/pt-sessions', require('./routes/ptSessionRoutes'));
app.use('/api/v1/body-assessments', require('./routes/bodyAssessmentRoutes'));
app.use('/api/v1/trainer-attendance', require('./routes/trainerAttendanceRoutes'));
app.use('/api/v1/payroll', require('./routes/payrollRoutes'));


// Test routes (Dev only)
if (!env.isProduction) {
    app.use('/api/test', require('./routes/testRoutes'));
}

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${PORT} (${env.NODE_ENV || 'development'})`);
});
// Nodemon reload triggered for CORS connection fixes

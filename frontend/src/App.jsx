import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useContext, Suspense, lazy } from 'react';
import { AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastProvider } from './components/ui/Toast';

// Route-level code splitting: every page below used to be imported eagerly,
// so the very first paint (any role, any route) downloaded the entire app
// — every dashboard, chart library, and QR scanner — in one ~1.5MB bundle.
// Lazy-loading means a route's JS is only fetched when that route is visited.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Plans = lazy(() => import('./pages/Plans'));
const Members = lazy(() => import('./pages/Members'));
const Payments = lazy(() => import('./pages/Payments'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Dues = lazy(() => import('./pages/Dues'));
const MemberDashboard = lazy(() => import('./pages/MemberDashboard'));
const Reports = lazy(() => import('./pages/Reports'));
const FreezeManagement = lazy(() => import('./pages/FreezeManagement'));
const Classes = lazy(() => import('./pages/Classes'));
const MemberClasses = lazy(() => import('./pages/MemberClasses'));
const Leads = lazy(() => import('./pages/Leads'));
const Analytics = lazy(() => import('./pages/Analytics'));
const AuditLogs = lazy(() => import('./pages/AuditLogs'));
const Branches = lazy(() => import('./pages/Branches'));
const Staff = lazy(() => import('./pages/Staff'));
const SuperAdminDashboard = lazy(() => import('./pages/superadmin/SuperAdminDashboard'));
const PartnerGyms = lazy(() => import('./pages/superadmin/PartnerGyms'));
const FitPrimePlans = lazy(() => import('./pages/superadmin/FitPrimePlans'));
const FitPassMembers = lazy(() => import('./pages/superadmin/FitPassMembers'));
const AdminManagement = lazy(() => import('./pages/superadmin/AdminManagement'));
const BodyAssessments = lazy(() => import('./pages/BodyAssessments'));
const TrainerAttendancePage = lazy(() => import('./pages/TrainerAttendancePage'));
const PayrollPage = lazy(() => import('./pages/PayrollPage'));
const FitPassAnalyticsPage = lazy(() => import('./pages/FitPassAnalyticsPage'));
const WorkoutPlans = lazy(() => import('./pages/WorkoutPlans'));
const DietPlans = lazy(() => import('./pages/DietPlans'));
const Settings = lazy(() => import('./pages/Settings'));
const FitPassVisitLog = lazy(() => import('./pages/FitPassVisitLog'));
const FitPassPartnerLeads = lazy(() => import('./pages/FitPassPartnerLeads'));
const GymProfileDiscovery = lazy(() => import('./pages/GymProfileDiscovery'));
const DiscoveryApprovalQueue = lazy(() => import('./pages/superadmin/DiscoveryApprovalQueue'));
const FitPassGymExplore = lazy(() => import('./pages/FitPassGymExplore'));
const FitPassLanding = lazy(() => import('./pages/FitPassLanding'));
const StaffLogin = lazy(() => import('./pages/StaffLogin'));

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <div className="spinner"></div>
  </div>
);

function App() {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <PageLoader />;

  return (
    <ToastProvider>
      <Router>
        <Suspense fallback={<PageLoader />}>
        <Routes>
        <Route path="/" element={!user ? <FitPassLanding /> : (() => {
          const normalizedGym = (user?.gymName || user?.gymId?.name || '').toUpperCase();
          const userGymId = user?.gymId?._id || user?.gymId || '';
          const isH4Gym = normalizedGym === 'H4' || userGymId === '05a08fdf-7427-48a5-8b25-e18d5a5668cd';
          const isPartnerAdmin = user?.role === 'partner' || (user?.role === 'admin' && !isH4Gym);
          const target = ['superadmin', 'fitpass_admin'].includes(user?.role) ? '/superadmin/dashboard' :
            isPartnerAdmin ? '/partner/visit-log' :
            ['admin', 'h4_admin'].includes(user?.role) ? '/dashboard' :
            user?.role === 'trainer' ? '/attendance' : user?.role === 'member' ? '/member-dashboard' : '/members';
          return <Navigate to={target} replace />;
        })()} />
        <Route path="/login" element={!user ? <Navigate to="/member-login" replace /> : <Navigate to="/" replace />} />
        <Route path="/member-login" element={!user ? <Login portal="fitpass_member" /> : <Navigate to="/" replace />} />
        <Route path="/h4/login" element={!user ? <Login portal="h4_member" /> : <Navigate to="/" replace />} />
        <Route path="/staff-login" element={!user ? <StaffLogin /> : <Navigate to="/" replace />} />
        <Route path="/control-room" element={!user ? <Login restrictedAdmin /> : <Navigate to="/" replace />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to="/" replace />} />

        <Route path="/superadmin/dashboard" element={
          <ProtectedRoute roles={['superadmin', 'fitpass_admin']}>
            <Layout>
              <SuperAdminDashboard />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/superadmin/gyms" element={
          <ProtectedRoute roles={['superadmin', 'fitpass_admin']}>
            <Layout>
              <PartnerGyms />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/superadmin/plans" element={
          <ProtectedRoute roles={['superadmin', 'fitpass_admin']}>
            <Layout>
              <FitPrimePlans />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/superadmin/fitpass-members" element={
          <ProtectedRoute roles={['superadmin', 'fitpass_admin']}>
            <Layout>
              <FitPassMembers />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/superadmin/admins" element={
          <ProtectedRoute roles={['superadmin']}>
            <Layout>
              <AdminManagement />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/superadmin/fitpass-analytics" element={
          <ProtectedRoute roles={['superadmin', 'fitpass_admin']}>
            <Layout>
              <FitPassAnalyticsPage />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/dashboard" element={
          <ProtectedRoute roles={['admin', 'h4_admin', 'superadmin']}>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        } />



        <Route path="/plans" element={
          <ProtectedRoute roles={['admin', 'h4_admin']}>
            <Layout>
              <Plans />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/members" element={
          <ProtectedRoute roles={['admin', 'receptionist', 'superadmin', 'fitpass_admin', 'h4_admin']}>
            <Layout>
              <Members />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/payments" element={
          <ProtectedRoute roles={['admin', 'receptionist', 'h4_admin']}>
            <Layout>
              <Payments />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/attendance" element={
          <ProtectedRoute roles={['admin', 'trainer', 'h4_admin']}>
            <Layout>
              <Attendance />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/expenses" element={
          <ProtectedRoute roles={['admin', 'h4_admin']}>
            <Layout>
              <Expenses />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/dues" element={
          <ProtectedRoute roles={['admin', 'receptionist', 'h4_admin']}>
            <Layout>
              <Dues />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/member-dashboard" element={
          <ProtectedRoute roles={['member']}>
            <Layout>
              <MemberDashboard />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/reports" element={
          <ProtectedRoute roles={['admin', 'h4_admin']}>
            <Layout>
              <Reports />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/freeze" element={
          <ProtectedRoute roles={['admin', 'receptionist', 'h4_admin']}>
            <Layout>
              <FreezeManagement />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/classes" element={
          <ProtectedRoute roles={['admin', 'trainer', 'h4_admin']}>
            <Layout>
              <Classes />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/member-classes" element={
          <ProtectedRoute roles={['member']}>
            <Layout>
              <MemberClasses />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/leads" element={
          <ProtectedRoute roles={['admin', 'receptionist', 'h4_admin']}>
            <Layout>
              <Leads />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/analytics" element={
          <ProtectedRoute roles={['admin', 'h4_admin']}>
            <Layout>
              <Analytics />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/fitpass-analytics" element={
          <ProtectedRoute roles={['admin', 'h4_admin']}>
            <Layout>
              <FitPassAnalyticsPage />
            </Layout>
          </ProtectedRoute>
        } />

        {/* ─── FitPass Partner portal (read-only, gym-scoped) ─── */}
        <Route path="/partner/visit-log" element={
          <ProtectedRoute roles={['partner', 'admin']}>
            <Layout>
              <FitPassVisitLog />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/partner/fitpass-leads" element={
          <ProtectedRoute roles={['partner', 'admin']}>
            <Layout>
              <FitPassPartnerLeads />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/audit" element={
          <ProtectedRoute roles={['superadmin', 'fitpass_admin', 'h4_admin']}>
            <Layout>
              <AuditLogs />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/branches" element={
          <ProtectedRoute roles={['admin', 'h4_admin']}>
            <Layout>
              <Branches />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/staff" element={
          <ProtectedRoute roles={['admin', 'h4_admin']}>
            <Layout>
              <Staff />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/body-assessments" element={
          <ProtectedRoute roles={['admin', 'trainer', 'member', 'h4_admin']}>
            <Layout>
              <BodyAssessments />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/trainer-attendance" element={
          <ProtectedRoute roles={['admin', 'trainer', 'h4_admin']}>
            <Layout>
              <TrainerAttendancePage />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/payroll" element={
          <ProtectedRoute roles={['admin', 'trainer', 'h4_admin']}>
            <Layout>
              <PayrollPage />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/workout-plans" element={
          <ProtectedRoute roles={['admin', 'trainer', 'member', 'h4_admin']}>
            <Layout>
              <WorkoutPlans />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/diet-plans" element={
          <ProtectedRoute roles={['admin', 'trainer', 'member', 'h4_admin']}>
            <Layout>
              <DietPlans />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/gym-social-profile" element={
          <ProtectedRoute roles={['admin', 'partner', 'h4_admin']}>
            <Layout>
              <GymProfileDiscovery />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/explore-gyms" element={
          <ProtectedRoute roles={['member', 'admin', 'partner', 'superadmin', 'h4_admin', 'fitpass_admin']}>
            <Layout>
              <FitPassGymExplore />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/superadmin/discovery-approvals" element={
          <ProtectedRoute roles={['superadmin', 'fitpass_admin', 'h4_admin']}>
            <Layout>
              <DiscoveryApprovalQueue />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="/settings" element={
          <ProtectedRoute roles={['admin', 'h4_admin', 'superadmin', 'partner']}>
            <Layout>
              <Settings />
            </Layout>
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      </Suspense>
    </Router>
  </ToastProvider>
  );
}

export default App;

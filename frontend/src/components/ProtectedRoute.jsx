import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ProtectedRoute = ({ children, roles }) => {
    const { user, loading, activeDivision } = useContext(AuthContext);

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <div className="spinner"></div>
        </div>
    );

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    const normalizedGym = (user.gymName || user.gymId?.name || '').toUpperCase();
    const userGymId = user.gymId?._id || user.gymId || '';
    const isH4Gym = normalizedGym === 'H4' || ['05a08fdf-7427-48a5-8b25-e18d5a5668cd', '327d37e7-f978-43a9-82ef-e6c4a4dc3c5d'].includes(String(userGymId));
    const isPartnerAdmin = user.role === 'partner' || (user.role === 'admin' && !isH4Gym);

    if (window.location.pathname === '/superadmin/fitpass-payouts' && user.role === 'fitpass_admin' && user.fitPassPayoutAccess !== true) {
        return <Navigate to="/superadmin/dashboard" replace />;
    }

    if (window.location.pathname === '/fitpass-classes' && (isH4Gym || activeDivision === 'h4')) {
        return <Navigate to={user.role === 'trainer' ? '/attendance' : '/classes'} replace />;
    }

  const h4BranchPaths = ['/dashboard', '/members', '/leads', '/plans', '/classes', '/h4/trial-codes', '/body-assessments', '/payments', '/sales', '/expenses', '/dues', '/attendance', '/trainer-attendance', '/payroll', '/reports', '/freeze', '/analytics', '/workout-plans', '/diet-plans'];
    if (user.role === 'h4_admin' && user.branchId && !h4BranchPaths.includes(window.location.pathname)) {
        return <Navigate to="/dashboard" replace />;
    }

    const partnerAllowedPaths = [
        '/partner/visit-log',
        '/partner/fitpass-leads',
        '/staff',
        '/fitpass-classes',
        '/gym-social-profile',
        '/explore-gyms',
        '/settings'
    ];

    if (isPartnerAdmin && !partnerAllowedPaths.includes(window.location.pathname)) {
        return <Navigate to="/partner/visit-log" replace />;
    }

    if (roles && user.role !== 'superadmin' && !roles.includes(user.role) && !isPartnerAdmin) {
        const defaultPath = user.role === 'fitpass_admin' ? '/superadmin/dashboard' :
            user.role === 'h4_admin' ? '/dashboard' :
            user.role === 'superadmin' ? '/superadmin/dashboard' :
            user.role === 'admin' ? '/dashboard' :
                user.role === 'trainer' ? '/attendance' :
                    user.role === 'member' ? '/member-dashboard' :
                        isPartnerAdmin ? '/partner/visit-log' :
                            '/members';
        return <Navigate to={defaultPath} replace />;
    }

    return children;
};

export default ProtectedRoute;

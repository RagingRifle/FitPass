import Sidebar from './Sidebar';
import AppHeader from './AppHeader';
import { SidebarProvider, useSidebar } from '../context/SidebarContext';
import { useLocation } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

const Layout = ({ children }) => {
    const { mobileOpen, closeMobile } = useSidebar();
    const location = useLocation();
    const { user } = useContext(AuthContext);
    const isMemberPortal = user?.role === 'member' && ['/member-dashboard', '/member-classes', '/member-support', '/body-assessments', '/workout-plans', '/diet-plans', '/explore-gyms'].includes(location.pathname);
    return (
        <div className={`app-container ${isMemberPortal ? 'member-portal-shell' : ''}`}>
            <Sidebar />
            <div
                className={`mobile-overlay ${mobileOpen ? 'active' : ''}`}
                onClick={closeMobile}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                <AppHeader />
                <main className="main-content fade-in">
                    <div className="page-content">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

const LayoutWithProvider = ({ children }) => (
    <SidebarProvider>
        <Layout>{children}</Layout>
    </SidebarProvider>
);

export default LayoutWithProvider;


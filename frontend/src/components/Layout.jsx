import Sidebar from './Sidebar';
import AppHeader from './AppHeader';
import { SidebarProvider, useSidebar } from '../context/SidebarContext';

const Layout = ({ children }) => {
    const { mobileOpen, closeMobile } = useSidebar();
    return (
        <div className="app-container">
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


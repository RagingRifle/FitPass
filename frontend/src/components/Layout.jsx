import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import AppHeader from './AppHeader';
import { SidebarProvider, useSidebar } from '../context/SidebarContext';

const Layout = ({ children }) => {
    const { mobileOpen, closeMobile } = useSidebar();
    const [theme, setTheme] = useState(() => {
        const savedTheme = localStorage.getItem('gymcrm-theme');
        return ['light', 'dark', 'hybrid'].includes(savedTheme) ? savedTheme : 'light';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('gymcrm-theme', theme);
    }, [theme]);

    return (
        <div className="app-container">
            <Sidebar />
            <div
                className={`mobile-overlay ${mobileOpen ? 'active' : ''}`}
                onClick={closeMobile}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                <AppHeader
                    theme={theme}
                    onThemeToggle={() => setTheme(current => (
                        current === 'light' ? 'dark' : current === 'dark' ? 'hybrid' : 'light'
                    ))}
                />
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


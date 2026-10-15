import { useContext, useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';
import { Search, Bell, Menu, ChevronDown, X, Sun, Moon } from 'lucide-react';
import API from '../services/api';
import { useTheme } from '../context/ThemeContext';

const PAGE_TITLES = {
    '/dashboard': 'Dashboard Overview',
    '/superadmin/dashboard': 'Network Overview',
    '/members': 'Member Directory',
    '/plans': 'Membership Plans',
    '/payments': 'Financial Transactions',
    '/attendance': 'Attendance Logs',
    '/expenses': 'Expense Tracking',
    '/dues': 'Outstanding Dues',
    '/reports': 'Business Reports',
    '/freeze': 'Freeze Management',
    '/classes': 'Class Scheduling',
    '/analytics': 'Performance Analytics',
    '/branches': 'Multi-Branch Management',
    '/audit': 'System Audit Logs',
    '/leads': 'Sales & Leads',
    '/member-dashboard': 'My Fitness Portal',
    '/member-classes': 'My Class Schedule',
    '/partner/visit-log': 'FitPass Member Check-Ins',
    '/partner/fitpass-leads': 'FitPass Member Audit & Leads',
};

const AppHeader = () => {
    const { theme, toggleTheme } = useTheme();
    const { user, selectedGymId, changeSelectedGym, activeDivision, selectedBranchId, changeSelectedBranch } = useContext(AuthContext);
    const { toggleMobile } = useSidebar();
    const location = useLocation();
    const navigate = useNavigate();

    // Gym/Branch list for context selectors
    const [gyms, setGyms] = useState([]);

    useEffect(() => {
        const fetchGyms = async () => {
            if (user?.role === 'superadmin' || user?.role === 'fitpass_admin') {
                try {
                    if (activeDivision === 'h4' && user?.role !== 'fitpass_admin') {
                        // Fetch H4 main gym and H4 branches
                        const [h4Res, branchesRes] = await Promise.all([
                            API.get('/superadmin/h4-gym').catch(() => ({ data: null })),
                            API.get('/branches').catch(() => ({ data: [] }))
                        ]);
                        
                        const h4Gym = h4Res.data;
                        const h4GymId = h4Gym ? (h4Gym._id || h4Gym.id) : '';
                        
                        if (h4GymId && !selectedGymId) {
                            changeSelectedGym(h4GymId);
                        }

                        const branches = Array.isArray(branchesRes.data) ? branchesRes.data : [];
                        setGyms(branches);
                    } else {
                        // Fetch FitPass partner gyms for FitPass Portal
                        const { data } = await API.get('/superadmin/gyms');
                        setGyms(data || []);
                    }
                } catch (err) {
                    console.error('Failed to fetch gyms for selector:', err);
                }
            } else if (['partner', 'h4_admin', 'admin'].includes(user?.role)) {
                try {
                    const { data: branches } = await API.get('/branches');
                    setGyms(Array.isArray(branches) ? branches : []);
                } catch (err) {
                    console.error('Failed to fetch branches for partner/h4_admin:', err);
                }
            }
        };
        fetchGyms();
    }, [user, activeDivision, selectedGymId]);

    const normalizedGym = (user?.gymName || user?.gymId?.name || '').toUpperCase();
    const userGymId = user?.gymId?._id || user?.gymId || '';
    const isH4User = user?.role === 'h4_admin' || normalizedGym === 'H4' || userGymId === '05a08fdf-7427-48a5-8b25-e18d5a5668cd' || (activeDivision === 'h4' && !['partner'].includes(user?.role));

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const searchRef = useRef(null);
    const debounceRef = useRef(null);

    // Notifications state
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const notifRef = useRef(null);

    const getPageTitle = () => PAGE_TITLES[location.pathname] || 'GYM CRM Management';
    const getWorkspaceLabel = () => {
        if (['superadmin', 'fitpass_admin'].includes(user?.role)) {
            return isH4User ? 'H4 GYM NETWORK' : 'FITPASS NETWORK';
        }
        if (user?.role === 'member') return 'MEMBER PORTAL';
        if (user?.role === 'partner') return 'PARTNER PORTAL';
        return 'GYM OPERATIONS';
    };

    // Search debounce
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setSearchOpen(false);
            return;
        }

        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const { data } = await API.get(`/members?search=${encodeURIComponent(searchQuery)}&limit=5`);
                const members = data.members || data || [];
                // Filter by name/phone client-side as a fallback
                const filtered = members.filter(m =>
                    m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    m.phone?.includes(searchQuery) ||
                    m.email?.toLowerCase().includes(searchQuery.toLowerCase())
                );
                setSearchResults(filtered.slice(0, 6));
                setSearchOpen(true);
            } catch {
                setSearchResults([]);
            } finally {
                setSearchLoading(false);
            }
        }, 300);

        return () => clearTimeout(debounceRef.current);
    }, [searchQuery]);

    // Fetch notifications
    useEffect(() => {
        const fetchNotifs = async () => {
            try {
                const { data } = await API.get('/notifications');
                setNotifications(data.slice(0, 8));
                setUnreadCount(data.filter(n => !n.read).length);
            } catch { }
        };
        fetchNotifs();
    }, []);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClick = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setSearchOpen(false);
            }
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setNotifOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleSearchSelect = (member) => {
        setSearchQuery('');
        setSearchOpen(false);
        navigate(`/members?highlight=${member._id}`);
    };

    const handleMarkRead = async (id) => {
        try {
            await API.put(`/notifications/${id}`);
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch { }
    };

    return (
        <header className="app-header">
            <div className="header-start">
                <button
                    className="header-btn show-mobile"
                    onClick={toggleMobile}
                    aria-label="Toggle Menu"
                >
                    <Menu size={20} />
                </button>
                <div className="header-title-stack">
                    <span className="header-workspace-label">{getWorkspaceLabel()}</span>
                    <h1 className="page-title">{getPageTitle()}</h1>
                </div>

                {['superadmin', 'fitpass_admin', 'h4_admin'].includes(user?.role) && isH4User && (
                    <div className="header-context-select">
                        {user?.branchId ? (
                            <div className="header-context-static" style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                background: '#FBF6EC',
                                border: '1px solid #E5D5C0',
                                borderRadius: '20px',
                                padding: '0.35rem 1rem',
                                color: '#231D14',
                                fontWeight: 700,
                                fontSize: '0.875rem',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                            }}>
                                {gyms.find(b => (b._id || b.id) === user.branchId)?.name || 'H4 Branch'}
                            </div>
                        ) : (
                            <div className="header-context-picker" style={{
                                position: 'relative',
                                display: 'inline-flex',
                                alignItems: 'center',
                                background: '#FBF6EC',
                                border: '1px solid #E5D5C0',
                                borderRadius: '20px',
                                padding: '0.2rem 0.6rem 0.2rem 1rem',
                                cursor: 'pointer',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s ease'
                            }}>
                                <select
                                    style={{
                                        appearance: 'none',
                                        WebkitAppearance: 'none',
                                        MozAppearance: 'none',
                                        background: 'transparent',
                                        border: 'none',
                                        outline: 'none',
                                        color: '#231D14',
                                        fontWeight: 700,
                                        fontSize: '0.875rem',
                                        paddingRight: '1.5rem',
                                        cursor: 'pointer',
                                        margin: 0
                                    }}
                                    value={activeDivision === 'h4' ? selectedBranchId : selectedGymId}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        if (activeDivision === 'h4') {
                                            changeSelectedBranch(val);
                                        } else {
                                            changeSelectedGym(val);
                                            changeSelectedBranch('');
                                        }
                                        window.location.reload();
                                    }}
                                >
                                    {activeDivision === 'h4' ? (
                                        <>
                                            <option value="">H4 (All Branches)</option>
                                            {gyms.map(branch => (
                                                <option key={branch._id || branch.id} value={branch._id || branch.id}>
                                                    {branch.name}
                                                </option>
                                            ))}
                                        </>
                                    ) : (
                                        <>
                                            <option value="">All Partner Gyms</option>
                                            {gyms.map(gym => (
                                                <option key={gym._id || gym.id} value={gym._id || gym.id}>{gym.name}</option>
                                            ))}
                                        </>
                                    )}
                                </select>
                                <ChevronDown size={15} style={{ position: 'absolute', right: '0.6rem', color: '#6D6154', pointerEvents: 'none' }} />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Search Bar */}
            <div className="header-search hide-mobile" ref={searchRef} style={{ position: 'relative' }}>
                <Search className="header-search-icon" size={18} />
                <input
                    type="text"
                    className="header-search-input"
                    placeholder="Search members by name or phone..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onFocus={() => searchQuery && setSearchOpen(true)}
                />
                {searchQuery && (
                    <button
                        onClick={() => { setSearchQuery(''); setSearchOpen(false); }}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                    >
                        <X size={14} />
                    </button>
                )}

                {/* Search Dropdown */}
                {searchOpen && (
                    <div style={{
                        position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: '100%',
                        background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
                        zIndex: 1000, overflow: 'hidden'
                    }}>
                        {searchLoading ? (
                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                Searching...
                            </div>
                        ) : searchResults.length > 0 ? (
                            <>
                                <div style={{ padding: '0.5rem 1rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' }}>
                                    Members
                                </div>
                                {searchResults.map(member => (
                                    <button
                                        key={member._id}
                                        onClick={() => handleSearchSelect(member)}
                                        style={{
                                            width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
                                            padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer',
                                            textAlign: 'left', transition: 'background 0.15s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                    >
                                        <div style={{
                                            width: 32, height: 32, borderRadius: '50%',
                                            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'white', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0
                                        }}>
                                            {member.name?.charAt(0)}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{member.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{member.phone} · {member.status}</div>
                                        </div>
                                        <span className={`badge badge-${member.status?.toLowerCase()}`} style={{ marginLeft: 'auto' }}>{member.status}</span>
                                    </button>
                                ))}
                                <button
                                    onClick={() => { navigate(`/members?search=${encodeURIComponent(searchQuery)}`); setSearchOpen(false); setSearchQuery(''); }}
                                    style={{
                                        width: '100%', padding: '0.7rem 1rem', background: 'var(--bg-tertiary)',
                                        border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer',
                                        fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, textAlign: 'center'
                                    }}
                                >
                                    View all results for "{searchQuery}" →
                                </button>
                            </>
                        ) : (
                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                No members found for "{searchQuery}"
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="header-right">
                <button
                    className="header-btn theme-toggle-btn"
                    onClick={toggleTheme}
                    title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                    aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                >
                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                </button>
                {/* Notification Bell */}
                <div ref={notifRef} style={{ position: 'relative' }}>
                    <button
                        className="header-btn"
                        onClick={() => setNotifOpen(o => !o)}
                        style={{ position: 'relative' }}
                        title="Notifications"
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span style={{
                                position: 'absolute', top: '8px', right: '8px',
                                width: '8px', height: '8px',
                                background: 'var(--accent)', borderRadius: '50%',
                                border: '2px solid var(--bg-secondary)',
                                boxShadow: '0 0 8px var(--accent)'
                            }} />
                        )}
                    </button>

                    {notifOpen && (
                        <div style={{
                            position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                            width: 340, background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--shadow-lg)', zIndex: 1000, overflow: 'hidden'
                        }}>
                            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Notifications</span>
                                {unreadCount > 0 && <span className="badge badge-active">{unreadCount} new</span>}
                            </div>
                            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                                {notifications.length === 0 ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                        No notifications yet
                                    </div>
                                ) : notifications.map(n => (
                                    <div
                                        key={n._id}
                                        onClick={() => !n.read && handleMarkRead(n._id)}
                                        style={{
                                            padding: '0.9rem 1.25rem',
                                            borderBottom: '1px solid var(--border)',
                                            background: n.read ? 'transparent' : 'var(--primary-light)',
                                            cursor: n.read ? 'default' : 'pointer',
                                            transition: 'background 0.15s'
                                        }}
                                    >
                                        <div style={{ fontSize: '0.85rem', fontWeight: n.read ? 400 : 600, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                                            {n.message}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                            {new Date(n.createdAt).toLocaleString()} {!n.read && '· Click to mark read'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </header>
    );
};

export default AppHeader;

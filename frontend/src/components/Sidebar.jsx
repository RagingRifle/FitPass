import { useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useSidebar } from '../context/SidebarContext';
import API from '../services/api';
import {
    LayoutDashboard, Users, ShieldCheck, Calendar, IndianRupee,
    UserCheck, Clock, Building2, History, ChevronRight,
    ChevronLeft, LogOut, Target, Package, Banknote,
    AlertTriangle, Receipt, CalendarCheck, Snowflake, LineChart, FileText, Home, Dumbbell, Image, Zap,
    Settings, Apple, Compass, LifeBuoy, Ticket, Bell
} from 'lucide-react';

const NAV_GROUPS = {
    superadmin: [
        {
            label: 'Global Overview',
            items: [
                { name: 'Dashboard', path: '/superadmin/dashboard', icon: LayoutDashboard },
            ]
        },
        {
            label: 'Management',
            items: [
                { name: 'Partner Gyms', path: '/superadmin/gyms', icon: Building2 },
                { name: 'Fit-Prime Plans', path: '/superadmin/plans', icon: Package },
                { name: 'Products & Reports', path: '/products', icon: Banknote },
                { name: 'Members Directory', path: '/members', icon: Users },
                { name: 'FitPass Class Add-ons', path: '/fitpass-classes', icon: Dumbbell },
                { name: 'Admins Directory', path: '/superadmin/admins', icon: ShieldCheck },
            ]
        },
        {
            label: 'System',
            items: [
                { name: 'Audit Logs', path: '/audit', icon: History },
                { name: 'Settings', path: '/settings', icon: Settings },
            ]
        }
    ],
    admin: [
        {
            label: 'Gym Management',
            items: [
                { name: 'Gym Dashboard', path: '/dashboard', icon: LayoutDashboard },

                { name: 'Members', path: '/members', icon: Users },
                { name: 'Leads', path: '/leads', icon: Target },
                { name: 'Plans', path: '/plans', icon: Package },
                { name: 'Products & Reports', path: '/products', icon: Banknote },
                { name: 'Classes', path: '/classes', icon: Dumbbell },
                { name: 'FitPass Class Add-ons', path: '/fitpass-classes', icon: Dumbbell },
                { name: 'Assessments', path: '/body-assessments', icon: LineChart },
                { name: 'Staff & Access', path: '/staff', icon: ShieldCheck },
                { name: 'Branches', path: '/branches', icon: Building2 },
            ]
        },
        {
            label: 'Gym Ops & Finance',
            items: [
                { name: 'Payments', path: '/payments', icon: IndianRupee },
                { name: 'Sales', path: '/sales', icon: LineChart },
                { name: 'Expenses', path: '/expenses', icon: IndianRupee },
                { name: 'Pending Dues', path: '/dues', icon: Clock },
                { name: 'Attendance', path: '/attendance', icon: UserCheck },
                { name: 'Trainer Attendance', path: '/trainer-attendance', icon: CalendarCheck },
                { name: 'Payroll', path: '/payroll', icon: Banknote },
            ]
        },
        {
            label: 'Gym System & Reports',
            items: [
                { name: 'Reports', path: '/reports', icon: FileText },
                { name: 'Freeze System', path: '/freeze', icon: Snowflake },
                { name: 'Analytics', path: '/analytics', icon: LineChart },
                { name: 'Workout Plans', path: '/workout-plans', icon: Dumbbell },
                { name: 'Diet Plans', path: '/diet-plans', icon: Apple },
                { name: 'Settings', path: '/settings', icon: Settings },
            ]
        }
    ],
    receptionist: [
        {
            label: 'Management',
            items: [
                { name: 'Members', path: '/members', icon: Users },
                { name: 'Leads', path: '/leads', icon: Target },
                { name: 'Attendance', path: '/attendance', icon: UserCheck },
            ]
        },
        {
            label: 'Finance',
            items: [
                { name: 'Payments', path: '/payments', icon: IndianRupee },
                { name: 'Sales', path: '/sales', icon: LineChart },
                { name: 'Dues', path: '/dues', icon: Clock },
            ]
        }
    ],
    trainer: [
        {
            label: 'Operations',
            items: [
                { name: 'Attendance', path: '/attendance', icon: UserCheck },
                { name: 'Classes', path: '/classes', icon: Dumbbell },
                { name: 'FitPass Class Add-ons', path: '/fitpass-classes', icon: Dumbbell },
                { name: 'Assessments', path: '/body-assessments', icon: LineChart },
                { name: 'Workout Plans', path: '/workout-plans', icon: Dumbbell },
                { name: 'Diet Plans', path: '/diet-plans', icon: Apple },
                { name: 'Check In/Out', path: '/trainer-attendance', icon: Clock },
                { name: 'My Payroll', path: '/payroll', icon: Banknote },
            ]
        }
    ],
    member: [
        {
            label: 'My Portal',
            items: [
                { name: 'Dashboard', path: '/member-dashboard', icon: Home },
                { name: 'Shop', path: '/shopping', icon: Package },
                { name: 'Explore Gyms', path: '/explore-gyms', icon: Compass },
                { name: 'My InBody', path: '/body-assessments', icon: LineChart },
                { name: 'Classes', path: '/member-classes', icon: Calendar },
                { name: 'Workout Routine', path: '/workout-plans', icon: Dumbbell },
                { name: 'Diet Chart', path: '/diet-plans', icon: Apple },
                { name: 'Help & support', path: '/member-support', icon: LifeBuoy },
            ]
        }
    ],
    partner: [
        {
            label: 'Branch Operations',
            items: [
                { name: 'Branch Metrics & Check-ins', path: '/partner/visit-log', icon: Zap },
            ]
        }
    ]
};

const Sidebar = () => {
    const { collapsed, toggle, mobileOpen, closeMobile } = useSidebar();
    const { user, logout, changeSelectedGym, activeDivision, changeActiveDivision, changeSelectedBranch } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();

    const role = user?.role || 'member';
    const normalizedGym = (user?.gymName || user?.gymId?.name || '').toUpperCase();
    const userGymId = user?.gymId?._id || user?.gymId || '';
    const isH4Gym = normalizedGym === 'H4' || ['05a08fdf-7427-48a5-8b25-e18d5a5668cd', '327d37e7-f978-43a9-82ef-e6c4a4dc3c5d'].includes(String(userGymId));
    const isH4BranchAdmin = role === 'h4_branch_admin'
        || role === 'h4_admin' && Boolean(user?.branchId)
        || role === 'admin' && (isH4Gym || user?.isH4BranchAdmin === true) && Boolean(user?.branchId);

    const handleDivisionChange = async (division) => {
        changeActiveDivision(division);
        if (division === 'fitpass') {
            if (role === 'superadmin') {
                changeSelectedGym('');
                changeSelectedBranch('');
            }
            navigate('/superadmin/dashboard');
        } else {
            try {
                // Fetch or automatically initialize the H4 gym context
                const { data } = await API.get('/superadmin/h4-gym');
                if (data) {
                    const h4GymId = data._id || data.id;
                    changeSelectedGym(h4GymId);
                    changeSelectedBranch('');
                    navigate('/dashboard');
                } else {
                    navigate('/superadmin/gyms');
                }
            } catch (err) {
                console.error('Failed to get or create H4 gym:', err);
                navigate('/superadmin/gyms');
            }
        }
    };

    let groups = [];
    if (role === 'superadmin') {
        if (activeDivision === 'fitpass') {
            groups = [
                {
                    label: 'Global Overview',
                    items: [
                        { name: 'Dashboard', path: '/superadmin/dashboard', icon: LayoutDashboard },
                    ]
                },
                {
                    label: 'Management for Fit Pass',
                    items: [
                        { name: 'Partner Gyms', path: '/superadmin/gyms', icon: Building2 },
                        { name: 'Fit-Prime Plans', path: '/superadmin/plans', icon: Package },
                        { name: 'Products & Reports', path: '/products', icon: Banknote },
                        { name: 'FitPass Orders', path: '/superadmin/fitpass-orders', icon: Receipt },
                        { name: 'FitPass Members', path: '/superadmin/fitpass-members', icon: Users },
                        { name: 'FitPass Reports', path: '/superadmin/fitpass-analytics', icon: Zap },
                        { name: 'Branch Payouts', path: '/superadmin/fitpass-payouts', icon: IndianRupee },
                        { name: 'Admins Directory', path: '/superadmin/admins', icon: ShieldCheck },
                    ]
                },
                {
                    label: 'System',
                    items: [
                        { name: 'Audit Logs', path: '/audit', icon: History },
                        { name: 'Settings', path: '/settings', icon: Settings },
                    ]
                }
            ];
        } else {
            // H4 division
            const suffix = '';
            const gymMgmtItems = [
                { name: `Gym Dashboard${suffix}`, path: '/dashboard', icon: LayoutDashboard },
                { name: `Members${suffix}`, path: '/members', icon: Users },
                { name: `Leads${suffix}`, path: '/leads', icon: Target },
                { name: `Plans${suffix}`, path: '/plans', icon: Package },
                { name: 'Products & Reports', path: '/products', icon: Banknote },
                { name: `Classes${suffix}`, path: '/classes', icon: Dumbbell },
                { name: 'Trial referral codes', path: '/h4/trial-codes', icon: Ticket },
                { name: `Assessments${suffix}`, path: '/body-assessments', icon: LineChart },
                { name: `Staff & Access${suffix}`, path: '/staff', icon: ShieldCheck },
                { name: 'Admins Directory', path: '/superadmin/admins', icon: ShieldCheck },
                { name: 'Branches', path: '/branches', icon: Building2 },
            ];

            groups = [
                {
                    label: 'Gym Management',
                    items: gymMgmtItems
                },
                {
                    label: 'Gym Ops & Finance',
                    items: [
                        { name: `Payments${suffix}`, path: '/payments', icon: IndianRupee },
                        { name: `Sales${suffix}`, path: '/sales', icon: LineChart },
                        { name: `Expenses${suffix}`, path: '/expenses', icon: IndianRupee },
                        { name: `Pending Dues${suffix}`, path: '/dues', icon: Clock },
                        { name: `Attendance${suffix}`, path: '/attendance', icon: UserCheck },
                        { name: `Trainer Attendance${suffix}`, path: '/trainer-attendance', icon: CalendarCheck },
                        { name: `Payroll${suffix}`, path: '/payroll', icon: Banknote },
                    ]
                },
                {
                    label: 'Gym System & Reports',
                    items: [
                        { name: `Reports${suffix}`, path: '/reports', icon: FileText },
                        { name: `Freeze System${suffix}`, path: '/freeze', icon: Snowflake },
                        { name: `Analytics${suffix}`, path: '/analytics', icon: LineChart },
                        { name: `Workout Plans${suffix}`, path: '/workout-plans', icon: Dumbbell },
                        { name: `Diet Plans${suffix}`, path: '/diet-plans', icon: Apple },
                        { name: 'Reminders', path: '/reminders', icon: Bell },
                        { name: 'Audit Logs', path: '/audit', icon: History },
                        { name: `Settings${suffix}`, path: '/settings', icon: Settings },
                    ]
                }
            ];
        }
    } else if (role === 'fitpass_admin') {
        groups = [
            {
                label: 'Global Overview',
                items: [
                    { name: 'Dashboard', path: '/superadmin/dashboard', icon: LayoutDashboard },
                ]
            },
            {
                label: 'Management for Fit Pass',
                items: [
                    { name: 'Partner Gyms', path: '/superadmin/gyms', icon: Building2 },
                    { name: 'Fit-Prime Plans', path: '/superadmin/plans', icon: Package },
                    { name: 'Products & Reports', path: '/products', icon: Banknote },
                    { name: 'FitPass Orders', path: '/superadmin/fitpass-orders', icon: Receipt },
                    { name: 'FitPass Members', path: '/superadmin/fitpass-members', icon: Users },
                    { name: 'FitPass Reports', path: '/superadmin/fitpass-analytics', icon: Zap },
                    ...(user?.fitPassPayoutAccess ? [{ name: 'Branch Payouts', path: '/superadmin/fitpass-payouts', icon: IndianRupee }] : []),
                    { name: 'Class Add-ons', path: '/fitpass-classes', icon: Dumbbell },
                ]
            },
            {
                label: 'System',
                items: [
                    { name: 'Audit Logs', path: '/audit', icon: History },
                    { name: 'Settings', path: '/settings', icon: Settings },
                ]
            }
        ];
    } else if (['h4_admin', 'h4_branch_admin'].includes(role) || isH4BranchAdmin) {
        const suffix = '';
        const gymMgmtItems = [
            { name: `Gym Dashboard${suffix}`, path: '/dashboard', icon: LayoutDashboard },

            { name: `Members${suffix}`, path: '/members', icon: Users },
            { name: `Leads${suffix}`, path: '/leads', icon: Target },
            { name: `Plans${suffix}`, path: '/plans', icon: Package },
            { name: 'Products & Reports', path: '/products', icon: Banknote },
            { name: `Classes${suffix}`, path: '/classes', icon: Dumbbell },
            { name: 'Trial referral codes', path: '/h4/trial-codes', icon: Ticket },
            { name: `Assessments${suffix}`, path: '/body-assessments', icon: LineChart },
            { name: `Staff & Access${suffix}`, path: '/staff', icon: ShieldCheck },
            ...(!user?.branchId ? [{ name: 'Branches', path: '/branches', icon: Building2 }] : []),
        ];

        groups = [
            {
                label: 'Gym Management',
                items: gymMgmtItems
            },
            {
                label: 'Gym Ops & Finance',
                items: [
                    { name: `Payments${suffix}`, path: '/payments', icon: IndianRupee },
                    { name: `Sales${suffix}`, path: '/sales', icon: LineChart },
                    { name: `Expenses${suffix}`, path: '/expenses', icon: IndianRupee },
                    { name: `Pending Dues${suffix}`, path: '/dues', icon: Clock },
                    { name: `Attendance${suffix}`, path: '/attendance', icon: UserCheck },
                    { name: `Trainer Attendance${suffix}`, path: '/trainer-attendance', icon: CalendarCheck },
                    { name: `Payroll${suffix}`, path: '/payroll', icon: Banknote },
                ]
            },
            {
                label: 'Gym System & Reports',
                items: [
                    { name: `Reports${suffix}`, path: '/reports', icon: FileText },
                    { name: `Freeze System${suffix}`, path: '/freeze', icon: Snowflake },
                    { name: `Analytics${suffix}`, path: '/analytics', icon: LineChart },
                    { name: `Workout Plans${suffix}`, path: '/workout-plans', icon: Dumbbell },
                    { name: `Diet Plans${suffix}`, path: '/diet-plans', icon: Apple },
                    { name: 'Reminders', path: '/reminders', icon: Bell },
                    ...(!user?.branchId ? [{ name: 'H4 Branch Admins', path: '/h4/admins', icon: ShieldCheck }] : []),
                    { name: 'Audit Logs', path: '/audit', icon: History },
                    { name: `Settings${suffix}`, path: '/settings', icon: Settings },
                ]
            }
        ];
        if (isH4BranchAdmin) {
            groups = groups.map(group => ({
                ...group,
                items: group.items.filter(item => !['/branches', '/h4/admins', '/audit', '/settings', '/products', '/h4/trial-codes'].includes(item.path)),
            }));
        }
    } else {
        const normalizedGym = (user?.gymName || user?.gymId?.name || '').toUpperCase();
        const userGymId = user?.gymId?._id || user?.gymId || '';
        const isH4Gym = normalizedGym === 'H4' || ['05a08fdf-7427-48a5-8b25-e18d5a5668cd', '327d37e7-f978-43a9-82ef-e6c4a4dc3c5d'].includes(String(userGymId));
        const isPartnerAdmin = role === 'partner' || (role === 'admin' && !isH4Gym);

        if (isPartnerAdmin) {
            groups = NAV_GROUPS.partner;
        } else {
            groups = (NAV_GROUPS[role] || NAV_GROUPS.member).map(group => ({
                ...group,
                items: group.items.filter(item => {
                    if (role === 'member' && isH4Gym && item.path === '/explore-gyms') return false;
                    if (item.path === '/fitpass-classes' && (activeDivision !== 'fitpass' || isH4Gym)) return false;
                    return true;
                })
            }));
        }
    }

    if (user?.branchId && Array.isArray(groups)) {
        groups = groups.map(group => ({
            ...group,
            items: group.items.filter(item => {
                if (item.path === '/branches') return false;
                if (item.path === '/fitpass-classes' && ['h4_admin', 'h4_branch_admin'].includes(role)) return false;
                return true;
            })
        }));
    }

    const isActive = (path) => location.pathname === path;

    return (
        <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
            <div className="sidebar-logo">
                                <div className="sidebar-logo-icon" style={{ background: '#000000', color: '#FEDF1E', boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)' }}>
                    <Dumbbell size={22} color="#FEDF1E" />
                </div>
                {!collapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="sidebar-logo-text" style={{ fontSize: '1.25rem', fontWeight: '900', letterSpacing: '-0.02em', color: '#000000' }}>
                            FITPRIME
                        </span>
                        <span style={{ fontSize: '0.65rem', color: '#3D351A', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: '900' }}>
                            GYM OS PRO
                        </span>
                    </div>
                )}
            </div>


            {role === 'superadmin' && (
                <div className="sidebar-division-switcher">
                    <div className="sidebar-division-switcher-inner">
                        <button
                            className={activeDivision === 'fitpass' ? 'is-active' : ''}
                            onClick={() => handleDivisionChange('fitpass')}
                            style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                padding: '0.5rem 0.25rem',
                                fontSize: '0.72rem',
                                fontWeight: '700',
                                borderRadius: 'var(--radius-sm)',
                                textTransform: 'uppercase',
                                color: activeDivision === 'fitpass' ? '#FEDF1E' : '#000000',
                                background: activeDivision === 'fitpass' ? '#000000' : 'transparent',
                                transition: 'var(--transition)',
                            }}
                            title="Management for Fit Pass"
                        >
                            <Zap size={13} />
                            {!collapsed && <span>FitPass</span>}
                        </button>
                        <button
                            className={activeDivision === 'h4' ? 'is-active' : ''}
                            onClick={() => handleDivisionChange('h4')}
                            style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                padding: '0.5rem 0.25rem',
                                fontSize: '0.72rem',
                                fontWeight: '700',
                                borderRadius: 'var(--radius-sm)',
                                textTransform: 'uppercase',
                                color: activeDivision === 'h4' ? '#FEDF1E' : '#000000',
                                background: activeDivision === 'h4' ? '#000000' : 'transparent',
                                transition: 'var(--transition)',
                            }}
                            title="H4 Gym Management"
                        >
                            <Building2 size={13} />
                            {!collapsed && <span>H4</span>}
                        </button>
                    </div>
                </div>
            )}

            <nav className="sidebar-nav">
                {groups.map((group, gIdx) => (
                    <div key={gIdx} className="sidebar-group">
                        {!collapsed && <div className="sidebar-group-label">{group.label}</div>}
                        {group.items.map((item, iIdx) => {
                            const IconComponent = (typeof item.icon === 'function' || (item.icon && item.icon.$$typeof)) ? item.icon : null;
                            return (
                                <Link
                                    key={iIdx}
                                    to={item.path}
                                    className={`nav-link ${isActive(item.path) ? 'active' : ''}`}
                                    onClick={closeMobile}
                                >
                                    <div className="nav-icon">{IconComponent ? <IconComponent size={20} /> : null}</div>
                                    <span className="nav-label">{item.name}</span>
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </nav>

            <button className="sidebar-collapse-btn hide-mobile" onClick={toggle}>
                {collapsed ? <ChevronRight size={18} /> : (
                    <>
                        <ChevronLeft size={18} />
                        <span>Collapse Menu</span>
                    </>
                )}
            </button>

            <div className="sidebar-footer">
                <div className="sidebar-user" onClick={logout} title="Click to Sign Out">
                    <div className="user-avatar">
                        {user?.profileImageUrl ? (
                            <img src={user.profileImageUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }} />
                        ) : (user?.name?.charAt(0) || 'U')}
                    </div>
                    {!collapsed && (
                        <>
                            <div className="user-info" style={{ overflow: 'hidden' }}>
                                <div className="user-name" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                    {user?.name || 'User'}
                                </div>
                                <div className="user-logout">Logout</div>
                            </div>
                            <LogOut className="user-signout" size={16} />
                        </>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;

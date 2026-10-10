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
    Settings, Apple, Compass
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
                { name: 'Members Directory', path: '/members', icon: Users },
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
                { name: 'Classes', path: '/classes', icon: Dumbbell },
                { name: 'Assessments', path: '/body-assessments', icon: LineChart },
                { name: 'Staff', path: '/staff', icon: ShieldCheck },
                { name: 'Branches', path: '/branches', icon: Building2 },
            ]
        },
        {
            label: 'Gym Ops & Finance',
            items: [
                { name: 'Payments', path: '/payments', icon: IndianRupee },
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
                { name: 'Explore Gyms', path: '/explore-gyms', icon: Compass },
                { name: 'My InBody', path: '/body-assessments', icon: LineChart },
                { name: 'Classes', path: '/member-classes', icon: Dumbbell },
                { name: 'Workout Routine', path: '/workout-plans', icon: Dumbbell },
                { name: 'Diet Chart', path: '/diet-plans', icon: Apple },
            ]
        }
    ],
    partner: [
        {
            label: 'Member Operations',
            items: [
                { name: 'FitPass Visits', path: '/partner/visit-log', icon: Zap },
                { name: 'FitPass Leads', path: '/partner/fitpass-leads', icon: Target },
            ]
        },
        {
            label: 'Brand & Discovery',
            items: [
                { name: 'Gym Social Profile', path: '/gym-social-profile', icon: Image },
                { name: 'Explore Network', path: '/explore-gyms', icon: Compass },
            ]
        },
        {
            label: 'Account & Config',
            items: [
                { name: 'Partner Settings', path: '/settings', icon: Settings },
            ]
        }
    ]
};

const Sidebar = () => {
    const { collapsed, toggle, mobileOpen, closeMobile } = useSidebar();
    const { user, logout, selectedGymId, changeSelectedGym, activeDivision, changeActiveDivision, selectedBranchId } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();

    const role = user?.role || 'member';

    const handleDivisionChange = async (division) => {
        changeActiveDivision(division);
        if (division === 'fitpass') {
            navigate('/superadmin/dashboard');
        } else {
            try {
                // Fetch or automatically initialize the H4 gym context
                const { data } = await API.get('/superadmin/h4-gym');
                if (data) {
                    const h4GymId = data._id || data.id;
                    changeSelectedGym(h4GymId);
                    navigate('/dashboard');
                    window.location.reload();
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
        const hasSelectedGym = !!selectedGymId;
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
                        { name: 'FitPass Members', path: '/superadmin/fitpass-members', icon: Users },
                        { name: 'Discovery Approvals', path: '/superadmin/discovery-approvals', icon: ShieldCheck },
                        { name: 'FitPass Reports', path: '/superadmin/fitpass-analytics', icon: Zap },
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
            if (hasSelectedGym) {
                const suffix = !selectedBranchId ? ' of all branches' : '';
                
                const gymMgmtItems = [
                    { name: `Gym Dashboard${suffix}`, path: '/dashboard', icon: LayoutDashboard },

                    { name: `Members${suffix}`, path: '/members', icon: Users },
                    { name: `Leads${suffix}`, path: '/leads', icon: Target },
                    { name: `Plans${suffix}`, path: '/plans', icon: Package },
                    { name: `Classes${suffix}`, path: '/classes', icon: Dumbbell },
                    { name: `Assessments${suffix}`, path: '/body-assessments', icon: LineChart },
                    { name: `Staff${suffix}`, path: '/staff', icon: ShieldCheck },
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
                            { name: 'Audit Logs', path: '/audit', icon: History },
                            { name: `Settings${suffix}`, path: '/settings', icon: Settings },
                        ]
                    }
                ];
            } else {
                groups = [
                    {
                        label: 'H4 Gym Management',
                        items: [
                            { name: 'Select Partner Gym', path: '/superadmin/gyms', icon: Building2 },
                        ]
                    }
                ];
            }
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
                    { name: 'FitPass Members', path: '/superadmin/fitpass-members', icon: Users },
                    { name: 'Discovery Approvals', path: '/superadmin/discovery-approvals', icon: ShieldCheck },
                    { name: 'FitPass Reports', path: '/superadmin/fitpass-analytics', icon: Zap },
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
    } else if (role === 'h4_admin') {
        const suffix = !selectedBranchId ? ' of all branches' : '';
        const gymMgmtItems = [
            { name: `Gym Dashboard${suffix}`, path: '/dashboard', icon: LayoutDashboard },

            { name: `Members${suffix}`, path: '/members', icon: Users },
            { name: `Leads${suffix}`, path: '/leads', icon: Target },
            { name: `Plans${suffix}`, path: '/plans', icon: Package },
            { name: `Classes${suffix}`, path: '/classes', icon: Dumbbell },
            { name: `Assessments${suffix}`, path: '/body-assessments', icon: LineChart },
            { name: `Staff${suffix}`, path: '/staff', icon: ShieldCheck },
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
                    { name: 'Audit Logs', path: '/audit', icon: History },
                    { name: `Settings${suffix}`, path: '/settings', icon: Settings },
                ]
            }
        ];
    } else {
        const normalizedGym = (user?.gymName || user?.gymId?.name || '').toUpperCase();
        const userGymId = user?.gymId?._id || user?.gymId || '';
        const isH4Gym = normalizedGym === 'H4' || userGymId === '05a08fdf-7427-48a5-8b25-e18d5a5668cd';
        const isPartnerAdmin = role === 'partner' || (role === 'admin' && !isH4Gym);

        if (isPartnerAdmin) {
            groups = NAV_GROUPS.partner;
        } else {
            groups = (NAV_GROUPS[role] || NAV_GROUPS.member).map(group => ({
                ...group,
                items: group.items.filter(item => {
                    if (role === 'member' && isH4Gym && item.path === '/explore-gyms') {
                        return false;
                    }
                    return true;
                })
            }));
        }
    }

    if (user?.branchId && Array.isArray(groups)) {
        groups = groups.map(group => ({
            ...group,
            items: group.items.filter(item => item.path !== '/branches')
        }));
    }

    const isActive = (path) => location.pathname === path;

    return (
        <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon" style={{ background: 'linear-gradient(135deg, #F0A020, #D9860F)', color: '#231D14', boxShadow: '0 4px 16px rgba(240, 160, 32, 0.3)' }}>
                    <Dumbbell size={22} color="#231D14" />
                </div>
                {!collapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="sidebar-logo-text" style={{ fontSize: '1.1rem', fontWeight: '900', letterSpacing: '-0.01em', background: 'linear-gradient(135deg, #F0A020, #FFFFFF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            FITPRIME
                        </span>
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '800' }}>
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
                                color: activeDivision === 'fitpass' ? 'var(--text-inverse)' : 'var(--text-secondary)',
                                background: activeDivision === 'fitpass' ? 'var(--primary)' : 'transparent',
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
                                color: activeDivision === 'h4' ? 'var(--text-inverse)' : 'var(--text-secondary)',
                                background: activeDivision === 'h4' ? 'var(--primary)' : 'transparent',
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
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Logout</div>
                            </div>
                            <LogOut size={16} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
                        </>
                    )}
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;

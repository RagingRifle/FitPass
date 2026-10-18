import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Shield, Award, Dumbbell, Building, User, Users, ArrowLeft, ChevronRight, Eye, EyeOff, AlertCircle, LockKeyhole } from 'lucide-react';
import './login-design.css';

/* ─── Scoped password input (uses login-design.css classes) ─── */
function LoginPasswordInput({ value, onChange, placeholder = '••••••••', required }) {
    const [show, setShow] = useState(false);
    return (
        <div className="login-input-wrap">
            <input
                type={show ? 'text' : 'password'}
                className="login-input"
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                required={required}
                autoComplete="current-password"
            />
            <button
                type="button"
                className="login-input-eye"
                aria-label={show ? 'Hide password' : 'Show password'}
                onClick={() => setShow(s => !s)}
            >
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
        </div>
    );
}

const Login = ({ portal, restrictedAdmin = false }) => {
    const [currentView, setCurrentView] = useState(portal ? 'login_form' : restrictedAdmin ? 'admin_sub' : 'main');
    const [selectedRole, setSelectedRole] = useState(portal || null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const leafPortals = {
        superadmin:           { title: 'Super Admin Portal',       icon: Shield   },
        fitpass_admin:        { title: 'FitPass Admin Portal',     icon: Award    },
        h4_admin:             { title: 'H4 Admin Portal',          icon: Dumbbell },
        h4_gym_admin:         { title: 'H4 Gym Admin Portal',      icon: Dumbbell },
        fitpass_partner_admin:{ title: 'Fitpass Partner Admin',    icon: Building },
        staff:                { title: 'Gym Staff / Trainer',      icon: Users    },
        h4_member:            { title: 'H4 Member Portal',         icon: User     },
        fitpass_member:       { title: 'Fitpass Member Portal',    icon: User     },
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const result = await login(email, password, selectedRole);
        setLoading(false);
        if (result.success) {
            const role = result.user.role;
            const normalizedGym = (result.user.gymName || result.user.gymId?.name || '').toUpperCase();
            const userGymId = result.user.gymId?._id || result.user.gymId || '';
            const isH4Gym = normalizedGym === 'H4' || userGymId === '05a08fdf-7427-48a5-8b25-e18d5a5668cd';
            const isPartnerAdmin = role === 'partner' || (role === 'admin' && !isH4Gym);

            if (role === 'superadmin')        navigate('/superadmin/dashboard');
            else if (role === 'fitpass_admin') navigate('/superadmin/dashboard');
            else if (isPartnerAdmin)           navigate('/partner/visit-log');
            else if (role === 'member')        navigate('/member-dashboard');
            else if (role === 'trainer')       navigate('/attendance');
            else                               navigate('/dashboard');
        } else {
            setError(result.message);
        }
    };

    const handleBack = () => {
        setError('');
        if (currentView === 'login_form') {
            if (['superadmin', 'fitpass_admin', 'h4_admin'].includes(selectedRole)) {
                setCurrentView('admin_sub');
            } else if (['h4_gym_admin', 'fitpass_partner_admin'].includes(selectedRole)) {
                setCurrentView('gym_admin_branch_sub');
            } else if (selectedRole === 'staff') {
                setCurrentView('gym_sub');
            } else if (['h4_member', 'fitpass_member'].includes(selectedRole)) {
                setCurrentView('member_sub');
            } else {
                setCurrentView('main');
                setSelectedRole(null);
            }
        } else if (currentView === 'gym_admin_branch_sub') {
            setCurrentView('gym_sub');
        } else if (currentView === 'member_sub') {
            setCurrentView('main');
        } else {
            setCurrentView('main');
        }
    };

    const selectedPortal = leafPortals[selectedRole];
    const SelectedIcon = selectedPortal ? selectedPortal.icon : null;

    /* ── Shared portal card renderer ── */
    const PortalCard = ({ icon: Icon, label, desc, onClick }) => (
        <button type="button" className="login-portal-item" onClick={onClick}>
            <div className="login-portal-icon">
                <Icon size={19} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div className="login-portal-label">{label}</div>
                <div className="login-portal-desc">{desc}</div>
            </div>
            <ChevronRight size={16} className="login-portal-arrow" />
        </button>
    );

    /* ── Brand strip shown on landing ── */
    const BrandStrip = () => (
        <div className="login-brand-strip">
            <div className="login-brand-icon">G</div>
            <div>
                <div className="login-brand-name">GYM CRM PRO</div>
                <div className="login-brand-sub">Management Platform</div>
            </div>
        </div>
    );

    return (
        <div className="login-shell">

            {/* ─── MAIN ─── */}
            {currentView === 'main' && (
                <div className="login-card login-fade">
                    <BrandStrip />

                    <div className="login-title">Welcome back</div>
                    <div className="login-subtitle">Choose your access portal to continue</div>

                    <div className="login-portal-list">
                        <PortalCard
                            icon={Shield}
                            label="Admin Portals"
                            desc="Super Admin, FitPass administration, and H4 system controls"
                            onClick={() => setCurrentView('admin_sub')}
                        />
                        <PortalCard
                            icon={Building}
                            label="Gym Admin / Staff"
                            desc="Branch owners, managers, coaches, and staff portal"
                            onClick={() => setCurrentView('gym_sub')}
                        />
                        <PortalCard
                            icon={User}
                            label="Member Portal"
                            desc="Memberships, schedules, and check-in history"
                            onClick={() => setCurrentView('member_sub')}
                        />
                    </div>
                </div>
            )}

            {/* ─── ADMIN SUB ─── */}
            {currentView === 'admin_sub' && (
                <div className="login-card login-fade">
                    {!restrictedAdmin && (
                        <button type="button" className="login-back-btn" onClick={handleBack}>
                            <ArrowLeft size={14} /> Back
                        </button>
                    )}

                    <div className="login-title">Admin Portals</div>
                    <div className="login-subtitle">Choose your admin classification</div>

                    <div className="login-portal-list">
                        <PortalCard
                            icon={Shield}
                            label="Super Admin"
                            desc="Overall platform administration and system controls"
                            onClick={() => { setSelectedRole('superadmin'); setCurrentView('login_form'); }}
                        />
                        <PortalCard
                            icon={Award}
                            label="FitPass Admin"
                            desc="Manage FitPass memberships, plans, and partnerships"
                            onClick={() => { setSelectedRole('fitpass_admin'); setCurrentView('login_form'); }}
                        />
                        <PortalCard
                            icon={Dumbbell}
                            label="H4 Admin"
                            desc="H4 Gym operations, plans, and branch controls"
                            onClick={() => { setSelectedRole('h4_admin'); setCurrentView('login_form'); }}
                        />
                        <PortalCard
                            icon={Building}
                            label="Branch Admin"
                            desc="Sign in to a partner or H4 branch workspace"
                            onClick={() => setCurrentView('gym_sub')}
                        />
                    </div>
                </div>
            )}

            {/* ─── GYM SUB ─── */}
            {currentView === 'gym_sub' && (
                <div className="login-card login-fade">
                    {!restrictedAdmin && (
                        <button type="button" className="login-back-btn" onClick={handleBack}>
                            <ArrowLeft size={14} /> Back
                        </button>
                    )}

                    <div className="login-title">Gym Roles</div>
                    <div className="login-subtitle">Select your gym classification</div>

                    <div className="login-portal-list">
                        <PortalCard
                            icon={Building}
                            label="Gym Admin / Owner"
                            desc="Branch admin, managers, and partners control"
                            onClick={() => setCurrentView('gym_admin_branch_sub')}
                        />
                        {!restrictedAdmin && (
                            <PortalCard
                                icon={Users}
                                label="Gym Staff / Trainer"
                                desc="Coaches, trainers, receptionists, and staff members"
                                onClick={() => { setSelectedRole('staff'); setCurrentView('login_form'); }}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* ─── GYM ADMIN BRANCH SUB ─── */}
            {currentView === 'gym_admin_branch_sub' && (
                <div className="login-card login-fade">
                    {!portal && !restrictedAdmin && (
                        <button type="button" className="login-back-btn" onClick={() => navigate('/')}>
                            <ArrowLeft size={14} /> Back
                        </button>
                    )}

                    <div className="login-title">Branch Type</div>
                    <div className="login-subtitle">Select your branch classification</div>

                    <div className="login-portal-list">
                        <PortalCard
                            icon={Dumbbell}
                            label="H4 Gym Admin"
                            desc="Manage H4 physical branches and operational staff"
                            onClick={() => { setSelectedRole('h4_gym_admin'); setCurrentView('login_form'); }}
                        />
                        <PortalCard
                            icon={Building}
                            label="Fitpass Partner Admin"
                            desc="View FitPass member check-ins and leads at your gym"
                            onClick={() => { setSelectedRole('fitpass_partner_admin'); setCurrentView('login_form'); }}
                        />
                    </div>
                </div>
            )}

            {/* ─── MEMBER SUB ─── */}
            {currentView === 'member_sub' && (
                <div className="login-card login-fade">
                    {!restrictedAdmin && (
                        <button type="button" className="login-back-btn" onClick={handleBack}>
                            <ArrowLeft size={14} /> Back
                        </button>
                    )}

                    <div className="login-title">Member Portal</div>
                    <div className="login-subtitle">Select your membership type</div>

                    <div className="login-portal-list">
                        <PortalCard
                            icon={Dumbbell}
                            label="H4 Member"
                            desc="Access H4 branches, physical classes, and schedule logs"
                            onClick={() => { setSelectedRole('h4_member'); setCurrentView('login_form'); }}
                        />
                        <PortalCard
                            icon={User}
                            label="Fitpass Member"
                            desc="Universal passes, partner gym logs, and QR scan tokens"
                            onClick={() => { setSelectedRole('fitpass_member'); setCurrentView('login_form'); }}
                        />
                    </div>
                </div>
            )}

            {/* ─── LOGIN FORM ─── */}
            {currentView === 'login_form' && (
                <form onSubmit={handleSubmit} className="login-card login-fade">
                    <button type="button" className="login-back-btn" onClick={handleBack}>
                        <ArrowLeft size={14} /> Back
                    </button>

                    <div className="login-portal-header">
                        <div className="login-portal-emblem">
                            {SelectedIcon && <SelectedIcon size={26} />}
                        </div>
                        <div className="login-title" style={{ marginBottom: '0.25rem' }}>
                            {selectedPortal?.title}
                        </div>
                        <div className="login-subtitle" style={{ marginBottom: 0 }}>
                            Enter your credentials to continue
                        </div>
                    </div>

                    {error && (
                        <div className="login-error">
                            <AlertCircle size={15} />
                            {error}
                        </div>
                    )}

                    <div className="login-field">
                        <label>Email Address or Phone Number</label>
                        <input
                            type="text"
                            className="login-input"
                            placeholder="Email address or phone number"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="username"
                        />
                    </div>

                    <div className="login-field" style={{ marginBottom: '1.75rem' }}>
                        <label>Password</label>
                        <LoginPasswordInput
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="login-btn" disabled={loading}>
                        <LockKeyhole size={17} />
                        {loading ? 'Authenticating…' : 'Sign In'}
                    </button>

                    {portal === 'fitpass_member' && (
                        <p className="login-footer-text">
                            New to FitPass?{' '}
                            <Link to="/register">Create an account</Link>
                        </p>
                    )}
                    {portal === 'fitpass_member' && (
                        <p className="login-footer-text">
                            H4 member? <Link to="/h4/login">Sign in to H4</Link>
                        </p>
                    )}
                    {portal === 'h4_member' && (
                        <p className="login-footer-text">
                            FitPass member? <Link to="/member-login">Sign in to FitPass</Link>
                        </p>
                    )}
                </form>
            )}
        </div>
    );
};

export default Login;

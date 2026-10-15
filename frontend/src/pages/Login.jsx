import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Shield, Award, Dumbbell, Building, User, Users, ArrowLeft } from 'lucide-react';
import PasswordInput from '../components/ui/PasswordInput';

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
        superadmin: {
            title: 'Super Admin Portal',
            icon: Shield,
        },
        fitpass_admin: {
            title: 'FitPass Admin Portal',
            icon: Award,
        },
        h4_admin: {
            title: 'H4 Admin Portal',
            icon: Dumbbell,
        },
        h4_gym_admin: {
            title: 'H4 Gym Admin Portal',
            icon: Dumbbell,
        },
        fitpass_partner_admin: {
            title: 'Fitpass Partner Admin Portal',
            icon: Building,
        },
        staff: {
            title: 'Gym Staff / Trainer Portal',
            icon: Users,
        },
        h4_member: {
            title: 'H4 Member Portal',
            icon: User,
        },
        fitpass_member: {
            title: 'Fitpass Member Portal',
            icon: User,
        },
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

            if (role === 'superadmin') {
                navigate('/superadmin/dashboard');
            } else if (role === 'fitpass_admin') {
                navigate('/superadmin/dashboard');
            } else if (isPartnerAdmin) {
                navigate('/partner/visit-log');
            } else if (role === 'member') {
                navigate('/member-dashboard');
            } else if (role === 'trainer') {
                navigate('/attendance');
            } else {
                navigate('/dashboard');
            }
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

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            padding: '2rem 1rem',
            background: 'var(--bg-secondary)',
            overflowY: 'auto',
            position: 'relative'
        }}>
            <style>{`
                .portal-card {
                    background: var(--bg);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 1.25rem;
                    display: flex;
                    align-items: center;
                    gap: 1.25rem;
                    cursor: pointer;
                    transition: var(--transition);
                    position: relative;
                    overflow: hidden;
                    text-align: left;
                    width: 100%;
                }
                .portal-card:hover {
                    border-color: var(--primary);
                    background: var(--primary-muted);
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-md);
                }
                .portal-icon-wrapper {
                    width: 44px;
                    height: 44px;
                    border-radius: var(--radius-md);
                    background: var(--bg-secondary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: var(--transition);
                    border: 1px solid var(--border);
                    flex-shrink: 0;
                }
                .portal-card:hover .portal-icon-wrapper {
                    background: var(--primary);
                    color: var(--text-inverse) !important;
                    border-color: var(--primary);
                }
                .portal-card:active {
                    transform: scale(0.98);
                }
                .portal-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    width: 100%;
                    margin-top: 1.5rem;
                }
                .back-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--text-secondary);
                    font-size: 0.875rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: var(--transition);
                    margin-bottom: 1.5rem;
                    background: none;
                    border: none;
                    padding: 0;
                }
                .back-btn:hover {
                    color: var(--primary);
                }
            `}</style>

            {currentView === 'main' && (
                <div className="fade-in" style={{
                    padding: '3rem 2.5rem',
                    borderRadius: 'var(--radius-xl)',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-lg)',
                    width: '100%',
                    maxWidth: '480px',
                    zIndex: 10,
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: '60px', height: '60px', background: 'var(--primary)', borderRadius: 'var(--radius-lg)',
                        margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: 'var(--shadow-sm)', transform: 'rotate(-5deg)', border: '1px solid var(--border)'
                    }}>
                        <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-inverse)' }}>G</span>
                    </div>
                    <h2 style={{ color: 'var(--text-primary)', fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem', fontFamily: 'Outfit' }}>GYM CRM PRO</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 500, marginBottom: '1.5rem' }}>Select your access portal to log in</p>

                    <div className="portal-grid">
                        <button
                            type="button"
                            onClick={() => setCurrentView('admin_sub')}
                            className="portal-card"
                        >
                            <div className="portal-icon-wrapper" style={{ color: 'var(--primary)' }}>
                                <Shield size={22} />
                            </div>
                            <div>
                                <h4 style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                                    Admin Portals
                                </h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.3' }}>
                                    Super Admin, FitPass administration, and H4 system controls
                                </p>
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={() => setCurrentView('gym_sub')}
                            className="portal-card"
                        >
                            <div className="portal-icon-wrapper" style={{ color: 'var(--primary)' }}>
                                <Building size={22} />
                            </div>
                            <div>
                                <h4 style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                                    Gym Admin / Staff Portal
                                </h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.3' }}>
                                    Branch owners, manager dashboard, coaches, and staff portal
                                </p>
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={() => setCurrentView('member_sub')}
                            className="portal-card"
                        >
                            <div className="portal-icon-wrapper" style={{ color: 'var(--primary)' }}>
                                <User size={22} />
                            </div>
                            <div>
                                <h4 style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                                    Member Portal
                                </h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.3' }}>
                                    Access memberships, schedules, and check-in history
                                </p>
                            </div>
                        </button>
                    </div>


                </div>
            )}

            {currentView === 'admin_sub' && (
                <div className="fade-in" style={{
                    padding: '3rem 2.5rem',
                    borderRadius: 'var(--radius-xl)',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-lg)',
                    width: '100%',
                    maxWidth: '480px',
                    zIndex: 10,
                    textAlign: 'center'
                }}>
                    {!restrictedAdmin && <button type="button" onClick={handleBack} className="back-btn">
                        <ArrowLeft size={16} />
                        <span>Back to Main Menu</span>
                    </button>}

                    <h2 style={{ color: 'var(--text-primary)', fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem', fontFamily: 'Outfit', marginTop: '1rem' }}>Admin Classifications</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 500, marginBottom: '1.5rem' }}>Choose your admin portal type</p>

                    <div className="portal-grid">
                        <button
                            type="button"
                            onClick={() => { setSelectedRole('superadmin'); setCurrentView('login_form'); }}
                            className="portal-card"
                        >
                            <div className="portal-icon-wrapper" style={{ color: 'var(--primary)' }}>
                                <Shield size={22} />
                            </div>
                            <div>
                                <h4 style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                                    Super Admin
                                </h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.3' }}>
                                    Overall platform administration and systems controls
                                </p>
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={() => { setSelectedRole('fitpass_admin'); setCurrentView('login_form'); }}
                            className="portal-card"
                        >
                            <div className="portal-icon-wrapper" style={{ color: 'var(--primary)' }}>
                                <Award size={22} />
                            </div>
                            <div>
                                <h4 style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                                    FitPass Admin
                                </h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.3' }}>
                                    Manage FitPass memberships, plans, and partnerships
                                </p>
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={() => { setSelectedRole('h4_admin'); setCurrentView('login_form'); }}
                            className="portal-card"
                        >
                            <div className="portal-icon-wrapper" style={{ color: 'var(--primary)' }}>
                                <Dumbbell size={22} />
                            </div>
                            <div>
                                <h4 style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                                    H4 Admin
                                </h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.3' }}>
                                    H4 Gym operations, plans, and branch controls
                                </p>
                            </div>
                        </button>

                        <button type="button" onClick={() => setCurrentView('gym_sub')} className="portal-card">
                            <div className="portal-icon-wrapper" style={{ color: 'var(--primary)' }}><Building size={22} /></div>
                            <div><h4 style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700, marginBottom: '0.2rem' }}>Branch Admin</h4><p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.3' }}>Sign in to a partner or H4 branch workspace</p></div>
                        </button>
                    </div>
                </div>
            )}

            {currentView === 'gym_sub' && (
                <div className="fade-in" style={{
                    padding: '3rem 2.5rem',
                    borderRadius: 'var(--radius-xl)',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-lg)',
                    width: '100%',
                    maxWidth: '480px',
                    zIndex: 10,
                    textAlign: 'center'
                }}>
                    {!restrictedAdmin && <button type="button" onClick={handleBack} className="back-btn">
                        <ArrowLeft size={16} />
                        <span>Back to Main Menu</span>
                    </button>}

                    <h2 style={{ color: 'var(--text-primary)', fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem', fontFamily: 'Outfit', marginTop: '1rem' }}>Gym Roles Classifications</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 500, marginBottom: '1.5rem' }}>Select your gym classification</p>

                    <div className="portal-grid">
                        <button
                            type="button"
                            onClick={() => setCurrentView('gym_admin_branch_sub')}
                            className="portal-card"
                        >
                            <div className="portal-icon-wrapper" style={{ color: 'var(--primary)' }}>
                                <Building size={22} />
                            </div>
                            <div>
                                <h4 style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                                    Gym Admin / Owner
                                </h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.3' }}>
                                    Branch admin, managers, and partners control
                                </p>
                            </div>
                        </button>

                        {!restrictedAdmin && <button
                            type="button"
                            onClick={() => { setSelectedRole('staff'); setCurrentView('login_form'); }}
                            className="portal-card"
                        >
                            <div className="portal-icon-wrapper" style={{ color: 'var(--primary)' }}>
                                <Users size={22} />
                            </div>
                            <div>
                                <h4 style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                                    Gym Staff / Trainer
                                </h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.3' }}>
                                    Coaches, trainers, receptionists, and staff members
                                </p>
                            </div>
                        </button>}
                    </div>
                </div>
            )}

            {currentView === 'gym_admin_branch_sub' && (
                <div className="fade-in" style={{
                    padding: '3rem 2.5rem',
                    borderRadius: 'var(--radius-xl)',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-lg)',
                    width: '100%',
                    maxWidth: '480px',
                    zIndex: 10,
                    textAlign: 'center'
                }}>
                    {!portal && !restrictedAdmin && <button type="button" onClick={() => navigate('/')} className="back-btn">
                        <ArrowLeft size={16} />
                        <span>Back</span>
                    </button>}

                    <h2 style={{ color: 'var(--text-primary)', fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem', fontFamily: 'Outfit', marginTop: '1rem' }}>Gym Admin Branch</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 500, marginBottom: '1.5rem' }}>Select your branch type</p>

                    <div className="portal-grid">
                        <button
                            type="button"
                            onClick={() => { setSelectedRole('h4_gym_admin'); setCurrentView('login_form'); }}
                            className="portal-card"
                        >
                            <div className="portal-icon-wrapper" style={{ color: 'var(--primary)' }}>
                                <Dumbbell size={22} />
                            </div>
                            <div>
                                <h4 style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                                    H4 Gym Admin
                                </h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.3' }}>
                                    Manage H4 physical branches and operational staff
                                </p>
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={() => { setSelectedRole('fitpass_partner_admin'); setCurrentView('login_form'); }}
                            className="portal-card"
                        >
                            <div className="portal-icon-wrapper" style={{ color: 'var(--primary)' }}>
                                <Building size={22} />
                            </div>
                            <div>
                                <h4 style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                                    Fitpass Partner Admin
                                </h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.3' }}>
                                    View FitPass member check-ins and leads at your gym
                                </p>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {currentView === 'member_sub' && (
                <div className="fade-in" style={{
                    padding: '3rem 2.5rem',
                    borderRadius: 'var(--radius-xl)',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-lg)',
                    width: '100%',
                    maxWidth: '480px',
                    zIndex: 10,
                    textAlign: 'center'
                }}>
                    {!restrictedAdmin && <button type="button" onClick={handleBack} className="back-btn">
                        <ArrowLeft size={16} />
                        <span>Back to Main Menu</span>
                    </button>}

                    <h2 style={{ color: 'var(--text-primary)', fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem', fontFamily: 'Outfit', marginTop: '1rem' }}>Member Classification</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 500, marginBottom: '1.5rem' }}>Select your membership type</p>

                    <div className="portal-grid">
                        <button
                            type="button"
                            onClick={() => { setSelectedRole('h4_member'); setCurrentView('login_form'); }}
                            className="portal-card"
                        >
                            <div className="portal-icon-wrapper" style={{ color: 'var(--primary)' }}>
                                <Dumbbell size={22} />
                            </div>
                            <div>
                                <h4 style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                                    H4 Member
                                </h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.3' }}>
                                    Access H4 branches, physical classes, and schedule logs
                                </p>
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={() => { setSelectedRole('fitpass_member'); setCurrentView('login_form'); }}
                            className="portal-card"
                        >
                            <div className="portal-icon-wrapper" style={{ color: 'var(--primary)' }}>
                                <User size={22} />
                            </div>
                            <div>
                                <h4 style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                                    Fitpass Member
                                </h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: '1.3' }}>
                                    Access universal passes, partner gym logs, and QR scan tokens
                                </p>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {currentView === 'login_form' && (
                <form onSubmit={handleSubmit} className="fade-in" style={{
                    padding: '3rem',
                    borderRadius: 'var(--radius-xl)',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-lg)',
                    width: '100%',
                    maxWidth: '440px',
                    zIndex: 10
                }}>
                    <button type="button" onClick={handleBack} className="back-btn">
                        <ArrowLeft size={16} />
                        <span>Back</span>
                    </button>

                    <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                        <div style={{
                            width: '60px', height: '60px', background: 'var(--primary)', borderRadius: 'var(--radius-lg)',
                            margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: 'var(--shadow-sm)', transform: 'rotate(-5deg)', border: '1px solid var(--border)'
                        }}>
                            {SelectedIcon && <SelectedIcon size={28} style={{ color: 'var(--text-inverse)' }} />}
                        </div>
                        <h2 style={{ color: 'var(--text-primary)', fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem', fontFamily: 'Outfit' }}>
                            {selectedPortal?.title}
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>Enter your credentials to continue</p>
                    </div>

                    {error && (
                        <div className="badge badge-expired" style={{
                            width: '100%', justifyContent: 'center', padding: '0.75rem',
                            marginBottom: '1.5rem', background: 'rgba(220, 38, 38, 0.08)', border: '1px solid rgba(220, 38, 38, 0.15)',
                            color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', borderRadius: 'var(--radius-sm)'
                        }}>
                            {error}
                        </div>
                    )}

                    <div className="input-group">
                        <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.6rem', fontSize: '0.875rem', fontWeight: '600', fontFamily: 'Outfit' }}>Email Address or Phone Number</label>
                        <input
                            type="text"
                            className="input"
                            placeholder="Email address or phone number"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="input-group" style={{ marginBottom: '2.5rem' }}>
                        <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.6rem', fontSize: '0.875rem', fontWeight: '600', fontFamily: 'Outfit' }}>Password</label>
                        <PasswordInput
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{
                            width: '100%',
                            padding: '1rem',
                            fontSize: '1rem',
                            fontWeight: 700,
                        }}
                        disabled={loading}
                    >
                        {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
                    </button>
                    {portal === 'fitpass_member' && <p style={{ textAlign: 'center', marginTop: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>New to FitPass? <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 700 }}>Create an account</Link></p>}
                </form>
            )}
        </div>
    );
};

export default Login;

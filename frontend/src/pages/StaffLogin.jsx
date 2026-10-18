import { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, LockKeyhole, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import API from '../services/api';
import './login-design.css';

function LoginPasswordInput({ value, onChange }) {
    const [show, setShow] = useState(false);
    return (
        <div className="login-input-wrap">
            <input
                type={show ? 'text' : 'password'}
                className="login-input"
                value={value}
                onChange={onChange}
                autoComplete="current-password"
                required
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

export default function StaffLogin() {
    const { login, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const [branches, setBranches]  = useState([]);
    const [branchId, setBranchId]  = useState('');
    const [email, setEmail]        = useState('');
    const [password, setPassword]  = useState('');
    const [error, setError]        = useState('');
    const [loading, setLoading]    = useState(false);

    useEffect(() => {
        API.get('/branches/public')
            .then(({ data }) => setBranches(data))
            .catch(() => setError('Could not load branches. Please refresh and try again.'));
    }, []);

    const submit = async (event) => {
        event.preventDefault();
        setError('');
        setLoading(true);
        const result = await login(email, password, 'staff');
        setLoading(false);
        if (!result.success) return setError(result.message);
        const assignedBranch = result.user.branchId?._id || result.user.branchId || '';
        if (assignedBranch && String(assignedBranch) !== String(branchId)) {
            logout();
            return setError('This account is assigned to a different branch. Select your assigned branch and try again.');
        }
        navigate(
            result.user.role === 'partner'  ? '/partner/visit-log' :
            result.user.role === 'trainer'  ? '/attendance' :
            '/dashboard'
        );
    };

    return (
        <div className="login-shell">
            <form className="login-card login-fade" onSubmit={submit}>

                {/* Back link */}
                <Link to="/" className="login-back-btn" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                    <ArrowLeft size={14} /> Main portal
                </Link>

                {/* Header */}
                <div className="login-portal-header">
                    <div className="login-portal-emblem">
                        <Building2 size={26} />
                    </div>
                    <div className="login-title" style={{ marginBottom: '0.25rem' }}>Staff sign in</div>
                    <div className="login-subtitle" style={{ marginBottom: 0 }}>
                        Select your branch and use your staff credentials
                    </div>
                </div>

                {error && (
                    <div className="login-error">
                        <AlertCircle size={15} />
                        {error}
                    </div>
                )}

                <div className="login-field">
                    <label>Branch</label>
                    <select
                        className="login-select"
                        value={branchId}
                        onChange={(e) => setBranchId(e.target.value)}
                        required
                    >
                        <option value="">Select your branch</option>
                        {branches.map((b) => (
                            <option key={b.id} value={b.id}>
                                {b.gymName} · {b.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="login-field">
                    <label>Email or Phone</label>
                    <input
                        className="login-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="username"
                        required
                        placeholder="you@gym.com"
                    />
                </div>

                <div className="login-field" style={{ marginBottom: '1.75rem' }}>
                    <label>Password</label>
                    <LoginPasswordInput value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>

                <button className="login-btn" disabled={loading}>
                    <LockKeyhole size={17} />
                    {loading ? 'Signing in…' : 'Sign in to your branch'}
                </button>

            </form>
        </div>
    );
}

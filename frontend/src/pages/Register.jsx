import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { User, AlertCircle, CheckCircle } from 'lucide-react';
import './login-design.css';

const Register = () => {
    const [name, setName]                         = useState('');
    const [email, setEmail]                       = useState('');
    const [password, setPassword]                 = useState('');
    const [phone, setPhone]                       = useState('');
    const [otp, setOtp]                           = useState('');
    const [verificationPending, setVerificationPending] = useState(false);
    const [registeredEmail, setRegisteredEmail]   = useState('');
    const [error, setError]                       = useState('');
    const [loading, setLoading]                   = useState(false);
    const { register, verifyRegistration }        = useContext(AuthContext);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const result = await register(name, email, password, phone);
        setLoading(false);
        if (result.success) {
            setRegisteredEmail(result.email);
            setVerificationPending(true);
        } else {
            setError(result.message);
        }
    };

    const verify = async (event) => {
        event.preventDefault();
        setError('');
        setLoading(true);
        const result = await verifyRegistration(registeredEmail, otp);
        setLoading(false);
        if (result.success) navigate('/member-dashboard');
        else setError(result.message);
    };

    return (
        <div className="login-shell">
            <form
                onSubmit={verificationPending ? verify : handleSubmit}
                className="login-card login-fade"
            >
                {/* Header */}
                <div className="login-portal-header">
                    <div className="login-portal-emblem">
                        {verificationPending
                            ? <CheckCircle size={26} />
                            : <User size={26} />
                        }
                    </div>
                    <div className="login-title" style={{ marginBottom: '0.25rem' }}>
                        {verificationPending ? 'Check your inbox' : 'Create your FitPass'}
                    </div>
                    <div className="login-subtitle" style={{ marginBottom: 0 }}>
                        {verificationPending
                            ? `Enter the 6-digit code sent to ${registeredEmail}.`
                            : 'One account for every way you want to move.'
                        }
                    </div>
                </div>

                {error && (
                    <div className="login-error">
                        <AlertCircle size={15} />
                        {error}
                    </div>
                )}

                {!verificationPending && (
                    <>
                        <div className="login-field">
                            <label>Your Name</label>
                            <input
                                type="text"
                                className="login-input"
                                placeholder="John Doe"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="login-field">
                            <label>Email Address</label>
                            <input
                                type="email"
                                className="login-input"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="login-field">
                            <label>Phone Number</label>
                            <input
                                type="tel"
                                className="login-input"
                                placeholder="98765 43210"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                required
                            />
                        </div>

                        <div className="login-field" style={{ marginBottom: '1.75rem' }}>
                            <label>Create Password</label>
                            <input
                                type="password"
                                className="login-input"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </>
                )}

                {verificationPending && (
                    <div className="login-field" style={{ marginBottom: '1.75rem' }}>
                        <label>Verification Code</label>
                        <input
                            className="login-input"
                            inputMode="numeric"
                            maxLength={6}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            required
                            placeholder="6-digit code"
                            style={{ letterSpacing: '0.3em', fontSize: '1.2rem', textAlign: 'center' }}
                        />
                    </div>
                )}

                <button type="submit" className="login-btn" disabled={loading}>
                    {loading
                        ? 'Please wait…'
                        : verificationPending
                            ? 'Verify and create account'
                            : 'Create FitPass account'
                    }
                </button>

                <p className="login-footer-text">
                    Already a member?{' '}
                    <Link to="/member-login">Sign in</Link>
                </p>
            </form>
        </div>
    );
};

export default Register;

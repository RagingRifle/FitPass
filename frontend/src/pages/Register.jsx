import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Register = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [verificationPending, setVerificationPending] = useState(false);
    const [registeredEmail, setRegisteredEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { register, verifyRegistration } = useContext(AuthContext);
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
        event.preventDefault(); setError(''); setLoading(true);
        const result = await verifyRegistration(registeredEmail, otp); setLoading(false);
        if (result.success) navigate('/member-dashboard'); else setError(result.message);
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            background: 'var(--bg-secondary)',
            overflow: 'hidden',
            position: 'relative',
            padding: '2rem'
        }}>
            <form onSubmit={verificationPending ? verify : handleSubmit} className="fade-in" style={{
                padding: '3rem',
                borderRadius: 'var(--radius-xl)',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-lg)',
                width: '100%',
                maxWidth: '480px',
                zIndex: 10
            }}>
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{
                        width: '60px', height: '60px', background: 'var(--primary)', borderRadius: 'var(--radius-lg)',
                        margin: '0 auto 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: 'var(--shadow-sm)', transform: 'rotate(5deg)', border: '1px solid var(--border)'
                    }}>
                        <span style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-inverse)' }}>F</span>
                    </div>
                    <h2 style={{ color: 'var(--text-primary)', fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem', fontFamily: 'Outfit' }}>{verificationPending ? 'Check your inbox' : 'Create your FitPass'}</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>{verificationPending ? `Enter the 6-digit code sent to ${registeredEmail}.` : 'One account for every way you want to move.'}</p>
                </div>

                {error && (
                    <div className="badge badge-expired" style={{
                        width: '100%', justifyContent: 'center', padding: '0.75rem',
                        marginBottom: '1.5rem', background: 'rgba(220, 38, 38, 0.08)', border: '1px solid rgba(220, 38, 38, 0.15)'
                    }}>
                        {error}
                    </div>
                )}

                {!verificationPending && <><div className="input-group">
                    <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.6rem', fontSize: '0.875rem', fontWeight: '600', fontFamily: 'Outfit' }}>Your name</label>
                    <input
                        type="text"
                        className="input"
                        placeholder="John Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                </div>

                <div className="input-group">
                    <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.6rem', fontSize: '0.875rem', fontWeight: '600', fontFamily: 'Outfit' }}>Email Address</label>
                    <input
                        type="email"
                        className="input"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>

                <div className="input-group">
                    <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.6rem', fontSize: '0.875rem', fontWeight: '600', fontFamily: 'Outfit' }}>Phone number</label>
                    <input type="tel" className="input" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                </div>

                <div className="input-group" style={{ marginBottom: '2.5rem' }}>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.6rem', fontSize: '0.875rem', fontWeight: '600', fontFamily: 'Outfit' }}>Create password</label>
                    <input
                        type="password"
                        className="input"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                </>}

                {verificationPending && <div className="input-group"><label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.6rem', fontSize: '0.875rem', fontWeight: '600', fontFamily: 'Outfit' }}>Verification code</label><input className="input" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} required placeholder="6-digit code" /></div>}

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
                    {loading ? 'Please wait…' : verificationPending ? 'Verify and create account' : 'Create FitPass account'}
                </button>

                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '2rem' }}>
                    Member already? <Link to="/member-login" style={{ color: 'var(--text-primary)', fontWeight: '700', textDecoration: 'none', borderBottom: '2px solid var(--primary)' }}>Sign in</Link>
                </p>
            </form>
        </div>
    );
};

export default Register;

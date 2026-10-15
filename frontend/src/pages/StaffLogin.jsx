import { useContext, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, LockKeyhole } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import API from '../services/api';
import './fitpass.css';

export default function StaffLogin() {
  const { login, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    API.get('/branches/public').then(({ data }) => setBranches(data)).catch(() => setError('Could not load branches. Please refresh and try again.'));
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
    navigate(result.user.role === 'partner' ? '/partner/visit-log' : result.user.role === 'trainer' ? '/attendance' : '/dashboard');
  };

  return <main className="fitpass-auth-page"><Link className="fitpass-back" to="/"><ArrowLeft size={17} /> FitPass home</Link>
    <form className="fitpass-auth-card" onSubmit={submit}>
      <span className="fitpass-auth-mark"><Building2 size={23} /></span>
      <p className="fitpass-eyebrow">TEAM ACCESS</p><h1>Staff sign in</h1>
      <p className="fitpass-auth-copy">Choose your branch, then use your staff credentials.</p>
      {error && <div className="fitpass-error" role="alert">{error}</div>}
      <label>Branch<select value={branchId} onChange={(e) => setBranchId(e.target.value)} required><option value="">Select your branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.gymName} · {branch.name}</option>)}</select></label>
      <label>Email or phone<input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required placeholder="you@fitpass.com" /></label>
      <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
      <button className="fitpass-primary-button" disabled={loading}><LockKeyhole size={17} />{loading ? 'Signing in…' : 'Sign in to your branch'}</button>
    </form>
  </main>;
}

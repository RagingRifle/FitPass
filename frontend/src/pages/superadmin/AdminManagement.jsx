import { useState, useEffect } from 'react';
import API from '../../services/api';
import { Loader,  ShieldCheck, Plus, Trash2, Edit2, Lock, Mail, User, ShieldAlert } from 'lucide-react';
import { useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';

function AdminManagement({ scope = 'all' }) {
    const { user } = useContext(AuthContext);
    const divisionRole = user?.role === 'h4_admin' ? 'h4' : user?.role === 'fitpass_admin' ? 'fitpass' : 'all';
    const initialDivision = scope === 'all' ? divisionRole : scope;
    const initialRole = initialDivision === 'h4'
        ? 'h4_branch_admin'
        : user?.role === 'superadmin' ? 'fitpass_admin' : 'fitpass_partner';
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Form state for creating
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState(initialRole);
    const [division, setDivision] = useState(initialDivision);
    const [scopeData, setScopeData] = useState({ fitpassGyms: [], branches: [], h4Gym: null });
    const [gymId, setGymId] = useState('');
    const [branchId, setBranchId] = useState('');

    // Editing admin modal state
    const [editingAdmin, setEditingAdmin] = useState(null);
    const [editName, setEditName] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [editStatus, setEditStatus] = useState('Active');
    const [editFitPassPayoutAccess, setEditFitPassPayoutAccess] = useState(false);

    const fetchAdmins = async () => {
        try {
            setLoading(true);
            const { data } = await API.get('/superadmin/admins');
            setAdmins(data || []);
            setLoading(false);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch administrator directory');
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAdmins();
        API.get('/superadmin/admin-scopes').then(({ data }) => setScopeData(data)).catch((err) => setError(err.response?.data?.message || 'Could not load account scopes.'));
    }, []);

    const h4Branches = scopeData.branches.filter(branch => String(branch.gymId) === String(scopeData.h4Gym?.id || scopeData.h4Gym?._id));
    const visibleAdmins = admins.filter(admin => division === 'all' || (division === 'h4' ? ['h4_admin', 'h4_branch_admin'].includes(admin.roleScope) : ['fitpass_admin', 'fitpass_partner'].includes(admin.roleScope)));
    const roleNames = { fitpass_admin: 'FitPass Admin', h4_admin: 'H4 Admin', h4_branch_admin: 'H4 Branch Admin', fitpass_partner: 'FitPass Partner' };
    const canManageAdmin = (admin) => user?.role === 'superadmin'
        || (user?.role === 'h4_admin' && !user?.branchId && admin.roleScope === 'h4_branch_admin')
        || (user?.role === 'fitpass_admin' && admin.roleScope === 'fitpass_partner');



    const handleCreateAdmin = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        try {
            await API.post('/superadmin/admins', {
                name,
                email,
                password,
                role,
                ...(role === 'h4_branch_admin' ? { branchId } : {}),
                ...(role === 'fitpass_partner' ? { gymId } : {}),
            });
            setName('');
            setEmail('');
            setPassword('');
            setRole(division === 'h4' ? 'h4_branch_admin' : user?.role === 'superadmin' ? 'fitpass_admin' : 'fitpass_partner');
            setGymId('');
            setBranchId('');
            setSuccessMessage('Administrator account provisioned successfully!');
            fetchAdmins();
            setTimeout(() => setSuccessMessage(''), 4000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create administrator account');
        }
    };

    const handleEditClick = (admin) => {
        setEditingAdmin(admin);
        setEditName(admin.name);
        setEditPassword('');
        setEditStatus(admin.status || 'Active');
        setEditFitPassPayoutAccess(Boolean(admin.fitPassPayoutAccess));
    };

    const handleUpdateAdmin = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        try {
            const body = { name: editName, status: editStatus };
            if (editPassword) {
                body.password = editPassword;
            }
            if (user?.role === 'superadmin' && editingAdmin.role === 'fitpass_admin') body.fitPassPayoutAccess = editFitPassPayoutAccess;
            await API.put(`/superadmin/admins/${editingAdmin._id}`, body);
            setEditingAdmin(null);
            setSuccessMessage('Administrator account updated successfully.');
            fetchAdmins();
            setTimeout(() => setSuccessMessage(''), 4000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update administrator account');
        }
    };

    const handleDeleteAdmin = async (adminId) => {
        if (!window.confirm('Are you sure you want to permanently revoke this administrator access?')) {
            return;
        }
        setError('');
        setSuccessMessage('');
        try {
            await API.delete(`/superadmin/admins/${adminId}`);
            setSuccessMessage('Administrator access revoked.');
            fetchAdmins();
            setTimeout(() => setSuccessMessage(''), 4000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to revoke administrator access');
        }
    };

    const pageTitle = scope === 'h4'
        ? 'H4 Branch Admins'
        : scope === 'fitpass' ? 'FitPass Partner Accounts' : 'Admins Directory';
    const pageDescription = scope === 'h4'
        ? 'Create and manage administrator access for individual H4 branches.'
        : scope === 'fitpass'
            ? 'Create and manage FitPass partner-gym access.'
            : 'Manage FitPass and H4 administrator accounts. Division-specific access is managed in each division.';
    const provisionTitle = scope === 'h4'
        ? 'Add H4 Branch Admin'
        : scope === 'fitpass' ? 'Add FitPass Partner Account' : 'Provision Admin Account';
    const provisionButtonLabel = scope === 'h4'
        ? 'Create H4 Branch Admin'
        : scope === 'fitpass' ? 'Create Partner Account' : 'Provision Admin Account';
    const showDivisionTabs = user?.role === 'superadmin' && scope === 'all';

    if (loading && admins.length === 0) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
            <Loader className="spinner" size={40} style={{ color: 'var(--primary-color)' }} />
        </div>
    );

    return (
        <div style={{ padding: '1rem 0' }}>
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <ShieldCheck size={28} style={{ color: 'var(--primary)' }} />
                    <h2 style={{ margin: 0 }}>{pageTitle}</h2>
                </div>
            </header>

            <p style={{ color: 'var(--text-secondary)', margin: '-1rem 0 1.2rem' }}>{pageDescription}</p>
            {showDivisionTabs && <div style={{ display: 'flex', gap: 8, marginBottom: 18 }} role="tablist" aria-label="Admin directory division">
                {[['all', `All admin logins · ${admins.length}`], ['fitpass', `FitPass · ${admins.filter(admin => ['fitpass_admin', 'fitpass_partner'].includes(admin.roleScope)).length}`], ['h4', `H4 · ${admins.filter(admin => ['h4_admin', 'h4_branch_admin'].includes(admin.roleScope)).length}`]].map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={division === key} onClick={() => { setDivision(key); setRole(key === 'h4' ? 'h4_admin' : 'fitpass_admin'); }} className={`btn ${division === key ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '0.55rem 1rem' }}>{label}</button>)}
            </div>}

            {error && (
                <div className="error-message" style={{ color: 'var(--danger)', marginBottom: '1.5rem', padding: '0.75rem 1rem', background: 'rgba(255,0,68,0.1)', border: '1px solid rgba(255,0,68,0.2)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldAlert size={18} />
                    <span>{error}</span>
                </div>
            )}

            {successMessage && (
                <div style={{ color: 'var(--success)', marginBottom: '1.5rem', padding: '0.75rem 1rem', background: 'rgba(46,125,50,0.1)', border: '1px solid rgba(46,125,50,0.2)', borderRadius: 'var(--radius-md)' }}>
                    {successMessage}
                </div>
            )}

            <div className="card" style={{ marginBottom: '2.5rem', padding: '2rem' }}>
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={20} />
                    <span>{provisionTitle}</span>
                </h3>
                <form onSubmit={handleCreateAdmin}>
                    <div className="form-grid">
                        <div className="input-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <User size={14} /> Name
                            </label>
                            <input 
                                className="input" 
                                type="text" 
                                placeholder="e.g. Rachel Green" 
                                value={name} 
                                onChange={(e) => setName(e.target.value)} 
                                required 
                            />
                        </div>
                        <div className="input-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Mail size={14} /> Email Address
                            </label>
                            <input 
                                className="input" 
                                type="email" 
                                placeholder="e.g. rachel@fitprime.com" 
                                value={email} 
                                onChange={(e) => setEmail(e.target.value)} 
                                required 
                            />
                        </div>
                    </div>
                    <div className="form-grid">
                        <div className="input-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Lock size={14} /> Password
                            </label>
                            <input 
                                className="input" 
                                type="password" 
                                placeholder="Minimum 6 characters" 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)} 
                                required 
                                minLength={6}
                            />
                        </div>
                        <div className="input-group">
                            <label>Administrative Role</label>
                            <select 
                                className="input" 
                                value={role} 
                                onChange={(e) => { setRole(e.target.value); setBranchId(''); setGymId(''); }} 
                                required
                            >
                                {(division === 'all' || division === 'fitpass') && (user?.role === 'superadmin' ? <><option value="fitpass_admin">FitPass Admin (Global network operations)</option><option value="fitpass_partner">FitPass Partner (One partner gym)</option></> : <option value="fitpass_partner">FitPass Partner (One partner gym)</option>)}
                                {(division === 'all' || division === 'h4') && (user?.role === 'superadmin' ? <><option value="h4_admin">H4 Admin (All H4 branches)</option><option value="h4_branch_admin">H4 Branch Admin (One H4 branch)</option></> : <option value="h4_branch_admin">H4 Branch Admin (One H4 branch)</option>)}
                            </select>
                        </div>
                    </div>
                    {role === 'fitpass_partner' && <div className="input-group" style={{ maxWidth: 500, marginTop: 12 }}><label>Partner gym</label><select className="input" value={gymId} onChange={e => setGymId(e.target.value)} required><option value="">Select a FitPass gym</option>{scopeData.fitpassGyms.map(gym => <option key={gym.id || gym._id} value={gym.id || gym._id}>{gym.name}</option>)}</select></div>}
                    {role === 'h4_branch_admin' && <div className="input-group" style={{ maxWidth: 500, marginTop: 12 }}><label>H4 branch</label><select className="input" value={branchId} onChange={e => setBranchId(e.target.value)} required><option value="">Select an H4 branch</option>{h4Branches.map(branch => <option key={branch.id || branch._id} value={branch.id || branch._id}>{branch.name}</option>)}</select></div>}
                    <p style={{ margin: '0.75rem 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{role === 'h4_branch_admin' ? 'Branch access is locked to the selected H4 location.' : role === 'h4_admin' ? 'H4-wide access across all H4 branches.' : role === 'fitpass_partner' ? 'Partner access is limited to the selected gym.' : 'FitPass network-wide administration.'}</p>
                    <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                        {provisionButtonLabel}
                    </button>
                </form>
            </div>

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role Scope</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visibleAdmins.length === 0 ? (
                            <tr>
                                <td colSpan="5">
                                    <div className="empty-state">
                                        <div className="empty-state-icon"></div>
                                        <h3>No accounts in this directory</h3>
                                        <p>Provision an account above to give someone access to this division.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            visibleAdmins.map(admin => (
                                <tr key={admin._id}>
                                    <td style={{ fontWeight: '600' }}>{admin.name}</td>
                                    <td>{admin.email}</td>
                                    <td>
                                        <span className={`badge ${admin.role === 'fitpass_admin' ? 'badge-active' : 'badge-completed'}`} style={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>
                                            {roleNames[admin.roleScope] || admin.role}
                                            {admin.roleScope === 'h4_branch_admin' && admin.branchName ? ` · ${admin.branchName}` : ''}
                                            {admin.roleScope === 'fitpass_partner' && admin.gymName ? ` · ${admin.gymName}` : ''}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`badge ${admin.status === 'Inactive' ? 'badge-expired' : 'badge-active'}`}>
                                            {admin.status || 'Active'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                            {canManageAdmin(admin) && <button
                                                className="btn btn-secondary"
                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                                onClick={() => handleEditClick(admin)}
                                            >
                                                <Edit2 size={12} />
                                                <span>Edit</span>
                                            </button>}
                                            {canManageAdmin(admin) && <button
                                                className="btn btn-danger"
                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                                onClick={() => handleDeleteAdmin(admin._id)}
                                            >
                                                <Trash2 size={12} />
                                                <span>Revoke</span>
                                            </button>}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {editingAdmin && (
                <div className="modal-overlay" onClick={() => setEditingAdmin(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Edit2 size={20} style={{ color: 'var(--primary)' }} />
                            <span>Modify Administrator Settings</span>
                        </h3>
                        <form onSubmit={handleUpdateAdmin} style={{ marginTop: '1.5rem' }}>
                            <div className="input-group">
                                <label>Name</label>
                                <input 
                                    className="input"
                                    type="text" 
                                    value={editName} 
                                    onChange={(e) => setEditName(e.target.value)} 
                                    required 
                                />
                            </div>
                            <div className="input-group">
                                <label>Password Reset (leave empty to keep current)</label>
                                <input 
                                    className="input"
                                    type="password" 
                                    placeholder="Enter new password"
                                    value={editPassword} 
                                    onChange={(e) => setEditPassword(e.target.value)} 
                                    minLength={6}
                                />
                            </div>
                            <div className="input-group">
                                <label>Status</label>
                                <select 
                                    className="input" 
                                    value={editStatus} 
                                    onChange={(e) => setEditStatus(e.target.value)}
                                    required
                                >
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                            </div>
                            {user?.role === 'superadmin' && editingAdmin.role === 'fitpass_admin' && <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, border: '1px solid var(--border-color)', borderRadius: 10 }}>
                                <input type="checkbox" checked={editFitPassPayoutAccess} onChange={event => setEditFitPassPayoutAccess(event.target.checked)} style={{ marginTop: 3 }} />
                                <span><strong>Allow FitPass branch payouts</strong><br /><small style={{ color: 'var(--text-secondary)' }}>Grants this FitPass admin access to the branch payout ledger and settlement tools.</small></span>
                            </label>}
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Changes</button>
                                <button type="button" className="btn btn-secondary" onClick={() => setEditingAdmin(null)} style={{ flex: 1 }}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminManagement;

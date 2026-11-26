import { useState, useEffect, useContext } from 'react';
import API from '../../services/api';
import { Loader, ShieldCheck, Plus, Trash2, Edit2, Lock, Mail, User, ShieldAlert, Users } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import './AdminManagement.css';

function AdminManagement({ scope = 'all' }) {
    const { user, activeDivision } = useContext(AuthContext);
    const divisionRole = user?.role === 'h4_admin' ? 'h4' : user?.role === 'fitpass_admin' ? 'fitpass' : 'all';
    const division = scope === 'all'
        ? user?.role === 'superadmin' ? activeDivision : divisionRole
        : scope;
    const initialRole = division === 'h4'
        ? 'h4_branch_admin'
        : user?.role === 'superadmin' ? 'fitpass_admin' : 'fitpass_partner';

    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [search, setSearch] = useState('');

    // Form state for creating
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState(initialRole);
    const [scopeData, setScopeData] = useState({ fitpassGyms: [], branches: [], h4Gym: null });
    const [gymId, setGymId] = useState('');
    const [branchId, setBranchId] = useState('');

    // Editing admin modal state
    const [editingAdmin, setEditingAdmin] = useState(null);
    const [editName, setEditName] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [editStatus, setEditStatus] = useState('Active');
    const [editFitPassPayoutAccess, setEditFitPassPayoutAccess] = useState(false);
    const [editBranchId, setEditBranchId] = useState('');

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
        API.get('/superadmin/admin-scopes')
            .then(({ data }) => setScopeData(data))
            .catch((err) => setError(err.response?.data?.message || 'Could not load account scopes.'));
    }, []);

    const h4Branches = scopeData.branches.filter(branch => String(branch.gymId) === String(scopeData.h4Gym?.id || scopeData.h4Gym?._id));
    const fitpassBranches = scopeData.branches.filter(branch => String(branch.gymId) === String(gymId));
    const visibleAdmins = admins.filter(admin => division === 'h4'
        ? ['h4_admin', 'h4_branch_admin'].includes(admin.roleScope)
        : ['fitpass_admin', 'fitpass_partner'].includes(admin.roleScope));

    const filteredAdmins = visibleAdmins.filter(admin => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return [admin.name, admin.email, admin.branchName, admin.gymName, admin.roleScope]
            .some(val => String(val || '').toLowerCase().includes(q));
    });

    const activeCount = visibleAdmins.filter(a => (a.status || 'Active') === 'Active').length;
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
                ...(role === 'fitpass_partner' ? { gymId, branchId } : {}),
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
        setEditBranchId(admin.branchId || '');
    };

    const handleUpdateAdmin = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        try {
            const body = { name: editName, status: editStatus };
            if (editingAdmin.roleScope === 'fitpass_partner') body.branchId = editBranchId;
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
        : scope === 'fitpass'
            ? 'FitPass Admins & Partner Accounts'
            : division === 'h4' ? 'H4 Admin Directory' : 'FitPass Admin Directory';
    const pageDescription = scope === 'h4'
        ? 'Create and manage administrator access for individual H4 branches.'
        : scope === 'fitpass'
            ? 'Manage FitPass administrator and partner-gym accounts.'
            : division === 'h4'
                ? 'Manage H4-wide and branch administrator accounts.'
                : 'Manage FitPass network administrators and partner-gym accounts.';
    const provisionTitle = scope === 'h4'
        ? 'Add H4 Branch Admin'
        : scope === 'fitpass'
            ? 'Add FitPass Account'
            : division === 'h4' ? 'Add H4 Admin' : 'Add FitPass Account';
    const provisionButtonLabel = scope === 'h4'
        ? 'Create H4 Branch Admin'
        : scope === 'fitpass'
            ? 'Create FitPass Account'
            : division === 'h4' ? 'Create H4 Admin' : 'Create FitPass Account';
    const kickerText = division === 'h4' ? 'H4 · ACCESS CONTROL' : 'FITPASS · ACCESS CONTROL';

    if (loading && admins.length === 0) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
            <Loader className="spinner" size={40} style={{ color: 'var(--primary-color)' }} />
        </div>
    );

    return (
        <div className="fade-in admin-dir-page">
            <header className="plans-page-header" style={{ marginBottom: '1.5rem' }}>
                <div>
                    <p className="plans-page-header__kicker">{kickerText}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <ShieldCheck size={24} style={{ color: 'var(--primary)' }} />
                        <h2 style={{ margin: 0 }}>{pageTitle}</h2>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>{pageDescription}</p>
                </div>
                <div className="admin-dir-stats">
                    <span className="admin-dir-stat-pill">
                        <Users size={15} />
                        <strong>{activeCount}</strong> active of {visibleAdmins.length}
                    </span>
                </div>
            </header>

            {error && (
                <div className="error-message" style={{ color: 'var(--danger)', marginBottom: '1.25rem', padding: '0.75rem 1rem', background: 'rgba(255,0,68,0.08)', border: '1px solid rgba(255,0,68,0.2)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldAlert size={18} />
                    <span>{error}</span>
                </div>
            )}

            {successMessage && (
                <div style={{ color: 'var(--success)', marginBottom: '1.25rem', padding: '0.75rem 1rem', background: 'rgba(46,125,50,0.08)', border: '1px solid rgba(46,125,50,0.2)', borderRadius: 'var(--radius-md)' }}>
                    {successMessage}
                </div>
            )}

            <div className="admin-dir-layout">
                {/* Provision Form Card */}
                <section className="card admin-dir-card" style={{ padding: 0 }}>
                    <div className="admin-dir-card__header">
                        <div>
                            <h3><Plus size={18} /> {provisionTitle}</h3>
                            <small>Assign role scope and login credentials.</small>
                        </div>
                    </div>
                    <form onSubmit={handleCreateAdmin} className="admin-dir-form">
                        <div className="input-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
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
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
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
                        <div className="input-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
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
                                {division === 'fitpass' && (user?.role === 'superadmin'
                                    ? <><option value="fitpass_admin">FitPass Admin (Global network operations)</option><option value="fitpass_partner">FitPass Partner (One partner gym)</option></>
                                    : <option value="fitpass_partner">FitPass Partner (One partner gym)</option>)}
                                {division === 'h4' && (user?.role === 'superadmin'
                                    ? <><option value="h4_admin">H4 Admin (All H4 branches)</option><option value="h4_branch_admin">H4 Branch Admin (One H4 branch)</option></>
                                    : <option value="h4_branch_admin">H4 Branch Admin (One H4 branch)</option>)}
                            </select>
                        </div>

                        {role === 'fitpass_partner' && (
                            <>
                                <div className="input-group">
                                    <label>Partner gym</label>
                                    <select className="input" value={gymId} onChange={e => { setGymId(e.target.value); setBranchId(''); }} required>
                                        <option value="">Select a FitPass gym</option>
                                        {scopeData.fitpassGyms.map(gym => <option key={gym.id || gym._id} value={gym.id || gym._id}>{gym.name}</option>)}
                                    </select>
                                </div>
                                {gymId && fitpassBranches.length > 0 && (
                                    <div className="input-group">
                                        <label>Partner branch</label>
                                        <select className="input" value={branchId} onChange={e => setBranchId(e.target.value)} required>
                                            <option value="">Select a branch</option>
                                            {fitpassBranches.map(branch => <option key={branch.id || branch._id} value={branch.id || branch._id}>{branch.name}</option>)}
                                        </select>
                                    </div>
                                )}
                            </>
                        )}

                        {role === 'h4_branch_admin' && (
                            <div className="input-group">
                                <label>H4 branch</label>
                                <select className="input" value={branchId} onChange={e => setBranchId(e.target.value)} required>
                                    <option value="">Select an H4 branch</option>
                                    {h4Branches.map(branch => <option key={branch.id || branch._id} value={branch.id || branch._id}>{branch.name}</option>)}
                                </select>
                            </div>
                        )}

                        <p className="admin-dir-scope-note">
                            {role === 'h4_branch_admin'
                                ? 'Branch access is locked to the selected H4 location.'
                                : role === 'h4_admin'
                                    ? 'H4-wide access across all H4 branches.'
                                    : role === 'fitpass_partner'
                                        ? 'Partner access is limited to the selected branch.'
                                        : 'FitPass network-wide administration.'}
                        </p>

                        <button type="submit" className="btn btn-primary" style={{ width: '100%', minHeight: 42 }}>
                            <Plus size={16} /> {provisionButtonLabel}
                        </button>
                    </form>
                </section>

                {/* Directory Table Card */}
                <section className="card admin-dir-card" style={{ padding: 0 }}>
                    <div className="admin-dir-card__header">
                        <div>
                            <h3>Directory ({filteredAdmins.length})</h3>
                            <small>Active and inactive accounts in this division.</small>
                        </div>
                        <div className="admin-dir-search">
                            <input
                                className="input"
                                type="search"
                                placeholder="Search name, email, branch..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="admin-dir-table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Administrator</th>
                                    <th>Role Scope</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAdmins.length === 0 ? (
                                    <tr>
                                        <td colSpan="4">
                                            <div className="empty-state" style={{ padding: '2.5rem 1rem' }}>
                                                <h3 style={{ marginBottom: '0.35rem' }}>No accounts in this directory</h3>
                                                <p style={{ margin: 0 }}>{search ? 'No accounts match your search.' : 'Provision an account on the left to grant access.'}</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAdmins.map(admin => {
                                        const initials = String(admin.name || 'A').trim().slice(0, 2).toUpperCase();
                                        return (
                                            <tr key={admin._id}>
                                                <td>
                                                    <div className="admin-dir-user-cell">
                                                        <div className="admin-dir-avatar">{initials}</div>
                                                        <div>
                                                            <div className="admin-dir-user-name">{admin.name}</div>
                                                            <div className="admin-dir-user-email">{admin.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`badge ${admin.role === 'fitpass_admin' ? 'badge-active' : 'badge-completed'}`} style={{ textTransform: 'uppercase', fontSize: '0.72rem' }}>
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
                                                    <div className="admin-dir-actions">
                                                        {canManageAdmin(admin) && (
                                                            <button
                                                                className="btn btn-secondary"
                                                                onClick={() => handleEditClick(admin)}
                                                            >
                                                                <Edit2 size={12} />
                                                                <span>Edit</span>
                                                            </button>
                                                        )}
                                                        {canManageAdmin(admin) && (
                                                            <button
                                                                className="btn btn-danger"
                                                                onClick={() => handleDeleteAdmin(admin._id)}
                                                            >
                                                                <Trash2 size={12} />
                                                                <span>Revoke</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            {editingAdmin && (
                <div className="modal-overlay" onClick={() => setEditingAdmin(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                            <Edit2 size={20} style={{ color: 'var(--primary)' }} />
                            <span>Modify Administrator Settings</span>
                        </h3>
                        <form onSubmit={handleUpdateAdmin} style={{ display: 'grid', gap: '1rem', marginTop: '1.25rem' }}>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                                <label>Name</label>
                                <input
                                    className="input"
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="input-group" style={{ marginBottom: 0 }}>
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
                            <div className="input-group" style={{ marginBottom: 0 }}>
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
                            {user?.role === 'superadmin' && editingAdmin.role === 'fitpass_admin' && (
                                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-secondary, #faf9f4)', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={editFitPassPayoutAccess} onChange={event => setEditFitPassPayoutAccess(event.target.checked)} style={{ marginTop: 3 }} />
                                    <span><strong>Allow FitPass branch payouts</strong><br /><small style={{ color: 'var(--text-secondary)' }}>Grants this FitPass admin access to the branch payout ledger and settlement tools.</small></span>
                                </label>
                            )}
                            {editingAdmin.roleScope === 'fitpass_partner' && (
                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label>Partner branch</label>
                                    <select className="input" value={editBranchId} onChange={event => setEditBranchId(event.target.value)} required={scopeData.branches.some(branch => String(branch.gymId) === String(editingAdmin.gymId))}>
                                        <option value="">{scopeData.branches.some(branch => String(branch.gymId) === String(editingAdmin.gymId)) ? 'Select a branch' : 'No branches available'}</option>
                                        {scopeData.branches.filter(branch => String(branch.gymId) === String(editingAdmin.gymId)).map(branch => <option key={branch.id || branch._id} value={branch.id || branch._id}>{branch.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setEditingAdmin(null)} style={{ flex: 1 }}>Cancel</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminManagement;

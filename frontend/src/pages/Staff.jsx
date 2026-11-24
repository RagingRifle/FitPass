import { useState, useEffect, useContext } from 'react';
import { getStaff, createStaff, updateStaff, deleteStaff } from '../services/apiService';
import API from '../services/api';
import Modal from '../components/Modal';
import { AuthContext } from '../context/AuthContext';
import { Pencil, Trash2, Eye, EyeOff, ShieldCheck, Users, Search, X, RotateCcw, UserPlus, Dumbbell, Loader, Copy } from 'lucide-react';
import './Staff.css';

const Staff = () => {
    const { user, activeDivision } = useContext(AuthContext);
    const [activeTab, setActiveTab] = useState('directory');
    const [staffList, setStaffList] = useState([]);
    const [branchList, setBranchList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [issuedCredentials, setIssuedCredentials] = useState(null);
    
    // Filters
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'trainer',
        branchId: user?.branchId || '',
        trainerMemberLimit: 10,
        trainerPermissions: { assignWorkout: true, assignDiet: true, recordAssessment: true, scheduleClasses: true, manageClassBookings: true, setClassPricing: true }
    });
    const [error, setError] = useState('');

    const [trainerAssignments, setTrainerAssignments] = useState([]);
    const [assignmentMembers, setAssignmentMembers] = useState([]);
    const [assignmentMemberId, setAssignmentMemberId] = useState('');
    const [assignmentTrainerId, setAssignmentTrainerId] = useState('');

    useEffect(() => {
        fetchStaff();
        API.get('/branches').then(({ data }) => setBranchList(Array.isArray(data) ? data : data.branches || [])).catch(() => setBranchList([]));
    }, []);

    useEffect(() => {
        if (activeTab !== 'assignments') return;
        Promise.all([API.get('/trainer-assignments', { params: { limit: 100 } }), API.get('/members', { params: { page: 1, limit: 100 } })]).then(([assignments, members]) => {
            setTrainerAssignments(assignments.data?.data || []);
            setAssignmentMembers(Array.isArray(members.data) ? members.data : members.data?.data || []);
        }).catch(() => setError('Could not load trainer assignments or members.'));
    }, [activeTab]);

    const submitTrainerAssignment = async (event) => {
        event.preventDefault();
        setError('');
        try {
            await API.post('/trainer-assignments', { memberId: assignmentMemberId, trainerId: assignmentTrainerId });
            setAssignmentMemberId('');
            setAssignmentTrainerId('');
            const { data } = await API.get('/trainer-assignments', { params: { limit: 100 } });
            setTrainerAssignments(data?.data || []);
        } catch (err) { setError(err.response?.data?.message || 'Could not assign this member to the trainer.'); }
    };

    const removeTrainerAssignment = async (assignmentId) => {
        try {
            await API.delete(`/trainer-assignments/${assignmentId}`);
            setTrainerAssignments((items) => items.filter((item) => String(item.id || item._id) !== String(assignmentId)));
        } catch (err) { setError(err.response?.data?.message || 'Could not remove this trainer assignment.'); }
    };

    const fetchStaff = async () => {
        try {
            const data = await getStaff();
            setStaffList(data);
        } catch (error) {
            console.error('Error fetching staff list:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (staff = null) => {
        setError('');
        setShowPassword(false);
        if (staff) {
            setEditingStaff(staff);
            setFormData({
                name: staff.name,
                email: staff.email,
                password: '',
                role: staff.role,
                branchId: staff.branchId || '',
                trainerMemberLimit: staff.trainerMemberLimit || 10,
                trainerPermissions: staff.trainerPermissions || { assignWorkout: true, assignDiet: true, recordAssessment: true, scheduleClasses: true, manageClassBookings: true, setClassPricing: true }
            });
        } else {
            setEditingStaff(null);
            setFormData({
                name: '',
                email: '',
                password: '',
                role: 'trainer',
                branchId: user?.branchId || '',
                trainerMemberLimit: 10,
                trainerPermissions: { assignWorkout: true, assignDiet: true, recordAssessment: true, scheduleClasses: true, manageClassBookings: true, setClassPricing: true }
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const changedPassword = formData.password;
            const credentialEmail = formData.email.trim().toLowerCase();
            if (editingStaff) {
                const payload = { ...formData };
                if (!payload.password) {
                    delete payload.password;
                }
                await updateStaff(editingStaff._id, payload);
            } else {
                await createStaff(formData);
            }
            if (changedPassword) setIssuedCredentials({ email: credentialEmail, password: changedPassword, name: formData.name });
            fetchStaff();
            setIsModalOpen(false);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save staff member');
        }
    };

    const handleDelete = async (staffMember) => {
        if (staffMember._id === user?._id || staffMember.id === user?.id) {
            alert('You cannot delete your own account.');
            return;
        }
        if (window.confirm(`Are you sure you want to remove ${staffMember.name} from the gym staff?`)) {
            try {
                await deleteStaff(staffMember._id);
                fetchStaff();
            } catch (err) {
                alert(err.response?.data?.message || 'Error deleting staff member');
            }
        }
    };

    const filteredStaff = staffList.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || 
                              s.email.toLowerCase().includes(search.toLowerCase());
        const matchesRole = roleFilter ? s.role === roleFilter : true;
        return matchesSearch && matchesRole;
    });

    const trainerCount = staffList.filter(person => person.role === 'trainer').length;
    const adminCount = staffList.filter(person => person.role === 'admin').length;

    return (
        <div className="fade-in staff-page">
            <header className="staff-page__header">
                <div>
                    <div className="staff-page__eyebrow"><span /> TEAM OPERATIONS</div>
                    <h1 className="staff-page__title"><span className="staff-page__title-icon"><ShieldCheck size={19} /></span> Staff & access</h1>
                    <p className="staff-page__subtitle">Manage your team, balance trainer workloads, and set member care permissions.</p>
                </div>
                {activeTab === 'directory' && <button className="staff-page__add" onClick={() => handleOpenModal()}><UserPlus size={17} /> Add staff member</button>}
            </header>

            <section className="staff-page__stats" aria-label="Staff summary">
                <div className="staff-page__stat"><span className="staff-page__stat-icon staff-page__stat-icon--ink"><Users size={17} /></span><div><strong>{staffList.length}</strong><span>Team members</span></div></div>
                <div className="staff-page__stat"><span className="staff-page__stat-icon staff-page__stat-icon--yellow"><Dumbbell size={17} /></span><div><strong>{trainerCount}</strong><span>Trainers</span></div></div>
                <div className="staff-page__stat"><span className="staff-page__stat-icon staff-page__stat-icon--sand"><ShieldCheck size={17} /></span><div><strong>{adminCount}</strong><span>Administrators</span></div></div>
            </section>

            {/* TAB SELECTOR */}
            <div className="staff-page__tabs" role="tablist" aria-label="Staff management views">
                <button className={activeTab === 'directory' ? 'is-active' : ''} role="tab" aria-selected={activeTab === 'directory'} onClick={() => setActiveTab('directory')}>Directory <span>{staffList.length}</span></button>
                <button className={activeTab === 'assignments' ? 'is-active' : ''} role="tab" aria-selected={activeTab === 'assignments'} onClick={() => setActiveTab('assignments')}>Trainer assignments</button>
                <button className={activeTab === 'matrix' ? 'is-active' : ''} role="tab" aria-selected={activeTab === 'matrix'} onClick={() => setActiveTab('matrix')}>Role access</button>
            </div>

            {error && !isModalOpen && <div className="staff-page__error" role="alert">{error}</div>}

            {issuedCredentials && <div role="status" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', margin: '0 0 1rem', padding: '1rem 1.1rem', border: '1px solid #d9c36e', borderRadius: 12, background: '#fff9dc', color: '#352d14' }}>
                <div><strong>Login password set for {issuedCredentials.name}</strong><div style={{ marginTop: 5, fontSize: '.88rem' }}><span>{issuedCredentials.email}</span><span style={{ margin: '0 8px', color: '#8a7a48' }}>·</span><code style={{ fontSize: '.95rem' }}>{issuedCredentials.password}</code></div><small style={{ display: 'block', marginTop: 5 }}>Save this now. Passwords are stored securely and can’t be viewed again; reset it here if needed.</small></div>
                <div style={{ display: 'flex', gap: 8 }}><button className="btn btn-secondary" type="button" onClick={() => navigator.clipboard?.writeText(`${issuedCredentials.email}\t${issuedCredentials.password}`)}><Copy size={15} /> Copy login</button><button className="btn btn-secondary" type="button" aria-label="Dismiss credentials" onClick={() => setIssuedCredentials(null)}><X size={15} /></button></div>
            </div>}

            {activeTab === 'assignments' && <div className="card" style={{ padding: '1.5rem' }}>
                <h3>Member to trainer assignments</h3>
                <p style={{ color: 'var(--text-secondary)' }}>FitPass members receive trainer access only after an administrator assigns them. H4 branch members are assigned automatically as capacity allows.</p>
                <form onSubmit={submitTrainerAssignment} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                    <select className="input" value={assignmentMemberId} onChange={e => setAssignmentMemberId(e.target.value)} required style={{ flex: 1, minWidth: 220 }}><option value="">Select member</option>{assignmentMembers.map(member => <option key={member.id || member._id} value={member.id || member._id}>{member.name} · {member.phone}</option>)}</select>
                    <select className="input" value={assignmentTrainerId} onChange={e => setAssignmentTrainerId(e.target.value)} required style={{ flex: 1, minWidth: 220 }}><option value="">Select trainer</option>{staffList.filter(person => person.role === 'trainer').map(person => <option key={person.id || person._id} value={person.id || person._id}>{person.name} · {trainerAssignments.filter(item => String(item.trainerId) === String(person.id || person._id)).length}/{person.trainerMemberLimit || 10}</option>)}</select>
                    <button className="btn btn-primary" type="submit">Assign trainer</button>
                </form>
                <div className="table-container"><table className="table"><thead><tr><th>Member</th><th>Trainer</th><th>Assigned</th><th></th></tr></thead><tbody>{trainerAssignments.map(item => <tr key={item.id || item._id}><td>{item.member?.name || item.memberId}</td><td>{item.trainer?.name || item.trainerId}</td><td>{new Date(item.assignedDate).toLocaleDateString()}</td><td><button className="btn btn-danger" onClick={() => removeTrainerAssignment(item.id || item._id)}>Remove</button></td></tr>)}{trainerAssignments.length === 0 && <tr><td colSpan="4">No trainer assignments yet.</td></tr>}</tbody></table></div>
            </div>}

            {/* Directory Tab */}
            {activeTab === 'directory' && (
                <>
                    {/* Filter Bar */}
                    <div className="staff-page__toolbar">
                        <label className="staff-page__search"><Search size={18} /><input aria-label="Search staff by name or email" placeholder="Search staff by name or email" value={search} onChange={e => setSearch(e.target.value)} />{search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')}><X size={16} /></button>}</label>
                        <label className="staff-page__role-filter"><span>Role</span><select aria-label="Filter staff by role" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                            <option value="">All Roles</option>
                            <option value="trainer">Trainer</option>
                            <option value="receptionist">Receptionist</option>
                            <option value="admin">Admin</option>
                        </select></label>
                        <button className="staff-page__reset" type="button" onClick={() => { setSearch(''); setRoleFilter(''); }}><RotateCcw size={15} /> Reset</button>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '40vh' }}>
                            <Loader className="spinner" size={40} style={{ color: 'var(--primary-color)' }} />
                        </div>
                    ) : (
                        <div className="staff-page__table-wrap">
                            <table className="staff-page__table">
                                <thead>
                                    <tr>
                                        <th>Staff ID</th>
                                        <th>Name</th>
                                        <th>Email Address</th>
                                        <th>Role</th>
                                        <th>Created At</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStaff.length > 0 ? (
                                        filteredStaff.map((staff, idx) => (
                                            <tr key={staff._id || staff.id}>
                                                <td>
                                                    <span className="staff-page__staff-id">
                                                        {staff.displayId || staff.empid || `EMP${1001 + idx}`}
                                                    </span>
                                                </td>
                                                <td><span className="staff-page__person"><span className={`staff-page__avatar staff-page__avatar--${staff.role}`}>{staff.name?.trim()?.charAt(0)?.toUpperCase() || '?'}</span><strong>{staff.name}</strong></span></td>
                                                <td><span className="staff-page__email"><span>{staff.email}</span></span></td>
                                                <td>
                                                    <span className={`staff-page__role staff-page__role--${staff.role}`}>
                                                        {staff.role}
                                                    </span>
                                                </td>
                                                <td><span className="staff-page__date">{new Date(staff.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></td>
                                                <td>
                                                    <div className="staff-page__actions">
                                                        <button className="staff-page__action" aria-label={`Edit ${staff.name}`} title="Edit staff member"
                                                            onClick={() => handleOpenModal(staff)}
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button className="staff-page__action staff-page__action--delete" aria-label={`Remove ${staff.name}`}
                                                            onClick={() => handleDelete(staff)}
                                                            disabled={staff._id === user?._id || staff.id === user?.id}
                                                            title={staff._id === user?._id || staff.id === user?.id ? 'Cannot delete yourself' : ''}
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6">
                                                <div className="staff-page__empty">
                                                    <span><Users size={22} /></span><h3>No team members match</h3>
                                                    <p>Try another name or role, or reset the filters.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* Matrix Tab */}
            {activeTab === 'matrix' && (
                <div className="staff-page__access-guide">
                    <div className="staff-page__guide-heading"><div><span className="staff-page__eyebrow"><span /> PRESET ACCESS</span><h2>Access follows the role</h2><p>Core permissions are assigned by role. Trainer workloads and coaching permissions can be adjusted per staff member.</p></div></div>
                    <div className="staff-page__role-cards">
                        <article><span className="staff-page__role-mark staff-page__role-mark--admin"><ShieldCheck size={18} /></span><h3>Administrator</h3><p>Manage branch members, staff, operations, and reporting within the assigned organization scope.</p></article>
                        <article><span className="staff-page__role-mark staff-page__role-mark--trainer"><Dumbbell size={18} /></span><h3>Trainer</h3><p>Work with assigned members. Managers set a member cap and enable workout, diet, and assessment tasks.</p></article>
                        <article><span className="staff-page__role-mark staff-page__role-mark--desk"><Users size={18} /></span><h3>Receptionist</h3><p>Support member check-ins and front desk tasks without access to administrative settings.</p></article>
                    </div>
                </div>
            )}

            {/* Create/Edit Modal */}
            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title={editingStaff ? ` Edit Staff: ${editingStaff.name}` : ' Create New Staff Member'}
            >
                <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
                    {error && (
                        <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.9rem', fontWeight: '500' }}>
                            {error}
                        </div>
                    )}
                    
                    <div className="form-grid">
                        <div className="input-group">
                            <label>Full Name *</label>
                            <input 
                                className="input" 
                                type="text" 
                                value={formData.name} 
                                onChange={e => setFormData({ ...formData, name: e.target.value })} 
                                required 
                                placeholder="John Doe"
                            />
                        </div>
                        {formData.role === 'trainer' && !user?.branchId && <div className="input-group"><label>Assigned branch *</label><select className="input" value={formData.branchId || ''} onChange={e => setFormData({ ...formData, branchId: e.target.value })} required><option value="">Choose a branch</option>{branchList.map(branch => <option key={branch.id || branch._id} value={branch.id || branch._id}>{branch.name}</option>)}</select></div>}

                        <div className="input-group">
                            <label>Email Address *</label>
                            <input 
                                className="input" 
                                type="email" 
                                value={formData.email} 
                                onChange={e => setFormData({ ...formData, email: e.target.value })} 
                                required 
                                placeholder="john@example.com"
                            />
                        </div>

                        <div className="input-group">
                            <label>{editingStaff ? 'Set new password' : 'Password *'}</label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input 
                                    className="input" 
                                    type={showPassword ? 'text' : 'password'} 
                                    value={formData.password} 
                                    onChange={e => setFormData({ ...formData, password: e.target.value })} 
                                    required={!editingStaff} 
                                    placeholder={editingStaff ? 'Leave blank to keep current password' : 'Enter password'}
                                    style={{ paddingRight: '2.5rem' }}
                                    // Make sure it doesn't wrap weirdly
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', color: 'var(--text-muted)' }}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {editingStaff && <small style={{ display: 'block', marginTop: 5 }}>Current passwords can’t be retrieved. Enter a new one to reset it; the updated password will be shown once after saving.</small>}
                        </div>

                        <div className="input-group">
                            <label>System Role *</label>
                            <select 
                                className="input" 
                                value={formData.role} 
                                onChange={e => setFormData({ ...formData, role: e.target.value })}
                                required
                            >
                                <option value="trainer">Trainer / Instructor</option>
                                <option value="receptionist">Receptionist / Desk Staff</option>
                                <option value="admin">Administrator</option>
                            </select>
                        </div>
                    </div>

                    {formData.role === 'trainer' && <section style={{ marginTop: 16, padding: 16, border: '1px solid var(--border)', borderRadius: 10 }}>
                        <h4 style={{ marginTop: 0 }}>Trainer workload and access</h4>
                        <label className="input-group">Maximum assigned members
                            <input className="input" type="number" min="1" max="100" value={formData.trainerMemberLimit} onChange={e => setFormData({ ...formData, trainerMemberLimit: Number(e.target.value) })} />
                        </label>
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 12 }}>
                            {Object.entries({ assignWorkout: 'Assign workout plans', assignDiet: 'Assign diet plans', recordAssessment: 'Record body assessments', scheduleClasses: 'Schedule classes', manageClassBookings: 'Manage class rosters and attendance', ...(activeDivision === 'fitpass' ? { setClassPricing: 'Set FitCoin add-on prices' } : {}) }).map(([key, label]) => <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><input type="checkbox" checked={formData.trainerPermissions?.[key] !== false} onChange={e => setFormData({ ...formData, trainerPermissions: { ...formData.trainerPermissions, [key]: e.target.checked } })} />{label}</label>)}
                        </div>
                    </section>}

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                        {editingStaff ? 'Save Changes' : 'Create Account'}
                    </button>
                </form>
            </Modal>
        </div>
    );
};

export default Staff;

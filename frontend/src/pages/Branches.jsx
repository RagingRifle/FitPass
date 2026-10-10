import { useState, useEffect, useContext } from 'react';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';
import Modal from '../components/Modal';
import { Pencil, Trash2, QrCode } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

const emptyForm = { name: '', address: '', phone: '', email: '', managerName: '', fitPassEnabled: true };

const Branches = () => {
    const { activeDivision, changeActiveDivision, selectedGymId, changeSelectedGym, user, selectedBranchId } = useContext(AuthContext);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editBranch, setEditBranch] = useState(null);
    const [formData, setFormData] = useState(emptyForm);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [membersModal, setMembersModal] = useState(null);
    const [branchMembers, setBranchMembers] = useState([]);
    const [qrBranch, setQrBranch] = useState(null);

    const fetchBranches = async () => {
        try {
            console.log("Fetching branches for selectedGymId:", selectedGymId, "selectedBranchId:", selectedBranchId);
            const { data } = await API.get('/branches');
            console.log("Branches API returned:", data);
            setBranches(data);
        } catch (err) { 
            console.error("Error fetching branches:", err); 
        }
        finally { setLoading(false); }
    };

    useEffect(() => {
        const checkGymContext = async () => {
            if (user?.role === 'superadmin') {
                // We allow superadmins to view branches for the currently selected partner gym (e.g. H5)
                // Do not force revert to H4 here.
            }
            fetchBranches();
        };

        checkGymContext();
    }, [user, activeDivision, selectedGymId]);

    const openCreate = () => { setEditBranch(null); setFormData(emptyForm); setError(''); setIsModalOpen(true); };
    const openEdit = (b) => {
        setEditBranch(b);
        setFormData({
            name: b.name,
            address: b.address || '',
            phone: b.phone || '',
            email: b.email || '',
            managerName: b.managerName || '',
            fitPassEnabled: b.fitPassEnabled !== undefined ? b.fitPassEnabled : true
        });
        setError('');
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            if (editBranch) {
                await API.put(`/branches/${editBranch._id}`, formData);
            } else {
                await API.post('/branches', formData);
            }
            setIsModalOpen(false);
            fetchBranches();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save branch');
        } finally { setSubmitting(false); }
    };

    const handleDelete = async (branch) => {
        if (!window.confirm(`Delete branch "${branch.name}"? Members assigned to this branch will be unassigned.`)) return;
        try {
            await API.delete(`/branches/${branch._id}`);
            fetchBranches();
        } catch (err) { alert(err.response?.data?.message || 'Failed to delete'); }
    };

    const viewMembers = async (branch) => {
        setMembersModal(branch);
        try {
            const { data } = await API.get(`/branches/${branch._id}/members`);
            setBranchMembers(data);
        } catch { setBranchMembers([]); }
    };

    if (loading) return <div className="spinner"></div>;

    const canManageBranches = !selectedBranchId || user?.role === 'superadmin' || user?.role === 'h4_admin';
    const totalMembers = branches.reduce((s, b) => s + (b.memberCount || 0), 0);
    const totalRevenue = branches.reduce((s, b) => s + (b.totalRevenue || 0), 0);

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ marginBottom: '0.25rem' }}> Branch Management</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        {branches.length} branch(es) · {totalMembers} members · ₹{totalRevenue.toLocaleString()} total revenue
                    </p>
                </div>
                {canManageBranches && <button className="btn btn-primary" onClick={openCreate}>+ Add Branch</button>}
            </div>

            {branches.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon"></div>
                        <h3>No branches yet</h3>
                        <p>Create your first branch to start organising members by location.</p>
                        {canManageBranches && <button className="btn btn-primary" onClick={openCreate} style={{ marginTop: '1rem' }}>+ Add First Branch</button>}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {branches.map(branch => (
                        <div key={branch._id} className="glass" style={{ borderRadius: '16px', padding: '1.5rem', borderTop: '4px solid var(--primary-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <div>
                                    <h3 style={{ margin: '0 0 0.3rem', fontSize: '1.1rem', fontWeight: '800' }}> {branch.name}</h3>
                                    {branch.managerName && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}> {branch.managerName}</p>}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-end' }}>
                                    <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.72rem', fontWeight: '700' }}>
                                        Active
                                    </span>
                                    <span style={{
                                        background: branch.fitPassEnabled ? 'rgba(249,115,22,0.15)' : 'rgba(239,68,68,0.1)',
                                        color: branch.fitPassEnabled ? '#f97316' : '#ef4444',
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '8px',
                                        fontSize: '0.72rem',
                                        fontWeight: '700'
                                    }}>
                                        {branch.fitPassEnabled ? ' FitPass' : ' No FitPass'}
                                    </span>
                                </div>
                            </div>

                            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                {branch.address && <span> {branch.address}</span>}
                                {branch.phone && <span> {branch.phone}</span>}
                                {branch.email && <span> {branch.email}</span>}
                            </div>

                            {/* Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                                <div style={{ background: 'var(--primary-light)', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                                    <div style={{ fontWeight: '800', fontSize: '1.25rem', color: 'var(--primary-color)' }}>{branch.memberCount || 0}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Members</div>
                                </div>
                                <div style={{ background: 'rgba(16,185,129,0.08)', borderRadius: '10px', padding: '0.75rem', textAlign: 'center' }}>
                                    <div style={{ fontWeight: '800', fontSize: '1.1rem', color: '#10b981' }}>₹{(branch.totalRevenue || 0).toLocaleString()}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Revenue</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button onClick={() => viewMembers(branch)} className="btn btn-secondary" style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem', background: 'var(--primary-light)', color: 'var(--primary-color)' }}>
                                     Members
                                </button>
                                {branch.fitPassEnabled && (
                                    <button onClick={() => setQrBranch(branch)} className="btn btn-secondary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', borderRadius: '8px' }} title="Print Branch QR Code">
                                        <QrCode size={16} />
                                    </button>
                                )}
                                {canManageBranches && (
                                    <>
                                        <button onClick={() => openEdit(branch)} className="btn" style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)', background: 'transparent' }}>
                                            <Pencil size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(branch)} className="btn btn-danger" style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', borderRadius: '8px' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Branch Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editBranch ? 'Edit Branch' : 'Add New Branch'}>
                <form onSubmit={handleSubmit}>
                    {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
                    <div className="input-group">
                        <label>Branch Name *</label>
                        <input className="input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g. Downtown Branch" />
                    </div>
                    <div className="input-group">
                        <label>Address</label>
                        <input className="input" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Full address" />
                    </div>
                    <div className="form-grid">
                        <div className="input-group">
                            <label>Phone</label>
                            <input className="input" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="Contact number" />
                        </div>
                        <div className="input-group">
                            <label>Email</label>
                            <input className="input" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="branch@email.com" />
                        </div>
                    </div>
                    <div className="input-group">
                        <label>Branch Manager</label>
                        <input className="input" value={formData.managerName} onChange={e => setFormData({ ...formData, managerName: e.target.value })} placeholder="Manager's name" />
                    </div>
                    <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                        <input
                            type="checkbox"
                            id="fitPassEnabled"
                            checked={formData.fitPassEnabled}
                            onChange={e => setFormData({ ...formData, fitPassEnabled: e.target.checked })}
                            style={{ width: 'auto', margin: 0 }}
                        />
                        <label htmlFor="fitPassEnabled" style={{ marginBottom: 0, cursor: 'pointer', fontWeight: '600' }}>
                            Willing / Agreed for FitPass (FitPrime) Check-Ins
                        </label>
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }} disabled={submitting}>
                        {submitting ? 'Saving...' : editBranch ? ' Update Branch' : ' Create Branch'}
                    </button>
                </form>
            </Modal>

            {/* Branch Members Modal */}
            <Modal isOpen={!!membersModal} onClose={() => { setMembersModal(null); setBranchMembers([]); }} title={` Members — ${membersModal?.name}`}>
                {branchMembers.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon"></div>
                        <h3>No members assigned</h3>
                        <p>No members have been assigned to this branch yet.</p>
                    </div>
                ) : (
                    <table>
                        <thead><tr><th>Name</th><th>Phone</th><th>Plan</th><th>Status</th></tr></thead>
                        <tbody>
                            {branchMembers.map(m => (
                                <tr key={m._id}>
                                    <td style={{ fontWeight: '600' }}>{m.name}</td>
                                    <td>{m.phone}</td>
                                    <td>{m.planId?.name || '—'}</td>
                                    <td><span style={{ background: m.status === 'Active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: m.status === 'Active' ? '#10b981' : '#ef4444', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700' }}>{m.status}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Modal>

            {/* QR Code Modal */}
            {qrBranch && (
                <div className="modal-overlay" onClick={() => setQrBranch(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: '350px' }}>
                        <h3>{qrBranch.name} Check-In</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            Print or display this QR code at this branch's reception. Members will scan it to check in.
                        </p>
                        <div style={{ background: '#fff', padding: '1.5rem', display: 'inline-block', borderRadius: '12px' }}>
                            <QRCodeCanvas 
                                id="branch-qr"
                                value={JSON.stringify({ gymId: qrBranch.gymId, branchId: qrBranch._id || qrBranch.id, gymName: qrBranch.name })}
                                size={220}
                                level="H"
                            />
                        </div>
                        <div style={{ marginTop: '2rem', display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-primary" onClick={() => {
                                const canvas = document.getElementById('branch-qr');
                                const url = canvas.toDataURL("image/png");
                                const link = document.createElement('a');
                                link.download = `QR - ${qrBranch.name}.png`;
                                link.href = url;
                                link.click();
                            }} style={{ flex: 1 }}>
                                Download
                            </button>
                            <button className="btn btn-secondary" onClick={() => setQrBranch(null)} style={{ flex: 1 }}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Branches;

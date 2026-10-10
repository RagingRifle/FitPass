import { useState, useEffect } from 'react';
import API from '../services/api';
import Modal from '../components/Modal';

const FreezeManagement = () => {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [freezeModal, setFreezeModal] = useState(null); // { member }
    const [historyModal, setHistoryModal] = useState(null); // { name, history }
    const [reason, setReason] = useState('');
    const [actionLoading, setActionLoading] = useState({});
    const [search, setSearch] = useState('');

    const fetchMembers = async () => {
        try {
            const { data } = await API.get('/members');
            setMembers(data.members || []);
        } catch (err) {
            console.error('Error fetching members:', err);
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchMembers(); }, []);

    const handleFreeze = async () => {
        if (!freezeModal) return;
        setActionLoading(prev => ({ ...prev, [freezeModal._id]: 'freezing' }));
        try {
            await API.post(`/members/${freezeModal._id}/freeze`, { reason });
            setFreezeModal(null);
            setReason('');
            fetchMembers();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to freeze');
        } finally { setActionLoading(prev => ({ ...prev, [freezeModal._id]: null })); }
    };

    const handleUnfreeze = async (member) => {
        if (!window.confirm(`Unfreeze ${member.name}? Expiry will be extended by days frozen.`)) return;
        setActionLoading(prev => ({ ...prev, [member._id]: 'unfreezing' }));
        try {
            const { data } = await API.post(`/members/${member._id}/unfreeze`);
            alert(` ${member.name} unfrozen!\n Expiry extended by ${data.daysAdded} day(s).\n New expiry: ${new Date(data.newExpiryDate).toLocaleDateString()}`);
            fetchMembers();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to unfreeze');
        } finally { setActionLoading(prev => ({ ...prev, [member._id]: null })); }
    };

    const viewHistory = async (member) => {
        try {
            const { data } = await API.get(`/members/${member._id}/freeze-history`);
            setHistoryModal(data);
        } catch {
            alert('Failed to fetch freeze history');
        }
    };

    const filtered = members.filter(m =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.phone.includes(search)
    );

    const statusStyle = (status) => {
        if (status === 'Frozen') return { background: 'var(--primary-muted)', color: 'var(--primary-color)' };
        if (status === 'Active') return { background: 'rgba(16,185,129,0.15)', color: '#10b981' };
        return { background: 'rgba(239,68,68,0.15)', color: '#ef4444' };
    };

    if (loading) return <div className="spinner"></div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ marginBottom: '0.25rem' }}> Membership Freeze</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        Frozen: {members.filter(m => m.status === 'Frozen').length} member(s)
                    </p>
                </div>
            </div>

            <input
                className="input"
                style={{ marginBottom: '1.5rem', maxWidth: '350px' }}
                placeholder=" Search by name or phone..."
                value={search}
                onChange={e => setSearch(e.target.value)}
            />

            <div className="card" style={{ padding: 0 }}>
                <table>
                    <thead>
                        <tr>
                            <th>Member</th>
                            <th>Phone</th>
                            <th>Plan Expiry</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(member => {
                            const loading = actionLoading[member._id];
                            const isFrozen = member.status === 'Frozen';
                            return (
                                <tr key={member._id}>
                                    <td style={{ fontWeight: '600' }}>{member.name}</td>
                                    <td>{member.phone}</td>
                                    <td>{new Date(member.expiryDate).toLocaleDateString()}</td>
                                    <td>
                                        <span style={{ ...statusStyle(member.status), padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: '700' }}>
                                            {member.status === 'Frozen' ? ' Frozen' : member.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {isFrozen ? (
                                                <button
                                                    onClick={() => handleUnfreeze(member)}
                                                    disabled={!!loading}
                                                    className="btn"
                                                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px' }}
                                                >
                                                    {loading === 'unfreezing' ? '...' : ' Unfreeze'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => { setFreezeModal(member); setReason(''); }}
                                                    disabled={!!loading || member.status === 'Expired'}
                                                    className="btn"
                                                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', background: 'var(--primary-muted)', color: 'var(--primary-color)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '8px', opacity: member.status === 'Expired' ? 0.5 : 1 }}
                                                >
                                                    {loading === 'freezing' ? '...' : ' Freeze'}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => viewHistory(member)}
                                                className="btn"
                                                style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                                            >
                                                 History
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Freeze Confirm Modal */}
            <Modal isOpen={!!freezeModal} onClose={() => setFreezeModal(null)} title={` Freeze ${freezeModal?.name}'s Membership`}>
                <div>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                        The membership will be paused. When unfrozen, the expiry date will be extended by the number of frozen days.
                    </p>
                    <div className="input-group">
                        <label>Reason (optional)</label>
                        <select className="input" value={reason} onChange={e => setReason(e.target.value)}>
                            <option value="">Select reason...</option>
                            <option value="Vacation"> Vacation</option>
                            <option value="Injury"> Injury</option>
                            <option value="Travel"> Travel</option>
                            <option value="Personal Emergency"> Personal Emergency</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                        <button onClick={() => setFreezeModal(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                        <button onClick={handleFreeze} className="btn btn-primary" style={{ flex: 1, background: 'var(--primary-color)' }}> Freeze Now</button>
                    </div>
                </div>
            </Modal>

            {/* History Modal */}
            <Modal isOpen={!!historyModal} onClose={() => setHistoryModal(null)} title={` Freeze History — ${historyModal?.name}`}>
                {historyModal?.freezeHistory?.length > 0 ? (
                    <table>
                        <thead><tr><th>Frozen On</th><th>Unfrozen On</th><th>Reason</th><th>Days Added</th></tr></thead>
                        <tbody>
                            {historyModal.freezeHistory.map((f, i) => (
                                <tr key={i}>
                                    <td>{new Date(f.freezeDate).toLocaleDateString()}</td>
                                    <td>{f.unfreezeDate ? new Date(f.unfreezeDate).toLocaleDateString() : <span style={{ color: 'var(--primary-color)' }}> Currently Frozen</span>}</td>
                                    <td>{f.reason || '—'}</td>
                                    <td>{f.daysAdded || (f.unfreezeDate ? '0' : '—')}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No freeze history for this member.</p>
                )}
            </Modal>
        </div>
    );
};

export default FreezeManagement;

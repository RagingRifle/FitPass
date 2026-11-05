import { useState, useEffect } from 'react';
import API from '../services/api';
import Modal from '../components/Modal';
import ResetFiltersButton from '../components/ResetFiltersButton';

const FreezeManagement = () => {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [freezeModal, setFreezeModal] = useState(null); // { member }
    const [historyModal, setHistoryModal] = useState(null); // { name, history }
    const [reason, setReason] = useState('');
    const [freezeMode, setFreezeMode] = useState('manual');
    const [resumeAt, setResumeAt] = useState('');
    const [actionLoading, setActionLoading] = useState({});
    const [search, setSearch] = useState('');

    const fetchMembers = async () => {
        try {
            const { data } = await API.get('/members', { params: { page: 1, limit: 1000 } });
            const firstPage = Array.isArray(data) ? data : (data.members || data.data || []);
            const pages = Math.min(Number(data?.pages) || 1, 10);
            const remaining = pages > 1 ? await Promise.all(Array.from({ length: pages - 1 }, (_, index) => API.get('/members', { params: { page: index + 2, limit: 1000 } }))) : [];
            setMembers([...firstPage, ...remaining.flatMap(result => Array.isArray(result.data) ? result.data : (result.data.members || result.data.data || []))]);
        } catch (err) {
            console.error('Error fetching members:', err);
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchMembers(); }, []);

    const handleFreeze = async () => {
        if (!freezeModal) return;
        setActionLoading(prev => ({ ...prev, [freezeModal._id]: 'freezing' }));
        try {
            await API.post(`/members/${freezeModal._id}/freeze`, {
                reason,
                mode: freezeMode,
                ...(freezeMode === 'scheduled' && resumeAt ? { scheduledUnfreezeAt: new Date(resumeAt).toISOString() } : {})
            });
            setFreezeModal(null);
            setReason('');
            setFreezeMode('manual');
            setResumeAt('');
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
            alert(` ${member.name} unfrozen!\n Paused for ${data.daysAdded} day(s).\n New expiry: ${data.newExpiryDate ? new Date(data.newExpiryDate).toLocaleDateString() : 'Not set'}`);
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
        [m.registrationNumber, m.displayId, m.name, m.phone].some(value => String(value || '').toLowerCase().includes(search.trim().toLowerCase()))
    );

    const statusStyle = (status) => {
            if (status === 'Frozen') return { background: '#F4C900', color: '#211B00' };
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

            <div style={{ display: 'flex', gap: '.75rem', alignItems: 'end', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <label style={{ display: 'grid', gap: 6, flex: '1 1 280px', maxWidth: 420 }}>Search member<input className="input" type="search" placeholder="Member ID (MEM1001), name, or phone" value={search} onChange={e => setSearch(e.target.value)} /></label>
                <ResetFiltersButton onClick={() => setSearch('')} />
            </div>

            <div className="card" style={{ padding: 0 }}>
                <table>
                    <thead>
                        <tr>
                            <th>Member ID</th>
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
                                    <td>{member.registrationNumber || member.displayId || '—'}</td>
                                    <td style={{ fontWeight: '600' }}>{member.name}</td>
                                    <td>{member.phone}</td>
                            <td>{isFrozen ? (member.scheduledUnfreezeAt ? `Resume ${new Date(member.scheduledUnfreezeAt).toLocaleString()}` : 'Paused until released') : (member.expiryDate ? new Date(member.expiryDate).toLocaleDateString() : '—')}</td>
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
                                                    onClick={() => { setFreezeModal(member); setReason(''); setFreezeMode('manual'); setResumeAt(''); }}
                                                    disabled={!!loading || member.status === 'Expired'}
                                                    className="btn"
                                                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', background: '#F4C900', color: '#211B00', border: '1px solid #B18F00', borderRadius: '8px', fontWeight: 700, opacity: member.status === 'Expired' ? 0.5 : 1 }}
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
            <Modal isOpen={!!freezeModal} onClose={() => setFreezeModal(null)} title={`Pause ${freezeModal?.name}'s Membership`}>
                <div>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                        Choose a manual hold for payment or account issues, or schedule an automatic resume date for temporary leave.
                    </p>
                    <div className="input-group">
                        <label>Pause type</label>
                        <select className="input" value={freezeMode} onChange={event => setFreezeMode(event.target.value)}>
                            <option value="manual">Manual release (resume when I unfreeze)</option>
                            <option value="scheduled">Automatic resume at a chosen time</option>
                        </select>
                    </div>
                    {freezeMode === 'scheduled' && <div className="input-group">
                        <label>Resume date and time</label>
                        <input className="input" type="datetime-local" required value={resumeAt} onChange={event => setResumeAt(event.target.value)} min={new Date(Date.now() + 60000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} />
                        <small style={{ color: 'var(--text-secondary)' }}>The membership resumes automatically, with remaining membership time restored.</small>
                    </div>}
                    <div className="input-group">
                        <label>Reason (optional)</label>
                        <select className="input" value={reason} onChange={e => setReason(e.target.value)}>
                            <option value="">Select reason...</option>
                            <option value="Payment pending">Payment pending</option>
                            <option value="Vacation"> Vacation</option>
                            <option value="Injury"> Injury</option>
                            <option value="Travel"> Travel</option>
                            <option value="Personal Emergency"> Personal Emergency</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                        <button onClick={() => setFreezeModal(null)} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
                        <button onClick={handleFreeze} disabled={freezeMode === 'scheduled' && !resumeAt} className="btn btn-primary" style={{ flex: 1, background: '#F4C900', color: '#211B00', border: '1px solid #B18F00', fontWeight: 800 }}>{freezeMode === 'scheduled' ? 'Pause & Schedule Resume' : 'Pause Until Released'}</button>
                    </div>
                </div>
            </Modal>

            {/* History Modal */}
            <Modal isOpen={!!historyModal} onClose={() => setHistoryModal(null)} title={` Freeze History — ${historyModal?.name}`}>
                {historyModal?.freezeHistory?.length > 0 ? (
                    <table>
                    <thead><tr><th>Frozen On</th><th>Resume Type</th><th>Scheduled Resume</th><th>Unfrozen On</th><th>Reason</th><th>Days Paused</th></tr></thead>
                        <tbody>
                            {historyModal.freezeHistory.map((f, i) => (
                                <tr key={i}>
                                    <td>{new Date(f.freezeDate).toLocaleDateString()}</td>
                                    <td>{f.mode === 'scheduled' ? 'Automatic' : 'Manual'}</td>
                                    <td>{f.scheduledUnfreezeAt ? new Date(f.scheduledUnfreezeAt).toLocaleString() : '—'}</td>
                                    <td>{f.unfreezeDate ? `${new Date(f.unfreezeDate).toLocaleDateString()}${f.autoUnfrozen ? ' (automatic)' : ''}` : <span style={{ color: '#9a6b00' }}>Currently paused</span>}</td>
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

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import Modal from '../components/Modal';
import { Pencil, Trash2, UserPlus, X } from 'lucide-react';

const STATUSES = ['New', 'Contacted', 'Interested', 'Converted', 'Lost'];
const SOURCES = ['Walk-in', 'Instagram', 'Facebook', 'Referral', 'Google', 'WhatsApp', 'Other'];

const STATUS_COLORS = {
    New: { bg: 'var(--primary-muted)', text: 'var(--primary-color)' },
    Contacted: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
    Interested: { bg: 'rgba(14,165,233,0.15)', text: '#0ea5e9' },
    Converted: { bg: 'rgba(16,185,129,0.15)', text: '#10b981' },
    Lost: { bg: 'rgba(107,114,128,0.15)', text: '#6b7280' },
};


const emptyForm = { name: '', phone: '', email: '', source: 'Walk-in', interestedPlan: '', notes: '', followUpDate: '', assignedTo: '' };

const Leads = () => {
    const navigate = useNavigate();
    const [leads, setLeads] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editLead, setEditLead] = useState(null);
    const [formData, setFormData] = useState(emptyForm);
    const [filterStatus, setFilterStatus] = useState('');
    const [search, setSearch] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const fetchAll = async () => {
        try {
            const [leadsRes, summaryRes] = await Promise.all([
                API.get('/leads'),
                API.get('/leads/summary')
            ]);
            const leadsList = Array.isArray(leadsRes.data) ? leadsRes.data : (leadsRes.data?.data || []);
            const summaryData = summaryRes.data?.data || summaryRes.data || null;
            setLeads(leadsList);
            setSummary(summaryData);
        } catch (err) { 
            console.error(err);
            setLeads([]);
            setSummary(null);
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchAll(); }, []);

    const openCreate = () => { setEditLead(null); setFormData(emptyForm); setError(''); setIsModalOpen(true); };
    const openEdit = (lead) => {
        setEditLead(lead);
        setFormData({
            name: lead.name, phone: lead.phone, email: lead.email || '',
            source: lead.source, interestedPlan: lead.interestedPlan || '',
            notes: lead.notes || '',
            followUpDate: lead.followUpDate ? lead.followUpDate.slice(0, 10) : '',
            assignedTo: lead.assignedTo || ''
        });
        setError('');
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            if (editLead) {
                await API.put(`/leads/${editLead._id}`, formData);
            } else {
                await API.post('/leads', formData);
            }
            setIsModalOpen(false);
            fetchAll();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save lead');
        } finally { setSubmitting(false); }
    };

    const updateStatus = async (lead, newStatus) => {
        try {
            await API.put(`/leads/${lead._id}`, { status: newStatus });
            fetchAll();
        } catch { alert('Failed to update status'); }
    };

    const deleteLead = async (id) => {
        if (!window.confirm('Delete this lead?')) return;
        try { await API.delete(`/leads/${id}`); fetchAll(); }
        catch { alert('Failed to delete'); }
    };

    const convertToMember = (lead) => {
        const params = new URLSearchParams({
            convertLeadId: lead._id,
            name: lead.name || '',
            phone: lead.phone || '',
            email: lead.email || '',
            gymId: lead.gymId || '',
            branchId: lead.branchId || '',
            interestedPlan: lead.interestedPlan || ''
        });
        navigate(`/members?${params.toString()}`);
    };

    const safeLeads = Array.isArray(leads) ? leads : [];

    const filtered = safeLeads.filter(l => {
        const matchStatus = !filterStatus || l.status === filterStatus;
        const matchSearch = !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.phone.includes(search);
        return matchStatus && matchSearch;
    });

    const todayStr = new Date().toISOString().slice(0, 10);

    if (loading) return <div className="spinner"></div>;

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h2 style={{ marginBottom: '0.25rem' }}> Lead Management</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{safeLeads.length} total leads · {summary?.followUpDue || 0} follow-up(s) due</p>
                </div>
                <button className="btn btn-primary" onClick={openCreate}>+ Add Lead</button>
            </div>

            {/* Pipeline Summary Cards */}
            {summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                    {STATUSES.map(s => {
                        const statusCounts = Array.isArray(summary.statusCounts) ? summary.statusCounts : [];
                        const count = statusCounts.find(x => x._id === s)?.count || 0;
                        const col = STATUS_COLORS[s] || { bg: 'var(--primary-muted)', text: 'var(--primary-color)' };
                        return (
                            <div key={s} className="card"
                                onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
                                style={{ cursor: 'pointer', padding: '1rem', border: filterStatus === s ? `2px solid ${col.text}` : '2px solid transparent', transition: 'all 0.2s' }}>
                                <div style={{ fontWeight: '800', fontSize: '1.5rem', color: col.text }}>{count}</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{s}</div>
                            </div>
                        );
                    })}
                    <div className="card" style={{ padding: '1rem', borderLeft: '4px solid #10b981' }}>
                        <div style={{ fontSize: '1.5rem' }}></div>
                        <div style={{ fontWeight: '800', fontSize: '1.5rem', color: '#10b981' }}>{summary.conversionRate || 0}%</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Conversion</div>
                    </div>
                </div>
            )}

            {/* Source breakdown */}
            {Array.isArray(summary?.sourceCounts) && summary.sourceCounts.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                    {summary.sourceCounts.map(s => (
                        <span key={s._id} style={{ background: 'var(--primary-light)', color: 'var(--primary-color)', padding: '0.3rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '600' }}>
                            {s._id}: {s.count}
                        </span>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <input className="input" style={{ maxWidth: '280px', margin: 0 }} placeholder=" Search name / phone..." value={search} onChange={e => setSearch(e.target.value)} />
                {filterStatus && (
                    <button onClick={() => setFilterStatus('')} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
                        Clear Filter <X size={14} />
                    </button>
                )}
            </div>

            {/* Leads Table */}
            <div className="card" style={{ padding: 0, overflow: 'auto' }}>
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Source</th>
                            <th>Interested In</th>
                            <th>Follow-up</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={7}>
                                    <div className="empty-state">
                                        <div className="empty-state-icon"></div>
                                        <h3>No leads found</h3>
                                        <p>Try adjusting your search query or pipeline filter.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : filtered.map(lead => {
                            const col = STATUS_COLORS[lead.status] || { bg: 'var(--primary-muted)', text: 'var(--primary-color)' };
                            const followUp = lead.followUpDate ? lead.followUpDate.slice(0, 10) : null;
                            const isOverdue = followUp && followUp < todayStr && !['Converted', 'Lost'].includes(lead.status);
                            return (
                                <tr key={lead._id}>
                                    <td style={{ fontWeight: '600' }}>{lead.name}</td>
                                    <td>{lead.phone}</td>
                                    <td><span style={{ background: 'var(--primary-light)', color: 'var(--primary-color)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.78rem' }}>{lead.source}</span></td>
                                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{lead.interestedPlan || '—'}</td>
                                    <td>
                                        {followUp ? (
                                            <span style={{ color: isOverdue ? '#ef4444' : 'var(--text-primary)', fontWeight: isOverdue ? '700' : '400', fontSize: '0.85rem' }}>
                                                {isOverdue ? ' ' : ''}{new Date(followUp).toLocaleDateString()}
                                            </span>
                                        ) : '—'}
                                    </td>
                                    <td>
                                        <select
                                            value={lead.status}
                                            onChange={e => updateStatus(lead, e.target.value)}
                                            style={{ background: col.bg, color: col.text, border: 'none', borderRadius: '8px', padding: '0.25rem 0.5rem', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer' }}
                                        >
                                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                            {lead.status === 'Converted' ? (
                                                <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '700', whiteSpace: 'nowrap' }}> Converted</span>
                                            ) : (
                                                <button onClick={() => convertToMember(lead)} className="btn" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
                                                    <UserPlus size={14} /> Convert
                                                </button>
                                            )}
                                            <button onClick={() => openEdit(lead)} className="btn" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                <Pencil size={14} /> Edit
                                            </button>
                                            <button onClick={() => deleteLead(lead._id)} className="btn" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', display: 'flex', alignItems: 'center' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Add / Edit Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editLead ? ' Edit Lead' : ' Add New Lead'}>
                <form onSubmit={handleSubmit}>
                    {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
                    <div className="form-grid">
                        <div className="input-group">
                            <label>Name *</label>
                            <input className="input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder="Full name" />
                        </div>
                        <div className="input-group">
                            <label>Phone *</label>
                            <input className="input" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} required placeholder="Phone number" />
                        </div>
                    </div>
                    <div className="form-grid">
                        <div className="input-group">
                            <label>Email</label>
                            <input className="input" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="Email (optional)" />
                        </div>
                        <div className="input-group">
                            <label>Source</label>
                            <select className="input" value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })}>
                                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="form-grid">
                        <div className="input-group">
                            <label>Interested Plan</label>
                            <input className="input" value={formData.interestedPlan} onChange={e => setFormData({ ...formData, interestedPlan: e.target.value })} placeholder="e.g. Monthly, Annual" />
                        </div>
                        <div className="input-group">
                            <label>Follow-up Date</label>
                            <input className="input" type="date" value={formData.followUpDate} onChange={e => setFormData({ ...formData, followUpDate: e.target.value })} />
                        </div>
                    </div>
                    <div className="input-group">
                        <label>Notes</label>
                        <textarea className="input" rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Any notes about this lead..." />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }} disabled={submitting}>
                        {submitting ? 'Saving...' : editLead ? ' Update Lead' : ' Add Lead'}
                    </button>
                </form>
            </Modal>
        </div>
    );
};

export default Leads;

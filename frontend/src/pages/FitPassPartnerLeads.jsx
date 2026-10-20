import { useState, useEffect, useContext, useCallback } from 'react';
import { Target, User, Phone, Calendar, Tag, ChevronLeft, ChevronRight, RefreshCw, Info } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import API from '../services/api';

// ─── Badge component ─────────────────────────────────────────────────────────
const statusColors = {
    New:       '#1976D2',
    Contacted: '#FEDF1E',
    Interested:'#7B1FA2',
    Converted: '#2E7D32',
    Lost:      '#C62828',
};

const Badge = ({ status }) => {
    const color = statusColors[status] || '#A39686';
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.2rem 0.65rem',
            borderRadius: '999px',
            fontSize: '0.72rem',
            fontWeight: 700,
            background: `${color}18`,
            color,
            letterSpacing: '0.02em',
        }}>
            {status || '—'}
        </span>
    );
};

// ─── Format helpers ───────────────────────────────────────────────────────────
const fmtDate = (ts) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ─── Main page ────────────────────────────────────────────────────────────────
const FitPassPartnerLeads = () => {
    const { user } = useContext(AuthContext);

    const [leads, setLeads]       = useState([]);
    const [total, setTotal]       = useState(0);
    const [page, setPage]         = useState(1);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const PAGE_SIZE = 25;
    const totalPages = Math.ceil(total / PAGE_SIZE);

    const fetchLeads = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            if (statusFilter) params.set('status', statusFilter);

            const { data } = await API.get(`/leads?${params}`);
            // data is an array (existing controller returns array)
            const all = Array.isArray(data) ? data : (data.leads || []);
            setTotal(all.length);
            const start = (page - 1) * PAGE_SIZE;
            setLeads(all.slice(start, start + PAGE_SIZE));
        } catch (err) {
            setError(err.response?.data?.message || 'Could not load leads.');
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter]);

    useEffect(() => {
        fetchLeads();
    }, [fetchLeads]);

    const STATUSES = ['New', 'Contacted', 'Interested', 'Converted', 'Lost'];

    return (
        <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto' }}>

            {/* ── Page header ── */}
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                    <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(240,160,32,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Target size={20} color="var(--primary)" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                            FitPass Leads
                        </h1>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                            Read-only — people who expressed interest in your gym via FitPass
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Info banner ── */}
            <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                background: 'rgba(25,118,210,0.08)',
                border: '1px solid rgba(25,118,210,0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '0.875rem 1.125rem',
                marginBottom: '1.25rem',
                fontSize: '0.82rem',
                color: '#1976D2',
            }}>
                <Info size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                <span>
                    This is a <strong>read-only</strong> view. Lead creation, editing, and deletion are managed
                    by FitPass administrators. Contact your FitPass admin to update lead details.
                </span>
            </div>

            {/* ── Stats & filter row ── */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '0.875rem 1.25rem',
                marginBottom: '1.25rem',
            }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {total} lead{total !== 1 ? 's' : ''} for your gym
                </span>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => { setStatusFilter(''); setPage(1); }}
                        style={{
                            padding: '0.3rem 0.85rem',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            border: `1.5px solid ${statusFilter === '' ? 'var(--primary)' : 'var(--border)'}`,
                            background: statusFilter === '' ? 'var(--primary)' : 'transparent',
                            color: statusFilter === '' ? 'var(--bg)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                        }}
                    >
                        All
                    </button>
                    {STATUSES.map(s => (
                        <button
                            key={s}
                            onClick={() => { setStatusFilter(s); setPage(1); }}
                            style={{
                                padding: '0.3rem 0.85rem',
                                borderRadius: '999px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                border: `1.5px solid ${statusFilter === s ? statusColors[s] : 'var(--border)'}`,
                                background: statusFilter === s ? `${statusColors[s]}20` : 'transparent',
                                color: statusFilter === s ? statusColors[s] : 'var(--text-secondary)',
                                cursor: 'pointer',
                            }}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Table ── */}
            <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
            }}>
                {error && (
                    <div style={{ padding: '1rem 1.5rem', color: '#C62828', background: '#C6282818', fontSize: '0.875rem' }}>
                        {error}
                    </div>
                )}

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                {['Name', 'Phone', 'Lead Date', 'Source', 'Status'].map(h => (
                                    <th key={h} style={{
                                        padding: '0.75rem 1rem',
                                        textAlign: 'left',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        color: 'var(--text-secondary)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        whiteSpace: 'nowrap',
                                        background: 'var(--bg-tertiary, var(--bg-secondary))',
                                    }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
                                        <div>Loading leads…</div>
                                    </td>
                                </tr>
                            ) : leads.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <Target size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                                        <div>No leads found for your gym yet.</div>
                                        <div style={{ fontSize: '0.8rem', marginTop: 4 }}>Leads will appear here once FitPass members express interest.</div>
                                    </td>
                                </tr>
                            ) : leads.map((lead, idx) => (
                                <tr key={lead._id || idx} style={{
                                    borderBottom: '1px solid var(--border)',
                                    transition: 'background 0.15s',
                                }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary, rgba(255,255,255,0.03))'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{
                                                width: 30,
                                                height: 30,
                                                borderRadius: '50%',
                                                background: 'rgba(240,160,32,0.15)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                color: 'var(--primary)',
                                                flexShrink: 0,
                                            }}>
                                                {(lead.name || '?').charAt(0).toUpperCase()}
                                            </div>
                                            {lead.name || '—'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Phone size={13} />
                                            {lead.phone || '—'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Calendar size={13} />
                                            {fmtDate(lead.createdAt)}
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Tag size={13} />
                                            {lead.source || '—'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <Badge status={lead.status} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* ── Pagination ── */}
                {totalPages > 1 && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.875rem 1.25rem',
                        borderTop: '1px solid var(--border)',
                        fontSize: '0.82rem',
                        color: 'var(--text-secondary)',
                    }}>
                        <span>Showing {leads.length} of {total} leads</span>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                style={{ padding: '0.35rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Page {page} / {totalPages}</span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                style={{ padding: '0.35rem 0.6rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1 }}
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Spin keyframe ── */}
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default FitPassPartnerLeads;

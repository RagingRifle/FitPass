import { useState, useEffect, useCallback } from 'react';
import { Zap, Calendar, ChevronLeft, ChevronRight, RefreshCw, Clock, User, Building2 } from 'lucide-react';
import API from '../services/api';
import { SkeletonRow } from '../components/Skeleton';
import EmptyState from '../components/ui/EmptyState';

// ─── Stat card component ─────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color }) => (
    <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flex: '1 1 180px',
    }}>
        <div style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--radius-md)',
            background: `${color}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
        }}>
            <Icon size={20} color={color} />
        </div>
        <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{label}</div>
        </div>
    </div>
);

// ─── Badge component ─────────────────────────────────────────────────────────
const Badge = ({ children, color }) => (
    <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.2rem 0.6rem',
        borderRadius: '999px',
        fontSize: '0.72rem',
        fontWeight: 600,
        background: `${color}18`,
        color,
        letterSpacing: '0.02em',
    }}>
        {children}
    </span>
);

// ─── Format helpers ───────────────────────────────────────────────────────────
const fmtDate = (ts) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtTime = (ts) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};
const calcDuration = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return '—';
    const mins = Math.round((new Date(checkOut) - new Date(checkIn)) / 60000);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

// ─── Main page ────────────────────────────────────────────────────────────────
const FitPassVisitLog = () => {
    const [visits, setVisits]       = useState([]);
    const [meta, setMeta]           = useState({ page: 1, pageSize: 25, total: 0 });
    const [page, setPage]           = useState(1);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState('');
    const [fromDate, setFromDate]   = useState('');
    const [toDate, setToDate]       = useState('');

    const totalPages = Math.ceil((meta.total || 0) / (meta.pageSize || 25));

    const fetchVisits = useCallback(async (pg = 1) => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ page: pg, pageSize: 25 });
            if (fromDate) params.set('from', fromDate);
            if (toDate)   params.set('to',   `${toDate}T23:59:59`);

            const { data } = await API.get(`/sessions/partner-visits?${params}`);
            if (data.success) {
                setVisits(data.data || []);
                setMeta(data.meta || { page: pg, pageSize: 25, total: 0 });
            } else {
                setError(data.message || 'Failed to load visits.');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Could not load visit log.');
        } finally {
            setLoading(false);
        }
    }, [fromDate, toDate]);

    useEffect(() => {
        fetchVisits(page);
    }, [page, fetchVisits]);

    const handleFilter = (e) => {
        e.preventDefault();
        setPage(1);
        fetchVisits(1);
    };

    const handleReset = () => {
        setFromDate('');
        setToDate('');
        setPage(1);
    };

    return (
        <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto' }}>

            {/* ── Page header ── */}
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                    <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--primary-alpha, rgba(240,160,32,0.15))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Zap size={20} color="var(--primary)" />
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                            FitPass Visits
                        </h1>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                            Read-only check-in log — FitPass members who visited your gym
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Stats row ── */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <StatCard icon={User}      label="Total Visits (this view)" value={meta.total ?? 0}      color="var(--primary, #FEDF1E)" />
                <StatCard icon={Calendar}  label="Current Page"             value={`${meta.page ?? 1} / ${totalPages || 1}`} color="#1976D2" />
            </div>

            {/* ── Date filter ── */}
            <form onSubmit={handleFilter} style={{
                display: 'flex',
                gap: '0.75rem',
                flexWrap: 'wrap',
                alignItems: 'flex-end',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem 1.25rem',
                marginBottom: '1.25rem',
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>From</label>
                    <input
                        type="date"
                        value={fromDate}
                        onChange={e => setFromDate(e.target.value)}
                        style={{ padding: '0.45rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: '0.875rem' }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>To</label>
                    <input
                        type="date"
                        value={toDate}
                        onChange={e => setToDate(e.target.value)}
                        style={{ padding: '0.45rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', fontSize: '0.875rem' }}
                    />
                </div>
                <button
                    type="submit"
                    style={{ padding: '0.5rem 1.25rem', borderRadius: 'var(--radius-sm)', background: 'var(--primary)', color: 'var(--bg)', fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: 'pointer', height: 38 }}
                >
                    Apply
                </button>
                <button
                    type="button"
                    onClick={handleReset}
                    style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.875rem', border: '1px solid var(--border)', cursor: 'pointer', height: 38, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                    <RefreshCw size={14} /> Reset
                </button>
            </form>

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

                <div className="responsive-table-cards" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                {['Member Name', 'Visit Date', 'Check-In Time', 'Duration', 'Branch', 'Status'].map(h => (
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
                                Array.from({ length: 5 }).map((_, i) => (
                                    <SkeletonRow key={i} cols={6} />
                                ))
                            ) : visits.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '1rem' }}>
                                        <EmptyState
                                            icon={Zap}
                                            title="No FitPass Check-Ins Found"
                                            description="No FitPass member visits recorded for your gym branch yet. Try adjusting the date range or check back later."
                                        />
                                    </td>
                                </tr>
                            ) : visits.map((v, idx) => (
                                <tr key={v.id || idx} style={{
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
                                                background: 'var(--primary-alpha, rgba(240,160,32,0.15))',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                color: 'var(--primary)',
                                                flexShrink: 0,
                                            }}>
                                                {(v.memberName || '?').charAt(0).toUpperCase()}
                                            </div>
                                            {v.memberName || '—'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Calendar size={13} />
                                            {fmtDate(v.checkInTimestamp)}
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Clock size={13} />
                                            {fmtTime(v.checkInTimestamp)}
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                                        {calcDuration(v.checkInTimestamp, v.checkOutTimestamp)}
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Building2 size={13} />
                                            {v.branchNameVisited || 'Main Branch'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <Badge color="#2E7D32">{v.accessStatus || 'Success'}</Badge>
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
                        <span>Showing {visits.length} of {meta.total} records</span>
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

            {/* ── Spin keyframe (injected once) ── */}
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default FitPassVisitLog;

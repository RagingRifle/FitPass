import { useState, useEffect, useCallback } from 'react';
import { Zap, Calendar, ChevronLeft, ChevronRight, RefreshCw, Clock, User, Building2, Timer } from 'lucide-react';
import API from '../services/api';
import { SkeletonRow } from '../components/Skeleton';
import EmptyState from '../components/ui/EmptyState';

// ─── Stat card component ─────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="card" style={{
        padding: '1.15rem 1.35rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        margin: 0,
    }}>
        <div style={{
            width: 44,
            height: 44,
            borderRadius: '12px',
            background: `${color}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
        }}>
            <Icon size={20} color={color} />
        </div>
        <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.25rem', fontWeight: 600 }}>{label}</div>
        </div>
    </div>
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
const toDateInput = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ─── Main page ────────────────────────────────────────────────────────────────
const FitPassVisitLog = () => {
    const [visits, setVisits] = useState([]);
    const [meta, setMeta] = useState({ page: 1, pageSize: 25, total: 0 });
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const totalPages = Math.ceil((meta.total || 0) / (meta.pageSize || 25));

    const fetchVisits = useCallback(async (pg = 1) => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ page: pg, pageSize: 25 });
            if (fromDate) params.set('from', fromDate);
            if (toDate) params.set('to', `${toDate}T23:59:59`);

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

    const applyPreset = (days) => {
        const end = new Date();
        const start = new Date();
        if (days === 0) {
            setFromDate(toDateInput(end));
            setToDate(toDateInput(end));
        } else {
            start.setDate(start.getDate() - (days - 1));
            setFromDate(toDateInput(start));
            setToDate(toDateInput(end));
        }
        setPage(1);
    };

    const completedWithDuration = visits.filter(v => v.checkInTimestamp && v.checkOutTimestamp);
    const avgMinutes = completedWithDuration.length > 0
        ? Math.round(
            completedWithDuration.reduce((sum, v) => sum + (new Date(v.checkOutTimestamp) - new Date(v.checkInTimestamp)) / 60000, 0)
            / completedWithDuration.length
        )
        : null;

    return (
        <div className="fade-in" style={{ paddingBottom: '2rem' }}>
            {/* ── Page header ── */}
            <header className="plans-page-header" style={{ marginBottom: '1.5rem' }}>
                <div>
                    <p className="plans-page-header__kicker">FITPASS · PARTNER BRANCH</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Zap size={24} style={{ color: 'var(--primary)' }} />
                        <h2 style={{ margin: 0 }}>Branch Metrics &amp; Check-ins</h2>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>
                        Read-only check-in log — FitPass members who visited your gym branch.
                    </p>
                </div>
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => fetchVisits(page)}
                    disabled={loading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
                >
                    <RefreshCw size={15} /> Refresh
                </button>
            </header>

            {/* ── Stats row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <StatCard icon={User} label="Total Visits (filtered)" value={meta.total ?? 0} color="#92700A" />
                <StatCard icon={Timer} label="Avg. Session Duration" value={avgMinutes != null ? `${avgMinutes} min` : '—'} color="#15803d" />
                <StatCard icon={Calendar} label="Current Page" value={`${meta.page ?? 1} / ${totalPages || 1}`} color="#1976D2" />
            </div>

            {/* ── Date filter ── */}
            <form onSubmit={handleFilter} className="card" style={{
                display: 'flex',
                gap: '0.85rem',
                flexWrap: 'wrap',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                padding: '1rem 1.25rem',
                marginBottom: '1.25rem',
            }}>
                <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        From
                        <input
                            className="input"
                            type="date"
                            value={fromDate}
                            onChange={e => setFromDate(e.target.value)}
                            style={{ margin: 0 }}
                        />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        To
                        <input
                            className="input"
                            type="date"
                            value={toDate}
                            onChange={e => setToDate(e.target.value)}
                            style={{ margin: 0 }}
                        />
                    </label>
                    <button type="submit" className="btn btn-primary" style={{ height: 38 }}>
                        Apply
                    </button>
                    <button type="button" onClick={handleReset} className="btn btn-secondary" style={{ height: 38, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <RefreshCw size={14} /> Reset
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem' }} onClick={() => applyPreset(0)}>Today</button>
                    <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem' }} onClick={() => applyPreset(7)}>Last 7 days</button>
                    <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem' }} onClick={() => applyPreset(30)}>Last 30 days</button>
                </div>
            </form>

            {/* ── Table ── */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {error && (
                    <div style={{ padding: '0.9rem 1.25rem', color: '#b91c1c', background: '#fef2f2', borderBottom: '1px solid #fecaca', fontSize: '0.875rem' }}>
                        {error}
                    </div>
                )}

                <div className="responsive-table-cards" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                {['Member Name', 'Visit Date', 'Check-In Time', 'Duration', 'Branch', 'Status'].map(h => (
                                    <th key={h} style={{
                                        padding: '0.85rem 1.15rem',
                                        textAlign: 'left',
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        color: 'var(--text-secondary)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        whiteSpace: 'nowrap',
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
                                    <td colSpan={6} style={{ padding: '1.5rem' }}>
                                        <EmptyState
                                            icon={Zap}
                                            title="No FitPass Check-Ins Found"
                                            description="No FitPass member visits recorded for your gym branch yet. Try adjusting the date range or check back later."
                                        />
                                    </td>
                                </tr>
                            ) : visits.map((v, idx) => (
                                <tr key={v.id || idx} style={{ borderBottom: idx < visits.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                    <td style={{ padding: '0.85rem 1.15rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                            <div style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: '10px',
                                                background: 'color-mix(in srgb, var(--primary) 18%, var(--bg))',
                                                border: '1px solid color-mix(in srgb, var(--primary) 30%, var(--border))',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.78rem',
                                                fontWeight: 800,
                                                color: '#5b4900',
                                                flexShrink: 0,
                                            }}>
                                                {(v.memberName || '?').charAt(0).toUpperCase()}
                                            </div>
                                            {v.memberName || '—'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.85rem 1.15rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Calendar size={13} />
                                            {fmtDate(v.checkInTimestamp)}
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.85rem 1.15rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Clock size={13} />
                                            {fmtTime(v.checkInTimestamp)}
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.85rem 1.15rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                        {calcDuration(v.checkInTimestamp, v.checkOutTimestamp)}
                                    </td>
                                    <td style={{ padding: '0.85rem 1.15rem', color: 'var(--text-secondary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Building2 size={13} />
                                            {v.branchNameVisited || 'Main Branch'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '0.85rem 1.15rem' }}>
                                        <span className="badge badge-active">
                                            {v.accessStatus || 'Success'}
                                        </span>
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
                        padding: '0.9rem 1.25rem',
                        borderTop: '1px solid var(--border)',
                        fontSize: '0.82rem',
                        color: 'var(--text-secondary)',
                    }}>
                        <span>Showing {visits.length} of {meta.total} records</span>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                style={{ padding: '0.35rem 0.6rem', opacity: page <= 1 ? 0.45 : 1 }}
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Page {page} / {totalPages}</span>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                style={{ padding: '0.35rem 0.6rem', opacity: page >= totalPages ? 0.45 : 1 }}
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FitPassVisitLog;

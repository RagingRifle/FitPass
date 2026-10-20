import { useState, useEffect, useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStats } from '../../services/apiService';
import { AuthContext } from '../../context/AuthContext';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';
import {
    Users, CheckCircle2, AlertTriangle, Clock, Sparkles, IndianRupee,
    TrendingDown, TrendingUp, Building2, Package, ShieldCheck, Zap,
    Activity, CalendarCheck, ArrowRight, BarChart2, Dumbbell, X
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatCurrency = (v) => {
    if (!v) return '₹0';
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
    return `₹${v}`;
};

const AMBER_COLORS = ['#FEDF1E', '#D9860F', '#a78bfa', '#34d399', '#f43f5e', '#60a5fa'];

const CustomTooltipRevenue = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: '#2D251C', border: '1px solid #3A3025', borderRadius: 10,
            padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
        }}>
            <p style={{ color: '#A39686', fontSize: 12, marginBottom: 4 }}>{label}</p>
            <p style={{ color: '#FEDF1E', fontWeight: 700, fontSize: 15 }}>{formatCurrency(payload[0].value)}</p>
        </div>
    );
};

const CustomTooltipBar = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: '#2D251C', border: '1px solid #3A3025', borderRadius: 10,
            padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
        }}>
            <p style={{ color: '#A39686', fontSize: 12, marginBottom: 4 }}>{label}</p>
            <p style={{ color: '#FEDF1E', fontWeight: 700, fontSize: 15 }}>{formatCurrency(payload[0].value)}</p>
        </div>
    );
};

// ─── Quick Action Cards ───────────────────────────────────────────────────────
const QUICK_ACTIONS = [
    { label: 'Partner Gyms', desc: 'Manage gym network', icon: Building2, path: '/superadmin/gyms', color: '#FEDF1E' },
    { label: 'Fit-Prime Plans', desc: 'Subscription plans', icon: Package, path: '/superadmin/plans', color: '#D9860F' },
    { label: 'FitPass Members', desc: 'Pass holder roster', icon: Users, path: '/superadmin/fitpass-members', color: '#a78bfa' },
    { label: 'FitPass Reports', desc: 'Analytics & insights', icon: Zap, path: '/superadmin/fitpass-analytics', color: '#34d399' },
    { label: 'Admins Directory', desc: 'Manage admin users', icon: ShieldCheck, path: '/superadmin/admins', color: '#60a5fa' },
];

function SuperAdminDashboard() {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchLog, setSearchLog] = useState('');

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const statsData = await getStats();
                setStats(statsData);
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboardData();
    }, []);

    const revenueTrendData = useMemo(() => {
        if (!stats?.revenueTrend) return [];
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return stats.revenueTrend.map(item => ({
            name: `${monthNames[(item._id?.month ?? item.month) - 1]} ${item._id?.year ?? item.year}`,
            amount: item.total
        }));
    }, [stats]);

    const planBreakdownData = useMemo(() => {
        if (!stats?.planBreakdown) return [];
        return stats.planBreakdown.map(p => ({ name: p._id || 'Unknown', value: p.value }));
    }, [stats]);

    const methodBreakdownData = useMemo(() => {
        if (!stats?.methodBreakdown) return [];
        return stats.methodBreakdown.map(m => ({ name: m._id || 'Other', value: m.value }));
    }, [stats]);

    const filteredCheckins = useMemo(() => {
        const logs = stats?.recentCheckins || [];
        if (!searchLog.trim()) return logs;
        const q = searchLog.toLowerCase();
        return logs.filter(l =>
            l.memberName?.toLowerCase().includes(q) ||
            l.memberPhone?.includes(q) ||
            l.gymName?.toLowerCase().includes(q) ||
            l.type?.toLowerCase().includes(q)
        );
    }, [stats, searchLog]);

    const kpiCards = [
        {
            title: 'Total Members', value: stats?.totalMembers ?? 0,
            icon: <Users size={20} />, color: '#FEDF1E',
            sub: 'Across all gyms'
        },
        {
            title: 'Active Members', value: stats?.activeMembers ?? 0,
            icon: <CheckCircle2 size={20} />, color: '#2E7D32',
            sub: `${stats && stats.totalMembers ? Math.round((stats.activeMembers / stats.totalMembers) * 100) : 0}% active rate`
        },
        {
            title: 'Expired Members', value: stats?.expiredMembers ?? 0,
            icon: <AlertTriangle size={20} />, color: '#C62828',
            sub: 'Need renewal'
        },
        {
            title: 'Expiring Soon', value: stats?.expiringSoonCount ?? 0,
            icon: <Clock size={20} />, color: '#f59e0b',
            sub: 'Within 7 days'
        },
        {
            title: 'New This Month', value: stats?.newMembersThisMonth ?? 0,
            icon: <Sparkles size={20} />, color: '#a78bfa',
            sub: 'Fresh joiners'
        },
        {
            title: 'Monthly Revenue', value: formatCurrency(stats?.monthlyRevenue),
            icon: <IndianRupee size={20} />, color: '#34d399',
            sub: 'This month collected'
        },
        {
            title: 'Monthly Expenses', value: formatCurrency(stats?.monthlyExpenses),
            icon: <TrendingDown size={20} />, color: '#C62828',
            sub: 'This month spent'
        },
        {
            title: 'Net Profit', value: formatCurrency(stats?.monthlyProfit),
            icon: <TrendingUp size={20} />, color: '#FEDF1E',
            sub: 'Revenue − Expenses'
        },
    ];

    const now = new Date();
    const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

    // ─── Loading skeleton ───────────────────────────────────────────────────────
    if (loading) return (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ height: 90, background: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }} className="skeleton" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} style={{ height: 90, borderRadius: 'var(--radius-md)' }} className="skeleton" />
                ))}
            </div>
            <div className="kpi-grid">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} style={{ height: 110, borderRadius: 'var(--radius-lg)' }} className="skeleton" />
                ))}
            </div>
        </div>
    );

    return (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem' }}>

            {/* ── Hero Welcome ─────────────────────────────────────────────────── */}
            <div className="superadmin-hero" style={{
                background: 'linear-gradient(135deg, rgba(240,160,32,0.12) 0%, rgba(217,134,15,0.06) 50%, transparent 100%)',
                border: '1px solid rgba(240,160,32,0.25)',
                borderRadius: 'var(--radius-lg)',
                padding: '1.75rem 2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 200, background: 'radial-gradient(ellipse at right, rgba(240,160,32,0.1), transparent 70%)', pointerEvents: 'none' }} />
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                        <Dumbbell size={16} color="var(--primary)" />
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--primary)' }}>
                            {user?.role === 'fitpass_admin' ? 'FitPass Admin' : user?.role === 'h4_admin' ? 'H4 Admin' : 'FitPrime Super Admin'}
                        </span>
                    </div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
                        {greeting}, {user?.name?.split(' ')[0] || (user?.role === 'fitpass_admin' ? 'FitPass Admin' : user?.role === 'h4_admin' ? 'H4 Admin' : 'Master Admin')}
                    </h1>
                    <p style={{ margin: '0.4rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        {user?.role === 'fitpass_admin' ? 'FitPass Network Operations Overview' : user?.role === 'h4_admin' ? 'H4 Gym Network Overview' : 'Global platform overview'} — {now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{
                        background: 'rgba(240,160,32,0.12)', border: '1px solid rgba(240,160,32,0.2)',
                        borderRadius: 'var(--radius-md)', padding: '0.6rem 1.1rem', textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'Outfit, sans-serif' }}>
                            {stats?.todayAttendanceCount ?? 0}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Today's Check-ins</div>
                    </div>
                    <div style={{
                        background: 'rgba(46,125,50,0.12)', border: '1px solid rgba(46,125,50,0.2)',
                        borderRadius: 'var(--radius-md)', padding: '0.6rem 1.1rem', textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399', fontFamily: 'Outfit, sans-serif' }}>
                            {stats?.todaySessionsCount ?? 0}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live Sessions</div>
                    </div>
                </div>
            </div>

            {/* ── Quick Actions ──────────────────────────────────────────────── */}
            <div>
                <h2 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
                    Quick Navigation
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.9rem' }}>
                    {QUICK_ACTIONS.map(action => (
                        <button
                            key={action.path}
                            className="superadmin-quick-action"
                            id={`quick-nav-${action.path.split('/').pop()}`}
                            onClick={() => navigate(action.path)}
                            style={{
                                background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                                padding: '1rem 1.1rem', cursor: 'pointer', textAlign: 'left',
                                display: 'flex', flexDirection: 'column', gap: '0.5rem',
                                position: 'relative', overflow: 'hidden'
                            }}
                        >
                            <div style={{
                                width: 38, height: 38, borderRadius: 'var(--radius-sm)',
                                background: action.color + '18', border: `1px solid ${action.color}30`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: action.color
                            }}>
                                <action.icon size={18} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                                    {action.label}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                    {action.desc}
                                </div>
                            </div>
                            <ArrowRight size={14} style={{ position: 'absolute', right: 10, top: 10, color: 'var(--text-muted)', opacity: 0.5 }} />
                        </button>
                    ))}
                </div>
            </div>

            {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
            <div>
                <h2 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <BarChart2 size={14} /> Global System Statistics
                </h2>
                <div className="kpi-grid">
                    {kpiCards.map((card, index) => (
                        <div
                            key={index}
                            className="kpi-card"
                            style={{ '--kpi-color': card.color, '--kpi-bg': `${card.color}18` }}
                        >
                            <div className="kpi-header">
                                <span className="kpi-label">{card.title}</span>
                                <div className="kpi-icon" style={{ background: `${card.color}18`, color: card.color, border: `1px solid ${card.color}30` }}>
                                    {card.icon}
                                </div>
                            </div>
                            <div className="kpi-value" style={{ color: card.color === '#FEDF1E' ? 'var(--text-primary)' : 'var(--text-primary)' }}>
                                {card.value}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                {card.sub}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Charts Row 1 ──────────────────────────────────────────────────── */}
            <div className="charts-grid">
                {/* Revenue Trend */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                Global Revenue Analytics
                            </h3>
                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last 6 months</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(240,160,32,0.1)', border: '1px solid rgba(240,160,32,0.2)', borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.75rem' }}>
                            <TrendingUp size={14} color="var(--primary)" />
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>
                                {formatCurrency(stats?.monthlyRevenue)} this month
                            </span>
                        </div>
                    </div>
                    {revenueTrendData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={260}>
                            <AreaChart data={revenueTrendData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="colorAmtSA" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#FEDF1E" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#FEDF1E" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(58,48,37,0.8)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#A39686', fontSize: 11, fontWeight: 500 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#A39686', fontSize: 11, fontWeight: 500 }} dx={-5} tickFormatter={v => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v}`} />
                                <Tooltip content={<CustomTooltipRevenue />} />
                                <Area type="monotone" dataKey="amount" stroke="#FEDF1E" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAmtSA)" dot={{ r: 4, fill: '#FEDF1E', stroke: '#2D251C', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#FEDF1E' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', flexDirection: 'column', gap: '0.5rem' }}>
                            <BarChart2 size={32} opacity={0.3} />
                            <span>No revenue data yet</span>
                        </div>
                    )}
                </div>

                {/* Plan Performance */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Plan Performance
                        </h3>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Revenue by subscription plan</p>
                    </div>
                    {planBreakdownData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={planBreakdownData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(58,48,37,0.8)" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#A39686', fontSize: 11, fontWeight: 500 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#A39686', fontSize: 11, fontWeight: 500 }} dx={-5} tickFormatter={v => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'K' : v}`} />
                                <Tooltip content={<CustomTooltipBar />} />
                                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={36}>
                                    {planBreakdownData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={AMBER_COLORS[index % AMBER_COLORS.length]} fillOpacity={0.9} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', flexDirection: 'column', gap: '0.5rem' }}>
                            <Package size={32} opacity={0.3} />
                            <span>No plan data yet</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Charts Row 2 ──────────────────────────────────────────────────── */}
            <div className="charts-grid">
                {/* Payment Method Breakdown */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    {(() => {
                        const totalCollections = methodBreakdownData.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
                        return (
                            <>
                                <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                            Collections by Method
                                        </h3>
                                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Payment method distribution & revenue share</p>
                                    </div>
                                    {totalCollections > 0 && (
                                        <div style={{ background: 'rgba(240, 160, 32, 0.1)', border: '1px solid rgba(240, 160, 32, 0.25)', borderRadius: '8px', padding: '0.35rem 0.75rem', textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total</div>
                                            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#FEDF1E' }}>{formatCurrency(totalCollections)}</div>
                                        </div>
                                    )}
                                </div>
                                {methodBreakdownData.length > 0 && totalCollections > 0 ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', alignItems: 'center' }}>
                                        <div style={{ position: 'relative', width: '100%', height: 220 }}>
                                            <ResponsiveContainer width="100%" height={220}>
                                                <PieChart>
                                                    <Pie data={methodBreakdownData} innerRadius={60} outerRadius={88} paddingAngle={5} dataKey="value" nameKey="name" stroke="none" cornerRadius={6}>
                                                        {methodBreakdownData.map((_, index) => (
                                                            <Cell key={`cell-${index}`} fill={AMBER_COLORS[index % AMBER_COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip
                                                        content={({ active, payload }) => {
                                                            if (!active || !payload?.length) return null;
                                                            const item = payload[0];
                                                            const pct = totalCollections ? ((item.value / totalCollections) * 100).toFixed(1) : 0;
                                                            return (
                                                                <div style={{
                                                                    background: '#2D251C', border: '1px solid #3A3025', borderRadius: 10,
                                                                    padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                                                                }}>
                                                                    <p style={{ color: '#A39686', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>{item.name}</p>
                                                                    <p style={{ color: '#FEDF1E', fontWeight: 800, fontSize: 14, margin: 0 }}>
                                                                        {formatCurrency(item.value)} <span style={{ fontSize: 11, color: '#6D6154', fontWeight: 500 }}>({pct}%)</span>
                                                                    </p>
                                                                </div>
                                                            );
                                                        }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            <div style={{
                                                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                                textAlign: 'center', pointerEvents: 'none'
                                            }}>
                                                <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>TOTAL</div>
                                                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                                    {formatCurrency(totalCollections)}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            {methodBreakdownData.map((item, idx) => {
                                                const color = AMBER_COLORS[idx % AMBER_COLORS.length];
                                                const pct = totalCollections ? Math.round((item.value / totalCollections) * 100) : 0;
                                                return (
                                                    <div key={idx} style={{ background: 'var(--bg-tertiary, rgba(255,255,255,0.03))', borderRadius: '10px', padding: '0.6rem 0.8rem', border: '1px solid var(--border, rgba(255,255,255,0.05))' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</span>
                                                            </div>
                                                            <div>
                                                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(item.value)}</span>
                                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.35rem', fontWeight: 600 }}>({pct}%)</span>
                                                            </div>
                                                        </div>
                                                        <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 999, transition: 'width 0.8s ease' }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', flexDirection: 'column', gap: '0.5rem' }}>
                                        <IndianRupee size={32} opacity={0.3} />
                                        <span>No payment data yet</span>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>

                {/* Member Status Summary */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Member Status Summary
                        </h3>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Global membership breakdown</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {[
                            { label: 'Active Members', value: stats?.activeMembers ?? 0, total: stats?.totalMembers ?? 1, color: '#2E7D32' },
                            { label: 'Expired Members', value: stats?.expiredMembers ?? 0, total: stats?.totalMembers ?? 1, color: '#C62828' },
                            { label: 'Expiring Soon', value: stats?.expiringSoonCount ?? 0, total: stats?.activeMembers ?? 1, color: '#FEDF1E' },
                            { label: 'New This Month', value: stats?.newMembersThisMonth ?? 0, total: stats?.totalMembers ?? 1, color: '#a78bfa' },
                        ].map((item, idx) => {
                            const pct = item.total ? Math.min(100, Math.round((item.value / item.total) * 100)) : 0;
                            return (
                                <div key={idx}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{item.label}</span>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: item.color }}>
                                            {item.value} <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.72rem' }}>({pct}%)</span>
                                        </span>
                                    </div>
                                    <div style={{ height: 7, background: 'var(--bg-tertiary)', borderRadius: 999, overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', width: `${pct}%`,
                                            background: `linear-gradient(90deg, ${item.color}, ${item.color}99)`,
                                            borderRadius: 999, transition: 'width 1s cubic-bezier(0.4,0,0.2,1)'
                                        }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Recent Check-ins Table ─────────────────────────────────────────── */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Activity size={18} color="var(--primary)" />
                            Recent Check-ins
                        </h3>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {stats?.recentCheckins?.length ?? 0} records this month · Showing {filteredCheckins.length}
                        </p>
                    </div>
                    {/* Searchable log filter */}
                    <div style={{ position: 'relative' }}>
                        <input
                            id="checkin-log-search"
                            type="text"
                            placeholder="Filter by name, phone, gym..."
                            value={searchLog}
                            onChange={e => setSearchLog(e.target.value)}
                            style={{
                                background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)', padding: '0.55rem 2.25rem 0.55rem 0.9rem',
                                color: 'var(--text-primary)', fontSize: '0.8rem', width: 240, outline: 'none',
                                transition: 'border-color 0.2s'
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border)'}
                        />
                        {searchLog && (
                            <button
                                onClick={() => setSearchLog('')}
                                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}
                            >
                                <X size={18} />
                            </button>
                        )}
                    </div>
                </div>

                {filteredCheckins.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        <CalendarCheck size={40} style={{ marginBottom: '0.75rem', opacity: 0.3, display: 'block', margin: '0 auto 0.75rem' }} />
                        {searchLog ? `No check-ins matching "${searchLog}"` : 'No check-ins recorded this month yet'}
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-tertiary)' }}>
                                    {['Member', 'Phone', 'Date & Time', 'Type', 'Gym'].map(h => (
                                        <th key={h} style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCheckins.slice(0, 25).map((log, idx) => (
                                    <tr
                                        key={log.id || idx}
                                        style={{ borderTop: '1px solid var(--border)', transition: 'background 0.15s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ padding: '0.8rem 1.25rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                <div style={{
                                                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                                    background: 'linear-gradient(135deg, #FEDF1E, #D9860F)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontWeight: 800, fontSize: '0.8rem', color: '#231D14'
                                                }}>
                                                    {(log.memberName || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{log.memberName || '—'}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.8rem 1.25rem', color: 'var(--text-secondary)' }}>
                                            {log.memberPhone || '—'}
                                        </td>
                                        <td style={{ padding: '0.8rem 1.25rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                                                {log.date ? new Date(log.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                {log.checkInTime || (log.date ? new Date(log.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—')}
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.8rem 1.25rem' }}>
                                            <span style={{
                                                fontSize: '0.7rem', fontWeight: 700, padding: '0.25rem 0.65rem',
                                                borderRadius: 999, display: 'inline-block',
                                                background: log.type === 'FitPrime' ? 'rgba(240,160,32,0.15)' : 'rgba(25,118,210,0.15)',
                                                color: log.type === 'FitPrime' ? '#FEDF1E' : '#60a5fa',
                                                border: `1px solid ${log.type === 'FitPrime' ? 'rgba(240,160,32,0.25)' : 'rgba(96,165,250,0.25)'}`,
                                                textTransform: 'uppercase', letterSpacing: '0.05em'
                                            }}>
                                                {log.type || 'Traditional'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.8rem 1.25rem', color: 'var(--text-secondary)' }}>
                                            {log.gymName || '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredCheckins.length > 25 && (
                            <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                Showing 25 of {filteredCheckins.length} records. Refine with the filter above.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default SuperAdminDashboard;

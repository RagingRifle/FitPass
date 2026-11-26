import { useState, useEffect, useContext } from 'react';
import API from '../services/api';
import { 
    Loader, Users, TrendingDown, TrendingUp, DollarSign, 
    Calendar, Building2, RefreshCw, AlertTriangle, UserCheck, 
    Activity, ChevronRight, Award, ShieldAlert, Sparkles, CheckCircle2
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

const PIE_COLORS = ['#92700A', '#1976D2', '#2E7D32', '#C62828', '#7B1FA2', '#00796B'];

const MetricCard = ({ icon: Icon, label, value, sub, iconBg = '#FFF8DE', iconColor = '#92700A' }) => (
    <div className="card" style={{ 
        padding: '1.25rem 1.5rem', 
        background: '#FFFFFF',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    }}>
        <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {label}
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: '900', color: 'var(--text-primary)', margin: '0.35rem 0 0.2rem', letterSpacing: '-0.02em' }}>
                {value}
            </div>
            {sub && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{sub}</div>}
        </div>
        {Icon && (
            <div style={{ 
                width: 40, 
                height: 40, 
                borderRadius: '10px', 
                background: iconBg, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0
            }}>
                <Icon size={20} color={iconColor} />
            </div>
        )}
    </div>
);

const Analytics = () => {
    const { user, activeDivision, selectedBranchId } = useContext(AuthContext);
    const dateValue = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const initialEnd = new Date();
    const initialStart = new Date(); initialStart.setDate(initialStart.getDate() - 89);
    const [startDate, setStartDate] = useState(dateValue(initialStart));
    const [endDate, setEndDate] = useState(dateValue(initialEnd));
    const [branchId, setBranchId] = useState(selectedBranchId || '');
    const [branches, setBranches] = useState([]);
    const [refreshKey, setRefreshKey] = useState(0);
    const isH4 = activeDivision === 'h4' || ['h4_admin', 'h4_branch_admin'].includes(user?.role);
    const lockedBranch = ['h4_admin', 'h4_branch_admin'].includes(user?.role) && (user?.userBranchId || user?.branchId);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isH4) API.get('/branches').then(({ data: rows }) => setBranches(rows || [])).catch(() => setBranches([]));
    }, [isH4]);

    useEffect(() => {
        const fetch = async () => {
            try {
                setLoading(true); setError('');
                const params = new URLSearchParams({ startDate, endDate, branchId: lockedBranch || branchId || '' });
                const { data: res } = await API.get(`/analytics?${params}`);
                setData(res);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load analytics');
            } finally { setLoading(false); }
        };
        fetch();
    }, [startDate, endDate, branchId, lockedBranch, refreshKey]);

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
            <Loader className="spinner" size={40} style={{ color: 'var(--primary-color)' }} />
        </div>
    );
    if (error) return (
        <div className="card" style={{ color: 'var(--error)', background: '#FCE5DF', border: '1px solid #E4B8B0', textAlign: 'center', padding: '2rem', maxWidth: 560, margin: '2rem auto' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontWeight: 800 }}>Unable to load analytics</h3>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>{error}</p>
            <button className="btn btn-secondary" onClick={() => setRefreshKey(k => k + 1)} style={{ marginTop: '1rem', padding: '0.4rem 1rem' }}>Retry</button>
        </div>
    );
    if (!data) return (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-secondary)', maxWidth: 560, margin: '2rem auto' }}>
            No analytics data available for this range.
        </div>
    );

    const statusData = data?.statusBreakdown?.map(s => ({ name: s._id || 'Unknown', value: s.count })) || [];

    return (
        <div className="fade-in" style={{ padding: '0.25rem 0 2rem' }}>
            {/* Header */}
            <div style={{ marginBottom: '1.75rem' }}>
                <h2 style={{ fontWeight: '900', marginBottom: '0.25rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={24} style={{ color: '#92700A' }} /> Churn & Retention Analytics
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                    Business intelligence metrics, member retention tracking, and cohort performance
                </p>
            </div>

            {/* Filter Toolbar */}
            <div className="card" style={{ 
                display: 'flex', 
                alignItems: 'flex-end', 
                gap: '12px', 
                flexWrap: 'wrap', 
                marginBottom: '1.5rem',
                padding: '1rem 1.25rem',
                background: '#FFFFFF',
                border: '1px solid var(--border)',
                borderRadius: '12px'
            }}>
                <label style={{ display: 'grid', gap: '5px', fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    From Date
                    <input 
                        className="input" 
                        type="date" 
                        value={startDate} 
                        max={endDate} 
                        onChange={e => setStartDate(e.target.value)} 
                        style={{ height: '38px', fontSize: '0.82rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                    />
                </label>
                <label style={{ display: 'grid', gap: '5px', fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    To Date
                    <input 
                        className="input" 
                        type="date" 
                        value={endDate} 
                        min={startDate} 
                        onChange={e => setEndDate(e.target.value)} 
                        style={{ height: '38px', fontSize: '0.82rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                    />
                </label>
                {isH4 && (
                    <label style={{ display: 'grid', gap: '5px', fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        H4 Branch
                        <select 
                            className="input"
                            disabled={Boolean(lockedBranch)} 
                            value={lockedBranch || branchId} 
                            onChange={e => setBranchId(e.target.value)}
                            style={{ height: '38px', minWidth: '150px', fontSize: '0.82rem', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                        >
                            <option value="">All branches</option>
                            {branches.map(branch => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
                        </select>
                    </label>
                )}
                <button 
                    className="btn btn-primary" 
                    onClick={() => setRefreshKey(key => key + 1)}
                    style={{ height: '38px', display: 'flex', alignItems: 'center', gap: '6px', padding: '0 1rem', fontSize: '0.82rem', fontWeight: '800' }}
                >
                    <RefreshCw size={14} /> Apply Filters
                </button>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', alignSelf: 'center', marginLeft: 'auto' }}>
                    Analytics computed for selected period
                </span>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
                <MetricCard 
                    icon={Users} 
                    label="Inactive in Period" 
                    value={data?.inactiveCount ?? 0} 
                    sub="Active members with no visits in range" 
                    iconBg="#FFF3C4"
                    iconColor="#92700A" 
                />
                <MetricCard 
                    icon={TrendingDown} 
                    label="Churn Rate" 
                    value={`${data?.churnRate ?? 0}%`} 
                    sub={`${data?.expiredLast30 ?? 0} memberships expired in range`} 
                    iconBg="#FCE5DF"
                    iconColor="#C62828" 
                />
                <MetricCard 
                    icon={TrendingUp} 
                    label="Renewal Rate" 
                    value={`${data?.renewalRate ?? 0}%`} 
                    sub={`${data?.renewedCount ?? 0} active renewals at period end`} 
                    iconBg="#E8F5E9"
                    iconColor="#2E7D32" 
                />
                <MetricCard 
                    icon={DollarSign} 
                    label="Avg Lifetime Value" 
                    value={`₹${(data?.avgLTV || 0).toLocaleString('en-IN')}`} 
                    sub="Average total revenue paid per member" 
                    iconBg="#E3F2FD"
                    iconColor="#1976D2" 
                />
            </div>

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem', marginBottom: '1.75rem' }}>
                {/* Churn Trend */}
                <div className="card" style={{ padding: '1.25rem 1.5rem', background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '800' }}>Churn Trend</h3>
                            <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>Monthly expirations in selected range</p>
                        </div>
                    </div>
                    <div style={{ width: '100%', height: 240 }}>
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={data.churnTrend || []}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: '10px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                                    formatter={(v) => [v + ' members', 'Churned']}
                                />
                                <Bar dataKey="churned" fill="#C62828" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Membership Status Breakdown */}
                <div className="card" style={{ padding: '1.25rem 1.5rem', background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '800' }}>Membership Status</h3>
                            <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>Active, expired, and pending distribution</p>
                        </div>
                    </div>
                    <div style={{ width: '100%', height: 200 }}>
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    innerRadius={55}
                                    outerRadius={85}
                                    paddingAngle={3}
                                    dataKey="value"
                                    nameKey="name"
                                >
                                    {statusData.map((_, i) => (
                                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: '10px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.75rem' }}>
                        {statusData.map((s, i) => (
                            <span key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], display: 'inline-block' }} />
                                {s.name} ({s.value})
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Row: Top Members + Inactive Table */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem' }}>
                {/* Top Value Members */}
                <div className="card" style={{ padding: '1.25rem 1.5rem', background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
                        <Award size={18} style={{ color: '#92700A' }} />
                        <div>
                            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '800' }}>Top Lifetime Value Members</h3>
                            <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>Highest revenue contributors</p>
                        </div>
                    </div>
                    {data.topMembers?.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {data.topMembers.map((m, i) => (
                                <div key={m._id?.toString() || i} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '0.65rem 0.85rem',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{
                                            width: '28px', height: '28px', borderRadius: '50%',
                                            background: i === 0 ? '#FEDF1E' : '#DFD7C7',
                                            color: '#000000',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontWeight: '900', fontSize: '0.75rem'
                                        }}>#{i + 1}</div>
                                        <div>
                                            <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{m.name}</div>
                                            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{m.phone}</div>
                                        </div>
                                    </div>
                                    <div style={{ fontWeight: '800', color: '#92700A', fontSize: '0.9rem' }}>
                                        ₹{(m.totalPaid || 0).toLocaleString('en-IN')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>No payment data recorded yet.</p>
                    )}
                </div>

                {/* Inactive Members */}
                <div className="card" style={{ padding: '1.25rem 1.5rem', background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
                        <ShieldAlert size={18} style={{ color: '#C62828' }} />
                        <div>
                            <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '800' }}>Inactive Members</h3>
                            <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>Active members with no attendance in the selected range</p>
                        </div>
                    </div>
                    {data.inactiveMembers?.length > 0 ? (
                        <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {data.inactiveMembers.map((m) => {
                                const daysLeft = Math.ceil((new Date(m.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
                                return (
                                    <div key={m._id} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '0.65rem 0.85rem',
                                        background: 'var(--bg-secondary)',
                                        borderRadius: '10px',
                                        border: '1px solid var(--border)'
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-primary)' }}>{m.name}</div>
                                            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{m.phone} {m.planId?.name ? `· ${m.planId.name}` : ''}</div>
                                        </div>
                                        <span style={{
                                            background: daysLeft < 7 ? '#FCE5DF' : '#FFF3C4',
                                            color: daysLeft < 7 ? '#C62828' : '#92700A',
                                            padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '800'
                                        }}>
                                            {daysLeft > 0 ? `${daysLeft}d left` : 'Expired'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', color: '#2E7D32', padding: '2.5rem 1rem' }}>
                            <CheckCircle2 size={36} style={{ marginBottom: '0.5rem', opacity: 0.9 }} />
                            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>All active members attended recently!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Analytics;
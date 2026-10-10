import { useState, useEffect } from 'react';
import API from '../services/api';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

const COLORS = ['var(--primary-color)', '#10b981', '#f59e0b', '#ef4444', 'var(--accent-color)', '#0ea5e9'];

const MetricCard = ({ icon, label, value, sub, color = 'var(--primary-color)', trend }) => (
    <div className="card" style={{ borderLeft: `5px solid ${color}`, padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                <div style={{ fontSize: '2rem', fontWeight: '800', color, margin: '0.5rem 0 0.25rem' }}>{value}</div>
                {sub && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{sub}</div>}
            </div>
            <div style={{ fontSize: '2rem' }}>{icon}</div>
        </div>
    </div>
);

const Analytics = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetch = async () => {
            try {
                const { data: res } = await API.get('/analytics');
                setData(res);
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load analytics');
            } finally { setLoading(false); }
        };
        fetch();
    }, []);

    if (loading) return <div className="spinner"></div>;
    if (error) return <div className="card" style={{ color: '#ef4444', textAlign: 'center', padding: '2rem' }}>{error}</div>;

    const statusData = data.statusBreakdown?.map(s => ({ name: s._id, value: s.count })) || [];

    return (
        <div className="fade-in">
            <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontWeight: '800', marginBottom: '0.25rem' }}> Churn & Retention Analytics</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Business intelligence metrics for your gym</p>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                <MetricCard icon="" label="Inactive Members (7d)" value={data.inactiveCount} sub="Active members with no attendance" color="#f59e0b" />
                <MetricCard icon="" label="Churn Rate (30d)" value={`${data.churnRate}%`} sub={`${data.expiredLast30} expired this month`} color="#ef4444" />
                <MetricCard icon="" label="Renewal Rate (90d)" value={`${data.renewalRate}%`} sub={`${data.renewedCount} members renewed`} color="#10b981" />
                <MetricCard icon="" label="Avg Lifetime Value" value={`₹${data.avgLTV.toLocaleString()}`} sub="Average total paid per member" color="#8b5cf6" />
            </div>

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>

                {/* Churn Trend */}
                <div className="card">
                    <h3 style={{ marginBottom: '1.5rem', fontSize: '1rem' }}> Monthly Churn Trend</h3>
                    <div style={{ width: '100%', height: 240 }}>
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={data.churnTrend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.07)" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px' }}
                                    formatter={(v) => [v, 'Churned']}
                                />
                                <Bar dataKey="churned" fill="#ef4444" radius={[5, 5, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Membership Status Breakdown */}
                <div className="card">
                    <h3 style={{ marginBottom: '1.5rem', fontSize: '1rem' }}> Membership Status</h3>
                    <div style={{ width: '100%', height: 240 }}>
                        <ResponsiveContainer width="100%" height={240}>
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    innerRadius={65}
                                    outerRadius={95}
                                    paddingAngle={4}
                                    dataKey="value"
                                    nameKey="name"
                                    label={({ name, value }) => `${name}: ${value}`}
                                    labelLine={false}
                                >
                                    {statusData.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
                        {statusData.map((s, i) => (
                            <span key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'inline-block' }} />
                                {s.name} ({s.value})
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Row: Top Members + Inactive Table */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem' }}>

                {/* Top Value Members */}
                <div className="card">
                    <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem' }}> Top Lifetime Value Members</h3>
                    {data.topMembers?.length > 0 ? (
                        <div>
                            {data.topMembers.map((m, i) => (
                                <div key={m._id?.toString() || i} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '0.75rem 0', borderBottom: i < data.topMembers.length - 1 ? '1px solid var(--border-color)' : 'none'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{
                                            width: '32px', height: '32px', borderRadius: '50%',
                                            background: `${COLORS[i % COLORS.length]}22`,
                                            color: COLORS[i % COLORS.length],
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontWeight: '800', fontSize: '0.9rem'
                                        }}>#{i + 1}</div>
                                        <div>
                                            <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{m.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.phone}</div>
                                        </div>
                                    </div>
                                    <div style={{ fontWeight: '800', color: '#10b981' }}>₹{m.totalPaid.toLocaleString()}</div>
                                </div>
                            ))}
                        </div>
                    ) : <p style={{ color: 'var(--text-secondary)' }}>No payment data yet.</p>}
                </div>

                {/* Inactive Members */}
                <div className="card">
                    <h3 style={{ marginBottom: '0.25rem', fontSize: '1rem' }}> Inactive Members (7+ Days)</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1rem' }}>Active members who haven't attended recently</p>
                    {data.inactiveMembers?.length > 0 ? (
                        <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                            {data.inactiveMembers.map((m) => {
                                const daysLeft = Math.ceil((new Date(m.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
                                return (
                                    <div key={m._id} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '0.65rem 0', borderBottom: '1px solid var(--border-color)'
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{m.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.phone} · {m.planId?.name || 'N/A'}</div>
                                        </div>
                                        <span style={{
                                            background: daysLeft < 7 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                                            color: daysLeft < 7 ? '#ef4444' : '#f59e0b',
                                            padding: '0.2rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700'
                                        }}>
                                            {daysLeft > 0 ? `${daysLeft}d left` : 'Expired'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', color: '#10b981', padding: '2rem' }}>
                            <div style={{ fontSize: '2rem' }}></div>
                            <p>All active members attended recently!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Analytics;

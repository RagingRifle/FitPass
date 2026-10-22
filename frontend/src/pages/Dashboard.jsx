import { useState, useEffect, useContext } from 'react';
import { getStats, getMembers } from '../services/apiService';
import { AuthContext } from '../context/AuthContext';
import API from '../services/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { Users, CheckCircle2, AlertTriangle, Clock, Sparkles, IndianRupee, TrendingDown, TrendingUp, Megaphone, Check, QrCode, Calendar, Phone, ChevronDown } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

const COLORS = ['var(--primary-color)', 'var(--accent-color)', '#a855f7', '#d946ef', '#f43f5e'];

const LiveSessionTimer = ({ expiresAt }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date();
            const expiration = new Date(expiresAt);
            const diff = expiration - now;

            if (diff <= 0) {
                return 'Expired';
            }

            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);

            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        };

        setTimeLeft(calculateTimeLeft());
        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearInterval(timer);
    }, [expiresAt]);

    return (
        <span style={{ fontFamily: 'monospace', color: timeLeft === 'Expired' ? 'var(--danger-color)' : 'var(--success-color)', fontWeight: 'bold' }}>
            {timeLeft}
        </span>
    );
};

const Dashboard = () => {
    const { user, activeDivision, selectedGymId, changeSelectedGym, selectedBranchId, changeSelectedBranch } = useContext(AuthContext);
    const [stats, setStats] = useState(null);
    const [expiringMembers, setExpiringMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [announceMsg, setAnnounceMsg] = useState('');
    const [showAnnounce, setShowAnnounce] = useState(false);
    const [announcing, setAnnouncing] = useState(false);
    const [announceSuccess, setAnnounceSuccess] = useState(false);
    const [showQR, setShowQR] = useState(false);
    const [gymList, setGymList] = useState([]);

    useEffect(() => {
        const fetchGymsAndBranches = async () => {
            try {
                if (user?.role === 'superadmin' || user?.role === 'fitpass_admin') {
                    if (activeDivision === 'h4') {
                        const [branchesRes, h4Res] = await Promise.all([
                            API.get('/branches'),
                            API.get('/superadmin/h4-gym').catch(() => ({ data: null }))
                        ]);
                        const h4GymId = h4Res.data?._id || h4Res.data?.id;
                        const branches = Array.isArray(branchesRes.data) ? branchesRes.data : [];
                        setGymList(h4GymId
                            ? branches.filter(branch => String(branch.gymId?._id || branch.gymId?.id || branch.gymId || '') === String(h4GymId))
                            : branches.filter(branch => ['05a08fdf-7427-48a5-8b25-e18d5a5668cd', '327d37e7-f978-43a9-82ef-e6c4a4dc3c5d'].includes(String(branch.gymId?._id || branch.gymId?.id || branch.gymId || ''))));
                    } else {
                        const { data } = await API.get('/superadmin/gyms');
                        setGymList(Array.isArray(data) ? data : []);
                    }
                } else if (['partner', 'h4_admin', 'admin'].includes(user?.role)) {
                    const { data: branches } = await API.get('/branches');
                    setGymList(Array.isArray(branches) ? branches : []);
                }
            } catch (err) {
                console.error('Failed to fetch gyms for dashboard selector:', err);
            }
        };
        fetchGymsAndBranches();
    }, [user, activeDivision]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setLoading(true);
            try {
                const [statsData, membersData] = await Promise.all([
                    getStats(),
                    getMembers('Active')
                ]);
                setStats(statsData);

                // Filter members expiring in the next 7 days
                const today = new Date();
                const nextWeek = new Date();
                nextWeek.setDate(today.getDate() + 7);

                const expiring = (membersData.members || []).filter(m => {
                    const expiry = new Date(m.expiryDate);
                    return expiry > today && expiry <= nextWeek;
                });
                setExpiringMembers(expiring);
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [activeDivision, selectedGymId, selectedBranchId]);

    const formatTrendData = (trend) => {
        if (!trend) return [];
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return trend.map(item => ({
            name: `${monthNames[item._id.month - 1]} ${item._id.year}`,
            amount: item.total
        }));
    };

    const handleAnnounce = async (e) => {
        e.preventDefault();
        setAnnouncing(true);
        try {
            await API.post('/notifications/announcement', { message: announceMsg });
            setAnnounceSuccess(true);
            setAnnounceMsg('');
            setTimeout(() => { setShowAnnounce(false); setAnnounceSuccess(false); }, 1500);
        } catch {
            alert('Failed to send announcement.');
        } finally {
            setAnnouncing(false);
        }
    };

    if (loading) return (
        <div className="kpi-grid" style={{ marginBottom: '1.75rem' }}>
            <div className="kpi-card" style={{ '--kpi-color': '#e2e8f0', '--kpi-bg': 'var(--bg-tertiary)' }}>
                <div className="skeleton" style={{ width: 100, height: 12, borderRadius: 6 }} />
                <div className="skeleton" style={{ width: 80, height: 32, borderRadius: 8, marginTop: 12 }} />
            </div>
        </div>
    );

    const recentCheckins = stats?.recentCheckins || [];
    const activeLiveSessions = stats?.activeLiveSessions || [];

    const cards = activeDivision === 'h4' ? [
        { title: 'Total Members', value: stats?.totalMembers || 0, icon: <Users size={22} />, color: 'var(--primary-color)' },
        { title: 'Active Members', value: stats?.activeMembers || 0, icon: <CheckCircle2 size={22} />, color: 'var(--success-color)' },
        { title: 'Expired Members', value: stats?.expiredMembers || 0, icon: <AlertTriangle size={22} />, color: '#ef4444' },
        { title: 'Expiring Soon', value: stats?.expiringSoonCount || 0, icon: <Clock size={22} />, color: '#f59e0b' },
        { title: 'New This Month', value: stats?.newMembersThisMonth || 0, icon: <Sparkles size={22} />, color: 'var(--accent-color)' },
        { title: 'Monthly Revenue', value: `₹${(stats?.monthlyRevenue || 0).toLocaleString()}`, icon: <IndianRupee size={22} />, color: '#10b981' },
        { title: 'Monthly Expenses', value: `₹${(stats?.monthlyExpenses || 0).toLocaleString()}`, icon: <TrendingDown size={22} />, color: '#ef4444' },
        { title: 'Monthly Profit', value: `₹${(stats?.monthlyProfit || 0).toLocaleString()}`, icon: <TrendingUp size={22} />, color: '#10b981' },
    ] : [
        { title: 'Active Members', value: activeLiveSessions.length, icon: <CheckCircle2 size={22} />, color: 'var(--success-color)' },
        { title: 'Total Check-Ins Today', value: (stats?.todayAttendanceCount || 0) + (stats?.todaySessionsCount || 0), icon: <CheckCircle2 size={22} />, color: 'var(--warning-color)' },
    ];

    const normalizedGym = (user?.gymName || user?.gymId?.name || '').toUpperCase();
    const userGymId = user?.gymId?._id || user?.gymId || '';
    const isH4User = user?.role === 'h4_admin' || normalizedGym === 'H4' || userGymId === '05a08fdf-7427-48a5-8b25-e18d5a5668cd' || (activeDivision === 'h4' && !['partner'].includes(user?.role));

    return (
        <div className="fade-in">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div className="page-header-left">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <h2 style={{ margin: 0 }}>{activeDivision === 'h4' ? 'Gym CRM Dashboard' : 'Partner Dashboard'}</h2>
                        {['superadmin', 'fitpass_admin', 'h4_admin'].includes(user?.role) && isH4User && (
                            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                                {user?.branchId ? (
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        background: '#FBF6EC',
                                        border: '1px solid #E5D5C0',
                                        borderRadius: '20px',
                                        padding: '0.35rem 1rem',
                                        color: '#231D14',
                                        fontWeight: 700,
                                        fontSize: '0.875rem',
                                        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)'
                                    }}>
                                        {gymList.find(b => (b._id || b.id) === user.branchId)?.name || 'H4 Branch'}
                                    </div>
                                ) : (
                                    <div style={{
                                        position: 'relative',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        background: '#FBF6EC',
                                        border: '1px solid #E5D5C0',
                                        borderRadius: '20px',
                                        padding: '0.25rem 0.75rem 0.25rem 1rem',
                                        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
                                        cursor: 'pointer'
                                    }}>
                                        <select
                                            style={{
                                                appearance: 'none',
                                                WebkitAppearance: 'none',
                                                MozAppearance: 'none',
                                                background: 'transparent',
                                                border: 'none',
                                                outline: 'none',
                                                color: '#231D14',
                                                fontWeight: 700,
                                                fontSize: '0.875rem',
                                                paddingRight: '1.6rem',
                                                cursor: 'pointer',
                                                margin: 0
                                            }}
                                            value={activeDivision === 'h4' ? selectedBranchId : selectedGymId}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (activeDivision === 'h4') {
                                                    changeSelectedBranch(val);
                                                } else {
                                                    changeSelectedGym(val);
                                                    changeSelectedBranch('');
                                                }
                                            }}
                                        >
                                            {activeDivision === 'h4' ? (
                                                <>
                                                    <option value="">H4 (All Branches)</option>
                                                    {gymList.map(branch => (
                                                        <option key={branch._id || branch.id} value={branch._id || branch.id}>
                                                            {branch.name}
                                                        </option>
                                                    ))}
                                                </>
                                            ) : (
                                                <>
                                                    <option value="">All Partner Gyms</option>
                                                    {gymList.map(gym => (
                                                        <option key={gym._id || gym.id} value={gym._id || gym.id}>
                                                            {gym.name}
                                                        </option>
                                                    ))}
                                                </>
                                            )}
                                        </select>
                                        <ChevronDown size={15} style={{ position: 'absolute', right: '0.65rem', color: '#6D6154', pointerEvents: 'none' }} />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <p style={{ marginTop: '0.25rem' }}>
                        {user?.branchId
                            ? `Welcome back, ${user?.name || 'Admin'}. View real-time analytics for ${gymList.find(b => (b._id || b.id) === user.branchId)?.name || 'your branch'}.`
                            : activeDivision === 'h4'
                            ? `Welcome back, ${user?.name || 'Admin'}. View real-time analytics for the selected gym and branches.`
                            : `Welcome back, ${user?.name || 'Partner'}. Here's the activity at your gym today.`
                        }
                    </p>
                </div>
                {(user?.role === 'admin' || user?.role === 'superadmin') && (
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={() => setShowQR(true)} className="btn btn-secondary">
                            <QrCode size={18} /> Print Check-In QR
                        </button>
                    </div>
                )}
            </div>

            {/* QR Code Modal */}
            {showQR && (
                <div className="modal-overlay" onClick={() => setShowQR(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: '350px' }}>
                        <h3>{user?.name}'s Gym</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            Print this QR code and place it at the front desk. Members will scan it using their mobile app to check in.
                        </p>
                        <div style={{ background: '#fff', padding: '1.5rem', display: 'inline-block', borderRadius: '12px' }}>
                            <QRCodeCanvas 
                                value={JSON.stringify({
                                    gymId: user?.gymId,
                                    ...(user?.branchId ? { branchId: user.branchId } : {}),
                                    gymName: user?.name || 'Partner Gym'
                                })}
                                size={220}
                                level="H"
                            />
                        </div>
                        <div style={{ marginTop: '2rem' }}>
                            <button className="btn btn-secondary" onClick={() => setShowQR(false)} style={{ width: '100%' }}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="kpi-grid">
                {cards.map((card, index) => (
                    <div key={index} className="kpi-card" style={{ '--kpi-color': card.color, '--kpi-bg': `${card.color}18` }}>
                        <div className="kpi-header">
                            <span className="kpi-label">{card.title}</span>
                            <div className="kpi-icon">{card.icon}</div>
                        </div>
                        <div className="kpi-value">{card.value}</div>
                    </div>
                ))}
            </div>

            {activeDivision === 'h4' && (
                <>
                    <div className="charts-grid" style={{ marginBottom: '2.5rem', marginTop: '2.5rem' }}>
                        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ marginBottom: '2rem' }}>Monthly Revenue Analytics</h3>
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer width="100%" height={300}>
                                    <AreaChart data={formatTrendData(stats?.revenueTrend)}>
                                        <defs>
                                            <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--primary-color)" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="var(--primary-color)" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontWeight: 500 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontWeight: 500 }} dx={-10} />
                                        <Tooltip
                                            cursor={{ stroke: 'var(--primary-color)', strokeWidth: 1 }}
                                            contentStyle={{
                                                borderRadius: 'var(--radius-md)',
                                                border: '1px solid var(--border)',
                                                boxShadow: 'var(--shadow-lg)',
                                                background: 'var(--bg-secondary)',
                                                padding: '12px'
                                            }}
                                            itemStyle={{ color: 'var(--primary-color)', fontWeight: 700 }}
                                            formatter={(value) => [`₹${value}`, 'Revenue']}
                                        />
                                        <Area type="monotone" dataKey="amount" stroke="var(--primary-color)" strokeWidth={3} fillOpacity={1} fill="url(#colorAmt)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ marginBottom: '2rem' }}>Plan Performance</h3>
                            <div style={{ width: '100%', height: 300 }}>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={stats?.planBreakdown}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                        <XAxis dataKey="_id" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontWeight: 500 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontWeight: 500 }} dx={-10} />
                                        <Tooltip
                                            cursor={{ fill: 'var(--primary-light)' }}
                                            contentStyle={{
                                                borderRadius: 'var(--radius-md)',
                                                border: '1px solid var(--border)',
                                                boxShadow: 'var(--shadow-lg)',
                                                background: 'var(--bg-secondary)'
                                            }}
                                            formatter={(value) => [`₹${value}`, 'Generated Revenue']}
                                        />
                                        <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                                            {stats?.planBreakdown?.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.9} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="charts-grid" style={{ marginBottom: '2.5rem' }}>
                        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                            {(() => {
                                const methodData = Array.isArray(stats?.methodBreakdown) ? stats.methodBreakdown : [];
                                const totalCollections = methodData.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
                                const METHOD_COLORS = ['#FEDF1E', '#34d399', '#60a5fa', '#a78bfa', '#f59e0b', '#f43f5e'];

                                return (
                                    <>
                                        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            <div>
                                                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>Collections by Method</h3>
                                                <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Payment method distribution & revenue share</p>
                                            </div>
                                            {totalCollections > 0 && (
                                                <div style={{ background: 'rgba(240, 160, 32, 0.1)', border: '1px solid rgba(240, 160, 32, 0.25)', borderRadius: '8px', padding: '0.35rem 0.75rem', textAlign: 'right' }}>
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Total Collections</div>
                                                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--primary-color, #FEDF1E)' }}>₹{totalCollections.toLocaleString('en-IN')}</div>
                                                </div>
                                            )}
                                        </div>

                                        {methodData.length === 0 || totalCollections === 0 ? (
                                            <div style={{ height: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', gap: '0.75rem' }}>
                                                <IndianRupee size={36} opacity={0.3} />
                                                <p style={{ margin: 0, fontSize: '0.9rem' }}>No payment collections recorded yet</p>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', alignItems: 'center' }}>
                                                {/* Donut Chart with Center Total */}
                                                <div style={{ position: 'relative', width: '100%', height: 230 }}>
                                                    <ResponsiveContainer width="100%" height={230}>
                                                        <PieChart>
                                                            <Pie
                                                                data={methodData}
                                                                innerRadius={62}
                                                                outerRadius={90}
                                                                paddingAngle={5}
                                                                dataKey="value"
                                                                nameKey="_id"
                                                                stroke="none"
                                                                cornerRadius={6}
                                                            >
                                                                {methodData.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={METHOD_COLORS[index % METHOD_COLORS.length]} />
                                                                ))}
                                                            </Pie>
                                                            <Tooltip
                                                                content={({ active, payload }) => {
                                                                    if (!active || !payload?.length) return null;
                                                                    const item = payload[0];
                                                                    const pct = totalCollections ? ((item.value / totalCollections) * 100).toFixed(1) : 0;
                                                                    return (
                                                                        <div style={{
                                                                            background: 'var(--bg-secondary, #2D251C)',
                                                                            border: '1px solid var(--border-color, #3A3025)',
                                                                            borderRadius: '10px',
                                                                            padding: '10px 14px',
                                                                            boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                                                                        }}>
                                                                            <p style={{ color: 'var(--text-secondary, #A39686)', fontSize: 12, marginBottom: 4, fontWeight: 600 }}>{item.name || item.payload._id}</p>
                                                                            <p style={{ color: item.color || '#FEDF1E', fontWeight: 800, fontSize: 14, margin: 0 }}>
                                                                                ₹{Number(item.value).toLocaleString('en-IN')} <span style={{ fontSize: 11, color: 'var(--text-muted, #6D6154)', fontWeight: 500 }}>({pct}%)</span>
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
                                                        <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>TOTAL</div>
                                                        <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                                            ₹{totalCollections >= 100000 ? `${(totalCollections / 100000).toFixed(1)}L` : totalCollections >= 1000 ? `${(totalCollections / 1000).toFixed(1)}K` : totalCollections}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Interactive Legend with Progress Bars */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                    {methodData.map((item, idx) => {
                                                        const color = METHOD_COLORS[idx % METHOD_COLORS.length];
                                                        const val = Number(item.value) || 0;
                                                        const pct = totalCollections ? Math.round((val / totalCollections) * 100) : 0;
                                                        return (
                                                            <div key={idx} style={{ background: 'var(--bg-tertiary, rgba(255,255,255,0.03))', borderRadius: '10px', padding: '0.65rem 0.85rem', border: '1px solid var(--border, rgba(255,255,255,0.05))' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                        <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
                                                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item._id || 'Other'}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>₹{val.toLocaleString('en-IN')}</span>
                                                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginLeft: '0.35rem', fontWeight: 600 }}>({pct}%)</span>
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
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </>
            )}

            <div className="charts-grid" style={{ marginTop: '2.5rem' }}>
                {activeLiveSessions.length > 0 && (
                    <div className="card" style={{ gridColumn: '1 / -1', marginBottom: '1.5rem', border: '2px solid var(--primary-color)', borderRadius: 'var(--radius-lg)', background: 'var(--bg)' }}>
                        <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.5rem', letterSpacing: '0.05em' }}>
                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: 'var(--primary-color)', boxShadow: '0 0 15px var(--primary-color)', animation: 'pulse 1.5s infinite alternate' }}></div>
                            CURRENTLY ACTIVE MEMBERS (LIVE)
                        </h3>
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Members currently working out in your gym right now.
                        </p>
                        
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Member Name</th>
                                        <th>Phone</th>
                                        <th>Time Left</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeLiveSessions.map(session => (
                                        <tr key={session.id} style={{ transition: 'var(--transition)' }}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600 }}>
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--success), #10B981)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold', boxShadow: '0 0 10px rgba(16, 185, 129, 0.3)' }}>
                                                        {session.memberName.charAt(0).toUpperCase()}
                                                    </div>
                                                    {session.memberName}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                                                    <Phone size={14} />
                                                    {session.memberPhone}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <Clock size={14} style={{ color: 'var(--success)' }} />
                                                    <LiveSessionTimer expiresAt={session.expiresAt} />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="card" style={{ gridColumn: '1 / -1' }}>
                    <h3 style={{ marginBottom: '1.5rem' }}>Recent Check-ins (This Month)</h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        History of members who have visited your gym recently.
                    </p>
                    
                    {recentCheckins.length > 0 ? (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Member Name</th>
                                        <th>Date</th>
                                        <th>Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentCheckins.map(checkin => (
                                        <tr key={checkin.id} style={{ transition: 'var(--transition)' }}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600 }}>
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--accent))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                                        {checkin.memberName.charAt(0).toUpperCase()}
                                                    </div>
                                                    {checkin.memberName}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                                                    <Calendar size={14} />
                                                    {new Date(checkin.date).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                                                    <Clock size={14} />
                                                    {checkin.checkInTime}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon"></div>
                            <h3>No Recent Activity</h3>
                            <p>No members have checked in this month yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

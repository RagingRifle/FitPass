import { useState, useEffect, useContext } from 'react';
import { getStats, getMembers } from '../services/apiService';
import { AuthContext } from '../context/AuthContext';
import API from '../services/api';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import { Users, CheckCircle2, AlertTriangle, Clock, Sparkles, IndianRupee, TrendingDown, TrendingUp, Megaphone, Check, QrCode, Calendar, Phone, ChevronDown, Building2, Loader } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import './dashboard.css';

const COLORS = ['var(--primary-color)', 'var(--accent-color)', '#a855f7', '#d946ef', '#f43f5e'];
const dateInputValue = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

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

const DashboardMetricCard = ({ icon, label, value, detail, tone }) => (
    <article className={`dashboard-metric-card dashboard-metric-card--${tone}`}>
        <div className="dashboard-metric-copy">
            <p className="dashboard-metric-label">{label}</p>
            <strong className="dashboard-metric-value">{value}</strong>
            <p className="dashboard-metric-detail">{detail}</p>
        </div>
        <span className="dashboard-metric-icon" aria-hidden="true">{icon}</span>
    </article>
);

const Dashboard = () => {
    const { user, activeDivision, selectedGymId, changeSelectedGym, selectedBranchId, changeSelectedBranch } = useContext(AuthContext);
    const normalizedGym = (user?.gymName || user?.gymId?.name || '').toUpperCase();
    const userGymId = user?.gymId?._id || user?.gymId || '';
    const isH4User = ['h4_admin', 'h4_branch_admin'].includes(user?.role) || normalizedGym === 'H4' || userGymId === '05a08fdf-7427-48a5-8b25-e18d5a5668cd' || (activeDivision === 'h4' && !['partner'].includes(user?.role));
    const [stats, setStats] = useState(null);
    const [expiringMembers, setExpiringMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [announceMsg, setAnnounceMsg] = useState('');
    const [showAnnounce, setShowAnnounce] = useState(false);
    const [announcing, setAnnouncing] = useState(false);
    const [announceSuccess, setAnnounceSuccess] = useState(false);
    const [showQR, setShowQR] = useState(false);
    const [gymList, setGymList] = useState([]);
    const [dateRange, setDateRange] = useState(() => {
        const end = new Date();
        const start = new Date(); start.setDate(start.getDate() - 29);
        return { startDate: dateInputValue(start), endDate: dateInputValue(end) };
    });
    const [analyticsData, setAnalyticsData] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [analyticsError, setAnalyticsError] = useState('');
    const [analyticsRetry, setAnalyticsRetry] = useState(0);
    const assignedBranch = user?.userBranchId || user?.branchId;
    const analyticsBranchId = typeof assignedBranch === 'string'
        ? assignedBranch
        : assignedBranch?._id || assignedBranch?.id || selectedBranchId || '';

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
                } else if (['partner', 'h4_admin', 'h4_branch_admin', 'admin'].includes(user?.role)) {
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
                    getStats(isH4User ? dateRange : {}),
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
    }, [activeDivision, selectedGymId, selectedBranchId, dateRange, isH4User]);

    useEffect(() => {
        if (activeDivision !== 'h4') {
            setAnalyticsData(null);
            setAnalyticsError('');
            setAnalyticsLoading(false);
            return undefined;
        }

        let cancelled = false;
        const fetchAnalytics = async () => {
            setAnalyticsLoading(true);
            setAnalyticsError('');
            try {
                const params = new URLSearchParams({
                    startDate: dateRange.startDate,
                    endDate: dateRange.endDate,
                    branchId: analyticsBranchId
                });
                const { data } = await API.get(`/analytics?${params}`);
                if (!cancelled) setAnalyticsData(data);
            } catch (error) {
                if (!cancelled) {
                    setAnalyticsData(null);
                    setAnalyticsError(error.response?.data?.message || 'Unable to load retention metrics.');
                }
            } finally {
                if (!cancelled) setAnalyticsLoading(false);
            }
        };

        fetchAnalytics();
        return () => { cancelled = true; };
    }, [activeDivision, dateRange.startDate, dateRange.endDate, analyticsBranchId, analyticsRetry]);

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
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
            <Loader className="spinner" size={40} style={{ color: 'var(--primary-color)' }} />
        </div>
    );

    const recentCheckins = stats?.recentCheckins || [];
    const activeLiveSessions = stats?.activeLiveSessions || [];

    const cards = [
        { title: 'Active Members', value: activeLiveSessions.length, icon: <CheckCircle2 size={22} />, color: 'var(--success-color)' },
        { title: 'Total Check-Ins Today', value: (stats?.todayAttendanceCount || 0) + (stats?.todaySessionsCount || 0), icon: <CheckCircle2 size={22} />, color: 'var(--warning-color)' },
    ];
    const periodSummary = stats?.periodSummary;
    const formatCurrency = (value) => `₹${Number(value).toLocaleString('en-IN')}`;

    return (
        <div className="fade-in">
            {!isH4User && (
                <div className="page-header dashboard-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div className="page-header-left">
                        <div className="dashboard-heading-row" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <h2 style={{ margin: 0 }}>{activeDivision === 'h4' ? 'Gym CRM Dashboard' : 'Partner Dashboard'}</h2>
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
            )}

            {isH4User && (
                <section aria-label="Dashboard date filter" className="dashboard-date-filter">
                    <div className="dashboard-date-fields">
                        {['superadmin', 'fitpass_admin', 'h4_admin', 'h4_branch_admin'].includes(user?.role) && !user?.branchId && (
                            <div className="dashboard-branch-picker">
                                <Building2 size={17} className="dashboard-branch-icon" aria-hidden="true" />
                                <select
                                    className="dashboard-branch-select"
                                    aria-label="Select H4 branch"
                                    value={selectedBranchId}
                                    onChange={(e) => changeSelectedBranch(e.target.value)}
                                >
                                    <option value="">H4 (All Branches)</option>
                                    {gymList.map(branch => (
                                        <option key={branch._id || branch.id} value={branch._id || branch.id}>
                                            {branch.name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={15} className="dashboard-branch-chevron" aria-hidden="true" />
                            </div>
                        )}
                        <label className="dashboard-date-field"><span>From</span><input aria-label="Start date" type="date" value={dateRange.startDate} max={dateRange.endDate} onChange={e => setDateRange(value => ({ ...value, startDate: e.target.value }))} /></label>
                        <span className="dashboard-date-separator" aria-hidden="true">→</span>
                        <label className="dashboard-date-field"><span>To</span><input aria-label="End date" type="date" value={dateRange.endDate} min={dateRange.startDate} max={dateInputValue(new Date())} onChange={e => setDateRange(value => ({ ...value, endDate: e.target.value }))} /></label>
                    </div>
                    <div className="dashboard-date-presets" aria-label="Choose a date range">{[7, 30, 90].map(days => {
                        const end = new Date();
                        const start = new Date();
                        start.setDate(start.getDate() - (days - 1));
                        const isSelected = dateRange.startDate === dateInputValue(start) && dateRange.endDate === dateInputValue(end);
                        return <button key={days} type="button" className={`dashboard-date-preset${isSelected ? ' is-selected' : ''}`} aria-pressed={isSelected} onClick={() => setDateRange({ startDate: dateInputValue(start), endDate: dateInputValue(end) })}>{days} days</button>;
                    })}</div>
                    <small className="dashboard-date-note">Revenue, expenses, check-ins and new joins for this period</small>
                </section>
            )}

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

            {activeDivision === 'h4' ? (
                <div className="dashboard-insights">
                    <section className="dashboard-insight-section" aria-labelledby="dashboard-retention-title">
                        <div className="dashboard-insight-heading">
                            <div>
                                <h3 id="dashboard-retention-title">Retention &amp; member value</h3>
                                <p>Signals across the selected period</p>
                            </div>
                            {analyticsError && (
                                <div className="dashboard-insight-error" role="status">
                                    <span>{analyticsError}</span>
                                    <button type="button" onClick={() => setAnalyticsRetry(retry => retry + 1)}>Retry</button>
                                </div>
                            )}
                        </div>
                        <div className="dashboard-metric-grid dashboard-metric-grid--four">
                            <DashboardMetricCard
                                icon={<Users size={19} />}
                                label="Inactive in Period"
                                value={analyticsLoading ? '…' : analyticsData ? (analyticsData.inactiveCount ?? 0).toLocaleString('en-IN') : '—'}
                                detail="Active members with no visits in range"
                                tone="gold"
                            />
                            <DashboardMetricCard
                                icon={<TrendingDown size={19} />}
                                label="Churn Rate"
                                value={analyticsLoading ? '…' : analyticsData ? `${analyticsData.churnRate ?? 0}%` : '—'}
                                detail={analyticsData ? `${analyticsData.expiredLast30 ?? 0} memberships expired in range` : 'Memberships expired in range'}
                                tone="red"
                            />
                            <DashboardMetricCard
                                icon={<TrendingUp size={19} />}
                                label="Renewal Rate"
                                value={analyticsLoading ? '…' : analyticsData ? `${analyticsData.renewalRate ?? 0}%` : '—'}
                                detail={analyticsData ? `${analyticsData.renewedCount ?? 0} active renewals at period end` : 'Active renewals at period end'}
                                tone="green"
                            />
                            <DashboardMetricCard
                                icon={<IndianRupee size={19} />}
                                label="Avg Lifetime Value"
                                value={analyticsLoading ? '…' : analyticsData ? formatCurrency(analyticsData.avgLTV || 0) : '—'}
                                detail="Average total revenue paid per member"
                                tone="blue"
                            />
                        </div>
                    </section>

                    <section className="dashboard-insight-section" aria-labelledby="dashboard-summary-title">
                        <div className="dashboard-insight-heading">
                            <div>
                                <h3 id="dashboard-summary-title">Period summary</h3>
                                <p>Financial, membership and attendance totals</p>
                            </div>
                        </div>
                        <div className="dashboard-metric-grid dashboard-metric-grid--six">
                            <DashboardMetricCard icon={<IndianRupee size={19} />} label="Total Revenue" value={periodSummary ? formatCurrency(periodSummary.totalRevenue) : '—'} detail="Collected in selected period" tone="gold" />
                            <DashboardMetricCard icon={<TrendingDown size={19} />} label="Total Expenses" value={periodSummary ? formatCurrency(periodSummary.totalExpenses) : '—'} detail="Recorded in selected period" tone="red" />
                            <DashboardMetricCard icon={<TrendingUp size={19} />} label="Net Profit" value={periodSummary ? formatCurrency(periodSummary.netProfit) : '—'} detail="Revenue less expenses" tone="green" />
                            <DashboardMetricCard icon={<Users size={19} />} label="Total Members" value={periodSummary ? periodSummary.totalMembers.toLocaleString('en-IN') : '—'} detail="Members in this H4 scope" tone="blue" />
                            <DashboardMetricCard icon={<CheckCircle2 size={19} />} label="Attendance in Range" value={periodSummary ? periodSummary.attendanceInRange.toLocaleString('en-IN') : '—'} detail="Check-ins in selected period" tone="teal" />
                            <DashboardMetricCard icon={<Sparkles size={19} />} label="New Members in Range" value={periodSummary ? periodSummary.newMembersInRange.toLocaleString('en-IN') : '—'} detail="Joined in selected period" tone="purple" />
                        </div>
                    </section>
                </div>
            ) : (
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
            )}

            {activeDivision === 'h4' && (
                <>
                    <div className="charts-grid" style={{ marginBottom: '2.5rem', marginTop: '2.5rem' }}>
                        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ marginBottom: '2rem' }}>Revenue in Selected Period</h3>
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
                    <h3 style={{ marginBottom: '1.5rem' }}>Recent Check-ins in Selected Period</h3>
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
                            <p>No members checked in during this date range.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

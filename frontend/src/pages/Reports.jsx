import { useState, useEffect, useCallback, useContext } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Users, Activity,
  Download, RefreshCw, Calendar, BarChart2, PieChart as PieIcon,
  Target, AlertCircle, Loader, Building2
} from 'lucide-react';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';

// ─── Design tokens ────────────────────────────────────────────────────────
const C = {
  primary:   '#FEDF1E',
  gold:      '#92700A',
  dark:      '#D9860F',
  success:   '#1E8E3E',
  error:     '#C62828',
  info:      '#1976D2',
  purple:    '#7B1FA2',
  teal:      '#00796B',
  bgCard:    'var(--bg)',
  bgMuted:   'var(--bg-secondary)',
  border:    'var(--border)',
  text:      'var(--text-primary)',
  textMuted: 'var(--text-muted)',
};

const PIE_COLORS = ['#92700A', C.info, C.success, C.error, C.purple, C.teal, '#E65100', '#37474F'];

// ─── Helpers ──────────────────────────────────────────────────────────────
const fmt  = (n) => (n ?? 0).toLocaleString('en-IN');
const fmtR = (n) => `₹${fmt(Math.round(n ?? 0))}`;
const pct  = (n) => `${(n ?? 0).toFixed(1)}%`;

const cleanPlanName = (name) => {
  if (!name) return 'General Plan';
  const str = String(name).trim();
  if (!str) return 'General Plan';
  if (/^[0-9a-fA-F-]{18,}$/.test(str)) {
    return 'Custom Membership';
  }
  return str;
};

const formatPlanSliceLabel = ({ name, percent }) => {
  if (percent < 0.05) return '';
  const clean = cleanPlanName(name);
  const truncated = clean.length > 14 ? `${clean.slice(0, 13)}…` : clean;
  return `${truncated} ${(percent * 100).toFixed(0)}%`;
};

// ─── Custom tooltip ───────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, prefix = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg)',
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: '0.75rem 1rem',
      fontSize: '0.82rem',
      boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{ fontWeight: 800, color: C.text, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || C.gold, display: 'flex', gap: 8, alignItems: 'center', marginTop: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: C.textMuted }}>{p.name}:</span>
          <span style={{ fontWeight: 800, color: C.text }}>{prefix}{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, sub, iconColor = C.gold, trend, trendVal }) => (
  <div style={{
    background: 'var(--bg)',
    border: `1px solid ${C.border}`,
    borderRadius: 'var(--radius-card, 14px)',
    padding: '1.25rem 1.35rem',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--shadow-sm)',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{
        width: 38,
        height: 38,
        borderRadius: 10,
        background: 'var(--bg-secondary)',
        border: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: iconColor,
      }}>
        <Icon size={18} />
      </div>
      {trendVal !== undefined && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: '0.72rem',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 999,
          background: trend === 'up' ? 'rgba(30, 142, 62, 0.08)' : 'rgba(217, 48, 37, 0.08)',
          color: trend === 'up' ? C.success : C.error,
        }}>
          {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {trendVal}
        </div>
      )}
    </div>
    <div style={{
      fontSize: '0.72rem',
      fontWeight: 700,
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      marginTop: 10,
    }}>
      {label}
    </div>
    <div style={{
      fontSize: '1.65rem',
      fontWeight: 900,
      color: 'var(--text-primary)',
      lineHeight: 1.15,
      marginTop: 2,
      fontFamily: "'Outfit', sans-serif",
    }}>
      {value}
    </div>
    {sub && (
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
        {sub}
      </div>
    )}
  </div>
);

// ─── Section header ───────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, title, sub }) => (
  <div style={{ marginBottom: '1.15rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7,
        background: 'var(--bg-secondary)', border: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: C.gold
      }}>
        <Icon size={15} />
      </div>
      <h3 style={{ fontWeight: 800, fontSize: '1.05rem', color: C.text, margin: 0, fontFamily: "'Outfit', sans-serif" }}>
        {title}
      </h3>
    </div>
    {sub && <p style={{ fontSize: '0.78rem', color: C.textMuted, margin: '4px 0 0 34px' }}>{sub}</p>}
  </div>
);

// ─── Chart card wrapper ───────────────────────────────────────────────────
const ChartCard = ({ children, style = {} }) => (
  <div style={{
    background: 'var(--bg)',
    border: `1px solid ${C.border}`,
    borderRadius: 'var(--radius-card, 14px)',
    padding: '1.35rem 1.5rem',
    boxShadow: 'var(--shadow-sm)',
    ...style,
  }}>
    {children}
  </div>
);

// ─── Main Reports Component ───────────────────────────────────────────────
const Reports = () => {
  const { user, activeDivision, selectedBranchId } = useContext(AuthContext);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-12-31`);
  const [branchId, setBranchId] = useState(selectedBranchId || '');
  const [branches, setBranches] = useState([]);
  const isH4 = activeDivision === 'h4' || ['h4_admin', 'h4_branch_admin'].includes(user?.role);
  const lockedBranch = ['h4_admin', 'h4_branch_admin'].includes(user?.role) && (user?.userBranchId || user?.branchId);

  useEffect(() => {
    if (isH4) API.get('/branches').then(({ data }) => setBranches(data || [])).catch(() => setBranches([]));
  }, [isH4]);

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDl] = useState('');
  const [activeTab, setTab] = useState('overview'); // 'overview' | 'revenue' | 'members' | 'export'

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ year, startDate, endDate, branchId: lockedBranch || branchId || '' });
      const { data } = await API.get(`/reports/summary?${params}`);
      setSummary(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report data. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  }, [year, startDate, endDate, branchId, lockedBranch]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // CSV download
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const downloadCsv = async (type) => {
    setDl(type);
    try {
      const res = await API.get(`/reports/${type}?month=${month}&year=${year}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.setAttribute('download', `${type}_${month}_${year}.csv`);
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error('Download failed', e);
    } finally {
      setDl('');
    }
  };

  const MONTH_LABELS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const YEARS = [currentYear, currentYear - 1, currentYear - 2];

  // Navigation Tabs configuration
  const tabs = [
    { id: 'overview',  label: 'Overview',       icon: BarChart2  },
    { id: 'revenue',   label: 'Revenue & P&L',  icon: DollarSign },
    { id: 'members',   label: 'Members',        icon: Users      },
    { id: 'export',    label: 'Export CSV',     icon: Download   },
  ];

  // Universal centered loading state matching FitPass Reports
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Loader className="spinner" size={40} style={{ color: 'var(--primary-color)' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem 1.5rem', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'rgba(198, 40, 40, 0.08)',
          border: `1px solid ${C.error}`,
          borderRadius: 12,
          padding: '1.25rem',
          marginBottom: 16
        }}>
          <AlertCircle size={20} color={C.error} />
          <div>
            <div style={{ fontWeight: 800, color: C.error, fontSize: '0.9rem' }}>Failed to load reports</div>
            <div style={{ fontSize: '0.82rem', color: C.textMuted, marginTop: 2 }}>{error}</div>
          </div>
        </div>
        <button
          onClick={fetchSummary}
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const m = summary || {};
  const tm = m.topMetrics || {};

  return (
    <div className="fade-in" style={{ padding: '1.5rem', maxWidth: 1400, margin: '0 auto' }}>

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: '1.5rem'
      }}>
        <div>
          <h1 style={{
            fontSize: '1.75rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            margin: 0,
            fontFamily: "'Outfit', sans-serif",
            letterSpacing: '-0.03em'
          }}>
            Business Intelligence
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            Revenue, member acquisition, attendance patterns, and branch operations
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            value={year}
            onChange={e => {
              const nextYear = Number(e.target.value);
              setYear(nextYear);
              setStartDate(`${nextYear}-01-01`);
              setEndDate(`${nextYear}-12-31`);
            }}
            className="input"
            style={{
              height: '38px',
              padding: '0 0.85rem',
              background: '#FFFFFF',
              fontSize: '0.85rem',
              fontWeight: 600,
              margin: 0,
              cursor: 'pointer'
            }}
          >
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <button
            onClick={fetchSummary}
            className="btn btn-secondary"
            style={{ height: '38px', padding: '0 0.95rem', fontSize: '0.82rem', fontWeight: 700 }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '1rem',
        flexWrap: 'wrap',
        padding: '0.9rem 1.25rem',
        background: 'var(--bg-secondary)',
        border: `1px solid ${C.border}`,
        borderRadius: 'var(--radius-card, 14px)',
        marginBottom: '1.5rem',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          From Date
          <input
            className="input"
            type="date"
            value={startDate}
            max={endDate}
            onChange={e => setStartDate(e.target.value)}
            style={{ height: '38px', padding: '0 0.75rem', background: '#FFFFFF', fontSize: '0.82rem', margin: 0 }}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          To Date
          <input
            className="input"
            type="date"
            value={endDate}
            min={startDate}
            onChange={e => setEndDate(e.target.value)}
            style={{ height: '38px', padding: '0 0.75rem', background: '#FFFFFF', fontSize: '0.82rem', margin: 0 }}
          />
        </label>

        {isH4 && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Branch
            <select
              className="input"
              disabled={Boolean(lockedBranch)}
              value={lockedBranch || branchId}
              onChange={e => setBranchId(e.target.value)}
              style={{ height: '38px', padding: '0 0.75rem', background: '#FFFFFF', fontSize: '0.82rem', margin: 0, minWidth: '170px' }}
            >
              <option value="">All branches</option>
              {branches.map(branch => <option key={branch._id} value={branch._id}>{branch.name}</option>)}
            </select>
          </label>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            All report totals and charts update for this selected date range.
          </span>
        </div>
      </div>

      {/* ── Tabs Navigation ─────────────────────────────────────────── */}
      <div style={{
        display: 'inline-flex',
        gap: 4,
        background: 'var(--bg-secondary)',
        borderRadius: 12,
        padding: 4,
        border: `1px solid ${C.border}`,
        marginBottom: '1.5rem',
      }}>
        {tabs.map(t => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '0.5rem 1.15rem',
                borderRadius: 9,
                border: 'none',
                background: active ? 'var(--primary)' : 'transparent',
                color: active ? '#000000' : 'var(--text-secondary)',
                fontWeight: active ? 800 : 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.16s ease',
                whiteSpace: 'nowrap',
                boxShadow: active ? '0 2px 6px rgba(180, 150, 0, 0.2)' : 'none',
              }}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ══════════════════ OVERVIEW TAB ══════════════════════════════ */}
      {activeTab === 'overview' && (
        <>
          {/* KPI Row (Revamped Minimalist Cards) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <KpiCard icon={DollarSign} label="Total Revenue" value={fmtR(tm.totalRevenue)} sub="Selected date range" iconColor="#92700A" />
            <KpiCard icon={TrendingDown} label="Total Expenses" value={fmtR(tm.totalExpenses)} sub="Selected date range" iconColor="#C62828" />
            <KpiCard icon={TrendingUp} label="Net Profit" value={fmtR(tm.netProfit)} sub={tm.netProfit >= 0 ? 'Profitable' : 'Loss'} iconColor={tm.netProfit >= 0 ? '#1E8E3E' : '#C62828'} />
            <KpiCard icon={Users} label="Total Members" value={fmt(m.memberStatusSummary?.total)} sub={`${fmt(m.memberStatusSummary?.active)} active`} iconColor="#1976D2" />
            <KpiCard icon={Activity} label="Attendance in Range" value={fmt(tm.totalAttendanceThisMonth)} sub="check-ins in range" iconColor="#00796B" />
            <KpiCard icon={Target} label="New Members in Range" value={fmt(tm.newMembersThisMonth)} sub="joined in range" iconColor="#7B1FA2" />
          </div>

          {/* Revenue + Expenses Area Chart */}
          <ChartCard style={{ marginBottom: '1.25rem' }}>
            <SectionHeader icon={TrendingUp} title="Revenue vs Expenses — Monthly" sub="Selected date range trend" />
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={m.revenueByMonth || []} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FEDF1E" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#FEDF1E" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C62828" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#C62828" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <Tooltip content={<CustomTooltip prefix="₹" />} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#BFA044" fill="url(#revGrad)" strokeWidth={2.5} dot={false} />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke={C.error} fill="url(#expGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Bottom row: Plan popularity + Attendance by day */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            <ChartCard>
              <SectionHeader icon={PieIcon} title="Plan Popularity" sub="Members enrolled per plan" />
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={(m.planPopularity || []).map(p => ({ ...p, name: cleanPlanName(p.name) }))}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={90}
                    dataKey="members"
                    nameKey="name"
                    paddingAngle={3}
                    label={formatPlanSliceLabel}
                    labelLine={false}
                  >
                    {(m.planPopularity || []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v + ' members', cleanPlanName(n)]} contentStyle={{ background:'var(--bg)', border:`1px solid ${C.border}`, borderRadius:8, fontSize:12 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard>
              <SectionHeader icon={Activity} title="Attendance by Day of Week" sub="Last 90 days distribution" />
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={m.attendanceByDay || []} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Check-ins" radius={[6,6,0,0]}>
                    {(m.attendanceByDay || []).map((_, i) => <Cell key={i} fill={i === 0 ? '#FEDF1E' : '#DFD7C7'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}

      {/* ══════════════════ REVENUE TAB ═══════════════════════════════ */}
      {activeTab === 'revenue' && (
        <>
          {/* P&L summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <KpiCard icon={DollarSign} label="Total Revenue" value={fmtR(tm.totalRevenue)} iconColor="#92700A" />
            <KpiCard icon={TrendingDown} label="Total Expenses" value={fmtR(tm.totalExpenses)} iconColor="#C62828" />
            <KpiCard icon={TrendingUp} label="Net Profit" value={fmtR(tm.netProfit)} iconColor={tm.netProfit >= 0 ? '#1E8E3E' : '#C62828'} />
            <KpiCard icon={Users} label="Revenue / Member" value={fmtR(tm.avgRevenuePerMember)} sub="average" iconColor="#1976D2" />
          </div>

          {/* Bar chart: Revenue vs Expenses per month */}
          <ChartCard style={{ marginBottom: '1.25rem' }}>
            <SectionHeader icon={BarChart2} title="Monthly P&L Breakdown" sub="Revenue vs expenses in selected date range" />
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={m.revenueByMonth || []} margin={{ top: 5, right: 10, left: 10, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <Tooltip content={<CustomTooltip prefix="₹" />} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
                <Bar dataKey="revenue" name="Revenue" fill="#FEDF1E" radius={[4,4,0,0]} />
                <Bar dataKey="expenses" name="Expenses" fill={C.error} radius={[4,4,0,0]} />
                <Bar dataKey="profit" name="Profit" fill={C.success} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Expense by category pie */}
          <ChartCard>
            <SectionHeader icon={PieIcon} title="Expenses by Category" sub="Breakdown for selected date range" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'center' }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={m.expenseByCategory || []}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={85}
                    dataKey="amount"
                    nameKey="category"
                    paddingAngle={3}
                  >
                    {(m.expenseByCategory || []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [fmtR(v), 'Amount']} contentStyle={{ background:'var(--bg)', border:`1px solid ${C.border}`, borderRadius:8, fontSize:12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(m.expenseByCategory || []).map((cat, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{cat.category}</span>
                    </div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>{fmtR(cat.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        </>
      )}

      {/* ══════════════════ MEMBERS TAB ═══════════════════════════════ */}
      {activeTab === 'members' && (
        <>
          {/* Member status donut + KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <KpiCard icon={Users} label="Total Members" value={fmt(m.memberStatusSummary?.total)} iconColor="#1976D2" />
            <KpiCard icon={Activity} label="Active Members" value={fmt(m.memberStatusSummary?.active)} iconColor="#1E8E3E" />
            <KpiCard icon={AlertCircle} label="Expired" value={fmt(m.memberStatusSummary?.expired)} iconColor="#C62828" />
            <KpiCard icon={Target} label="New This Month" value={fmt(tm.newMembersThisMonth)} iconColor="#7B1FA2" />
          </div>

          {/* New members trend */}
          <ChartCard style={{ marginBottom: '1.25rem' }}>
            <SectionHeader icon={TrendingUp} title="New Member Acquisition — Monthly" sub="Members who joined in selected date range" />
            <ResponsiveContainer width="100%" height={270}>
              <AreaChart data={m.newMembersByMonth || []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="memberGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1976D2" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#1976D2" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="count" name="New Members" stroke="#1976D2" fill="url(#memberGrad)" strokeWidth={2.5} dot={{ fill: '#1976D2', r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Bottom row: Plan popularity table + Attendance heatmap */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            <ChartCard>
              <SectionHeader icon={Target} title="Plan Popularity" sub="Members & revenue per plan" />
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      {['Plan', 'Members', 'Revenue'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '0.55rem 0.75rem', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(m.planPopularity || []).map((p, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-primary)', fontWeight: 600 }}>{cleanPlanName(p.name)}</td>
                        <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-secondary)' }}>{p.members}</td>
                        <td style={{ padding: '0.65rem 0.75rem', color: '#92700A', fontWeight: 800 }}>{fmtR(p.revenue)}</td>
                      </tr>
                    ))}
                    {!(m.planPopularity?.length) && (
                      <tr><td colSpan={3} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>No plan data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </ChartCard>

            <ChartCard>
              <SectionHeader icon={Activity} title="Attendance by Day" sub="Last 90 days — busiest days" />
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={m.attendanceByDay || []} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Check-ins" radius={[6,6,0,0]}>
                    {(m.attendanceByDay || []).map((entry, i) => {
                      const max = Math.max(...(m.attendanceByDay || []).map(d => d.count), 1);
                      const intensity = 0.35 + 0.65 * (entry.count / max);
                      return <Cell key={i} fill="#FEDF1E" fillOpacity={intensity} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}

      {/* ══════════════════ EXPORT TAB ════════════════════════════════ */}
      {activeTab === 'export' && (
        <div style={{ maxWidth: 600 }}>
          <ChartCard>
            <SectionHeader icon={Download} title="Export Reports as CSV" sub="Select month & year, then download" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Month</label>
                <select
                  value={month}
                  onChange={e => setMonth(Number(e.target.value))}
                  className="input"
                  style={{ width: '100%', height: '40px', background: '#FFFFFF', fontSize: '0.85rem' }}
                >
                  {MONTH_LABELS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Year</label>
                <select
                  value={year}
                  onChange={e => setYear(Number(e.target.value))}
                  className="input"
                  style={{ width: '100%', height: '40px', background: '#FFFFFF', fontSize: '0.85rem' }}
                >
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { key: 'revenue',  label: 'Revenue Report',  desc: 'All payments received — member, amount, method, date', color: '#92700A' },
                { key: 'expenses', label: 'Expense Report',  desc: 'All expenses — title, category, amount, date',         color: '#C62828' },
              ].map(r => (
                <button
                  key={r.key}
                  onClick={() => downloadCsv(r.key)}
                  disabled={downloading === r.key}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '1.1rem 1.25rem',
                    borderRadius: 12,
                    border: `1px solid ${C.border}`,
                    background: 'var(--bg-secondary)',
                    cursor: downloading === r.key ? 'wait' : 'pointer',
                    transition: 'all 0.18s',
                    opacity: downloading && downloading !== r.key ? 0.5 : 1,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = r.color; e.currentTarget.style.background = '#FFFFFF'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                >
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 800, color: r.color, fontSize: '0.92rem' }}>{r.label}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}>{r.desc}</div>
                  </div>
                  <div style={{ flexShrink: 0, marginLeft: 12 }}>
                    {downloading === r.key
                      ? <Loader size={18} className="spinner" style={{ color: r.color }} />
                      : <Download size={18} color={r.color} />
                    }
                  </div>
                </button>
              ))}
            </div>

            <div style={{ marginTop: '1.5rem', padding: '0.85rem 1rem', background: 'var(--bg-secondary)', border: `1px solid ${C.border}`, borderRadius: 10, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Tip:</strong> CSV files open directly in Excel, Google Sheets, or any accounting spreadsheet.
            </div>
          </ChartCard>
        </div>
      )}
    </div>
  );
};

export default Reports;

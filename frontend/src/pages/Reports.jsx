import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Users, Activity,
  Download, RefreshCw, Calendar, BarChart2, PieChart as PieIcon,
  Target, AlertCircle
} from 'lucide-react';
import API from '../services/api';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  primary:   '#FEDF1E',
  dark:      '#D9860F',
  success:   '#2E7D32',
  error:     '#C62828',
  info:      '#1976D2',
  purple:    '#7B1FA2',
  teal:      '#00796B',
  bgCard:    'var(--bg-secondary)',
  border:    'var(--border)',
  text:      'var(--text-primary)',
  textMuted: 'var(--text-secondary)',
};

const PIE_COLORS = [C.primary, C.info, C.success, C.error, C.purple, C.teal, '#E65100', '#37474F'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt  = (n) => (n ?? 0).toLocaleString('en-IN');
const fmtR = (n) => `₹${fmt(Math.round(n ?? 0))}`;
const pct  = (n) => `${(n ?? 0).toFixed(1)}%`;

// ─── Custom tooltip ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, prefix = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg)',
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: '0.75rem 1rem',
      fontSize: '0.82rem',
      boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
    }}>
      <div style={{ fontWeight: 700, color: C.text, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || C.primary, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: C.textMuted }}>{p.name}:</span>
          <span style={{ fontWeight: 700 }}>{prefix}{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, sub, color, trend, trendVal }) => (
  <div style={{
    background: C.bgCard,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: '1.25rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    position: 'relative',
    overflow: 'hidden',
  }}>
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 3,
      background: color, borderRadius: '12px 12px 0 0'
    }} />
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} color={color} />
      </div>
      {trendVal !== undefined && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: '0.72rem', fontWeight: 700,
          color: trend === 'up' ? C.success : C.error,
        }}>
          {trend === 'up' ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {trendVal}
        </div>
      )}
    </div>
    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 8 }}>{label}</div>
    <div style={{ fontSize: '1.65rem', fontWeight: 900, color: C.text, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: '0.75rem', color: C.textMuted }}>{sub}</div>}
  </div>
);

// ─── Section header ───────────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, title, sub }) => (
  <div style={{ marginBottom: '1rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <Icon size={17} color={C.primary} />
      <h3 style={{ fontWeight: 800, fontSize: '1rem', color: C.text, margin: 0 }}>{title}</h3>
    </div>
    {sub && <p style={{ fontSize: '0.78rem', color: C.textMuted, margin: '2px 0 0 26px' }}>{sub}</p>}
  </div>
);

// ─── Chart card wrapper ───────────────────────────────────────────────────────
const ChartCard = ({ children, style = {} }) => (
  <div style={{
    background: C.bgCard,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    padding: '1.25rem 1.5rem',
    ...style,
  }}>
    {children}
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
const Reports = () => {
  const currentYear = new Date().getFullYear();
  const [year, setYear]         = useState(currentYear);
  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [downloading, setDl]    = useState('');
  const [activeTab, setTab]     = useState('overview'); // 'overview' | 'revenue' | 'members' | 'export'

  // ── Fetch summary ──────────────────────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await API.get(`/reports/summary?year=${year}`);
      setSummary(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report data. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // ── CSV download ───────────────────────────────────────────────────────────
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const downloadCsv = async (type) => {
    setDl(type);
    try {
      const res = await API.get(`/reports/${type}?month=${month}&year=${year}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a   = document.createElement('a');
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

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MONTH_LABELS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const YEARS = [currentYear, currentYear - 1, currentYear - 2];

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'overview',  label: 'Overview',       icon: BarChart2  },
    { id: 'revenue',   label: 'Revenue & P&L',  icon: DollarSign },
    { id: 'members',   label: 'Members',        icon: Users      },
    { id: 'export',    label: 'Export CSV',     icon: Download   },
  ];

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <RefreshCw size={20} color={C.primary} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ color: C.textMuted, fontSize: '0.875rem' }}>Loading business intelligence data…</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} style={{ height: 110, borderRadius: 12, background: C.bgCard, animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );

  if (error) return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: `${C.error}12`, border: `1px solid ${C.error}40`, borderRadius: 12, padding: '1rem 1.25rem', marginBottom: 16 }}>
        <AlertCircle size={18} color={C.error} />
        <div>
          <div style={{ fontWeight: 700, color: C.error, fontSize: '0.875rem' }}>Failed to load reports</div>
          <div style={{ fontSize: '0.8rem', color: C.textMuted, marginTop: 2 }}>{error}</div>
        </div>
      </div>
      <button onClick={fetchSummary} style={{ display:'flex', alignItems:'center', gap:8, padding:'0.5rem 1.25rem', borderRadius:8, background:C.primary, color:'var(--bg)', fontWeight:700, border:'none', cursor:'pointer', fontSize:'0.875rem' }}>
        <RefreshCw size={14} /> Retry
      </button>
    </div>
  );

  const m = summary || {};
  const tm = m.topMetrics || {};

  return (
    <div className="fade-in" style={{ padding: '1.5rem', maxWidth: 1400, margin: '0 auto' }}>

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: C.text, margin: 0 }}>Business Intelligence</h1>
          <p style={{ fontSize: '0.82rem', color: C.textMuted, margin: '4px 0 0' }}>
            Revenue, members, attendance & performance insights
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{ padding: '0.4rem 0.75rem', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg)', color: C.text, fontSize: '0.875rem', cursor: 'pointer' }}
          >
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={fetchSummary}
            style={{ padding: '0.4rem 0.75rem', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, background: C.bgCard, borderRadius: 10, padding: 4, border: `1px solid ${C.border}`, marginBottom: '1.5rem', width: 'fit-content' }}>
        {tabs.map(t => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0.45rem 1rem',
                borderRadius: 8,
                border: 'none',
                background: active ? C.primary : 'transparent',
                color: active ? 'var(--bg)' : C.textMuted,
                fontWeight: active ? 700 : 500,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.18s',
                whiteSpace: 'nowrap',
              }}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ══════════════════ OVERVIEW TAB ══════════════════════════════ */}
      {activeTab === 'overview' && (
        <>
          {/* KPI Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: 12, marginBottom: '1.5rem' }}>
            <KpiCard icon={DollarSign}  label="Total Revenue"           value={fmtR(tm.totalRevenue)}       sub={`${year} year-to-date`}          color={C.primary} />
            <KpiCard icon={TrendingDown} label="Total Expenses"          value={fmtR(tm.totalExpenses)}      sub={`${year} year-to-date`}          color={C.error}   />
            <KpiCard icon={TrendingUp}  label="Net Profit"              value={fmtR(tm.netProfit)}          sub={tm.netProfit >= 0 ? 'Profitable' : 'Loss'} color={tm.netProfit >= 0 ? C.success : C.error} />
            <KpiCard icon={Users}       label="Total Members"           value={fmt(m.memberStatusSummary?.total)} sub={`${fmt(m.memberStatusSummary?.active)} active`} color={C.info} />
            <KpiCard icon={Activity}    label="Attendance This Month"   value={fmt(tm.totalAttendanceThisMonth)} sub="check-ins this month"        color={C.teal}    />
            <KpiCard icon={Target}      label="New Members This Month"  value={fmt(tm.newMembersThisMonth)} sub="joined this month"              color={C.purple}  />
          </div>

          {/* Revenue + Expenses 12-month area chart */}
          <ChartCard style={{ marginBottom: '1.25rem' }}>
            <SectionHeader icon={TrendingUp} title="Revenue vs Expenses — Monthly" sub={`Full year ${year} overview`} />
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={m.revenueByMonth || []} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.primary} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={C.primary} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.error} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={C.error} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={`${C.border}`} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <Tooltip content={<CustomTooltip prefix="₹" />} />
                <Legend wrapperStyle={{ fontSize: 12, color: C.textMuted }} />
                <Area type="monotone" dataKey="revenue"  name="Revenue"  stroke={C.primary} fill="url(#revGrad)" strokeWidth={2.5} dot={false} />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke={C.error}   fill="url(#expGrad)" strokeWidth={2} dot={false} />
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
                    data={m.planPopularity || []}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={90}
                    dataKey="members"
                    nameKey="name"
                    paddingAngle={3}
                    label={({ name, percent }) => `${name?.split(' ')[0]} ${(percent*100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {(m.planPopularity || []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v + ' members', n]} contentStyle={{ background:'var(--bg)', border:`1px solid ${C.border}`, borderRadius:8, fontSize:12 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard>
              <SectionHeader icon={Activity} title="Attendance by Day of Week" sub="Last 90 days" />
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={m.attendanceByDay || []} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Check-ins" radius={[6,6,0,0]}>
                    {(m.attendanceByDay || []).map((_, i) => <Cell key={i} fill={i === 0 ? C.primary : `${C.primary}80`} />)}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: '1.5rem' }}>
            <KpiCard icon={DollarSign}  label="Total Revenue"  value={fmtR(tm.totalRevenue)}  color={C.primary} />
            <KpiCard icon={TrendingDown} label="Total Expenses" value={fmtR(tm.totalExpenses)} color={C.error} />
            <KpiCard icon={TrendingUp}  label="Net Profit"     value={fmtR(tm.netProfit)}     color={tm.netProfit >= 0 ? C.success : C.error} />
            <KpiCard icon={Users}       label="Revenue / Member" value={fmtR(tm.avgRevenuePerMember)} sub="average" color={C.info} />
          </div>

          {/* Bar chart: Revenue vs Expenses per month */}
          <ChartCard style={{ marginBottom: '1.25rem' }}>
            <SectionHeader icon={BarChart2} title="Monthly P&L Breakdown" sub={`Revenue vs Expenses — ${year}`} />
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={m.revenueByMonth || []} margin={{ top: 5, right: 10, left: 10, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <Tooltip content={<CustomTooltip prefix="₹" />} />
                <Legend wrapperStyle={{ fontSize: 12, color: C.textMuted }} />
                <Bar dataKey="revenue"  name="Revenue"  fill={C.primary} radius={[4,4,0,0]} />
                <Bar dataKey="expenses" name="Expenses" fill={C.error}   radius={[4,4,0,0]} />
                <Bar dataKey="profit"   name="Profit"   fill={C.success}  radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Expense by category pie */}
          <ChartCard>
            <SectionHeader icon={PieIcon} title="Expenses by Category" sub={`Breakdown for ${year}`} />
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
                      <span style={{ fontSize: '0.8rem', color: C.textMuted }}>{cat.category}</span>
                    </div>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: C.text }}>{fmtR(cat.amount)}</span>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: '1.5rem' }}>
            <KpiCard icon={Users}    label="Total Members"   value={fmt(m.memberStatusSummary?.total)}   color={C.primary} />
            <KpiCard icon={Activity} label="Active Members"  value={fmt(m.memberStatusSummary?.active)}  color={C.success} />
            <KpiCard icon={AlertCircle} label="Expired"      value={fmt(m.memberStatusSummary?.expired)} color={C.error}   />
            <KpiCard icon={Target}   label="New This Month"  value={fmt(tm.newMembersThisMonth)}         color={C.info}    />
          </div>

          {/* New members trend */}
          <ChartCard style={{ marginBottom: '1.25rem' }}>
            <SectionHeader icon={TrendingUp} title="New Member Acquisition — Monthly" sub={`Members who joined in ${year}`} />
            <ResponsiveContainer width="100%" height={270}>
              <AreaChart data={m.newMembersByMonth || []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="memberGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.info} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={C.info} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="count" name="New Members" stroke={C.info} fill="url(#memberGrad)" strokeWidth={2.5} dot={{ fill: C.info, r: 4 }} />
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
                        <th key={h} style={{ textAlign: 'left', padding: '0.5rem 0.75rem', color: C.textMuted, fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(m.planPopularity || []).map((p, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.border}40` }}>
                        <td style={{ padding: '0.5rem 0.75rem', color: C.text, fontWeight: 600 }}>{p.name}</td>
                        <td style={{ padding: '0.5rem 0.75rem', color: C.textMuted }}>{p.members}</td>
                        <td style={{ padding: '0.5rem 0.75rem', color: C.primary, fontWeight: 700 }}>{fmtR(p.revenue)}</td>
                      </tr>
                    ))}
                    {!(m.planPopularity?.length) && (
                      <tr><td colSpan={3} style={{ padding: '1.5rem', textAlign: 'center', color: C.textMuted }}>No plan data</td></tr>
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
                  <XAxis dataKey="day" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Check-ins" radius={[6,6,0,0]}>
                    {(m.attendanceByDay || []).map((entry, i) => {
                      const max = Math.max(...(m.attendanceByDay || []).map(d => d.count), 1);
                      const intensity = 0.3 + 0.7 * (entry.count / max);
                      return <Cell key={i} fill={C.primary} fillOpacity={intensity} />;
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
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Month</label>
                <select
                  value={month}
                  onChange={e => setMonth(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg)', color: C.text, fontSize: '0.875rem' }}
                >
                  {MONTH_LABELS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Year</label>
                <select
                  value={year}
                  onChange={e => setYear(Number(e.target.value))}
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 8, border: `1px solid ${C.border}`, background: 'var(--bg)', color: C.text, fontSize: '0.875rem' }}
                >
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { key: 'revenue',  label: 'Revenue Report',  desc: 'All payments received — member, amount, method, date', color: C.primary },
                { key: 'expenses', label: 'Expense Report',  desc: 'All expenses — title, category, amount, date',         color: C.error   },
              ].map(r => (
                <button
                  key={r.key}
                  onClick={() => downloadCsv(r.key)}
                  disabled={downloading === r.key}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '1rem 1.25rem',
                    borderRadius: 10,
                    border: `1px solid ${r.color}30`,
                    background: `${r.color}08`,
                    cursor: downloading === r.key ? 'wait' : 'pointer',
                    transition: 'all 0.18s',
                    opacity: downloading && downloading !== r.key ? 0.5 : 1,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = `${r.color}15`}
                  onMouseLeave={e => e.currentTarget.style.background = `${r.color}08`}
                >
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, color: r.color, fontSize: '0.9rem' }}>{r.label}</div>
                    <div style={{ fontSize: '0.75rem', color: C.textMuted, marginTop: 2 }}>{r.desc}</div>
                  </div>
                  <div style={{ flexShrink: 0, marginLeft: 12 }}>
                    {downloading === r.key
                      ? <RefreshCw size={18} color={r.color} style={{ animation: 'spin 1s linear infinite' }} />
                      : <Download size={18} color={r.color} />
                    }
                  </div>
                </button>
              ))}
            </div>

            <div style={{ marginTop: '1.25rem', padding: '0.875rem 1rem', background: `${C.info}10`, border: `1px solid ${C.info}25`, borderRadius: 8, fontSize: '0.78rem', color: C.textMuted }}>
               <strong style={{ color: C.text }}>Tip:</strong> CSV files open directly in Excel, Google Sheets, or any spreadsheet app.
            </div>
          </ChartCard>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
};

export default Reports;

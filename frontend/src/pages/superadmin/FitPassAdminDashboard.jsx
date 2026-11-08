import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, Building2, CheckCircle2, Clock3, Coins, ShoppingBag, Users, Zap } from 'lucide-react';
import API from '../../services/api';
import { dedupeMemberRecords } from '../../utils/memberIdentity';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const quickLinks = [
  { label: 'FitPass Members', description: 'Manage subscriber accounts and passes', href: '/superadmin/fitpass-members', icon: Users },
  { label: 'FitPass Reports', description: 'Review network activity and trends', href: '/superadmin/fitpass-analytics', icon: Activity },
  { label: 'Product orders', description: 'Process member purchases and track delivery', href: '/superadmin/fitpass-orders', icon: ShoppingBag },
  { label: 'Partner Gyms', description: 'Manage the FitPass gym network', href: '/superadmin/gyms', icon: Building2 },
];

export default function FitPassAdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const firstPage = await API.get('/superadmin/fitpass/members?page=1&pageSize=100');
      const totalPages = Number(firstPage.data?.meta?.totalPages) || 1;
      const remainingPages = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) =>
        API.get(`/superadmin/fitpass/members?page=${index + 2}&pageSize=100`)));
      const members = dedupeMemberRecords([
        ...(firstPage.data?.data || []),
        ...remainingPages.flatMap(page => page.data?.data || []),
      ]);
      const [overview, coinSettings] = await Promise.all([
        API.get('/superadmin/fitpass/overview'),
        API.get('/store/coin-settings?division=fitpass'),
      ]);
      if (!mounted) return;
      setData({
        accounts: firstPage.data?.meta?.total ?? members.length,
        activePasses: members.filter(member => !member.isExpired && member.status === 'Active').length,
        expiredPasses: members.filter(member => member.isExpired || member.status === 'Expired').length,
        memberCoinBalance: members.reduce((sum, member) => sum + Number(member.fitpassCoins || 0), 0),
        coinsPerCheckIn: Number(coinSettings.data?.coinsPerSession) || 10,
        overview: overview.data?.overview || {},
        mostVisitedGyms: overview.data?.mostVisitedGyms || [],
        monthlyTraffic: overview.data?.monthlyTraffic || [],
        planPopularity: overview.data?.planPopularity || [],
      });
    };
    load().catch((err) => {
      if (mounted) setError(err.response?.data?.message || 'Could not load FitPass network data.');
    });
    return () => { mounted = false; };
  }, []);

  const cards = [
    { title: 'FitPass Accounts', value: data?.accounts ?? '—', detail: 'FitPass member directory', icon: Users, color: '#a78bfa' },
    { title: 'Active Pass Holders', value: data?.activePasses ?? '—', detail: 'Current FitPass subscriptions', icon: CheckCircle2, color: '#34d399' },
    { title: 'Expired Passes', value: data?.expiredPasses ?? '—', detail: 'FitPass renewals due', icon: Clock3, color: '#f59e0b' },
    { title: 'Successful Check-ins', value: data?.overview?.totalCheckIns ?? '—', detail: 'Across FitPass partner gyms', icon: Activity, color: '#60a5fa' },
    { title: 'FitPass Sessions Used', value: data?.overview?.totalSessionsUsed ?? '—', detail: 'Check-ins consumed across passes', icon: Coins, color: '#f472b6' },
    { title: 'FitPass Revenue Collected', value: data ? `₹${Number(data.overview?.totalPaid || 0).toLocaleString('en-IN')}` : '—', detail: 'Collected from FitPass plans', icon: Zap, color: '#f472b6' },
  ];
  const coinRate = data?.coinsPerCheckIn || 10;
  const sessionsCapacity = Number(data?.overview?.totalSessionsSold || 0);
  const sessionsUsed = Number(data?.overview?.totalSessionsUsed || 0);
  const sessionsRemaining = Number(data?.overview?.totalSessionsRemaining || 0);
  const monthlyTraffic = (data?.monthlyTraffic || []).map(item => ({
    ...item,
    label: new Date(`${item.month}-02T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
  }));
  const planPopularity = data?.planPopularity || [];

  return <main style={{ minHeight: '100vh', padding: '30px clamp(18px, 3vw, 42px)', background: '#f7f5ef', color: '#24211b' }}>
    <header style={{ marginBottom: 28 }}>
      <span style={{ color: '#8d6b00', fontSize: 12, fontWeight: 800, letterSpacing: '.12em' }}>FITPASS NETWORK</span>
      <h1 style={{ margin: '8px 0', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 850 }}>FitPass Dashboard</h1>
      <p style={{ margin: 0, color: '#716b60' }}>FitPass members, partner gym activity, and FitCoins at a glance.</p>
    </header>

    {error && <div role="alert" style={{ marginBottom: 18, padding: 14, borderRadius: 12, background: '#fff1ed', color: '#9e321f' }}>{error}</div>}

    <section aria-label="FitPass metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))', gap: 16, marginBottom: 28 }}>
      {cards.map(card => <article key={card.title} style={{ padding: 20, border: '1px solid #e4dccb', borderTop: `4px solid ${card.color}`, borderRadius: 16, background: '#fff', boxShadow: '0 8px 22px rgba(49,40,20,.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><span style={{ color: '#716b60', fontSize: 12, fontWeight: 800, letterSpacing: '.06em' }}>{card.title.toUpperCase()}</span><card.icon size={20} color={card.color} /></div>
        <strong style={{ display: 'block', margin: '14px 0 6px', fontSize: 34 }}>{card.value}</strong>
        <small style={{ color: '#716b60' }}>{card.detail}</small>
      </article>)}
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, marginBottom: 18 }}>
      <article style={{ padding: 22, border: '1px solid #e4dccb', borderRadius: 16, background: '#fff' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>FitCoins to check-ins</h2>
        <p style={{ margin: '0 0 20px', color: '#716b60', fontSize: 13 }}>Current FitPass conversion rate</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><strong style={{ fontSize: 36, color: '#8d6b00' }}>{coinRate}</strong><span style={{ fontWeight: 700 }}>FitCoins = 1 check-in</span></div>
        <div style={{ marginTop: 18, padding: 15, borderRadius: 12, background: '#f7f3e8', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span>100 FitCoins</span><strong>≈ {Math.floor(100 / coinRate)} check-ins</strong>
        </div>
        <div style={{ marginTop: 12, color: '#716b60', fontSize: 13 }}>
          Member balances: <strong style={{ color: '#24211b' }}>{Number(data?.memberCoinBalance || 0).toLocaleString('en-IN')} FitCoins</strong>
          <span> · about {Math.floor(Number(data?.memberCoinBalance || 0) / coinRate).toLocaleString('en-IN')} check-ins at today’s rate</span>
        </div>
        <small style={{ display: 'block', marginTop: 8, color: '#8a8378' }}>Equivalent check-ins are estimates; member plan limits still apply.</small>
      </article>

      <article style={{ padding: 22, border: '1px solid #e4dccb', borderRadius: 16, background: '#fff' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Pass check-in capacity</h2>
        <p style={{ margin: '0 0 12px', color: '#716b60', fontSize: 13 }}>Used and remaining sessions across FitPass plans</p>
        {sessionsCapacity > 0 ? <>
          <div style={{ width: '100%', height: 220 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={[{ name: 'Pass sessions', Used: sessionsUsed, Remaining: sessionsRemaining }]} layout="vertical" margin={{ left: 8, right: 12, top: 22, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee7da" />
            <XAxis type="number" tick={{ fill: '#716b60', fontSize: 11 }} />
            <YAxis type="category" dataKey="name" hide />
            <Tooltip />
            <Bar dataKey="Used" stackId="sessions" fill="#8d6b00" radius={[7, 0, 0, 7]} />
            <Bar dataKey="Remaining" stackId="sessions" fill="#d9e7d9" radius={[0, 7, 7, 0]} />
          </BarChart></ResponsiveContainer></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#716b60', fontSize: 13 }}><span>Used <strong style={{ color: '#24211b' }}>{sessionsUsed}</strong></span><span>Remaining <strong style={{ color: '#24211b' }}>{sessionsRemaining}</strong></span><span>Total <strong style={{ color: '#24211b' }}>{sessionsCapacity}</strong></span></div>
        </> : <p style={{ color: '#716b60' }}>No FitPass session allowance data yet.</p>}
      </article>
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, marginBottom: 18 }}>
      <article style={{ padding: 22, border: '1px solid #e4dccb', borderRadius: 16, background: '#fff' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Monthly partner check-ins</h2>
        <p style={{ margin: '0 0 10px', color: '#716b60', fontSize: 13 }}>Successful FitPass visits across the network</p>
        {monthlyTraffic.length ? <div style={{ width: '100%', height: 260 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthlyTraffic} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs><linearGradient id="fitpassTrafficFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity={0.35} /><stop offset="95%" stopColor="#a78bfa" stopOpacity={0.02} /></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee7da" />
          <XAxis dataKey="label" tick={{ fill: '#716b60', fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fill: '#716b60', fontSize: 11 }} />
          <Tooltip />
          <Area type="monotone" dataKey="count" name="Check-ins" stroke="#8b5cf6" fill="url(#fitpassTrafficFill)" strokeWidth={3} />
        </AreaChart></ResponsiveContainer></div> : <p style={{ color: '#716b60' }}>No monthly check-in history yet.</p>}
      </article>
      <article style={{ padding: 22, border: '1px solid #e4dccb', borderRadius: 16, background: '#fff' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Plan uptake</h2>
        <p style={{ margin: '0 0 10px', color: '#716b60', fontSize: 13 }}>Members by FitPass plan</p>
        {planPopularity.length ? <div style={{ width: '100%', height: 260 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={planPopularity} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee7da" />
          <XAxis dataKey="planName" tick={{ fill: '#716b60', fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={55} />
          <YAxis allowDecimals={false} tick={{ fill: '#716b60', fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="memberCount" name="Pass holders" fill="#d9860f" radius={[7, 7, 0, 0]} />
        </BarChart></ResponsiveContainer></div> : <p style={{ color: '#716b60' }}>No FitPass plans yet.</p>}
      </article>
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
      <article style={{ padding: 22, border: '1px solid #e4dccb', borderRadius: 16, background: '#fff' }}>
        <h2 style={{ margin: '0 0 14px', fontSize: 18 }}>FitPass operations</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {quickLinks.map(item => <Link key={item.href} to={item.href} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 13, border: '1px solid #eee7da', borderRadius: 12, color: 'inherit', textDecoration: 'none' }}>
            <item.icon size={19} color="#8d6b00" /><span style={{ flex: 1 }}><strong style={{ display: 'block' }}>{item.label}</strong><small style={{ color: '#716b60' }}>{item.description}</small></span><ArrowRight size={16} color="#8d6b00" />
          </Link>)}
        </div>
      </article>
      <article style={{ padding: 22, border: '1px solid #e4dccb', borderRadius: 16, background: '#fff' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>Most visited partner gyms</h2>
        <p style={{ margin: '0 0 14px', color: '#716b60', fontSize: 13 }}>Successful FitPass check-ins, all time.</p>
        {data?.mostVisitedGyms?.length ? data.mostVisitedGyms.slice(0, 5).map((gym, index) => <div key={gym.gymId} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderTop: '1px solid #eee7da' }}><span>{index + 1}. {gym.gymName}</span><strong>{gym.count}</strong></div>) : <p style={{ color: '#716b60' }}>{data ? 'No partner check-ins yet.' : 'Loading FitPass data…'}</p>}
      </article>
    </section>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 22, color: '#716b60', fontSize: 12 }}><Zap size={14} /> FitPass network data only</div>
  </main>;
}

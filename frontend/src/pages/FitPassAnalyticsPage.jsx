import { useState, useEffect } from 'react';
import API from '../services/api';
import ResetFiltersButton from '../components/ResetFiltersButton';
import { 
  Users, CheckCircle, XCircle, Ticket, Activity, TrendingUp, Search, Calendar, MapPin, Loader, Zap, ChevronRight
} from 'lucide-react';

const FitPassAnalyticsPage = () => {
  const [analytics, setAnalytics] = useState(null);
  const [gymAnalytics, setGymAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loadingMemberList, setLoadingMemberList] = useState(true);
  const [selectedMemberSummary, setSelectedMemberSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [period, setPeriod] = useState('any');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [gymId, setGymId] = useState('');
  const [gymOptions, setGymOptions] = useState([]);
  const [gymsLoading, setGymsLoading] = useState(false);

  // Load analytics on mount
  useEffect(() => { fetchAnalytics(); }, [period, fromDate, toDate, gymId]);
  useEffect(() => {
    const loadMembers = async () => {
      try {
        const user = JSON.parse(sessionStorage.getItem('user') || 'null');
        const isGlobalFitPassAdmin = ['superadmin', 'fitpass_admin'].includes(user?.role);
        const { data } = await API.get(isGlobalFitPassAdmin
          ? '/superadmin/fitpass/members?pageSize=100'
          : '/members?limit=100');
        setSearchResults(isGlobalFitPassAdmin ? (data.data || []) : (data.members || []));
      } catch (err) {
        console.error('Error loading FitPass members:', err);
      } finally { setLoadingMemberList(false); }
    };
    loadMembers();
  }, []);
  useEffect(() => {
    const loadGyms = async () => {
      setGymsLoading(true);
      try {
        const { data } = await API.get('/superadmin/gyms');
        const list = Array.isArray(data) ? data : data.gyms || [];
        setGymOptions(list.map(g => ({ gymId: g._id || g.id, gymName: g.name })).filter(g => g.gymId && g.gymName));
      } catch {
        // The analytics endpoint still supplies gyms with visit activity for roles
        // that cannot access the global gym directory.
      } finally { setGymsLoading(false); }
    };
    loadGyms();
  }, []);

  const fetchAnalytics = async () => {
    try {
      if (!analytics) setLoading(true);
      const params = {};
      if (period !== 'any') { if (fromDate) params.from = fromDate; if (toDate) params.to = toDate; }
      const { data } = await API.get('/sessions/analytics', { params });
      setAnalytics(data.analytics);
      setGymOptions(current => [...new Map([...current, ...(data.analytics?.availableGyms || [])].map(g => [g.gymId, g])).values()]);
      if (gymId) {
        setGymAnalytics(null);
        const { data: gymData } = await API.get('/sessions/analytics', { params: { ...params, gymId } });
        setGymAnalytics(gymData.analytics);
      } else setGymAnalytics(null);
    } catch (err) {
      console.error('Error fetching FitPass analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const selectPreset = (preset) => {
    if (preset === 'any') { setPeriod('any'); setFromDate(''); setToDate(''); return; }
    const today = new Date();
    let from = null; let to = today;
    if (preset === 'today') from = today;
    if (preset === 'yesterday') { from = new Date(today); from.setDate(today.getDate() - 1); to = from; }
    if (preset === 'last7') { from = new Date(today); from.setDate(today.getDate() - 6); }
    if (preset === 'last30') { from = new Date(today); from.setDate(today.getDate() - 29); }
    if (preset === 'lastMonth') { from = new Date(today.getFullYear(), today.getMonth() - 1, 1); to = new Date(today.getFullYear(), today.getMonth(), 0); }
    if (preset === 'thisMonth') { from = new Date(today.getFullYear(), today.getMonth(), 1); }
    if (preset === 'thisYear') { from = new Date(today.getFullYear(), 0, 1); }
    setPeriod(preset);
    setFromDate(from ? dateKey(from) : '');
    setToDate(to === today ? dateKey(today) : dateKey(to));
  };
  const updateCustomDate = (key, value) => {
    setPeriod('custom');
    if (key === 'from') setFromDate(value); else setToDate(value);
  };

  // Search members to view their individual FitPass summary
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setSearching(true);
      const user = JSON.parse(sessionStorage.getItem('user') || 'null');
      const isGlobalFitPassAdmin = ['superadmin', 'fitpass_admin'].includes(user?.role);
      const query = encodeURIComponent(searchQuery.trim());
      const { data } = await API.get(isGlobalFitPassAdmin
        ? `/superadmin/fitpass/members?search=${query}&pageSize=100`
        : `/members?search=${query}&limit=100`);
      setSearchResults(isGlobalFitPassAdmin ? (data.data || []) : (data.members || []));
    } catch (err) {
      console.error('Error searching members:', err);
    } finally {
      setSearching(false);
    }
  };

  const selectMember = async (memberId) => {
    try {
      setLoadingSummary(true);
      const { data } = await API.get(`/sessions/member-summary/${memberId}`);
      setSelectedMemberSummary(data.summary);
    } catch (err) {
      alert(err.response?.data?.message || 'Could not load member summary. Ensure this member has a FitPass plan.');
    } finally {
      setLoadingSummary(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Loader className="spinner" size={40} style={{ color: 'var(--primary-color)' }} />
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ padding: '1.5rem', color: 'var(--text-primary)' }}>
      <header style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Zap size={28} style={{ color: 'var(--primary-color)' }} />
          <h1 style={{ fontSize: '2rem', fontWeight: '800', margin: 0 }}>FitPass Universal Access Reports</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Monitor member registrations, network check-ins, session deduction velocity, and branch performance.
        </p>
      </header>

      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div><h3 style={{ margin: 0 }}>All-gym date filters</h3><p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '.85rem' }}>Choose a date range for the network-wide overview. Changes apply automatically.</p></div>
          <button type="button" className="btn btn-secondary" onClick={() => selectPreset('any')}>Clear date filters</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '1rem', alignItems: 'end' }}>
          <label className="products-field">Date preset<select className="input" value={period} onChange={e => selectPreset(e.target.value)}><option value="any">Any time</option><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="last7">Last 7 days</option><option value="last30">Last 30 days</option><option value="lastMonth">Last month</option><option value="thisMonth">This month</option><option value="thisYear">This year</option><option value="custom">Custom range</option></select></label>
          <label className="products-field">From<input className="input" type="date" value={period === 'any' ? '' : fromDate} onChange={e => updateCustomDate('from', e.target.value)} /></label>
          <label className="products-field">To<input className="input" type="date" value={period === 'any' ? '' : toDate} onChange={e => updateCustomDate('to', e.target.value)} /></label>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '.78rem', margin: '1rem 0 0' }}>This date range applies to the all-gym overview below. Revenue reflects FitPass network payments; payments aren’t assigned to partner gyms.</p>
      </section>

      {/* Analytics KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass" style={{ padding: '1.5rem', borderRadius: '16px', borderLeft: '6px solid #f59e0b' }}><span style={{ color: 'var(--text-secondary)', fontSize: '.85rem', textTransform: 'uppercase', fontWeight: 700 }}>Network Revenue</span><h2 style={{ fontSize: '2rem', margin: '.25rem 0' }}>₹{Number(analytics?.networkRevenue || 0).toLocaleString('en-IN')}</h2><small style={{ color: 'var(--text-secondary)' }}>FitPass plan payments in selected time range</small></div>
        <div className="glass" style={{ padding: '1.5rem', borderRadius: '16px', borderLeft: '6px solid #8b5cf6' }}><span style={{ color: 'var(--text-secondary)', fontSize: '.85rem', textTransform: 'uppercase', fontWeight: 700 }}>Members Visited</span><h2 style={{ fontSize: '2rem', margin: '.25rem 0' }}>{analytics?.periodMembers || 0}</h2><small style={{ color: 'var(--text-secondary)' }}>Unique members in selected range</small></div>
        <div className="glass" style={{ padding: '1.5rem', borderRadius: '16px', borderLeft: '6px solid #06b6d4' }}><span style={{ color: 'var(--text-secondary)', fontSize: '.85rem', textTransform: 'uppercase', fontWeight: 700 }}>Sessions / Check-ins</span><h2 style={{ fontSize: '2rem', margin: '.25rem 0' }}>{analytics?.periodCheckIns || 0}</h2><small style={{ color: 'var(--text-secondary)' }}>Successful partner gym visits in selected range</small></div>
        {/* Total FitPass Members */}
        <div className="glass" style={{ padding: '1.5rem', borderRadius: '16px', borderLeft: '6px solid var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: '700' }}>FitPass Subscribers</span>
            <h2 style={{ fontSize: '2rem', fontWeight: '800', margin: '0.25rem 0' }}>{analytics?.totalFitPassMembers || 0}</h2>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', marginTop: '0.5rem' }}>
              <span style={{ color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                <CheckCircle size={12} /> {analytics?.activeFitPassMembers || 0} Active
              </span>
              <span style={{ color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                <XCircle size={12} /> {analytics?.expiredFitPassMembers || 0} Expired
              </span>
            </div>
          </div>
          <Users size={36} style={{ opacity: 0.15, color: 'var(--primary-color)' }} />
        </div>

        {/* Sessions Sold */}
        <div className="glass" style={{ padding: '1.5rem', borderRadius: '16px', borderLeft: '6px solid #3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: '700' }}>Total Sessions Sold</span>
            <h2 style={{ fontSize: '2rem', fontWeight: '800', margin: '0.25rem 0' }}>{analytics?.totalSessionsSold || 0}</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
               {analytics?.remainingSessions || 0} remaining in network
            </p>
          </div>
          <Ticket size={36} style={{ opacity: 0.15, color: '#3b82f6' }} />
        </div>

        {/* Sessions Used */}
        <div className="glass" style={{ padding: '1.5rem', borderRadius: '16px', borderLeft: '6px solid var(--success-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: '700' }}>Sessions Consumed</span>
            <h2 style={{ fontSize: '2rem', fontWeight: '800', margin: '0.25rem 0' }}>{analytics?.totalSessionsUsed || 0}</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
               {analytics?.totalSessionsSold ? ((analytics.totalSessionsUsed / analytics.totalSessionsSold) * 100).toFixed(1) : 0}% utilization rate
            </p>
          </div>
          <Activity size={36} style={{ opacity: 0.15, color: 'var(--success-color)' }} />
        </div>

        {/* Average Frequency */}
        <div className="glass" style={{ padding: '1.5rem', borderRadius: '16px', borderLeft: '6px solid var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: '700' }}>Avg Visits / Member</span>
            <h2 style={{ fontSize: '2rem', fontWeight: '800', margin: '0.25rem 0' }}>{analytics?.avgVisitsPerMember || 0}</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
               Average check-ins per user
            </p>
          </div>
          <TrendingUp size={36} style={{ opacity: 0.15, color: 'var(--accent-color)' }} />
        </div>
      </div>

      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div><h3 style={{ margin: 0 }}>Gym-wise check-in report</h3><p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '.85rem' }}>Choose a gym to see its check-ins, unique members, and estimated FitCoins used for the selected date range.</p></div>
          <label className="products-field" style={{ minWidth: 260 }}>Partner gym<select className="input" value={gymId} onChange={e => setGymId(e.target.value)}><option value="">Select a gym</option>{gymOptions.map(g => <option key={g.gymId} value={g.gymId}>{g.gymName}</option>)}</select>{gymsLoading && <small>Loading gym list…</small>}</label>
        </div>
        {gymId ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '1rem' }}>
          <div className="glass" style={{ padding: '1.25rem', borderRadius: 14 }}><small>Check-ins at selected gym</small><h2 style={{ margin: '.35rem 0' }}>{gymAnalytics?.periodCheckIns ?? '—'}</h2></div>
          <div className="glass" style={{ padding: '1.25rem', borderRadius: 14 }}><small>Unique members</small><h2 style={{ margin: '.35rem 0' }}>{gymAnalytics?.periodMembers ?? '—'}</h2></div>
          <div className="glass" style={{ padding: '1.25rem', borderRadius: 14 }}><small>Estimated FitCoins used</small><h2 style={{ margin: '.35rem 0' }}>{gymAnalytics?.periodCoinsUsed?.toLocaleString('en-IN') ?? '—'}</h2><small>At {gymAnalytics?.coinRatePerCheckIn || 10} coins per check-in</small></div>
        </div> : <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Select a partner gym to view its report.</p>}
      </section>

      {/* Main Content Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        
        {/* Left Column: Member Search and Drill-down */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Search size={18} /> Member FitPass Drill-down
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Search for any member to inspect their FitPass usage details, session counts, and checkout status.
          </p>

          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <input 
              type="text" 
              className="input" 
              placeholder="Search by member ID (MEM1001), name, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {searching ? <Loader className="spinner" size={14} /> : 'Search'}
            </button>
            <ResetFiltersButton onClick={() => { setSearchQuery(''); setSearchResults([]); setSelectedMemberSummary(null); }} />
          </form>

          {searchResults.length > 0 && (
            <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.5rem', marginBottom: '1.5rem' }}>
              {searchResults.map((member) => (
                <div 
                  key={member._id || member.id}
                  onClick={() => selectMember(member._id || member.id)}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    marginBottom: '0.25rem',
                    background: 'rgba(255,255,255,0.02)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                >
                  <div>
                    <div style={{ fontWeight: '700' }}>{member.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}> {member.phone}</div>
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                </div>
              ))}
            </div>
          )}
          {!searching && searchQuery.trim() && searchResults.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem', margin: '-.75rem 0 1rem' }}>No matching FitPass members found. Check the name, phone, or email and try again.</p>
          )}
          {!searchQuery.trim() && !loadingMemberList && searchResults.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '.85rem', margin: '-.75rem 0 1rem' }}>No FitPass members are available in this account’s scope.</p>
          )}

          {/* Individual Member Summary Panel */}
          {loadingSummary ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Loader className="spinner" size={24} />
            </div>
          ) : selectedMemberSummary ? (
            <div style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '800' }}> FitPass Account Summary</h4>
                <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => setSelectedMemberSummary(null)}>
                  Clear
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
                <div>
                  <div style={{ color: 'var(--text-secondary)' }}>Total Purchased</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary-color)' }}>
                    {selectedMemberSummary.totalPurchasedSessions}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)' }}>Sessions Used</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--success-color)' }}>
                    {selectedMemberSummary.sessionsUsed}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)' }}>Sessions Remaining</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--accent-color)' }}>
                    {selectedMemberSummary.remainingSessions}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)' }}>Expiry Date</div>
                  <div style={{ fontSize: '1rem', fontWeight: '700' }}>
                    {new Date(selectedMemberSummary.expiryDate).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ color: 'var(--text-secondary)' }}>Last Gym Visited</div>
                  <div style={{ fontWeight: '700', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <MapPin size={14} style={{ color: 'var(--primary-color)' }} />
                    {selectedMemberSummary.lastGymVisited}
                  </div>
                </div>
              </div>

              {selectedMemberSummary.frequentlyVisitedGyms?.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.5rem' }}>
                    FREQUENTLY VISITED PARTNERS
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {selectedMemberSummary.frequentlyVisitedGyms.map((g, idx) => (
                      <div key={g.gymId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.25rem 0.5rem', background: 'rgba(255,255,255,0.01)', borderRadius: '4px' }}>
                        <span>{idx + 1}. {g.gymName}</span>
                        <span style={{ fontWeight: '700', color: 'var(--primary-color)' }}>{g.count} visits</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', border: '1px dashed var(--border)', borderRadius: '12px', minHeight: '150px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No member selected. Search above to inspect details.</span>
            </div>
          )}
        </div>

        {/* Right Column: Branch Popularity */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={18} /> Most Visited Partner Gyms
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Top gyms receiving traffic from the FitPass universal network.
          </p>

          {analytics?.mostVisitedPartnerGyms?.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Gym / Location</th>
                  <th style={{ textAlign: 'right' }}>Total Check-ins</th>
                </tr>
              </thead>
              <tbody>
                {analytics.mostVisitedPartnerGyms.map((g, index) => (
                  <tr key={g.gymId}>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        fontWeight: '700',
                        fontSize: '0.8rem',
                        background: index === 0 ? 'var(--primary-color)' : 'rgba(255,255,255,0.05)',
                        color: index === 0 ? '#fff' : 'var(--text-secondary)'
                      }}>
                        {index + 1}
                      </span>
                    </td>
                    <td style={{ fontWeight: '600' }}>{g.gymName}</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--success-color)' }}>
                      {g.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '150px', border: '1px dashed var(--border)', borderRadius: '12px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No visit records found in this scoping.</span>
            </div>
          )}
        </div>
      </div>

      {/* Historical Check-in Trends (Daily and Monthly) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        {/* Daily check-ins */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} /> Daily Network Traffic
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Daily check-ins across partner gyms in the selected date range.
          </p>

          {analytics?.dailyCheckIns?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
              {analytics.dailyCheckIns.slice().reverse().map((d) => (
                <div key={d.date} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: '600' }}>{new Date(d.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  <span style={{ fontWeight: '700', color: 'var(--primary-color)' }}>{d.count} check-ins</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '150px', border: '1px dashed var(--border)', borderRadius: '12px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No daily check-ins recorded.</span>
            </div>
          )}
        </div>

        {/* Monthly check-ins */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} /> Monthly Check-in Volume
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Aggregated monthly check-in volume.
          </p>

          {analytics?.monthlyCheckIns?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
              {analytics.monthlyCheckIns.slice().reverse().map((m) => (
                <div key={m.month} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <span style={{ fontWeight: '600' }}>
                    {new Date(m.month + '-02').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  </span>
                  <span style={{ fontWeight: '700', color: 'var(--success-color)' }}>{m.count} check-ins</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '150px', border: '1px dashed var(--border)', borderRadius: '12px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No monthly check-ins recorded.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FitPassAnalyticsPage;

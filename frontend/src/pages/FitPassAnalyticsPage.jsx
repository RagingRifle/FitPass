import { useState, useEffect } from 'react';
import API from '../services/api';
import { 
  Users, CheckCircle, XCircle, Ticket, Activity, TrendingUp, Search, Calendar, MapPin, Loader, Zap, ChevronRight
} from 'lucide-react';

const FitPassAnalyticsPage = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedMemberSummary, setSelectedMemberSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Load analytics on mount
  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const { data } = await API.get('/sessions/analytics');
      setAnalytics(data.analytics);
    } catch (err) {
      console.error('Error fetching FitPass analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Search members to view their individual FitPass summary
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setSearching(true);
      // Query members endpoint
      const { data } = await API.get(`/members?search=${searchQuery}`);
      // Filter members who are FitPass members or show all to allow checking
      setSearchResults(data.members || []);
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

      {/* Analytics KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
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
              placeholder="Search member by name or phone..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {searching ? <Loader className="spinner" size={14} /> : 'Search'}
            </button>
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
            Daily check-ins at partner gyms over the last 30 active days.
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

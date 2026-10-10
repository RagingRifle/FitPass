import { useState, useEffect, useContext } from 'react';
import API from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import Modal from '../../components/Modal';
import { useToast } from '../../components/ui/Toast';
import EmptyState from '../../components/ui/EmptyState';
import { 
    Users, 
    User, 
    Ticket, 
    Clock, 
    Building2, 
    CheckCircle2, 
    XCircle, 
    Search, 
    Sparkles, 
    AlertCircle, 
    Eye, 
    History, 
    Calendar, 
    ShieldCheck, 
    Activity, 
    Filter, 
    Phone, 
    Mail, 
    MapPin, 
    Layers, 
    IndianRupee,
    ChevronRight,
    RefreshCw,
    Plus
} from 'lucide-react';

function FitPassMembers() {
    const toast = useToast();
    const { user } = useContext(AuthContext);
    const [members, setMembers] = useState([]);
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Active' | 'Expired'

    // Add Member Modal state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', planId: '', joinDate: new Date().toISOString().split('T')[0], password: '' });
    const [submitting, setSubmitting] = useState(false);

    // Selected member for detail view modal
    const [selectedMember, setSelectedMember] = useState(null);
    const [memberSummary, setMemberSummary] = useState(null);
    const [sessionLogs, setSessionLogs] = useState([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'sessions'

    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        try {
            setLoading(true);
            const [rosterRes, plansRes] = await Promise.all([
                API.get('/superadmin/fitpass/members'),
                API.get('/plans')
            ]);
            setMembers(rosterRes.data?.data || []);

            let fetchedPlans = rosterRes.data?.plans || [];
            if (!fetchedPlans || fetchedPlans.length === 0) {
                const allPlans = Array.isArray(plansRes.data) ? plansRes.data : [];
                fetchedPlans = allPlans.filter(p => p.gymId === 'SYSTEM' || !p.gymId);
            }
            setPlans(fetchedPlans);
            if (fetchedPlans.length > 0) {
                const firstId = fetchedPlans[0].id || fetchedPlans[0]._id;
                setFormData(prev => ({ ...prev, planId: prev.planId || firstId }));
            }
        } catch (err) {
            console.error('Failed to fetch members directory:', err);
            setError(err.response?.data?.message || 'Failed to load FitPass subscribers.');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAddModal = () => {
        const firstId = plans.length > 0 ? (plans[0].id || plans[0]._id) : '';
        setFormData({
            name: '',
            phone: '',
            email: '',
            planId: firstId,
            joinDate: new Date().toISOString().split('T')[0],
            password: ''
        });
        setIsAddModalOpen(true);
    };

    const handleAddMemberSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await API.post('/members', {
                ...formData,
                gymId: 'SYSTEM'
            });
            setIsAddModalOpen(false);
            setFormData({ name: '', phone: '', email: '', planId: plans[0]?.id || plans[0]?._id || '', joinDate: new Date().toISOString().split('T')[0], password: '' });
            toast.success(`Subscriber ${formData.name} registered successfully!`);
            fetchMembers();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to register FitPass subscriber');
        } finally {
            setSubmitting(false);
        }
    };

    const handleViewMemberDetails = async (member) => {
        setSelectedMember(member);
        setActiveTab('overview');
        setLoadingDetails(true);

        try {
            const memberIdVal = member.id || member._id;

            // Fetch member visit summary & check-in history in parallel
            const [summaryRes, logsRes] = await Promise.all([
                API.get(`/sessions/member-summary/${memberIdVal}`),
                API.get(`/superadmin/fitpass/audit-log?memberId=${memberIdVal}&pageSize=100`)
            ]);

            setMemberSummary(summaryRes.data?.summary || null);
            setSessionLogs(logsRes.data?.data || []);
        } catch (err) {
            console.error('Failed to load member detail details:', err);
        } finally {
            setLoadingDetails(false);
        }
    };

    // Calculate real summary statistics strictly from live database data
    const totalMembersCount = members.length;
    const activePassCount = members.filter(m => !m.isExpired && m.status === 'Active').length;
    const expiredPassCount = members.filter(m => m.isExpired || m.status === 'Expired').length;
    const totalSessionsUsed = members.reduce((sum, m) => sum + (m.sessionsUsed || 0), 0);
    const totalSessionsRemaining = members.reduce((sum, m) => sum + (m.sessionsRemaining || 0), 0);

    const filteredMembers = members.filter(m => {
        const matchesSearch = 
            m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.phone?.includes(searchTerm) ||
            m.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.plan?.name?.toLowerCase().includes(searchTerm.toLowerCase());

        if (statusFilter === 'Active') {
            return matchesSearch && !m.isExpired && m.status === 'Active';
        } else if (statusFilter === 'Expired') {
            return matchesSearch && (m.isExpired || m.status === 'Expired');
        }
        return matchesSearch;
    });

    if (loading) return <div className="spinner"></div>;

    return (
        <div className="fitpass-members-page">
            {/* Page Header */}
            <div className="fitprime-page-header">
                <div className="fitprime-header-title-area">
                    <div className="fitprime-header-icon">
                        <Users size={28} />
                    </div>
                    <div className="fitprime-header-text">
                        <h2>FitPass Members Directory</h2>
                        <p>Complete subscriber registry tracking active memberships, session usage, and partner gym access logs.</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button 
                        className="btn btn-secondary" 
                        onClick={fetchMembers}
                        title="Refresh Data"
                    >
                        <RefreshCw size={18} />
                        Refresh Roster
                    </button>
                    <button 
                        className="btn btn-primary"
                        onClick={handleOpenAddModal}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Plus size={18} />
                        Add FitPass Member
                    </button>
                </div>
            </div>

            {/* Notifications */}
            {error && (
                <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {/* Key Metrics Summary Bar */}
            <div className="fitprime-stats-grid">
                <div className="fitprime-stat-card">
                    <div className="fitprime-stat-icon">
                        <Users size={22} />
                    </div>
                    <div>
                        <div className="fitprime-stat-val">{totalMembersCount}</div>
                        <div className="fitprime-stat-lbl">Total FitPass Subscribers</div>
                    </div>
                </div>

                <div className="fitprime-stat-card">
                    <div className="fitprime-stat-icon" style={{ background: 'rgba(46, 125, 50, 0.15)', color: '#2E7D32' }}>
                        <CheckCircle2 size={22} />
                    </div>
                    <div>
                        <div className="fitprime-stat-val">{activePassCount}</div>
                        <div className="fitprime-stat-lbl">Active Pass Holders</div>
                    </div>
                </div>

                <div className="fitprime-stat-card">
                    <div className="fitprime-stat-icon">
                        <Activity size={22} />
                    </div>
                    <div>
                        <div className="fitprime-stat-val">{totalSessionsUsed}</div>
                        <div className="fitprime-stat-lbl">Sessions Completed</div>
                    </div>
                </div>

                <div className="fitprime-stat-card">
                    <div className="fitprime-stat-icon">
                        <Layers size={22} />
                    </div>
                    <div>
                        <div className="fitprime-stat-val">{totalSessionsRemaining}</div>
                        <div className="fitprime-stat-lbl">Sessions Remaining</div>
                    </div>
                </div>
            </div>

            {/* Toolbar: Search + Filter Pills */}
            <div className="fitprime-toolbar">
                <div className="fitprime-search-box">
                    <Search className="fitprime-search-icon" size={18} />
                    <input 
                        className="input" 
                        type="text" 
                        placeholder="Search by member name, phone, email, or plan..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                        {['All', 'Active', 'Expired'].map(st => (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st)}
                                className={`btn ${statusFilter === st ? 'btn-primary' : 'btn-ghost'}`}
                                style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem', minHeight: '36px' }}
                            >
                                {st}
                            </button>
                        ))}
                    </div>

                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                        {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}
                    </div>
                </div>
            </div>

            {/* Members Directory Grid */}
            {filteredMembers.length === 0 ? (
                <EmptyState
                    icon={Users}
                    title="No FitPass Members Found"
                    description={searchTerm || statusFilter !== 'All' 
                        ? 'No member records match your current search criteria or status filter.' 
                        : 'No subscribers registered yet. Click "Add Member" to register a subscriber.'}
                    primaryAction={{
                        label: '+ Add First Member',
                        onClick: handleOpenAddModal
                    }}
                />
            ) : (
                <div className="fitpass-members-grid">
                    {filteredMembers.map(member => {
                        const totalSess = member.sessionsTotal || member.plan?.sessions || 0;
                        const remainingSess = member.sessionsRemaining || 0;
                        const usedSess = member.sessionsUsed || Math.max(0, totalSess - remainingSess);
                        const progressPct = totalSess > 0 ? Math.min(100, Math.round((usedSess / totalSess) * 100)) : 0;
                        const isExpired = member.isExpired || new Date(member.expiryDate) <= new Date();

                        return (
                            <div key={member.id} className="fitpass-member-card">
                                <div>
                                    <div className="fitpass-member-card-top">
                                        <div>
                                            <h3 className="fitpass-member-name">{member.name}</h3>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                                <Phone size={13} />
                                                <span>{member.phone || 'No phone'}</span>
                                            </div>
                                        </div>
                                        <span className={`status-pill-${isExpired ? 'failed' : 'success'}`}>
                                            {isExpired ? 'Expired Pass' : 'Active Pass'}
                                        </span>
                                    </div>

                                    {/* Subscription Badge */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '16px' }}>
                                        <Ticket size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                {member.plan?.name || 'FitPass Session Package'}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                Price: ₹{member.plan?.price ? member.plan.price.toLocaleString('en-IN') : 'N/A'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Session Balance Progress Meter */}
                                    <div className="fitpass-session-meter-container">
                                        <div className="fitpass-session-meter-header">
                                            <span>Session Balance</span>
                                            <strong style={{ color: 'var(--primary)' }}>
                                                {remainingSess} of {totalSess} left
                                            </strong>
                                        </div>
                                        <div className="fitpass-session-progress-bar">
                                            <div 
                                                className="fitpass-session-progress-fill" 
                                                style={{ width: `${progressPct}%` }}
                                            ></div>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                                            <span>{usedSess} used</span>
                                            <span>{remainingSess} remaining</span>
                                        </div>
                                    </div>

                                    {/* Additional Details */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                                        {member.email && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Mail size={14} style={{ color: 'var(--primary)' }} />
                                                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{member.email}</span>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Calendar size={14} style={{ color: 'var(--primary)' }} />
                                            <span>Pass Expiry: <strong>{new Date(member.expiryDate).toLocaleDateString()}</strong></span>
                                        </div>
                                        {member.lastCheckInAt && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Clock size={14} style={{ color: 'var(--primary)' }} />
                                                <span>Last Check-in: <strong>{new Date(member.lastCheckInAt).toLocaleString()}</strong></span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button 
                                    className="btn btn-secondary" 
                                    style={{ width: '100%', gap: '8px' }}
                                    onClick={() => handleViewMemberDetails(member)}
                                >
                                    <Eye size={16} />
                                    View Full Details & Access History
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Member Deep-Dive Modal */}
            <Modal
                isOpen={!!selectedMember}
                onClose={() => setSelectedMember(null)}
                title={selectedMember ? `FitPass Member: ${selectedMember.name}` : 'Member Details'}
            >
                {selectedMember && (
                    <div>
                        {/* Tab Switcher */}
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1.25rem', gap: '1rem' }}>
                            <button
                                className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setActiveTab('overview')}
                                style={{ borderRadius: '0', borderBottom: activeTab === 'overview' ? '2px solid var(--primary)' : 'none', padding: '0.5rem 1rem' }}
                            >
                                <User size={16} />
                                Member Profile & Stats
                            </button>
                            <button
                                className={`btn ${activeTab === 'sessions' ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => setActiveTab('sessions')}
                                style={{ borderRadius: '0', borderBottom: activeTab === 'sessions' ? '2px solid var(--primary)' : 'none', padding: '0.5rem 1rem' }}
                            >
                                <History size={16} />
                                Session Access Logs ({sessionLogs.length})
                            </button>
                        </div>

                        {loadingDetails ? (
                            <div className="spinner" style={{ margin: '2rem auto' }}></div>
                        ) : activeTab === 'overview' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {/* Profile Card Header */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Phone Number</div>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{selectedMember.phone || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Email Address</div>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{selectedMember.email || 'N/A'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Member ID</div>
                                        <div style={{ fontWeight: 600, fontSize: '0.82rem', fontFamily: 'monospace', color: 'var(--primary)' }}>{selectedMember.id}</div>
                                    </div>
                                </div>

                                {/* Active Subscription Info Box */}
                                <div className="card" style={{ padding: '1.25rem', margin: 0 }}>
                                    <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Ticket size={18} />
                                        Active FitPass Subscription Details
                                    </h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', fontSize: '0.88rem' }}>
                                        <div>
                                            <span style={{ color: 'var(--text-secondary)' }}>Subscription Plan:</span>
                                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedMember.plan?.name || 'Global FitPass Tier'}</div>
                                        </div>
                                        <div>
                                            <span style={{ color: 'var(--text-secondary)' }}>Total Granted Sessions:</span>
                                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedMember.sessionsTotal || selectedMember.plan?.sessions || 0} sessions</div>
                                        </div>
                                        <div>
                                            <span style={{ color: 'var(--text-secondary)' }}>Remaining Sessions:</span>
                                            <div style={{ fontWeight: 700, color: '#2E7D32' }}>{selectedMember.sessionsRemaining || 0} sessions left</div>
                                        </div>
                                        <div>
                                            <span style={{ color: 'var(--text-secondary)' }}>Pass Expiry Date:</span>
                                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{new Date(selectedMember.expiryDate).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Summary Stats: Gym Visits */}
                                {memberSummary && (
                                    <div className="card" style={{ padding: '1.25rem', margin: 0 }}>
                                        <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Building2 size={18} style={{ color: 'var(--primary)' }} />
                                            Partner Gym Access Summary
                                        </h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', fontSize: '0.85rem' }}>
                                            <div>
                                                <span style={{ color: 'var(--text-secondary)' }}>Total Successful Visits:</span>
                                                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--primary)' }}>{memberSummary.totalVisits} check-ins</div>
                                            </div>
                                            <div>
                                                <span style={{ color: 'var(--text-secondary)' }}>Last Gym Visited:</span>
                                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{memberSummary.lastGymVisited || 'None'}</div>
                                            </div>
                                        </div>

                                        {memberSummary.frequentlyVisitedGyms?.length > 0 && (
                                            <div style={{ marginTop: '1rem' }}>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>
                                                    Frequently Visited Partner Gyms:
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                    {memberSummary.frequentlyVisitedGyms.map((g, idx) => (
                                                        <span key={idx} style={{ padding: '4px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                                             {g.gymName} ({g.count} visits)
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div>
                                {/* Session Access Logs Table */}
                                <h4 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <History size={16} style={{ color: 'var(--primary)' }} />
                                    Session Check-in Attempt Log
                                </h4>

                                {sessionLogs.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', color: 'var(--text-muted)' }}>
                                        No check-in session access logs recorded for this member yet.
                                    </div>
                                ) : (
                                    <div className="fitpass-log-table-wrapper">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Timestamp</th>
                                                    <th>FitPass Gym Partner</th>
                                                    <th>Access Result</th>
                                                    <th>Remaining Sessions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sessionLogs.map(log => {
                                                    const isSuccess = log.accessStatus === 'Success';
                                                    return (
                                                        <tr key={log.id}>
                                                            <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                                {new Date(log.checkInTimestamp || log.createdAt).toLocaleString()}
                                                            </td>
                                                            <td style={{ fontWeight: 600 }}>
                                                                {log.gymName || 'Partner Gym'}
                                                                {log.branchNameVisited && (
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{log.branchNameVisited}</div>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <span className={`status-pill-${isSuccess ? 'success' : 'failed'}`}>
                                                                    {isSuccess ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                                                    {log.accessStatus}
                                                                </span>
                                                                {log.failureReason && (
                                                                    <div style={{ fontSize: '0.72rem', color: '#C62828', marginTop: '2px' }}>
                                                                        {log.failureReason}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                                                                {log.remainingSessionsAfter !== undefined ? `${log.remainingSessionsAfter} left` : 'N/A'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
                            <button className="btn btn-secondary" onClick={() => setSelectedMember(null)}>
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Add FitPass Member Modal */}
            <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Register New FitPass Subscriber">
                <form onSubmit={handleAddMemberSubmit}>
                    <div className="form-grid">
                        <div className="input-group full-width">
                            <label>Full Name *</label>
                            <input 
                                className="input" 
                                type="text" 
                                placeholder="Enter subscriber full name"
                                value={formData.name} 
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                                required 
                            />
                        </div>
                        <div className="input-group">
                            <label>Phone Number *</label>
                            <input 
                                className="input" 
                                type="text" 
                                placeholder="Subscriber phone number"
                                value={formData.phone} 
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })} 
                                required 
                            />
                        </div>
                        <div className="input-group">
                            <label>Email Address (Optional)</label>
                            <input 
                                className="input" 
                                type="email" 
                                placeholder="Subscriber email"
                                value={formData.email} 
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                            />
                        </div>
                        <div className="input-group">
                            <label>Password (Optional - Defaults to Phone)</label>
                            <input 
                                className="input" 
                                type="text" 
                                placeholder="Set password (default is Phone)"
                                value={formData.password} 
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
                            />
                        </div>
                        <div className="input-group full-width">
                            <label>FitPass Network Plan *</label>
                            <select 
                                className="input" 
                                value={formData.planId} 
                                onChange={(e) => setFormData({ ...formData, planId: e.target.value })} 
                                required
                            >
                                <option value="">-- Select a FitPass plan --</option>
                                {plans.map(p => {
                                    const pId = p.id || p._id;
                                    return (
                                        <option key={pId} value={pId}>
                                            {p.name} — ₹{p.price} ({p.sessions ? `${p.sessions} Sessions` : (p.duration ? `${p.duration} Days` : 'Standard Plan')})
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        <div className="input-group">
                            <label>Join Date *</label>
                            <input 
                                className="input" 
                                type="date" 
                                value={formData.joinDate} 
                                onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })} 
                                required 
                            />
                        </div>
                        <div className="input-group">
                            <label>Password (Optional, default: Phone)</label>
                            <input 
                                className="input" 
                                type="password" 
                                placeholder="Set login password" 
                                value={formData.password} 
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        className="btn btn-primary" 
                        style={{ width: '100%', marginTop: '1.5rem' }} 
                        disabled={submitting}
                    >
                        {submitting ? 'Registering Subscriber...' : 'Register FitPass Subscriber'}
                    </button>
                </form>
            </Modal>
        </div>
    );
}

export default FitPassMembers;

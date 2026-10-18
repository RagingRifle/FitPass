import { useState, useEffect, useContext } from 'react';
import API from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import Modal from '../../components/Modal';
import { 
    Ticket, 
    Plus, 
    Pencil, 
    Trash2, 
    Search, 
    Globe, 
    CheckCircle2, 
    Layers, 
    IndianRupee, 
    Sparkles, 
    Activity,
    AlertCircle,
    Calendar,
    Shield
} from 'lucide-react';

function FitPrimePlans() {
    const { user } = useContext(AuthContext);
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Modal & Form state for Create / Edit
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [name, setName] = useState('');
    const [sessions, setSessions] = useState('');
    const [price, setPrice] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            setLoading(true);
            const { data } = await API.get('/superadmin/plans');
            setPlans(data || []);
            setLoading(false);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch FitPrime plans');
            setLoading(false);
        }
    };

    const handleOpenCreateModal = () => {
        setEditingPlan(null);
        setName('');
        setSessions('');
        setPrice('');
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (plan) => {
        setEditingPlan(plan);
        setName(plan.name || '');
        setSessions(plan.sessions ?? plan.duration ?? '');
        setPrice(plan.price || '');
        setIsModalOpen(true);
    };

    const handleSubmitPlan = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        if (Number(sessions) <= 0) {
            alert('Sessions must be a positive whole number');
            return;
        }

        if (Number(price) < 0) {
            alert('Price cannot be negative');
            return;
        }

        try {
            setSubmitting(true);
            const payload = { 
                name: name.trim(), 
                sessions: Number(sessions), 
                price: Number(price) 
            };

            if (editingPlan) {
                await API.put(`/superadmin/plans/${editingPlan._id}`, payload);
                setSuccessMsg(`Plan "${name}" updated successfully!`);
            } else {
                await API.post('/superadmin/plans', payload);
                setSuccessMsg(`New plan "${name}" created successfully!`);
            }

            setIsModalOpen(false);
            fetchPlans();
            setTimeout(() => setSuccessMsg(''), 4000);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to save plan');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeletePlan = async (id, planName) => {
        if (!window.confirm(`Delete "${planName}"? Existing members keep their current session balance.`)) return;
        try {
            await API.delete(`/superadmin/plans/${id}`);
            setSuccessMsg(`Plan "${planName}" removed.`);
            fetchPlans();
            setTimeout(() => setSuccessMsg(''), 4000);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete plan');
        }
    };

    // Calculate real summary statistics strictly from live database data
    const totalPlans = plans.length;
    const totalSessionsCapacity = plans.reduce((sum, p) => sum + (Number(p.sessions ?? p.duration) || 0), 0);
    
    const avgPricePerSession = totalPlans > 0
        ? (plans.reduce((sum, p) => {
            const count = Number(p.sessions ?? p.duration) || 1;
            const cost = Number(p.price) || 0;
            return sum + (cost / count);
          }, 0) / totalPlans).toFixed(2)
        : '0.00';

    const minPrice = totalPlans > 0 ? Math.min(...plans.map(p => Number(p.price) || 0)) : 0;
    const maxPrice = totalPlans > 0 ? Math.max(...plans.map(p => Number(p.price) || 0)) : 0;
    const priceRangeText = totalPlans === 0 
        ? '₹0' 
        : minPrice === maxPrice 
            ? `₹${minPrice.toLocaleString('en-IN')}` 
            : `₹${minPrice.toLocaleString('en-IN')} - ₹${maxPrice.toLocaleString('en-IN')}`;

    const filteredPlans = plans.filter(p => 
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(p.sessions ?? p.duration ?? '').includes(searchTerm)
    );

    if (loading) return <div className="spinner"></div>;

    return (
        <div className="fitprime-plans-page">
            {/* Header Section */}
            <div className="fitprime-page-header">
                <div className="fitprime-header-title-area">
                    <div className="fitprime-header-icon">
                        <Ticket size={28} />
                    </div>
                    <div className="fitprime-header-text">
                        <h2>FitPass Member Plans</h2>
                        <p>Session-based membership tiers granting universal gym check-ins across all partner locations.</p>
                    </div>
                </div>
                <button 
                    className="btn btn-primary" 
                    onClick={handleOpenCreateModal}
                >
                    <Plus size={18} />
                    Create FitPrime Plan
                </button>
            </div>

            {/* Notifications */}
            {error && (
                <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}
            {successMsg && (
                <div className="success-message" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.85rem 1.25rem', backgroundColor: 'rgba(46, 125, 50, 0.15)', border: '1px solid rgba(46, 125, 50, 0.3)', color: '#2E7D32', borderRadius: 'var(--radius-md)' }}>
                    <Sparkles size={18} />
                    <span>{successMsg}</span>
                </div>
            )}

            {/* Key Metrics Summary Bar - 100% Real Calculated DB Data */}
            <div className="fitprime-stats-grid">
                <div className="fitprime-stat-card">
                    <div className="fitprime-stat-icon">
                        <Ticket size={22} />
                    </div>
                    <div>
                        <div className="fitprime-stat-val">{totalPlans}</div>
                        <div className="fitprime-stat-lbl">Active FitPass passes</div>
                    </div>
                </div>

                <div className="fitprime-stat-card">
                    <div className="fitprime-stat-icon">
                        <Layers size={22} />
                    </div>
                    <div>
                        <div className="fitprime-stat-val">{totalSessionsCapacity}</div>
                        <div className="fitprime-stat-lbl">Aggregated Check-ins</div>
                    </div>
                </div>

                <div className="fitprime-stat-card">
                    <div className="fitprime-stat-icon">
                        <IndianRupee size={22} />
                    </div>
                    <div>
                        <div className="fitprime-stat-val">₹{avgPricePerSession}</div>
                        <div className="fitprime-stat-lbl">Avg. Price / Session</div>
                    </div>
                </div>

                <div className="fitprime-stat-card">
                    <div className="fitprime-stat-icon">
                        <Activity size={22} />
                    </div>
                    <div>
                        <div className="fitprime-stat-val">{priceRangeText}</div>
                        <div className="fitprime-stat-lbl">Price Range (Min - Max)</div>
                    </div>
                </div>
            </div>

            {/* Toolbar / Search */}
            <div className="fitprime-toolbar">
                <div className="fitprime-search-box">
                    <Search className="fitprime-search-icon" size={18} />
                    <input 
                        className="input" 
                        type="text" 
                        placeholder="Search plans by name or session count..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                    Showing {filteredPlans.length} of {plans.length} plan{plans.length !== 1 ? 's' : ''}
                </div>
            </div>

            {/* Plans Showcase Grid */}
            {filteredPlans.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                    <Ticket size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
                    <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No FitPrime Plans Found</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
                        {searchTerm ? 'No plans match your current search query.' : 'Create a session pass for FitPass members to purchase or renew themselves.'}
                    </p>
                    {!searchTerm && (
                        <button className="btn btn-primary" onClick={handleOpenCreateModal}>
                            <Plus size={18} />
                            Create FitPrime Plan
                        </button>
                    )}
                </div>
            ) : (
                <div className="fitprime-grid">
                    {filteredPlans.map(plan => {
                        const sessionCount = plan.sessions ?? plan.duration ?? 0;
                        const perSessionCost = sessionCount > 0 ? (plan.price / sessionCount).toFixed(2) : 0;
                        const createdDate = plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : null;

                        return (
                            <div key={plan._id} className="fitprime-card">
                                <div>
                                    <div className="fitprime-card-top">
                                        <h3 className="fitprime-card-title">{plan.name}</h3>
                                        <span className="fitprime-badge-global">
                                            <Globe size={12} />
                                            {plan.gymId === 'SYSTEM' ? 'FitPass only' : plan.gymId}
                                        </span>
                                    </div>

                                    <div className="fitprime-price-block">
                                        <div className="fitprime-price-amount">
                                            ₹{Number(plan.price).toLocaleString('en-IN')}
                                            <span>/ plan price</span>
                                        </div>
                                        <div className="fitprime-per-session-pill">
                                            <Sparkles size={12} />
                                            ₹{perSessionCost} per session
                                        </div>
                                    </div>

                                    <div className="fitprime-features-list">
                                        <div className="fitprime-feature-item">
                                            <CheckCircle2 size={16} className="fitprime-feature-icon" />
                                            <span><strong>{sessionCount}</strong> check-in sessions</span>
                                        </div>
                                        <div className="fitprime-feature-item">
                                            <Shield size={16} className="fitprime-feature-icon" />
                                            <span>System Scope: <strong>{plan.gymId}</strong></span>
                                        </div>
                                        {createdDate && (
                                            <div className="fitprime-feature-item">
                                                <Calendar size={16} className="fitprime-feature-icon" />
                                                <span>Created: {createdDate}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="fitprime-card-actions">
                                    <button 
                                        onClick={() => handleOpenEditModal(plan)} 
                                        className="btn btn-secondary"
                                        title="Edit Plan"
                                    >
                                        <Pencil size={15} />
                                        Edit
                                    </button>
                                    <button 
                                        onClick={() => handleDeletePlan(plan._id, plan.name)} 
                                        className="btn btn-danger"
                                        title="Delete Plan"
                                    >
                                        <Trash2 size={15} />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create / Edit Plan Modal */}
            <Modal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                title={editingPlan ? 'Edit FitPrime Plan' : 'Create FitPrime Plan'}
            >
                <form onSubmit={handleSubmitPlan} style={{ marginTop: '0.5rem' }}>
                    <div className="input-group">
                        <label>Plan Title</label>
                        <input 
                            className="input" 
                            type="text" 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            required 
                            placeholder="e.g. 10 Session Pack" 
                        />
                    </div>

                    <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        <div className="input-group">
                            <label>Sessions (Check-ins)</label>
                            <input 
                                className="input" 
                                type="number" 
                                min="1" 
                                step="1" 
                                value={sessions} 
                                onChange={(e) => setSessions(e.target.value)} 
                                required 
                                placeholder="e.g. 10" 
                            />
                        </div>

                        <div className="input-group">
                            <label>Price (₹)</label>
                            <input 
                                className="input" 
                                type="number" 
                                min="0" 
                                step="0.01" 
                                value={price} 
                                onChange={(e) => setPrice(e.target.value)} 
                                required 
                                placeholder="e.g. 999" 
                            />
                        </div>
                    </div>

                    {Number(sessions) > 0 && Number(price) > 0 && (
                        <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '1.25rem', fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Calculated per-session rate:</span>
                            <strong style={{ color: 'var(--primary)', fontFamily: 'Outfit, sans-serif', fontSize: '0.95rem' }}>
                                ₹{(Number(price) / Number(sessions)).toFixed(2)} / session
                            </strong>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '12px', marginTop: '1.5rem' }}>
                        <button 
                            type="button" 
                            className="btn btn-secondary" 
                            onClick={() => setIsModalOpen(false)}
                            style={{ flex: 1 }}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="btn btn-primary" 
                            disabled={submitting}
                            style={{ flex: 1 }}
                        >
                            {submitting ? 'Saving...' : (editingPlan ? 'Update Plan' : 'Create Plan')}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

export default FitPrimePlans;

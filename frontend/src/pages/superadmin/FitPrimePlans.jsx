import { useState, useEffect, useContext } from 'react';
import API from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import Modal from '../../components/Modal';
import { Link } from 'react-router-dom';
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
    const [coinsPerCheckIn, setCoinsPerCheckIn] = useState(10);

    // Modal & Form state for Create / Edit
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [name, setName] = useState('');
    const [inputMode, setInputMode] = useState('sessions');
    const [inputAmount, setInputAmount] = useState('');
    const [displayCoins, setDisplayCoins] = useState(true);
    const [displayCheckIns, setDisplayCheckIns] = useState(true);
    const [price, setPrice] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchPlans();
        API.get('/store/coin-settings?division=fitpass').then(({ data }) => setCoinsPerCheckIn(Number(data.coinsPerSession) || 10)).catch(() => {});
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
        setInputMode('sessions');
        setInputAmount('');
        setDisplayCoins(true);
        setDisplayCheckIns(true);
        setPrice('');
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (plan) => {
        setEditingPlan(plan);
        setName(plan.name || '');
        const mode = plan.coinInputMode === 'coins' ? 'coins' : 'sessions';
        setInputMode(mode);
        setInputAmount(mode === 'coins' ? (plan.coinAllowance || '') : (plan.sessions ?? plan.duration ?? ''));
        setDisplayCoins(plan.displayCoins !== false);
        setDisplayCheckIns(plan.displayCheckIns !== false);
        setPrice(plan.price || '');
        setIsModalOpen(true);
    };

    const handleSubmitPlan = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        if (!Number.isInteger(Number(inputAmount)) || Number(inputAmount) <= 0) {
            alert(`Enter a positive whole number of ${inputMode === 'coins' ? 'FitCoins' : 'check-ins'}.`);
            return;
        }
        if (!displayCoins && !displayCheckIns) {
            alert('Choose at least one value to show on the plan.');
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
                coinInputMode: inputMode,
                ...(inputMode === 'coins' ? { coinAllowance: Number(inputAmount) } : { sessions: Number(inputAmount) }),
                displayCoins,
                displayCheckIns,
                price: Number(price),
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
    const totalSessionsCapacity = plans.reduce((sum, p) => sum + (Number(p.sessions ?? 10) || 0), 0);
    
    const avgPricePerSession = totalPlans > 0
        ? (plans.reduce((sum, p) => {
            const count = Number(p.sessions ?? 10) || 1;
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
                        <p>Coin-funded memberships for check-ins across FitPass partner locations.</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Link to="/products" className="btn btn-secondary">Manage FitPass Products</Link>
                    <button className="btn btn-primary" onClick={handleOpenCreateModal}>
                        <Plus size={18} />
                        Create FitPass Plan
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
                    <div className="fitprime-stat-val">{totalSessionsCapacity * coinsPerCheckIn}</div>
                        <div className="fitprime-stat-lbl">FitCoins in available plans</div>
                    </div>
                </div>

                <div className="fitprime-stat-card">
                    <div className="fitprime-stat-icon">
                        <IndianRupee size={22} />
                    </div>
                    <div>
                        <div className="fitprime-stat-val">₹{avgPricePerSession}</div>
                        <div className="fitprime-stat-lbl">Avg. plan price / check-in</div>
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
                        placeholder="Search plans by name or check-in allowance..."
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
                        {searchTerm ? 'No plans match your current search query.' : 'Create a FitPass coin plan for members to purchase or renew.'}
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
                        const sessionCount = plan.sessions == null ? 10 : Number(plan.sessions);
                        const coinAllowance = Number(plan.coinAllowance) > 0 ? Number(plan.coinAllowance) : sessionCount * coinsPerCheckIn;
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
                                        {plan.displayCoins !== false && <div className="fitprime-per-session-pill">
                                            <Sparkles size={12} />
                                            {coinAllowance} FitCoins
                                        </div>}
                                    </div>

                                    <div className="fitprime-features-list">
                                        {plan.displayCheckIns !== false && <div className="fitprime-feature-item">
                                            <CheckCircle2 size={16} className="fitprime-feature-icon" />
                                            <span>Up to <strong>{sessionCount}</strong> check-ins</span>
                                        </div>}
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
                <form className="fitprime-plan-editor" onSubmit={handleSubmitPlan}>
                    <label className="fitprime-editor-field fitprime-editor-name">
                        <span>Plan title</span>
                        <input className="input" type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. FitPass Pro" />
                    </label>

                    <div className="fitprime-editor-grid">
                        <fieldset className="fitprime-editor-field fitprime-mode-field">
                            <legend>Enter allowance as</legend>
                            <div className="fitprime-mode-switch" role="group" aria-label="Allowance input type">
                                <button type="button" className={inputMode === 'sessions' ? 'is-selected' : ''} onClick={() => setInputMode('sessions')}>Check-ins</button>
                                <button type="button" className={inputMode === 'coins' ? 'is-selected' : ''} onClick={() => setInputMode('coins')}>FitCoins</button>
                            </div>
                        </fieldset>
                        <label className="fitprime-editor-field">
                            <span>{inputMode === 'coins' ? 'FitCoins amount' : 'Included check-ins'}</span>
                            <input className="input" type="number" min="1" step="1" value={inputAmount} onChange={(e) => setInputAmount(e.target.value)} required placeholder={inputMode === 'coins' ? 'e.g. 300' : 'e.g. 30'} />
                        </label>
                        <label className="fitprime-editor-field">
                            <span>Plan price (₹)</span>
                            <input className="input" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required placeholder="e.g. 1499" />
                        </label>
                    </div>

                    {Number(inputAmount) > 0 && <div className="fitprime-conversion-preview" aria-live="polite">
                        <span>{inputMode === 'coins' ? 'Converted check-in limit' : 'Converted coin allowance'}</span>
                        <strong>{inputMode === 'coins' ? `Up to ${Math.floor(Number(inputAmount) / coinsPerCheckIn)} check-ins` : `${Number(inputAmount) * coinsPerCheckIn} FitCoins`}</strong>
                        <small>Rate: {coinsPerCheckIn} FitCoins per check-in</small>
                    </div>}

                    <fieldset className="fitprime-display-options">
                        <legend>Show on the member plan</legend>
                        <label><input type="checkbox" checked={displayCoins} onChange={(e) => setDisplayCoins(e.target.checked)} /> FitCoins</label>
                        <label><input type="checkbox" checked={displayCheckIns} onChange={(e) => setDisplayCheckIns(e.target.checked)} /> Check-in limit</label>
                    </fieldset>

                    <div className="fitprime-editor-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving…' : editingPlan ? 'Save changes' : 'Create plan'}</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

export default FitPrimePlans;

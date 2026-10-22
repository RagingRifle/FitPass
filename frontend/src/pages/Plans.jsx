import { useState, useEffect, useContext } from 'react';
import { getPlans, createPlan, updatePlan, deletePlan } from '../services/apiService';
import Modal from '../components/Modal';
import { AuthContext } from '../context/AuthContext';
import { Pencil, Trash2 } from 'lucide-react';

const Plans = () => {
    const { user, activeDivision, selectedGymId } = useContext(AuthContext);
    const isAdmin = ['admin', 'h4_admin', 'superadmin'].includes(user?.role);
    const isH4Plans = user?.role === 'h4_admin' || activeDivision === 'h4' || ['05a08fdf-7427-48a5-8b25-e18d5a5668cd', '327d37e7-f978-43a9-82ef-e6c4a4dc3c5d'].includes(String(selectedGymId || '')) || String(user?.gymName || '').toLowerCase().includes('h4');
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [formData, setFormData] = useState({ name: '', duration: '30', durationPreset: '30', price: '' });

    useEffect(() => {
        fetchPlans();
    }, [selectedGymId, activeDivision]);

    const fetchPlans = async () => {
        try {
            const data = await getPlans();
            const list = Array.isArray(data) ? data : (data?.data || []);
            setPlans(list);
        } catch (error) {
            console.error('Error fetching plans:', error);
            setPlans([]);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (plan = null) => {
        if (plan) {
            setEditingPlan(plan);
            const duration = String(plan.duration ?? 30);
            const durationPreset = ['30', '60'].includes(duration) ? duration : 'custom';
            setFormData({ name: plan.name, duration, durationPreset, price: plan.price });
        } else {
            setEditingPlan(null);
            setFormData({ name: '', duration: '30', durationPreset: '30', price: '' });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const planId = editingPlan?._id || editingPlan?.id;
            const payload = {
                name: formData.name,
                duration: Number(formData.duration),
                price: Number(formData.price)
            };
            if (editingPlan) {
                await updatePlan(planId, payload);
            } else {
                await createPlan(payload);
            }
            fetchPlans();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving plan:', error);
            alert(error.response?.data?.message || 'Error saving plan');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this plan?')) {
            try {
                await deletePlan(id);
                fetchPlans();
            } catch {
                alert('Error deleting plan');
            }
        }
    };

    const safePlans = Array.isArray(plans) ? plans : [];

    if (loading) return <div className="spinner"></div>;

    return (
        <div className="plans-page fade-in">
            <div className="plans-page-header">
                <div>
                    <span className="plans-page-kicker">{isH4Plans ? 'H4 membership setup' : 'Gym membership setup'}</span>
                    <h2>{isH4Plans ? 'H4 Membership Plans' : 'Gym Membership Plans'}</h2>
                    <p>{isH4Plans ? 'H4 members use these branch managed plans. FitPass session passes are managed separately.' : 'These plans are limited to members of the selected gym.'}</p>
                </div>
                {isAdmin && (
                    <button className="btn btn-primary" onClick={() => handleOpenModal()}>+ Add New Plan</button>
                )}
            </div>

            <div className="card plans-table-card">
                <div className="plans-table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Plan Name</th>
                            <th>Duration (Days)</th>
                            <th>Price (₹)</th>
                            {isAdmin && <th>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {safePlans.length === 0 ? (
                            <tr>
                                <td colSpan={isAdmin ? 4 : 3}>
                                    <div className="empty-state">
                                        <div className="empty-state-icon"></div>
                                        <h3>No plans found</h3>
                                        <p>Create subscription plans to get started.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            safePlans.map(plan => {
                                const planId = plan._id || plan.id;
                                return (
                                    <tr key={planId}>
                                        <td>
                                            {plan.name}
                                        </td>
                                        <td>{plan.duration}</td>
                                        <td>{plan.price}</td>
                                        {isAdmin && (
                                            <td style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button className="btn" style={{ padding: '0.4rem', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }} onClick={() => handleOpenModal(plan)}>
                                                    <Pencil size={16} />
                                                </button>
                                                <button className="btn btn-danger" style={{ padding: '0.4rem' }} onClick={() => handleDelete(planId)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingPlan ? 'Edit Plan' : 'Add New Plan'}>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label>Plan Name</label>
                        <input className="input" type="text" placeholder="e.g. Monthly" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                    </div>
                    <div className="form-grid">
                        <div className="input-group">
                            <label>Duration (days)</label>
                            {isH4Plans ? (
                                <>
                                    <select
                                        className="input"
                                        value={formData.durationPreset}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            durationPreset: e.target.value,
                                            duration: e.target.value === 'custom' ? '' : e.target.value
                                        })}
                                    >
                                        <option value="30">30 days</option>
                                        <option value="60">60 days</option>
                                        <option value="custom">Custom</option>
                                    </select>
                                    {formData.durationPreset === 'custom' && (
                                        <input
                                            className="input"
                                            style={{ marginTop: '0.5rem' }}
                                            type="number"
                                            min="1"
                                            placeholder="Enter number of days"
                                            value={formData.duration}
                                            onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                            required
                                        />
                                    )}
                                </>
                            ) : (
                                <input className="input" type="number" min="1" placeholder="e.g. 30" value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: e.target.value })} required />
                            )}
                        </div>
                        <div className="input-group">
                            <label>Price (₹)</label>
                            <input className="input" type="number" placeholder="e.g. 1000" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} required />
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }}>{editingPlan ? 'Update Plan' : 'Create Plan'}</button>
                </form>
            </Modal>
        </div>
    );
};

export default Plans;

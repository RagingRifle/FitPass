import { useState, useEffect, useContext } from 'react';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
    Apple, Calendar, User, Plus, Trash2, Edit3, Search, 
    Flame, Cookie, Zap, Droplet, Sparkles, CheckCircle2, Circle
} from 'lucide-react';

const DietPlans = () => {
    const { user } = useContext(AuthContext);
    const toast = useToast();
    const [plans, setPlans] = useState([]);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Form fields
    const [memberId, setMemberId] = useState('');
    const [planName, setPlanName] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [meals, setMeals] = useState([
        { time: '08:00 AM', name: 'Breakfast', items: '', calories: 0, protein: 0, carbs: 0, fats: 0 }
    ]);
    const [editingId, setEditingId] = useState(null);

    // Member self-tracking states
    const [consumedMeals, setConsumedMeals] = useState({}); // { 'index': boolean }
    const [waterIntake, setWaterIntake] = useState(0); // in cups (250ml)
    const [caloriesBurned, setCaloriesBurned] = useState(420); // standard daily baseline

    const isTrainerOrAdmin = ['admin', 'h4_admin', 'trainer', 'superadmin'].includes(user?.role);
    const isMember = user?.role === 'member';

    useEffect(() => {
        fetchPlans();
        if (isTrainerOrAdmin) {
            fetchMembers();
        }
        if (isMember) {
            // Load saved self-tracking progress for the day
            const savedWater = localStorage.getItem(`water_${user.id}`);
            if (savedWater) setWaterIntake(parseInt(savedWater));
            const savedConsumed = localStorage.getItem(`consumed_${user.id}`);
            if (savedConsumed) setConsumedMeals(JSON.parse(savedConsumed));
        }
    }, [isTrainerOrAdmin, user]);

    const fetchPlans = async () => {
        setLoading(true);
        try {
            const { data } = await API.get('/diet-plans');
            const planList = Array.isArray(data) ? data : (data?.data || []);
            setPlans(planList);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load diet plans');
            setPlans([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchMembers = async () => {
        try {
            const { data } = await API.get('/members');
            const memberList = Array.isArray(data) ? data : (data?.data || []);
            setMembers(memberList);
        } catch (err) {
            console.error('Failed to load members for select list:', err);
            setMembers([]);
        }
    };

    const handleAddMeal = () => {
        setMeals([
            ...meals,
            { time: '12:00 PM', name: 'Lunch', items: '', calories: 0, protein: 0, carbs: 0, fats: 0 }
        ]);
    };

    const handleRemoveMeal = (index) => {
        const updated = [...meals];
        updated.splice(index, 1);
        setMeals(updated);
    };

    const handleMealChange = (index, field, val) => {
        const updated = [...meals];
        updated[index] = { ...updated[index], [field]: val };
        setMeals(updated);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!memberId || !planName) {
            setError('Member and Plan Name are required.');
            return;
        }

        const payload = {
            memberId,
            name: planName,
            startDate: startDate || null,
            endDate: endDate || null,
            meals: meals.map(m => ({
                ...m,
                calories: Number(m.calories) || 0,
                protein: Number(m.protein) || 0,
                carbs: Number(m.carbs) || 0,
                fats: Number(m.fats) || 0
            }))
        };

        try {
            if (editingId) {
                await API.put(`/diet-plans/${editingId}`, payload);
                toast.success('Diet plan modified successfully! ');
            } else {
                await API.post('/diet-plans', payload);
                toast.success('Diet plan assigned successfully! ');
            }
            setShowModal(false);
            resetForm();
            fetchPlans();
        } catch (err) {
            const errMsg = err.response?.data?.message || 'Failed to save diet plan';
            setError(errMsg);
            toast.error(errMsg);
        }
    };

    const handleEdit = (plan) => {
        setEditingId(plan.id || plan._id);
        setMemberId(plan.memberId);
        setPlanName(plan.name);
        setStartDate(plan.startDate ? plan.startDate.split('T')[0] : '');
        setEndDate(plan.endDate ? plan.endDate.split('T')[0] : '');
        setMeals(plan.meals || [{ time: '08:00 AM', name: 'Breakfast', items: '', calories: 0, protein: 0, carbs: 0, fats: 0 }]);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this plan?')) return;
        try {
            await API.delete(`/diet-plans/${id}`);
            toast.success('Diet plan deleted successfully! ');
            fetchPlans();
        } catch (err) {
            const errMsg = err.response?.data?.message || 'Failed to delete plan';
            setError(errMsg);
            toast.error(errMsg);
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setMemberId('');
        setPlanName('');
        setStartDate('');
        setEndDate('');
        setMeals([{ time: '08:00 AM', name: 'Breakfast', items: '', calories: 0, protein: 0, carbs: 0, fats: 0 }]);
        setError('');
    };

    // Calculate dynamic totals for the current form meals array
    const formTotals = meals.reduce((acc, curr) => {
        acc.calories += Number(curr.calories) || 0;
        acc.protein += Number(curr.protein) || 0;
        acc.carbs += Number(curr.carbs) || 0;
        acc.fats += Number(curr.fats) || 0;
        return acc;
    }, { calories: 0, protein: 0, carbs: 0, fats: 0 });

    const safePlans = Array.isArray(plans) ? plans : [];

    // Active member diet plan details
    const activeMemberDiet = safePlans.find(p => p.memberId === user?.memberId || isMember);

    // Dynamic macro targets and consumed values
    const targetMacros = activeMemberDiet?.meals?.reduce((acc, curr) => {
        acc.calories += Number(curr.calories) || 0;
        acc.protein += Number(curr.protein) || 0;
        acc.carbs += Number(curr.carbs) || 0;
        acc.fats += Number(curr.fats) || 0;
        return acc;
    }, { calories: 0, protein: 0, carbs: 0, fats: 0 }) || { calories: 2000, protein: 150, carbs: 200, fats: 65 };

    const consumedMacros = activeMemberDiet?.meals?.reduce((acc, curr, index) => {
        if (consumedMeals[index]) {
            acc.calories += Number(curr.calories) || 0;
            acc.protein += Number(curr.protein) || 0;
            acc.carbs += Number(curr.carbs) || 0;
            acc.fats += Number(curr.fats) || 0;
        }
        return acc;
    }, { calories: 0, protein: 0, carbs: 0, fats: 0 }) || { calories: 0, protein: 0, carbs: 0, fats: 0 };

    const toggleMealConsumed = (index) => {
        const next = { ...consumedMeals, [index]: !consumedMeals[index] };
        setConsumedMeals(next);
        localStorage.setItem(`consumed_${user.id}`, JSON.stringify(next));
        toast.info(next[index] ? 'Meal marked as consumed! ' : 'Meal unmarked ');
    };

    const changeWaterIntake = (amount) => {
        const next = Math.max(0, waterIntake + amount);
        setWaterIntake(next);
        localStorage.setItem(`water_${user.id}`, next.toString());
        if (amount > 0) {
            toast.success('Water intake logged! ');
        } else if (amount < 0) {
            toast.info('Water log updated ');
        }
    };

    const filteredPlans = safePlans.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.member?.name && p.member.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="fade-in">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontWeight: '800', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Apple color="var(--primary)" /> Nutrition & Diets
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Meal templates, daily macros, and hydration logs</p>
                </div>
                {isTrainerOrAdmin && (
                    <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => { resetForm(); setShowModal(true); }}>
                        <Plus size={18} /> Assign Plan
                    </button>
                )}
            </div>

            {isMember ? (
                /* MEMBER MACROS TRACKING HUB */
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', alignItems: 'start' }}>
                    {/* Meal checklist */}
                    <div className="card" style={{ padding: '2rem' }}>
                        {!activeMemberDiet ? (
                            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                                <Apple size={48} style={{ color: 'var(--primary)', marginBottom: '1rem', opacity: 0.8 }} />
                                <h3>No Diet Plan Assigned</h3>
                                <p style={{ color: 'var(--text-secondary)' }}>You don't have an active diet plan. Contact your trainer to schedule your nutrition.</p>
                            </div>
                        ) : (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                                    <div>
                                        <h3 style={{ margin: 0 }}>{activeMemberDiet.name}</h3>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>Log consumed meals to keep macro levels balanced</p>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {activeMemberDiet.meals?.map((meal, index) => {
                                        const isDone = !!consumedMeals[index];
                                        return (
                                            <div 
                                                key={index}
                                                onClick={() => toggleMealConsumed(index)}
                                                style={{
                                                    background: isDone ? 'rgba(46, 125, 50, 0.05)' : 'var(--bg-secondary)',
                                                    border: isDone ? '1px solid var(--success)' : '1px solid var(--border)',
                                                    borderRadius: '16px', padding: '1.25rem', display: 'flex', justifyContent: 'space-between',
                                                    alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    {isDone ? (
                                                        <CheckCircle2 color="var(--success)" size={24} />
                                                    ) : (
                                                        <Circle size={24} color="var(--border)" />
                                                    )}
                                                    <div>
                                                        <div style={{ fontWeight: '700', color: isDone ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                                                            {meal.name} <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--text-secondary)' }}>({meal.time})</span>
                                                        </div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{meal.items}</div>
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{meal.calories} kcal</div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>P:{meal.protein}g C:{meal.carbs}g F:{meal.fats}g</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Stats & Water tracking */}
                    <div>
                        {/* Daily calorie ring progress */}
                        <div className="card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>Daily Macro Consumption</h3>
                            
                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: '600' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Flame size={16} color="var(--primary)" /> Caloric Intake</span>
                                    <span>{consumedMacros.calories} / {targetMacros.calories} kcal</span>
                                </div>
                                <div style={{ height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: 'var(--primary)', width: `${Math.min(100, (consumedMacros.calories / targetMacros.calories) * 100)}%`, transition: 'width 0.3s' }}></div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                                        <span>Protein</span>
                                        <span>{consumedMacros.protein}g</span>
                                    </div>
                                    <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', background: '#1976D2', width: `${Math.min(100, (consumedMacros.protein / targetMacros.protein) * 100)}%` }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                                        <span>Carbs</span>
                                        <span>{consumedMacros.carbs}g</span>
                                    </div>
                                    <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', background: '#F59E0B', width: `${Math.min(100, (consumedMacros.carbs / targetMacros.carbs) * 100)}%` }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>
                                        <span>Fats</span>
                                        <span>{consumedMacros.fats}g</span>
                                    </div>
                                    <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', background: '#C62828', width: `${Math.min(100, (consumedMacros.fats / targetMacros.fats) * 100)}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Hydration Tracker */}
                        <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', right: '-1rem', top: '-1rem', opacity: 0.08 }}>
                                <Droplet size={140} color="#1976D2" />
                            </div>
                            <div>
                                <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: '#1976D2', letterSpacing: '0.05em' }}>Hydration Log</span>
                                <h3 style={{ margin: '0.25rem 0 0.5rem 0', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Droplet color="#1976D2" fill="#1976D2" size={20} /> {waterIntake} / 8 Cups
                                </h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>Target: 2 Liters (8 cups of 250ml) for optimal metabolic health.</p>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => changeWaterIntake(1)}>+ 1 Cup</button>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => changeWaterIntake(-1)} disabled={waterIntake === 0}>- 1 Cup</button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* TRAINER DASHBOARD LIST */
                <div>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input 
                                type="text" 
                                placeholder="Search plans by name or member..." 
                                className="form-control"
                                style={{ paddingLeft: '2.5rem', width: '100%' }}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner"></div></div>
                    ) : filteredPlans.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
                            <Apple size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                            <h3>No Diet Plans Found</h3>
                            <p>Design a nutrition layout or create a new meal plan to get started.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
                            {filteredPlans.map((plan) => {
                                const totalCals = plan.meals?.reduce((sum, m) => sum + (Number(m.calories) || 0), 0) || 0;
                                return (
                                    <div className="card" key={plan.id || plan._id} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                                <div>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.05em' }}>
                                                        {plan.member?.name ? `Member: ${plan.member.name}` : 'Shared Template'}
                                                    </span>
                                                    <h3 style={{ marginTop: '0.25rem', marginBottom: '0.5rem', fontSize: '1.15rem' }}>{plan.name}</h3>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '50%' }} onClick={() => handleEdit(plan)}>
                                                        <Edit3 size={14} />
                                                    </button>
                                                    <button className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '50%', color: '#C62828' }} onClick={() => handleDelete(plan.id || plan._id)}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            {plan.startDate && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                                    <Calendar size={14} />
                                                    <span>
                                                        {new Date(plan.startDate).toLocaleDateString()} 
                                                        {plan.endDate && ` to ${new Date(plan.endDate).toLocaleDateString()}`}
                                                    </span>
                                                </div>
                                            )}

                                            <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1rem', border: '1px solid var(--border)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                                                    <span style={{ fontWeight: '700', fontSize: '0.85rem' }}>Daily Meals:</span>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--primary)' }}>{totalCals} kcal</span>
                                                </div>
                                                {plan.meals && plan.meals.length > 0 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        {plan.meals.slice(0, 3).map((meal, i) => (
                                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem' }}>
                                                                <span style={{ fontWeight: '600' }}>{meal.time} - {meal.name}</span>
                                                                <span style={{ color: 'var(--text-secondary)' }}>{meal.calories} kcal</span>
                                                            </div>
                                                        ))}
                                                        {plan.meals.length > 3 && (
                                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '0.25rem' }}>
                                                                + {plan.meals.length - 3} more meals
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No meals configured.</span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {plan.trainer && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderTop: '1px solid var(--border)', marginTop: '1.25rem', paddingTop: '0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                                <User size={12} />
                                                <span>Assigned by: {plan.trainer.name}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Assignment & Creation Modal */}
            {showModal && (
                <div className="diet-modal-overlay">
                    <div className="card diet-plan-modal">
                        <h3 style={{ marginBottom: '1.5rem' }}>{editingId ? 'Modify Assigned Plan' : 'Assign Diet Plan'}</h3>
                        
                        {/* Macro aggregation ticker */}
                        <div className="diet-macro-summary">
                            <div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Target Energy</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--primary)' }}>{formTotals.calories} kcal</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Protein</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1976D2' }}>{formTotals.protein} g</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Carbohydrates</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#F59E0B' }}>{formTotals.carbs} g</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Fats</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#C62828' }}>{formTotals.fats} g</div>
                            </div>
                        </div>

                        <form className="diet-plan-form" onSubmit={handleSubmit}>
                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Member</label>
                                <select 
                                    className="form-control" 
                                    style={{ width: '100%' }}
                                    value={memberId} 
                                    onChange={(e) => setMemberId(e.target.value)}
                                    required
                                    disabled={!!editingId}
                                >
                                    <option value="">Select Member</option>
                                    {members.map(m => (
                                        <option key={m._id} value={m._id}>{m.name} ({m.phone})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Plan Name</label>
                                <input 
                                    type="text" 
                                    className="form-control" 
                                    placeholder="e.g. Ketogenic weight loss meal plan"
                                    value={planName} 
                                    onChange={(e) => setPlanName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="diet-date-grid">
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Start Date</label>
                                    <input 
                                        type="date" 
                                        className="form-control" 
                                        value={startDate} 
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>End Date</label>
                                    <input 
                                        type="date" 
                                        className="form-control" 
                                        value={endDate} 
                                        onChange={(e) => setEndDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="diet-meals-section">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h4 style={{ margin: 0 }}>Meals & Macro-nutrients</h4>
                                    <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={handleAddMeal}>
                                        + Add Meal
                                    </button>
                                </div>

                                {meals.map((meal, index) => (
                                    <div key={index} className="diet-meal-card">
                                        <button type="button" className="diet-remove-meal" aria-label={`Remove ${meal.name || 'meal'}`} onClick={() => handleRemoveMeal(index)}>
                                            <Trash2 size={16} />
                                        </button>

                                        <div className="diet-meal-primary-grid">
                                            <input 
                                                type="text" 
                                                placeholder="Time (e.g. 08:00 AM)" 
                                                className="form-control" 
                                                value={meal.time} 
                                                onChange={(e) => handleMealChange(index, 'time', e.target.value)}
                                                required
                                            />
                                            <input 
                                                type="text" 
                                                placeholder="Meal Name (Breakfast)" 
                                                className="form-control" 
                                                value={meal.name} 
                                                onChange={(e) => handleMealChange(index, 'name', e.target.value)}
                                                required
                                            />
                                            <input 
                                                type="number" 
                                                placeholder="kcal" 
                                                className="form-control" 
                                                value={meal.calories} 
                                                onChange={(e) => handleMealChange(index, 'calories', parseInt(e.target.value) || 0)}
                                            />
                                        </div>

                                        <div className="diet-meal-macro-grid">
                                            <input 
                                                type="number" 
                                                placeholder="Prot (g)" 
                                                className="form-control" 
                                                value={meal.protein} 
                                                onChange={(e) => handleMealChange(index, 'protein', parseInt(e.target.value) || 0)}
                                            />
                                            <input 
                                                type="number" 
                                                placeholder="Carbs (g)" 
                                                className="form-control" 
                                                value={meal.carbs} 
                                                onChange={(e) => handleMealChange(index, 'carbs', parseInt(e.target.value) || 0)}
                                            />
                                            <input 
                                                type="number" 
                                                placeholder="Fats (g)" 
                                                className="form-control" 
                                                value={meal.fats} 
                                                onChange={(e) => handleMealChange(index, 'fats', parseInt(e.target.value) || 0)}
                                            />
                                        </div>

                                        <input 
                                            type="text" 
                                            placeholder="Food items (e.g. 3 eggs, 100g oats, 1 banana)" 
                                            className="form-control" 
                                            value={meal.items} 
                                            onChange={(e) => handleMealChange(index, 'items', e.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="diet-form-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Diet Plan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DietPlans;

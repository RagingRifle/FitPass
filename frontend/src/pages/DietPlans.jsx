import { useState, useEffect, useContext } from 'react';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
    Apple, Calendar, User, Plus, Trash2, Edit3, Search, 
    Flame, Cookie, Zap, Droplet, Sparkles, CheckCircle2, Circle, X
} from 'lucide-react';

const DietPlans = () => {
    const { user } = useContext(AuthContext);
    const toast = useToast();
    const [plans, setPlans] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [memberSearch, setMemberSearch] = useState('');
    const [membersLoading, setMembersLoading] = useState(false);
    const [memberDetailsLoading, setMemberDetailsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('plans');
    const [templateMode, setTemplateMode] = useState(false);
    const [editingTemplateId, setEditingTemplateId] = useState(null);
    const [templateName, setTemplateName] = useState('');
    const [templateDesc, setTemplateDesc] = useState('');
    const [selectedTemplateId, setSelectedTemplateId] = useState('');

    // Form fields
    const [memberId, setMemberId] = useState('');
    const [selectedMemberIds, setSelectedMemberIds] = useState([]);
    const [pendingMemberIds, setPendingMemberIds] = useState([]);
    const [memberPickerOpen, setMemberPickerOpen] = useState(false);
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
        if (isMember) {
            // Load saved self-tracking progress for the day
            const savedWater = localStorage.getItem(`water_${user.id}`);
            if (savedWater) setWaterIntake(parseInt(savedWater));
            const savedConsumed = localStorage.getItem(`consumed_${user.id}`);
            if (savedConsumed) setConsumedMeals(JSON.parse(savedConsumed));
        }
    }, [isTrainerOrAdmin, user]);

    useEffect(() => {
        if (!isTrainerOrAdmin) return;
        const timer = window.setTimeout(() => fetchMembers(memberSearch), memberSearch ? 250 : 0);
        return () => window.clearTimeout(timer);
    }, [isTrainerOrAdmin, memberSearch]);

    const fetchPlans = async () => {
        setLoading(true);
        try {
            const [{ data }, templatesResult] = await Promise.all([
                API.get('/diet-plans'), API.get('/diet-templates').catch(() => ({ data: [] }))
            ]);
            const planList = Array.isArray(data) ? data : (data?.data || []);
            setPlans(planList);
            setTemplates(Array.isArray(templatesResult.data) ? templatesResult.data : []);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load diet plans');
            setPlans([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchMembers = async (search = '') => {
        setMembersLoading(true);
        try {
            const { data } = await API.get('/members', { params: { page: 1, limit: 100, ...(search.trim() ? { search: search.trim() } : {}) } });
            const memberList = Array.isArray(data) ? data : (data?.members || data?.data || []);
            setMembers((current) => {
                const validMembers = memberList.filter((member) => member && (member._id || member.id));
                const byId = new Map(validMembers.map((member) => [String(member._id || member.id), member]));
                current.forEach((member) => {
                    const id = String(member._id || member.id);
                    if (!byId.has(id)) byId.set(id, member);
                });
                return [...byId.values()];
            });
        } catch (err) {
            console.error('Failed to load members for select list:', err);
            setMembers([]);
        } finally {
            setMembersLoading(false);
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
        if (templateMode) {
            if (!templateName.trim()) return;
            const templatePayload = { name: templateName.trim(), description: templateDesc, meals: payloadMeals() };
            try {
                if (editingTemplateId) await API.put(`/diet-templates/${editingTemplateId}`, templatePayload);
                else await API.post('/diet-templates', templatePayload);
                toast.success(editingTemplateId ? 'Diet template updated.' : 'Diet template created.');
                setShowModal(false);
                resetForm();
                fetchPlans();
            } catch (err) {
                const errMsg = err.response?.data?.message || 'Failed to save diet template';
                setError(errMsg);
                toast.error(errMsg);
            }
            return;
        }
        if (!selectedMemberIds.length || !planName) {
            setError('At least one member and a plan name are required.');
            return;
        }

        const payload = {
            memberId,
            memberIds: selectedMemberIds,
            name: planName,
            startDate: startDate || null,
            endDate: endDate || null,
            meals: payloadMeals()
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

    const payloadMeals = () => meals.map(m => ({
                ...m,
                calories: Number(m.calories) || 0,
                protein: Number(m.protein) || 0,
                carbs: Number(m.carbs) || 0,
                fats: Number(m.fats) || 0
            }));

    const handleEdit = (plan) => {
        setTemplateMode(false);
        setEditingTemplateId(null);
        setEditingId(plan.id || plan._id);
        const assignedMemberId = plan.memberId || plan.member?.id || plan.member?._id || '';
        setMemberId(assignedMemberId);
        const assignedMemberIds = Array.isArray(plan.memberIds) && plan.memberIds.length ? plan.memberIds.map(String) : [String(assignedMemberId)].filter(Boolean);
        setSelectedMemberIds(assignedMemberIds);
        setPendingMemberIds([]);
        setMemberPickerOpen(false);
        setMemberSearch('');
        const linkedMembers = (plan.members || []).map((member) => ({ ...member, id: String(member.id || member._id) }));
        if (plan.member && !linkedMembers.some((member) => String(member.id) === String(assignedMemberId))) linkedMembers.push({ ...plan.member, id: String(plan.member.id || assignedMemberId) });
        setMembers((current) => [...new Map([...linkedMembers, ...current].map((member) => [String(member._id || member.id), member])).values()]);
        const knownMemberIds = new Set([...linkedMembers, ...members].map((member) => String(member._id || member.id)));
        const missingMemberIds = assignedMemberIds.filter((id) => !knownMemberIds.has(String(id)));
        setMemberDetailsLoading(missingMemberIds.length > 0);
        if (missingMemberIds.length) {
            Promise.all(missingMemberIds.map((id) => API.get(`/members/${id}`).then(({ data }) => data).catch(() => null)))
                .then((results) => {
                    const resolved = results.filter(Boolean).map((member) => ({ ...member, id: String(member.id || member._id) }));
                    setMembers((current) => [...new Map([...current, ...resolved].map((member) => [String(member._id || member.id), member])).values()]);
                })
                .finally(() => setMemberDetailsLoading(false));
        }
        setPlanName(plan.name);
        setStartDate(plan.startDate ? plan.startDate.split('T')[0] : '');
        setEndDate(plan.endDate ? plan.endDate.split('T')[0] : '');
        setMeals(plan.meals || [{ time: '08:00 AM', name: 'Breakfast', items: '', calories: 0, protein: 0, carbs: 0, fats: 0 }]);
        setShowModal(true);
    };

    const handleAddMembersToPlan = (plan) => {
        handleEdit(plan);
        setMemberPickerOpen(true);
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
        setSelectedMemberIds([]);
        setPendingMemberIds([]);
        setMemberPickerOpen(false);
        setMemberSearch('');
        setPlanName('');
        setStartDate('');
        setEndDate('');
        setMeals([{ time: '08:00 AM', name: 'Breakfast', items: '', calories: 0, protein: 0, carbs: 0, fats: 0 }]);
        setError('');
        setTemplateMode(false);
        setEditingTemplateId(null);
        setTemplateName('');
        setTemplateDesc('');
        setSelectedTemplateId('');
    };

    const loadTemplate = (id) => {
        const template = templates.find((item) => String(item.id || item._id) === String(id));
        if (!template) return;
        setSelectedTemplateId(id);
        setPlanName(template.name);
        setMeals(template.meals || []);
    };

    const editTemplate = (template) => {
        resetForm();
        setTemplateMode(true);
        setEditingTemplateId(template.id || template._id);
        setTemplateName(template.name || '');
        setTemplateDesc(template.description || '');
        setMeals(template.meals || []);
        setShowModal(true);
    };

    const deleteTemplate = async (id) => {
        if (!window.confirm('Delete this diet template?')) return;
        try { await API.delete(`/diet-templates/${id}`); toast.success('Diet template deleted.'); fetchPlans(); }
        catch (err) { toast.error(err.response?.data?.message || 'Failed to delete template'); }
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
    const normalizedMemberSearch = memberSearch.trim().toLowerCase();
    const visibleMembers = members.filter((member) => {
        const id = String(member._id || member.id);
        const matchesSearch = !normalizedMemberSearch ||
            [member.name, member.phone, member.email].some((value) => String(value || '').toLowerCase().includes(normalizedMemberSearch));
        return matchesSearch && !selectedMemberIds.includes(id);
    });
    const selectedMembers = selectedMemberIds.map((id) => members.find(
        (member) => String(member._id || member.id) === String(id)
    ) || { id: String(id), name: `Member · ${String(id).slice(-6)}`, detailsUnavailable: true });
    const assignableMembers = visibleMembers;
    const toggleMember = (id) => {
        const idString = String(id);
        const next = selectedMemberIds.includes(idString)
            ? selectedMemberIds.filter((selectedId) => selectedId !== idString)
            : [...selectedMemberIds, idString];
        setSelectedMemberIds(next);
        setMemberId(next[0] || '');
    };
    const togglePendingMember = (id) => {
        const idString = String(id);
        setPendingMemberIds((current) => current.includes(idString)
            ? current.filter((selectedId) => selectedId !== idString)
            : [...current, idString]);
    };
    const commitPendingMembers = () => {
        const next = [...new Set([...selectedMemberIds, ...pendingMemberIds])];
        setSelectedMemberIds(next);
        setMemberId(next[0] || '');
        setPendingMemberIds([]);
        setMemberSearch('');
        setMemberPickerOpen(false);
    };
    const openMemberPicker = () => {
        setPendingMemberIds([]);
        setMemberSearch('');
        setMemberPickerOpen(true);
    };
    // Active member diet plan details
    const activeMemberDiet = safePlans.find((plan) =>
        String(plan.memberId) === String(user?.memberId) ||
        (Array.isArray(plan.memberIds) && plan.memberIds.map(String).includes(String(user?.memberId)))
    );

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
                {isTrainerOrAdmin && activeTab === 'plans' && (
                    <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => { resetForm(); setShowModal(true); }}>
                        <Plus size={18} /> Assign Plan
                    </button>
                )}
                {isTrainerOrAdmin && activeTab === 'templates' && <button className="btn btn-primary" onClick={() => { resetForm(); setTemplateMode(true); setShowModal(true); }}><Plus size={18} /> Create Template</button>}
            </div>
            {isTrainerOrAdmin && <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem' }}>
                <button className={`btn ${activeTab === 'plans' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('plans')}>Assigned Plans ({plans.length})</button>
                <button className={`btn ${activeTab === 'templates' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('templates')}>Diet Templates ({templates.length})</button>
            </div>}

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
                    {activeTab === 'templates' ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                        {templates.length === 0 && <div className="card"><h3>No Diet Templates Yet</h3><p>Create a reusable meal plan template for quick assignment.</p></div>}
                        {templates.map((template) => <div className="card" key={template.id || template._id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><div><h3>{template.name}</h3><p>{template.description}</p><small>{template.meals?.length || 0} meals</small></div><div style={{ display: 'flex', gap: '.4rem' }}><button className="btn btn-secondary" onClick={() => editTemplate(template)} aria-label="Edit template"><Edit3 size={15}/></button><button className="btn btn-secondary" onClick={() => deleteTemplate(template.id || template._id)} aria-label="Delete template"><Trash2 size={15}/></button></div></div>
                            <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => { resetForm(); setPlanName(template.name); setMeals(template.meals || []); setSelectedTemplateId(String(template.id || template._id)); setActiveTab('plans'); setShowModal(true); }}>Assign to member</button>
                        </div>)}
                    </div> : <>
                    <div className="diet-plan-search-row">
                        <div className="diet-search-field">
                            <Search size={18} aria-hidden="true" />
                            <input 
                                type="search"
                                placeholder="Search plans by name or member..." 
                                aria-label="Search diet plans by name or member"
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
                                const assignedCount = Array.isArray(plan.memberIds)
                                    ? plan.memberIds.length
                                    : (plan.members?.length || (plan.member ? 1 : 0));
                                return (
                                    <div className="card" key={plan.id || plan._id} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                                                <div>
                                                    <span className="diet-assigned-heading">Assigned members <i>{assignedCount}</i></span>
                                                    <h3 style={{ marginTop: '0.25rem', marginBottom: '0.5rem', fontSize: '1.15rem' }}>{plan.name}</h3>
                                                </div>
                                                <div className="diet-plan-card-actions">
                                                    <button className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '50%' }} onClick={() => handleEdit(plan)} aria-label={`Edit ${plan.name}`} title="Edit plan">
                                                        <Edit3 size={14} />
                                                    </button>
                                                    <button type="button" className="diet-card-add-members" onClick={() => handleAddMembersToPlan(plan)}><Plus size={14} /> Add members</button>
                                                    <button className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '50%', color: '#C62828' }} onClick={() => handleDelete(plan.id || plan._id)} aria-label={`Delete ${plan.name}`} title="Delete plan">
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
                    </>}
                </div>
            )}

            {/* Assignment & Creation Modal */}
            {showModal && (
                <div className="diet-modal-overlay">
                    <div className="card diet-plan-modal">
                        <h3 style={{ marginBottom: '1.5rem' }}>{templateMode ? (editingTemplateId ? 'Edit Diet Template' : 'Create Diet Template') : editingId ? 'Modify Assigned Plan' : 'Assign Diet Plan'}</h3>
                        
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
                            {templateMode ? <>
                            <div className="form-group" style={{ marginBottom: '1rem' }}><label style={{ display: 'block', marginBottom: '.5rem', fontWeight: 600 }}>Template Name</label><input className="form-control" value={templateName} onChange={(e) => setTemplateName(e.target.value)} required /></div>
                            <div className="form-group" style={{ marginBottom: '1rem' }}><label style={{ display: 'block', marginBottom: '.5rem', fontWeight: 600 }}>Description</label><input className="form-control" value={templateDesc} onChange={(e) => setTemplateDesc(e.target.value)} /></div>
                            </> : <>
                            <div className="form-group diet-member-picker">
                                <div className="diet-member-picker-heading">
                                    <label htmlFor="diet-member-search">Members</label>
                                    <span>{selectedMemberIds.length} selected</span>
                                </div>
                                {selectedMembers.length ? <div className="diet-selected-members" aria-label="Members assigned to this plan">
                                    {selectedMembers.map((member) => {
                                        const id = String(member._id || member.id);
                                        return <div className="diet-member-chip" key={id}>
                                            <span className="diet-member-avatar">{(member.name || '?').trim().charAt(0).toUpperCase()}</span>
                                            <span className="diet-member-chip-name">{member.name || 'Unnamed member'}</span>
                                            <button type="button" onClick={() => toggleMember(id)} aria-label={`Remove ${member.name} from this plan`}><X size={14} /></button>
                                        </div>;
                                    })}
                                </div> : <div className="diet-members-empty-selected">No members assigned yet.</div>}

                                {!memberPickerOpen ? (
                                    <button type="button" className="diet-open-member-picker" onClick={openMemberPicker}><Plus size={16} /> Add members</button>
                                ) : <div className="diet-member-picker-popover">
                                <div className="diet-search-field diet-member-search-field">
                                    <Search size={17} aria-hidden="true" />
                                    <input
                                        id="diet-member-search"
                                        type="search"
                                        placeholder="Find a member by name, phone, or email"
                                        value={memberSearch}
                                        onChange={(e) => setMemberSearch(e.target.value)}
                                        aria-label="Search members"
                                    />
                                </div>
                                <div className="diet-member-results" aria-label="Member search results">
                                    {assignableMembers.map((member) => {
                                        const id = String(member._id || member.id);
                                        const isSelected = pendingMemberIds.includes(id);
                                        return <label className={`diet-member-option${isSelected ? ' is-selected' : ''}`} key={id}>
                                            <input type="checkbox" checked={isSelected} onChange={() => togglePendingMember(id)} />
                                            <span className="diet-member-avatar">{(member.name || '?').trim().charAt(0).toUpperCase()}</span>
                                            <span className="diet-member-option-copy"><strong>{member.name || 'Unnamed member'}</strong><small>{member.phone || member.email || 'No contact details'}</small></span>
                                            <span className="diet-member-option-action">{isSelected ? 'Selected' : 'Select'}</span>
                                        </label>;
                                    })}
                                    {!visibleMembers.length && <div className="diet-member-results-empty">{membersLoading ? 'Searching members…' : 'No members match this search.'}</div>}
                                </div>
                                <small className="diet-member-result-count">
                                    {membersLoading ? 'Searching members…' : `${visibleMembers.length} member${visibleMembers.length === 1 ? '' : 's'} shown${memberSearch ? '' : ' · Search to find someone specific'}`}
                                </small>
                                <div className="diet-member-picker-actions">
                                    <button type="button" className="btn btn-secondary" onClick={() => { setMemberPickerOpen(false); setPendingMemberIds([]); setMemberSearch(''); }}>Cancel</button>
                                    <button type="button" className="btn btn-primary" onClick={commitPendingMembers} disabled={!pendingMemberIds.length}><Plus size={15} /> Add {pendingMemberIds.length || ''} {pendingMemberIds.length === 1 ? 'member' : 'members'}</button>
                                </div>
                                </div>}
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
                            {templates.length > 0 && <div className="form-group" style={{ marginBottom: '1rem' }}><label style={{ display: 'block', marginBottom: '.5rem', fontWeight: 600 }}>Load from template</label><select className="form-control" value={selectedTemplateId} onChange={(e) => loadTemplate(e.target.value)}><option value="">Choose a template...</option>{templates.map((template) => <option key={template.id || template._id} value={template.id || template._id}>{template.name}</option>)}</select></div>}
                            </>}

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
                                <button type="button" className="btn btn-secondary" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{templateMode ? 'Save Template' : editingId ? 'Save plan & members' : 'Assign diet plan'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DietPlans;

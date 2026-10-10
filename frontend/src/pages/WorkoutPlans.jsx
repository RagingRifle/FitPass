import { useState, useEffect, useContext } from 'react';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
    Dumbbell, Calendar, User, Plus, Trash2, Edit3, Search, 
    CheckCircle2, FolderHeart, ArrowRight, PlayCircle, Award, Sparkles, CheckSquare, Square
} from 'lucide-react';

const WorkoutPlans = () => {
    const { user } = useContext(AuthContext);
    const toast = useToast();
    const [activeTab, setActiveTab] = useState('plans'); // 'plans' | 'templates' | 'my-workout'
    const [plans, setPlans] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    // Search filter
    const [searchQuery, setSearchQuery] = useState('');

    // Assigned Plan Form state
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [memberId, setMemberId] = useState('');
    const [planName, setPlanName] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [exercises, setExercises] = useState([
        { day: 'Monday', name: '', sets: 3, reps: 10, weight: '', notes: '' }
    ]);
    const [editingPlanId, setEditingPlanId] = useState(null);

    // Template Form state
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [templateDesc, setTemplateDesc] = useState('');
    const [templateExercises, setTemplateExercises] = useState([
        { day: 'Monday', name: '', sets: 3, reps: 10, weight: '', notes: '' }
    ]);
    const [editingTemplateId, setEditingTemplateId] = useState(null);

    // Member interactive tracking state
    const [selectedDay, setSelectedDay] = useState('Monday');
    const [completedExercises, setCompletedExercises] = useState({}); // { 'ex-index': boolean }
    const [workoutStreak, setWorkoutStreak] = useState(0);
    const [progressLogs, setProgressLogs] = useState([]);

    const isTrainerOrAdmin = ['admin', 'h4_admin', 'trainer', 'superadmin'].includes(user?.role);
    const isMember = user?.role === 'member';

    useEffect(() => {
        if (isMember) {
            setActiveTab('my-workout');
            fetchMemberStreakAndLogs();
        } else {
            setActiveTab('plans');
        }
        fetchData();
    }, [user]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const planRes = await API.get('/workout-plans');
            const planData = planRes.data;
            setPlans(Array.isArray(planData) ? planData : (planData?.data || []));

            const tempRes = await API.get('/workout-templates');
            const tempData = tempRes.data;
            setTemplates(Array.isArray(tempData) ? tempData : (tempData?.data || []));

            if (isTrainerOrAdmin) {
                const firstPageRes = await API.get('/members', { params: { page: 1, limit: 100 } });
                const firstPage = firstPageRes.data;
                const firstMembers = Array.isArray(firstPage)
                    ? firstPage
                    : (firstPage?.members || firstPage?.data || []);
                const totalPages = Math.max(Number(firstPage?.pages) || 1, 1);

                const remainingPages = await Promise.all(
                    Array.from({ length: totalPages - 1 }, (_, index) =>
                        API.get('/members', { params: { page: index + 2, limit: 100 } })
                    )
                );
                const allMembers = [
                    ...firstMembers,
                    ...remainingPages.flatMap(({ data }) =>
                        Array.isArray(data) ? data : (data?.members || data?.data || [])
                    )
                ];
                setMembers(allMembers);
            }
        } catch {
            setError('Failed to sync workout system datasets');
            setPlans([]);
            setTemplates([]);
            setMembers([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchMemberStreakAndLogs = () => {
        const savedStreak = localStorage.getItem(`streak_${user.id}`) || 3;
        setWorkoutStreak(parseInt(savedStreak));
        const savedLogs = localStorage.getItem(`logs_${user.id}`);
        if (savedLogs) {
            setProgressLogs(JSON.parse(savedLogs));
        } else {
            const defaults = [
                { date: 'Yesterday', name: 'Hypertrophy Upper Body', exercises: 5 },
                { date: '3 days ago', name: 'Leg Day Core Focus', exercises: 6 }
            ];
            setProgressLogs(defaults);
            localStorage.setItem(`logs_${user.id}`, JSON.stringify(defaults));
        }
    };

    // --- PLANS CRUD ---
    const handleAddExercise = (isTemplate = false) => {
        const target = isTemplate ? templateExercises : exercises;
        const setTarget = isTemplate ? setTemplateExercises : setExercises;
        setTarget([
            ...target,
            { day: 'Monday', name: '', sets: 3, reps: 10, weight: '', notes: '' }
        ]);
    };

    const handleRemoveExercise = (index, isTemplate = false) => {
        const target = isTemplate ? templateExercises : exercises;
        const setTarget = isTemplate ? setTemplateExercises : setExercises;
        const updated = [...target];
        updated.splice(index, 1);
        setTarget(updated);
    };

    const handleExerciseChange = (index, field, val, isTemplate = false) => {
        const target = isTemplate ? templateExercises : exercises;
        const setTarget = isTemplate ? setTemplateExercises : setExercises;
        const updated = [...target];
        updated[index] = { ...updated[index], [field]: val };
        setTarget(updated);
    };

    const handleLoadTemplateToPlan = (templateId) => {
        const selected = templates.find(t => (t.id || t._id) === templateId);
        if (selected) {
            setPlanName(selected.name);
            setExercises(selected.exercises || []);
        }
    };

    const handlePlanSubmit = async (e) => {
        e.preventDefault();
        if (!memberId || !planName) return;

        const payload = {
            memberId,
            name: planName,
            startDate: startDate || null,
            endDate: endDate || null,
            exercises
        };

        try {
            if (editingPlanId) {
                await API.put(`/workout-plans/${editingPlanId}`, payload);
                toast.success('Workout plan modified successfully! ');
            } else {
                await API.post('/workout-plans', payload);
                toast.success('Workout plan assigned successfully! ');
            }
            setShowPlanModal(false);
            resetPlanForm();
            fetchData();
        } catch (err) {
            const errMsg = err.response?.data?.message || 'Error processing plan';
            setError(errMsg);
            toast.error(errMsg);
        }
    };

    const handleEditPlan = (plan) => {
        setEditingPlanId(plan.id || plan._id);
        setMemberId(plan.memberId || plan.member?.id || plan.member?._id || '');
        setPlanName(plan.name);
        setStartDate(plan.startDate ? plan.startDate.split('T')[0] : '');
        setEndDate(plan.endDate ? plan.endDate.split('T')[0] : '');
        setExercises(plan.exercises || []);
        setShowPlanModal(true);
    };

    const handleDeletePlan = async (id) => {
        if (!window.confirm('Delete this assigned plan?')) return;
        try {
            await API.delete(`/workout-plans/${id}`);
            toast.success('Workout plan deleted successfully! ');
            fetchData();
        } catch (err) {
            const errMsg = err.response?.data?.message || 'Error deleting plan';
            setError(errMsg);
            toast.error(errMsg);
        }
    };

    const resetPlanForm = () => {
        setEditingPlanId(null);
        setMemberId('');
        setPlanName('');
        setStartDate('');
        setEndDate('');
        setExercises([{ day: 'Monday', name: '', sets: 3, reps: 10, weight: '', notes: '' }]);
    };

    // --- TEMPLATES CRUD ---
    const handleTemplateSubmit = async (e) => {
        e.preventDefault();
        if (!templateName) return;

        const payload = {
            name: templateName,
            description: templateDesc,
            exercises: templateExercises
        };

        try {
            if (editingTemplateId) {
                await API.put(`/workout-templates/${editingTemplateId}`, payload);
                toast.success('Workout template modified! ');
            } else {
                await API.post('/workout-templates', payload);
                toast.success('Workout template created! ');
            }
            setShowTemplateModal(false);
            resetTemplateForm();
            fetchData();
        } catch (err) {
            const errMsg = err.response?.data?.message || 'Error processing template';
            setError(errMsg);
            toast.error(errMsg);
        }
    };

    const handleEditTemplate = (temp) => {
        setEditingTemplateId(temp.id || temp._id);
        setTemplateName(temp.name);
        setTemplateDesc(temp.description || '');
        setTemplateExercises(temp.exercises || []);
        setShowTemplateModal(true);
    };

    const handleDeleteTemplate = async (id) => {
        if (!window.confirm('Delete this workout template?')) return;
        try {
            await API.delete(`/workout-templates/${id}`);
            toast.success('Workout template deleted! ');
            fetchData();
        } catch (err) {
            const errMsg = err.response?.data?.message || 'Error deleting template';
            setError(errMsg);
            toast.error(errMsg);
        }
    };

    const resetTemplateForm = () => {
        setEditingTemplateId(null);
        setTemplateName('');
        setTemplateDesc('');
        setTemplateExercises([{ day: 'Monday', name: '', sets: 3, reps: 10, weight: '', notes: '' }]);
    };

    // --- MEMBER WORKOUT TRACKING ---
    const safePlans = Array.isArray(plans) ? plans : [];
    const activeMemberPlan = safePlans.find(p => p.memberId === user?.memberId || isMember);

    const getExercisesForDay = () => {
        if (!activeMemberPlan || !activeMemberPlan.exercises) return [];
        return activeMemberPlan.exercises.filter(ex => ex.day === selectedDay);
    };

    const toggleExerciseComplete = (index) => {
        const next = !completedExercises[index];
        setCompletedExercises(prev => ({
            ...prev,
            [index]: next
        }));
        toast.info(next ? 'Exercise completed! ' : 'Exercise unmarked ');
    };

    const handleCompleteWorkout = () => {
        const dayEx = getExercisesForDay();
        const doneCount = dayEx.filter((_, i) => completedExercises[i]).length;
        if (doneCount === 0) return;

        const newLog = {
            date: 'Today (' + new Date().toLocaleDateString(undefined, {month: 'short', day: 'numeric'}) + ')',
            name: `${activeMemberPlan.name} - ${selectedDay}`,
            exercises: doneCount
        };

        const updatedLogs = [newLog, ...progressLogs.slice(0, 4)];
        setProgressLogs(updatedLogs);
        localStorage.setItem(`logs_${user.id}`, JSON.stringify(updatedLogs));

        const nextStreak = workoutStreak + 1;
        setWorkoutStreak(nextStreak);
        localStorage.setItem(`streak_${user.id}`, nextStreak.toString());

        setCompletedExercises({});
        toast.success(' Awesome job! Today\'s training session has been logged to your streak profile.');
    };

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
                        <Dumbbell color="var(--primary)" /> Workout Hub
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Design routines, load templates, and track fitness compliance</p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {isTrainerOrAdmin && activeTab === 'plans' && (
                        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => { resetPlanForm(); setShowPlanModal(true); }}>
                            <Plus size={18} /> Assign Plan
                        </button>
                    )}
                    {isTrainerOrAdmin && activeTab === 'templates' && (
                        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => { resetTemplateForm(); setShowTemplateModal(true); }}>
                            <Plus size={18} /> Create Template
                        </button>
                    )}
                </div>
            </div>

            {/* TAB SELECTOR */}
            <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.25rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid var(--border)', maxWidth: 'max-content' }}>
                {isTrainerOrAdmin && (
                    <>
                        <button 
                            className={`btn ${activeTab === 'plans' ? 'btn-primary' : ''}`} 
                            style={{ background: activeTab === 'plans' ? '' : 'none', border: 'none', color: activeTab === 'plans' ? '' : 'var(--text-secondary)' }}
                            onClick={() => setActiveTab('plans')}
                        >
                            Assigned Members ({plans.length})
                        </button>
                        <button 
                            className={`btn ${activeTab === 'templates' ? 'btn-primary' : ''}`} 
                            style={{ background: activeTab === 'templates' ? '' : 'none', border: 'none', color: activeTab === 'templates' ? '' : 'var(--text-secondary)' }}
                            onClick={() => setActiveTab('templates')}
                        >
                            Global Templates ({templates.length})
                        </button>
                    </>
                )}
                {isMember && (
                    <button 
                        className={`btn ${activeTab === 'my-workout' ? 'btn-primary' : ''}`} 
                        style={{ background: activeTab === 'my-workout' ? '' : 'none', border: 'none', color: activeTab === 'my-workout' ? '' : 'var(--text-secondary)' }}
                        onClick={() => setActiveTab('my-workout')}
                    >
                        My Daily Routine
                    </button>
                )}
            </div>

            {error && (
                <div style={{ background: 'rgba(198,40,40,0.1)', border: '1px solid var(--error)', color: 'var(--error)', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem' }}>
                    {error}
                </div>
            )}

            {/* loading state */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}><div className="spinner"></div></div>
            ) : (
                <>
                    {/* TAB Content: ASSIGNED PLANS */}
                    {activeTab === 'plans' && (
                        <div>
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                    <input 
                                        type="text" 
                                        placeholder="Search member plans..." 
                                        className="form-control"
                                        style={{ paddingLeft: '2.5rem', width: '100%' }}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            {filteredPlans.length === 0 ? (
                                <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
                                    <Dumbbell size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                                    <h3>No Assigned Plans Found</h3>
                                    <p>Design a custom routine or pull a template to assign workout to a member.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
                                    {filteredPlans.map((plan) => (
                                        <div className="card" key={plan.id || plan._id} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                                    <div>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.05em' }}>
                                                            {plan.member?.name ? `Member: ${plan.member.name}` : 'No Member Linked'}
                                                        </span>
                                                        <h3 style={{ marginTop: '0.25rem', marginBottom: '0.5rem', fontSize: '1.15rem' }}>{plan.name}</h3>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '50%' }} onClick={() => handleEditPlan(plan)}>
                                                            <Edit3 size={14} />
                                                        </button>
                                                        <button className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '50%', color: '#C62828' }} onClick={() => handleDeletePlan(plan.id || plan._id)}>
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
                                                    <div style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Weekly Schedule:</div>
                                                    {plan.exercises && plan.exercises.length > 0 ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                            {plan.exercises.slice(0, 3).map((ex, i) => (
                                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem' }}>
                                                                    <span style={{ fontWeight: '600' }}>{ex.day}: {ex.name}</span>
                                                                    <span style={{ color: 'var(--text-secondary)' }}>{ex.sets}x{ex.reps} {ex.weight && `(${ex.weight}kg)`}</span>
                                                                </div>
                                                            ))}
                                                            {plan.exercises.length > 3 && (
                                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '0.25rem' }}>
                                                                    + {plan.exercises.length - 3} more exercises
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No exercises defined.</span>
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
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB Content: TEMPLATES */}
                    {activeTab === 'templates' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            {templates.length === 0 ? (
                                <div className="card" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
                                    <FolderHeart size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                                    <h3>No Workout Templates</h3>
                                    <p>Create global template presets for rapid member plan assignments.</p>
                                </div>
                            ) : (
                                templates.map((temp) => (
                                    <div className="card" key={temp.id || temp._id} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                                <div>
                                                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{temp.name}</h3>
                                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0.25rem 0 0 0' }}>{temp.description || 'No description provided'}</p>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '50%' }} onClick={() => handleEditTemplate(temp)}>
                                                        <Edit3 size={14} />
                                                    </button>
                                                    <button className="btn btn-secondary" style={{ padding: '0.4rem', borderRadius: '50%', color: '#C62828' }} onClick={() => handleDeleteTemplate(temp.id || temp._id)}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1rem', border: '1px solid var(--border)' }}>
                                                {temp.exercises && temp.exercises.length > 0 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        {temp.exercises.slice(0, 3).map((ex, i) => (
                                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem' }}>
                                                                <span style={{ fontWeight: '600' }}>{ex.day}: {ex.name}</span>
                                                                <span style={{ color: 'var(--text-secondary)' }}>{ex.sets}x{ex.reps}</span>
                                                            </div>
                                                        ))}
                                                        {temp.exercises.length > 3 && (
                                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                                                                + {temp.exercises.length - 3} more exercises
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No exercises defined.</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* TAB Content: MEMBER WORKOUT TRACKER */}
                    {activeTab === 'my-workout' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', alignItems: 'start' }}>
                            {/* Exercises details */}
                            <div className="card" style={{ padding: '2rem' }}>
                                {!activeMemberPlan ? (
                                    <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                                        <Dumbbell size={48} style={{ color: 'var(--primary)', marginBottom: '1rem', opacity: 0.8 }} />
                                        <h3>No Active Workout Plan</h3>
                                        <p style={{ color: 'var(--text-secondary)' }}>You don't have an active workout routine. Ask your trainer to assign one.</p>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                                            <div>
                                                <h3 style={{ margin: 0 }}>{activeMemberPlan.name}</h3>
                                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>Mark exercises as completed during today's training session</p>
                                            </div>
                                        </div>

                                        {/* Day Selectors */}
                                        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.75rem', marginBottom: '1.5rem' }}>
                                            {daysOfWeek.map(d => (
                                                <button 
                                                    key={d}
                                                    onClick={() => { setSelectedDay(d); setCompletedExercises({}); }}
                                                    style={{
                                                        padding: '0.5rem 1rem', borderRadius: '20px', border: '1px solid var(--border)',
                                                        background: selectedDay === d ? 'var(--primary)' : 'var(--bg-secondary)',
                                                        color: selectedDay === d ? 'var(--text-inverse)' : 'var(--text-primary)',
                                                        fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    {d.slice(0, 3)}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Exercises list */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            {getExercisesForDay().length === 0 ? (
                                                <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
                                                    <PlayCircle size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                                                    <div style={{ fontWeight: '700' }}>Rest Day / Cooldown</div>
                                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.25rem 0 0 0' }}>Enjoy your recovery session!</p>
                                                </div>
                                            ) : (
                                                getExercisesForDay().map((ex, index) => {
                                                    const isDone = !!completedExercises[index];
                                                    return (
                                                        <div 
                                                            key={index}
                                                            onClick={() => toggleExerciseComplete(index)}
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
                                                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid var(--border)' }} />
                                                                )}
                                                                <div>
                                                                    <div style={{ fontWeight: '700', color: isDone ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none' }}>
                                                                        {ex.name}
                                                                    </div>
                                                                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                                                        <span>{ex.sets} Sets</span>
                                                                        <span>•</span>
                                                                        <span>{ex.reps} Reps</span>
                                                                        {ex.weight && (
                                                                            <>
                                                                                <span>•</span>
                                                                                <span>{ex.weight} kg</span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                    {ex.notes && (
                                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}> {ex.notes}</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>

                                        {getExercisesForDay().length > 0 && (
                                            <button 
                                                className="btn btn-primary" 
                                                style={{ width: '100%', marginTop: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                                                onClick={handleCompleteWorkout}
                                                disabled={getExercisesForDay().filter((_, i) => completedExercises[i]).length === 0}
                                            >
                                                <Award size={18} /> Log Today's Training session
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Streak and Stats tracker */}
                            <div>
                                <div className="card" style={{ background: 'var(--bg-secondary)', padding: '2rem', marginBottom: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ position: 'absolute', right: '-1rem', top: '-1rem', opacity: 0.1 }}>
                                        <Sparkles size={120} color="var(--primary)" />
                                    </div>
                                    <div style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.05em' }}>Streak Profile</div>
                                    <div style={{ fontSize: '3rem', fontWeight: '900', color: 'var(--text-primary)', margin: '0.5rem 0' }}>{workoutStreak} Days</div>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>You are training consistently! Keep moving to unlock achievements.</p>
                                </div>

                                <div className="card" style={{ padding: '1.5rem' }}>
                                    <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1rem' }}>Workout Compliance History</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {progressLogs.map((log, index) => (
                                            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: index !== progressLogs.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: '0.75rem' }}>
                                                <div>
                                                    <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{log.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{log.date}</div>
                                                </div>
                                                <div style={{ background: 'rgba(46, 125, 50, 0.1)', color: 'var(--success)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700' }}>
                                                    {log.exercises} Exercises
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* PLAN ASSIGNMENT MODAL */}
            {showPlanModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div className="card" style={{ width: '90%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
                        <h3 style={{ marginBottom: '1.5rem' }}>{editingPlanId ? 'Modify Assigned Plan' : 'Assign Workout Plan'}</h3>
                        <form onSubmit={handlePlanSubmit}>
                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Select Member</label>
                                <select 
                                    className="form-control" 
                                    style={{ width: '100%' }}
                                    value={memberId} 
                                    onChange={(e) => setMemberId(e.target.value)}
                                    required
                                    disabled={!!editingPlanId}
                                >
                                    <option value="">Choose member...</option>
                                    {members.map(m => (
                                        <option key={m._id || m.id} value={m._id || m.id}>{m.name} ({m.phone || 'No phone'})</option>
                                    ))}
                                </select>
                                {members.length === 0 && (
                                    <small style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                                        No members found for this gym. Add a member before assigning a workout plan.
                                    </small>
                                )}
                            </div>

                            {/* Load Template Quick Option */}
                            {!editingPlanId && templates.length > 0 && (
                                <div className="form-group" style={{ marginBottom: '1rem', background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                    <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '700', fontSize: '0.8rem', color: 'var(--primary)' }}> QUICK TEMPLATE LOADER</label>
                                    <select 
                                        className="form-control" 
                                        style={{ width: '100%', fontSize: '0.8rem' }}
                                        onChange={(e) => handleLoadTemplateToPlan(e.target.value)}
                                    >
                                        <option value="">Select template to load...</option>
                                        {templates.map(t => (
                                            <option key={t.id || t._id} value={t.id || t._id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Plan Name</label>
                                <input 
                                    type="text" 
                                    className="form-control" 
                                    placeholder="e.g. Intermediate Push-Pull-Legs"
                                    value={planName} 
                                    onChange={(e) => setPlanName(e.target.value)}
                                    required
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
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

                            {/* Exercises schedule builder */}
                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h4 style={{ margin: 0 }}>Exercises Config</h4>
                                    <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => handleAddExercise(false)}>
                                        + Add Row
                                    </button>
                                </div>

                                {exercises.map((ex, index) => (
                                    <div key={index} style={{
                                        display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr 1fr 1.2fr 0.5fr', gap: '0.5rem',
                                        marginBottom: '0.75rem', alignItems: 'center'
                                    }}>
                                        <select 
                                            className="form-control" 
                                            style={{ fontSize: '0.8rem' }}
                                            value={ex.day} 
                                            onChange={(e) => handleExerciseChange(index, 'day', e.target.value, false)}
                                        >
                                            {daysOfWeek.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                        <input 
                                            type="text" 
                                            placeholder="Bench press" 
                                            className="form-control" 
                                            style={{ fontSize: '0.8rem' }}
                                            value={ex.name} 
                                            onChange={(e) => handleExerciseChange(index, 'name', e.target.value, false)}
                                            required
                                        />
                                        <input 
                                            type="number" 
                                            placeholder="Sets" 
                                            className="form-control" 
                                            style={{ fontSize: '0.8rem' }}
                                            value={ex.sets} 
                                            onChange={(e) => handleExerciseChange(index, 'sets', parseInt(e.target.value) || 0, false)}
                                            required
                                        />
                                        <input 
                                            type="number" 
                                            placeholder="Reps" 
                                            className="form-control" 
                                            style={{ fontSize: '0.8rem' }}
                                            value={ex.reps} 
                                            onChange={(e) => handleExerciseChange(index, 'reps', parseInt(e.target.value) || 0, false)}
                                            required
                                        />
                                        <input 
                                            type="text" 
                                            placeholder="Wt / Note" 
                                            className="form-control" 
                                            style={{ fontSize: '0.8rem' }}
                                            value={ex.weight} 
                                            onChange={(e) => handleExerciseChange(index, 'weight', e.target.value, false)}
                                        />
                                        <button type="button" style={{ background: 'none', border: 'none', color: '#C62828', cursor: 'pointer', display: 'flex', justifyContent: 'center' }} onClick={() => handleRemoveExercise(index, false)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowPlanModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save assigned Plan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* TEMPLATE CREATION MODAL */}
            {showTemplateModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div className="card" style={{ width: '90%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
                        <h3 style={{ marginBottom: '1.5rem' }}>{editingTemplateId ? 'Edit Workout Template' : 'Create Global Workout Template'}</h3>
                        <form onSubmit={handleTemplateSubmit}>
                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Template Name</label>
                                <input 
                                    type="text" 
                                    className="form-control" 
                                    placeholder="e.g. Standard 5x5 Strength Routine"
                                    value={templateName} 
                                    onChange={(e) => setTemplateName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Description</label>
                                <input 
                                    type="text" 
                                    className="form-control" 
                                    placeholder="Brief explanation of routine objectives..."
                                    value={templateDesc} 
                                    onChange={(e) => setTemplateDesc(e.target.value)}
                                />
                            </div>

                            {/* Template exercises config */}
                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h4 style={{ margin: 0 }}>Exercises Template</h4>
                                    <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => handleAddExercise(true)}>
                                        + Add Row
                                    </button>
                                </div>

                                {templateExercises.map((ex, index) => (
                                    <div key={index} style={{
                                        display: 'grid', gridTemplateColumns: '1.5fr 2fr 1fr 1fr 1.2fr 0.5fr', gap: '0.5rem',
                                        marginBottom: '0.75rem', alignItems: 'center'
                                    }}>
                                        <select 
                                            className="form-control" 
                                            style={{ fontSize: '0.8rem' }}
                                            value={ex.day} 
                                            onChange={(e) => handleExerciseChange(index, 'day', e.target.value, true)}
                                        >
                                            {daysOfWeek.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                        <input 
                                            type="text" 
                                            placeholder="Deadlift" 
                                            className="form-control" 
                                            style={{ fontSize: '0.8rem' }}
                                            value={ex.name} 
                                            onChange={(e) => handleExerciseChange(index, 'name', e.target.value, true)}
                                            required
                                        />
                                        <input 
                                            type="number" 
                                            placeholder="Sets" 
                                            className="form-control" 
                                            style={{ fontSize: '0.8rem' }}
                                            value={ex.sets} 
                                            onChange={(e) => handleExerciseChange(index, 'sets', parseInt(e.target.value) || 0, true)}
                                            required
                                        />
                                        <input 
                                            type="number" 
                                            placeholder="Reps" 
                                            className="form-control" 
                                            style={{ fontSize: '0.8rem' }}
                                            value={ex.reps} 
                                            onChange={(e) => handleExerciseChange(index, 'reps', parseInt(e.target.value) || 0, true)}
                                            required
                                        />
                                        <input 
                                            type="text" 
                                            placeholder="Notes" 
                                            className="form-control" 
                                            style={{ fontSize: '0.8rem' }}
                                            value={ex.weight} 
                                            onChange={(e) => handleExerciseChange(index, 'weight', e.target.value, true)}
                                        />
                                        <button type="button" style={{ background: 'none', border: 'none', color: '#C62828', cursor: 'pointer', display: 'flex', justifyContent: 'center' }} onClick={() => handleRemoveExercise(index, true)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowTemplateModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Template</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkoutPlans;

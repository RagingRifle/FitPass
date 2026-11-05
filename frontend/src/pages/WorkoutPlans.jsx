import { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import MemberFilterSelect from '../components/MemberFilterSelect';
import ResetFiltersButton from '../components/ResetFiltersButton';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { 
    Dumbbell, Calendar, User, Plus, Trash2, Edit3, Search, 
    CheckCircle2, FolderHeart, ArrowRight, PlayCircle, Award, Sparkles, CheckSquare, Square, X
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
    const [selectedMemberIds, setSelectedMemberIds] = useState([]);
    const [assignmentMemberSearch, setAssignmentMemberSearch] = useState('');
    const [planName, setPlanName] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [exercises, setExercises] = useState([
        { day: 'Monday', name: '', sets: 3, reps: 10, weight: '', notes: '' }
    ]);
    const [editingPlanId, setEditingPlanId] = useState(null);
    const [assignedTrainerId, setAssignedTrainerId] = useState('');

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
    const [progressFilters, setProgressFilters] = useState({ from: '', to: '', memberId: '', branchId: '', trainerId: '' });
    const [branches, setBranches] = useState([]);
    const [trainers, setTrainers] = useState([]);
    const [progressLoading, setProgressLoading] = useState(false);
    const [savingWorkout, setSavingWorkout] = useState(false);

    const isTrainerOrAdmin = ['admin', 'h4_admin', 'trainer', 'superadmin'].includes(user?.role);
    const isMember = user?.role === 'member';

    const fetchWorkoutProgress = useCallback(async (filters = {}) => {
        setProgressLoading(true);
        try {
            const { data } = await API.get('/workout-plans/logs', { params: { ...filters, timezoneOffset: new Date().getTimezoneOffset(), limit: 1000 } });
            setProgressLogs(Array.isArray(data) ? data : []);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not load workout progress.');
            setProgressLogs([]);
        } finally { setProgressLoading(false); }
    }, [toast]);

    useEffect(() => {
        if (isMember) {
            setActiveTab('my-workout');
            fetchMemberStreakAndLogs();
        } else {
            setActiveTab('plans');
        }
        fetchData();
    }, [user]);

    useEffect(() => {
        if (isTrainerOrAdmin) {
            API.get('/branches').then(({ data }) => setBranches(Array.isArray(data) ? data : [])).catch(() => setBranches([]));
            API.get('/staff').then(({ data }) => setTrainers((Array.isArray(data) ? data : []).filter(person => person.role === 'trainer'))).catch(() => setTrainers([]));
        }
    }, [isTrainerOrAdmin]);

    useEffect(() => {
        if (!isTrainerOrAdmin || activeTab !== 'progress') return;
        const timer = window.setTimeout(() => fetchWorkoutProgress(progressFilters), 250);
        return () => window.clearTimeout(timer);
    }, [isTrainerOrAdmin, activeTab, progressFilters, fetchWorkoutProgress]);

    const fetchData = async () => {
        setLoading(true);
        setError('');
        const requests = [API.get('/workout-plans'), API.get('/workout-templates')];
        if (isTrainerOrAdmin) requests.push(API.get('/members', { params: { page: 1, limit: 100 } }));

        const [plansResult, templatesResult, membersResult] = await Promise.allSettled(requests);
        if (plansResult.status === 'fulfilled') {
            const data = plansResult.value.data;
            setPlans(Array.isArray(data) ? data : (data?.data || []));
        } else {
            setPlans([]);
            setError('Workout plans could not be loaded.');
        }

        if (templatesResult.status === 'fulfilled') {
            const data = templatesResult.value.data;
            setTemplates(Array.isArray(data) ? data : (data?.data || []));
        } else {
            setTemplates([]);
            setError((current) => current || 'Workout templates could not be loaded.');
        }

        if (isTrainerOrAdmin) {
            if (membersResult?.status === 'fulfilled') {
                const firstPage = membersResult.value.data;
                const firstMembers = Array.isArray(firstPage) ? firstPage : (firstPage?.members || firstPage?.data || []);
                const totalPages = Math.max(Number(firstPage?.pages) || 1, 1);
                try {
                    const remainingPages = await Promise.all(
                        Array.from({ length: totalPages - 1 }, (_, index) =>
                            API.get('/members', { params: { page: index + 2, limit: 100 } })
                        )
                    );
                    setMembers([
                        ...firstMembers,
                        ...remainingPages.flatMap(({ data }) => Array.isArray(data) ? data : (data?.members || data?.data || []))
                    ]);
                } catch {
                    setMembers(firstMembers);
                    setError((current) => current || 'Some members could not be loaded.');
                }
            } else {
                setMembers([]);
                const detail = membersResult?.reason?.response?.data?.message;
                setError((current) => current || detail || 'Members could not be loaded. Check your gym selection and access.');
            }
        }
        setLoading(false);
    };

    const fetchMemberStreakAndLogs = async () => {
        try {
            const { data } = await API.get('/workout-plans/logs', { params: { from: shiftLocalDay(getLocalDayKey(), -90), to: getLocalDayKey(), timezoneOffset: new Date().getTimezoneOffset(), limit: 1000 } });
            const logs = Array.isArray(data) ? data : [];
            setProgressLogs(logs);
            const loggedDays = new Set(logs.map(log => getLocalDayKey(new Date(log.loggedAt))));
            let streak = 0;
            const today = getLocalDayKey();
            const startOffset = loggedDays.has(today) ? 0 : 1;
            for (let offset = startOffset; loggedDays.has(shiftLocalDay(today, -offset)); offset += 1) streak += 1;
            setWorkoutStreak(streak);
        } catch (err) {
            console.error('Could not load workout history:', err);
            setProgressLogs([]);
            setWorkoutStreak(0);
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
        const selected = templates.find(t => String(t.id || t._id) === String(templateId));
        if (selected) {
            setPlanName(selected.name);
            setExercises((selected.exercises || []).map((exercise) => ({ ...exercise })));
        }
    };

    const handleAssignTemplate = (template) => {
        resetPlanForm();
        setPlanName(template.name || '');
        setExercises((template.exercises || []).map((exercise) => ({ ...exercise })));
        setActiveTab('plans');
        setShowPlanModal(true);
    };

    const handlePlanSubmit = async (e) => {
        e.preventDefault();
        if (!selectedMemberIds.length || !planName) return;

        const payload = {
            memberId: selectedMemberIds[0],
            memberIds: selectedMemberIds,
            name: planName,
            startDate: startDate || null,
            endDate: endDate || null,
            trainerId: user?.role === 'trainer' ? user.id : (assignedTrainerId || null),
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
        const assignedMemberIds = Array.isArray(plan.memberIds) && plan.memberIds.length
            ? plan.memberIds.map(String)
            : [String(plan.memberId || plan.member?.id || plan.member?._id || '')].filter(Boolean);
        setSelectedMemberIds(assignedMemberIds);
        const assignedMembers = Array.isArray(plan.members) && plan.members.length ? plan.members : [plan.member].filter(Boolean);
        setMembers(current => {
            const map = new Map(current.map(member => [String(member.id || member._id), member]));
            assignedMembers.forEach(member => map.set(String(member.id || member._id), member));
            return [...map.values()];
        });
        setPlanName(plan.name);
        setStartDate(plan.startDate ? plan.startDate.split('T')[0] : '');
        setEndDate(plan.endDate ? plan.endDate.split('T')[0] : '');
        setAssignedTrainerId(plan.trainerId || plan.trainer?.id || plan.trainer?._id || '');
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
        setSelectedMemberIds([]);
        setAssignmentMemberSearch('');
        setPlanName('');
        setStartDate('');
        setEndDate('');
        setAssignedTrainerId('');
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
    const activeMemberPlan = safePlans.find(p => (Array.isArray(p.memberIds) ? p.memberIds : [p.memberId]).map(String).includes(String(user?.memberId))) || (isMember ? safePlans[0] : null);

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

    const handleCompleteWorkout = async () => {
        const dayEx = getExercisesForDay();
        const completed = dayEx.filter((_, index) => completedExercises[index]);
        if (!completed.length) return;
        setSavingWorkout(true);
        try {
            await API.post('/workout-plans/log', {
                planId: activeMemberPlan.id || activeMemberPlan._id,
                planName: activeMemberPlan.name,
                trainingDay: selectedDay,
                exercises: completed,
                totalExercises: dayEx.length,
                loggedAt: new Date().toISOString()
            });
            setCompletedExercises({});
            await fetchMemberStreakAndLogs();
            toast.success('Training session saved to your progress history.');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not save this training session.');
        } finally { setSavingWorkout(false); }
    };

    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const filteredPlans = safePlans.filter(p => {
        const query = searchQuery.toLocaleLowerCase();
        const assignedMembers = Array.isArray(p.members) ? p.members : [p.member].filter(Boolean);
        return p.name.toLocaleLowerCase().includes(query) || assignedMembers.some(member =>
            [member.registrationNumber, member.name, member.phone, member.email].some(value => String(value || '').toLocaleLowerCase().includes(query))
        );
    });

    const assignmentMemberOptions = useMemo(() => {
        const query = assignmentMemberSearch.trim().toLocaleLowerCase();
        if (!query) return members;
        return members.filter(member => [member.registrationNumber, member.id, member._id, member.name, member.phone, member.email]
            .some(value => String(value || '').toLocaleLowerCase().includes(query)));
    }, [members, assignmentMemberSearch]);

    const workoutTrendData = useMemo(() => {
        const grouped = new Map();
        progressLogs.forEach(log => {
            const dateKey = getLocalDayKey(new Date(log.loggedAt));
            const row = grouped.get(dateKey) || { date: new Date(log.loggedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), sessions: 0, exercises: 0, adherence: 0 };
            row.sessions += 1;
            row.exercises += Number(log.completedExercises) || 0;
            row.adherence += log.totalExercises ? (Number(log.completedExercises) / Number(log.totalExercises)) * 100 : 0;
            grouped.set(dateKey, row);
        });
        return [...grouped.values()].reverse().map(row => ({ ...row, adherence: Math.round(row.adherence / row.sessions) }));
    }, [progressLogs]);

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
            <div className="workout-tabs" role="tablist" aria-label="Workout plan views">
                {isTrainerOrAdmin && (
                    <>
                        <button 
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'plans'}
                            className={`workout-tab ${activeTab === 'plans' ? 'active' : ''}`}
                            onClick={() => setActiveTab('plans')}
                        >
                            Assigned Members ({plans.length})
                        </button>
                        <button 
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'templates'}
                            className={`workout-tab ${activeTab === 'templates' ? 'active' : ''}`}
                            onClick={() => setActiveTab('templates')}
                        >
                            Global Templates ({templates.length})
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'progress'}
                            className={`workout-tab ${activeTab === 'progress' ? 'active' : ''}`}
                            onClick={() => setActiveTab('progress')}
                        >
                            Member Progress
                        </button>
                    </>
                )}
                {isMember && (
                    <button 
                        type="button"
                        role="tab"
                        aria-selected={activeTab === 'my-workout'}
                        className={`workout-tab ${activeTab === 'my-workout' ? 'active' : ''}`}
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
                            <div className="workout-search-row">
                                <div className="workout-search-field">
                                    <Search size={18} aria-hidden="true" />
                                    <input 
                                        type="text" 
                                        placeholder="Search member plans..." 
                                        className="form-control workout-search-input"
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
                                                            {plan.members?.length > 1 ? `${plan.members.length} assigned members` : (plan.member?.name ? `Member: ${plan.member.name}` : 'No Member Linked')}
                                                        </span>
                                                        {(plan.members?.length ? plan.members : [plan.member].filter(Boolean)).map(member => <div key={member.id || member._id} style={{ fontSize: '.75rem', color: 'var(--text-secondary)', marginTop: 3 }}><strong style={{ color: 'var(--text-primary)' }}>{member.registrationNumber || member.displayId || 'Member ID pending'}</strong> · {member.name} · {member.phone || 'No phone'}</div>)}
                                                        <h3 style={{ marginTop: '0.25rem', marginBottom: '0.5rem', fontSize: '1.15rem' }}>{plan.name}</h3>
                                                        <small style={{ color: 'var(--text-secondary)' }}>Assigned {new Date(plan.createdAt).toLocaleDateString()}</small>
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
                                                    <button className="btn btn-primary workout-template-assign" onClick={() => handleAssignTemplate(temp)}>
                                                        <ArrowRight size={15} /> Assign
                                                    </button>
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

                    {activeTab === 'progress' && isTrainerOrAdmin && <div>
                        <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 16 }}>
                            <label style={workoutFilterLabel}>From<input className="input" type="date" value={progressFilters.from} onChange={e => setProgressFilters({ ...progressFilters, from: e.target.value })} /></label>
                            <label style={workoutFilterLabel}>To<input className="input" type="date" value={progressFilters.to} onChange={e => setProgressFilters({ ...progressFilters, to: e.target.value })} /></label>
                            <MemberFilterSelect label="Member" value={progressFilters.memberId} onChange={memberId => setProgressFilters({ ...progressFilters, memberId })} style={{ minWidth: 230 }} />
                            <label style={workoutFilterLabel}>Branch<select className="input" value={progressFilters.branchId} disabled={Boolean(user?.branchId)} onChange={e => setProgressFilters({ ...progressFilters, branchId: e.target.value })}><option value="">All branches</option>{branches.map(branch => <option key={branch._id || branch.id} value={branch._id || branch.id}>{branch.name}</option>)}</select></label>
                            {user?.role !== 'trainer' && <label style={workoutFilterLabel}>Trainer<select className="input" value={progressFilters.trainerId} onChange={e => setProgressFilters({ ...progressFilters, trainerId: e.target.value })}><option value="">All trainers</option>{trainers.map(person => <option key={person._id || person.id} value={person._id || person.id}>{person.name}</option>)}</select></label>}
                            <ResetFiltersButton onClick={() => setProgressFilters({ from: '', to: '', memberId: '', branchId: '', trainerId: '' })} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 16 }}>
                            <div className="card"><small style={{ color: 'var(--text-secondary)' }}>Training sessions</small><h2 style={{ margin: '4px 0' }}>{progressLogs.length}</h2></div>
                            <div className="card"><small style={{ color: 'var(--text-secondary)' }}>Exercises completed</small><h2 style={{ margin: '4px 0' }}>{progressLogs.reduce((sum, log) => sum + Number(log.completedExercises || 0), 0)}</h2></div>
                            <div className="card"><small style={{ color: 'var(--text-secondary)' }}>Average session completion</small><h2 style={{ margin: '4px 0' }}>{progressLogs.length ? `${Math.round(progressLogs.reduce((sum, log) => sum + (log.totalExercises ? log.completedExercises / log.totalExercises : 0), 0) / progressLogs.length * 100)}%` : '—'}</h2></div>
                        </div>
                        <div className="card" style={{ marginBottom: 16 }}><h3 style={{ marginTop: 0 }}>Training consistency by date</h3>{progressLoading ? <div className="spinner" /> : workoutTrendData.length ? <div style={{ height: 260 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={workoutTrendData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" /><YAxis /><Tooltip /><Bar dataKey="sessions" name="Sessions" fill="#818cf8" radius={[4, 4, 0, 0]} /><Bar dataKey="exercises" name="Exercises completed" fill="#34d399" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div> : <p style={{ color: 'var(--text-secondary)' }}>No workout logs match these filters.</p>}</div>
                        <div className="card" style={{ padding: 0, overflowX: 'auto' }}><table><thead><tr><th>Date</th><th>Member ID</th><th>Name</th><th>Phone</th><th>Workout</th><th>Day</th><th>Exercises</th><th>Recorded by</th><th>Branch</th></tr></thead><tbody>{progressLogs.map(log => <tr key={log.id}><td>{new Date(log.loggedAt).toLocaleDateString()}</td><td>{log.member?.displayId || log.memberId}</td><td>{log.member?.name || 'Member'}</td><td>{log.member?.phone || '—'}</td><td>{log.plan?.name || log.planName}</td><td>{log.trainingDay || '—'}</td><td>{log.completedExercises}/{log.totalExercises}</td><td>{log.recordedBy?.name || '—'}</td><td>{log.branch?.name || '—'}</td></tr>)}{!progressLoading && !progressLogs.length && <tr><td colSpan="9" style={{ textAlign: 'center', padding: 24 }}>No workout records for this date range.</td></tr>}</tbody></table></div>
                    </div>}

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
                                                disabled={savingWorkout || getExercisesForDay().filter((_, i) => completedExercises[i]).length === 0}
                                            >
                                                <Award size={18} /> {savingWorkout ? 'Saving session…' : 'Log today’s training session'}
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

                                <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                                    <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Exercises completed · last 90 days</h3>
                                    {workoutTrendData.length ? <div style={{ height: 200 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={workoutTrendData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" /><YAxis /><Tooltip /><Line type="monotone" dataKey="exercises" name="Exercises completed" stroke="#34d399" strokeWidth={3} /></LineChart></ResponsiveContainer></div> : <p style={{ color: 'var(--text-secondary)' }}>Log a workout to start your progress chart.</p>}
                                </div>

                                <div className="card" style={{ padding: '1.5rem' }}>
                                    <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1rem' }}>Workout Compliance History</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {progressLogs.map((log, index) => (
                                            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: index !== progressLogs.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: '0.75rem' }}>
                                                <div>
                                                    <div style={{ fontWeight: '700', fontSize: '0.85rem' }}>{log.planName} · {log.trainingDay || 'Training'}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{new Date(log.loggedAt).toLocaleDateString()}</div>
                                                </div>
                                                <div style={{ background: 'rgba(46, 125, 50, 0.1)', color: 'var(--success)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '700' }}>
                                                    {log.completedExercises} Exercises
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
                <div className="workout-modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPlanModal(false); }}>
                    <div className="card workout-modal-card">
                        <div className="workout-modal-heading">
                            <div>
                                <span className="workout-eyebrow">TRAINING PROGRAM</span>
                                <h3>{editingPlanId ? 'Edit assigned plan' : 'Assign a workout plan'}</h3>
                                <p>Choose a member, then shape their weekly routine.</p>
                            </div>
                            <button type="button" className="workout-close-button" aria-label="Close workout plan editor" onClick={() => setShowPlanModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handlePlanSubmit}>
                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Select members <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>· {selectedMemberIds.length} selected</span></label>
                                <input
                                    className="form-control"
                                    type="search"
                                    value={assignmentMemberSearch}
                                    onChange={event => setAssignmentMemberSearch(event.target.value)}
                                    placeholder="Search by member ID (MEM1001), name, phone, or email"
                                    aria-label="Search members by ID, name, phone, or email"
                                    style={{ width: '100%', marginBottom: '.5rem' }}
                                />
                                {selectedMemberIds.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem', marginBottom: '.5rem' }} aria-label="Selected members">
                                    {selectedMemberIds.map(id => {
                                        const member = members.find(item => String(item.id || item._id) === id);
                                        return <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: '.35rem', border: '1px solid var(--border)', background: 'var(--bg-secondary)', borderRadius: 999, padding: '.25rem .45rem .25rem .7rem', fontSize: '.78rem' }}>
                                            {member ? `${member.registrationNumber || member.displayId || 'Member'} · ${member.name}` : 'Selected member'}
                                            <button type="button" aria-label={`Remove ${member?.name || 'member'} from workout plan`} onClick={() => setSelectedMemberIds(current => current.filter(selectedId => selectedId !== id))} style={{ border: 0, background: 'transparent', cursor: 'pointer', lineHeight: 1, color: 'var(--text-secondary)' }}>×</button>
                                        </span>;
                                    })}
                                </div>}
                                <div role="group" aria-label="Choose members for this workout plan" style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface, #fff)' }}>
                                    {assignmentMemberOptions.map(member => {
                                        const id = String(member.id || member._id);
                                        const checked = selectedMemberIds.includes(id);
                                        return <label key={id} style={{ display: 'flex', alignItems: 'center', gap: '.65rem', padding: '.65rem .8rem', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={checked} onChange={() => setSelectedMemberIds(current => checked ? current.filter(selectedId => selectedId !== id) : [...current, id])} />
                                            <span style={{ minWidth: 0 }}><strong>{member.registrationNumber || member.displayId || 'Member ID pending'}</strong> · {member.name} <span style={{ color: 'var(--text-secondary)' }}>({member.phone || member.email || 'No contact details'})</span></span>
                                        </label>;
                                    })}
                                    {members.length > 0 && assignmentMemberOptions.length === 0 && <div style={{ padding: '.8rem', color: 'var(--text-secondary)' }}>No members match that ID, name, phone, or email.</div>}
                                </div>
                                {members.length === 0 && (
                                    <small style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                                        No members found for this gym. Add a member before assigning a workout plan.
                                    </small>
                                )}
                                <small style={{ display: 'block', marginTop: '.5rem', color: 'var(--text-secondary)' }}>This plan will be added to every selected member. You can add or remove members when editing.</small>
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
                            {user?.role !== 'trainer' && <div className="form-group" style={{ marginBottom: '1rem' }}><label style={{ display: 'block', marginBottom: '.5rem', fontWeight: 600 }}>Assigned trainer</label><select className="form-control" value={assignedTrainerId} onChange={e => setAssignedTrainerId(e.target.value)}><option value="">No specific trainer</option>{trainers.map(person => <option key={person._id || person.id} value={person._id || person.id}>{person.name}</option>)}</select></div>}

                            {/* Exercises schedule builder */}
                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h4 style={{ margin: 0 }}>Exercises Config</h4>
                                    <button type="button" className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => handleAddExercise(false)}>
                                        + Add Row
                                    </button>
                                </div>

                                {exercises.map((ex, index) => (
                                    <div key={index} className="workout-exercise-row">
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

                            <div className="workout-modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowPlanModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={!selectedMemberIds.length || !planName.trim()}>{editingPlanId ? 'Save changes' : 'Assign workout plan'}</button>
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
                                    <div key={index} className="workout-exercise-row">
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

function getLocalDayKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function shiftLocalDay(day, offset) { const date = new Date(`${day}T00:00:00`); date.setDate(date.getDate() + offset); return getLocalDayKey(date); }
const workoutFilterLabel = { display: 'grid', gap: 6, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 };

export default WorkoutPlans;

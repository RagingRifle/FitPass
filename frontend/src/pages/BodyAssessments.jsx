import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { getBodyAssessments,
    createBodyAssessment,
    updateBodyAssessment,
    deleteBodyAssessment,
    getMembers
} from '../services/apiService';
import Modal from '../components/Modal';
import MemberFilterSelect from '../components/MemberFilterSelect';
import ResetFiltersButton from '../components/ResetFiltersButton';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend
} from 'recharts';
import { Loader,  Pencil, Trash2, TrendingUp, ShieldAlert, Award, Activity, Scale, Percent } from 'lucide-react';

const BodyAssessments = () => {
    const { user, activeDivision, selectedGymId } = useContext(AuthContext);
    const isStaff = ['admin', 'trainer', 'superadmin', 'h4_admin', 'h4_branch_admin', 'fitpass_admin'].includes(user?.role);
    const isH4Assessment = ['h4_admin', 'h4_branch_admin'].includes(user?.role) || activeDivision === 'h4' || String(user?.gymName || '').toUpperCase().includes('H4') || ['05a08fdf-7427-48a5-8b25-e18d5a5668cd', '327d37e7-f978-43a9-82ef-e6c4a4dc3c5d'].includes(String(selectedGymId || user?.gymId || ''));
    const graphGymId = String(selectedGymId || user?.gymId?._id || user?.gymId?.id || user?.gymId || 'h4');
    const assessmentMetrics = [
        { key: 'Weight', label: 'Weight', unit: 'kg', color: '#0F766E' },
        { key: 'BMI', label: 'BMI', unit: '', color: '#2563EB' },
        { key: 'Body Fat %', label: 'Body fat', unit: '%', color: '#D97706' },
        { key: 'Muscle Mass', label: 'Muscle mass', unit: 'kg', color: '#7C3AED' },
        { key: 'BMR', label: 'BMR', unit: 'kcal', color: '#DC2626' },
        { key: 'Waist', label: 'Waist', unit: 'cm', color: '#0891B2' },
    ];

    const [members, setMembers] = useState([]);
    const [selectedMemberId, setSelectedMemberId] = useState('');
    const [assessments, setAssessments] = useState([]);
    const [assessmentFilters, setAssessmentFilters] = useState({ from: '', to: '' });
    const [loading, setLoading] = useState(true);
    const [customGraphs, setCustomGraphs] = useState([]);
    const [graphDraft, setGraphDraft] = useState({ title: '', metrics: ['Weight', 'BMI'], type: 'line' });
    
    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAssessment, setEditingAssessment] = useState(null);
    const [formData, setFormData] = useState({
        weight: '',
        heightCm: '',
        bmi: '',
        bodyFat: '',
        muscleMass: '',
        bmr: '',
        waistCm: '',
        inBodyScore: '',
        assessmentDate: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        if (isStaff) {
            fetchMembers();
        } else if (user?.memberId) {
            setSelectedMemberId(user.memberId);
        }
    }, [user, isStaff]);

    useEffect(() => {
        if (!isH4Assessment) return;
        try {
            const saved = JSON.parse(localStorage.getItem(`h4-assessment-graphs:${graphGymId}`) || '[]');
            setCustomGraphs(Array.isArray(saved) ? saved : []);
        } catch { setCustomGraphs([]); }
    }, [isH4Assessment, graphGymId]);

    useEffect(() => {
        if (selectedMemberId) {
            fetchAssessments(selectedMemberId, assessmentFilters);
        } else {
            setAssessments([]);
            setLoading(false);
        }
    }, [selectedMemberId, assessmentFilters]);

    const fetchMembers = async () => {
        try {
            // Fetch first page/all members
            const res = await getMembers('', 1, '', 100);
            const memberList = Array.isArray(res) ? res : (res?.members || res?.data || []);
            setMembers(memberList);
        } catch (error) {
            console.error('Error fetching members:', error);
            setMembers([]);
        }
    };

    const fetchAssessments = async (memberId, filters = {}) => {
        setLoading(true);
        try {
            const data = await getBodyAssessments(memberId, filters);
            const list = Array.isArray(data) ? data : (data?.data || []);
            // Sort assessments chronologically for charts (date ascending)
            const sorted = [...list].sort((a, b) => new Date(a.assessmentDate) - new Date(b.assessmentDate));
            setAssessments(sorted);
        } catch (error) {
            console.error('Error fetching assessments:', error);
            setAssessments([]);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (assessment = null) => {
        if (assessment) {
            setEditingAssessment(assessment);
            setFormData({
                weight: assessment.weight,
                heightCm: assessment.heightCm || selectedMember?.heightCm || '',
                bmi: assessment.bmi,
                bodyFat: assessment.bodyFat,
                muscleMass: assessment.muscleMass,
                bmr: assessment.bmr,
                waistCm: assessment.waistCm || '',
                inBodyScore: assessment.inBodyScore || '',
                assessmentDate: assessment.assessmentDate.split('T')[0]
            });
        } else {
            setEditingAssessment(null);
            setFormData({
                weight: '',
                heightCm: selectedMember?.heightCm || '',
                bmi: '',
                bodyFat: '',
                muscleMass: '',
                bmr: '',
                waistCm: '',
                inBodyScore: '',
                assessmentDate: new Date().toISOString().split('T')[0]
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedMemberId) {
            alert('Please select a member first');
            return;
        }

        try {
            const submissionData = isH4Assessment ? {
                memberId: selectedMemberId,
                weight: Number(formData.weight),
                ...(!selectedMember?.heightCm ? { heightCm: Number(formData.heightCm) } : {}),
                bodyFat: formData.bodyFat === '' ? null : Number(formData.bodyFat),
                muscleMass: formData.muscleMass === '' ? null : Number(formData.muscleMass),
                bmr: formData.bmr === '' ? null : Number(formData.bmr),
                waistCm: formData.waistCm === '' ? null : Number(formData.waistCm),
                assessmentDate: formData.assessmentDate
            } : {
                memberId: selectedMemberId,
                ...formData,
                inBodyScore: formData.inBodyScore ? Number(formData.inBodyScore) : null
            };

            if (editingAssessment) {
                await updateBodyAssessment(editingAssessment._id, submissionData);
            } else {
                await createBodyAssessment(submissionData);
            }
            if (isH4Assessment && !selectedMember?.heightCm) await fetchMembers();
            await fetchAssessments(selectedMemberId, assessmentFilters);
            setIsModalOpen(false);
        } catch (error) {
            alert(error.response?.data?.message || 'Error saving assessment');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this assessment record?')) {
            try {
                await deleteBodyAssessment(id);
                fetchAssessments(selectedMemberId, assessmentFilters);
            } catch {
                alert('Error deleting assessment');
            }
        }
    };

    const saveCustomGraphs = (nextGraphs) => {
        setCustomGraphs(nextGraphs);
        localStorage.setItem(`h4-assessment-graphs:${graphGymId}`, JSON.stringify(nextGraphs));
    };
    const createCustomGraph = (event) => {
        event.preventDefault();
        if (!graphDraft.title.trim() || !graphDraft.metrics.length) return;
        saveCustomGraphs([...customGraphs, { ...graphDraft, id: `${Date.now()}` }]);
        setGraphDraft({ title: '', metrics: ['Weight', 'BMI'], type: 'line' });
    };

    const safeAssessments = Array.isArray(assessments) ? assessments : [];
    const safeMembers = Array.isArray(members) ? members : [];
    const selectedMember = safeMembers.find(member => String(member._id || member.id) === String(selectedMemberId));
    const displayedAssessments = safeAssessments;

    // Calculate charts data
    const chartData = displayedAssessments.map(a => ({
        date: new Date(a.assessmentDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        Weight: a.weight,
        BMI: a.bmi,
        'Body Fat %': a.bodyFat,
        'Muscle Mass': a.muscleMass,
        BMR: a.bmr,
        Waist: a.waistCm,
        Score: a.inBodyScore || 0
    }));

    // Get latest assessment for quick metrics
    const latest = displayedAssessments[displayedAssessments.length - 1];
    const bmiHeightCm = Number(formData.heightCm || selectedMember?.heightCm || 0);
    const calculatedBmi = Number(formData.weight) > 0 && bmiHeightCm > 0
        ? (Number(formData.weight) / ((bmiHeightCm / 100) ** 2)).toFixed(1)
        : '';

    // Helper to evaluate BMI status
    const getBmiStatus = (bmi) => {
        if (bmi < 18.5) return { label: 'Underweight', color: '#38bdf8' };
        if (bmi < 25) return { label: 'Normal', color: '#10b981' };
        if (bmi < 30) return { label: 'Overweight', color: '#f59e0b' };
        return { label: 'Obese', color: '#ef4444' };
    };

    // Helper to evaluate Body Fat status
    const getFatStatus = (fat) => {
        if (fat < 10) return { label: 'Low', color: '#38bdf8' };
        if (fat < 20) return { label: 'Optimal', color: '#10b981' };
        if (fat < 25) return { label: 'Slightly Over', color: '#f59e0b' };
        return { label: 'High', color: '#ef4444' };
    };

    const latestMetrics = latest ? [
        { label: 'WEIGHT', value: `${latest.weight} kg`, icon: Scale, color: '#10b981' },
        latest.bmi != null && { label: 'BMI · calculated', value: latest.bmi, icon: Activity, color: '#0ea5e9' },
        latest.bodyFat != null && { label: 'BODY FAT', value: `${latest.bodyFat}%`, icon: Percent, color: '#f59e0b' },
        latest.muscleMass != null && { label: 'SKELETAL MUSCLE', value: `${latest.muscleMass} kg`, icon: TrendingUp, color: '#8b5cf6' },
        latest.waistCm != null && { label: 'WAIST', value: `${latest.waistCm} cm`, icon: Activity, color: '#0ea5e9' },
        latest.bmr != null && { label: 'DEVICE BMR', value: `${latest.bmr} kcal`, icon: Award, color: '#ef4444' },
        !isH4Assessment && latest.inBodyScore != null && { label: 'INBODY DEVICE SCORE', value: latest.inBodyScore, icon: Award, color: '#ef4444' },
    ].filter(Boolean) : [];

    return (
        <div className="fade-in">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ fontWeight: '800', marginBottom: '0.25rem' }}> Fitness & InBody Assessment</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Track body composition history and fitness trends</p>
                </div>
                {isStaff && selectedMemberId && (
                    <button className="btn btn-primary" onClick={() => handleOpenModal()}>
                        + Record Assessment
                    </button>
                )}
            </div>

            {/* Member Selection for Staff */}
            {isStaff && (
                <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
                    <MemberFilterSelect label="Select member to view or record InBody history" value={selectedMemberId} onChange={setSelectedMemberId} includeAll={false} style={{ maxWidth: 520 }} />
                    {selectedMember && <div style={{ color: 'var(--text-secondary)', fontSize: '.8rem', marginTop: 8 }}>Member ID: {selectedMember.registrationNumber || selectedMember._id || selectedMember.id} · {selectedMember.name} · {selectedMember.phone || 'No phone'}</div>}
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12, maxWidth: 520 }}>
                        <label style={assessmentFilterLabel}>From<input className="input" type="date" value={assessmentFilters.from} onChange={e => setAssessmentFilters({ ...assessmentFilters, from: e.target.value })} /></label>
                        <label style={assessmentFilterLabel}>To<input className="input" type="date" value={assessmentFilters.to} onChange={e => setAssessmentFilters({ ...assessmentFilters, to: e.target.value })} /></label>
                        <ResetFiltersButton onClick={() => { setAssessmentFilters({ from: '', to: '' }); setSelectedMemberId(''); }} />
                    </div>
                </div>
            )}

            {isH4Assessment && isStaff && selectedMemberId && (
                <section className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #0F766E' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div><span style={{ color: '#0F766E', fontWeight: 800, fontSize: '.72rem', letterSpacing: '.12em' }}>ASSESSMENT STUDIO</span><h3 style={{ margin: '.25rem 0' }}>Build a custom progress graph</h3><p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '.85rem' }}>Choose the readings to compare for this member.</p></div>
                    </div>
                    <form onSubmit={createCustomGraph} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.2fr) minmax(140px, .7fr) auto', alignItems: 'end', gap: '1rem', marginTop: '1rem' }}>
                        <div className="input-group"><label>Graph title</label><input className="input" value={graphDraft.title} onChange={e => setGraphDraft({ ...graphDraft, title: e.target.value })} placeholder="e.g. Strength and waist trend" maxLength={80} required /></div>
                        <div className="input-group"><label>Graph style</label><select className="input" value={graphDraft.type} onChange={e => setGraphDraft({ ...graphDraft, type: e.target.value })}><option value="line">Line</option><option value="area">Filled area</option></select></div>
                        <button className="btn btn-primary" type="submit" disabled={!graphDraft.title.trim() || graphDraft.metrics.length === 0}>Create graph</button>
                        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '.55rem 1rem', flexWrap: 'wrap' }}>
                            {assessmentMetrics.map(metric => <label key={metric.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', fontSize: '.82rem' }}><input type="checkbox" checked={graphDraft.metrics.includes(metric.key)} onChange={event => setGraphDraft({ ...graphDraft, metrics: event.target.checked ? [...graphDraft.metrics, metric.key] : graphDraft.metrics.filter(key => key !== metric.key) })} />{metric.label}{metric.unit ? ` (${metric.unit})` : ''}</label>)}
                        </div>
                    </form>
                    {customGraphs.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                        {customGraphs.map(graph => {
                            const Chart = graph.type === 'area' ? AreaChart : LineChart;
                            const Series = graph.type === 'area' ? Area : Line;
                            return <article className="card" key={graph.id} style={{ padding: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}><div><h3 style={{ margin: 0, fontSize: '1rem' }}>{graph.title}</h3><small style={{ color: 'var(--text-secondary)' }}>{graph.metrics.map(key => assessmentMetrics.find(metric => metric.key === key)?.label || key).join(' · ')}</small></div><button type="button" className="btn" aria-label={`Delete ${graph.title}`} onClick={() => saveCustomGraphs(customGraphs.filter(item => item.id !== graph.id))}><Trash2 size={16} /></button></div>
                                <div style={{ height: 240, marginTop: 10 }}><ResponsiveContainer width="100%" height="100%"><Chart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" /><YAxis /><Tooltip /><Legend />{graph.metrics.map(key => { const metric = assessmentMetrics.find(item => item.key === key); return <Series key={key} type="monotone" dataKey={key} name={metric?.label || key} stroke={metric?.color || '#0F766E'} fill={metric?.color || '#0F766E'} strokeWidth={2.5} connectNulls />; })}</Chart></ResponsiveContainer></div>
                            </article>;
                        })}
                    </div>}
                </section>
            )}

            {!isStaff && <div className="card" style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>Member ID: {user?.registrationNumber || user?.memberId || '—'} · {user?.name || 'Member'} · {user?.phone || 'No phone'}</div>}

            {!selectedMemberId ? (
                <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    <ShieldAlert size={48} style={{ margin: '0 auto 1rem', color: 'var(--primary-color)' }} />
                    <h3>No Member Selected</h3>
                    <p>Please select a gym member from the dropdown above to view their fitness logs.</p>
                </div>
            ) : loading ? (
                <div className="spinner"></div>
            ) : (
                <div>
                    {/* Latest InBody Overview Card */}
                    {latest && latestMetrics.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                        {latestMetrics.map(({ label, value, icon: MetricIcon, color }) => <div className="card" key={label} style={{ display: 'flex', gap: '.85rem', alignItems: 'center' }}><div style={{ background: `${color}18`, color, padding: '.7rem', borderRadius: '12px' }}><MetricIcon size={22} /></div><div><div style={{ fontSize: '.72rem', color: 'var(--text-secondary)', fontWeight: 700 }}>{label}</div><div style={{ fontSize: '1.35rem', fontWeight: 800 }}>{value}</div></div></div>)}
                    </div>}

                    {displayedAssessments.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                            <Activity size={48} style={{ margin: '0 auto 1rem', color: 'var(--primary-color)', opacity: 0.5 }} />
                            <h3>No assessments logged yet</h3>
                            <p>A trainer or admin can record this member’s readings after an InBody assessment.</p>
                            {isStaff && <button className="btn btn-primary" style={{ marginTop: '0.75rem' }} onClick={() => handleOpenModal()}>Record first assessment</button>}
                        </div>
                    ) : (
                        <div>
                            {/* Charts Visualization Row */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                                {/* Weight & Muscle Mass Trend */}
                                <div className="card">
                                    <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '700' }}> Weight & Muscle Mass Trend (kg)</h3>
                                    <div style={{ width: '100%', height: 260 }}>
                                        <ResponsiveContainer width="100%" height={260}>
                                            <LineChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.07)" />
                                                <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} domain={['dataMin - 5', 'dataMax + 5']} />
                                                <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px' }} />
                                                <Legend />
                                                <Line type="monotone" dataKey="Weight" stroke="var(--primary-color)" strokeWidth={3} activeDot={{ r: 8 }} />
                                                <Line type="monotone" dataKey="Muscle Mass" stroke="#8b5cf6" strokeWidth={3} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Body Fat & BMI Trend */}
                                <div className="card">
                                    <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '700' }}> Body Fat % & BMI Trend</h3>
                                    <div style={{ width: '100%', height: 260 }}>
                                        <ResponsiveContainer width="100%" height={260}>
                                            <LineChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.07)" />
                                                <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                                <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} domain={['dataMin - 2', 'dataMax + 2']} />
                                                <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px' }} />
                                                <Legend />
                                                <Line type="monotone" dataKey="Body Fat %" stroke="#f59e0b" strokeWidth={3} />
                                                <Line type="monotone" dataKey="BMI" stroke="#0ea5e9" strokeWidth={3} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* History Table */}
                            <div className="card">
                                <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem', fontWeight: '700' }}> Historical Assessment Records</h3>
                                <div className="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Weight (kg)</th>
                                                <th>BMI</th>
                                                <th>Body Fat %</th>
                                                <th>Muscle Mass (kg)</th>
                                                <th>BMR (kcal)</th>
                                                {!isH4Assessment && <th>InBody device score</th>}
                                                {isStaff && <th>Actions</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[...displayedAssessments].reverse().map(item => (
                                                <tr key={item._id}>
                                                    <td style={{ fontWeight: '600' }}>
                                                        {new Date(item.assessmentDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                                    </td>
                                                    <td>{item.weight} kg</td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                            {item.bmi ?? '—'}
                                                            {item.bmi != null && <span style={{
                                                                width: '8px', height: '8px', borderRadius: '50%',
                                                                background: getBmiStatus(item.bmi).color
                                                            }} title={getBmiStatus(item.bmi).label} />}
                                                        </div>
                                                    </td>
                                                    <td>{item.bodyFat == null ? '—' : `${item.bodyFat}%`}</td>
                                                    <td>{item.muscleMass == null ? '—' : `${item.muscleMass} kg`}</td>
                                                    <td>{item.bmr == null ? '—' : `${item.bmr} kcal`}</td>
                                                    {!isH4Assessment && <td>{item.inBodyScore ?? '—'}</td>}
                                                    {isStaff && (
                                                        <td>
                                                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                                <button
                                                                    className="btn"
                                                                    style={{ padding: '0.4rem', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                                                                    onClick={() => handleOpenModal(item)}
                                                                >
                                                                    <Pencil size={14} />
                                                                </button>
                                                                <button
                                                                    className="btn btn-danger"
                                                                    style={{ padding: '0.4rem' }}
                                                                    onClick={() => handleDelete(item._id)}
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Assessment Input Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingAssessment ? 'Edit Body Assessment Record' : isH4Assessment ? 'Record H4 Body Assessment' : 'Record InBody Assessment'}>
                <form onSubmit={handleSubmit}>
                    {isH4Assessment ? <>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '.82rem', marginTop: 0 }}>Record the member’s weight and optional readings from the InBody device. BMI is calculated from their saved height.</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        {!selectedMember?.heightCm && <div className="input-group"><label>Height baseline (cm) *</label><input className="input" type="number" min="80" max="250" step="0.1" value={formData.heightCm} onChange={e => setFormData({ ...formData, heightCm: e.target.value })} required /><small>Save once; it stays on the member profile for future BMI calculations.</small></div>}
                        <div className="input-group"><label>Weight (kg) *</label><input className="input" type="number" min="1" max="500" step="0.1" value={formData.weight} onChange={e => setFormData({ ...formData, weight: e.target.value })} required /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="input-group"><label>Calculated BMI</label><input className="input" value={calculatedBmi || 'Enter height and weight'} readOnly aria-readonly="true" /><small>Weight ÷ height². Calculated automatically.</small></div>
                        <div className="input-group"><label>Waist (cm) · optional</label><input className="input" type="number" min="30" max="250" step="0.1" value={formData.waistCm} onChange={e => setFormData({ ...formData, waistCm: e.target.value })} /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="input-group"><label>Body fat (PBF %) · device reading</label><input className="input" type="number" min="0" max="75" step="0.1" value={formData.bodyFat} onChange={e => setFormData({ ...formData, bodyFat: e.target.value })} /></div>
                        <div className="input-group"><label>Skeletal muscle mass (kg) · device reading</label><input className="input" type="number" min="0" step="0.1" value={formData.muscleMass} onChange={e => setFormData({ ...formData, muscleMass: e.target.value })} /></div>
                    </div>
                    <div className="input-group"><label>BMR (kcal) · optional device reading</label><input className="input" type="number" min="200" max="6000" step="1" value={formData.bmr} onChange={e => setFormData({ ...formData, bmr: e.target.value })} /><small>Leave blank unless the InBody device provides this value.</small></div>
                    <div className="input-group"><label>Assessment date *</label><input className="input" type="date" value={formData.assessmentDate} onChange={e => setFormData({ ...formData, assessmentDate: e.target.value })} required /></div>
                    </> : <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="input-group">
                            <label>Weight (kg) *</label>
                            <input
                                className="input"
                                type="number"
                                step="0.1"
                                value={formData.weight}
                                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label>BMI *</label>
                            <input
                                className="input"
                                type="number"
                                step="0.1"
                                value={formData.bmi}
                                onChange={(e) => setFormData({ ...formData, bmi: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="input-group">
                            <label>Percent Body Fat (PBF %) *</label>
                            <input
                                className="input"
                                type="number"
                                step="0.1"
                                value={formData.bodyFat}
                                onChange={(e) => setFormData({ ...formData, bodyFat: e.target.value })}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label>Muscle Mass (SMM kg) *</label>
                            <input
                                className="input"
                                type="number"
                                step="0.1"
                                value={formData.muscleMass}
                                onChange={(e) => setFormData({ ...formData, muscleMass: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="input-group">
                            <label>BMR (kcal) *</label>
                            <input
                                className="input"
                                type="number"
                                value={formData.bmr}
                                onChange={(e) => setFormData({ ...formData, bmr: e.target.value })}
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label>InBody Score (out of 100)</label>
                            <input
                                className="input"
                                type="number"
                                value={formData.inBodyScore}
                                onChange={(e) => setFormData({ ...formData, inBodyScore: e.target.value })}
                                placeholder="e.g. 75"
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label>Assessment Date *</label>
                        <input
                            className="input"
                            type="date"
                            value={formData.assessmentDate}
                            onChange={(e) => setFormData({ ...formData, assessmentDate: e.target.value })}
                            required
                        />
                    </div>
                    </>}

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.25rem' }}>
                        {editingAssessment ? 'Update Record' : 'Record Assessment'}
                    </button>
                </form>
            </Modal>
        </div>
    );
};

const assessmentFilterLabel = { display: 'grid', gap: 6, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, flex: '1 1 180px' };

export default BodyAssessments;

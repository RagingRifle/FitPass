import { useState, useEffect, useContext } from 'react';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';
import Modal from '../components/Modal';
import { Pencil, Trash2, QrCode, Loader, Eye, MapPin, Phone, Mail, Clock, Globe, User } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

const BRANCH_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const defaultWeeklySchedule = () => Object.fromEntries(BRANCH_DAYS.map(day => [day, { open: '06:00 AM', close: '10:00 PM', closed: day === 'Sunday' }]));
const toTimeInput = (value) => {
    if (!value) return '06:00';
    if (/^\d{2}:\d{2}$/.test(value)) return value;
    const match = String(value).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return '06:00';
    let hours = Number(match[1]) % 12;
    if (match[3].toUpperCase() === 'PM') hours += 12;
    return `${String(hours).padStart(2, '0')}:${match[2]}`;
};
const emptyForm = { name: '', shortDescription: '', description: '', address: '', phone: '', email: '', website: '', managerName: '', openingTime: '06:00 AM', closingTime: '10:00 PM', workingDays: BRANCH_DAYS.slice(0, 6), weeklySchedule: defaultWeeklySchedule(), scheduleExceptions: [], amenitiesText: '', equipmentsText: '', fitPassEnabled: true };

const Branches = () => {
    const { activeDivision, changeActiveDivision, selectedGymId, changeSelectedGym, user, selectedBranchId } = useContext(AuthContext);
    const isH4Division = activeDivision === 'h4' || user?.role === 'h4_admin';
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editBranch, setEditBranch] = useState(null);
    const [formData, setFormData] = useState(emptyForm);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [membersModal, setMembersModal] = useState(null);
    const [branchMembers, setBranchMembers] = useState([]);
    const [qrBranch, setQrBranch] = useState(null);
    const [detailsBranch, setDetailsBranch] = useState(null);

    const fetchBranches = async () => {
        try {
            console.log("Fetching branches for selectedGymId:", selectedGymId, "selectedBranchId:", selectedBranchId);
            const { data } = await API.get('/branches');
            console.log("Branches API returned:", data);
            setBranches(data);
        } catch (err) { 
            console.error("Error fetching branches:", err); 
        }
        finally { setLoading(false); }
    };

    useEffect(() => {
        const checkGymContext = async () => {
            if (user?.role === 'superadmin') {
                // We allow superadmins to view branches for the currently selected partner gym (e.g. H5)
                // Do not force revert to H4 here.
            }
            fetchBranches();
        };

        checkGymContext();
    }, [user, activeDivision, selectedGymId]);

    const openCreate = () => { setEditBranch(null); setFormData(emptyForm); setError(''); setIsModalOpen(true); };
    const openEdit = (b) => {
        setEditBranch(b);
        setFormData({
            name: b.name,
            shortDescription: b.shortDescription || '',
            description: b.description || '',
            address: b.address || '',
            phone: b.phone || '',
            email: b.email || '',
            website: b.website || '',
            managerName: b.managerName || '',
            openingTime: b.openingTime || '06:00 AM',
            closingTime: b.closingTime || '10:00 PM',
            workingDays: b.workingDays || BRANCH_DAYS.slice(0, 6),
            weeklySchedule: { ...defaultWeeklySchedule(), ...(b.weeklySchedule || {}) },
            scheduleExceptions: Array.isArray(b.scheduleExceptions) ? b.scheduleExceptions : [],
            amenitiesText: (b.amenities || []).join(', '),
            equipmentsText: (b.equipments || []).join(', '),
            fitPassEnabled: b.fitPassEnabled !== undefined ? b.fitPassEnabled : true
        });
        setError('');
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            const workingDays = BRANCH_DAYS.filter(day => !formData.weeklySchedule?.[day]?.closed);
            const firstOpenDay = workingDays[0];
            const payload = {
                ...formData,
                // H4 branches are managed separately from FitPass partner check-ins.
                fitPassEnabled: isH4Division ? false : Boolean(formData.fitPassEnabled),
                openingTime: firstOpenDay ? formData.weeklySchedule[firstOpenDay]?.open : formData.openingTime,
                closingTime: firstOpenDay ? formData.weeklySchedule[firstOpenDay]?.close : formData.closingTime,
                workingDays,
                amenities: formData.amenitiesText.split(',').map(value => value.trim()).filter(Boolean),
                equipments: formData.equipmentsText.split(',').map(value => value.trim()).filter(Boolean),
            };
            if (editBranch) {
                await API.put(`/branches/${editBranch._id || editBranch.id}`, payload);
            } else {
                await API.post('/branches', payload);
            }
            setIsModalOpen(false);
            fetchBranches();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save branch');
        } finally { setSubmitting(false); }
    };

    const handleDelete = async (branch) => {
        if (!window.confirm(`Delete branch "${branch.name}"? Members assigned to this branch will be unassigned.`)) return;
        try {
            await API.delete(`/branches/${branch._id}`);
            fetchBranches();
        } catch (err) { alert(err.response?.data?.message || 'Failed to delete'); }
    };

    const viewMembers = async (branch) => {
        setMembersModal(branch);
        try {
            const { data } = await API.get(`/branches/${branch._id}/members`);
            setBranchMembers(data);
        } catch { setBranchMembers([]); }
    };

    const updateDaySchedule = (day, patch) => setFormData(current => ({
        ...current,
        weeklySchedule: {
            ...current.weeklySchedule,
            [day]: { ...(current.weeklySchedule?.[day] || {}), ...patch },
        },
    }));
    const updateException = (index, patch) => setFormData(current => ({
        ...current,
        scheduleExceptions: current.scheduleExceptions.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
            <Loader className="spinner" size={40} style={{ color: 'var(--primary-color)' }} />
        </div>
    );

    const isH4BranchAdmin = user?.role === 'h4_admin' && Boolean(user?.branchId);
    const canCreateBranches = (!selectedBranchId || user?.role === 'superadmin' || user?.role === 'h4_admin') && !isH4BranchAdmin;
    const canEditBranches = !selectedBranchId || user?.role === 'superadmin' || user?.role === 'h4_admin';
    const totalMembers = branches.reduce((s, b) => s + (b.memberCount || 0), 0);
    const totalRevenue = branches.reduce((s, b) => s + (b.totalRevenue || 0), 0);

    return (
        <div className="plans-page fade-in">
            <div className="plans-page-header">
                <div>
                    <span className="plans-page-kicker">{isH4Division ? 'H4 branch operations' : 'Gym locations'}</span>
                    <h2>Branch Management</h2>
                    <p>{branches.length} branch(es) · {totalMembers} members · ₹{totalRevenue.toLocaleString()} total revenue</p>
                </div>
                {canCreateBranches && <button className="btn btn-primary" onClick={openCreate}>+ Add Branch</button>}
            </div>

            {branches.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-state-icon"></div>
                        <h3>No branches yet</h3>
                        <p>Create your first branch to start organising members by location.</p>
                        {canCreateBranches && <button className="btn btn-primary" onClick={openCreate} style={{ marginTop: '1rem' }}>+ Add First Branch</button>}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
                    {branches.map(branch => (
                        <div key={branch._id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderRadius: '16px', padding: '1.35rem 1.4rem', border: '1px solid var(--border)', background: '#FFFFFF', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.9rem' }}>
                                    <div style={{ minWidth: 0 }}>
                                        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.12rem', fontWeight: 800, color: 'var(--text-primary)' }}>{branch.name}</h3>
                                        {branch.managerName && (
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <User size={13} /> {branch.managerName}
                                            </p>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-end', flexShrink: 0 }}>
                                        <span style={{ background: 'rgba(30, 142, 62, 0.08)', color: '#1E8E3E', border: '1px solid rgba(30, 142, 62, 0.2)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '700' }}>
                                            Active
                                        </span>
                                        {!isH4Division && <span style={{
                                            background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: '600'
                                        }}>
                                            {branch.fitPassEnabled ? 'FitPass' : 'No FitPass'}
                                        </span>}
                                    </div>
                                </div>

                                {branch.shortDescription && (
                                    <p style={{ margin: '0 0 0.85rem', fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                                        {branch.shortDescription}
                                    </p>
                                )}

                                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.38rem' }}>
                                    {branch.address && <span style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}><MapPin size={14} style={{ marginTop: 2, flexShrink: 0, color: '#92700A' }} /> <span>{branch.address}</span></span>}
                                    {branch.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Phone size={14} style={{ flexShrink: 0, color: '#92700A' }} /> <span>{branch.phone}</span></span>}
                                    {branch.email && <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={14} style={{ flexShrink: 0, color: '#92700A' }} /> <span>{branch.email}</span></span>}
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} style={{ flexShrink: 0, color: '#92700A' }} /> <span>{branch.openingTime || '06:00 AM'} – {branch.closingTime || '10:00 PM'}</span></span>
                                </div>
                            </div>

                            <div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.7rem', textAlign: 'center' }}>
                                        <div style={{ fontWeight: '800', fontSize: '1.2rem', color: 'var(--text-primary)' }}>{branch.memberCount || 0}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Members</div>
                                    </div>
                                    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.7rem', textAlign: 'center' }}>
                                        <div style={{ fontWeight: '800', fontSize: '1.1rem', color: 'var(--text-primary)' }}>₹{(branch.totalRevenue || 0).toLocaleString()}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Revenue</div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <button onClick={() => viewMembers(branch)} className="btn btn-secondary" style={{ flex: 1, fontSize: '0.8rem', padding: '0.5rem', color: 'var(--text-primary)' }}>
                                        Members
                                    </button>
                                    <button onClick={() => setDetailsBranch(branch)} className="btn btn-secondary" style={{ padding: '0.5rem 0.7rem', borderRadius: '8px' }} title="View all branch details" aria-label={`View details for ${branch.name}`}>
                                        <Eye size={16} />
                                    </button>
                                    {!isH4Division && branch.fitPassEnabled && (
                                        <button onClick={() => setQrBranch(branch)} className="btn btn-secondary" style={{ padding: '0.5rem 0.7rem', borderRadius: '8px' }} title="Print Branch QR Code">
                                            <QrCode size={16} />
                                        </button>
                                    )}
                                    {canEditBranches && (
                                        <>
                                            <button onClick={() => openEdit(branch)} className="btn btn-secondary" style={{ padding: '0.5rem 0.7rem', borderRadius: '8px' }} title="Edit branch">
                                                <Pencil size={16} />
                                            </button>
                                            {!isH4BranchAdmin && <button onClick={() => handleDelete(branch)} className="btn btn-danger" style={{ padding: '0.5rem 0.7rem', borderRadius: '8px' }} title="Delete branch"><Trash2 size={16} /></button>}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Branch Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editBranch ? 'Edit Branch' : 'Add New Branch'}>
                <form onSubmit={handleSubmit}>
                    {error && <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
                    <div className="input-group">
                        <label>Branch Name *</label>
                        <input className="input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder="e.g. Downtown Branch" />
                    </div>
                    <div className="input-group">
                        <label>Short description</label>
                        <input className="input" value={formData.shortDescription} onChange={e => setFormData({ ...formData, shortDescription: e.target.value })} maxLength={300} placeholder="A quick introduction to this branch" />
                    </div>
                    <div className="input-group">
                        <label>Branch details</label>
                        <textarea className="input" rows={3} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} maxLength={5000} placeholder="Services, access instructions, and other member information" />
                    </div>
                    <div className="input-group">
                        <label>Address</label>
                        <input className="input" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Full address" />
                    </div>
                    <div className="input-group">
                        <label>Website (optional)</label>
                        <input className="input" type="url" value={formData.website} onChange={e => setFormData({ ...formData, website: e.target.value })} placeholder="https://example.com" />
                    </div>
                    <div className="form-grid">
                        <div className="input-group">
                            <label>Phone</label>
                            <input className="input" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="Contact number" />
                        </div>
                        <div className="input-group">
                            <label>Email</label>
                            <input className="input" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="branch@email.com" />
                        </div>
                    </div>
                    <div className="input-group">
                        <label>Branch Manager</label>
                        <input className="input" value={formData.managerName} onChange={e => setFormData({ ...formData, managerName: e.target.value })} placeholder="Manager's name" />
                    </div>
                    <section style={{ marginTop: '1.25rem', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 12 }}>
                        <h3 style={{ margin: '0 0 .35rem' }}>Opening hours</h3>
                        <p style={{ margin: '0 0 1rem', color: 'var(--text-secondary)', fontSize: '.82rem' }}>Set regular hours for each day. Mark closed days, then add holiday or special-hour exceptions below.</p>
                        <div style={{ display: 'grid', gap: '.65rem' }}>
                            {BRANCH_DAYS.map(day => {
                                const schedule = formData.weeklySchedule?.[day] || { open: '06:00 AM', close: '10:00 PM', closed: false };
                                return <div key={day} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, .7fr) 1fr 1fr auto', alignItems: 'center', gap: '.6rem' }}>
                                    <strong style={{ fontSize: '.85rem' }}>{day}</strong>
                                    <input className="input" aria-label={`${day} opening time`} type="time" value={toTimeInput(schedule.open)} disabled={schedule.closed} onChange={e => updateDaySchedule(day, { open: e.target.value })} />
                                    <input className="input" aria-label={`${day} closing time`} type="time" value={toTimeInput(schedule.close)} disabled={schedule.closed} onChange={e => updateDaySchedule(day, { close: e.target.value })} />
                                    <label style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: '.8rem' }}><input type="checkbox" checked={Boolean(schedule.closed)} onChange={e => updateDaySchedule(day, { closed: e.target.checked })} /> Closed</label>
                                </div>;
                            })}
                        </div>
                    </section>
                    <section style={{ marginTop: '1rem', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><div><h3 style={{ margin: 0 }}>Holidays and special hours</h3><small style={{ color: 'var(--text-secondary)' }}>Date-specific closures or adjusted opening hours.</small></div><button type="button" className="btn btn-secondary" onClick={() => setFormData({ ...formData, scheduleExceptions: [...formData.scheduleExceptions, { date: '', closed: true, reason: '' }] })}>+ Add date</button></div>
                        {formData.scheduleExceptions.map((exception, index) => <div key={`${index}-${exception.date}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto auto', alignItems: 'center', gap: '.5rem', marginTop: '.75rem' }}>
                            <input className="input" type="date" value={exception.date || ''} onChange={e => updateException(index, { date: e.target.value })} required />
                            <input className="input" type="time" aria-label="Special opening time" value={toTimeInput(exception.open)} disabled={exception.closed} onChange={e => updateException(index, { open: e.target.value })} />
                            <input className="input" type="time" aria-label="Special closing time" value={toTimeInput(exception.close)} disabled={exception.closed} onChange={e => updateException(index, { close: e.target.value })} />
                            <input className="input" placeholder="Reason (optional)" value={exception.reason || ''} onChange={e => updateException(index, { reason: e.target.value })} />
                            <label style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: '.8rem' }}><input type="checkbox" checked={Boolean(exception.closed)} onChange={e => updateException(index, { closed: e.target.checked })} /> Closed</label>
                            <button type="button" className="btn btn-danger" onClick={() => setFormData({ ...formData, scheduleExceptions: formData.scheduleExceptions.filter((_, itemIndex) => itemIndex !== index) })}>Remove</button>
                        </div>)}
                    </section>
                    <div className="form-grid" style={{ marginTop: '1rem' }}>
                        <div className="input-group"><label>Amenities (comma separated)</label><input className="input" value={formData.amenitiesText} onChange={e => setFormData({ ...formData, amenitiesText: e.target.value })} placeholder="Showers, lockers, parking" /></div>
                        <div className="input-group"><label>Equipment (comma separated)</label><input className="input" value={formData.equipmentsText} onChange={e => setFormData({ ...formData, equipmentsText: e.target.value })} placeholder="Treadmills, free weights" /></div>
                    </div>
                    {!isH4Division && <div className="input-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                        <input
                            type="checkbox"
                            id="fitPassEnabled"
                            checked={formData.fitPassEnabled}
                            onChange={e => setFormData({ ...formData, fitPassEnabled: e.target.checked })}
                            style={{ width: 'auto', margin: 0 }}
                        />
                        <label htmlFor="fitPassEnabled" style={{ marginBottom: 0, cursor: 'pointer', fontWeight: '600' }}>
                            Willing / Agreed for FitPass (FitPrime) Check-Ins
                        </label>
                    </div>}
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }} disabled={submitting}>
                        {submitting ? 'Saving...' : editBranch ? ' Update Branch' : ' Create Branch'}
                    </button>
                </form>
            </Modal>

            {/* Branch Details Modal (Eye icon) */}
            <Modal isOpen={!!detailsBranch} onClose={() => setDetailsBranch(null)} title={detailsBranch ? `${detailsBranch.name} — Branch Details` : 'Branch Details'}>
                {detailsBranch && (
                    <div style={{ display: 'grid', gap: '1rem', fontSize: '0.88rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', padding: '0.9rem', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                            <div><span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Branch Name</span><strong>{detailsBranch.name}</strong></div>
                            <div><span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Manager</span><strong>{detailsBranch.managerName || '—'}</strong></div>
                            <div><span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Phone</span><strong>{detailsBranch.phone || '—'}</strong></div>
                            <div><span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Email</span><strong>{detailsBranch.email || '—'}</strong></div>
                            <div><span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Website</span><strong>{detailsBranch.website ? <a href={detailsBranch.website} target="_blank" rel="noreferrer" style={{ color: '#92700A' }}>{detailsBranch.website}</a> : '—'}</strong></div>
                            <div><span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Members / Revenue</span><strong>{detailsBranch.memberCount || 0} · ₹{(detailsBranch.totalRevenue || 0).toLocaleString()}</strong></div>
                        </div>

                        <div>
                            <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Address</span>
                            <p style={{ margin: 0 }}>{detailsBranch.address || 'No address provided.'}</p>
                        </div>

                        {detailsBranch.shortDescription && (
                            <div>
                                <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Short Description</span>
                                <p style={{ margin: 0 }}>{detailsBranch.shortDescription}</p>
                            </div>
                        )}

                        {detailsBranch.description && (
                            <div>
                                <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Branch Details</span>
                                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{detailsBranch.description}</p>
                            </div>
                        )}

                        <div>
                            <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Opening Hours</span>
                            <div style={{ display: 'grid', gap: '0.35rem', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                                {BRANCH_DAYS.map(day => {
                                    const entry = detailsBranch.weeklySchedule?.[day];
                                    const isClosed = entry ? Boolean(entry.closed) : !(detailsBranch.workingDays || []).includes(day);
                                    const open = entry?.open || detailsBranch.openingTime || '06:00 AM';
                                    const close = entry?.close || detailsBranch.closingTime || '10:00 PM';
                                    return (
                                        <div key={day} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                                            <strong>{day}</strong>
                                            <span style={{ color: isClosed ? '#C62828' : 'var(--text-secondary)' }}>{isClosed ? 'Closed' : `${open} – ${close}`}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {Array.isArray(detailsBranch.scheduleExceptions) && detailsBranch.scheduleExceptions.length > 0 && (
                            <div>
                                <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Holidays & Special Hours</span>
                                <div style={{ display: 'grid', gap: '0.35rem' }}>
                                    {detailsBranch.scheduleExceptions.map((ex, idx) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                            <span><strong>{ex.date || '—'}</strong>{ex.reason ? ` · ${ex.reason}` : ''}</span>
                                            <span>{ex.closed ? 'Closed' : `${ex.open || '—'} – ${ex.close || '—'}`}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div>
                                <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Amenities</span>
                                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{detailsBranch.amenities?.length ? detailsBranch.amenities.join(', ') : '—'}</p>
                            </div>
                            <div>
                                <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Equipment</span>
                                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{detailsBranch.equipments?.length ? detailsBranch.equipments.join(', ') : '—'}</p>
                            </div>
                        </div>

                        {!isH4Division && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                FitPass Check-Ins: <strong>{detailsBranch.fitPassEnabled ? 'Enabled' : 'Disabled'}</strong>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Branch Members Modal */}
            <Modal isOpen={!!membersModal} onClose={() => { setMembersModal(null); setBranchMembers([]); }} title={` Members — ${membersModal?.name}`}>
                {branchMembers.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon"></div>
                        <h3>No members assigned</h3>
                        <p>No members have been assigned to this branch yet.</p>
                    </div>
                ) : (
                    <table>
                        <thead><tr><th>Name</th><th>Phone</th><th>Plan</th><th>Status</th></tr></thead>
                        <tbody>
                            {branchMembers.map(m => (
                                <tr key={m._id}>
                                    <td style={{ fontWeight: '600' }}>{m.name}</td>
                                    <td>{m.phone}</td>
                                    <td>{m.planId?.name || '—'}</td>
                                    <td><span style={{ background: m.status === 'Active' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: m.status === 'Active' ? '#10b981' : '#ef4444', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700' }}>{m.status}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Modal>

            {/* QR Code Modal */}
            {qrBranch && (
                <div className="modal-overlay" onClick={() => setQrBranch(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: '350px' }}>
                        <h3>{qrBranch.name} Check-In</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                            Print or display this QR code at this branch's reception. Members will scan it to check in.
                        </p>
                        <div style={{ background: '#fff', padding: '1.5rem', display: 'inline-block', borderRadius: '12px' }}>
                            <QRCodeCanvas 
                                id="branch-qr"
                                value={JSON.stringify({ gymId: qrBranch.gymId, branchId: qrBranch._id || qrBranch.id, gymName: qrBranch.name })}
                                size={220}
                                level="H"
                            />
                        </div>
                        <div style={{ marginTop: '2rem', display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-primary" onClick={() => {
                                const canvas = document.getElementById('branch-qr');
                                const url = canvas.toDataURL("image/png");
                                const link = document.createElement('a');
                                link.download = `QR - ${qrBranch.name}.png`;
                                link.href = url;
                                link.click();
                            }} style={{ flex: 1 }}>
                                Download
                            </button>
                            <button className="btn btn-secondary" onClick={() => setQrBranch(null)} style={{ flex: 1 }}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Branches;

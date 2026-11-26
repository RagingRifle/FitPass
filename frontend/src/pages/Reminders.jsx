import { useCallback, useContext, useEffect, useState } from 'react';
import { Bell, CalendarClock, Check, Clock3, IndianRupee, Save, Send, ShoppingBag, UsersRound } from 'lucide-react';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';

const INITIAL_SETTINGS = {
    leadReminderDaysBefore: 1,
    leadReminderRepeatDaily: true,
    inactivityReminderDays: 5,
    inactivityReminderRepeatDaily: true,
    dueReminderDaysAfter: 3,
    dueReminderRepeatDaily: true,
    notifyNewProductToMembers: true,
};

const INITIAL_FILTERS = {
    branchId: '',
    status: '',
    planId: '',
    inactiveDays: '',
    hasPendingDues: false,
    search: '',
};

const QUICK_TEMPLATES = [
    { label: 'Class update', text: 'New studio class slots are now open for booking in the H4 app!' },
    { label: 'Payment reminder', text: 'Friendly reminder: please clear your pending membership balance at the front desk.' },
    { label: 'We miss you', text: 'We have missed seeing you at H4! Drop in today and keep your streak going.' },
];

const ReminderCard = ({ icon, eyebrow, title, description, children }) => (
    <section style={{
        padding: '1.35rem',
        border: '1px solid var(--border-color, #e5e0d2)',
        borderRadius: 16,
        background: 'var(--bg-secondary, #fff)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
    }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{
                width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center',
                background: 'rgba(254, 223, 30, 0.2)', color: '#171713', flexShrink: 0,
            }}>
                {icon}
            </div>
            <div>
                <div style={{ color: '#92700A', fontSize: 10, fontWeight: 800, letterSpacing: '0.12em' }}>{eyebrow}</div>
                <h3 style={{ margin: '4px 0', fontSize: '1.05rem' }}>{title}</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>{description}</p>
            </div>
        </div>
        {children}
    </section>
);

const RepeatControl = ({ checked, onChange, title, description }) => (
    <label style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12,
        borderRadius: 12, background: 'var(--bg-tertiary, #f7f5ef)', cursor: 'pointer',
    }}>
        <input type="checkbox" checked={checked} onChange={onChange} style={{ marginTop: 3, accentColor: '#171713' }} />
        <span>
            <span style={{ display: 'block', fontWeight: 700, fontSize: 13 }}>{title}</span>
            <span style={{ display: 'block', marginTop: 3, color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.4 }}>{description}</span>
        </span>
    </label>
);

const NumberSetting = ({ label, value, onChange, min = 1 }) => (
    <label className="input-group">
        <span>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
                className="input"
                type="number"
                min={min}
                max={365}
                step={1}
                value={value}
                onChange={onChange}
                style={{ maxWidth: 140 }}
            />
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>day{Number(value) === 1 ? '' : 's'}</span>
        </div>
    </label>
);

export default function Reminders() {
    const { user } = useContext(AuthContext);
    const isBranchAdmin = user?.role === 'h4_branch_admin'
        || user?.role === 'h4_admin' && Boolean(user?.branchId)
        || user?.role === 'admin' && user?.isH4BranchAdmin === true;

    const [settings, setSettings] = useState(INITIAL_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');

    // Custom notification composer state
    const [branches, setBranches] = useState([]);
    const [plans, setPlans] = useState([]);
    const [filters, setFilters] = useState(INITIAL_FILTERS);
    const [targetMode, setTargetMode] = useState('filtered'); // 'filtered' | 'specific'
    const [preview, setPreview] = useState({ totalMatched: 0, appReachableCount: 0, members: [] });
    const [previewLoading, setPreviewLoading] = useState(false);
    const [selectedMemberIds, setSelectedMemberIds] = useState([]);
    const [customMessage, setCustomMessage] = useState('');
    const [sendingCustom, setSendingCustom] = useState(false);
    const [customNotice, setCustomNotice] = useState('');
    const [customError, setCustomError] = useState('');

    useEffect(() => {
        API.get('/notifications/reminder-settings')
            .then(({ data }) => {
                setSettings(current => ({ ...current, ...data }));
                setLoaded(true);
            })
            .catch((err) => setError(err.response?.data?.message || 'Could not load reminder settings.'))
            .finally(() => setLoading(false));

        API.get('/branches')
            .then(({ data }) => setBranches(Array.isArray(data) ? data : (data?.branches || [])))
            .catch(() => setBranches([]));

        API.get('/plans')
            .then(({ data }) => setPlans(Array.isArray(data) ? data : (data?.plans || [])))
            .catch(() => setPlans([]));
    }, []);

    const loadPreview = useCallback(async (activeFilters) => {
        setPreviewLoading(true);
        try {
            const { data } = await API.post('/notifications/custom/preview', activeFilters);
            setPreview({
                totalMatched: data?.totalMatched || 0,
                appReachableCount: data?.appReachableCount || 0,
                members: Array.isArray(data?.members) ? data.members : [],
            });
        } catch {
            setPreview({ totalMatched: 0, appReachableCount: 0, members: [] });
        } finally {
            setPreviewLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            loadPreview(filters);
        }, 250);
        return () => window.clearTimeout(timer);
    }, [filters, loadPreview]);

    const setNumber = (field) => (event) => {
        const value = event.target.value;
        setSettings(current => ({ ...current, [field]: value === '' ? '' : Number(value) }));
    };

    const setRepeat = (field) => (event) => {
        setSettings(current => ({ ...current, [field]: event.target.checked }));
    };

    const saveSettings = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        setNotice('');
        try {
            const payload = {
                ...settings,
                inactivityReminderDays: Number(settings.inactivityReminderDays),
                leadReminderDaysBefore: Number(settings.leadReminderDaysBefore),
                dueReminderDaysAfter: Number(settings.dueReminderDaysAfter),
            };
            const { data } = await API.put('/notifications/reminder-settings', payload);
            setSettings(current => ({ ...current, ...data.settings }));
            setNotice('Reminder settings saved.');
        } catch (err) {
            setError(err.response?.data?.message || 'Could not save reminder settings.');
        } finally {
            setSaving(false);
        }
    };

    const toggleMemberSelection = (id) => {
        setSelectedMemberIds(prev => (
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        ));
    };

    const handleSendCustom = async (event) => {
        event.preventDefault();
        setCustomError('');
        setCustomNotice('');
        if (!customMessage.trim()) {
            setCustomError('Enter a notification message to send.');
            return;
        }
        if (targetMode === 'specific' && selectedMemberIds.length === 0) {
            setCustomError('Select at least one member from the list.');
            return;
        }
        setSendingCustom(true);
        try {
            const payload = {
                message: customMessage.trim(),
                type: 'custom',
                ...(targetMode === 'specific' ? { memberIds: selectedMemberIds } : { filters }),
            };
            const { data } = await API.post('/notifications/custom/send', payload);
            setCustomNotice(data?.message || 'Notification sent.');
            setCustomMessage('');
            if (targetMode === 'specific') setSelectedMemberIds([]);
        } catch (err) {
            setCustomError(err.response?.data?.message || 'Could not send custom notification.');
        } finally {
            setSendingCustom(false);
        }
    };

    return (
        <div className="fade-in" style={{ maxWidth: 1120, margin: '0 auto', paddingBottom: 36 }}>
            <div className="plans-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22 }}>
                <div>
                    <p className="plans-page-header__kicker">H4 · DAILY RHYTHM</p>
                    <h2 style={{ margin: 0 }}>Reminders &amp; Notifications</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '7px 0 0', maxWidth: 640 }}>
                        Configure automated reminders and send custom app notifications to filtered or specific H4 members. {isBranchAdmin ? 'These settings apply only to your assigned branch.' : 'Branch-specific settings take precedence over these H4 defaults.'}
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 11px', borderRadius: 99, background: '#171713', color: '#FEDF1E', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>
                    <Bell size={14} /> Web + mobile inbox
                </div>
            </div>

            {error && <div role="alert" style={{ marginBottom: 16, padding: 12, borderRadius: 10, color: '#991b1b', background: '#fee2e2' }}>{error}</div>}
            {notice && <div role="status" style={{ marginBottom: 16, padding: 12, borderRadius: 10, color: '#166534', background: '#dcfce7', display: 'flex', alignItems: 'center', gap: 8 }}><Check size={16} />{notice}</div>}

            {/* Automated Reminders */}
            <form onSubmit={saveSettings}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 16 }}>
                    <ReminderCard
                        icon={<CalendarClock size={20} />}
                        eyebrow="LEAD FOLLOW-UP"
                        title="Bring the next conversation forward"
                        description="Alert H4 administrators and assigned branch staff before a lead’s follow-up date."
                    >
                        <NumberSetting
                            label="Days before follow-up"
                            value={settings.leadReminderDaysBefore}
                            onChange={setNumber('leadReminderDaysBefore')}
                        />
                        <RepeatControl
                            checked={settings.leadReminderRepeatDaily}
                            onChange={setRepeat('leadReminderRepeatDaily')}
                            title="Repeat daily after the first reminder"
                            description="Keep reminding each day, including after the follow-up date, until the lead is closed or converted."
                        />
                    </ReminderCard>

                    <ReminderCard
                        icon={<UsersRound size={20} />}
                        eyebrow="MEMBER RE-ENGAGEMENT"
                        title="Notice when visits pause"
                        description="Alert the relevant branch admins and the member after a stretch without a gym check-in."
                    >
                        <NumberSetting
                            label="No-visit threshold"
                            value={settings.inactivityReminderDays}
                            onChange={setNumber('inactivityReminderDays')}
                        />
                        <RepeatControl
                            checked={settings.inactivityReminderRepeatDaily}
                            onChange={setRepeat('inactivityReminderRepeatDaily')}
                            title="Repeat daily until the next check-in"
                            description="If switched off, send one reminder for each no-visit period."
                        />
                    </ReminderCard>

                    <ReminderCard
                        icon={<IndianRupee size={20} />}
                        eyebrow="PENDING DUES"
                        title="Automated balance reminders"
                        description="Notify H4 members in the app when a membership balance remains unpaid. Stops automatically once settled."
                    >
                        <NumberSetting
                            label="Days after join/due date"
                            value={settings.dueReminderDaysAfter}
                            onChange={setNumber('dueReminderDaysAfter')}
                            min={0}
                        />
                        <RepeatControl
                            checked={settings.dueReminderRepeatDaily}
                            onChange={setRepeat('dueReminderRepeatDaily')}
                            title="Repeat daily until payment is settled"
                            description="Stops automatically as soon as the member's paid amount covers their plan price."
                        />
                    </ReminderCard>

                    <ReminderCard
                        icon={<ShoppingBag size={20} />}
                        eyebrow="H4 STORE LAUNCHES"
                        title="New product announcements"
                        description="Automatically notify all active H4 members in their mobile inbox whenever a new product is added to H4 Shop."
                    >
                        <RepeatControl
                            checked={settings.notifyNewProductToMembers}
                            onChange={setRepeat('notifyNewProductToMembers')}
                            title="Notify all H4 members on new product"
                            description="Sends an instant in-app alert when a new active item is created in H4 Merchandise."
                        />
                    </ReminderCard>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18, marginBottom: 28 }}>
                    <button className="btn btn-primary" type="submit" disabled={saving || loading || !loaded} style={{ minWidth: 180, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                        {saving ? <Clock3 size={16} /> : <Save size={16} />}
                        {saving ? 'Saving…' : 'Save automated rules'}
                    </button>
                </div>
            </form>

            {/* Custom App Notification Composer */}
            <section className="card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: '1.25rem' }}>
                    <div>
                        <div style={{ color: '#92700A', fontSize: 10, fontWeight: 800, letterSpacing: '0.12em' }}>CUSTOM BROADCAST</div>
                        <h3 style={{ margin: '4px 0', fontSize: '1.15rem' }}>Send Custom Notification to H4 App</h3>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
                            Filter members by branch, status, plan, inactivity, or pending dues — then send to all matched members or pick specific individuals.
                        </p>
                    </div>
                    <div style={{ padding: '7px 12px', borderRadius: 10, background: '#fff8d8', border: '1px solid #efdf99', color: '#594600', fontSize: 12, fontWeight: 700 }}>
                        {previewLoading ? 'Checking audience…' : `${preview.totalMatched} matched · ${preview.appReachableCount} with app`}
                    </div>
                </div>

                {customError && <div role="alert" style={{ marginBottom: 14, padding: 11, borderRadius: 10, color: '#991b1b', background: '#fee2e2', fontSize: 13 }}>{customError}</div>}
                {customNotice && <div role="status" style={{ marginBottom: 14, padding: 11, borderRadius: 10, color: '#166534', background: '#dcfce7', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><Check size={16} />{customNotice}</div>}

                <form onSubmit={handleSendCustom} style={{ display: 'grid', gap: '1.15rem' }}>
                    {/* Filter Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 12 }}>
                        {!isBranchAdmin && (
                            <label className="input-group" style={{ marginBottom: 0 }}>
                                Branch
                                <select className="input" value={filters.branchId} onChange={e => setFilters(f => ({ ...f, branchId: e.target.value }))}>
                                    <option value="">All H4 branches</option>
                                    {branches.map(b => <option key={b.id || b._id} value={b.id || b._id}>{b.name}</option>)}
                                </select>
                            </label>
                        )}
                        <label className="input-group" style={{ marginBottom: 0 }}>
                            Member Status
                            <select className="input" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
                                <option value="">All statuses</option>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                                <option value="Frozen">Frozen</option>
                                <option value="Expired">Expired</option>
                            </select>
                        </label>
                        <label className="input-group" style={{ marginBottom: 0 }}>
                            Membership Plan
                            <select className="input" value={filters.planId} onChange={e => setFilters(f => ({ ...f, planId: e.target.value }))}>
                                <option value="">All plans</option>
                                {plans.map(p => <option key={p.id || p._id} value={p.id || p._id}>{p.name}</option>)}
                            </select>
                        </label>
                        <label className="input-group" style={{ marginBottom: 0 }}>
                            Inactive for (days+)
                            <input className="input" type="number" min="1" max="365" placeholder="Any" value={filters.inactiveDays} onChange={e => setFilters(f => ({ ...f, inactiveDays: e.target.value }))} />
                        </label>
                        <label className="input-group" style={{ marginBottom: 0 }}>
                            Search member
                            <input className="input" type="search" placeholder="Name, phone, ID…" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
                        </label>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            <input type="checkbox" checked={filters.hasPendingDues} onChange={e => setFilters(f => ({ ...f, hasPendingDues: e.target.checked }))} />
                            Pending dues only
                        </label>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className={`btn ${targetMode === 'filtered' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ padding: '0.45rem 0.9rem', fontSize: 13 }}
                                onClick={() => setTargetMode('filtered')}
                            >
                                All matched ({preview.appReachableCount} app users)
                            </button>
                            <button
                                type="button"
                                className={`btn ${targetMode === 'specific' ? 'btn-primary' : 'btn-secondary'}`}
                                style={{ padding: '0.45rem 0.9rem', fontSize: 13 }}
                                onClick={() => setTargetMode('specific')}
                            >
                                Select specific ({selectedMemberIds.length})
                            </button>
                        </div>
                    </div>

                    {targetMode === 'specific' && (
                        <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 12, padding: 8, display: 'grid', gap: 6, background: 'var(--bg)' }}>
                            {preview.members.length === 0 ? (
                                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>No members match these filters.</div>
                            ) : preview.members.map(m => {
                                const checked = selectedMemberIds.includes(m.id);
                                return (
                                    <label key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: 8, background: checked ? '#fff8d8' : 'transparent', cursor: 'pointer', fontSize: 13 }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <input type="checkbox" checked={checked} onChange={() => toggleMemberSelection(m.id)} />
                                            <span>
                                                <strong>{m.name}</strong>
                                                <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: 12 }}>
                                                    {m.phone || m.registrationNumber || ''} {m.branchName ? `· ${m.branchName}` : ''}
                                                </span>
                                            </span>
                                        </span>
                                        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                            {m.dueAmount > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c' }}>Due ₹{m.dueAmount}</span>}
                                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: m.hasAppAccount ? '#dcfce7' : '#f1f5f9', color: m.hasAppAccount ? '#166534' : '#64748b' }}>
                                                {m.hasAppAccount ? 'App active' : 'No app login'}
                                            </span>
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    )}

                    {/* Message + Quick Templates */}
                    <div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                            {QUICK_TEMPLATES.map(t => (
                                <button
                                    key={t.label}
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ padding: '4px 10px', fontSize: 11 }}
                                    onClick={() => setCustomMessage(t.text)}
                                >
                                    + {t.label}
                                </button>
                            ))}
                        </div>
                        <label className="input-group" style={{ marginBottom: 0 }}>
                            Notification Message
                            <textarea
                                className="input"
                                rows={3}
                                placeholder="Write your message for H4 members' app inbox..."
                                value={customMessage}
                                onChange={e => setCustomMessage(e.target.value)}
                                required
                            />
                        </label>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={sendingCustom || (targetMode === 'specific' ? selectedMemberIds.length === 0 : preview.appReachableCount === 0)}
                            style={{ minWidth: 200, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                        >
                            <Send size={15} />
                            {sendingCustom ? 'Sending…' : targetMode === 'specific' ? `Send to ${selectedMemberIds.length} selected` : `Send to ${preview.appReachableCount} member(s)`}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}

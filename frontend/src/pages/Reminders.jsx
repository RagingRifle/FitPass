import { useContext, useEffect, useState } from 'react';
import { Bell, CalendarClock, Check, Clock3, Save, UsersRound } from 'lucide-react';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';

const INITIAL_SETTINGS = {
    leadReminderDaysBefore: 1,
    leadReminderRepeatDaily: true,
    inactivityReminderDays: 5,
    inactivityReminderRepeatDaily: true,
};

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

    useEffect(() => {
        API.get('/notifications/reminder-settings')
            .then(({ data }) => {
                setSettings(current => ({ ...current, ...data }));
                setLoaded(true);
            })
            .catch((err) => setError(err.response?.data?.message || 'Could not load reminder settings.'))
            .finally(() => setLoading(false));
    }, []);

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

    return (
        <div style={{ maxWidth: 1040, margin: '0 auto', paddingBottom: 32 }}>
            <div className="plans-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 22 }}>
                <div>
                    <p className="plans-page-header__kicker">H4 · DAILY RHYTHM</p>
                    <h2 style={{ margin: 0 }}>Reminders</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '7px 0 0', maxWidth: 620 }}>
                        Keep follow-ups moving and check in when a member's routine goes quiet. {isBranchAdmin ? 'These settings apply only to your assigned branch.' : 'Branch-specific settings take precedence over these H4 defaults.'}
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 11px', borderRadius: 99, background: '#171713', color: '#FEDF1E', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>
                    <Bell size={14} /> Web + mobile inbox
                </div>
            </div>

            {error && <div role="alert" style={{ marginBottom: 16, padding: 12, borderRadius: 10, color: '#991b1b', background: '#fee2e2' }}>{error}</div>}
            {notice && <div role="status" style={{ marginBottom: 16, padding: 12, borderRadius: 10, color: '#166534', background: '#dcfce7', display: 'flex', alignItems: 'center', gap: 8 }}><Check size={16} />{notice}</div>}

            <form onSubmit={saveSettings}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 16 }}>
                    <ReminderCard
                        icon={<CalendarClock size={20} />}
                        eyebrow="LEAD FOLLOW-UP"
                        title="Bring the next conversation forward"
                        description="Alert the H4 administrators and assigned branch staff before a lead’s follow-up date."
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
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
                    <button className="btn btn-primary" type="submit" disabled={saving || loading || !loaded} style={{ minWidth: 180, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                        {saving ? <Clock3 size={16} /> : <Save size={16} />}
                        {saving ? 'Saving…' : 'Save reminders'}
                    </button>
                </div>
            </form>
        </div>
    );
}

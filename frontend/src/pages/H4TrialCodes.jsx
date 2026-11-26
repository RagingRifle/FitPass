import { useCallback, useEffect, useState } from 'react';
import API from '../services/api';
import { useToast } from '../components/ui/Toast';
import { CalendarClock, Clock3, Gift, Plus, X } from 'lucide-react';
import './h4-trial-codes.css';

const localInputTime = (date) => {
  const value = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return value.toISOString().slice(0, 16);
};
const emptyForm = () => ({ code: '', startsAt: localInputTime(new Date()), endsAt: localInputTime(new Date(Date.now() + 30 * 86400000)), trialDays: 7, checkInLimit: 5, workoutAccess: true, maxRedemptions: '' });
const dateLabel = value => new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function H4TrialCodes() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { const { data } = await API.get('/h4-trial-coupons'); setRows(Array.isArray(data) ? data : []); }
    catch (error) { toast.error(error.response?.data?.message || 'Could not load H4 trial codes.'); }
    finally { setLoading(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  const create = async event => {
    event.preventDefault(); setSaving(true);
    try {
      await API.post('/h4-trial-coupons', { ...form, code: form.code.trim().toUpperCase(), startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString(), trialDays: Number(form.trialDays), checkInLimit: Number(form.checkInLimit), maxRedemptions: form.maxRedemptions === '' ? null : Number(form.maxRedemptions) });
      setForm(emptyForm()); await load(); toast.success('Trial referral code created.');
    } catch (error) { toast.error(error.response?.data?.message || 'Could not create the trial code.'); }
    finally { setSaving(false); }
  };
  const deactivate = async row => {
    if (!window.confirm(`Turn off ${row.code}? Members will no longer be able to redeem it.`)) return;
    try { await API.patch(`/h4-trial-coupons/${row.id}/deactivate`); await load(); toast.success(`${row.code} turned off.`); }
    catch (error) { toast.error(error.response?.data?.message || 'Could not turn off this code.'); }
  };

  return (
    <div className="fade-in" style={{ paddingBottom: 36 }}>
      <div className="plans-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <p className="plans-page-header__kicker">H4 · MEMBER OFFERS</p>
          <h2 style={{ margin: 0 }}>Trial referral codes</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0', maxWidth: 660 }}>
            Create a time-limited code. Each redemption starts a trial with its own check-in allowance and workout access.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 16px', borderRadius: 12, background: '#fff8d8', color: '#594600', border: '1px solid #efdf99', fontSize: 13 }}>
          <Gift size={17} />
          <span><strong>{rows.filter(row => row.isActive).length}</strong> active codes</span>
        </div>
      </div>

      <div className="h4-trial-layout">
        <form onSubmit={create} className="card h4-trial-form-card" style={{ display: 'grid', gap: 14 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 19 }}>Create a code</h2>
            <small style={{ color: 'var(--text-secondary)' }}>The redemption window is separate from each member’s trial duration.</small>
          </div>
          <label className="input-group">
            Referral code
            <input className="input" required minLength={4} maxLength={32} pattern="[A-Za-z0-9-]+" placeholder="FRIEND7" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          </label>
          <div className="h4-trial-form-row">
            <label className="input-group">
              Starts at
              <input className="input" type="datetime-local" required value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })} />
            </label>
            <label className="input-group">
              Ends at
              <input className="input" type="datetime-local" required min={form.startsAt} value={form.endsAt} onChange={e => setForm({ ...form, endsAt: e.target.value })} />
            </label>
          </div>
          <div className="h4-trial-form-row">
            <label className="input-group">
              Trial length (days)
              <input className="input" type="number" required min="1" max="90" value={form.trialDays} onChange={e => setForm({ ...form, trialDays: e.target.value })} />
            </label>
            <label className="input-group">
              Check-ins allowed
              <input className="input" type="number" required min="1" max="90" value={form.checkInLimit} onChange={e => setForm({ ...form, checkInLimit: e.target.value })} />
            </label>
          </div>
          <label className="input-group">
            Total redemptions <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(optional)</span>
            <input className="input" type="number" min="1" value={form.maxRedemptions} onChange={e => setForm({ ...form, maxRedemptions: e.target.value })} placeholder="No limit" />
          </label>
          <label className="h4-trial-checkbox-card">
            <input type="checkbox" checked={form.workoutAccess} onChange={e => setForm({ ...form, workoutAccess: e.target.checked })} />
            <span>
              <strong>Include workout access</strong>
              <small style={{ display: 'block', color: 'var(--text-secondary)' }}>Member can view assigned workouts while the trial is active.</small>
            </span>
          </label>
          <button className="btn btn-primary" disabled={saving} style={{ minHeight: 44, width: '100%' }}>
            <Plus size={16} /> {saving ? 'Creating…' : 'Create referral code'}
          </button>
        </form>

        <section className="card h4-trial-register-card" style={{ padding: 0 }}>
          <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ margin: 0, fontSize: 19 }}>Code register</h2>
            <small style={{ color: 'var(--text-secondary)' }}>Validity and trial rules for each code.</small>
          </div>
          {loading ? (
            <p style={{ padding: 20, color: 'var(--text-secondary)', margin: 0 }}>Loading trial codes…</p>
          ) : !rows.length ? (
            <div style={{ padding: '44px 24px', textAlign: 'center' }}>
              <CalendarClock size={30} color="#947900" />
              <h3 style={{ marginBottom: 4 }}>No trial codes yet</h3>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Create one for an upcoming referral offer.</p>
            </div>
          ) : (
            <div style={{ display: 'grid' }}>
              {rows.map((row, idx) => {
                const now = Date.now();
                const windowOpen = now >= new Date(row.startsAt).getTime() && now <= new Date(row.endsAt).getTime();
                const live = row.isActive && windowOpen && (row.maxRedemptions == null || row.redemptionCount < row.maxRedemptions);
                return (
                  <article key={row.id} style={{ padding: '17px 20px', borderBottom: idx < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap' }}>
                      <div>
                        <code style={{ fontSize: 17, fontWeight: 900, letterSpacing: 1.2, color: '#5b4900' }}>{row.code}</code>
                        <div style={{ marginTop: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
                          <Clock3 size={12} style={{ verticalAlign: '-2px' }} /> {dateLabel(row.startsAt)} – {dateLabel(row.endsAt)}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: live ? '#18794e' : '#6b7280', background: live ? '#e8f7ef' : '#f1f2f4', padding: '5px 10px', borderRadius: 20 }}>
                        {live ? 'Available' : row.isActive ? 'Scheduled / ended' : 'Off'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 12, fontSize: 12 }}>
                      <span><strong>{row.trialDays} days</strong> access</span>
                      <span><strong>{row.checkInLimit}</strong> check-ins</span>
                      <span>{row.workoutAccess ? 'Workouts included' : 'No workouts'}</span>
                      <span><strong>{row.redemptionCount}</strong>{row.maxRedemptions ? ` / ${row.maxRedemptions}` : ''} redeemed</span>
                    </div>
                    {row.isActive && (
                      <button type="button" className="btn btn-secondary" onClick={() => deactivate(row)} style={{ marginTop: 12, padding: '5px 10px', fontSize: 12 }}>
                        <X size={13} /> Turn off code
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

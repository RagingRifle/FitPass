import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader,  Activity, Building2, CircleDollarSign, Download, Filter, Landmark, Pencil, Plus, RefreshCw, TrendingUp, Users } from 'lucide-react';
import API from '../../services/api';
import Modal from '../../components/Modal';

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const dateInput = value => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const number = value => Number(value || 0).toLocaleString('en-IN');
const periodLabel = record => `${new Date(record.periodStart).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })} – ${new Date(record.periodEnd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}`;

const initialForm = (rate = 50, branchId = '') => ({ branchId, startDate: `${today().slice(0, 7)}-01`, endDate: today(), ratePerCheckIn: String(rate), manualRevenue: '', paidAmount: '0', operatingCosts: '0', paymentReference: '', notes: '' });

const Metric = ({ icon: Icon, label, value, note, tone }) => (
  <div className="card" style={{ padding: '1rem 1.15rem', minWidth: 170, flex: '1 1 180px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '.78rem', fontWeight: 700 }}><span>{label}</span><Icon size={16} color={tone} /></div>
    <div style={{ fontSize: '1.55rem', fontWeight: 850, marginTop: 9, color: 'var(--text-primary)' }}>{value}</div>
    {note && <div style={{ color: 'var(--text-secondary)', fontSize: '.73rem', marginTop: 3 }}>{note}</div>}
  </div>
);

const statusStyle = status => ({
  display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '.28rem .6rem', fontSize: '.72rem', fontWeight: 800,
  color: status === 'Paid' ? '#166534' : status === 'Partial' ? '#854d0e' : '#991b1b',
  background: status === 'Paid' ? '#dcfce7' : status === 'Partial' ? '#fef3c7' : '#fee2e2',
});

export default function FitPassBranchPayouts() {
  const [records, setRecords] = useState([]);
  const [activity, setActivity] = useState([]);
  const [branches, setBranches] = useState([]);
  const [defaultRate, setDefaultRate] = useState('50');
  const [rateDraft, setRateDraft] = useState('50');
  const [from, setFrom] = useState(() => { const date = new Date(); date.setDate(date.getDate() - 90); return dateInput(date); });
  const [to, setTo] = useState(today());
  const [gymId, setGymId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState({ checkIns: 0, grossRevenue: 0, paidAmount: 0, retainedAmount: 0, netProfit: 0, records: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rateSaving, setRateSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm());
  const [previewCount, setPreviewCount] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = { from, to };
      if (gymId) params.gymId = gymId;
      if (branchId) params.branchId = branchId;
      if (status) params.status = status;
      if (search.trim()) params.search = search.trim();
      const { data } = await API.get('/superadmin/fitpass/payouts', { params });
      setRecords(data.records || []); setBranches(data.branches || []); setSummary(data.summary || {}); setActivity(data.activity || []);
      const rate = data.settings?.defaultRatePerCheckIn ?? 50;
      setDefaultRate(String(rate)); setRateDraft(String(rate));
    } catch (err) { setError(err.response?.data?.message || 'Could not load branch payout data.'); }
    finally { setLoading(false); }
  }, [from, to, gymId, branchId, status, search]);

  useEffect(() => { loadData(); }, [loadData]);

  const displayedRecords = records;

  const chartRows = useMemo(() => {
    const grouped = new Map();
    displayedRecords.forEach(row => {
      const key = new Date(row.periodStart).toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' });
      const current = grouped.get(key) || { period: key, gross: 0, paid: 0, profit: 0 };
      current.gross += Number(row.grossRevenue || 0); current.paid += Number(row.paidAmount || 0); current.profit += Number(row.netProfit || 0);
      grouped.set(key, current);
    });
    return [...grouped.values()].reverse();
  }, [displayedRecords]);

  const gyms = useMemo(() => [...new Map(branches.map(branch => [branch.gymId, { id: branch.gymId, name: branch.gymName }])).values()], [branches]);
  const filteredBranches = gymId ? branches.filter(branch => branch.gymId === gymId) : branches;
  const estimatedGross = form.manualRevenue !== '' ? Number(form.manualRevenue || 0) : previewCount * Number(form.ratePerCheckIn || 0);
  const estimatedRetained = estimatedGross - Number(form.paidAmount || 0);
  const estimatedProfit = estimatedRetained - Number(form.operatingCosts || 0);

  useEffect(() => {
    if (!modalOpen || editing || !form.branchId || !form.startDate || !form.endDate) return;
    let active = true;
    setPreviewLoading(true);
    API.get('/superadmin/fitpass/payouts/preview', { params: { branchId: form.branchId, startDate: form.startDate, endDate: form.endDate } })
      .then(({ data }) => { if (active) setPreviewCount(Number(data.checkInCount || 0)); })
      .catch(() => { if (active) setPreviewCount(0); })
      .finally(() => { if (active) setPreviewLoading(false); });
    return () => { active = false; };
  }, [modalOpen, editing, form.branchId, form.startDate, form.endDate]);

  const openCreate = () => {
    setEditing(null); setForm(initialForm(defaultRate, branches[0]?.id || '')); setPreviewCount(0); setError(''); setModalOpen(true);
  };
  const openEdit = row => {
    setEditing(row); setPreviewCount(row.checkInCount);
    setForm({ branchId: row.branchId, startDate: dateInput(row.periodStart), endDate: dateInput(row.periodEnd), ratePerCheckIn: String(row.ratePerCheckIn), manualRevenue: row.manualRevenue == null ? '' : String(row.manualRevenue), paidAmount: String(row.paidAmount), operatingCosts: String(row.operatingCosts), paymentReference: row.paymentReference || '', notes: row.notes || '' });
    setError(''); setModalOpen(true);
  };

  const saveRate = async event => {
    event.preventDefault(); setRateSaving(true); setError(''); setSuccess('');
    try {
      const { data } = await API.put('/superadmin/fitpass/payouts/settings', { defaultRatePerCheckIn: Number(rateDraft) });
      setDefaultRate(String(data.data.defaultRatePerCheckIn)); setRateDraft(String(data.data.defaultRatePerCheckIn)); setSuccess('Default conversion rate updated.');
    } catch (err) { setError(err.response?.data?.message || 'Could not update the conversion rate.'); }
    finally { setRateSaving(false); }
  };

  const savePayout = async event => {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('');
    try {
      if (editing) {
        await API.patch(`/superadmin/fitpass/payouts/${editing.id}`, { ratePerCheckIn: Number(form.ratePerCheckIn), manualRevenue: form.manualRevenue === '' ? null : Number(form.manualRevenue), paidAmount: Number(form.paidAmount), operatingCosts: Number(form.operatingCosts), paymentReference: form.paymentReference, notes: form.notes });
      } else {
        await API.post('/superadmin/fitpass/payouts', { branchId: form.branchId, startDate: form.startDate, endDate: form.endDate, ratePerCheckIn: Number(form.ratePerCheckIn), manualRevenue: form.manualRevenue === '' ? null : Number(form.manualRevenue), paidAmount: Number(form.paidAmount), operatingCosts: Number(form.operatingCosts), paymentReference: form.paymentReference, notes: form.notes });
      }
      setModalOpen(false); setSuccess(editing ? 'Payout record updated.' : 'Branch payout record created.'); await loadData();
    } catch (err) { setError(err.response?.data?.message || 'Could not save this payout record.'); }
    finally { setSaving(false); }
  };

  const exportCsv = () => {
    const headers = ['Period from', 'Period through', 'Gym', 'Branch', 'Check-ins', 'Rate per check-in', 'Gross revenue', 'Paid amount', 'Retained', 'Operating costs', 'Net profit', 'Status', 'Payment reference'];
    const rows = displayedRecords.map(row => [dateInput(row.periodStart), dateInput(row.periodEnd), row.gymName, row.branchName, row.checkInCount, row.ratePerCheckIn, row.grossRevenue, row.paidAmount, row.retainedAmount, row.operatingCosts, row.netProfit, row.status, row.paymentReference || '']);
    const csv = [headers, ...rows].map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'fitpass-branch-payouts.csv'; anchor.click(); URL.revokeObjectURL(url);
  };

  return <div className="fade-in" style={{ maxWidth: 1500, margin: '0 auto', padding: '1.25rem 1.5rem 2rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: '1.25rem' }}>
      <div><div style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '.7rem', letterSpacing: '.12em' }}>FITPASS · NETWORK FINANCE</div><h1 style={{ margin: '5px 0', fontSize: '1.7rem', fontWeight: 900 }}>Branch payouts</h1><p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '.88rem' }}>Settle partner branches from successful FitPass check-ins and track what the network retains.</p></div>
      <div style={{ display: 'flex', gap: 8 }}><button className="btn btn-secondary" onClick={exportCsv} disabled={!displayedRecords.length} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Download size={15} /> Export CSV</button><button className="btn btn-primary" onClick={openCreate} disabled={!branches.length} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Plus size={16} /> Create settlement</button></div>
    </div>

    {(error || success) && <div className="card" style={{ marginBottom: 14, color: error ? 'var(--danger-color, #b91c1c)' : '#166534', padding: '.75rem 1rem' }}>{error || success}</div>}

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: 10, alignItems: 'stretch', marginBottom: 14 }}>
      <form onSubmit={saveRate} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 7, padding: '1rem 1.1rem' }}>
        <label style={{ color: 'var(--text-secondary)', fontSize: '.75rem', fontWeight: 750 }}>Default conversion · per check-in</label>
        <div style={{ display: 'flex', gap: 7 }}><input className="input" aria-label="Default rupees per check-in" type="number" min="0" step="0.01" value={rateDraft} onChange={event => setRateDraft(event.target.value)} /><button className="btn btn-secondary" disabled={rateSaving} type="submit">{rateSaving ? 'Saving…' : 'Save rate'}</button></div>
        <small style={{ color: 'var(--text-secondary)' }}>Each settlement can use its own rate or a custom revenue total.</small>
      </form>
      <Metric icon={Users} label="Successful check-ins" value={number(summary.checkIns)} note="For saved settlements" tone="#2563eb" />
      <Metric icon={CircleDollarSign} label="Gross revenue" value={money(summary.grossRevenue)} note="Saved settlement totals" tone="#0891b2" />
      <Metric icon={Landmark} label="Paid to branches" value={money(summary.paidAmount)} note="Recorded partner payouts" tone="#7c3aed" />
      <Metric icon={TrendingUp} label="Net profit after payout" value={money(summary.netProfit)} note={`Retained ${money(summary.retainedAmount)} before costs`} tone="#15803d" />
    </div>

    <div className="card" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end', marginBottom: 14, padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-secondary)', fontSize: '.8rem', fontWeight: 800, marginRight: 4 }}><Filter size={15} /> Filters</div>
      <label style={{ display: 'grid', gap: 4, fontSize: '.72rem', color: 'var(--text-secondary)' }}>From<input className="input" type="date" value={from} max={to} onChange={event => setFrom(event.target.value)} /></label>
      <label style={{ display: 'grid', gap: 4, fontSize: '.72rem', color: 'var(--text-secondary)' }}>To<input className="input" type="date" value={to} min={from} onChange={event => setTo(event.target.value)} /></label>
      <label style={{ display: 'grid', gap: 4, fontSize: '.72rem', color: 'var(--text-secondary)' }}>Partner gym<select className="input" value={gymId} onChange={event => { setGymId(event.target.value); setBranchId(''); }}><option value="">All gyms</option>{gyms.map(gym => <option key={gym.id} value={gym.id}>{gym.name}</option>)}</select></label>
      <label style={{ display: 'grid', gap: 4, fontSize: '.72rem', color: 'var(--text-secondary)' }}>Branch<select className="input" value={branchId} onChange={event => setBranchId(event.target.value)}><option value="">All branches</option>{filteredBranches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      <label style={{ display: 'grid', gap: 4, fontSize: '.72rem', color: 'var(--text-secondary)' }}>Payout status<select className="input" value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option><option>Unpaid</option><option>Partial</option><option>Paid</option></select></label>
      <label style={{ display: 'grid', gap: 4, minWidth: 180, flex: '1 1 200px', fontSize: '.72rem', color: 'var(--text-secondary)' }}>Search<input className="input" value={search} onChange={event => setSearch(event.target.value)} placeholder="Gym, branch, reference…" /></label>
      <button type="button" className="btn btn-secondary" onClick={loadData} title="Refresh results"><RefreshCw size={15} /></button>
    </div>

    {activity.length > 0 && <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 14 }}>
      <div style={{ padding: '1rem 1.1rem', borderBottom: '1px solid var(--border-color)' }}><strong>Successful FitPass activity</strong><div style={{ fontSize: '.75rem', color: 'var(--text-secondary)', marginTop: 3 }}>Actual check-ins in the selected date range; estimated values are not saved or marked as paid.</div></div>
      <div className="table-container"><table><thead><tr><th>Partner branch</th><th>Successful check-ins</th><th>Estimated at default rate</th></tr></thead><tbody>{activity.map(row => <tr key={row.id}><td><strong>{row.name}</strong><small style={{ display: 'block', color: 'var(--text-secondary)', marginTop: 3 }}>{row.gymName}</small></td><td>{number(row.checkInCount)}</td><td>{money(row.estimatedRevenue)}</td></tr>)}</tbody></table></div>
    </div>}

    {chartRows.length > 0 && <div className="card" style={{ padding: '1rem 1.1rem', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><Activity size={16} color="var(--primary)" /><strong>Settlement performance</strong></div>
      <div style={{ height: 250 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={chartRows} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color, #e5e7eb)" /><XAxis dataKey="period" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip formatter={value => money(value)} /><Legend /><Bar dataKey="gross" name="Gross revenue" fill="#0e7490" radius={[4, 4, 0, 0]} /><Bar dataKey="paid" name="Paid to branches" fill="#7c3aed" radius={[4, 4, 0, 0]} /><Bar dataKey="profit" name="Net profit" fill="#16a34a" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
    </div>}

    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '1rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--border-color)' }}><div><strong>Branch settlement records</strong><div style={{ fontSize: '.75rem', color: 'var(--text-secondary)', marginTop: 3}>{`${number(summary.records)} saved records`}</div></div><Building2 size={17} color="var(--text-secondary)" /></div>
      {loading ? <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem' }}><Loader className="spinner" size={40} style={{ color: 'var(--primary-color)' }} /></div> : <div className="table-container"><table><thead><tr><th>Period</th><th>Partner branch</th><th>Check-ins</th><th>Rate / visit</th><th>Gross revenue</th><th>Paid to branch</th><th>Retained</th><th>Net profit</th><th>Status</th><th></th></tr></thead><tbody>
        {displayedRecords.map(row => <tr key={row.id}><td style={{ whiteSpace: 'nowrap' }}>{periodLabel(row)}</td><td><strong>{row.branchName}</strong><small style={{ display: 'block', color: 'var(--text-secondary)', marginTop: 3 }}>{row.gymName}</small></td><td>{number(row.checkInCount)}</td><td>{money(row.ratePerCheckIn)}</td><td style={{ fontWeight: 750 }}>{money(row.grossRevenue)}{row.manualRevenue != null && <small style={{ display: 'block', color: 'var(--text-secondary)' }}>Custom amount</small>}</td><td>{money(row.paidAmount)}</td><td>{money(row.retainedAmount)}</td><td style={{ fontWeight: 800, color: Number(row.netProfit) < 0 ? '#b91c1c' : '#15803d' }}>{money(row.netProfit)}</td><td><span style={statusStyle(row.status)}>{row.status}</span></td><td><button className="btn btn-secondary" onClick={() => openEdit(row)} title="Edit settlement"><Pencil size={14} /></button></td></tr>)}
        {!displayedRecords.length && <tr><td colSpan="10" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No branch payout records match these filters.</td></tr>}
      </tbody></table></div>}
    </div>

    <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit payout · ${editing.branchName}` : 'Create branch settlement'} size="lg">
      <form onSubmit={savePayout}>
        {!editing && <div className="input-group"><label>FitPass-enabled branch *</label><select className="input" required value={form.branchId} onChange={event => setForm({ ...form, branchId: event.target.value })}><option value="">Choose partner branch</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.gymName} · {branch.name}</option>)}</select></div>}
        <div className="form-grid">
          <div className="input-group"><label>Period from *</label><input className="input" type="date" required disabled={Boolean(editing)} value={form.startDate} onChange={event => setForm({ ...form, startDate: event.target.value })} /></div>
          <div className="input-group"><label>Period through *</label><input className="input" type="date" required min={form.startDate} disabled={Boolean(editing)} value={form.endDate} onChange={event => setForm({ ...form, endDate: event.target.value })} /></div>
        </div>
        <div className="form-grid">
          <div className="input-group"><label>Conversion rate · ₹ per successful check-in</label><input className="input" type="number" min="0" step="0.01" value={form.ratePerCheckIn} onChange={event => setForm({ ...form, ratePerCheckIn: event.target.value })} required /></div>
          <div className="input-group"><label>Custom gross revenue · optional</label><input className="input" type="number" min="0" step="0.01" value={form.manualRevenue} onChange={event => setForm({ ...form, manualRevenue: event.target.value })} placeholder={`Auto: ${previewLoading ? 'counting…' : number(previewCount)} check-ins × rate`} /></div>
        </div>
        <div className="form-grid">
          <div className="input-group"><label>Total amount paid to branch</label><input className="input" type="number" min="0" step="0.01" value={form.paidAmount} onChange={event => setForm({ ...form, paidAmount: event.target.value })} required /></div>
          <div className="input-group"><label>Other FitPass costs</label><input className="input" type="number" min="0" step="0.01" value={form.operatingCosts} onChange={event => setForm({ ...form, operatingCosts: event.target.value })} required /></div>
        </div>
        <div className="form-grid">
          <div className="input-group"><label>Payment reference</label><input className="input" value={form.paymentReference} onChange={event => setForm({ ...form, paymentReference: event.target.value })} placeholder="UTR / bank reference" /></div>
          <div className="input-group"><label>Notes</label><input className="input" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Optional settlement note" /></div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '.85rem 1rem', margin: '.25rem 0 1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          <div><small>Successful visits</small><div style={{ fontWeight: 800 }}>{previewLoading && !editing ? '…' : number(editing ? editing.checkInCount : previewCount)}</div></div>
          <div><small>Gross revenue</small><div style={{ fontWeight: 800 }}>{money(estimatedGross)}</div></div>
          <div><small>Retained after payout</small><div style={{ fontWeight: 800 }}>{money(estimatedRetained)}</div></div>
          <div><small>Net profit</small><div style={{ fontWeight: 800, color: estimatedProfit < 0 ? '#b91c1c' : '#15803d' }}>{money(estimatedProfit)}</div></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving || !editing && !form.branchId}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create settlement'}</button></div>
      </form>
    </Modal>
  </div>;
}

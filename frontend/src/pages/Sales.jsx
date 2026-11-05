import { useEffect, useMemo, useState } from 'react';
import API from '../services/api';
import MemberFilterSelect from '../components/MemberFilterSelect';
import ResetFiltersButton from '../components/ResetFiltersButton';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const TYPES = { NEW_MEMBER: 'New member', RENEWAL: 'Renewal', UPGRADE: 'Package upgrade', BALANCE_COLLECTION: 'Balance collection', LEGACY: 'Other payment' };
const COLORS = ['#818cf8', '#34d399', '#fbbf24', '#fb7185', '#38bdf8', '#c084fc', '#2dd4bf'];
const today = new Date();
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
const Sales = () => {
    const [records, setRecords] = useState([]);
    const [branches, setBranches] = useState([]);
    const [staff, setStaff] = useState([]);
    const [filters, setFilters] = useState({ from: monthStart, to: today.toISOString().slice(0, 10), memberId: '', branchId: '', staffId: '', saleType: '', source: '', method: '' });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([API.get('/branches'), API.get('/staff')]).then(([b, s]) => {
            setBranches(Array.isArray(b.data) ? b.data : []);
            setStaff(Array.isArray(s.data) ? s.data : []);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        API.get('/payments/sales-report', { params: { ...filters, timezoneOffset: new Date().getTimezoneOffset() } }).then(({ data }) => setRecords(Array.isArray(data) ? data : [])).catch(() => setRecords([])).finally(() => setLoading(false));
    }, [filters]);

    const sales = records.filter(r => ['NEW_MEMBER', 'RENEWAL', 'UPGRADE'].includes(r.saleType));
    const collections = records.filter(r => r.saleType === 'BALANCE_COLLECTION');
    const bySource = useMemo(() => group(sales, r => r.source || 'Direct / not specified'), [sales]);
    const byMethod = useMemo(() => group(records, r => r.method || 'Not specified'), [records]);
    const byStaff = useMemo(() => group(records, r => r.staffName || 'Unassigned'), [records]);
    const byMonth = useMemo(() => {
        const map = new Map();
        records.forEach(r => { const date = new Date(r.date); const key = date.toLocaleString('en-IN', { month: 'short', year: '2-digit' }); const row = map.get(key) || { month: key, sales: 0, collections: 0, otherPayments: 0 }; if (r.saleType === 'BALANCE_COLLECTION') row.collections += Number(r.amount) || 0; else if (['NEW_MEMBER','RENEWAL','UPGRADE'].includes(r.saleType)) row.sales += Number(r.amount) || 0; else row.otherPayments += Number(r.amount) || 0; map.set(key, row); });
        return [...map.values()].reverse();
    }, [records]);
    const revenue = records.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const set = (key, value) => setFilters(current => ({ ...current, [key]: value }));

    return <div className="fade-in">
        <div style={{ marginBottom: '1.5rem' }}><h2 style={{ fontWeight: 800, marginBottom: 4 }}>Sales & Collections</h2><p style={{ color: 'var(--text-secondary)' }}>Track new memberships, renewals, upgrades, and balance payments by source, staff, branch, and time.</p></div>
        <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 12, marginBottom: 20 }}>
            <label>From<input className="input" type="date" value={filters.from} onChange={e => set('from', e.target.value)} /></label>
            <label>To<input className="input" type="date" value={filters.to} onChange={e => set('to', e.target.value)} /></label>
            <label>Branch<select className="input" value={filters.branchId} onChange={e => set('branchId', e.target.value)}><option value="">All branches</option>{branches.map(b => <option key={b._id || b.id} value={b._id || b.id}>{b.name}</option>)}</select></label>
            <label>Staff<select className="input" value={filters.staffId} onChange={e => set('staffId', e.target.value)}><option value="">All staff</option>{staff.map(s => <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>)}</select></label>
            <label>Activity<select className="input" value={filters.saleType} onChange={e => set('saleType', e.target.value)}><option value="">All activity</option>{Object.entries(TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>Source / mode<select className="input" value={filters.source} onChange={e => set('source', e.target.value)}><option value="">All sources</option>{['Offline','Online','Referral','Walk-in','Instagram','Facebook','Google','WhatsApp','Other'].map(v => <option key={v}>{v}</option>)}</select></label>
            <label>Payment method<select className="input" value={filters.method} onChange={e => set('method', e.target.value)}><option value="">All methods</option>{[...new Set(records.map(record => record.method).filter(Boolean))].sort().map(method => <option key={method}>{method}</option>)}</select></label>
            <MemberFilterSelect label="Member" value={filters.memberId} onChange={memberId => set('memberId', memberId)} />
            <ResetFiltersButton onClick={() => setFilters({ from: monthStart, to: today.toISOString().slice(0, 10), memberId: '', branchId: '', staffId: '', saleType: '', source: '', method: '' })} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14, marginBottom: 20 }}>
            <Metric title="Sale events" value={sales.length} /><Metric title="New members" value={sales.filter(r => r.saleType === 'NEW_MEMBER').length} /><Metric title="Renewals & upgrades" value={sales.filter(r => ['RENEWAL','UPGRADE'].includes(r.saleType)).length} /><Metric title="Collections" value={collections.length} /><Metric title="Other payments" value={records.filter(r => r.saleType === 'LEGACY').length} /><Metric title="Collected" value={`₹${revenue.toLocaleString('en-IN')}`} />
        </div>
        {loading ? <div className="spinner" /> : <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, marginBottom: 18 }}>
                <Chart title="Sales, collections, and other payments over time"><ResponsiveContainer width="100%" height="100%"><BarChart data={byMonth}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" /><YAxis /><Tooltip /><Bar dataKey="sales" name="New, renewal, and upgrade payments" fill="#818cf8" radius={[4,4,0,0]} /><Bar dataKey="collections" name="Balance collected" fill="#34d399" radius={[4,4,0,0]} /><Bar dataKey="otherPayments" name="Other payments" fill="#94a3b8" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></Chart>
                <Chart title="New sales by source / mode"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={bySource} dataKey="value" nameKey="name" outerRadius={92} label>{bySource.map((r,i) => <Cell key={r.name} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></Chart>
                <Chart title="Payment method mix"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={byMethod} dataKey="value" nameKey="name" outerRadius={92} label>{byMethod.map((r,i) => <Cell key={r.name} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></Chart>
                <Chart title="Activity by staff"><ResponsiveContainer width="100%" height="100%"><BarChart data={byStaff} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" /><YAxis type="category" dataKey="name" width={110} /><Tooltip /><Bar dataKey="value" name="Transactions" fill="#fbbf24" radius={[0,4,4,0]} /></BarChart></ResponsiveContainer></Chart>
            </div>
            <div className="card" style={{ overflowX: 'auto', padding: 0 }}><table><thead><tr><th>Date</th><th>Member ID</th><th>Member</th><th>Phone</th><th>Activity</th><th>Source</th><th>Handled by</th><th>Branch</th><th>Method</th><th>Amount</th></tr></thead><tbody>{records.map(r => <tr key={r._id || r.id}><td>{new Date(r.date).toLocaleDateString()}</td><td>{r.memberId?.registrationNumber || '—'}</td><td>{r.memberId?.name || 'Member'}</td><td>{r.memberId?.phone || '—'}</td><td>{TYPES[r.saleType] || r.saleType}</td><td>{r.source || '—'}</td><td>{r.staffName || '—'}</td><td>{branches.find(b => (b._id || b.id) === r.branchId)?.name || '—'}</td><td>{r.method}</td><td>₹{Number(r.amount || 0).toLocaleString('en-IN')}</td></tr>)}{records.length === 0 && <tr><td colSpan="10" style={{ textAlign: 'center', padding: 24 }}>No activity in this date range.</td></tr>}</tbody></table></div>
        </>}
    </div>;
};
function group(rows, keyFn) { const map = new Map(); rows.forEach(row => { const name = keyFn(row); map.set(name, (map.get(name) || 0) + 1); }); return [...map].map(([name,value]) => ({ name, value })); }
function Metric({ title, value }) { return <div className="card" style={{ padding: '1.1rem' }}><div style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase' }}>{title}</div><strong style={{ display: 'block', fontSize: 26, marginTop: 5 }}>{value}</strong></div>; }
function Chart({ title, children }) { return <div className="card"><h3 style={{ marginBottom: 14 }}>{title}</h3><div style={{ height: 280 }}>{children}</div></div>; }
export default Sales;

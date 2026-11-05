import { useEffect, useMemo, useState, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPayment, getMemberPayments } from '../services/apiService';
import Modal from '../components/Modal';
import MemberFilterSelect from '../components/MemberFilterSelect';
import ResetFiltersButton from '../components/ResetFiltersButton';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const SALE_TYPES = {
    NEW_MEMBER: 'New member',
    RENEWAL: 'Renewal',
    UPGRADE: 'Package upgrade',
    BALANCE_COLLECTION: 'Balance collection',
    LEGACY: 'Other payment'
};
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f97316', '#64748b', '#06b6d4'];
const monthStartValue = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
const dateValue = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const Payments = () => {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const today = new Date();
    const currentStaffId = String(user?._id || user?.id || '');
    const [payments, setPayments] = useState([]);
    const [members, setMembers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedMemberPayments, setSelectedMemberPayments] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [period, setPeriod] = useState('month');
    const [filterMonth, setFilterMonth] = useState(today.getMonth());
    const [filterYear, setFilterYear] = useState(today.getFullYear());
    const [fromDate, setFromDate] = useState(monthStartValue(today));
    const [toDate, setToDate] = useState(dateValue(today));
    const [filters, setFilters] = useState({ memberId: '', branchId: '', staffId: '', method: '', saleType: '', source: '' });
    const [formData, setFormData] = useState({ memberId: '', amount: '', method: 'Cash', salesStaffId: '' });

    const currentDateRange = useMemo(() => {
        if (period === 'custom') return { from: fromDate, to: toDate };
        if (period === 'year') return { from: `${filterYear}-01-01`, to: `${filterYear}-12-31` };
        return { from: monthStartValue(new Date(filterYear, filterMonth, 1)), to: dateValue(new Date(filterYear, filterMonth + 1, 0)) };
    }, [period, fromDate, toDate, filterYear, filterMonth]);

    useEffect(() => {
        if (currentStaffId) setFormData(current => current.salesStaffId ? current : { ...current, salesStaffId: currentStaffId });
    }, [currentStaffId]);

    const fetchPayments = useCallback(async () => {
        setLoading(true);
        try {
            const params = { ...currentDateRange, ...filters, timezoneOffset: new Date().getTimezoneOffset() };
            Object.keys(params).forEach(key => { if (params[key] === '') delete params[key]; });
            const { data } = await API.get('/payments/sales-report', { params });
            setPayments(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error fetching payment ledger:', error);
            setPayments([]);
        } finally { setLoading(false); }
    }, [currentDateRange, filters]);

    useEffect(() => {
        API.get('/branches').then(({ data }) => setBranches(Array.isArray(data) ? data : (data?.branches || []))).catch(() => setBranches([]));
        API.get('/staff').then(({ data }) => setStaff(Array.isArray(data) ? data : (data?.staff || data?.data || []))).catch(() => setStaff([]));
    }, []);

    useEffect(() => { fetchPayments(); }, [fetchPayments]);

    const setFilter = (key, value) => setFilters(current => ({ ...current, [key]: value }));
    const resetFilters = () => {
        const now = new Date();
        setPeriod('month');
        setFilterMonth(now.getMonth());
        setFilterYear(now.getFullYear());
        setFromDate(monthStartValue(now));
        setToDate(dateValue(now));
        setFilters({ memberId: '', branchId: '', staffId: '', method: '', saleType: '', source: '' });
    };

    const totalAmount = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const uniqueMembers = new Set(payments.map(payment => String(payment.memberId?.id || payment.memberId?._id || payment.memberId)).filter(Boolean)).size;
    const averagePayment = payments.length ? totalAmount / payments.length : 0;
    const timeline = useMemo(() => {
        const map = new Map();
        payments.forEach(payment => {
            const date = new Date(payment.date);
            const key = currentDateRange.from && currentDateRange.to && (new Date(currentDateRange.to) - new Date(currentDateRange.from)) > 60 * 86_400_000
                ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                : dateValue(date);
            const row = map.get(key) || { key, date: key.length === 7 ? new Date(`${key}-01T12:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) : new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), NEW_MEMBER: 0, RENEWAL: 0, UPGRADE: 0, BALANCE_COLLECTION: 0, LEGACY: 0 };
            const type = SALE_TYPES[payment.saleType] ? payment.saleType : 'LEGACY';
            row[type] += Number(payment.amount) || 0;
            map.set(key, row);
        });
        return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
    }, [payments, currentDateRange]);
    const byMethod = useMemo(() => groupTotals(payments, payment => payment.method || 'Not specified'), [payments]);
    const byCollector = useMemo(() => groupTotals(payments, payment => payment.staffName || 'Unassigned'), [payments]).sort((a, b) => b.amount - a.amount).slice(0, 12);

    const refreshAfterPayment = async () => {
        await fetchPayments();
    };

    const handleAddPayment = async event => {
        event.preventDefault();
        try {
            await createPayment({
                memberId: formData.memberId,
                amount: Number(formData.amount),
                method: formData.method,
                paymentMethod: formData.method,
                salesStaffId: formData.salesStaffId || undefined
            });
            setIsModalOpen(false);
            setFormData({ memberId: '', amount: '', method: 'Cash', salesStaffId: currentStaffId });
            await refreshAfterPayment();
        } catch (error) {
            alert(error.response?.data?.message || 'Error recording payment');
        }
    };

    const viewHistory = async (payment) => {
        const memberId = payment.memberId?.id || payment.memberId?._id || payment.memberId;
        if (!memberId) return;
        setHistoryLoading(true);
        setSelectedMemberPayments({ memberName: payment.memberId?.name || 'Member', registrationNumber: payment.memberId?.registrationNumber || '', phone: payment.memberId?.phone || '', history: [] });
        try {
            const history = await getMemberPayments(memberId);
            setSelectedMemberPayments({ memberName: payment.memberId?.name || 'Member', registrationNumber: payment.memberId?.registrationNumber || '', phone: payment.memberId?.phone || '', history: Array.isArray(history) ? history : [] });
        } catch {
            alert('Error fetching payment history');
        } finally { setHistoryLoading(false); }
    };

    const availableYears = Array.from({ length: 11 }, (_, index) => today.getFullYear() - index);
    if (loading && payments.length === 0) return <div className="spinner" />;

    return <div className="fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <div><h2 style={{ marginBottom: 4 }}>Payments Management</h2><p style={{ color: 'var(--text-secondary)', margin: 0 }}>Filter collected payments by date, member, branch, collector, type, source, and method.</p></div>
            <div style={{ display: 'flex', gap: '.75rem' }}><button onClick={() => navigate('/reports')} className="btn btn-secondary">Export</button><button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>+ Record Payment</button></div>
        </div>

        <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 12, marginBottom: 18 }}>
            <label style={{ display: 'grid', gap: 5 }}>Timeline<select className="input" value={period} onChange={event => setPeriod(event.target.value)}><option value="month">Month</option><option value="year">Year</option><option value="custom">Custom dates</option></select></label>
            {period !== 'custom' && <label style={{ display: 'grid', gap: 5 }}>Year<select className="input" value={filterYear} onChange={event => setFilterYear(Number(event.target.value))}>{availableYears.map(year => <option key={year}>{year}</option>)}</select></label>}
            {period === 'month' && <label style={{ display: 'grid', gap: 5 }}>Month<select className="input" value={filterMonth} onChange={event => setFilterMonth(Number(event.target.value))}>{Array.from({ length: 12 }, (_, month) => <option key={month} value={month}>{new Date(2000, month, 1).toLocaleString(undefined, { month: 'long' })}</option>)}</select></label>}
            {period === 'custom' && <><label style={{ display: 'grid', gap: 5 }}>From<input className="input" type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} /></label><label style={{ display: 'grid', gap: 5 }}>To<input className="input" type="date" value={toDate} onChange={event => setToDate(event.target.value)} /></label></>}
            <label style={{ display: 'grid', gap: 5 }}>Branch<select className="input" value={filters.branchId} onChange={event => setFilter('branchId', event.target.value)}><option value="">All branches</option>{branches.map(branch => <option key={branch.id || branch._id} value={branch.id || branch._id}>{branch.name}</option>)}</select></label>
            <label style={{ display: 'grid', gap: 5 }}>Collected by<select className="input" value={filters.staffId} onChange={event => setFilter('staffId', event.target.value)}><option value="">All staff</option>{staff.map(person => <option key={person.id || person._id} value={person.id || person._id}>{person.name}{person.role === 'trainer' ? ' (Trainer)' : ''}</option>)}</select></label>
            <MemberFilterSelect label="Member" value={filters.memberId} onChange={memberId => setFilter('memberId', memberId)} />
            <label style={{ display: 'grid', gap: 5 }}>Payment type<select className="input" value={filters.saleType} onChange={event => setFilter('saleType', event.target.value)}><option value="">All payment types</option>{Object.entries(SALE_TYPES).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label>
            <label style={{ display: 'grid', gap: 5 }}>Source / mode<select className="input" value={filters.source} onChange={event => setFilter('source', event.target.value)}><option value="">All sources</option>{['Offline', 'Online', 'Referral', 'Walk-in', 'Instagram', 'Facebook', 'Google', 'WhatsApp', 'Other'].map(source => <option key={source}>{source}</option>)}</select></label>
            <label style={{ display: 'grid', gap: 5 }}>Payment method<select className="input" value={filters.method} onChange={event => setFilter('method', event.target.value)}><option value="">All methods</option>{['Cash', 'UPI', 'Card', 'Bank Transfer', 'Credit Card', 'Razorpay / Online'].map(method => <option key={method}>{method}</option>)}</select></label>
            <ResetFiltersButton onClick={resetFilters} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14, marginBottom: 18 }}>
            <Metric title="Collected in period" value={`₹${totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`} />
            <Metric title="Payment transactions" value={payments.length} />
            <Metric title="Members paid" value={uniqueMembers} />
            <Metric title="Average payment" value={`₹${averagePayment.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`} />
            <Metric title="Balance collections" value={payments.filter(payment => payment.saleType === 'BALANCE_COLLECTION').length} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, marginBottom: 18 }}>
            <Chart title="Collected amount over time"><ResponsiveContainer width="100%" height="100%"><BarChart data={timeline}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" /><YAxis /><Tooltip formatter={value => `₹${Number(value).toLocaleString('en-IN')}`} /><Legend /><Bar dataKey="NEW_MEMBER" name="New members" stackId="amount" fill="#6366f1" /><Bar dataKey="RENEWAL" name="Renewals" stackId="amount" fill="#10b981" /><Bar dataKey="UPGRADE" name="Upgrades" stackId="amount" fill="#f59e0b" /><Bar dataKey="BALANCE_COLLECTION" name="Balance collections" stackId="amount" fill="#f97316" /><Bar dataKey="LEGACY" name="Other payments" stackId="amount" fill="#64748b" /></BarChart></ResponsiveContainer></Chart>
            <Chart title="Payment methods"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={byMethod} dataKey="amount" nameKey="name" outerRadius={100} label>{byMethod.map((row, index) => <Cell key={row.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={value => `₹${Number(value).toLocaleString('en-IN')}`} /><Legend /></PieChart></ResponsiveContainer></Chart>
            <Chart title="Collected by staff"><ResponsiveContainer width="100%" height="100%"><BarChart data={byCollector} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" /><YAxis type="category" dataKey="name" width={110} /><Tooltip formatter={value => `₹${Number(value).toLocaleString('en-IN')}`} /><Bar dataKey="amount" name="Collected" fill="#0ea5e9" radius={[0,4,4,0]} /></BarChart></ResponsiveContainer></Chart>
        </div>

        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><h3 style={{ margin: 0 }}>Payment ledger</h3><small style={{ color: 'var(--text-secondary)' }}>{payments.length} transaction(s) · {currentDateRange.from} to {currentDateRange.to}</small></div>{loading && <span style={{ color: 'var(--text-secondary)' }}>Updating...</span>}</div>
            <table><thead><tr><th>Date</th><th>Member ID</th><th>Member</th><th>Phone</th><th>Type</th><th>Amount</th><th>Method</th><th>Source</th><th>Collected by</th><th>Branch</th><th>Actions</th></tr></thead><tbody>
                {payments.map(payment => <tr key={payment.id || payment._id}><td>{new Date(payment.date).toLocaleDateString()}</td><td>{payment.memberId?.registrationNumber || '—'}</td><td>{payment.memberId?.name || 'Deleted member'}</td><td>{payment.memberId?.phone || '—'}</td><td>{SALE_TYPES[payment.saleType] || payment.saleType || 'Other payment'}</td><td style={{ fontWeight: 700 }}>₹{Number(payment.amount || 0).toLocaleString('en-IN')}</td><td>{payment.method || '—'}</td><td>{payment.source || '—'}</td><td>{payment.staffName || '—'}</td><td>{branches.find(branch => String(branch.id || branch._id) === String(payment.branchId))?.name || '—'}</td><td><button className="btn btn-secondary" style={{ fontSize: '.78rem', padding: '.35rem .65rem' }} onClick={() => viewHistory(payment)}>History</button></td></tr>)}
                {!payments.length && <tr><td colSpan="11" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>No payment records match this timeline and these filters.</td></tr>}
            </tbody></table>
        </div>

        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record New Payment">
            <form onSubmit={handleAddPayment}>
                <div className="input-group"><MemberFilterSelect label="Select member" includeAll={false} required value={formData.memberId} onSelectMember={selected => {
                    if (!selected) return;
                    setMembers(current => [...new Map([...current, selected].map(member => [String(member._id || member.id), member])).values()]);
                    const due = Math.max(0, Number(selected.planPrice || selected.planId?.price || 0) - Number(selected.paidAmount || 0));
                    setFormData(current => ({ ...current, amount: due > 0 ? due : '' }));
                }} onChange={memberId => setFormData(current => ({ ...current, memberId }))} /></div>
                {formData.memberId && (() => {
                    const selected = members.find(member => String(member._id || member.id) === String(formData.memberId));
                    if (!selected) return null;
                    const planPrice = Number(selected.planPrice || selected.planId?.price || 0);
                    const paid = Number(selected.paidAmount || 0);
                    const due = Math.max(0, planPrice - paid);
                    return <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: '.85rem', marginBottom: '1rem' }}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: '.5rem', fontSize: '.82rem' }}><div><small>Plan</small><strong style={{ display: 'block' }}>{selected.planId?.name || 'Custom'}</strong></div><div><small>Agreed fee</small><strong style={{ display: 'block' }}>₹{planPrice.toLocaleString('en-IN')}</strong></div><div><small>Paid so far</small><strong style={{ display: 'block', color: '#10b981' }}>₹{paid.toLocaleString('en-IN')}</strong></div><div><small>Outstanding due</small><strong style={{ display: 'block', color: due ? '#ef4444' : '#10b981' }}>{due ? `₹${due.toLocaleString('en-IN')} due` : 'Settled'}</strong></div></div></div>;
                })()}
                <div className="input-group"><label>Amount to collect (₹)</label><input className="input" type="number" min="1" value={formData.amount} onChange={event => setFormData({ ...formData, amount: event.target.value })} required /></div>
                <div className="input-group"><label>Payment method</label><select className="input" value={formData.method} onChange={event => setFormData({ ...formData, method: event.target.value })} required><option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option></select></div>
                <div className="input-group"><label htmlFor="payment-collected-by">Collected by (staff or trainer) *</label><select id="payment-collected-by" className="input" required value={formData.salesStaffId || currentStaffId} onChange={event => setFormData({ ...formData, salesStaffId: event.target.value })}><option value="">Choose collector</option>{currentStaffId && <option value={currentStaffId}>Current user: {user?.name || 'Me'}</option>}{staff.filter(person => String(person._id || person.id) !== currentStaffId).map(person => <option key={person.id || person._id} value={person._id || person.id}>{person.name}{person.role === 'trainer' ? ' (Trainer)' : ''}</option>)}</select></div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Submit Payment</button>
            </form>
        </Modal>

        <Modal isOpen={!!selectedMemberPayments} onClose={() => setSelectedMemberPayments(null)} title={`Payment History - ${selectedMemberPayments?.memberName}`}>
            {selectedMemberPayments && <p style={{ marginTop: 0, color: 'var(--text-secondary)' }}>{selectedMemberPayments.registrationNumber} {selectedMemberPayments.phone && `· ${selectedMemberPayments.phone}`}</p>}
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>{historyLoading ? <div className="spinner" /> : selectedMemberPayments?.history.length ? <table><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Method</th><th>Collected by</th></tr></thead><tbody>{selectedMemberPayments.history.map(payment => <tr key={payment.id || payment._id}><td>{new Date(payment.date).toLocaleDateString()}</td><td>{SALE_TYPES[payment.saleType] || 'Other payment'}</td><td>₹{Number(payment.amount || 0).toLocaleString('en-IN')}</td><td>{payment.method}</td><td>{payment.staffName || '—'}</td></tr>)}</tbody></table> : <p>No payment records found.</p>}</div>
        </Modal>
    </div>;
};

function groupTotals(rows, nameFn) {
    const map = new Map();
    rows.forEach(row => {
        const name = nameFn(row);
        const current = map.get(name) || { name, amount: 0, transactions: 0 };
        current.amount += Number(row.amount) || 0;
        current.transactions += 1;
        map.set(name, current);
    });
    return [...map.values()];
}
function Metric({ title, value }) { return <div className="card" style={{ padding: '1.1rem' }}><div style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase' }}>{title}</div><strong style={{ display: 'block', fontSize: 25, marginTop: 5 }}>{value}</strong></div>; }
function Chart({ title, children }) { return <div className="card"><h3 style={{ marginBottom: 14 }}>{title}</h3><div style={{ height: 290 }}>{children}</div></div>; }

export default Payments;

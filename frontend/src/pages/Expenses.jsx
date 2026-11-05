import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import API from '../services/api';
import Modal from '../components/Modal';
import { AuthContext } from '../context/AuthContext';
import ResetFiltersButton from '../components/ResetFiltersButton';

const COLORS = ['#818cf8', '#34d399', '#fbbf24', '#fb7185', '#38bdf8', '#c084fc', '#2dd4bf', '#f97316'];
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const blankExpense = () => ({ title: '', amount: '', category: '', description: '', date: localDate(), branchId: '' });

const Expenses = () => {
    const navigate = useNavigate();
    const { user, selectedBranchId } = useContext(AuthContext);
    const [expenses, setExpenses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [formData, setFormData] = useState(blankExpense);
    const [categoryName, setCategoryName] = useState('');
    const [editingCategory, setEditingCategory] = useState(null);
    const [notice, setNotice] = useState('');
    const [filters, setFilters] = useState({ period: 'month', month: String(new Date().getMonth()), year: String(new Date().getFullYear()), from: '', to: '', category: '', branchId: '' });

    const fetchExpenses = useCallback(async () => {
        try {
            const { data } = await API.get('/expenses');
            setExpenses(Array.isArray(data) ? data : (data?.data || []));
        } catch (error) {
            console.error('Error fetching expenses:', error);
            setExpenses([]);
        } finally { setLoading(false); }
    }, []);

    const fetchCategories = useCallback(async () => {
        try {
            const { data } = await API.get('/expenses/categories');
            setCategories(Array.isArray(data) ? data : []);
        } catch (error) { console.error('Error fetching expense categories:', error); }
    }, []);

    useEffect(() => {
        fetchExpenses();
        fetchCategories();
        API.get('/branches').then(({ data }) => setBranches(Array.isArray(data) ? data : [])).catch(() => setBranches([]));
    }, [fetchExpenses, fetchCategories]);

    const visibleExpenses = useMemo(() => {
        const now = new Date();
        let start = null;
        let end = null;
        if (filters.period === 'month') {
            start = new Date(Number(filters.year), Number(filters.month), 1);
            end = new Date(Number(filters.year), Number(filters.month) + 1, 1);
        } else if (filters.period === 'lastMonth') {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (filters.period === 'year') {
            start = new Date(Number(filters.year), 0, 1);
            end = new Date(Number(filters.year) + 1, 0, 1);
        } else if (filters.period === 'custom') {
            start = filters.from ? new Date(`${filters.from}T00:00:00`) : null;
            end = filters.to ? new Date(`${filters.to}T00:00:00`) : null;
            if (end) end.setDate(end.getDate() + 1);
        }
        return expenses.filter(expense => {
            const date = new Date(expense.date);
            const inDateRange = (!start || date >= start) && (!end || date < end);
            const inCategory = !filters.category || expense.category === filters.category;
            const branch = String(expense.branchId?._id || expense.branchId || '');
            const inBranch = !filters.branchId || branch === filters.branchId;
            return inDateRange && inCategory && inBranch;
        });
    }, [expenses, filters]);

    const monthlyData = useMemo(() => {
        const rows = new Map();
        visibleExpenses.forEach(expense => {
            const date = new Date(expense.date);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const label = date.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
            const row = rows.get(key) || { month: label, amount: 0 };
            row.amount += Number(expense.amount) || 0;
            rows.set(key, row);
        });
        return [...rows.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, row]) => row);
    }, [visibleExpenses]);

    const categoryData = useMemo(() => {
        const rows = new Map();
        visibleExpenses.forEach(expense => rows.set(expense.category, (rows.get(expense.category) || 0) + (Number(expense.amount) || 0)));
        return [...rows].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
    }, [visibleExpenses]);
    const total = visibleExpenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
    const years = [...new Set([new Date().getFullYear(), ...expenses.map(item => new Date(item.date).getFullYear())])].sort((a, b) => b - a);
    const updateFilter = (key, value) => setFilters(current => ({ ...current, [key]: value }));
    const currentBranch = user?.branchId || selectedBranchId || '';

    const openExpenseForm = () => {
        setFormData({ ...blankExpense(), branchId: currentBranch });
        setNotice('');
        setShowExpenseModal(true);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setNotice('');
        try {
            await API.post('/expenses', { ...formData, amount: Number(formData.amount), branchId: formData.branchId || null });
            setShowExpenseModal(false);
            setFormData(blankExpense());
            await fetchExpenses();
        } catch (error) { setNotice(error.response?.data?.message || 'Could not save this expense.'); }
    };

    const addCategory = async (event) => {
        event.preventDefault();
        try {
            await API.post('/expenses/categories', { name: categoryName.trim() });
            setCategoryName('');
            await fetchCategories();
        } catch (error) { setNotice(error.response?.data?.message || 'Could not add this category.'); }
    };

    const saveCategory = async (category) => {
        try {
            await API.put(`/expenses/categories/${category.id}`, { name: category.draft.trim() });
            setEditingCategory(null);
            await Promise.all([fetchCategories(), fetchExpenses()]);
        } catch (error) { setNotice(error.response?.data?.message || 'Could not rename this category.'); }
    };

    const removeCategory = async (category) => {
        try {
            await API.delete(`/expenses/categories/${category.id}`);
            await fetchCategories();
        } catch (error) { setNotice(error.response?.data?.message || 'Could not remove this category.'); }
    };

    return <div className="fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            <div><h1 style={{ fontSize: '1.875rem', fontWeight: 750, color: 'var(--text-primary)', marginBottom: 4 }}>Expenses</h1><p style={{ color: 'var(--text-secondary)' }}>See operating costs by time, category, and branch.</p></div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => { setNotice(''); setShowCategoryModal(true); }} className="btn btn-secondary"><Pencil size={16} /> Manage categories</button>
                <button onClick={() => navigate('/reports')} className="btn btn-secondary">Export</button>
                <button onClick={openExpenseForm} className="btn btn-primary"><Plus size={17} /> Add expense</button>
            </div>
        </div>

        <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 12, marginBottom: 16 }}>
            <label style={filterLabel}>Date range<select className="input" value={filters.period} onChange={e => updateFilter('period', e.target.value)}><option value="month">Month</option><option value="lastMonth">Last month</option><option value="year">Year</option><option value="custom">Custom dates</option><option value="all">All time</option></select></label>
            {(filters.period === 'month' || filters.period === 'year') && <label style={filterLabel}>Year<select className="input" value={filters.year} onChange={e => updateFilter('year', e.target.value)}>{years.map(year => <option key={year}>{year}</option>)}</select></label>}
            {filters.period === 'month' && <label style={filterLabel}>Month<select className="input" value={filters.month} onChange={e => updateFilter('month', e.target.value)}>{Array.from({ length: 12 }, (_, index) => <option key={index} value={index}>{new Date(2000, index, 1).toLocaleString('en-IN', { month: 'long' })}</option>)}</select></label>}
            {filters.period === 'custom' && <><label style={filterLabel}>From<input className="input" type="date" value={filters.from} onChange={e => updateFilter('from', e.target.value)} /></label><label style={filterLabel}>To<input className="input" type="date" value={filters.to} onChange={e => updateFilter('to', e.target.value)} /></label></>}
            <label style={filterLabel}>Category<select className="input" value={filters.category} onChange={e => updateFilter('category', e.target.value)}><option value="">All categories</option>{categories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}</select></label>
            <label style={filterLabel}>Branch<select className="input" value={filters.branchId || currentBranch} disabled={Boolean(currentBranch)} onChange={e => updateFilter('branchId', e.target.value)}><option value="">All branches</option>{branches.map(branch => <option key={branch._id || branch.id} value={branch._id || branch.id}>{branch.name}</option>)}</select></label>
            <ResetFiltersButton onClick={() => setFilters({ period: 'month', month: String(new Date().getMonth()), year: String(new Date().getFullYear()), from: '', to: '', category: '', branchId: '' })} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14, marginBottom: 16 }}>
            <Metric title="Total expenses" value={`₹${total.toLocaleString('en-IN')}`} />
            <Metric title="Expense records" value={visibleExpenses.length} />
            <Metric title="Categories used" value={categoryData.length} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, marginBottom: 16 }}>
            <Chart title="Expenses over time"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={value => [`₹${Number(value).toLocaleString('en-IN')}`, 'Expense']} /><Bar dataKey="amount" name="Expenses" fill="#818cf8" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></Chart>
            <Chart title="Spend by category"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categoryData} dataKey="amount" nameKey="name" outerRadius={94} label>{categoryData.map((row, index) => <Cell key={row.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={value => `₹${Number(value).toLocaleString('en-IN')}`} /><Legend /></PieChart></ResponsiveContainer></Chart>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'auto' }}><div className="table-container"><table><thead><tr><th>Date</th><th>Title</th><th>Category</th><th>Branch</th><th>Amount</th><th>Actions</th></tr></thead><tbody>
            {loading ? <tr><td colSpan="6" style={{ textAlign: 'center', padding: 28 }}>Loading expenses…</td></tr> : visibleExpenses.length === 0 ? <tr><td colSpan="6" style={{ textAlign: 'center', padding: 28, color: 'var(--text-secondary)' }}>No expenses match these filters.</td></tr> : visibleExpenses.map(expense => <tr key={expense._id || expense.id}>
                <td>{new Date(expense.date).toLocaleDateString()}</td><td style={{ fontWeight: 600 }}>{expense.title}<div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{expense.description}</div></td>
                <td><span style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid var(--border-color)', background: 'rgba(148,163,184,0.14)', color: 'var(--text-primary)', fontSize: 12, fontWeight: 600 }}>{expense.category}</span></td>
                <td>{branches.find(branch => (branch._id || branch.id) === (expense.branchId?._id || expense.branchId))?.name || '—'}</td>
                <td style={{ color: 'var(--danger-color)', fontWeight: 700 }}>₹{Number(expense.amount).toLocaleString('en-IN')}</td>
                <td><button className="btn btn-danger" aria-label={`Delete ${expense.title}`} style={{ padding: 7 }} onClick={() => deleteExpense(expense._id || expense.id, fetchExpenses)}><Trash2 size={16} /></button></td>
            </tr>)}
        </tbody></table></div></div>

        <Modal isOpen={showExpenseModal} onClose={() => setShowExpenseModal(false)} title="Add expense">
            <form onSubmit={handleSubmit}>
                <Field label="Title"><input className="input" required maxLength="100" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Monthly rent" /></Field>
                <div className="form-grid"><Field label="Amount (₹)"><input className="input" required type="number" min="0" step="0.01" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} /></Field><Field label="Date"><input className="input" required type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} /></Field></div>
                <Field label="Category"><select className="input" required value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}><option value="">Select category</option>{categories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}</select></Field>
                {(!currentBranch && branches.length > 0) && <Field label="Branch"><select className="input" value={formData.branchId} onChange={e => setFormData({ ...formData, branchId: e.target.value })}><option value="">No branch / shared</option>{branches.map(branch => <option key={branch._id || branch.id} value={branch._id || branch.id}>{branch.name}</option>)}</select></Field>}
                <Field label="Description (optional)"><textarea className="input" rows="3" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} /></Field>
                {notice && <p role="alert" style={{ color: '#fb7185' }}>{notice}</p>}
                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 12 }}>Save expense</button>
            </form>
        </Modal>

        <Modal isOpen={showCategoryModal} onClose={() => setShowCategoryModal(false)} title="Expense categories">
            <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>Category names are saved for this gym. Renaming also updates the category on existing expenses.</p>
            <form onSubmit={addCategory} style={{ display: 'flex', gap: 8, marginBottom: 16 }}><input className="input" value={categoryName} maxLength="50" onChange={e => setCategoryName(e.target.value)} placeholder="New category name" required /><button className="btn btn-primary" type="submit"><Plus size={16} /> Add</button></form>
            {notice && <p role="alert" style={{ color: '#fb7185' }}>{notice}</p>}
            <div style={{ display: 'grid', gap: 8, maxHeight: 340, overflow: 'auto' }}>{categories.map(category => <div key={category.id} style={{ display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--border-color)', padding: '8px 0' }}>
                {editingCategory?.id === category.id ? <><input className="input" value={editingCategory.draft} maxLength="50" onChange={e => setEditingCategory({ ...editingCategory, draft: e.target.value })} /><button className="btn btn-primary" onClick={() => saveCategory(editingCategory)}>Save</button><button className="btn btn-secondary" onClick={() => setEditingCategory(null)}>Cancel</button></> : <><span style={{ flex: 1, color: 'var(--text-primary)', fontWeight: 600 }}>{category.name}</span><button className="btn btn-secondary" aria-label={`Rename ${category.name}`} onClick={() => { setNotice(''); setEditingCategory({ ...category, draft: category.name }); }}><Pencil size={15} /></button><button className="btn btn-danger" aria-label={`Remove ${category.name}`} onClick={() => removeCategory(category)}><Trash2 size={15} /></button></>}
            </div>)}</div>
        </Modal>
    </div>;
};

async function deleteExpense(id, refresh) {
    if (!window.confirm('Delete this expense record?')) return;
    try { await API.delete(`/expenses/${id}`); refresh(); } catch (error) { window.alert(error.response?.data?.message || 'Could not delete this expense.'); }
}
function Metric({ title, value }) { return <div className="card" style={{ padding: '1rem 1.2rem' }}><div style={{ color: 'var(--text-secondary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em' }}>{title}</div><strong style={{ display: 'block', fontSize: 25, marginTop: 5 }}>{value}</strong></div>; }
function Chart({ title, children }) { return <section className="card"><h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{title}</h3><div style={{ height: 260 }}>{children}</div></section>; }
function Field({ label, children }) { return <div className="input-group"><label>{label}</label>{children}</div>; }
const filterLabel = { display: 'grid', gap: 6, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 };

export default Expenses;

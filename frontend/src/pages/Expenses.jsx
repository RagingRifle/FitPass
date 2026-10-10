import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import Modal from '../components/Modal';
import { Trash2 } from 'lucide-react';

const Expenses = () => {
    const navigate = useNavigate();
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        amount: '',
        category: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
    });

    const categories = ['Rent', 'Electricity', 'Maintenance', 'Salaries', 'Equipment', 'Marketing', 'Others'];

    const fetchExpenses = useCallback(async () => {
        try {
            const { data } = await API.get('/expenses');
            const list = Array.isArray(data) ? data : (data?.data || []);
            setExpenses(list);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching expenses:', error);
            setExpenses([]);
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchExpenses();
    }, [fetchExpenses]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await API.post('/expenses', formData);
            setShowModal(false);
            setFormData({
                title: '',
                amount: '',
                category: '',
                description: '',
                date: new Date().toISOString().split('T')[0]
            });
            fetchExpenses();
        } catch (error) {
            console.error('Error creating expense:', error);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this expense?')) {
            try {
                await API.delete(`/expenses/${id}`);
                fetchExpenses();
            } catch (error) {
                console.error('Error deleting expense:', error);
            }
        }
    };

    const safeExpenses = Array.isArray(expenses) ? expenses : [];

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: '700', color: 'var(--text-primary)' }}>Expenses</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Track and manage your gym's operational costs.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button onClick={() => navigate('/reports')} className="btn btn-secondary" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary-color)' }}>
                         Export
                    </button>
                    <button onClick={() => setShowModal(true)} className="btn btn-primary">
                        + Add Expense
                    </button>
                </div>
            </div>

            <div className="card" style={{ padding: 0 }}>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Title</th>
                                <th>Category</th>
                                <th>Amount</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {safeExpenses.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                        No expenses recorded yet.
                                    </td>
                                </tr>
                            ) : (
                                safeExpenses.map((expense) => (
                                    <tr key={expense._id}>
                                        <td>{new Date(expense.date).toLocaleDateString()}</td>
                                        <td style={{ fontWeight: '600' }}>{expense.title}</td>
                                        <td>
                                            <span style={{
                                                padding: '0.25rem 0.75rem',
                                                borderRadius: '9999px',
                                                fontSize: '0.75rem',
                                                background: 'rgba(99, 102, 241, 0.1)',
                                                color: 'var(--primary-color)'
                                            }}>
                                                {expense.category}
                                            </span>
                                        </td>
                                        <td style={{ color: 'var(--danger-color)', fontWeight: '700' }}>
                                            ₹{expense.amount.toLocaleString()}
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-danger"
                                                style={{ padding: '0.4rem' }}
                                                onClick={() => handleDelete(expense._id)}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add New Expense">
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label>Title</label>
                        <input
                            type="text"
                            className="input"
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="e.g. Monthly Rent"
                        />
                    </div>
                    <div className="form-grid">
                        <div className="input-group">
                            <label>Amount (₹)</label>
                            <input
                                type="number"
                                className="input"
                                required
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            />
                        </div>
                        <div className="input-group">
                            <label>Date</label>
                            <input
                                type="date"
                                className="input"
                                required
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="input-group">
                        <label>Category</label>
                        <select
                            className="input"
                            required
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        >
                            <option value="">Select Category</option>
                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                    <div className="input-group">
                        <label>Description (Optional)</label>
                        <textarea
                            className="input"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows="3"
                        ></textarea>
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }}>
                        Save Expense
                    </button>
                </form>
            </Modal>
        </div>
    );
};

export default Expenses;

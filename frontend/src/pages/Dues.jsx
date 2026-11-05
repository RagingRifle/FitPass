import { useState, useEffect } from 'react';
import API from '../services/api';
import Modal from '../components/Modal';
import ResetFiltersButton from '../components/ResetFiltersButton';
import { MessageSquare, DollarSign, Send, CheckCircle } from 'lucide-react';

const Dues = () => {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedMember, setSelectedMember] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [paymentData, setPaymentData] = useState({
        amount: '',
        method: 'Cash',
        date: new Date().toISOString().split('T')[0]
    });
    const [search, setSearch] = useState('');

    const fetchDues = async () => {
        try {
            const { data } = await API.get('/members?limit=100');
            const membersWithDues = (data.members || []).filter(m => ((m.planPrice || 0) - (m.paidAmount || 0)) > 0);
            setMembers(membersWithDues);
        } catch (error) {
            console.error('Error fetching dues:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDues();
    }, []);

    const handlePayment = async (e) => {
        e.preventDefault();
        try {
            await API.post('/payments', {
                memberId: selectedMember._id,
                ...paymentData
            });
            setShowModal(false);
            fetchDues();
        } catch (error) {
            console.error('Error processing payment:', error);
        }
    };

    const openPaymentModal = (member) => {
        setSelectedMember(member);
        const due = member.planPrice - member.paidAmount;
        setPaymentData({
            amount: due > 0 ? due : 0,
            method: 'Cash',
            date: new Date().toISOString().split('T')[0]
        });
        setShowModal(true);
    };

    const sendWhatsAppReminder = (member) => {
        const due = member.planPrice - member.paidAmount;
        const cleanPhone = (member.phone || '').replace(/\D/g, '');
        const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        const text = encodeURIComponent(`Hi ${member.name}, friendly reminder from your fitness club! You have an outstanding balance of ₹${due.toLocaleString()} for your gym membership. Kindly settle it at your earliest convenience. Thank you!`);
        window.open(`https://wa.me/${phoneWithCountry}?text=${text}`, '_blank');
    };

    const totalDueAmount = members.reduce((sum, m) => sum + Math.max(0, m.planPrice - m.paidAmount), 0);
    const filteredMembers = members.filter(member => [member.registrationNumber, member.displayId, member.name, member.phone].some(value => String(value || '').toLowerCase().includes(search.trim().toLowerCase())));

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Due Management</h1>
                    <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0' }}>Track and collect outstanding balances from members.</p>
                </div>
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '0.75rem 1.25rem', borderRadius: '12px', textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Total Outstanding Dues</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--danger-color, #C62828)' }}>₹{totalDueAmount.toLocaleString()}</div>
                </div>
            </div>

            <div className="glass" style={{ padding: '1.5rem', borderRadius: '12px' }}>
                <div style={{ display: 'flex', gap: '.75rem', alignItems: 'end', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <label style={{ display: 'grid', gap: 6, flex: '1 1 280px' }}>Search member<input className="input" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Member ID (MEM1001), name, or phone" /></label>
                    <ResetFiltersButton onClick={() => setSearch('')} />
                </div>
                {loading ? (
                    <div className="spinner"></div>
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Member ID</th>
                                <th>Member Name</th>
                                <th>Phone</th>
                                <th>Plan Price</th>
                                <th>Paid Amount</th>
                                <th>Balance Due</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMembers.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                        <CheckCircle size={32} style={{ color: '#2E7D32', marginBottom: 8, opacity: 0.8 }} />
                                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>All dues settled!</div>
                                        <div style={{ fontSize: '0.8rem', marginTop: 4 }}>No outstanding payments found.</div>
                                    </td>
                                </tr>
                            ) : (
                                filteredMembers.map((member) => {
                                    const due = Math.max(0, member.planPrice - member.paidAmount);
                                    return (
                                        <tr key={member._id}>
                                            <td>{member.registrationNumber || member.displayId || '—'}</td>
                                            <td style={{ fontWeight: '600' }}>{member.name}</td>
                                            <td>{member.phone}</td>
                                            <td>₹{(member.planPrice || 0).toLocaleString()}</td>
                                            <td style={{ color: 'var(--success-color, #2E7D32)', fontWeight: '600' }}>₹{(member.paidAmount || 0).toLocaleString()}</td>
                                            <td style={{ color: 'var(--danger-color, #C62828)', fontWeight: '800' }}>
                                                ₹{due.toLocaleString()}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button
                                                        onClick={() => openPaymentModal(member)}
                                                        className="btn btn-primary"
                                                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem', fontWeight: '700' }}
                                                    >
                                                        Collect Payment
                                                    </button>
                                                    <button
                                                        onClick={() => sendWhatsAppReminder(member)}
                                                        className="btn"
                                                        style={{
                                                            padding: '0.4rem 0.75rem',
                                                            fontSize: '0.78rem',
                                                            background: 'rgba(37, 211, 102, 0.12)',
                                                            color: '#25D366',
                                                            border: '1px solid rgba(37, 211, 102, 0.3)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.35rem',
                                                            fontWeight: '700'
                                                        }}
                                                        title="Send WhatsApp Reminder"
                                                    >
                                                        <MessageSquare size={14} /> Remind
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={`Collect Payment — ${selectedMember?.name}`}>
                <form onSubmit={handlePayment}>
                    <div className="input-group">
                        <label>Amount Due: ₹{selectedMember ? Math.max(0, selectedMember.planPrice - selectedMember.paidAmount).toLocaleString() : 0}</label>
                        <input
                            type="number"
                            className="input"
                            required
                            max={selectedMember ? Math.max(0, selectedMember.planPrice - selectedMember.paidAmount) : undefined}
                            value={paymentData.amount}
                            onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                            placeholder="Enter amount collected"
                        />
                    </div>
                    <div className="input-group">
                        <label>Payment Method</label>
                        <select
                            className="input"
                            value={paymentData.method}
                            onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value })}
                        >
                            <option value="Cash">Cash</option>
                            <option value="UPI">UPI</option>
                            <option value="Card">Card</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                        </select>
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.25rem' }}>
                        Confirm & Record Payment
                    </button>
                </form>
            </Modal>
        </div>
    );
};

export default Dues;

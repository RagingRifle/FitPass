import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import {
    getPayrolls,
    generatePayroll,
    updatePayroll,
    getSalaryStructure,
    upsertSalaryStructure,
    getStaff,
    addCommission
} from '../services/apiService';
import Modal from '../components/Modal';
import { Banknote, Users, DollarSign, PlusCircle, CheckCircle, AlertCircle, Edit, Sparkles, Printer, Download } from 'lucide-react';

const PayrollPage = () => {
    const { user } = useContext(AuthContext);
    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

    const [payrolls, setPayrolls] = useState([]);
    const [trainers, setTrainers] = useState([]);
    const [selectedTrainerId, setSelectedTrainerId] = useState('');
    const [activeTab, setActiveTab] = useState('history');
    const [loading, setLoading] = useState(true);
    const [selectedPayslip, setSelectedPayslip] = useState(null);


    // Filter states
    const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());

    // Modals
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [isCommissionModalOpen, setIsCommissionModalOpen] = useState(false);
    const [configTrainer, setConfigTrainer] = useState(null);
    const [salaryConfig, setSalaryConfig] = useState({ fixedSalary: '', commissionPt: '' });
    
    const [generateData, setGenerateData] = useState({ trainerId: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(), incentives: '0' });
    const [commissionData, setCommissionData] = useState({ trainerId: '', amount: '', date: new Date().toISOString().split('T')[0] });

    useEffect(() => {
        if (isAdmin) {
            fetchTrainers();
        } else {
            setSelectedTrainerId(user.id);
        }
    }, [user, isAdmin]);

    useEffect(() => {
        fetchPayrollsData();
    }, [selectedTrainerId, filterMonth, filterYear]);

    const fetchTrainers = async () => {
        try {
            const data = await getStaff();
            const staffList = Array.isArray(data) ? data : (data?.data || []);
            setTrainers(staffList.filter(s => s.role === 'trainer'));
        } catch (error) {
            console.error('Error fetching trainers:', error);
            setTrainers([]);
        }
    };

    const fetchPayrollsData = async () => {
        setLoading(true);
        try {
            const params = {
                month: filterMonth,
                year: filterYear
            };
            if (selectedTrainerId) params.trainerId = selectedTrainerId;

            const data = await getPayrolls(params);
            const list = Array.isArray(data) ? data : (data?.data || []);
            setPayrolls(list);
        } catch (error) {
            console.error('Error fetching payrolls:', error);
            setPayrolls([]);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenConfigModal = async (trainer) => {
        setConfigTrainer(trainer);
        try {
            const structure = await getSalaryStructure(trainer._id);
            setSalaryConfig({
                fixedSalary: structure.fixedSalary,
                commissionPt: structure.commissionPt
            });
            setIsConfigModalOpen(true);
        } catch {
            alert('Error loading salary structure');
        }
    };

    const handleSaveConfig = async (e) => {
        e.preventDefault();
        try {
            await upsertSalaryStructure({
                trainerId: configTrainer._id,
                fixedSalary: Number(salaryConfig.fixedSalary),
                commissionPt: Number(salaryConfig.commissionPt)
            });
            alert('Salary structure updated successfully');
            setIsConfigModalOpen(false);
            if (activeTab === 'salary') fetchPayrollsData();
        } catch {
            alert('Failed to update salary config');
        }
    };

    const handleGeneratePayroll = async (e) => {
        e.preventDefault();
        try {
            await generatePayroll({
                trainerId: generateData.trainerId,
                month: Number(generateData.month),
                year: Number(generateData.year),
                incentives: Number(generateData.incentives)
            });
            alert('Payroll generated/recalculated successfully');
            setIsGenerateModalOpen(false);
            fetchPayrollsData();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to generate payroll');
        }
    };

    const handleAddCommission = async (e) => {
        e.preventDefault();
        try {
            await addCommission({
                trainerId: commissionData.trainerId,
                amount: Number(commissionData.amount),
                date: commissionData.date
            });
            alert('PT Commission logged successfully');
            setIsCommissionModalOpen(false);
            fetchPayrollsData();
        } catch {
            alert('Failed to add commission');
        }
    };

    const handleMarkAsPaid = async (payrollId) => {
        if (window.confirm('Are you sure you want to mark this payroll as PAID?')) {
            try {
                await updatePayroll(payrollId, { status: 'Paid' });
                alert('Payroll marked as Paid');
                fetchPayrollsData();
            } catch {
                alert('Error updating status');
            }
        }
    };

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const safePayrolls = Array.isArray(payrolls) ? payrolls : [];
    const safeTrainers = Array.isArray(trainers) ? trainers : [];

    return (
        <div className="fade-in">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ fontWeight: '800', marginBottom: '0.25rem' }}> Payroll & Trainer Salaries</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Manage salary structures, track PT commissions, and disburse payrolls</p>
                </div>
                {isAdmin && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={() => setIsCommissionModalOpen(true)}>
                            <PlusCircle size={16} /> Log Commission
                        </button>
                        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={() => setIsGenerateModalOpen(true)}>
                            <Sparkles size={16} /> Generate Payroll
                        </button>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="tabs" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                <button
                    className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                    style={{ padding: '0.75rem 1.25rem', border: 'none', background: 'none', borderBottom: activeTab === 'history' ? '3px solid var(--primary-color)' : 'none', fontWeight: '700', color: activeTab === 'history' ? 'var(--primary-color)' : 'var(--text-secondary)' }}
                >
                    Payroll Records
                </button>
                {isAdmin && (
                    <button
                        className={`tab-btn ${activeTab === 'salary' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('salary'); fetchPayrollsData(); }}
                        style={{ padding: '0.75rem 1.25rem', border: 'none', background: 'none', borderBottom: activeTab === 'salary' ? '3px solid var(--primary-color)' : 'none', fontWeight: '700', color: activeTab === 'salary' ? 'var(--primary-color)' : 'var(--text-secondary)' }}
                    >
                        Salary Configuration
                    </button>
                )}
            </div>

            {activeTab === 'history' && (
                <div>
                    {/* Filters */}
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                        {isAdmin && (
                            <select
                                className="input"
                                style={{ flex: '1', minWidth: '200px' }}
                                value={selectedTrainerId}
                                onChange={(e) => setSelectedTrainerId(e.target.value)}
                            >
                                <option value="">All Trainers</option>
                                {safeTrainers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                            </select>
                        )}
                        <select
                            className="input"
                            style={{ flex: '1', minWidth: '150px' }}
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                        >
                            {months.map((m, idx) => <option key={idx} value={idx + 1}>{m}</option>)}
                        </select>
                        <select
                            className="input"
                            style={{ flex: '1', minWidth: '150px' }}
                            value={filterYear}
                            onChange={(e) => setFilterYear(e.target.value)}
                        >
                            {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    {loading ? (
                        <div className="spinner"></div>
                    ) : (
                        <div className="card">
                            <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem', fontWeight: '700' }}> Monthly Pay Slips</h3>
                            {safePayrolls.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-state-icon"></div>
                                    <h3>No payroll records found</h3>
                                    <p>No payroll reports generated for this period.</p>
                                </div>
                            ) : (
                                <div className="table-container">
                                    <table>
                                        <thead>
                                            <tr>
                                                {isAdmin && <th>Trainer</th>}
                                                <th>Period</th>
                                                <th>Fixed Salary</th>
                                                <th>PT Commissions</th>
                                                <th>Incentives</th>
                                                <th>Total Payout</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {safePayrolls.map(slip => (
                                                <tr key={slip._id}>
                                                    {isAdmin && (
                                                        <td>
                                                            <div style={{ fontWeight: '600' }}>{slip.trainer?.name}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{slip.trainer?.email}</div>
                                                        </td>
                                                    )}
                                                    <td style={{ fontWeight: '700' }}>{months[slip.month - 1]} {slip.year}</td>
                                                    <td>₹{slip.fixedSalary.toLocaleString()}</td>
                                                    <td>₹{slip.commissions.toLocaleString()}</td>
                                                    <td>₹{slip.incentives.toLocaleString()}</td>
                                                    <td style={{ fontWeight: '800', color: 'var(--primary-color)' }}>₹{slip.totalAmount.toLocaleString()}</td>
                                                    <td>
                                                        {slip.status === 'Paid' ? (
                                                            <span className="badge badge-active" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                                                <CheckCircle size={12} /> Paid
                                                            </span>
                                                        ) : (
                                                            <span className="badge badge-expired" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                                                <AlertCircle size={12} /> Unpaid
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                                            <button
                                                                className="btn"
                                                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                                                                onClick={() => setSelectedPayslip(slip)}
                                                                title="Download / Print Payslip"
                                                            >
                                                                <Printer size={13} /> Payslip
                                                            </button>
                                                            {isAdmin && slip.status !== 'Paid' && (
                                                                <button
                                                                    className="btn btn-primary"
                                                                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', fontWeight: '700', borderRadius: '8px' }}
                                                                    onClick={() => handleMarkAsPaid(slip._id)}
                                                                >
                                                                    Disburse
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>

                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'salary' && isAdmin && (
                <div className="card">
                    <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem', fontWeight: '700' }}> Salary & PT Commission Structures</h3>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Trainer</th>
                                    <th>Email</th>
                                    <th>Salary Configuration</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {safeTrainers.map(t => (
                                    <tr key={t._id}>
                                        <td style={{ fontWeight: '600' }}>{t.name}</td>
                                        <td>{t.email}</td>
                                        <td>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                Manage setup for base pay and personal training rates.
                                            </span>
                                        </td>
                                        <td>
                                            <button
                                                className="btn"
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.8rem', border: '1px solid var(--border-color)' }}
                                                onClick={() => handleOpenConfigModal(t)}
                                            >
                                                <Edit size={14} /> Configure Rates
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Salary Config Modal */}
            <Modal isOpen={isConfigModalOpen} onClose={() => setIsConfigModalOpen(false)} title={`Configure Salary: ${configTrainer?.name}`}>
                <form onSubmit={handleSaveConfig}>
                    <div className="input-group">
                        <label>Fixed Salary (₹ / month)</label>
                        <input
                            className="input"
                            type="number"
                            value={salaryConfig.fixedSalary}
                            onChange={(e) => setSalaryConfig({ ...salaryConfig, fixedSalary: e.target.value })}
                            required
                            placeholder="e.g. 25000"
                        />
                    </div>
                    <div className="input-group">
                        <label>PT Commission Rate (₹ / completed session)</label>
                        <input
                            className="input"
                            type="number"
                            value={salaryConfig.commissionPt}
                            onChange={(e) => setSalaryConfig({ ...salaryConfig, commissionPt: e.target.value })}
                            required
                            placeholder="e.g. 200"
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                        Save Salary Settings
                    </button>
                </form>
            </Modal>

            {/* Generate Payroll Modal */}
            <Modal isOpen={isGenerateModalOpen} onClose={() => setIsGenerateModalOpen(false)} title="Generate Monthly Payroll">
                <form onSubmit={handleGeneratePayroll}>
                    <div className="input-group">
                        <label>Select Trainer *</label>
                        <select
                            className="input"
                            value={generateData.trainerId}
                            onChange={(e) => setGenerateData({ ...generateData, trainerId: e.target.value })}
                            required
                        >
                            <option value="">-- Choose Trainer --</option>
                            {safeTrainers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                        </select>
                    </div>

                    <div className="form-grid">
                        <div className="input-group">
                            <label>Month *</label>
                            <select
                                className="input"
                                value={generateData.month}
                                onChange={(e) => setGenerateData({ ...generateData, month: e.target.value })}
                                required
                            >
                                {months.map((m, idx) => <option key={idx} value={idx + 1}>{m}</option>)}
                            </select>
                        </div>
                        <div className="input-group">
                            <label>Year *</label>
                            <select
                                className="input"
                                value={generateData.year}
                                onChange={(e) => setGenerateData({ ...generateData, year: e.target.value })}
                                required
                            >
                                {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="input-group">
                        <label>Incentives / Bonuses (₹)</label>
                        <input
                            className="input"
                            type="number"
                            value={generateData.incentives}
                            onChange={(e) => setGenerateData({ ...generateData, incentives: e.target.value })}
                            placeholder="e.g. 1500"
                        />
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                        Generate & Persist Payroll
                    </button>
                </form>
            </Modal>

            {/* Log Commission Modal */}
            <Modal isOpen={isCommissionModalOpen} onClose={() => setIsCommissionModalOpen(false)} title="Log PT Commission Manually">
                <form onSubmit={handleAddCommission}>
                    <div className="input-group">
                        <label>Select Trainer *</label>
                        <select
                            className="input"
                            value={commissionData.trainerId}
                            onChange={(e) => setCommissionData({ ...commissionData, trainerId: e.target.value })}
                            required
                        >
                            <option value="">-- Choose Trainer --</option>
                            {safeTrainers.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                        </select>
                    </div>

                    <div className="input-group">
                        <label>Commission Amount (₹) *</label>
                        <input
                            className="input"
                            type="number"
                            value={commissionData.amount}
                            onChange={(e) => setCommissionData({ ...commissionData, amount: e.target.value })}
                            required
                            placeholder="e.g. 500"
                        />
                    </div>

                    <div className="input-group">
                        <label>Date *</label>
                        <input
                            className="input"
                            type="date"
                            value={commissionData.date}
                            onChange={(e) => setCommissionData({ ...commissionData, date: e.target.value })}
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                        Record PT Commission
                    </button>
                </form>
            </Modal>

            {/* Printable Payslip Modal */}
            <Modal isOpen={!!selectedPayslip} onClose={() => setSelectedPayslip(null)} title=" Official Salary Slip">
                {selectedPayslip && (
                    <div style={{ background: '#fff', color: '#111', padding: '1.5rem', borderRadius: '12px', fontFamily: 'sans-serif' }}>
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #FEDF1E', paddingBottom: '1rem', marginBottom: '1rem' }}>
                            <div>
                                <h2 style={{ margin: 0, color: '#231D14', fontSize: '1.25rem', fontWeight: 800 }}>FITNESS CLUB PAYSLIP</h2>
                                <p style={{ margin: '0.2rem 0 0', color: '#666', fontSize: '0.8rem' }}>Salary Statement & Earnings Breakdown</p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span style={{ background: selectedPayslip.status === 'Paid' ? '#E8F5E9' : '#FFEBEE', color: selectedPayslip.status === 'Paid' ? '#2E7D32' : '#C62828', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>
                                    {selectedPayslip.status.toUpperCase()}
                                </span>
                                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.3rem' }}>{months[selectedPayslip.month - 1]} {selectedPayslip.year}</div>
                            </div>
                        </div>

                        {/* Employee details */}
                        <div style={{ background: '#FBF6EC', padding: '0.875rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            <div><strong>Employee:</strong> {selectedPayslip.trainer?.name || 'Staff Member'}</div>
                            <div><strong>Email:</strong> {selectedPayslip.trainer?.email || 'N/A'}</div>
                            <div><strong>Role:</strong> Fitness Trainer</div>
                            <div><strong>Pay Date:</strong> {selectedPayslip.paymentDate ? new Date(selectedPayslip.paymentDate).toLocaleDateString() : 'Pending'}</div>
                        </div>

                        {/* Breakdown Table */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #ddd', background: '#f5f5f5' }}>
                                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Earnings Component</th>
                                    <th style={{ textAlign: 'right', padding: '0.5rem' }}>Amount (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>Fixed Base Salary</td>
                                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 600 }}>₹{(selectedPayslip.fixedSalary || 0).toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>PT Sessions Commission</td>
                                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 600 }}>₹{(selectedPayslip.commissions || 0).toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>Incentives & Performance Bonus</td>
                                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 600 }}>₹{(selectedPayslip.incentives || 0).toLocaleString()}</td>
                                </tr>
                                <tr style={{ background: '#FBF6EC', fontWeight: 800, fontSize: '0.95rem' }}>
                                    <td style={{ padding: '0.65rem' }}>Net Take-Home Payout</td>
                                    <td style={{ padding: '0.65rem', textAlign: 'right', color: '#D9860F' }}>₹{(selectedPayslip.totalAmount || 0).toLocaleString()}</td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Footer & Print Button */}
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                            <button
                                className="btn btn-primary"
                                style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                                onClick={() => window.print()}
                            >
                                <Printer size={16} /> Print / Save PDF
                            </button>
                            <button
                                className="btn btn-secondary"
                                style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem' }}
                                onClick={() => setSelectedPayslip(null)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default PayrollPage;


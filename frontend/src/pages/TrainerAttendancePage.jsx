import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import {
    getTrainerAttendance,
    trainerCheckIn,
    trainerCheckOut,
    getStaff
} from '../services/apiService';
import { Clock, CheckCircle2, XCircle, Users, Activity, Play, Square } from 'lucide-react';

const TrainerAttendancePage = () => {
    const { user } = useContext(AuthContext);
    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
    const isTrainer = user?.role === 'trainer';

    const [logs, setLogs] = useState([]);
    const [trainers, setTrainers] = useState([]);
    const [selectedTrainerId, setSelectedTrainerId] = useState('');
    const [loading, setLoading] = useState(true);
    const [isCheckedIn, setIsCheckedIn] = useState(false);
    const [activeLog, setActiveLog] = useState(null);

    useEffect(() => {
        if (isAdmin) {
            fetchTrainers();
        } else if (isTrainer) {
            setSelectedTrainerId(user.id);
        }
    }, [user, isAdmin, isTrainer]);

    useEffect(() => {
        fetchLogs();
    }, [selectedTrainerId]);

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

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const data = await getTrainerAttendance(selectedTrainerId);
            const logList = Array.isArray(data) ? data : (data?.data || []);
            setLogs(logList);

            // Check if trainer is currently checked in (has a record today where checkOutTime is null)
            const targetTrainer = selectedTrainerId || (isTrainer ? user.id : '');
            if (targetTrainer) {
                const active = logList.find(l => l.trainerId === targetTrainer && !l.checkOutTime);
                if (active) {
                    setIsCheckedIn(true);
                    setActiveLog(active);
                } else {
                    setIsCheckedIn(false);
                    setActiveLog(null);
                }
            }
        } catch (error) {
            console.error('Error fetching attendance logs:', error);
            setLogs([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckIn = async () => {
        try {
            await trainerCheckIn(isAdmin ? selectedTrainerId : '');
            alert('Successfully Checked In!');
            fetchLogs();
        } catch (error) {
            alert(error.response?.data?.message || 'Check In failed');
        }
    };

    const handleCheckOut = async () => {
        if (window.confirm('Are you sure you want to Check Out now?')) {
            try {
                await trainerCheckOut(isAdmin ? selectedTrainerId : '');
                alert('Successfully Checked Out!');
                fetchLogs();
            } catch (error) {
                alert(error.response?.data?.message || 'Check Out failed');
            }
        }
    };

    const safeLogs = Array.isArray(logs) ? logs : [];
    const safeTrainers = Array.isArray(trainers) ? trainers : [];

    // Calculate monthly stats
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyLogs = safeLogs.filter(l => {
        const d = new Date(l.date);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalHours = monthlyLogs.reduce((sum, l) => sum + (l.workingHours || 0), 0).toFixed(1);
    const activeDays = monthlyLogs.length;

    return (
        <div className="fade-in">
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontWeight: '800', marginBottom: '0.25rem' }}> Trainer Attendance & Work Hours</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Log working hours and view attendance sheets</p>
            </div>

            {/* Admin Select Trainer Filter */}
            {isAdmin && (
                <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
                    <label style={{ display: 'block', fontWeight: '700', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Select Trainer to manage:</label>
                    <select
                        className="input"
                        value={selectedTrainerId}
                        onChange={(e) => setSelectedTrainerId(e.target.value)}
                        style={{ maxWidth: '400px' }}
                    >
                        <option value="">-- All Trainer Logs --</option>
                        {safeTrainers.map(t => (
                            <option key={t._id} value={t._id}>
                                {t.name} ({t.email})
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {loading ? (
                <div className="spinner"></div>
            ) : (
                <div>
                    {/* Action Card & Stats Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                        {/* Check In/Out Main Action Card */}
                        {(isTrainer || (isAdmin && selectedTrainerId)) && (
                            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '2rem', textAlign: 'center', borderLeft: `5px solid ${isCheckedIn ? '#10b981' : '#ef4444'}` }}>
                                <Clock size={40} style={{ color: isCheckedIn ? '#10b981' : 'var(--text-secondary)', marginBottom: '1rem' }} />
                                <h3 style={{ marginBottom: '0.25rem' }}>
                                    {isCheckedIn ? 'You are Checked In' : 'You are Checked Out'}
                                </h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
                                    {isCheckedIn 
                                        ? `Since ${new Date(activeLog?.checkInTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` 
                                        : 'Please log your shift start/end times'
                                    }
                                </p>
                                
                                {isCheckedIn ? (
                                    <button 
                                        className="btn btn-danger" 
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 2rem', fontWeight: '700', borderRadius: '12px' }}
                                        onClick={handleCheckOut}
                                    >
                                        <Square size={16} /> Check Out Shift
                                    </button>
                                ) : (
                                    <button 
                                        className="btn btn-primary" 
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 2rem', fontWeight: '700', borderRadius: '12px' }}
                                        onClick={handleCheckIn}
                                    >
                                        <Play size={16} /> Check In Shift
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Working Stats Card */}
                        <div className="card" style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', padding: '1.5rem' }}>
                            <div style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', padding: '1rem', borderRadius: '14px' }}>
                                <Activity size={32} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Hours Worked (This Month)</div>
                                <div style={{ fontSize: '2rem', fontWeight: '800', margin: '0.25rem 0' }}>{totalHours} hrs</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Over {activeDays} shifts logged</div>
                            </div>
                        </div>

                        {/* Days Logged Card */}
                        <div className="card" style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', padding: '1.5rem' }}>
                            <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '1rem', borderRadius: '14px' }}>
                                <CheckCircle2 size={32} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Attendance Rate</div>
                                <div style={{ fontSize: '2rem', fontWeight: '800', margin: '0.25rem 0' }}>{activeDays} days</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Active shifts this calendar month</div>
                            </div>
                        </div>
                    </div>

                    {/* Attendance Logs Table */}
                    <div className="card">
                        <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem', fontWeight: '700' }}> Attendance Shift History</h3>
                        {safeLogs.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state-icon"></div>
                                <h3>No attendance records found</h3>
                                <p>No shifts have been logged for this period yet.</p>
                            </div>
                        ) : (
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            {isAdmin && <th>Trainer</th>}
                                            <th>Check In</th>
                                            <th>Check Out</th>
                                            <th>Working Hours</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {safeLogs.map(log => (
                                            <tr key={log._id}>
                                                <td style={{ fontWeight: '600' }}>
                                                    {new Date(log.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                                </td>
                                                {isAdmin && (
                                                    <td>
                                                        <div style={{ fontWeight: '600' }}>{log.trainer?.name || 'Unknown Trainer'}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{log.trainer?.email}</div>
                                                    </td>
                                                )}
                                                <td>{new Date(log.checkInTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</td>
                                                <td>
                                                    {log.checkOutTime 
                                                        ? new Date(log.checkOutTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) 
                                                        : '—'
                                                    }
                                                </td>
                                                <td style={{ fontWeight: '700', color: 'var(--primary-color)' }}>
                                                    {log.workingHours !== null ? `${log.workingHours} hrs` : 'Active'}
                                                </td>
                                                <td>
                                                    {log.checkOutTime ? (
                                                        <span className="badge badge-active" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                                            <CheckCircle2 size={12} /> Completed
                                                        </span>
                                                    ) : (
                                                        <span className="badge badge-frozen" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', animation: 'pulse 2s infinite' }}>
                                                            <Activity size={12} /> Working
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrainerAttendancePage;

import { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import { getTrainerAttendance, markTrainerLeave, trainerCheckIn, trainerCheckOut, getStaff } from '../services/apiService';
import API from '../services/api';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Clock, CheckCircle2, Users, Activity, Play, Square, CalendarDays, Palmtree, ChevronDown } from 'lucide-react';
import ResetFiltersButton from '../components/ResetFiltersButton';

const todayLocal = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const dayKey = value => {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const formatTime = value => value ? new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—';

const TrainerAttendancePage = () => {
    const { user } = useContext(AuthContext);
    const isAdmin = ['admin', 'superadmin', 'h4_admin'].includes(user?.role);
    const isTrainer = user?.role === 'trainer';
    const now = new Date();
    const [logs, setLogs] = useState([]);
    const [trainers, setTrainers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [selectedTrainerId, setSelectedTrainerId] = useState(isTrainer ? user?.id || '' : '');
    const [selectedBranchId, setSelectedBranchId] = useState(user?.branchId || '');
    const [period, setPeriod] = useState('month');
    const [filterMonth, setFilterMonth] = useState(now.getMonth());
    const [filterYear, setFilterYear] = useState(now.getFullYear());
    const [fromDate, setFromDate] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
    const [toDate, setToDate] = useState(todayLocal());
    const [statusFilter, setStatusFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [isCheckedIn, setIsCheckedIn] = useState(false);
    const [activeLog, setActiveLog] = useState(null);
    const [leaveDate, setLeaveDate] = useState(todayLocal());
    const [leaveReason, setLeaveReason] = useState('');
    const [busy, setBusy] = useState(false);

    const dateRange = useMemo(() => {
        if (period === 'custom') return { from: fromDate, to: toDate };
        if (period === 'year') return { from: `${filterYear}-01-01`, to: `${filterYear}-12-31` };
        const monthStart = new Date(filterYear, filterMonth, 1);
        const monthEnd = new Date(filterYear, filterMonth + 1, 0);
        return { from: dayKey(monthStart), to: dayKey(monthEnd) };
    }, [period, fromDate, toDate, filterMonth, filterYear]);

    useEffect(() => {
        if (isAdmin) {
            getStaff().then(data => setTrainers((Array.isArray(data) ? data : (data?.data || [])).filter(staff => staff.role === 'trainer'))).catch(() => setTrainers([]));
            API.get('/branches').then(({ data }) => setBranches(Array.isArray(data) ? data : (data?.branches || []))).catch(() => setBranches([]));
        }
    }, [isAdmin]);

    useEffect(() => {
        if (isTrainer && user?.id) setSelectedTrainerId(user.id);
    }, [isTrainer, user?.id]);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = { ...dateRange, limit: 1000, timezoneOffset: new Date().getTimezoneOffset() };
            if (selectedTrainerId) params.trainerId = selectedTrainerId;
            if (selectedBranchId) params.branchId = selectedBranchId;
            const response = await getTrainerAttendance(params);
            const data = Array.isArray(response) ? response : (response?.data || []);
            setLogs(data);

            const today = todayLocal();
            const todayResponse = await getTrainerAttendance({ from: today, to: today, limit: 100, timezoneOffset: new Date().getTimezoneOffset(), ...(selectedTrainerId ? { trainerId: selectedTrainerId } : {}), ...(selectedBranchId ? { branchId: selectedBranchId } : {}) });
            const todayLogs = Array.isArray(todayResponse) ? todayResponse : (todayResponse?.data || []);
            const currentTrainer = selectedTrainerId || (isTrainer ? user?.id : '');
            const active = currentTrainer ? todayLogs.find(log => String(log.trainerId) === String(currentTrainer) && log.status !== 'Leave' && !log.checkOutTime) : null;
            setIsCheckedIn(Boolean(active));
            setActiveLog(active || null);
        } catch (error) {
            console.error('Error fetching attendance logs:', error);
            setLogs([]);
        } finally {
            setLoading(false);
        }
    }, [dateRange, selectedTrainerId, selectedBranchId, isTrainer, user?.id]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const safeLogs = useMemo(() => Array.isArray(logs) ? logs : [], [logs]);
    const groupedDays = useMemo(() => {
        const grouped = new Map();
        safeLogs.forEach(log => {
            const key = `${String(log.trainerId)}|${dayKey(log.date)}`;
            if (!grouped.has(key)) grouped.set(key, { key, date: dayKey(log.date), trainerId: String(log.trainerId), trainer: log.trainer, shifts: [], hours: 0, isLeave: false, reason: '' });
            const day = grouped.get(key);
            if (log.status === 'Leave') {
                day.isLeave = true;
                day.reason = log.leaveReason || '';
            } else {
                day.shifts.push(log);
                day.hours += Number(log.workingHours) || 0;
                if (log.checkInTime && !log.checkOutTime) {
                    const start = new Date(log.checkInTime).getTime();
                    day.hours += Math.max(0, Date.now() - start) / 3600000;
                }
            }
        });
        return [...grouped.values()].sort((a, b) => b.date.localeCompare(a.date) || (a.trainer?.name || '').localeCompare(b.trainer?.name || ''));
    }, [safeLogs]);

    const visibleDays = useMemo(() => groupedDays.filter(day => statusFilter === 'all' || (statusFilter === 'leave' ? day.isLeave : !day.isLeave && day.shifts.length > 0)), [groupedDays, statusFilter]);
    const presentDays = groupedDays.filter(day => !day.isLeave && day.shifts.length).length;
    const leaveDays = groupedDays.filter(day => day.isLeave).length;
    const totalHours = groupedDays.reduce((sum, day) => sum + day.hours, 0);
    const totalSessions = groupedDays.reduce((sum, day) => sum + day.shifts.length, 0);
    const chartRows = [...groupedDays].reverse().map(day => ({ date: day.date.slice(5), hours: Number(day.hours.toFixed(2)), shifts: day.shifts.length, leave: day.isLeave ? 1 : 0 }));

    const calendarDays = useMemo(() => {
        if (period === 'custom') return [];
        const year = filterYear;
        const month = period === 'year' ? null : filterMonth;
        const start = month === null ? new Date(year, 0, 1) : new Date(year, month, 1);
        const end = month === null ? new Date(year, 11, 31) : new Date(year, month + 1, 0);
        const values = [];
        for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
            const key = dayKey(cursor);
            const sameDay = groupedDays.filter(day => day.date === key);
            values.push({ date: key, present: sameDay.some(day => !day.isLeave && day.shifts.length), leave: sameDay.some(day => day.isLeave), count: sameDay.reduce((count, day) => count + day.shifts.length, 0) });
        }
        return values;
    }, [period, filterYear, filterMonth, groupedDays]);

    const handleCheckIn = async () => {
        setBusy(true);
        try { await trainerCheckIn(isAdmin ? selectedTrainerId : ''); await fetchLogs(); }
        catch (error) { alert(error.response?.data?.message || 'Check in failed'); }
        finally { setBusy(false); }
    };
    const handleCheckOut = async () => {
        if (!window.confirm('Check out of the active shift now?')) return;
        setBusy(true);
        try { await trainerCheckOut(isAdmin ? selectedTrainerId : ''); await fetchLogs(); }
        catch (error) { alert(error.response?.data?.message || 'Check out failed'); }
        finally { setBusy(false); }
    };
    const handleMarkLeave = async event => {
        event.preventDefault();
        if (!selectedTrainerId || !leaveDate) return;
        setBusy(true);
        try {
            await markTrainerLeave({ trainerId: selectedTrainerId, date: leaveDate, reason: leaveReason, timezoneOffset: new Date().getTimezoneOffset() });
            setLeaveReason('');
            await fetchLogs();
        } catch (error) { alert(error.response?.data?.message || 'Could not mark leave'); }
        finally { setBusy(false); }
    };
    const resetFilters = () => {
        setSelectedTrainerId(isTrainer ? user?.id || '' : '');
        setSelectedBranchId(user?.branchId || '');
        setPeriod('month');
        setFilterMonth(now.getMonth());
        setFilterYear(now.getFullYear());
        setFromDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
        setToDate(todayLocal());
        setStatusFilter('all');
    };

    const availableYears = Array.from({ length: 7 }, (_, index) => now.getFullYear() - index);
    return <div className="fade-in">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <div><h2 style={{ fontWeight: 800, marginBottom: '.25rem' }}>Trainer Attendance & Work Hours</h2><p style={{ color: 'var(--text-secondary)', fontSize: '.875rem' }}>Daily totals combine every shift; expand a day to inspect individual shifts.</p></div>
            {isAdmin && <form onSubmit={handleMarkLeave} style={{ display: 'flex', alignItems: 'end', gap: '.5rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'grid', gap: 5, fontSize: '.8rem' }}>Mark leave for<select className="input" required value={selectedTrainerId} onChange={event => setSelectedTrainerId(event.target.value)}><option value="">Select trainer</option>{trainers.map(trainer => <option key={trainer._id || trainer.id} value={trainer._id || trainer.id}>{trainer.name}</option>)}</select></label>
                <label style={{ display: 'grid', gap: 5, fontSize: '.8rem' }}>Date<input className="input" type="date" required value={leaveDate} onChange={event => setLeaveDate(event.target.value)} /></label>
                <label style={{ display: 'grid', gap: 5, fontSize: '.8rem' }}>Reason (optional)<input className="input" value={leaveReason} onChange={event => setLeaveReason(event.target.value)} placeholder="Leave note" /></label>
                <button className="btn btn-secondary" type="submit" disabled={!selectedTrainerId || busy}><Palmtree size={16} /> Mark leave</button>
            </form>}
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'end', gap: '.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <label style={{ display: 'grid', gap: 5, minWidth: 160 }}>Time period<select className="input" value={period} onChange={event => setPeriod(event.target.value)}><option value="month">Month</option><option value="year">Year</option><option value="custom">Custom dates</option></select></label>
            {period !== 'custom' && <label style={{ display: 'grid', gap: 5, minWidth: 145 }}>Year<select className="input" value={filterYear} onChange={event => setFilterYear(Number(event.target.value))}>{availableYears.map(year => <option key={year} value={year}>{year}</option>)}</select></label>}
            {period === 'month' && <label style={{ display: 'grid', gap: 5, minWidth: 155 }}>Month<select className="input" value={filterMonth} onChange={event => setFilterMonth(Number(event.target.value))}>{Array.from({ length: 12 }, (_, month) => <option key={month} value={month}>{new Date(2000, month, 1).toLocaleString(undefined, { month: 'long' })}</option>)}</select></label>}
            {period === 'custom' && <><label style={{ display: 'grid', gap: 5 }}>From<input className="input" type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} /></label><label style={{ display: 'grid', gap: 5 }}>To<input className="input" type="date" value={toDate} onChange={event => setToDate(event.target.value)} /></label></>}
            {isAdmin && <><label style={{ display: 'grid', gap: 5, minWidth: 190 }}>Trainer<select className="input" value={selectedTrainerId} onChange={event => setSelectedTrainerId(event.target.value)}><option value="">All trainers</option>{trainers.map(trainer => <option key={trainer._id || trainer.id} value={trainer._id || trainer.id}>{trainer.name}</option>)}</select></label><label style={{ display: 'grid', gap: 5, minWidth: 160 }}>Branch<select className="input" value={selectedBranchId} onChange={event => setSelectedBranchId(event.target.value)}><option value="">All branches</option>{branches.map(branch => <option key={branch.id || branch._id} value={branch.id || branch._id}>{branch.name}</option>)}</select></label></>}
            <label style={{ display: 'grid', gap: 5, minWidth: 140 }}>Attendance status<select className="input" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="present">Checked in</option><option value="leave">Leave</option></select></label>
            <ResetFiltersButton onClick={resetFilters} />
        </div>

        {loading ? <div className="spinner" /> : <>
            {(isTrainer || (isAdmin && selectedTrainerId)) && <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.85rem' }}><Clock size={28} color={isCheckedIn ? '#10b981' : 'var(--text-secondary)'} /><div><strong>{isCheckedIn ? 'Shift in progress' : 'No active shift'}</strong><div style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>{isCheckedIn ? `Started ${formatTime(activeLog?.checkInTime)}` : 'You can start another shift after each checkout.'}</div></div></div>
                {isCheckedIn ? <button className="btn btn-danger" disabled={busy} onClick={handleCheckOut}><Square size={16} /> Check out shift</button> : <button className="btn btn-primary" disabled={busy} onClick={handleCheckIn}><Play size={16} /> Check in shift</button>}
            </div>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="card"><div style={{ color: 'var(--text-secondary)', fontSize: '.78rem' }}>Cumulative time</div><strong style={{ fontSize: '1.7rem' }}>{totalHours.toFixed(1)} hrs</strong></div>
                <div className="card"><div style={{ color: 'var(--text-secondary)', fontSize: '.78rem' }}>Days present</div><strong style={{ fontSize: '1.7rem' }}>{presentDays}</strong></div>
                <div className="card"><div style={{ color: 'var(--text-secondary)', fontSize: '.78rem' }}>Shifts recorded</div><strong style={{ fontSize: '1.7rem' }}>{totalSessions}</strong></div>
                <div className="card"><div style={{ color: 'var(--text-secondary)', fontSize: '.78rem' }}>Leave days</div><strong style={{ fontSize: '1.7rem' }}>{leaveDays}</strong></div>
            </div>

            <div className="card" style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ marginTop: 0, display: 'flex', gap: 8, alignItems: 'center' }}><CalendarDays size={19} /> Attendance calendar</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {calendarDays.map(day => <div key={day.date} title={`${day.date}: ${day.leave ? 'Leave' : day.present ? `Present · ${day.count} shift(s)` : 'No attendance recorded'}`} style={{ width: 15, height: 15, borderRadius: 3, background: day.leave ? '#ef4444' : day.present ? '#22c55e' : 'var(--border-color, #e5e7eb)' }} />)}
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '.75rem', color: 'var(--text-secondary)', fontSize: '.78rem' }}><span>Present: green</span><span>Leave: red</span><span>No record: gray</span></div>
            </div>

            <div className="card" style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ marginTop: 0 }}>Daily hours and shifts</h3>
                {chartRows.length ? <div style={{ width: '100%', height: 260 }}><ResponsiveContainer><BarChart data={chartRows}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Bar dataKey="hours" name="Hours" fill="#d8b600" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div> : <p style={{ color: 'var(--text-secondary)' }}>No attendance data for this period.</p>}
            </div>

            <div className="card">
                <h3 style={{ marginTop: 0 }}>Daily attendance summary</h3>
                <div className="table-container"><table><thead><tr><th>Date</th>{isAdmin && <th>Trainer</th>}<th>Status</th><th>Shifts</th><th>Total time</th><th>Shift details</th></tr></thead><tbody>
                    {visibleDays.map(day => <tr key={day.key}><td>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</td>{isAdmin && <td>{day.trainer?.name || trainers.find(trainer => String(trainer.id || trainer._id) === day.trainerId)?.name || 'Trainer'}</td>}<td>{day.isLeave ? <span style={{ color: '#dc2626', fontWeight: 700 }}>Leave{day.reason ? ` · ${day.reason}` : ''}</span> : <span style={{ color: '#16a34a', fontWeight: 700 }}>Present</span>}</td><td>{day.shifts.length}</td><td>{day.isLeave ? '—' : `${day.hours.toFixed(2)} hrs`}</td><td>{day.shifts.length ? <details><summary style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>View {day.shifts.length} shift(s) <ChevronDown size={14} /></summary><div style={{ display: 'grid', gap: 5, marginTop: 8 }}>{day.shifts.map((shift, index) => <div key={shift.id || shift._id || index} style={{ color: 'var(--text-secondary)', fontSize: '.85rem' }}>Shift {index + 1}: {formatTime(shift.checkInTime)} – {formatTime(shift.checkOutTime)} · {shift.workingHours == null ? 'In progress' : `${Number(shift.workingHours).toFixed(2)} hrs`}</div>)}</div></details> : '—'}</td></tr>)}
                    {!visibleDays.length && <tr><td colSpan={isAdmin ? 6 : 5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>No attendance or leave records match these filters.</td></tr>}
                </tbody></table></div>
            </div>
        </>}
    </div>;
};

export default TrainerAttendancePage;

import { useState, useEffect } from 'react';
import API from '../services/api';
import { Check, X } from 'lucide-react';

const typeColors = {
    Yoga: '#10b981', Zumba: '#f59e0b', Strength: '#6366f1', Cardio: '#ef4444',
    HIIT: '#f43f5e', Pilates: '#8b5cf6', CrossFit: '#0ea5e9', Boxing: '#d946ef',
    Dance: '#ec4899', Stretching: '#14b8a6'
};

const MemberClasses = () => {
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState({});

    const fetchClasses = async () => {
        try {
            const { data } = await API.get('/member-portal/classes');
            setClasses(data);
        } catch (err) {
            console.error('Error fetching classes:', err);
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchClasses(); }, []);

    const handleBook = async (gymClass) => {
        setActionLoading(prev => ({ ...prev, [gymClass._id]: 'booking' }));
        try {
            const { data } = await API.post(`/member-portal/classes/${gymClass._id}/book`);
            alert(` Booked! ${data.seatsAvailable} seats remaining.`);
            fetchClasses();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to book class');
        } finally { setActionLoading(prev => ({ ...prev, [gymClass._id]: null })); }
    };

    const handleCancel = async (gymClass) => {
        if (!window.confirm('Cancel your booking for this class?')) return;
        setActionLoading(prev => ({ ...prev, [gymClass._id]: 'cancelling' }));
        try {
            await API.delete(`/member-portal/classes/${gymClass._id}/book`);
            alert(' Booking cancelled.');
            fetchClasses();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to cancel booking');
        } finally { setActionLoading(prev => ({ ...prev, [gymClass._id]: null })); }
    };

    if (loading) return <div className="spinner"></div>;

    return (
        <div className="fade-in">
            <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: '800' }}> Upcoming Classes</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Book a spot in your favourite fitness class</p>
            </div>

            {classes.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}></div>
                    <h3>No upcoming classes</h3>
                    <p>Check back later for new classes from your gym!</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {classes.map(gymClass => {
                        const color = typeColors[gymClass.type] || '#6366f1';
                        const isFull = gymClass.seatsAvailable <= 0;
                        const isBooked = gymClass.isBooked;
                        const isClosed = gymClass.isBookingClosed;
                        const loading = actionLoading[gymClass._id];

                        return (
                            <div key={gymClass._id} className="glass" style={{
                                borderRadius: '16px', padding: '1.5rem',
                                borderLeft: `6px solid ${color}`,
                                opacity: (isFull || isClosed) && !isBooked ? 0.75 : 1
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div>
                                        <span style={{
                                            background: `${color}22`, color,
                                            padding: '0.2rem 0.6rem', borderRadius: '999px',
                                            fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase'
                                        }}>{gymClass.type}</span>
                                        <h3 style={{ margin: '0.5rem 0 0.25rem', fontSize: '1.05rem', fontWeight: '800' }}>{gymClass.name}</h3>
                                        {gymClass.trainerName && (
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}> {gymClass.trainerName}</p>
                                        )}
                                    </div>
                                    {isBooked && (
                                        <span style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '0.25rem 0.6rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700' }}>
                                            <Check size={14} /> Booked
                                        </span>
                                    )}
                                </div>

                                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                    <span> {new Date(gymClass.scheduleDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                                    <span> {gymClass.startTime} – {gymClass.endTime}</span>
                                    {gymClass.bookingDeadline && (
                                        <span style={{ color: isClosed ? '#ef4444' : 'var(--text-secondary)', fontWeight: isClosed ? 700 : 400 }}>
                                             {isClosed ? 'Booking closed' : 'Book before'} {new Date(gymClass.bookingDeadline).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                    {gymClass.description && <span style={{ fontStyle: 'italic' }}> {gymClass.description}</span>}
                                </div>

                                {/* Seat progress bar */}
                                <div style={{ marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.35rem' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Seats</span>
                                        <span style={{ fontWeight: '700', color: isFull ? '#ef4444' : '#10b981' }}>
                                            {gymClass.seatsAvailable} / {gymClass.maxSeats} available
                                        </span>
                                    </div>
                                    <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${((gymClass.maxSeats - gymClass.seatsAvailable) / gymClass.maxSeats) * 100}%`,
                                            height: '100%',
                                            background: isFull ? '#ef4444' : color,
                                            borderRadius: '999px',
                                            transition: 'width 0.3s ease'
                                        }} />
                                    </div>
                                </div>

                                {isBooked ? (
                                    <button
                                        onClick={() => handleCancel(gymClass)}
                                        disabled={!!loading}
                                        className="btn"
                                        style={{ width: '100%', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '0.6rem' }}
                                    >
                                        {loading === 'cancelling' ? 'Cancelling...' : <><X size={15} /> Cancel Booking</>}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleBook(gymClass)}
                                        disabled={isFull || isClosed || !!loading}
                                        className="btn btn-primary"
                                        style={{ width: '100%', background: (isFull || isClosed) ? 'rgba(100,100,100,0.2)' : color, opacity: (isFull || isClosed) ? 0.6 : 1 }}
                                    >
                                        {loading === 'booking' ? 'Booking...' : isClosed ? ' Booking Closed' : isFull ? ' Class Full' : ' Book Slot'}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MemberClasses;

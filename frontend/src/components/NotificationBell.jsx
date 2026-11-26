import { useState, useEffect, useRef } from 'react';
import API from '../services/api';
import { Bell, Clock, CreditCard, Megaphone, CheckCircle2, Target, UsersRound } from 'lucide-react';

const typeIcon = {
    expiry: <Clock size={16} />,
    payment: <CreditCard size={16} />,
    announcement: <Megaphone size={16} />,
    lead_followup: <Target size={16} />,
    inactive_member: <UsersRound size={16} />,
};
const typeColor = {
    expiry: '#f59e0b',
    payment: '#ef4444',
    announcement: 'var(--primary-color)',
    lead_followup: '#d4a800',
    inactive_member: '#0f766e',
};

const NotificationBell = () => {
    const [notifications, setNotifications] = useState([]);
    const [open, setOpen] = useState(false);
    const [error, setError] = useState('');
    const ref = useRef(null);

    const fetchNotifications = async () => {
        try {
            const { data } = await API.get('/notifications');
            setNotifications(data);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Notifications could not be loaded.');
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000); // refresh every 60s
        return () => clearInterval(interval);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMarkRead = async (id) => {
        try {
            await API.put(`/notifications/${id}`);
            setNotifications(prev =>
                prev.map(n => n._id === id ? { ...n, read: true } : n)
            );
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Notification could not be marked as read.');
        }
    };

    const handleMarkAllRead = async () => {
        const unread = notifications.filter(n => !n.read);
        try {
            await Promise.all(unread.map(n => API.put(`/notifications/${n._id}`)));
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Notifications could not be marked as read.');
        }
    };

    const handleDeleteNotification = async (e, id) => {
        e.stopPropagation();
        try {
            await API.delete(`/notifications/${id}`);
            setNotifications(prev => prev.filter(n => n._id !== id));
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Notification could not be deleted.');
        }
    };

    const handleClearRead = async () => {
        try {
            await API.delete('/notifications/clear?mode=read');
            setNotifications(prev => prev.filter(n => !n.read));
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Read notifications could not be cleared.');
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1.4rem',
                    position: 'relative',
                    padding: '0.4rem',
                    borderRadius: '50%',
                    transition: 'background 0.2s',
                    color: 'var(--text-primary)'
                }}
                title="Notifications"
                aria-label="Notifications"
            >
                <Bell size={20} strokeWidth={2.5} />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '-2px',
                        right: '-2px',
                        background: 'var(--danger-color, #ef4444)',
                        color: '#fff',
                        borderRadius: '50%',
                        fontSize: '0.65rem',
                        fontWeight: '700',
                        width: '18px',
                        height: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid var(--bg-secondary, #1e1e2e)'
                    }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 8px)',
                    width: '340px',
                    background: 'var(--bg-secondary, #1e1e2e)',
                    border: '1px solid var(--border-color, #2d2d3d)',
                    borderRadius: '12px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                    zIndex: 1000,
                    overflow: 'hidden',
                    animation: 'fadeIn 0.15s ease'
                }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1rem 1.25rem',
                        borderBottom: '1px solid var(--border-color, #2d2d3d)'
                    }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700' }}>
                            Notifications {unreadCount > 0 && <span style={{ color: 'var(--primary-color)' }}>({unreadCount})</span>}
                        </h4>
                        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllRead}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--primary-color)' }}
                                >
                                    Mark all read
                                </button>
                            )}
                            {notifications.some(n => n.read) && (
                                <button
                                    onClick={handleClearRead}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)' }}
                                >
                                    Clear read
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Notification List */}
                    <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                        {error && (
                            <p role="alert" style={{ margin: 0, padding: '0.75rem 1rem', color: '#b91c1c', fontSize: '0.75rem' }}>
                                {error}
                            </p>
                        )}
                        {notifications.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                <div style={{ marginBottom: '0.5rem', color: 'var(--success)', display: 'flex', justifyContent: 'center' }}><CheckCircle2 size={48} strokeWidth={1.5} /></div>
                                <p style={{ margin: 0, fontSize: '0.875rem' }}>You're all caught up!</p>
                            </div>
                        ) : (
                            notifications.map(n => (
                                <div
                                    key={n._id}
                                    onClick={() => handleMarkRead(n._id)}
                                    style={{
                                        display: 'flex',
                                        gap: '0.75rem',
                                        padding: '0.875rem 1.25rem',
                                        borderBottom: '1px solid var(--border-color, #2d2d3d)',
                                        cursor: 'pointer',
                                        background: n.read ? 'transparent' : 'var(--primary-light)',
                                        transition: 'background 0.2s',
                                        alignItems: 'flex-start'
                                    }}
                                >
                                    <div style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '50%',
                                        background: `${typeColor[n.type] || 'var(--primary-color)'}22`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1rem',
                                        flexShrink: 0
                                    }}>
                                        {typeIcon[n.type] || <Bell size={16} />}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ margin: 0, fontSize: '0.8rem', lineHeight: '1.4', color: n.read ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                                            {n.message}
                                        </p>
                                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    {n.read && (
                                        <button
                                            type="button"
                                            aria-label="Delete notification"
                                            title="Delete notification"
                                            onClick={(e) => handleDeleteNotification(e, n._id)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--text-secondary)',
                                                cursor: 'pointer',
                                                padding: '2px 5px',
                                                fontSize: '0.85rem',
                                                lineHeight: 1,
                                                flexShrink: 0,
                                            }}
                                        >
                                            ×
                                        </button>
                                    )}
                                    {!n.read && (
                                        <div style={{
                                            width: '8px', height: '8px', borderRadius: '50%',
                                            background: 'var(--primary-color)', flexShrink: 0, marginTop: '4px'
                                        }} />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;

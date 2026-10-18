import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, LifeBuoy, MessageCircle, Plus, Send, X } from 'lucide-react';
import API from '../services/api';
import { useToast } from '../components/ui/Toast';
import './member-support.css';

const categories = ['General', 'Billing', 'Workout', 'Branch'];

export default function MemberSupport() {
    const toast = useToast();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [active, setActive] = useState(null);
    const [creating, setCreating] = useState(false);
    const [subject, setSubject] = useState('');
    const [category, setCategory] = useState('General');
    const [message, setMessage] = useState('');
    const [reply, setReply] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchTickets = useCallback(async () => {
        setError('');
        try {
            const { data } = await API.get('/tickets');
            const list = data?.data || data;
            if (!Array.isArray(list)) throw new Error('Unexpected response from support service');
            setTickets(list);
            setActive((current) => current ? list.find((ticket) => ticket.id === current.id) || current : null);
        } catch (err) {
            setError(err.response?.data?.message || 'Support tickets could not be loaded. Please try again.');
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchTickets(); }, [fetchTickets]);

    const createTicket = async (event) => {
        event.preventDefault();
        if (!subject.trim() || !message.trim()) return;
        setSaving(true);
        try {
            await API.post('/tickets', { subject: subject.trim(), category, message: message.trim() });
            toast.success('Support ticket submitted');
            setSubject(''); setMessage(''); setCreating(false);
            await fetchTickets();
        } catch (err) { toast.error(err.response?.data?.message || 'Could not create your ticket'); }
        finally { setSaving(false); }
    };

    const sendReply = async (event) => {
        event.preventDefault();
        if (!active || !reply.trim()) return;
        setSaving(true);
        try {
            await API.post(`/tickets/${active.id}/reply`, { message: reply.trim() });
            setReply(''); await fetchTickets();
            toast.success('Reply sent');
        } catch (err) { toast.error(err.response?.data?.message || 'Could not send your reply'); }
        finally { setSaving(false); }
    };

    return <div className="member-support-page">
        <header className="member-support-hero">
            <div className="member-support-hero-icon"><LifeBuoy size={22} /></div>
            <div><span className="member-support-kicker">HERE WHEN YOU NEED US</span><h1>Help, without the runaround.</h1><p>Ask about your membership, billing, training plan, or home branch. Your conversation stays here.</p></div>
            <button className="member-support-new" onClick={() => setCreating(true)}><Plus size={17} /> New ticket</button>
            <span className="member-support-orbit" />
        </header>
        <div className="member-support-heading"><div><span className="member-support-kicker">YOUR CONVERSATIONS</span><h2>Support tickets</h2></div><span className="member-support-count">{tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}</span></div>
        {loading ? <div className="member-support-empty">Loading your support history…</div> : error ? <div className="member-support-empty"><strong>We couldn’t reach support</strong><p>{error}</p><button onClick={fetchTickets}>Try again</button></div> : tickets.length === 0 ? <div className="member-support-empty"><span><MessageCircle size={22} /></span><strong>Your support inbox is clear.</strong><p>Need a hand with training or membership? Send us a note and the team will pick it up.</p><button onClick={() => setCreating(true)}>Create your first ticket <ArrowUpRight size={15} /></button></div> : <div className="member-ticket-list">{tickets.map((ticket) => <button className="member-ticket" key={ticket.id} onClick={() => setActive(ticket)}><span className="member-ticket-icon"><MessageCircle size={18} /></span><span className="member-ticket-main"><strong>{ticket.subject}</strong><small>{ticket.category} · Updated {new Date(ticket.updatedAt || ticket.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</small></span><span className={`member-ticket-status ${String(ticket.status).toLowerCase()}`}>{ticket.status}</span><ArrowUpRight className="member-ticket-arrow" size={17} /></button>)}</div>}

        {creating && <div className="member-support-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreating(false); }}><section className="member-support-modal"><button className="member-support-close" onClick={() => setCreating(false)} aria-label="Close"><X size={18} /></button><span className="member-support-kicker">NEW CONVERSATION</span><h2>How can we help?</h2><form onSubmit={createTicket}><label>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="A short summary" required maxLength={120} /></label><label>Topic<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label><label>Message<textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell us a little more…" required rows={5} maxLength={2000} /></label><button className="member-support-submit" disabled={saving}>{saving ? 'Sending…' : 'Submit ticket'} <ArrowUpRight size={16} /></button></form></section></div>}

        {active && <div className="member-support-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setActive(null); }}><section className="member-support-modal member-ticket-detail"><button className="member-support-close" onClick={() => setActive(null)} aria-label="Close"><X size={18} /></button><span className="member-support-kicker">{active.category} · {active.status}</span><h2>{active.subject}</h2><div className="member-ticket-thread">{(active.messages || []).map((item, index) => <article key={item.id || index}><div><strong>{item.senderName || 'Support team'}</strong><time>{new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</time></div><p>{item.message}</p></article>)}</div><form onSubmit={sendReply} className="member-ticket-reply"><textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={3} placeholder="Write a reply…" required /><button disabled={saving || String(active.status).toLowerCase() === 'resolved'} aria-label="Send reply"><Send size={16} /></button></form>{String(active.status).toLowerCase() === 'resolved' && <small className="member-ticket-closed">This ticket is resolved.</small>}</section></div>}
    </div>;
}

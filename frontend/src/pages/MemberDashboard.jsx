import { useState, useEffect, useContext } from 'react';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import PasswordInput from '../components/ui/PasswordInput';
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ArrowUpRight, CalendarDays, Flame, MapPin, Sparkles } from 'lucide-react';
import './fitpass.css';
import './member-dashboard.css';
import './member-featured.css';

const PROFILE_AVATARS = [
    { url: '/avatars/milo.svg', name: 'Milo', trait: 'Easygoing' },
    { url: '/avatars/leo.svg', name: 'Leo', trait: 'Big energy' },
    { url: '/avatars/anya.svg', name: 'Anya', trait: 'Bold' },
    { url: '/avatars/zuri.svg', name: 'Zuri', trait: 'Curious' },
    { url: '/avatars/trex.svg', name: 'Rex', trait: 'Tiny roar' },
    { url: '/avatars/lion.svg', name: 'Sunny', trait: 'Brave heart' },
];

const MemberDashboard = () => {
    const { user, updateUserLocal } = useContext(AuthContext);
    const toast = useToast();
    const usesMockFitPassGateway = (import.meta.env.VITE_FITPASS_PAYMENT_GATEWAY || 'mock') === 'mock';
    const [plan, setPlan] = useState(null);
    const [attendance, setAttendance] = useState([]);
    const [payments, setPayments] = useState([]);
    const [sessionStatus, setSessionStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [paying, setPaying] = useState(false);
    const [paymentModal, setPaymentModal] = useState(false);
    const [customAmount, setCustomAmount] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState('');

    // Profile edit states
    const [profileModal, setProfileModal] = useState(false);
    const [profileName, setProfileName] = useState('');
    const [profileEmail, setProfileEmail] = useState('');
    const [profilePhone, setProfilePhone] = useState('');
    const [profilePassword, setProfilePassword] = useState('');
    const [updatingProfile, setUpdatingProfile] = useState(false);

    // FitPass specific states
    const [fitPassHistory, setFitPassHistory] = useState([]);
    const [gyms, setGyms] = useState([]);
    const [filterGym, setFilterGym] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [fitPassPlans, setFitPassPlans] = useState([]);
    const [renewalModalOpen, setRenewalModalOpen] = useState(false);
    const [selectedRenewalPlan, setSelectedRenewalPlan] = useState(null);

    const fetchFitPassHistory = async (params = {}) => {
        try {
            const query = new URLSearchParams();
            if (params.gymId) query.append('gymId', params.gymId);
            if (params.status) query.append('status', params.status);
            if (params.startDate) query.append('startDate', params.startDate);
            if (params.endDate) query.append('endDate', params.endDate);

            const { data } = await API.get(`/member-portal/sessions/history?${query.toString()}`);
            setFitPassHistory(data.history || []);
        } catch (error) {
            console.error('Error fetching FitPass history:', error);
        }
    };

    const fetchMemberData = async () => {
        try {
            const [planRes, attRes, payRes] = await Promise.all([
                API.get('/member-portal/plan'),
                API.get('/member-portal/attendance'),
                API.get('/member-portal/payments')
            ]);
            const memberPlan = planRes.data;
            setPlan(memberPlan);
            setAttendance(attRes.data);
            setPayments(payRes.data);
            const isH4Member = memberPlan?.isH4Member === true;
            if (isH4Member && memberPlan.homeGym) {
                setGyms([{ ...memberPlan.homeGym, name: memberPlan.homeGym.branchName || memberPlan.homeGym.name, address: memberPlan.homeGym.branchAddress || memberPlan.homeGym.address }]);
            }
            // Fetch FitPrime session status (sessionsRemaining / active session / cooldown).
            // Non-fatal: traditional (non-FitPrime) members just have no session balance.
            if (!isH4Member && memberPlan?.planId?.gymId === 'SYSTEM') {
                try {
                    const { data } = await API.get('/member-portal/sessions/status');
                    setSessionStatus(data);
                } catch { setSessionStatus(null); }
                try {
                    const { data } = await API.get('/member-portal/fitprime-plans');
                    setFitPassPlans(Array.isArray(data) ? data : data?.data || []);
                } catch (e) {
                    console.error('Error fetching FitPass plans:', e);
                    setFitPassPlans([]);
                }
            } else {
                setSessionStatus(null);
                setFitPassPlans([]);
            }

            // If it is a FitPass member, fetch partners list and history
            if (!isH4Member && memberPlan?.planId?.gymId === 'SYSTEM') {
                try {
                    const gymRes = await API.get('/member-portal/gyms');
                    setGyms(gymRes.data || []);
                } catch (e) {
                    console.error('Error fetching gyms:', e);
                }
                await fetchFitPassHistory();
            }
        } catch (error) {
            console.error('Error fetching member data:', error);
            const fallbackGymId = user?.gymId?._id || user?.gymId?.id || user?.gymId || '';
            if (String(fallbackGymId) === 'SYSTEM' && !String(user?.gymName || '').toLowerCase().includes('h4')) {
                try {
                    const { data } = await API.get('/member-portal/fitprime-plans');
                    setFitPassPlans(Array.isArray(data) ? data : data?.data || []);
                } catch (plansError) {
                    console.error('Error fetching FitPass plans:', plansError);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMemberData();

        // Load Razorpay script
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    const openProfileEditModal = () => {
        setProfileName(plan?.name || '');
        setProfileEmail(plan?.email || '');
        setProfilePhone(plan?.phone || '');
        setProfilePassword('');
        setSelectedAvatar(user?.profileImageUrl || '');
        setProfileModal(true);
    };

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setUpdatingProfile(true);
        try {
            const { data } = await API.put('/member-portal/profile', {
                password: profilePassword || undefined,
                ...(selectedAvatar ? { avatarUrl: selectedAvatar } : {})
            });
            updateUserLocal(data.user);
            toast.success('Profile updated successfully!');
            setProfileModal(false);
            fetchMemberData();
        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error(error.response?.data?.message || 'Failed to update profile.');
        } finally {
            setUpdatingProfile(false);
        }
    };

    const amountDue = plan ? (plan.planPrice - plan.paidAmount) : 0;

    const openPaymentModal = () => {
        setCustomAmount(amountDue.toString());
        setPaymentModal(true);
    };

    const handlePayment = async () => {
        const amount = parseFloat(customAmount);
        if (!amount || amount <= 0 || amount > amountDue) {
            toast.warning(`Please enter a valid amount between ₹1 and ₹${amountDue}`);
            return;
        }

        setPaymentModal(false);
        setPaying(true);
        try {
            // 1. Create Order with the custom partial amount
            const { data: order } = await API.post('/member-portal/payment/create-order', { amount });

            if (order.is_mock) {
                // Bypass Razorpay popup for mock orders
                try {
                    const verifyRes = await API.post('/member-portal/payment/verify', {
                        razorpay_order_id: order.id,
                        razorpay_payment_id: `pay_mock_${Math.random().toString(36).substring(2, 11)}`,
                        razorpay_signature: 'mock_signature',
                        amount_paid: amount
                    });
                    const remaining = verifyRes.data.remainingDue || 0;
                    if (remaining > 0) {
                        toast.success(`Payment of ₹${amount} successful! Remaining due: ₹${remaining}`);
                    } else {
                        toast.success('Payment successful! Your dues are fully cleared.');
                    }
                    fetchMemberData(); // Refresh UI
                } catch {
                    toast.error('Mock payment verification failed.');
                }
                return;
            }

            // 2. Open Razorpay Popup
            const options = {
                key: import.meta.env.VITE_RAZORPAY_KEY_ID || '',
                amount: order.amount,
                currency: order.currency,
                name: "GYM-CRM",
                description: `Payment for ${plan?.planId?.name}`,
                order_id: order.id,
                handler: async function (response) {
                    try {
                        // 3. Verify Payment — send the actual amount paid
                        const verifyRes = await API.post('/member-portal/payment/verify', {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            amount_paid: amount
                        });
                        const remaining = verifyRes.data.remainingDue || 0;
                        if (remaining > 0) {
                            toast.success(`Payment of ₹${amount} successful! Remaining due: ₹${remaining}`);
                        } else {
                            toast.success('Payment successful! Your dues are fully cleared.');
                        }
                        fetchMemberData(); // Refresh UI
                    } catch {
                        toast.error('Payment verification failed.');
                    }
                },
                prefill: {
                    name: plan?.name,
                    email: plan?.email,
                    contact: plan?.phone
                },
                theme: {
                    color: "#FEDF1E"
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (error) {
            console.error('Payment initiation failed:', error);
            toast.error(error.response?.data?.message || 'Failed to initiate payment.');
        } finally {
            setPaying(false);
        }
    };

    const handleFitPassRenewal = async () => {
        if (!selectedRenewalPlan) return;
        setPaying(true);
        let externalCheckout = false;
        try {
            const { data: order } = await API.post('/member-portal/purchase-plan/create-order', {
                planId: selectedRenewalPlan.id || selectedRenewalPlan._id,
                gateway: import.meta.env.VITE_FITPASS_PAYMENT_GATEWAY || 'mock',
            });
            const planId = selectedRenewalPlan.id || selectedRenewalPlan._id;
            const finishPurchase = async (payment) => {
                await API.post('/member-portal/purchase-plan/verify', {
                    razorpay_order_id: payment.razorpay_order_id || order.id,
                    razorpay_payment_id: payment.razorpay_payment_id || `pay_demo_${Date.now()}`,
                    razorpay_signature: payment.razorpay_signature,
                    mock_token: order.mock_token,
                    planId,
                });
                toast.success('Pass renewed. Your sessions and expiry have been updated.');
                setRenewalModalOpen(false);
                setSelectedRenewalPlan(null);
                await fetchMemberData();
            };

            if (order.is_mock) {
                if (!order.mock_token) throw new Error('The demo checkout could not verify its order.');
                await finishPurchase({});
            } else {
                const RazorpayCheckout = window.Razorpay;
                const key = order.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID;
                if (!RazorpayCheckout || !key) throw new Error('Razorpay checkout is not available in this browser.');
                externalCheckout = true;
                const checkout = new RazorpayCheckout({
                    key,
                    amount: order.amount,
                    currency: order.currency,
                    name: 'FitPass',
                    description: `${selectedRenewalPlan.name} membership`,
                    order_id: order.id,
                    prefill: { name: plan?.name, email: plan?.email, contact: plan?.phone },
                    theme: { color: '#FEDF1E' },
                    handler: async (response) => {
                        try { await finishPurchase(response); }
                        catch (error) { toast.error(error.response?.data?.message || 'Payment verification failed.'); }
                        finally { setPaying(false); }
                    },
                    modal: { ondismiss: () => setPaying(false) },
                });
                checkout.open();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || 'Could not renew your FitPass.');
        } finally {
            if (!externalCheckout) setPaying(false);
        }
    };

    if (loading) return <div className="spinner"></div>;

    const daysLeft = plan ? Math.ceil((new Date(plan.expiryDate) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
    // H4 access follows the member's assigned gym, even if the plan was linked
    // to the global SYSTEM gym. Only non-H4 SYSTEM-plan members use FitPass.
    const userGymId = user?.gymId?._id || user?.gymId?.id || user?.gymId || '';
    const isH4Member = plan?.isH4Member === true
        || String(user?.gymName || '').toLowerCase().includes('h4')
        || ['05a08fdf-7427-48a5-8b25-e18d5a5668cd', '327d37e7-f978-43a9-82ef-e6c4a4dc3c5d'].includes(String(userGymId));
    const isFitPrimeMember = !isH4Member && (plan?.planId?.gymId === 'SYSTEM' || String(userGymId) === 'SYSTEM');
    const sessionsRemaining = sessionStatus?.sessionsRemaining ?? plan?.sessionsRemaining ?? 0;
    const activeSession = sessionStatus?.active;
    const inCooldown = sessionStatus?.inCooldown;
    // amountDue is already computed above

    const activityRows = isFitPrimeMember
        ? fitPassHistory.filter((row) => row.accessStatus === 'Success').map((row) => row.checkInTimestamp)
        : attendance.map((row) => row.date);
    const today = new Date();
    const weekDays = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(today);
        date.setDate(today.getDate() - (6 - index));
        return { date, key: date.toLocaleDateString('en-CA'), label: date.toLocaleDateString('en-IN', { weekday: 'short' }) };
    });
    const weeklyActivity = weekDays.map((day) => ({
        day: day.label,
        visits: activityRows.filter((value) => value && new Date(value).toLocaleDateString('en-CA') === day.key).length,
    }));
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthlyVisits = activityRows.filter((value) => value && new Date(value) >= monthStart).length;
    const visitDates = new Set(activityRows.filter(Boolean).map((value) => new Date(value).toLocaleDateString('en-CA')));
    let streak = 0;
    const streakCursor = new Date(today);
    if (!visitDates.has(streakCursor.toLocaleDateString('en-CA'))) streakCursor.setDate(streakCursor.getDate() - 1);
    while (visitDates.has(streakCursor.toLocaleDateString('en-CA'))) {
        streak += 1;
        streakCursor.setDate(streakCursor.getDate() - 1);
    }
    const successfulVisits = activityRows.length;
    const progressPercent = isFitPrimeMember
        ? (sessionStatus?.sessionsTotal ? Math.max(0, Math.min(100, (sessionsRemaining / sessionStatus.sessionsTotal) * 100)) : 0)
        : (plan?.expiryDate ? Math.max(0, Math.min(100, (daysLeft / 30) * 100)) : 0);

    return (
        <div className="fade-in fitpass-member-dashboard">
            <section className="member-overview-hero">
                <div className="member-overview-copy">
                <div className="member-overview-eyebrow"><Sparkles size={14} /> {isFitPrimeMember ? 'FITPASS NETWORK' : isH4Member ? 'H4 MEMBERSHIP' : 'YOUR MEMBERSHIP'}</div>
                    <h1>Good {today.getHours() < 12 ? 'morning' : today.getHours() < 17 ? 'afternoon' : 'evening'},<br /><em>{(plan?.name || 'athlete').split(' ')[0]}.</em></h1>
                    <p>Your movement, membership and progress — all in one place.</p>
                    <div className="member-overview-actions">
                        {user?.profileImageUrl && <img src={user.profileImageUrl} alt="Your profile avatar" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '2px solid #FEDF1E' }} />}
                        {isFitPrimeMember && <a href="/explore-gyms">Explore gyms <ArrowUpRight size={15} /></a>}
                        <a href="/member-classes">Find a class <ArrowUpRight size={15} /></a>
                        <button type="button" className="member-profile-action" onClick={openProfileEditModal}>Edit profile</button>
                    </div>
                </div>
                <div className="member-pass-summary">
                    <div className="member-pass-summary-top"><span>{isFitPrimeMember ? 'FITPASS PASS' : isH4Member ? 'H4 MEMBERSHIP' : 'MEMBERSHIP PASS'}</span><span className={`member-active-pill ${isFitPrimeMember && sessionStatus?.planStatus !== 'Active' ? 'is-renewal-due' : ''}`}><i />{isFitPrimeMember ? (sessionStatus?.planStatus || 'No pass') : (plan?.status || 'No plan')}</span></div>
                    <strong>{plan?.planId?.name || 'Choose your next plan'}</strong>
                    <div className="member-pass-meta">{isFitPrimeMember ? `${sessionsRemaining} sessions remaining` : plan?.expiryDate ? `Valid until ${new Date(plan.expiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Your training journey starts here'}</div>
                    <div className="member-pass-progress"><span style={{ width: `${progressPercent}%` }} /></div>
                    <div className="member-pass-progress-label"><span>{isFitPrimeMember ? 'SESSION BALANCE' : 'MEMBERSHIP STATUS'}</span><span>{isFitPrimeMember ? `${sessionsRemaining} left` : daysLeft > 0 ? `${daysLeft} days left` : 'Check plan'}</span></div>
                </div>
                <div className="member-overview-mark"><Activity size={24} /></div>
            </section>

            <section className="member-metric-grid" aria-label="Your activity summary">
                <article className="member-metric-card"><span className="member-metric-icon"><Activity size={17} /></span><small>VISITS THIS MONTH</small><strong>{monthlyVisits}</strong><span>{successfulVisits} all-time check-ins</span></article>
                <article className="member-metric-card"><span className="member-metric-icon"><Flame size={17} /></span><small>ACTIVE STREAK</small><strong>{streak}<i> days</i></strong><span>{streak ? 'Keep your rhythm going' : 'Your next visit starts it'}</span></article>
                <article className="member-metric-card"><span className="member-metric-icon"><CalendarDays size={17} /></span><small>THIS WEEK</small><strong>{weeklyActivity.reduce((sum, item) => sum + item.visits, 0)}<i> visits</i></strong><span>Across the last 7 days</span></article>
                <article className="member-metric-card"><span className="member-metric-icon"><MapPin size={17} /></span><small>{isFitPrimeMember ? 'NETWORK ACCESS' : isH4Member ? 'HOME GYM' : 'MEMBERSHIP DUE'}</small><strong>{isFitPrimeMember ? gyms.length : isH4Member ? (plan?.homeGym?.branchName || plan?.homeGym?.name || 'H4') : `₹${amountDue.toLocaleString('en-IN')}`}</strong><span>{isFitPrimeMember ? 'partner gyms to explore' : isH4Member ? 'your assigned H4 gym' : amountDue > 0 ? 'Balance remaining' : 'All caught up'}</span></article>
            </section>

            <section className="member-analytics-grid">
                <article className="member-activity-panel">
                    <div className="member-panel-heading"><div><small>YOUR CONSISTENCY</small><h2>Weekly activity</h2></div><span className="member-panel-tag"><i /> LAST 7 DAYS</span></div>
                    <div className="member-chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={weeklyActivity} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}>
                                                <defs><linearGradient id="memberActivityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FEDF1E" stopOpacity={0.4}/><stop offset="100%" stopColor="#FEDF1E" stopOpacity={0.02}/></linearGradient></defs>
                        <CartesianGrid vertical={false} stroke="#EDE8DE" strokeDasharray="3 5" />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#000000', fontSize: 11, fontWeight: 700 }} dy={9}/>
                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#000000', fontSize: 10, fontWeight: 700 }} width={30}/>
                        <Tooltip contentStyle={{ border: '1.5px solid #DFD7C7', borderRadius: 10, background: '#FFFFFF', color: '#000000', fontWeight: 700, fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }} />
                        <Area type="monotone" dataKey="visits" name="Check-ins" stroke="#FEDF1E" strokeWidth={3.5} fill="url(#memberActivityFill)" activeDot={{ r: 6, fill: '#000000', stroke: '#FEDF1E', strokeWidth: 3 }}/>
                    </AreaChart></ResponsiveContainer></div>
                    <div className="member-chart-footer"><span>One visit at a time adds up.</span><b>{weeklyActivity.reduce((sum, item) => sum + item.visits, 0)} check-ins this week</b></div>
                </article>
                <article className="member-next-panel"><div className="member-panel-heading"><div><small>GOOD TO KNOW</small><h2>Your next step</h2></div></div>
                    <div className="member-next-content"><span className="member-next-icon"><CalendarDays size={20}/></span><div><b>{plan?.status === 'Frozen' ? 'Your plan is paused' : daysLeft <= 7 && !isFitPrimeMember ? 'Renewal is coming up' : isFitPrimeMember && inCooldown ? 'Rest, then go again' : 'Keep building your routine'}</b><p>{plan?.status === 'Frozen' ? 'Resume your membership when you are ready to return.' : daysLeft <= 7 && !isFitPrimeMember ? `Your plan ${daysLeft > 0 ? `expires in ${daysLeft} days` : 'has expired'}. Renew to keep your momentum.` : isFitPrimeMember && inCooldown ? 'Your cooldown is active. Your next check-in opens after the timer ends.' : 'Check your weekly activity and explore a new way to train.'}</p></div></div>
                    {amountDue > 0 && <button className="member-next-button" onClick={openPaymentModal}>Clear ₹{amountDue.toLocaleString('en-IN')} balance <ArrowUpRight size={15}/></button>}
                    {amountDue <= 0 && <a className="member-next-button" href={isFitPrimeMember ? '/explore-gyms' : '/member-classes'}>{isFitPrimeMember ? 'Find your next gym' : 'Explore classes'} <ArrowUpRight size={15}/></a>}
                </article>
            </section>

            {(isFitPrimeMember ? gyms.length > 0 : isH4Member && gyms.length > 0) && <section className="member-featured-section">
                <div className="member-panel-heading"><div><small>{isFitPrimeMember ? 'THE FITPASS NETWORK' : 'YOUR H4 MEMBERSHIP'}</small><h2>{isFitPrimeMember ? 'Places to move next' : 'Your assigned gym'}</h2></div>{isFitPrimeMember && <a href="/explore-gyms">Explore all gyms <ArrowUpRight size={15}/></a>}</div>
                <div className="member-featured-grid">{gyms.slice(0, 3).map((gym) => {
                    const image = gym.images?.[0] || gym.imageUrl || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=700&q=80';
                    const content = <>
                        <img src={image} alt={gym.name || (isFitPrimeMember ? 'FitPass partner gym' : 'H4 gym')} loading="lazy"/>
                        <span className="member-featured-overlay"/>
                        <span className="member-featured-content"><small><MapPin size={12}/> {isFitPrimeMember ? 'FITPASS PARTNER' : 'ASSIGNED H4 GYM'}</small><b>{gym.name}</b><span>{gym.address || gym.branchAddress || (isFitPrimeMember ? 'Explore this gym' : 'Your home gym')}</span></span>
                        {isFitPrimeMember && <ArrowUpRight className="member-featured-arrow" size={18}/>}
                    </>;
                    return isFitPrimeMember
                        ? <a className="member-featured-gym" href="/explore-gyms" key={gym.id || gym._id || gym.name}>{content}</a>
                        : <div className="member-featured-gym" key={gym.id || gym._id || gym.name}>{content}</div>;
                })}</div>
            </section>}

            {/* Top row: Plan + Balance */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>

                {/* Plan Card */}
                <div className="glass" style={{ padding: '1.1rem', borderRadius: '16px', borderLeft: '6px solid #FEDF1E' }}>
                    <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Plan</h3>
                    <p style={{ fontSize: '1.5rem', fontWeight: '800', margin: '0.5rem 0' }}>{plan?.planId?.name || 'No Plan'}</p>
                    {plan?.status === 'Frozen' && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'var(--primary-muted)', color: 'var(--primary-color)', padding: '0.3rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '700', marginBottom: '0.75rem' }}>
                             Membership Frozen
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                        {isFitPrimeMember ? (
                            <>
                                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                    Sessions remaining
                                </span>
                                <span style={{
                                    background: sessionsRemaining > 0 ? 'var(--success-light)' : 'var(--danger-light)',
                                    color: sessionsRemaining > 0 ? 'var(--success-color)' : 'var(--danger-color)',
                                    padding: '0.25rem 0.75rem', borderRadius: '9999px',
                                    fontSize: '0.75rem', fontWeight: '700'
                                }}>
                                     {sessionsRemaining} left
                                </span>
                            </>
                        ) : (
                            <>
                                <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                    Expires: {new Date(plan?.expiryDate).toLocaleDateString()}
                                </span>
                                <span style={{
                                    background: plan?.status === 'Frozen' ? 'var(--primary-light)' : daysLeft > 7 ? 'var(--success-light)' : 'var(--danger-light)',
                                    color: plan?.status === 'Frozen' ? 'var(--primary-color)' : daysLeft > 7 ? 'var(--success-color)' : 'var(--danger-color)',
                                    padding: '0.25rem 0.75rem', borderRadius: '9999px',
                                    fontSize: '0.75rem', fontWeight: '700'
                                }}>
                                    {plan?.status === 'Frozen' ? ' Paused' : daysLeft > 0 ? `${daysLeft} Days Left` : 'Expired'}
                                </span>
                            </>
                        )}
                    </div>
                    {isFitPrimeMember && (
                        <button
                            type="button"
                            className="btn btn-primary fitpass-renew-trigger"
                            onClick={() => { setSelectedRenewalPlan(null); setRenewalModalOpen(true); }}
                        >
                            Renew or change pass <ArrowUpRight size={16} />
                        </button>
                    )}
                </div>

                {/* Due Balance */}
                <div className="glass" style={{ padding: '1.1rem', borderRadius: '16px', borderLeft: '6px solid #000000', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                        <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Due Balance</h3>
                        <p style={{
                            fontSize: '1.5rem', fontWeight: '800', margin: '0.5rem 0',
                            color: amountDue > 0 ? 'var(--danger-color)' : 'var(--success-color)'
                        }}>
                            ₹{amountDue}
                        </p>
                        {amountDue > 0 && (
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                                Paid ₹{plan?.paidAmount} of ₹{plan?.planPrice}
                            </p>
                        )}
                    </div>
                    <div>
                        {amountDue > 0 && (
                            <button
                                onClick={openPaymentModal}
                                disabled={paying}
                                className="btn btn-primary"
                                style={{ width: '100%', marginTop: '1rem', background: '#FEDF1E', color: '#000000', fontWeight: '900', border: '1.5px solid #B9983D' }}
                            >
                                {paying ? 'Processing...' : ` Pay Now`}
                            </button>
                        )}
                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Total Paid: ₹{plan?.paidAmount}</p>
                    </div>
                </div>

            </div>

            {/* FitPrime session status banner (active session or cooldown) */}
            {isFitPrimeMember && (activeSession || inCooldown) && (
                <div className="glass" style={{
                    padding: '1rem 1.5rem', borderRadius: '14px', marginBottom: '1.5rem',
                    borderLeft: `5px solid ${activeSession ? '#10b981' : '#f59e0b'}`,
                    display: 'flex', alignItems: 'center', gap: '1rem'
                }}>
                    <span style={{ fontSize: '1.6rem' }}>{activeSession ? '' : ''}</span>
                    <div>
                        {activeSession ? (
                            <>
                                <div style={{ fontWeight: '800', fontSize: '0.95rem' }}>Session active</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    Ends at {new Date(sessionStatus.sessionEndsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. A 3-hour cooldown starts then.
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{ fontWeight: '800', fontSize: '0.95rem' }}>Cooldown in effect</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    You can check in again after {new Date(sessionStatus.cooldownEndsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Quick Action Navigation */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                {isFitPrimeMember && (
                    <a href="/explore-gyms" style={{ textDecoration: 'none' }}>
                        <div className="glass" style={{
                            padding: '1.25rem 1.5rem', borderRadius: '14px',
                            borderLeft: '5px solid var(--primary)', cursor: 'pointer',
                            transition: 'transform 0.2s', display: 'flex', alignItems: 'center', gap: '1rem'
                        }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <span style={{ fontSize: '2rem' }}></span>
                            <div>
                                <div style={{ fontWeight: '800', fontSize: '0.95rem' }}>Explore Partner Gyms</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Discover &amp; check-in at FitPass gyms</div>
                            </div>
                        </div>
                    </a>
                )}

                <a href="/member-classes" style={{ textDecoration: 'none' }}>
                    <div className="glass" style={{
                        padding: '1.25rem 1.5rem', borderRadius: '14px',
                        borderLeft: '5px solid #f59e0b', cursor: 'pointer',
                        transition: 'transform 0.2s', display: 'flex', alignItems: 'center', gap: '1rem'
                    }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <span style={{ fontSize: '2rem' }}></span>
                        <div>
                            <div style={{ fontWeight: '800', fontSize: '0.95rem' }}>Browse Classes</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Yoga, Zumba, HIIT &amp; more</div>
                        </div>
                    </div>
                </a>
            </div>

            {/* History Tables */}
            <div className="member-history-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                {/* Attendance or FitPass History */}
                {isFitPrimeMember ? (
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <h3 style={{ margin: 0 }}>FitPass Session History</h3>
                            <button className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }} 
                                    onClick={() => {
                                        setFilterGym('');
                                        setFilterStatus('');
                                        setFilterStartDate('');
                                        setFilterEndDate('');
                                        fetchFitPassHistory({});
                                    }}>
                                Reset
                            </button>
                        </div>

                        {/* Filter inputs */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
                            <select className="input" value={filterGym} onChange={e => {
                                setFilterGym(e.target.value);
                                fetchFitPassHistory({ gymId: e.target.value, status: filterStatus, startDate: filterStartDate, endDate: filterEndDate });
                            }} style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>
                                <option value="">All Partner Gyms</option>
                                {gyms.map(g => (
                                    <option key={g._id || g.id} value={g._id || g.id}>{g.name}</option>
                                ))}
                            </select>

                            <select className="input" value={filterStatus} onChange={e => {
                                setFilterStatus(e.target.value);
                                fetchFitPassHistory({ gymId: filterGym, status: e.target.value, startDate: filterStartDate, endDate: filterEndDate });
                            }} style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}>
                                <option value="">All Statuses</option>
                                <option value="Success">Success</option>
                                <option value="Failed">Failed</option>
                            </select>

                            <input type="date" className="input" value={filterStartDate} onChange={e => {
                                setFilterStartDate(e.target.value);
                                fetchFitPassHistory({ gymId: filterGym, status: filterStatus, startDate: e.target.value, endDate: filterEndDate });
                            }} style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }} />

                            <input type="date" className="input" value={filterEndDate} onChange={e => {
                                setFilterEndDate(e.target.value);
                                fetchFitPassHistory({ gymId: filterGym, status: filterStatus, startDate: filterStartDate, endDate: e.target.value });
                            }} style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }} />
                        </div>

                        {fitPassHistory.length > 0 ? (
                            <div style={{ overflowX: 'auto' }}>
                                <table className="table" style={{ width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th>Date &amp; Time</th>
                                            <th>Gym Visited</th>
                                            <th>Deducted</th>
                                            <th>Remaining</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {fitPassHistory.map((log, idx) => (
                                            <tr key={log.id || log._id || idx}>
                                                <td>{new Date(log.checkInTimestamp).toLocaleString()}</td>
                                                <td>
                                                    <span style={{ fontWeight: '600' }}>{log.gymName}</span>
                                                    {log.branchNameVisited && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Branch: {log.branchNameVisited}</span>}
                                                </td>
                                                <td style={{ fontWeight: '700', color: log.sessionsDeducted > 0 ? 'var(--primary-color)' : 'inherit' }}>
                                                    {log.sessionsDeducted}
                                                </td>
                                                <td>{log.remainingSessionsAfter}</td>
                                                <td>
                                                    <span className={`badge ${log.accessStatus === 'Success' ? 'badge-active' : 'badge-inactive'}`} 
                                                          title={log.failureReason || ''}
                                                          style={{
                                                              background: log.accessStatus === 'Success' ? 'var(--success-light)' : 'var(--danger-light)',
                                                              color: log.accessStatus === 'Success' ? 'var(--success-color)' : 'var(--danger-color)'
                                                          }}>
                                                        {log.accessStatus}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No FitPass history found.</p>}
                    </div>
                ) : (
                    <div className="card">
                        <h3 style={{ marginBottom: '1rem' }}>Recent Attendance</h3>
                        {attendance.length > 0 ? (
                            <table className="table">
                                <thead>
                                    <tr><th>Date</th><th>Status</th></tr>
                                </thead>
                                <tbody>
                                    {attendance.slice(0, 5).map((att, idx) => (
                                        <tr key={att.id || att._id || idx}>
                                            <td>{new Date(att.date).toLocaleDateString()}</td>
                                            <td><span className="badge badge-active">Present</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : <p style={{ color: 'var(--text-secondary)' }}>No attendance records yet.</p>}
                    </div>
                )}

                {/* Payment History */}
                <div className="card">
                    <h3 style={{ marginBottom: '1rem' }}>Payment History</h3>
                    {payments.length > 0 ? (
                        <table className="table">
                            <thead>
                                <tr><th>Date</th><th>Amount</th><th>Method</th></tr>
                            </thead>
                            <tbody>
                                {payments.slice(0, 5).map((pay, idx) => (
                                    <tr key={pay.id || pay._id || idx}>
                                        <td>{new Date(pay.date).toLocaleDateString()}</td>
                                        <td style={{ fontWeight: '700' }}>₹{pay.amount}</td>
                                        <td>{pay.method}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <p style={{ color: 'var(--text-secondary)' }}>No payments recorded yet.</p>}
                </div>
            </div>

            {/* FitPass self-serve renewal with the development demo gateway. */}
            {renewalModalOpen && (
                <div className="fitpass-renewal-overlay" onMouseDown={(event) => {
                    if (event.target === event.currentTarget && !paying) {
                        setRenewalModalOpen(false);
                        setSelectedRenewalPlan(null);
                    }
                }}>
                    <section className="fitpass-renewal-modal" role="dialog" aria-modal="true" aria-labelledby="fitpass-renewal-title">
                        <button type="button" className="fitpass-renewal-close" aria-label="Close renewal" onClick={() => {
                            if (!paying) { setRenewalModalOpen(false); setSelectedRenewalPlan(null); }
                        }}>×</button>
                        <span className="fitpass-renewal-kicker">FITPASS MEMBERSHIP</span>
                        <h2 id="fitpass-renewal-title">{selectedRenewalPlan ? 'Review your pass' : 'Renew your pass'}</h2>
                        {selectedRenewalPlan ? (
                            <>
                                <div className="fitpass-renewal-summary">
                                    <strong>{selectedRenewalPlan.name}</strong>
                                    <span>₹{Number(selectedRenewalPlan.price).toLocaleString('en-IN')}</span>
                                    <small>{selectedRenewalPlan.sessions} sessions · {selectedRenewalPlan.duration || 30} {selectedRenewalPlan.durationUnit || 'days'}</small>
                                </div>
                                <p className="fitpass-demo-note">
                                    {usesMockFitPassGateway
                                        ? 'Demo checkout · No real payment will be collected. This temporary mock gateway can be switched to Razorpay when ready.'
                                        : 'Secure checkout by Razorpay. Your pass renews after Razorpay confirms the payment.'}
                                </p>
                                <div className="fitpass-renewal-actions">
                                    <button type="button" className="btn btn-secondary" disabled={paying} onClick={() => setSelectedRenewalPlan(null)}>Back to passes</button>
                                    <button type="button" className="btn btn-primary" disabled={paying} onClick={handleFitPassRenewal}>
                                        {paying ? 'Processing…' : `${usesMockFitPassGateway ? 'Confirm demo payment' : 'Continue to payment'} · ₹${Number(selectedRenewalPlan.price).toLocaleString('en-IN')}`}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="fitpass-renewal-copy">Choose a session pass. If your current pass is still active, its remaining time carries forward.</p>
                                <div className="fitpass-renewal-options">
                                    {fitPassPlans.map((fitPassPlan) => (
                                        <button type="button" key={fitPassPlan.id || fitPassPlan._id} className="fitpass-renewal-option" onClick={() => setSelectedRenewalPlan(fitPassPlan)}>
                                            <span><strong>{fitPassPlan.name}</strong><small>{fitPassPlan.sessions} sessions · {fitPassPlan.duration || 30} {fitPassPlan.durationUnit || 'days'}</small></span>
                                            <b>₹{Number(fitPassPlan.price).toLocaleString('en-IN')} <ArrowUpRight size={16} /></b>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </section>
                </div>
            )}

            {/* Partial Payment Modal */}
            {paymentModal && (
                <div
                    onClick={() => setPaymentModal(false)}
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 2000
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'var(--bg)', borderRadius: '20px',
                            padding: '2rem', width: '100%', maxWidth: '420px',
                            boxShadow: 'var(--shadow-lg)',
                            border: '1px solid var(--border)'
                        }}
                    >
                        <h3 style={{ marginBottom: '0.5rem', fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)' }}> Make a Payment</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                            Total Due: <strong style={{ color: 'var(--danger-color)' }}>₹{amountDue}</strong>
                        </p>
 
                        {/* Quick Amount Buttons */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                            {[
                                { label: '25%', val: Math.ceil(amountDue * 0.25) },
                                { label: '50%', val: Math.ceil(amountDue * 0.5) },
                                { label: '75%', val: Math.ceil(amountDue * 0.75) },
                                { label: 'Full', val: amountDue },
                            ].map(opt => (
                                <button
                                    key={opt.label}
                                    onClick={() => setCustomAmount(opt.val.toString())}
                                    className="btn"
                                    style={{
                                        flex: 1, fontSize: '0.8rem', padding: '0.4rem 0.6rem',
                                        background: parseFloat(customAmount) === opt.val ? 'var(--primary-color)' : 'var(--primary-light)',
                                        color: parseFloat(customAmount) === opt.val ? 'var(--text-inverse)' : 'var(--primary-hover)',
                                        border: '1px solid var(--primary-color)',
                                        borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                >
                                    {opt.label}<br />
                                    <span style={{ fontSize: '0.7rem' }}>₹{opt.val}</span>
                                </button>
                            ))}
                        </div>
 
                        {/* Custom Amount Input */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                                Enter Amount (₹1 – ₹{amountDue})
                            </label>
                            <input
                                type="number"
                                className="input"
                                value={customAmount}
                                min={1}
                                max={amountDue}
                                onChange={e => setCustomAmount(e.target.value)}
                                style={{ width: '100%', fontSize: '1.2rem', fontWeight: '700', textAlign: 'center' }}
                                placeholder={`Max ₹${amountDue}`}
                            />
                            {parseFloat(customAmount) > 0 && parseFloat(customAmount) < amountDue && (
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.4rem', textAlign: 'center' }}>
                                    ₹{(amountDue - parseFloat(customAmount)).toFixed(0)} will remain as due after this payment
                                </p>
                            )}
                        </div>
 
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={() => setPaymentModal(false)}
                                className="btn btn-secondary"
                                style={{ flex: 1 }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePayment}
                                className="btn btn-primary"
                                style={{ flex: 2, background: 'var(--primary-hover)' }}
                                disabled={!customAmount || parseFloat(customAmount) <= 0 || parseFloat(customAmount) > amountDue}
                            >
                                Pay ₹{parseFloat(customAmount) > 0 ? parseFloat(customAmount) : '—'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Profile Modal */}
            {profileModal && (
                <div
                    onClick={() => setProfileModal(false)}
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 2000
                    }}
                >
                    <form
                        onSubmit={handleUpdateProfile}
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'var(--bg)', borderRadius: '20px',
                            padding: '2rem', width: '90%', maxWidth: '450px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.3)', border: '1px solid var(--border-color)',
                            display: 'flex', flexDirection: 'column', gap: '1rem'
                        }}
                    >
                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800' }}>Edit Profile &amp; Credentials</h3>
                        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                            <legend style={{ fontWeight: 700, marginBottom: 10 }}>Choose your avatar</legend>
                            <div className="member-avatar-grid">
                                {PROFILE_AVATARS.map(({ url, name, trait }) => (
                                    <button
                                        type="button"
                                        key={url}
                                        className={`member-avatar-option${selectedAvatar === url ? ' is-selected' : ''}`}
                                        onClick={() => setSelectedAvatar(url)}
                                        aria-pressed={selectedAvatar === url}
                                        aria-label={`${name}, ${trait}`}
                                    >
                                        <img src={url} alt="" width="64" height="64" />
                                        <span className="member-avatar-name">{name}</span>
                                        <span className="member-avatar-trait">{trait}</span>
                                    </button>
                                ))}
                            </div>
                        </fieldset>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                            Your name, email, and mobile number are locked. Contact your gym admin to change them.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)' }}>Full Name</label>
                            <input
                                type="text"
                                className="input"
                                disabled
                                readOnly
                                value={profileName}
                                style={{ width: '100%', opacity: 0.65, cursor: 'not-allowed' }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)' }}>Email Address</label>
                            <input
                                type="email"
                                className="input"
                                disabled
                                readOnly
                                value={profileEmail}
                                style={{ width: '100%', opacity: 0.65, cursor: 'not-allowed' }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)' }}>Phone Number</label>
                            <input
                                type="tel"
                                className="input"
                                disabled
                                readOnly
                                value={profilePhone}
                                style={{ width: '100%', opacity: 0.65, cursor: 'not-allowed' }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)' }}>New Password</label>
                            <PasswordInput
                                placeholder="Leave blank to keep current password"
                                value={profilePassword}
                                onChange={e => setProfilePassword(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                            <button
                                type="button"
                                onClick={() => setProfileModal(false)}
                                className="btn btn-secondary"
                                style={{ flex: 1 }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                style={{ flex: 1 }}
                                disabled={updatingProfile || (!profilePassword && !selectedAvatar)}
                            >
                                {updatingProfile ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default MemberDashboard;

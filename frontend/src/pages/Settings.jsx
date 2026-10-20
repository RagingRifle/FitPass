import { useState, useEffect, useContext } from 'react';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { 
    Sliders, Bell, Building2, Clock, Landmark, UserCheck, Key, Check, AlertCircle, Save, Sparkles
} from 'lucide-react';

const Settings = () => {
    const { user } = useContext(AuthContext);
    const [subTab, setSubTab] = useState('profile'); // 'profile' | 'branding' | 'operations' | 'finance' | 'notifications' | 'hours'
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    // --- Tab 0: Profile & Account Credentials State ---
    const [profileName, setProfileName] = useState(user?.name || '');
    const [profileEmail, setProfileEmail] = useState(user?.email || '');
    const [profilePhone, setProfilePhone] = useState(user?.phone || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // --- Tab 1: Branding State ---
    const [gymName, setGymName] = useState('GYM CRM PRO');
    const [tagline, setTagline] = useState('Elevate Your Fitness Operations');
    const [logoUrl, setLogoUrl] = useState('https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=80&auto=format&fit=crop&q=60');
    const [brandTheme, setBrandTheme] = useState('dark');

    // --- Tab 2: Operations & QR State ---
    const [sessionDuration, setSessionDuration] = useState(120);
    const [scanCooldown, setScanCooldown] = useState(300);
    const [qrRefreshRate, setQrRefreshRate] = useState(15);
    const [checkInSound, setCheckInSound] = useState(true);

    // --- Tab 3: Finance & Tax State ---
    const [currency, setCurrency] = useState('INR');
    const [taxRate, setTaxRate] = useState(18);
    const [taxId, setTaxId] = useState('27AAAAA1111A1Z1');
    const [razorpayEnabled, setRazorpayEnabled] = useState(true);
    const [razorpayKey, setRazorpayKey] = useState('rzp_test_xxxxxxxxx');

    // --- Tab 4: Notifications State ---
    const [emailAlerts, setEmailAlerts] = useState(true);
    const [smsAlerts, setSmsAlerts] = useState(false);
    const [pushAlerts, setPushAlerts] = useState(true);

    // --- Tab 5: Business Hours State ---
    const [hours, setHours] = useState({
        weekday: '06:00 AM - 10:00 PM',
        saturday: '07:00 AM - 08:00 PM',
        sunday: '08:00 AM - 02:00 PM'
    });

    useEffect(() => {
        if (user) {
            if (user.name) setProfileName(user.name);
            if (user.email) setProfileEmail(user.email);
            if (user.phone) setProfilePhone(user.phone);
        }

        const loadSettings = async () => {
            try {
                const res = await API.get('/gyms/settings');
                const data = res.data;
                if (data) {
                    if (data.gymName) setGymName(data.gymName);
                    if (data.tagline) setTagline(data.tagline);
                    if (data.logoUrl) setLogoUrl(data.logoUrl);
                    if (data.brandTheme) setBrandTheme(data.brandTheme);
                    if (data.sessionDuration) setSessionDuration(data.sessionDuration);
                    if (data.scanCooldown) setScanCooldown(data.scanCooldown);
                    if (data.qrRefreshRate) setQrRefreshRate(data.qrRefreshRate);
                    if (data.checkInSound !== undefined) setCheckInSound(data.checkInSound);
                    if (data.currency) setCurrency(data.currency);
                    if (data.taxRate !== undefined) setTaxRate(data.taxRate);
                    if (data.taxId) setTaxId(data.taxId);
                    if (data.razorpayEnabled !== undefined) setRazorpayEnabled(data.razorpayEnabled);
                    if (data.razorpayKey) setRazorpayKey(data.razorpayKey);
                    if (data.emailAlerts !== undefined) setEmailAlerts(data.emailAlerts);
                    if (data.smsAlerts !== undefined) setSmsAlerts(data.smsAlerts);
                    if (data.pushAlerts !== undefined) setPushAlerts(data.pushAlerts);
                    if (data.hours) {
                        try {
                            const parsed = JSON.parse(data.hours);
                            setHours(parsed);
                        } catch (e) {
                            console.error("Error parsing hours", e);
                        }
                    }
                }
            } catch (err) {
                console.error('Error loading settings', err);
            }
        };
        loadSettings();
    }, [user]);

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        if (newPassword && newPassword !== confirmPassword) {
            setLoading(false);
            return setError('New passwords do not match');
        }

        try {
            await API.put('/auth/profile', {
                name: profileName,
                email: profileEmail,
                phone: profilePhone,
                currentPassword,
                newPassword: newPassword || undefined
            });
            setLoading(false);
            setMessage('Account credentials updated successfully!');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            setLoading(false);
            setError(err.response?.data?.message || 'Error updating account credentials');
        }
    };

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        try {
            const payload = {
                gymName, tagline, logoUrl, brandTheme,
                sessionDuration, scanCooldown, qrRefreshRate, checkInSound,
                currency, taxRate, taxId, razorpayEnabled, razorpayKey,
                emailAlerts, smsAlerts, pushAlerts,
                hours: JSON.stringify(hours)
            };
            
            await API.put('/gyms/settings', payload);
            setLoading(false);
            setMessage('Settings & preferences saved successfully!');
        } catch (err) {
            setLoading(false);
            setError(err.response?.data?.message || 'Error saving settings');
        }
    };

    const navItems = [
        { id: 'profile', label: 'My Account & Credentials', icon: UserCheck },
        { id: 'branding', label: 'Gym Branding & Theme', icon: Building2 },
        { id: 'operations', label: 'Operations & QR Parameters', icon: Sliders },
        { id: 'finance', label: 'Finance & Tax Setup', icon: Landmark },
        { id: 'notifications', label: 'Notification Routing', icon: Bell },
        { id: 'hours', label: 'Business Hours', icon: Clock }
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header */}
            <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Settings & Configurations</h2>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#6B7280' }}>
                    Manage platform parameters, security credentials, branding, and automated rules
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '1.5rem', alignItems: 'start' }}>
                {/* LEFT NAV PANEL */}
                <div style={{
                    background: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '16px',
                    padding: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}>
                    <div style={{ padding: '0.5rem 0.75rem 0.25rem', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#EA580C' }}>
                        System Preferences
                    </div>

                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = subTab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setSubTab(item.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '10px',
                                    border: isActive ? '1px solid #FDBA74' : '1px solid transparent',
                                    background: isActive ? '#FFF7ED' : 'transparent',
                                    color: isActive ? '#C2410C' : '#4B5563',
                                    fontWeight: isActive ? 700 : 500,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.2s ease',
                                    outline: 'none'
                                }}
                            >
                                <Icon size={18} color={isActive ? '#EA580C' : '#6B7280'} />
                                <span style={{ flex: 1 }}>{item.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* RIGHT MAIN PANEL */}
                <div style={{
                    background: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '16px',
                    padding: '2rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}>
                    {message && (
                        <div style={{
                            background: '#F0FDF4',
                            border: '1px solid #BBF7D0',
                            color: '#15803D',
                            borderRadius: '10px',
                            padding: '0.85rem 1rem',
                            marginBottom: '1.5rem',
                            fontSize: '0.88rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}>
                            <Check size={18} color="#15803D" />
                            <span>{message}</span>
                        </div>
                    )}

                    {error && (
                        <div style={{
                            background: '#FEF2F2',
                            border: '1px solid #FECACA',
                            color: '#B91C1C',
                            borderRadius: '10px',
                            padding: '0.85rem 1rem',
                            marginBottom: '1.5rem',
                            fontSize: '0.88rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}>
                            <AlertCircle size={18} color="#B91C1C" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={subTab === 'profile' ? handleSaveProfile : handleSaveSettings}>
                        {/* TAB 0: Account & Profile */}
                        {subTab === 'profile' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                    <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.15rem', color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <UserCheck color="#EA580C" size={22} /> Account & Security Credentials
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#6B7280' }}>
                                        Update your login credentials (email and mobile number) and maintain account password security.
                                    </p>
                                </div>

                                <hr style={{ borderColor: '#E5E7EB', margin: '0.5rem 0' }} />

                                <div className="input-group">
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Full Name</label>
                                    <input type="text" className="input" style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#111827' }} value={profileName} onChange={(e) => setProfileName(e.target.value)} required />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="input-group">
                                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Login Email Address</label>
                                        <input type="email" className="input" style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#111827' }} value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} required />
                                    </div>
                                    <div className="input-group">
                                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Mobile Phone Number</label>
                                        <input type="text" className="input" style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#111827' }} value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} placeholder="+91 9876543210" />
                                    </div>
                                </div>

                                <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '1.25rem', marginTop: '0.5rem' }}>
                                    <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Key size={18} color="#EA580C" /> Update Password
                                    </h4>

                                    <div className="input-group" style={{ marginBottom: '1rem' }}>
                                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: '#4B5563' }}>Current Password</label>
                                        <input type="password" className="input" style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#111827' }} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password to authorize change" />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div className="input-group">
                                            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: '#4B5563' }}>New Password</label>
                                            <input type="password" className="input" style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#111827' }} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimum 6 characters" />
                                        </div>
                                        <div className="input-group">
                                            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: '#4B5563' }}>Confirm New Password</label>
                                            <input type="password" className="input" style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#111827' }} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 1: Gym Branding */}
                        {subTab === 'branding' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                    <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.15rem', color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Building2 color="#EA580C" size={22} /> Gym Branding & Identity
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#6B7280' }}>
                                        Customize your gym title, brand slogan, logo mark, and theme mode.
                                    </p>
                                </div>

                                <hr style={{ borderColor: '#E5E7EB', margin: '0.5rem 0' }} />

                                {/* Preview Pill */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '1.25rem',
                                    background: '#FFF7ED', padding: '1.25rem',
                                    borderRadius: '12px', border: '1px solid #FFEDD5'
                                }}>
                                    <img src={logoUrl} alt="Logo preview" style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover', border: '2px solid #EA580C' }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#111827' }}>{gymName || 'YOUR GYM BRAND'}</div>
                                        <div style={{ color: '#4B5563', fontSize: '0.82rem' }}>{tagline || 'Your Slogan Here'}</div>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: '#C2410C', fontWeight: 600, background: '#FFEDD5', padding: '0.3rem 0.6rem', borderRadius: '6px' }}>
                                        Live Preview
                                    </span>
                                </div>

                                <div className="input-group">
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Gym / Organization Name</label>
                                    <input type="text" className="input" style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#111827' }} value={gymName} onChange={(e) => setGymName(e.target.value)} required />
                                </div>

                                <div className="input-group">
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Brand Tagline</label>
                                    <input type="text" className="input" style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#111827' }} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="e.g. Elevate Your Fitness Operations" />
                                </div>

                                <div className="input-group">
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Logo Image URL</label>
                                    <input type="text" className="input" style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#111827' }} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
                                </div>

                                <div className="input-group">
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Global Theme Palette</label>
                                    <select className="input" style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#111827' }} value={brandTheme} onChange={(e) => setBrandTheme(e.target.value)}>
                                        <option value="light">Crisp White Light (Default)</option>
                                        <option value="dark">Warm Amber-Gold Dark</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* TAB 2: Operations & QR */}
                        {subTab === 'operations' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                    <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.15rem', color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Sliders color="#EA580C" size={22} /> Operations & Check-In Parameters
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#6B7280' }}>
                                        Configure attendance session limits, QR scanner refresh intervals, and audio alerts.
                                    </p>
                                </div>

                                <hr style={{ borderColor: '#E5E7EB', margin: '0.5rem 0' }} />

                                <div className="input-group">
                                    <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Max Session Duration (Minutes)</label>
                                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: '#6B7280' }}>Automatic checkout limit for member active pass sessions.</p>
                                    <input type="number" className="input" style={{ maxWidth: '200px', background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#111827' }} value={sessionDuration} onChange={(e) => setSessionDuration(parseInt(e.target.value) || 0)} />
                                </div>

                                <div className="input-group">
                                    <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>QR Scan Cooldown Delay (Seconds)</label>
                                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: '#6B7280' }}>Minimum waiting period before registering another check-in scan.</p>
                                    <input type="number" className="input" style={{ maxWidth: '200px', background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#111827' }} value={scanCooldown} onChange={(e) => setScanCooldown(parseInt(e.target.value) || 0)} />
                                </div>

                                <div className="input-group">
                                    <label style={{ display: 'block', marginBottom: '0.2rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>QR Code Auto-Refresh Speed (Seconds)</label>
                                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: '#6B7280' }}>Dynamic rotation to prevent unauthorized barcode photo sharing.</p>
                                    <input type="number" className="input" style={{ maxWidth: '200px', background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#111827' }} value={qrRefreshRate} onChange={(e) => setQrRefreshRate(parseInt(e.target.value) || 0)} />
                                </div>

                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    background: '#F9FAFB', padding: '1rem 1.25rem',
                                    borderRadius: '12px', border: '1px solid #E5E7EB'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#111827' }}>Audible Check-In Sound</div>
                                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#6B7280' }}>Play chime confirmation upon successful QR scanner read.</p>
                                    </div>
                                    <input type="checkbox" style={{ width: '20px', height: '20px', accentColor: '#EA580C', cursor: 'pointer' }} checked={checkInSound} onChange={(e) => setCheckInSound(e.target.checked)} />
                                </div>
                            </div>
                        )}

                        {/* TAB 3: Finance */}
                        {subTab === 'finance' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                    <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.15rem', color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Landmark color="#EA580C" size={22} /> Financial Setup & Tax Rates
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#6B7280' }}>
                                        Manage currency formatting, GST tax identifiers, and payment gateway keys.
                                    </p>
                                </div>

                                <hr style={{ borderColor: '#E5E7EB', margin: '0.5rem 0' }} />

                                <div className="input-group">
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Local Operating Currency</label>
                                    <select className="input" style={{ maxWidth: '240px', background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#111827' }} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                                        <option value="INR">Indian Rupee (₹ INR)</option>
                                        <option value="USD">US Dollar ($ USD)</option>
                                        <option value="EUR">Euro (€ EUR)</option>
                                    </select>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="input-group">
                                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Applied Tax / GST Rate (%)</label>
                                        <input type="number" className="input" style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#111827' }} value={taxRate} onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)} />
                                    </div>
                                    <div className="input-group">
                                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Tax ID / GSTIN</label>
                                        <input type="text" className="input" style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#111827' }} value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="e.g. 27AAAAA1111A1Z1" />
                                    </div>
                                </div>

                                <div style={{
                                    background: '#F9FAFB', padding: '1.25rem',
                                    borderRadius: '12px', border: '1px solid #E5E7EB',
                                    display: 'flex', flexDirection: 'column', gap: '1rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#111827' }}>Online Payments (Razorpay Gateway)</div>
                                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#6B7280' }}>Enable digital membership checkout & renewal links.</p>
                                        </div>
                                        <input type="checkbox" style={{ width: '20px', height: '20px', accentColor: '#EA580C', cursor: 'pointer' }} checked={razorpayEnabled} onChange={(e) => setRazorpayEnabled(e.target.checked)} />
                                    </div>

                                    {razorpayEnabled && (
                                        <div className="input-group">
                                            <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>Razorpay Key ID</label>
                                            <input type="text" className="input" style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#111827' }} value={razorpayKey} onChange={(e) => setRazorpayKey(e.target.value)} placeholder="rzp_live_..." />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB 4: Notifications */}
                        {subTab === 'notifications' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                    <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.15rem', color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Bell color="#EA580C" size={22} /> Notification Channels
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#6B7280' }}>
                                        Control automated dispatch channels for membership renewals and payment receipts.
                                    </p>
                                </div>

                                <hr style={{ borderColor: '#E5E7EB', margin: '0.5rem 0' }} />

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        background: '#F9FAFB', padding: '1rem 1.25rem',
                                        borderRadius: '12px', border: '1px solid #E5E7EB'
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#111827' }}>Email Automated Notifications</div>
                                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#6B7280' }}>Dispatch receipt invoices and plan expiry warnings via SMTP.</p>
                                        </div>
                                        <input type="checkbox" style={{ width: '20px', height: '20px', accentColor: '#EA580C', cursor: 'pointer' }} checked={emailAlerts} onChange={(e) => setEmailAlerts(e.target.checked)} />
                                    </div>

                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        background: '#F9FAFB', padding: '1rem 1.25rem',
                                        borderRadius: '12px', border: '1px solid #E5E7EB'
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#111827' }}>SMS Gateway Reminders</div>
                                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#6B7280' }}>Send SMS OTP requests and payment renewal prompts.</p>
                                        </div>
                                        <input type="checkbox" style={{ width: '20px', height: '20px', accentColor: '#EA580C', cursor: 'pointer' }} checked={smsAlerts} onChange={(e) => setSmsAlerts(e.target.checked)} />
                                    </div>

                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        background: '#F9FAFB', padding: '1rem 1.25rem',
                                        borderRadius: '12px', border: '1px solid #E5E7EB'
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#111827' }}>Web Push Notifications</div>
                                            <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#6B7280' }}>Deliver native browser alerts for instant check-in events.</p>
                                        </div>
                                        <input type="checkbox" style={{ width: '20px', height: '20px', accentColor: '#EA580C', cursor: 'pointer' }} checked={pushAlerts} onChange={(e) => setPushAlerts(e.target.checked)} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB 5: Business Hours */}
                        {subTab === 'hours' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                    <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.15rem', color: '#111827', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Clock color="#EA580C" size={22} /> Operating Schedule
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#6B7280' }}>
                                        Set facility operating hours displayed on member passes and reports.
                                    </p>
                                </div>

                                <hr style={{ borderColor: '#E5E7EB', margin: '0.5rem 0' }} />

                                <div className="input-group">
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Weekdays (Monday - Friday)</label>
                                    <input type="text" className="input" style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#111827' }} value={hours.weekday} onChange={(e) => setHours({ ...hours, weekday: e.target.value })} placeholder="e.g. 06:00 AM - 10:00 PM" />
                                </div>

                                <div className="input-group">
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Saturdays</label>
                                    <input type="text" className="input" style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#111827' }} value={hours.saturday} onChange={(e) => setHours({ ...hours, saturday: e.target.value })} placeholder="e.g. 07:00 AM - 08:00 PM" />
                                </div>

                                <div className="input-group">
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Sundays & Public Holidays</label>
                                    <input type="text" className="input" style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', color: '#111827' }} value={hours.sunday} onChange={(e) => setHours({ ...hours, sunday: e.target.value })} placeholder="e.g. 08:00 AM - 02:00 PM" />
                                </div>
                            </div>
                        )}

                        {/* Save Button */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid #E5E7EB' }}>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={loading}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    padding: '0.75rem 1.75rem', fontWeight: 700, fontSize: '0.9rem',
                                    background: 'linear-gradient(135deg, #FEDF1E 0%, #D9860F 100%)',
                                    color: '#FFFFFF', border: 'none', borderRadius: '10px'
                                }}
                            >
                                <Save size={18} />
                                {loading ? (subTab === 'profile' ? 'Updating...' : 'Saving...') : (subTab === 'profile' ? 'Save Account Credentials' : 'Save Settings')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Settings;


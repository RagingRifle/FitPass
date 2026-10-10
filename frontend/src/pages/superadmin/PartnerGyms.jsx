import { useState, useEffect, useContext } from 'react';
import API from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import Modal from '../../components/Modal';
import { QRCodeCanvas } from 'qrcode.react';
import { 
    Building2, 
    Plus, 
    Pencil, 
    Trash2, 
    QrCode, 
    Search, 
    MapPin, 
    User, 
    Clock, 
    Sparkles, 
    AlertCircle, 
    CheckCircle2, 
    LayoutGrid, 
    List, 
    Download, 
    ShieldCheck, 
    Mail, 
    Lock,
    Users
} from 'lucide-react';

function PartnerGyms() {
    const { user } = useContext(AuthContext);
    const [gyms, setGyms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

    const [selectedGymQr, setSelectedGymQr] = useState(null);
    const [editingGym, setEditingGym] = useState(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    
    // Per-gym editable session duration (id -> minutes)
    const [durationDraft, setDurationDraft] = useState({});
    const [submitting, setSubmitting] = useState(false);

    // Form state for Create Gym
    const [gymName, setGymName] = useState('');
    const [gymAddress, setGymAddress] = useState('');
    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');
    const [sessionHours, setSessionHours] = useState(2);
    const [adminName, setAdminName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [adminPassword, setAdminPassword] = useState('');

    useEffect(() => {
        fetchGyms();
    }, []);

    const fetchGyms = async () => {
        try {
            setLoading(true);
            const { data } = await API.get('/superadmin/gyms');
            // Filter out system placeholders if any
            setGyms((data || []).filter(g => g.name !== 'SYSTEM'));
            setLoading(false);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch partner gyms');
            setLoading(false);
        }
    };

    const handleCreateGym = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');

        try {
            setSubmitting(true);
            await API.post('/superadmin/gyms', {
                gymName: gymName.trim(), 
                gymAddress: gymAddress.trim(),
                latitude: latitude ? Number(latitude) : undefined,
                longitude: longitude ? Number(longitude) : undefined,
                defaultSessionDurationMinutes: Number(sessionHours) * 60 || 120,
                adminName: adminName.trim(), 
                adminEmail: adminEmail.trim(), 
                adminPassword: adminPassword.trim()
            });

            setSuccessMsg(`Partner gym "${gymName}" created successfully with admin account!`);
            setGymName(''); setGymAddress(''); setLatitude(''); setLongitude(''); setSessionHours(2);
            setAdminName(''); setAdminEmail(''); setAdminPassword('');
            setIsCreateModalOpen(false);
            fetchGyms();
            setTimeout(() => setSuccessMsg(''), 4000);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to create partner gym');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSaveDuration = async (gymId) => {
        const minutes = Number(durationDraft[gymId]);
        if (!minutes || minutes < 15) {
            alert('Session duration must be at least 15 minutes');
            return;
        }
        try {
            await API.put(`/superadmin/gyms/${gymId}`, { defaultSessionDurationMinutes: minutes });
            setDurationDraft((d) => { const next = { ...d }; delete next[gymId]; return next; });
            setSuccessMsg('Default session duration updated!');
            fetchGyms();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update session duration');
        }
    };

    const handleDeleteGym = async (gymId, name) => {
        if (!window.confirm(`Are you sure you want to delete "${name}" and its admin accounts? This action cannot be undone.`)) {
            return;
        }
        try {
            await API.delete(`/superadmin/gyms/${gymId}`);
            setSuccessMsg(`Gym "${name}" removed.`);
            fetchGyms();
            setTimeout(() => setSuccessMsg(''), 4000);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete gym');
        }
    };

    const handleUpdateGym = async (e) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            await API.put(`/superadmin/gyms/${editingGym._id}`, {
                name: editingGym.name.trim(),
                address: editingGym.address.trim(),
                latitude: editingGym.latitude !== undefined && editingGym.latitude !== null ? Number(editingGym.latitude) : null,
                longitude: editingGym.longitude !== undefined && editingGym.longitude !== null ? Number(editingGym.longitude) : null,
            });
            setSuccessMsg(`Gym details updated!`);
            setEditingGym(null);
            fetchGyms();
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update gym');
        } finally {
            setSubmitting(false);
        }
    };

    // Calculate real statistics dynamically from backend state
    const totalGyms = gyms.length;
    const totalAdminsCount = gyms.reduce((acc, g) => acc + (g.admins?.length || 0), 0);
    const avgSessionHours = totalGyms > 0
        ? (gyms.reduce((acc, g) => acc + (Number(g.defaultSessionDurationMinutes) || 120), 0) / totalGyms / 60).toFixed(1)
        : '0';
    const activeLocationsCount = gyms.filter(g => g.status !== 'Inactive').length;

    const filteredGyms = gyms.filter(g => 
        g.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.admins?.[0]?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.admins?.[0]?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="spinner"></div>;

    return (
        <div className="partner-gyms-page">
            {/* Page Header */}
            <div className="fitprime-page-header">
                <div className="fitprime-header-title-area">
                    <div className="fitprime-header-icon">
                        <Building2 size={28} />
                    </div>
                    <div className="fitprime-header-text">
                        <h2>Partner Gyms Management</h2>
                        <p>Configure partner gym locations, check-in timeout limits, admin credentials, and QR codes.</p>
                    </div>
                </div>
                <button 
                    className="btn btn-primary" 
                    onClick={() => setIsCreateModalOpen(true)}
                >
                    <Plus size={18} />
                    Create Partner Gym
                </button>
            </div>

            {/* Notifications */}
            {error && (
                <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}
            {successMsg && (
                <div className="success-message" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.85rem 1.25rem', backgroundColor: 'rgba(46, 125, 50, 0.15)', border: '1px solid rgba(46, 125, 50, 0.3)', color: '#2E7D32', borderRadius: 'var(--radius-md)' }}>
                    <Sparkles size={18} />
                    <span>{successMsg}</span>
                </div>
            )}

            {/* Key Metrics Summary Bar (100% Dynamic DB Data) */}
            <div className="fitprime-stats-grid">
                <div className="fitprime-stat-card">
                    <div className="fitprime-stat-icon">
                        <Building2 size={22} />
                    </div>
                    <div>
                        <div className="fitprime-stat-val">{totalGyms}</div>
                        <div className="fitprime-stat-lbl">Partner Locations</div>
                    </div>
                </div>

                <div className="fitprime-stat-card">
                    <div className="fitprime-stat-icon">
                        <Users size={22} />
                    </div>
                    <div>
                        <div className="fitprime-stat-val">{totalAdminsCount}</div>
                        <div className="fitprime-stat-lbl">Assigned Admins</div>
                    </div>
                </div>

                <div className="fitprime-stat-card">
                    <div className="fitprime-stat-icon">
                        <Clock size={22} />
                    </div>
                    <div>
                        <div className="fitprime-stat-val">{avgSessionHours} hrs</div>
                        <div className="fitprime-stat-lbl">Avg. Session Timeout</div>
                    </div>
                </div>

                <div className="fitprime-stat-card">
                    <div className="fitprime-stat-icon">
                        <CheckCircle2 size={22} />
                    </div>
                    <div>
                        <div className="fitprime-stat-val">{activeLocationsCount}</div>
                        <div className="fitprime-stat-lbl">Active Network Nodes</div>
                    </div>
                </div>
            </div>

            {/* Toolbar: Search + View Mode Switcher */}
            <div className="fitprime-toolbar">
                <div className="fitprime-search-box">
                    <Search className="fitprime-search-icon" size={18} />
                    <input 
                        className="input" 
                        type="text" 
                        placeholder="Search gyms by name, address, or admin email..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                        Showing {filteredGyms.length} of {gyms.length} location{gyms.length !== 1 ? 's' : ''}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button 
                            className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                            onClick={() => setViewMode('grid')}
                            title="Grid View"
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button 
                            className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                            onClick={() => setViewMode('table')}
                            title="Table View"
                        >
                            <List size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Gyms List: Grid View or Table View */}
            {filteredGyms.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                    <Building2 size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
                    <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No Partner Gyms Found</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: '400px', margin: '0 auto 1.5rem' }}>
                        {searchTerm ? 'No partner gyms match your current search query.' : 'Click below to register your first partner gym.'}
                    </p>
                    {!searchTerm && (
                        <button className="btn btn-primary" onClick={() => setIsCreateModalOpen(true)}>
                            <Plus size={18} />
                            Create Partner Gym
                        </button>
                    )}
                </div>
            ) : viewMode === 'grid' ? (
                <div className="partner-gyms-grid">
                    {filteredGyms.map(gym => {
                        const currentMinutes = gym.defaultSessionDurationMinutes || 120;
                        const draft = durationDraft[gym.id] ?? durationDraft[gym._id];
                        const draftVal = draft !== undefined ? draft : currentMinutes;
                        const adminObj = gym.admins?.[0];

                        return (
                            <div key={gym._id} className="partner-gym-card">
                                <div>
                                    <div className="partner-gym-card-header">
                                        <div>
                                            <h3 className="partner-gym-name">{gym.name}</h3>
                                            {gym.isBranch && (
                                                <span style={{ fontSize: '0.72rem', background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, marginTop: '4px', display: 'inline-block' }}>
                                                    FitPass Branch
                                                </span>
                                            )}
                                        </div>
                                        <span className="status-badge status-active">Active</span>
                                    </div>

                                    <div className="partner-gym-info-list">
                                        <div className="partner-gym-info-item">
                                            <MapPin size={16} className="partner-gym-info-icon" />
                                            <span>{gym.address || 'Address not specified'}</span>
                                        </div>
                                        <div className="partner-gym-info-item">
                                            <User size={16} className="partner-gym-info-icon" />
                                            <div>
                                                <strong style={{ color: 'var(--text-primary)' }}>{adminObj?.name || 'Unassigned Admin'}</strong>
                                                {adminObj?.email && (
                                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{adminObj.email}</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Session Duration Timeout Controls */}
                                    <div className="partner-gym-duration-box">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                            <Clock size={16} style={{ color: 'var(--primary)' }} />
                                            <span>Session Limit:</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                            <select
                                                value={draftVal / 60}
                                                onChange={(e) => setDurationDraft((d) => ({ ...d, [gym._id]: Number(e.target.value) * 60 }))}
                                                className="input"
                                                style={{ width: '105px', padding: '0.35rem 0.5rem', fontSize: '0.82rem' }}
                                            >
                                                <option value="1">1 Hour</option>
                                                <option value="2">2 Hours</option>
                                                <option value="3">3 Hours</option>
                                                <option value="4">4 Hours</option>
                                                <option value="5">5 Hours</option>
                                                <option value="6">6 Hours</option>
                                            </select>
                                            {draft !== undefined && Number(draft) !== currentMinutes && (
                                                <button 
                                                    className="btn btn-primary" 
                                                    style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }} 
                                                    onClick={() => handleSaveDuration(gym._id)}
                                                >
                                                    Save
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="partner-gym-actions">
                                    <button 
                                        className="btn btn-secondary" 
                                        style={{ flex: 1 }}
                                        onClick={() => setSelectedGymQr(gym)}
                                    >
                                        <QrCode size={15} />
                                        QR Code
                                    </button>
                                    <button 
                                        className="btn btn-secondary" 
                                        style={{ flex: 1 }}
                                        onClick={() => setEditingGym({ ...gym })}
                                    >
                                        <Pencil size={15} />
                                        Edit
                                    </button>
                                    <button 
                                        className="btn btn-danger" 
                                        onClick={() => handleDeleteGym(gym._id, gym.name)}
                                        title="Delete Gym"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="card" style={{ padding: 0 }}>
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Gym / Branch Name</th>
                                    <th>Address</th>
                                    <th>Assigned Admin</th>
                                    <th>Session Timeout</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredGyms.map(gym => {
                                    const currentMinutes = gym.defaultSessionDurationMinutes || 120;
                                    const draft = durationDraft[gym.id] ?? durationDraft[gym._id];
                                    const draftVal = draft !== undefined ? draft : currentMinutes;
                                    const adminObj = gym.admins?.[0];

                                    return (
                                        <tr key={gym._id}>
                                            <td style={{ fontWeight: '700' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Building2 size={16} style={{ color: 'var(--primary)' }} />
                                                    <span>{gym.name}</span>
                                                    {gym.isBranch && (
                                                        <span style={{ fontSize: '0.7rem', background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '4px' }}>Branch</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ color: 'var(--text-secondary)' }}>{gym.address || 'N/A'}</td>
                                            <td>
                                                <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{adminObj?.name || 'Unassigned'}</div>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{adminObj?.email || ''}</div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                                    <select
                                                        value={draftVal / 60}
                                                        onChange={(e) => setDurationDraft((d) => ({ ...d, [gym._id]: Number(e.target.value) * 60 }))}
                                                        className="input"
                                                        style={{ width: '110px', padding: '0.35rem 0.6rem', fontSize: '0.82rem' }}
                                                    >
                                                        <option value="1">1 Hour</option>
                                                        <option value="2">2 Hours</option>
                                                        <option value="3">3 Hours</option>
                                                        <option value="4">4 Hours</option>
                                                        <option value="5">5 Hours</option>
                                                        <option value="6">6 Hours</option>
                                                    </select>
                                                    {draft !== undefined && Number(draft) !== currentMinutes && (
                                                        <button 
                                                            className="btn btn-primary" 
                                                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }} 
                                                            onClick={() => handleSaveDuration(gym._id)}
                                                        >
                                                            Save
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button 
                                                        className="btn btn-secondary" 
                                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} 
                                                        onClick={() => setSelectedGymQr(gym)}
                                                    >
                                                        <QrCode size={14} />
                                                        QR
                                                    </button>
                                                    <button 
                                                        className="btn btn-secondary" 
                                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} 
                                                        onClick={() => setEditingGym({ ...gym })}
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button 
                                                        className="btn btn-danger" 
                                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} 
                                                        onClick={() => handleDeleteGym(gym._id, gym.name)}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal: Create Partner Gym */}
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Create New Partner Gym"
            >
                <form onSubmit={handleCreateGym} style={{ marginTop: '0.5rem' }}>
                    <div className="input-group">
                        <label>Gym Name</label>
                        <input 
                            className="input" 
                            type="text" 
                            placeholder="e.g. Elite Fitness Center" 
                            value={gymName} 
                            onChange={(e) => setGymName(e.target.value)} 
                            required 
                        />
                    </div>

                    <div className="input-group">
                        <label>Gym Address</label>
                        <input 
                            className="input" 
                            type="text" 
                            placeholder="e.g. 123 Fitness Ave, Muscle Town" 
                            value={gymAddress} 
                            onChange={(e) => setGymAddress(e.target.value)} 
                            required 
                        />
                    </div>

                    <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div className="input-group">
                            <label>Latitude</label>
                            <input 
                                className="input" 
                                type="number" 
                                step="any"
                                placeholder="e.g. 13.0827" 
                                value={latitude} 
                                onChange={(e) => setLatitude(e.target.value)} 
                            />
                        </div>
                        <div className="input-group">
                            <label>Longitude</label>
                            <input 
                                className="input" 
                                type="number" 
                                step="any"
                                placeholder="e.g. 80.2707" 
                                value={longitude} 
                                onChange={(e) => setLongitude(e.target.value)} 
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label>Default Session Timeout</label>
                        <select 
                            className="input" 
                            value={sessionHours} 
                            onChange={(e) => setSessionHours(e.target.value)} 
                            required
                        >
                            <option value="1">1 Hour</option>
                            <option value="2">2 Hours</option>
                            <option value="3">3 Hours</option>
                            <option value="4">4 Hours</option>
                            <option value="5">5 Hours</option>
                            <option value="6">6 Hours</option>
                        </select>
                    </div>

                    <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
                        <h4 style={{ fontSize: '0.95rem', marginBottom: '1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <ShieldCheck size={16} />
                            Administrator Credentials
                        </h4>

                        <div className="input-group">
                            <label>Admin Name</label>
                            <input 
                                className="input" 
                                type="text" 
                                placeholder="e.g. John Doe" 
                                value={adminName} 
                                onChange={(e) => setAdminName(e.target.value)} 
                                required 
                            />
                        </div>

                        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                            <div className="input-group">
                                <label>Admin Email</label>
                                <input 
                                    className="input" 
                                    type="email" 
                                    placeholder="e.g. admin@gym.com" 
                                    value={adminEmail} 
                                    onChange={(e) => setAdminEmail(e.target.value)} 
                                    required 
                                />
                            </div>

                            <div className="input-group">
                                <label>Admin Password</label>
                                <input 
                                    className="input" 
                                    type="text" 
                                    placeholder="Password" 
                                    value={adminPassword} 
                                    onChange={(e) => setAdminPassword(e.target.value)} 
                                    required 
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '1.5rem' }}>
                        <button 
                            type="button" 
                            className="btn btn-secondary" 
                            onClick={() => setIsCreateModalOpen(false)}
                            style={{ flex: 1 }}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="btn btn-primary" 
                            disabled={submitting}
                            style={{ flex: 1 }}
                        >
                            {submitting ? 'Creating...' : 'Create Gym & Admin'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal: Edit Partner Gym */}
            <Modal
                isOpen={!!editingGym}
                onClose={() => setEditingGym(null)}
                title="Edit Partner Gym"
            >
                {editingGym && (
                    <form onSubmit={handleUpdateGym} style={{ marginTop: '0.5rem' }}>
                        <div className="input-group">
                            <label>Gym Name</label>
                            <input 
                                className="input"
                                type="text" 
                                value={editingGym.name} 
                                onChange={(e) => setEditingGym({...editingGym, name: e.target.value})} 
                                required 
                            />
                        </div>
                        <div className="input-group">
                            <label>Gym Address</label>
                            <input 
                                className="input"
                                type="text" 
                                value={editingGym.address} 
                                onChange={(e) => setEditingGym({...editingGym, address: e.target.value})} 
                                required 
                            />
                        </div>
                        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div className="input-group">
                                <label>Latitude</label>
                                <input 
                                    className="input" 
                                    type="number" 
                                    step="any"
                                    value={editingGym.latitude !== undefined && editingGym.latitude !== null ? editingGym.latitude : ''} 
                                    onChange={(e) => setEditingGym({...editingGym, latitude: e.target.value ? Number(e.target.value) : null})} 
                                    placeholder="e.g. 13.0827"
                                />
                            </div>
                            <div className="input-group">
                                <label>Longitude</label>
                                <input 
                                    className="input" 
                                    type="number" 
                                    step="any"
                                    value={editingGym.longitude !== undefined && editingGym.longitude !== null ? editingGym.longitude : ''} 
                                    onChange={(e) => setEditingGym({...editingGym, longitude: e.target.value ? Number(e.target.value) : null})} 
                                    placeholder="e.g. 80.2707"
                                />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '1.5rem' }}>
                            <button 
                                type="button" 
                                className="btn btn-secondary" 
                                onClick={() => setEditingGym(null)} 
                                style={{ flex: 1 }}
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="btn btn-primary" 
                                disabled={submitting} 
                                style={{ flex: 1 }}
                            >
                                {submitting ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                )}
            </Modal>

            {/* Modal: QR Code Display */}
            <Modal
                isOpen={!!selectedGymQr}
                onClose={() => setSelectedGymQr(null)}
                title={selectedGymQr ? `${selectedGymQr.name} — QR Code` : 'Gym Check-in QR Code'}
            >
                {selectedGymQr && (
                    <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
                            Print or display this QR code at the entrance. Members scan this QR code with their mobile app to check in.
                        </p>
                        
                        <div style={{ background: '#FFFFFF', padding: '1.75rem', display: 'inline-block', borderRadius: '16px', boxShadow: '0 8px 30px rgba(0,0,0,0.3)', border: '1px solid rgba(240,160,32,0.3)' }}>
                            <QRCodeCanvas
                                value={JSON.stringify(selectedGymQr.isBranch
                                    ? { gymId: selectedGymQr.parentGymId, branchId: selectedGymQr._id, gymName: selectedGymQr.name }
                                    : { gymId: selectedGymQr._id, gymName: selectedGymQr.name })}
                                size={220}
                                level="H"
                            />
                        </div>

                        <div style={{ marginTop: '1.25rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            ID: {selectedGymQr.isBranch ? selectedGymQr.parentGymId : selectedGymQr._id}
                        </div>

                        <div style={{ marginTop: '1.5rem' }}>
                            <button 
                                className="btn btn-secondary" 
                                onClick={() => setSelectedGymQr(null)} 
                                style={{ width: '100%' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}

export default PartnerGyms;

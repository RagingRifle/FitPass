import { useState, useEffect, useContext } from 'react';
import API from '../services/api';
import { AuthContext } from '../context/AuthContext';
import Modal from '../components/Modal';
import GymDiscoveryFields from '../components/GymDiscoveryFields';
import { 
    Building2, 
    ImagePlus, 
    Trash2, 
    ArrowLeft, 
    ArrowRight, 
    Save, 
    Loader2, 
    AlertCircle, 
    CheckCircle, 
    Pencil, 
    MapPin, 
    Phone, 
    Mail, 
    Clock, 
    ShieldCheck,
    CheckCircle2
} from 'lucide-react';

const GymProfile = () => {
    const { user } = useContext(AuthContext);
    const [gym, setGym] = useState(null);
    const [images, setImages] = useState([]);
    const [discoveryProfile, setDiscoveryProfile] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Modal state for Edit & Delete Gym Profile
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Edit form fields
    const [editForm, setEditForm] = useState({
        name: '',
        address: '',
        phone: '',
        email: '',
        latitude: '',
        longitude: '',
        defaultSessionDurationMinutes: 120
    });

    const fetchGymData = async () => {
        try {
            setLoading(true);
            const { data } = await API.get('/gyms/partnered');
            const profileResponse = await API.get('/discovery/my-profile').catch(() => null);
            setDiscoveryProfile(profileResponse?.data?.data || {});
            const myGym = data.find(g => g.id === user?.gymId || g._id === user?.gymId);
            if (myGym) {
                setGym(myGym);
                setImages(myGym.images || []);
                setEditForm({
                    name: myGym.name || '',
                    address: myGym.address || '',
                    phone: myGym.phone || '',
                    email: myGym.email || '',
                    latitude: myGym.latitude ?? '',
                    longitude: myGym.longitude ?? '',
                    defaultSessionDurationMinutes: myGym.defaultSessionDurationMinutes || 120
                });
            }
        } catch (err) {
            console.error('Failed to fetch gym', err);
            setError('Failed to load gym data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.gymId) {
            fetchGymData();
        } else {
            setLoading(false);
        }
    }, [user]);

    const handleUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        if (images.length + files.length > 4) {
            setError(`You can only have up to 4 gallery images. You are trying to add ${files.length} to your existing ${images.length}.`);
            return;
        }

        const formData = new FormData();
        files.forEach(file => formData.append('images', file));

        try {
            setUploading(true);
            setError('');
            const { data } = await API.post('/gyms/images', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setImages(data.images);
            setSuccess('Images uploaded successfully!');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to upload images');
        } finally {
            setUploading(false);
            e.target.value = null;
        }
    };

    const handleDeleteImage = (indexToDelete) => {
        setImages(images.filter((_, index) => index !== indexToDelete));
    };

    const moveImage = (index, direction) => {
        if ((direction === -1 && index === 0) || (direction === 1 && index === images.length - 1)) return;
        const newImages = [...images];
        const temp = newImages[index];
        newImages[index] = newImages[index + direction];
        newImages[index + direction] = temp;
        setImages(newImages);
    };

    const saveChanges = async () => {
        try {
            setSaving(true);
            setError('');
            const { data } = await API.put('/gyms/images', { images });
            setImages(data.images);
            setSuccess('Gallery changes saved successfully!');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateGym = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            setError('');
            const gymId = gym._id || gym.id;
            
            // Call API endpoint to update gym profile
            const { data } = await API.put('/discovery/my-profile', {
                name: editForm.name.trim(),
                address: editForm.address.trim(),
                contactNumber: editForm.phone.trim(),
                email: editForm.email.trim(),
                defaultSessionDurationMinutes: Number(editForm.defaultSessionDurationMinutes),
                latitude: editForm.latitude === '' ? null : Number(editForm.latitude),
                longitude: editForm.longitude === '' ? null : Number(editForm.longitude),
            });

            setDiscoveryProfile(data.data || discoveryProfile);
            setGym(prev => ({ ...prev, name: editForm.name.trim(), address: editForm.address.trim(), phone: editForm.phone.trim(), email: editForm.email.trim(), latitude: editForm.latitude === '' ? null : Number(editForm.latitude), longitude: editForm.longitude === '' ? null : Number(editForm.longitude), defaultSessionDurationMinutes: Number(editForm.defaultSessionDurationMinutes) }));
            setSuccess('Gym profile updated successfully!');
            setIsEditModalOpen(false);
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update gym profile');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteGym = async () => {
        try {
            setIsSubmitting(true);
            setError('');
            const gymId = gym._id || gym.id;
            
            await API.delete(`/superadmin/gyms/${gymId}`);
            setSuccess('Gym profile deleted successfully!');
            setIsDeleteModalOpen(false);
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1500);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete gym profile');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <Loader2 className="spinner" size={40} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
            </div>
        );
    }

    if (!gym) {
        return (
            <div className="card glass-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                <Building2 size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
                <h3>No Gym Profile Associated</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Your user account does not appear to be linked to an active gym profile.</p>
            </div>
        );
    }

    return (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header with Title & Action Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, rgba(240, 160, 32, 0.2), rgba(217, 134, 15, 0.1))',
                        border: '1px solid rgba(240, 160, 32, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justify-content: 'center',
                        color: 'var(--primary)'
                    }}>
                        <Building2 size={24} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{gym.name}</h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Manage your gym's information, session defaults, and photo gallery.</p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button 
                        className="btn btn-secondary" 
                        onClick={() => setIsEditModalOpen(true)}
                        style={{ padding: '0.6rem 1.1rem', fontSize: '0.85rem' }}
                    >
                        <Pencil size={16} />
                        Edit Profile
                    </button>

                    <button 
                        className="btn btn-danger" 
                        onClick={() => setIsDeleteModalOpen(true)}
                        style={{ padding: '0.6rem 1.1rem', fontSize: '0.85rem' }}
                    >
                        <Trash2 size={16} />
                        Delete Gym
                    </button>
                </div>
            </div>

            {/* Alerts */}
            {error && (
                <div className="alert alert-danger" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.875rem 1.25rem', borderRadius: 'var(--radius-md)' }}>
                    <AlertCircle size={18} /> <span>{error}</span>
                </div>
            )}

            {success && (
                <div className="alert alert-success" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: 'rgba(46, 125, 50, 0.15)', border: '1px solid rgba(46, 125, 50, 0.3)', color: '#4ADE80', padding: '0.875rem 1.25rem', borderRadius: 'var(--radius-md)' }}>
                    <CheckCircle size={18} /> <span>{success}</span>
                </div>
            )}

            {/* Main Gym Information Card */}
            <div className="card glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldCheck size={20} style={{ color: 'var(--primary)' }} />
                        Gym Details & Parameters
                    </h3>
                    <span className={`status-pill-${gym.status === 'Inactive' ? 'failed' : 'success'}`}>
                        {gym.status || 'Active'}
                    </span>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '1.25rem',
                    background: 'var(--bg-tertiary)',
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)'
                }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <Building2 size={18} style={{ color: 'var(--primary)', marginTop: '2px', flexShrink: 0 }} />
                        <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>GYM NAME</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{gym.name}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <MapPin size={18} style={{ color: 'var(--primary)', marginTop: '2px', flexShrink: 0 }} />
                        <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>ADDRESS</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{gym.address || 'Not specified'}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <Phone size={18} style={{ color: 'var(--primary)', marginTop: '2px', flexShrink: 0 }} />
                        <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>PHONE</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{gym.phone || 'Not specified'}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <Mail size={18} style={{ color: 'var(--primary)', marginTop: '2px', flexShrink: 0 }} />
                        <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>EMAIL</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{gym.email || 'Not specified'}</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <Clock size={18} style={{ color: 'var(--primary)', marginTop: '2px', flexShrink: 0 }} />
                        <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>SESSION TIMEOUT</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                                {((gym.defaultSessionDurationMinutes || 120) / 60).toFixed(1)} Hours ({gym.defaultSessionDurationMinutes || 120} mins)
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <section className="card glass-card gym-profile-explore-editor">
                <div className="gym-profile-section-heading"><div><h3>Member Explore profile</h3><p>Manage the details, images, amenities, and opening schedule members see.</p></div></div>
                <GymDiscoveryFields profile={discoveryProfile} onChange={setDiscoveryProfile} gymId={gym._id || gym.id} />
                <button className="btn btn-primary" disabled={saving} onClick={async () => {
                    try {
                        setSaving(true); setError('');
                        const { data } = await API.put('/discovery/my-profile', discoveryProfile);
                        setDiscoveryProfile(data.data || discoveryProfile);
                        setSuccess('Explore profile and opening schedule saved.');
                        setTimeout(() => setSuccess(''), 3000);
                    } catch (err) { setError(err.response?.data?.message || 'Failed to save Explore profile.'); }
                    finally { setSaving(false); }
                }}><Save size={16} />{saving ? 'Saving…' : 'Save Explore profile'}</button>
            </section>

            {/* Photo Gallery Card */}
            <div className="card glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Gallery Photos ({images.length}/4)</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Upload up to 4 photos to showcase your facility to members.</p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <input 
                            type="file" 
                            id="image-upload" 
                            multiple 
                            accept="image/*" 
                            style={{ display: 'none' }}
                            onChange={handleUpload}
                            disabled={uploading || images.length >= 4}
                        />
                        <label 
                            htmlFor="image-upload" 
                            className="btn btn-secondary" 
                            style={{ 
                                cursor: images.length >= 4 ? 'not-allowed' : 'pointer',
                                opacity: images.length >= 4 ? 0.5 : 1,
                                padding: '0.55rem 1rem',
                                fontSize: '0.82rem'
                            }}
                        >
                            {uploading ? <Loader2 size={16} className="spinner" /> : <ImagePlus size={16} />} 
                            Upload Photo
                        </label>

                        <button 
                            className="btn btn-primary" 
                            onClick={saveChanges} 
                            disabled={saving}
                            style={{ padding: '0.55rem 1rem', fontSize: '0.82rem' }}
                        >
                            {saving ? <Loader2 size={16} className="spinner" /> : <Save size={16} />} 
                            Save Order
                        </button>
                    </div>
                </div>

                <div className="gallery-grid">
                    {images.map((url, index) => (
                        <div key={index} className="gallery-item-wrapper">
                            <div className="gallery-item">
                                <img src={url} alt={`Gym Image ${index + 1}`} />
                                <div className="gallery-overlay">
                                    <div className="gallery-controls">
                                        <button onClick={() => moveImage(index, -1)} disabled={index === 0} title="Move Left">
                                            <ArrowLeft size={16} />
                                        </button>
                                        <button onClick={() => handleDeleteImage(index)} className="delete-btn" title="Delete Image">
                                            <Trash2 size={16} />
                                        </button>
                                        <button onClick={() => moveImage(index, 1)} disabled={index === images.length - 1} title="Move Right">
                                            <ArrowRight size={16} />
                                        </button>
                                    </div>
                                    <span className="gallery-index">Photo {index + 1}</span>
                                </div>
                            </div>
                        </div>
                    ))}

                    {images.length === 0 && (
                        <div className="empty-gallery">
                            <ImagePlus size={44} opacity={0.3} style={{ color: 'var(--primary)' }} />
                            <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No photo uploads found</p>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Click &quot;Upload Photo&quot; to add up to 4 gym gallery photos.</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal: Edit Gym Details */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title="Edit Gym Profile"
            >
                <form onSubmit={handleUpdateGym} style={{ marginTop: '0.5rem' }}>
                    <div className="input-group">
                        <label>Gym Name</label>
                        <input 
                            className="input" 
                            type="text" 
                            value={editForm.name} 
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} 
                            required 
                        />
                    </div>

                    <div className="input-group">
                        <label>Address</label>
                        <input 
                            className="input" 
                            type="text" 
                            value={editForm.address} 
                            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} 
                        />
                    </div>

                    <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="input-group"><label>Latitude</label><input className="input" type="number" step="any" value={editForm.latitude} onChange={e => setEditForm({ ...editForm, latitude: e.target.value })} placeholder="e.g. 13.0827" /></div>
                        <div className="input-group"><label>Longitude</label><input className="input" type="number" step="any" value={editForm.longitude} onChange={e => setEditForm({ ...editForm, longitude: e.target.value })} placeholder="e.g. 80.2707" /></div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="input-group">
                            <label>Phone Number</label>
                            <input 
                                className="input" 
                                type="text" 
                                value={editForm.phone} 
                                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} 
                            />
                        </div>

                        <div className="input-group">
                            <label>Email Address</label>
                            <input 
                                className="input" 
                                type="email" 
                                value={editForm.email} 
                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} 
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label>Default Session Timeout</label>
                        <select 
                            className="input" 
                            value={editForm.defaultSessionDurationMinutes / 60} 
                            onChange={(e) => setEditForm({ ...editForm, defaultSessionDurationMinutes: Number(e.target.value) * 60 })} 
                        >
                            <option value="1">1 Hour (60 mins)</option>
                            <option value="2">2 Hours (120 mins)</option>
                            <option value="3">3 Hours (180 mins)</option>
                            <option value="4">4 Hours (240 mins)</option>
                            <option value="5">5 Hours (300 mins)</option>
                            <option value="6">6 Hours (360 mins)</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '1.5rem' }}>
                        <button 
                            type="button" 
                            className="btn btn-secondary" 
                            onClick={() => setIsEditModalOpen(false)}
                            style={{ flex: 1 }}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="btn btn-primary" 
                            disabled={isSubmitting}
                            style={{ flex: 1 }}
                        >
                            {isSubmitting ? <Loader2 size={18} className="spinner" /> : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Modal: Confirm Delete Gym */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Delete Gym Profile"
            >
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: 'var(--radius-full)',
                        background: 'rgba(198, 40, 40, 0.15)',
                        border: '1px solid rgba(198, 40, 40, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justify-content: 'center',
                        color: 'var(--danger)',
                        margin: '0 auto 1.25rem'
                    }}>
                        <Trash2 size={28} />
                    </div>

                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                        Are you sure you want to delete &quot;{gym.name}&quot;?
                    </h3>
                    
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '380px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
                        This action will permanently delete this partner gym profile and remove associated admin permissions. This action cannot be undone.
                    </p>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button 
                            type="button" 
                            className="btn btn-secondary" 
                            onClick={() => setIsDeleteModalOpen(false)}
                            style={{ flex: 1 }}
                        >
                            Cancel
                        </button>
                        <button 
                            type="button" 
                            className="btn btn-danger" 
                            onClick={handleDeleteGym}
                            disabled={isSubmitting}
                            style={{ flex: 1 }}
                        >
                            {isSubmitting ? <Loader2 size={18} className="spinner" /> : 'Delete Gym'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default GymProfile;

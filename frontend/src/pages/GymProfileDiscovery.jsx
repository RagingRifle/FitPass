import React, { useState, useEffect } from 'react';
import { discoveryService } from '../services/discoveryService';
import { Check, Plus } from 'lucide-react';

export default function GymProfileDiscovery() {
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'posts'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Profile Form State
  const [profile, setProfile] = useState({
    shortDescription: '',
    description: '',
    coverImageUrl: '',
    logoUrl: '',
    ownerName: '',
    contactNumber: '',
    email: '',
    website: '',
    address: '',
    city: 'Chennai',
    googleMapsUrl: '',
    latitude: 13.0827,
    longitude: 80.2707,
    openingTime: '06:00 AM',
    closingTime: '10:00 PM',
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    hasParking: true,
    hasLockers: true,
    hasShowers: true,
    hasPersonalTraining: true,
    hasGroupClasses: true,
    isWomenFriendly: true,
    isAc: true,
    amenities: ['Free WiFi', 'Locker Room', 'Air Conditioned', 'Showers', 'Steam Bath'],
    equipments: ['Treadmills', 'Dumbbells', 'Power Racks', 'Cable Crossover', 'Leg Press'],
    instagram: '',
    facebook: '',
    youtube: '',
    status: 'Approved',
    rejectionReason: ''
  });

  // Posts State
  const [posts, setPosts] = useState([]);
  const [showPostModal, setShowPostModal] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null);
  const [postForm, setPostForm] = useState({
    title: '',
    caption: '',
    description: '',
    images: ['', '', '', '', ''],
    videoUrl: ''
  });

  const availableAmenities = [
    'Free WiFi', 'Locker Room', 'Air Conditioned', 'Showers', 
    'Steam Bath', 'Sauna', 'Protein Bar', 'Juice Bar', 'Parking', 
    'Personal Trainers', 'Group Classes', 'Zumba', 'Yoga Studio'
  ];

  const availableEquipments = [
    'Treadmills', 'Ellipticals', 'Stationary Bikes', 'Rowing Machines', 
    'Dumbbells (1-50kg)', 'Barbells & Plates', 'Power Racks', 
    'Smith Machine', 'Cable Crossover', 'Leg Press', 'Lat Pulldown'
  ];

  useEffect(() => {
    fetchProfileData();
    fetchPostsData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const res = await discoveryService.getMyGymProfile();
      if (res.data && res.data.data) {
        const p = res.data.data;
        setProfile({
          ...p,
          workingDays: p.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
          amenities: p.amenities || ['Free WiFi', 'Locker Room'],
          equipments: p.equipments || ['Treadmills', 'Dumbbells']
        });
      }
    } catch (err) {
      console.error("Failed to load gym profile", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPostsData = async () => {
    try {
      const res = await discoveryService.getMyGymPosts();
      if (res.data && res.data.data) {
        setPosts(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load posts", err);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await discoveryService.updateMyGymProfile(profile);
      setMessage({ type: 'success', text: res.data.message || 'Profile saved and submitted for review!' });
      if (res.data.data) {
        setProfile(res.data.data);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save profile' });
    } finally {
      setSaving(false);
    }
  };

  const toggleAmenity = (item) => {
    setProfile(prev => {
      const exists = prev.amenities.includes(item);
      const updated = exists ? prev.amenities.filter(a => a !== item) : [...prev.amenities, item];
      return { ...prev, amenities: updated };
    });
  };

  const toggleEquipment = (item) => {
    setProfile(prev => {
      const exists = prev.equipments.includes(item);
      const updated = exists ? prev.equipments.filter(e => e !== item) : [...prev.equipments, item];
      return { ...prev, equipments: updated };
    });
  };

  const handlePostImageChange = (index, value) => {
    const newImages = [...postForm.images];
    newImages[index] = value;
    setPostForm({ ...postForm, images: newImages });
  };

  const openCreatePostModal = () => {
    setEditingPostId(null);
    setPostForm({ title: '', caption: '', description: '', images: ['', '', '', '', ''], videoUrl: '' });
    setShowPostModal(true);
  };

  const openEditPostModal = (post) => {
    setEditingPostId(post.id);
    const filledImages = [...(post.images || [])];
    while (filledImages.length < 5) filledImages.push('');
    setPostForm({
      title: post.title,
      caption: post.caption || '',
      description: post.description || '',
      images: filledImages,
      videoUrl: post.videoUrl || ''
    });
    setShowPostModal(true);
  };

  const handlePostSubmit = async (e) => {
    e.preventDefault();
    if (!postForm.title.trim()) return alert("Post title is required");

    const validImages = postForm.images.filter(img => img.trim() !== '');

    setSaving(true);
    try {
      const payload = {
        title: postForm.title,
        caption: postForm.caption,
        description: postForm.description,
        images: validImages,
        videoUrl: postForm.videoUrl
      };

      if (editingPostId) {
        await discoveryService.updateMyGymPost(editingPostId, payload);
        setMessage({ type: 'success', text: 'Post updated & submitted for review!' });
      } else {
        await discoveryService.createMyGymPost(payload);
        setMessage({ type: 'success', text: 'Post created & submitted for review!' });
      }
      setShowPostModal(false);
      fetchPostsData();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to save post");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      await discoveryService.deleteMyGymPost(postId);
      fetchPostsData();
    } catch {
      alert("Failed to delete post");
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#A39686' }}>
        <div style={{ fontSize: '18px', fontWeight: '600', color: '#F0A020' }}>Loading Gym Discovery Profile...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', color: '#FFFFFF' }}>
      {/* Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #2D251C 0%, #1A150F 100%)',
        padding: '24px',
        borderRadius: '16px',
        border: '1px solid #3A3025',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#FFFFFF' }}>
              FitPass Partner Gym Social Profile
            </h1>
            <span style={{
              fontSize: '12px',
              padding: '4px 10px',
              borderRadius: '20px',
              fontWeight: 'bold',
              background: profile.status === 'Approved' ? 'rgba(46, 125, 50, 0.2)' : profile.status === 'Rejected' ? 'rgba(198, 40, 40, 0.2)' : 'rgba(240, 160, 32, 0.2)',
              color: profile.status === 'Approved' ? '#4CAF50' : profile.status === 'Rejected' ? '#FF5252' : '#F0A020',
              border: `1px solid ${profile.status === 'Approved' ? '#4CAF50' : profile.status === 'Rejected' ? '#FF5252' : '#F0A020'}`
            }}>
              ● Status: {profile.status || 'Pending Review'}
            </span>
          </div>
          <p style={{ color: '#A39686', fontSize: '14px', marginTop: '6px', marginBottom: 0 }}>
            Showcase your gym to thousands of FitPass members, post gym highlights, and manage amenities.
          </p>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setActiveTab('profile')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              border: 'none',
              background: activeTab === 'profile' ? '#F0A020' : '#3A3025',
              color: activeTab === 'profile' ? '#231D14' : '#A39686'
            }}
          >
             Gym Profile Details
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: 'pointer',
              border: 'none',
              background: activeTab === 'posts' ? '#F0A020' : '#3A3025',
              color: activeTab === 'posts' ? '#231D14' : '#A39686'
            }}
          >
             Social Posts ({posts.length})
          </button>
        </div>
      </div>

      {/* Rejection Alert Banner */}
      {profile.status === 'Rejected' && profile.rejectionReason && (
        <div style={{
          background: 'rgba(198, 40, 40, 0.15)',
          border: '1px solid #C62828',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
          color: '#FF8A80'
        }}>
          <strong> Profile Rejection Notice:</strong> {profile.rejectionReason}
          <div style={{ fontSize: '12px', color: '#A39686', marginTop: '4px' }}>
            Please make the necessary edits below and click "Save & Submit Profile for Review".
          </div>
        </div>
      )}

      {/* Success / Error Notification */}
      {message.text && (
        <div style={{
          padding: '14px',
          borderRadius: '8px',
          marginBottom: '20px',
          background: message.type === 'success' ? 'rgba(46, 125, 50, 0.2)' : 'rgba(198, 40, 40, 0.2)',
          border: `1px solid ${message.type === 'success' ? '#2E7D32' : '#C62828'}`,
          color: message.type === 'success' ? '#81C784' : '#FF8A80'
        }}>
          {message.text}
        </div>
      )}

      {/* TAB 1: PROFILE FORM */}
      {activeTab === 'profile' && (
        <form onSubmit={handleProfileSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            
            {/* Visual Branding Section */}
            <div style={{ background: '#2D251C', padding: '20px', borderRadius: '12px', border: '1px solid #3A3025' }}>
              <h3 style={{ fontSize: '16px', color: '#F0A020', marginBottom: '16px' }}> Visual Branding & Covers</h3>
              
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#A39686', marginBottom: '6px' }}>Cover Image URL (Hero Banner)</label>
                <input
                  type="text"
                  value={profile.coverImageUrl}
                  onChange={e => setProfile({ ...profile, coverImageUrl: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#231D14', border: '1px solid #3A3025', color: '#FFF' }}
                />
                {profile.coverImageUrl && (
                  <img src={profile.coverImageUrl} alt="Cover Preview" style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', marginTop: '8px' }} />
                )}
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#A39686', marginBottom: '6px' }}>Gym Logo URL</label>
                <input
                  type="text"
                  value={profile.logoUrl}
                  onChange={e => setProfile({ ...profile, logoUrl: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#231D14', border: '1px solid #3A3025', color: '#FFF' }}
                />
                {profile.logoUrl && (
                  <img src={profile.logoUrl} alt="Logo Preview" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', marginTop: '8px', border: '2px solid #F0A020' }} />
                )}
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#A39686', marginBottom: '6px' }}>Short Description (Cards Preview)</label>
                <input
                  type="text"
                  value={profile.shortDescription}
                  onChange={e => setProfile({ ...profile, shortDescription: e.target.value })}
                  placeholder="e.g. Modern high-intensity training gym with cardio zone"
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#231D14', border: '1px solid #3A3025', color: '#FFF' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#A39686', marginBottom: '6px' }}>Full Overview & History</label>
                <textarea
                  rows={4}
                  value={profile.description}
                  onChange={e => setProfile({ ...profile, description: e.target.value })}
                  placeholder="Detail your trainers, special programs, culture, and achievements..."
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#231D14', border: '1px solid #3A3025', color: '#FFF' }}
                />
              </div>
            </div>

            {/* Contact & Location Section */}
            <div style={{ background: '#2D251C', padding: '20px', borderRadius: '12px', border: '1px solid #3A3025' }}>
              <h3 style={{ fontSize: '16px', color: '#F0A020', marginBottom: '16px' }}> Contact & Map Location</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#A39686', marginBottom: '6px' }}>Owner Name</label>
                  <input
                    type="text"
                    value={profile.ownerName}
                    onChange={e => setProfile({ ...profile, ownerName: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#231D14', border: '1px solid #3A3025', color: '#FFF' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#A39686', marginBottom: '6px' }}>Contact Phone</label>
                  <input
                    type="text"
                    value={profile.contactNumber}
                    onChange={e => setProfile({ ...profile, contactNumber: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#231D14', border: '1px solid #3A3025', color: '#FFF' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#A39686', marginBottom: '6px' }}>Public Email</label>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={e => setProfile({ ...profile, email: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#231D14', border: '1px solid #3A3025', color: '#FFF' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#A39686', marginBottom: '6px' }}>City</label>
                  <input
                    type="text"
                    value={profile.city}
                    onChange={e => setProfile({ ...profile, city: e.target.value })}
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#231D14', border: '1px solid #3A3025', color: '#FFF' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#A39686', marginBottom: '6px' }}>Address</label>
                <input
                  type="text"
                  value={profile.address}
                  onChange={e => setProfile({ ...profile, address: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#231D14', border: '1px solid #3A3025', color: '#FFF' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#A39686', marginBottom: '6px' }}>Google Maps Share Link</label>
                <input
                  type="text"
                  value={profile.googleMapsUrl}
                  onChange={e => setProfile({ ...profile, googleMapsUrl: e.target.value })}
                  placeholder="https://maps.google.com/?q=..."
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#231D14', border: '1px solid #3A3025', color: '#FFF' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#A39686', marginBottom: '4px' }}>Latitude (GPS)</label>
                  <input
                    type="number"
                    step="any"
                    value={profile.latitude || ''}
                    onChange={e => setProfile({ ...profile, latitude: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#231D14', border: '1px solid #3A3025', color: '#FFF' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#A39686', marginBottom: '4px' }}>Longitude (GPS)</label>
                  <input
                    type="number"
                    step="any"
                    value={profile.longitude || ''}
                    onChange={e => setProfile({ ...profile, longitude: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#231D14', border: '1px solid #3A3025', color: '#FFF' }}
                  />
                </div>
              </div>
            </div>

            {/* Operating Schedule & Badges */}
            <div style={{ background: '#2D251C', padding: '20px', borderRadius: '12px', border: '1px solid #3A3025' }}>
              <h3 style={{ fontSize: '16px', color: '#F0A020', marginBottom: '16px' }}> Operating Schedule & Badges</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#A39686', marginBottom: '6px' }}>Opening Time</label>
                  <input
                    type="text"
                    value={profile.openingTime}
                    onChange={e => setProfile({ ...profile, openingTime: e.target.value })}
                    placeholder="06:00 AM"
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#231D14', border: '1px solid #3A3025', color: '#FFF' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#A39686', marginBottom: '6px' }}>Closing Time</label>
                  <input
                    type="text"
                    value={profile.closingTime}
                    onChange={e => setProfile({ ...profile, closingTime: e.target.value })}
                    placeholder="10:00 PM"
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#231D14', border: '1px solid #3A3025', color: '#FFF' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#A39686', marginBottom: '8px' }}>Key Facilities (Badges)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { key: 'isAc', label: ' Air Conditioned' },
                    { key: 'hasParking', label: ' Parking Available' },
                    { key: 'hasLockers', label: ' Locker Available' },
                    { key: 'hasShowers', label: ' Shower Available' },
                    { key: 'hasPersonalTraining', label: ' Personal Training' },
                    { key: 'hasGroupClasses', label: ' Group Classes' },
                    { key: 'isWomenFriendly', label: ' Women Friendly' }
                  ].map(badge => (
                    <label key={badge.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', background: '#231D14', padding: '8px', borderRadius: '6px' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(profile[badge.key])}
                        onChange={e => setProfile({ ...profile, [badge.key]: e.target.checked })}
                      />
                      {badge.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Amenities & Equipment Checklist */}
            <div style={{ background: '#2D251C', padding: '20px', borderRadius: '12px', border: '1px solid #3A3025', gridColumn: '1 / -1' }}>
              <h3 style={{ fontSize: '16px', color: '#F0A020', marginBottom: '16px' }}> Detailed Amenities & Equipment Checklist</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div>
                  <h4 style={{ fontSize: '14px', color: '#A39686', marginBottom: '10px' }}>Select Amenities:</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {availableAmenities.map(item => {
                      const isSelected = profile.amenities.includes(item);
                      return (
                        <button
                          type="button"
                          key={item}
                          onClick={() => toggleAmenity(item)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            border: 'none',
                            cursor: 'pointer',
                            background: isSelected ? '#F0A020' : '#231D14',
                            color: isSelected ? '#231D14' : '#A39686',
                            fontWeight: isSelected ? 'bold' : 'normal'
                          }}
                        >
                          {isSelected ? <Check size={13} /> : <Plus size={13} />} {item}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '14px', color: '#A39686', marginBottom: '10px' }}>Select Equipment Available:</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {availableEquipments.map(item => {
                      const isSelected = profile.equipments.includes(item);
                      return (
                        <button
                          type="button"
                          key={item}
                          onClick={() => toggleEquipment(item)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            border: 'none',
                            cursor: 'pointer',
                            background: isSelected ? '#F0A020' : '#231D14',
                            color: isSelected ? '#231D14' : '#A39686',
                            fontWeight: isSelected ? 'bold' : 'normal'
                          }}
                        >
                          {isSelected ? <Check size={13} /> : <Plus size={13} />} {item}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div style={{ marginTop: '24px', textAlign: 'right' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '14px 28px',
                borderRadius: '8px',
                background: '#F0A020',
                color: '#231D14',
                fontWeight: 'bold',
                fontSize: '16px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {saving ? 'Submitting...' : 'Save & Submit Profile for FitPass Review'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: SOCIAL POSTS */}
      {activeTab === 'posts' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '20px', color: '#FFF' }}>Manage Gym Highlights & Posts</h2>
            <button
              onClick={openCreatePostModal}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                background: '#F0A020',
                color: '#231D14',
                fontWeight: 'bold',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              + Create New Post
            </button>
          </div>

          {posts.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: '#2D251C', borderRadius: '12px', color: '#A39686' }}>
              No social posts created yet. Click "+ Create New Post" to showcase your gym workouts and facility!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {posts.map(post => (
                <div key={post.id} style={{ background: '#2D251C', borderRadius: '12px', overflow: 'hidden', border: '1px solid #3A3025' }}>
                  {post.images && post.images.length > 0 ? (
                    <img src={post.images[0]} alt={post.title} style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '180px', background: '#1A150F', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6D6154' }}>
                      No Media Image
                    </div>
                  )}
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>{post.title}</h3>
                      <span style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        background: post.status === 'Approved' ? 'rgba(46,125,50,0.2)' : post.status === 'Rejected' ? 'rgba(198,40,40,0.2)' : 'rgba(240,160,32,0.2)',
                        color: post.status === 'Approved' ? '#4CAF50' : post.status === 'Rejected' ? '#FF5252' : '#F0A020'
                      }}>
                        {post.status}
                      </span>
                    </div>

                    <p style={{ fontSize: '13px', color: '#A39686', marginBottom: '12px' }}>{post.caption}</p>

                    {post.rejectionReason && (
                      <div style={{ fontSize: '12px', color: '#FF8A80', background: 'rgba(198,40,40,0.1)', padding: '6px 10px', borderRadius: '6px', marginBottom: '12px' }}>
                        Rejection reason: {post.rejectionReason}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#6D6154' }}>
                      <span> {post.images?.length || 0} Photos</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => openEditPostModal(post)}
                          style={{ padding: '4px 10px', background: '#3A3025', border: 'none', color: '#FFF', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          style={{ padding: '4px 10px', background: 'rgba(198,40,40,0.3)', border: 'none', color: '#FF8A80', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT POST MODAL */}
      {showPostModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            background: '#2D251C',
            width: '100%',
            maxWidth: '600px',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid #3A3025',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h2 style={{ fontSize: '20px', color: '#F0A020', marginBottom: '16px' }}>
              {editingPostId ? 'Edit Gym Post' : 'Create New Gym Post'}
            </h2>

            <form onSubmit={handlePostSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#A39686', marginBottom: '6px' }}>Post Title *</label>
                <input
                  type="text"
                  required
                  value={postForm.title}
                  onChange={e => setPostForm({ ...postForm, title: e.target.value })}
                  placeholder="e.g. New Heavy Resistance Zone Launched!"
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#231D14', border: '1px solid #3A3025', color: '#FFF' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#A39686', marginBottom: '6px' }}>Short Caption</label>
                <input
                  type="text"
                  value={postForm.caption}
                  onChange={e => setPostForm({ ...postForm, caption: e.target.value })}
                  placeholder="e.g. High intensity leg press session"
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#231D14', border: '1px solid #3A3025', color: '#FFF' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#A39686', marginBottom: '6px' }}>Full Description</label>
                <textarea
                  rows={3}
                  value={postForm.description}
                  onChange={e => setPostForm({ ...postForm, description: e.target.value })}
                  placeholder="Describe the highlight in detail..."
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#231D14', border: '1px solid #3A3025', color: '#FFF' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', color: '#A39686', marginBottom: '8px' }}>Image URLs Carousel (Max 5)</label>
                {postForm.images.map((imgUrl, idx) => (
                  <div key={idx} style={{ marginBottom: '8px' }}>
                    <input
                      type="text"
                      value={imgUrl}
                      onChange={e => handlePostImageChange(idx, e.target.value)}
                      placeholder={`Image ${idx + 1} URL (https://...)`}
                      style={{ width: '100%', padding: '8px', borderRadius: '6px', background: '#231D14', border: '1px solid #3A3025', color: '#FFF', fontSize: '12px' }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowPostModal(false)}
                  style={{ padding: '10px 20px', borderRadius: '6px', background: '#3A3025', color: '#FFF', border: 'none', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ padding: '10px 20px', borderRadius: '6px', background: '#F0A020', color: '#231D14', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
                >
                  {saving ? 'Submitting...' : 'Submit Post for Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

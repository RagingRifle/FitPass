import React, { useState, useEffect } from 'react';
import { discoveryService } from '../../services/discoveryService';
import { Check, X } from 'lucide-react';

export default function DiscoveryApprovalQueue() {
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState({ profiles: [], posts: [] });
  const [activeSubTab, setActiveSubTab] = useState('profiles'); // 'profiles' | 'posts'
  
  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingItem, setRejectingItem] = useState(null); // { type: 'profile' | 'post', id: string, name: string }
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await discoveryService.getAdminApprovalQueue();
      if (res.data && res.data.data) {
        setQueue(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch approval queue", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveProfile = async (gymId) => {
    try {
      await discoveryService.reviewProfileStatus(gymId, 'Approved');
      fetchQueue();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to approve profile");
    }
  };

  const handleApprovePost = async (postId) => {
    try {
      await discoveryService.reviewPostStatus(postId, 'Approved');
      fetchQueue();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to approve post");
    }
  };

  const openRejectModal = (type, id, name) => {
    setRejectingItem({ type, id, name });
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) return alert("Rejection reason is required");

    setProcessing(true);
    try {
      if (rejectingItem.type === 'profile') {
        await discoveryService.reviewProfileStatus(rejectingItem.id, 'Rejected', rejectionReason);
      } else {
        await discoveryService.reviewPostStatus(rejectingItem.id, 'Rejected', rejectionReason);
      }
      setShowRejectModal(false);
      fetchQueue();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to reject item");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#A39686' }}>
        <div style={{ fontSize: '18px', color: '#F0A020', fontWeight: 'bold' }}>Loading FitPass Approval Queue...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', color: '#FFFFFF' }}>
      {/* Header */}
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
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
             FitPass Discovery Approval Queue
          </h1>
          <p style={{ color: '#A39686', fontSize: '14px', marginTop: '6px', marginBottom: 0 }}>
            Review pending partner gym profiles and social posts before they go live to all FitPass members.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setActiveSubTab('profiles')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 'bold',
              border: 'none',
              cursor: 'pointer',
              background: activeSubTab === 'profiles' ? '#F0A020' : '#3A3025',
              color: activeSubTab === 'profiles' ? '#231D14' : '#A39686'
            }}
          >
             Pending Profiles ({queue.profiles.length})
          </button>

          <button
            onClick={() => setActiveSubTab('posts')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: 'bold',
              border: 'none',
              cursor: 'pointer',
              background: activeSubTab === 'posts' ? '#F0A020' : '#3A3025',
              color: activeSubTab === 'posts' ? '#231D14' : '#A39686'
            }}
          >
             Pending Posts ({queue.posts.length})
          </button>
        </div>
      </div>

      {/* SUBTAB 1: PENDING PROFILES */}
      {activeSubTab === 'profiles' && (
        <div>
          {queue.profiles.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: '#2D251C', borderRadius: '12px', color: '#81C784' }}>
              <Check size={16} /> All partner gym profiles are reviewed and approved! No pending profiles.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {queue.profiles.map(p => (
                <div key={p.id} style={{
                  background: '#2D251C',
                  borderRadius: '12px',
                  padding: '20px',
                  border: '1px solid #3A3025',
                  display: 'flex',
                  gap: '20px',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: 1, minWidth: '300px' }}>
                    <img
                      src={p.logoUrl || "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=80&auto=format&fit=crop&q=60"}
                      alt={p.gym?.name}
                      style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover', border: '2px solid #F0A020' }}
                    />
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#FFF' }}>
                        {p.gym?.name}
                      </h3>
                      <div style={{ fontSize: '13px', color: '#A39686' }}>
                         {p.city || 'Chennai'} | {p.address} | Owner: {p.ownerName || 'N/A'}
                      </div>
                      <div style={{ fontSize: '13px', color: '#F0A020', marginTop: '4px' }}>
                        Hours: {p.openingTime} - {p.closingTime}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => handleApproveProfile(p.gymId)}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '6px',
                        background: '#2E7D32',
                        color: '#FFF',
                        fontWeight: 'bold',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <Check size={15} /> Approve Profile
                    </button>
                    <button
                      onClick={() => openRejectModal('profile', p.gymId, p.gym?.name)}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '6px',
                        background: '#C62828',
                        color: '#FFF',
                        fontWeight: 'bold',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <X size={15} /> Reject (With Reason)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: PENDING POSTS */}
      {activeSubTab === 'posts' && (
        <div>
          {queue.posts.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', background: '#2D251C', borderRadius: '12px', color: '#81C784' }}>
              <Check size={16} /> All gym social posts are reviewed! No pending posts.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {queue.posts.map(post => (
                <div key={post.id} style={{ background: '#2D251C', borderRadius: '12px', border: '1px solid #3A3025', overflow: 'hidden' }}>
                  {post.images && post.images.length > 0 && (
                    <img src={post.images[0]} alt={post.title} style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
                  )}
                  <div style={{ padding: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#F0A020', fontWeight: 'bold', marginBottom: '4px' }}>
                      Gym: {post.gym?.name}
                    </div>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 6px 0', color: '#FFF' }}>{post.title}</h3>
                    <p style={{ fontSize: '13px', color: '#A39686', marginBottom: '16px' }}>{post.caption || post.description}</p>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => handleApprovePost(post.id)}
                        style={{ flex: 1, padding: '8px 14px', background: '#2E7D32', color: '#FFF', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        <Check size={15} /> Approve Post
                      </button>
                      <button
                        onClick={() => openRejectModal('post', post.id, post.title)}
                        style={{ flex: 1, padding: '8px 14px', background: '#C62828', color: '#FFF', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                      >
                        <X size={15} /> Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      {showRejectModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div style={{ background: '#2D251C', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '480px', border: '1px solid #3A3025' }}>
            <h3 style={{ fontSize: '18px', color: '#FF5252', marginBottom: '12px' }}>
              Reject Submission: {rejectingItem?.name}
            </h3>
            <p style={{ fontSize: '13px', color: '#A39686', marginBottom: '14px' }}>
              Specify the clear reason for rejection so the gym owner can fix and resubmit:
            </p>
            <form onSubmit={handleConfirmReject}>
              <textarea
                rows={4}
                required
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                placeholder="e.g. Please upload higher resolution cover photos and update contact number."
                style={{ width: '100%', padding: '10px', borderRadius: '6px', background: '#231D14', border: '1px solid #3A3025', color: '#FFF', marginBottom: '16px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  style={{ padding: '8px 16px', background: '#3A3025', color: '#FFF', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  style={{ padding: '8px 16px', background: '#C62828', color: '#FFF', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  {processing ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

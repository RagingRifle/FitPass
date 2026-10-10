import React, { useState, useEffect } from 'react';
import { discoveryService } from '../services/discoveryService';
import { Skeleton } from '../components/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { Check, Dumbbell, X } from 'lucide-react';

export default function FitPassGymExplore() {
  const [loading, setLoading] = useState(true);
  const [gyms, setGyms] = useState([]);
  const [posts, setPosts] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [userLocation, setUserLocation] = useState(null);

  // Selected Gym Profile Modal
  const [selectedGym, setSelectedGym] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    // Request browser GPS position for real distance calculation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          });
          fetchDiscoveryData(pos.coords.latitude, pos.coords.longitude);
        },
        () => {
          // GPS Denied / Unavailable -> Fallback
          fetchDiscoveryData();
        }
      );
    } else {
      fetchDiscoveryData();
    }
  }, []);

  const fetchDiscoveryData = async (lat = null, lng = null, category = activeCategory, search = searchTerm) => {
    setLoading(true);
    try {
      const params = {};
      if (lat && lng) {
        params.lat = lat;
        params.lng = lng;
      }
      if (category && category !== 'all') {
        params.category = category;
      }
      if (search) {
        params.search = search;
      }
      if (cityFilter) {
        params.city = cityFilter;
      }

      const [gymsRes, postsRes] = await Promise.all([
        discoveryService.getPublicGyms(params),
        discoveryService.getPublicPostsFeed()
      ]);

      if (gymsRes.data && gymsRes.data.data) {
        setGyms(gymsRes.data.data);
      }
      if (postsRes.data && postsRes.data.data) {
        setPosts(postsRes.data.data);
      }
    } catch (err) {
      console.error("Failed to load discovery data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    fetchDiscoveryData(userLocation?.lat, userLocation?.lng, cat, searchTerm);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDiscoveryData(userLocation?.lat, userLocation?.lng, activeCategory, searchTerm);
  };

  const openGymDetails = async (gymId) => {
    setLoadingDetails(true);
    try {
      const params = userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : {};
      const res = await discoveryService.getPublicGymDetails(gymId, params);
      if (res.data && res.data.data) {
        setSelectedGym(res.data.data);
      }
    } catch {
      alert("Failed to load gym profile details");
    } finally {
      setLoadingDetails(false);
    }
  };

  const categories = [
    { id: 'all', label: ' All Partner Gyms' },
    { id: 'nearby', label: ' Nearby Gyms' },
    { id: 'recommended', label: ' Recommended' },
    { id: 'trending', label: ' Trending' },
    { id: 'newly_added', label: ' Newly Added' },
    { id: 'highest_rated', label: ' Highest Rated' },
    { id: 'most_visited', label: ' Most Visited' },
    { id: 'open_now', label: ' Open Right Now' }
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1300px', margin: '0 auto', color: '#FFFFFF' }}>
      
      {/* Hero Header */}
      <div style={{
        background: 'linear-gradient(135deg, #2D251C 0%, #1A150F 100%)',
        padding: '32px 24px',
        borderRadius: '20px',
        border: '1px solid #3A3025',
        marginBottom: '24px',
        textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
      }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0 0 8px 0', background: 'linear-gradient(90deg, #F0A020 0%, #FCE6B8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Explore & Discover FitPass Partner Gyms
        </h1>
        <p style={{ color: '#A39686', fontSize: '15px', maxWidth: '600px', margin: '0 auto 24px auto' }}>
          Browse verified workout centers, compare real-time amenities, view gym highlights, and check in seamlessly using your FitPass subscription.
        </p>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', maxWidth: '700px', margin: '0 auto' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by gym name, location, city, or amenities (e.g., Treadmills, Steam Bath)..."
            style={{
              flex: 1,
              padding: '14px 20px',
              borderRadius: '30px',
              background: '#231D14',
              border: '1px solid #F0A020',
              color: '#FFFFFF',
              fontSize: '15px',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            style={{
              padding: '14px 28px',
              borderRadius: '30px',
              background: '#F0A020',
              color: '#231D14',
              fontWeight: 'bold',
              fontSize: '15px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Search
          </button>
        </form>
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '24px' }}>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => handleCategoryChange(cat.id)}
            style={{
              padding: '10px 18px',
              borderRadius: '24px',
              fontSize: '14px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              border: 'none',
              cursor: 'pointer',
              background: activeCategory === cat.id ? '#F0A020' : '#2D251C',
              color: activeCategory === cat.id ? '#231D14' : '#A39686',
              boxShadow: activeCategory === cat.id ? '0 4px 14px rgba(240, 160, 32, 0.4)' : 'none'
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Social Posts Carousel Highlights */}
      {posts.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', color: '#F0A020', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
             Latest Partner Gym Posts & Highlights
          </h2>
          <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '12px' }}>
            {posts.map(post => (
              <div key={post.id} style={{
                minWidth: '280px',
                maxWidth: '280px',
                background: '#2D251C',
                borderRadius: '12px',
                border: '1px solid #3A3025',
                overflow: 'hidden',
                flexShrink: 0
              }}>
                {post.images && post.images.length > 0 ? (
                  <img src={post.images[0]} alt={post.title} style={{ width: '100%', height: '160px', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '160px', background: '#1A150F' }} />
                )}
                <div style={{ padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: '#F0A020', fontWeight: 'bold', marginBottom: '4px' }}>
                    {post.gym?.name}
                  </div>
                  <h4 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#FFF' }}>{post.title}</h4>
                  <p style={{ fontSize: '12px', color: '#A39686', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {post.caption || post.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gym Cards Grid */}
      <h2 style={{ fontSize: '20px', color: '#FFF', marginBottom: '16px' }}>
        Found {gyms.length} FitPass Partner Gyms
      </h2>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="card" style={{ height: '320px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Skeleton width="100%" height={160} borderRadius={12} />
              <Skeleton width="70%" height={20} />
              <Skeleton width="40%" height={14} />
              <Skeleton width="100%" height={14} />
            </div>
          ))}
        </div>
      ) : gyms.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="No Partner Gyms Found"
          description="No partner gyms matched your current search filters. Try clearing your search term or selecting a different category."
          primaryAction={{
            label: "Clear Search Filters",
            onClick: () => {
              setSearchTerm('');
              setActiveCategory('all');
              fetchDiscoveryData(userLocation?.lat, userLocation?.lng, 'all', '');
            }
          }}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {gyms.map(gym => {
            const p = gym.discoveryProfile || {};
            return (
              <div
                key={gym.id}
                onClick={() => openGymDetails(gym.id)}
                style={{
                  background: '#2D251C',
                  borderRadius: '16px',
                  border: '1px solid #3A3025',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, boxShadow 0.2s',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                }}
              >
                {/* Gym Cover & Badges */}
                <div style={{ position: 'relative', height: '180px' }}>
                  <img
                    src={p.coverImageUrl || "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80"}
                    alt={gym.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />

                  {/* Logo overlay */}
                  <img
                    src={p.logoUrl || "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=80&auto=format&fit=crop&q=60"}
                    alt={gym.name}
                    style={{
                      position: 'absolute',
                      bottom: '-20px',
                      left: '16px',
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '3px solid #2D251C',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
                    }}
                  />

                  {/* Distance & Open Pill */}
                  <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '6px' }}>
                    {p.isOpenNow ? (
                      <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', background: 'rgba(46,125,50,0.9)', color: '#FFF', fontWeight: 'bold' }}>
                         Open Now
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', background: 'rgba(198,40,40,0.9)', color: '#FFF', fontWeight: 'bold' }}>
                         Closed
                      </span>
                    )}
                    {p.distanceKm !== null && (
                      <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', background: 'rgba(0,0,0,0.7)', color: '#F0A020', fontWeight: 'bold' }}>
                         {p.distanceKm} km
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Content */}
                <div style={{ padding: '28px 16px 16px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#FFF' }}>{gym.name}</h3>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#F0A020' }}>
                       {p.rating || 4.8}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: '#A39686', marginBottom: '10px' }}>
                     {p.city || 'Chennai'} • {p.address}
                  </div>

                  <p style={{
                    fontSize: '13px',
                    color: '#A39686',
                    marginBottom: '14px',
                    lineHeight: '1.4',
                    minHeight: '36.4px',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {p.shortDescription}
                  </p>

                  {/* Badges row */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                    {p.isAc && <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', background: '#231D14', color: '#A39686' }}> AC</span>}
                    {p.hasParking && <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', background: '#231D14', color: '#A39686' }}> Parking</span>}
                    {p.hasPersonalTraining && <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', background: '#231D14', color: '#A39686' }}> Trainer</span>}
                    {p.isWomenFriendly && <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '4px', background: '#231D14', color: '#A39686' }}> Women Friendly</span>}
                  </div>

                  <button
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      background: '#F0A020',
                      color: '#231D14',
                      fontWeight: 'bold',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    View Complete Gym Profile →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FULL GYM PROFILE MODAL */}
      {selectedGym && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '16px'
        }}>
          <div style={{
            background: '#231D14',
            width: '100%',
            maxWidth: '850px',
            borderRadius: '20px',
            overflow: 'hidden',
            border: '1px solid #3A3025',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            {/* Modal Hero Banner */}
            <div style={{ position: 'relative', height: '240px' }}>
              <img
                src={selectedGym.discoveryProfile?.coverImageUrl}
                alt={selectedGym.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <button
                onClick={() => setSelectedGym(null)}
                style={{
                  position: 'absolute', top: '16px', right: '16px',
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'rgba(0,0,0,0.6)', color: '#FFF', border: 'none',
                  fontSize: '18px', cursor: 'pointer'
                }}
              >
                <X size={20} />
              </button>

              <div style={{
                position: 'absolute', bottom: '16px', left: '24px',
                display: 'flex', alignItems: 'center', gap: '16px'
              }}>
                <img
                  src={selectedGym.discoveryProfile?.logoUrl}
                  alt={selectedGym.name}
                  style={{ width: '70px', height: '70px', borderRadius: '50%', border: '3px solid #F0A020' }}
                />
                <div>
                  <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#FFF', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
                    {selectedGym.name}
                  </h2>
                  <div style={{ fontSize: '13px', color: '#FCE6B8', marginTop: '4px' }}>
                    FitPass Verified Partner •  {selectedGym.discoveryProfile?.rating} ({selectedGym.discoveryProfile?.reviewCount} reviews)
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Body Content */}
            <div style={{ padding: '24px' }}>
              {/* Quick Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <a
                  href={`tel:${selectedGym.discoveryProfile?.contactNumber}`}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '8px', background: '#F0A020',
                    color: '#231D14', fontWeight: 'bold', textAlign: 'center', textDecoration: 'none'
                  }}
                >
                   Call Gym ({selectedGym.discoveryProfile?.contactNumber})
                </a>

                <a
                  href={selectedGym.discoveryProfile?.googleMapsUrl || `https://maps.google.com/?q=${encodeURIComponent(selectedGym.name + ' ' + selectedGym.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1, padding: '12px', borderRadius: '8px', background: '#3A3025',
                    color: '#FFF', fontWeight: 'bold', textAlign: 'center', textDecoration: 'none'
                  }}
                >
                   Get Directions on Maps
                </a>
              </div>

              {/* Overview & Hours */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', color: '#F0A020', marginBottom: '8px' }}>About {selectedGym.name}</h3>
                  <p style={{ fontSize: '14px', color: '#A39686', lineHeight: '1.6' }}>
                    {selectedGym.discoveryProfile?.description || selectedGym.discoveryProfile?.shortDescription}
                  </p>
                </div>

                <div style={{ background: '#2D251C', padding: '16px', borderRadius: '12px', border: '1px solid #3A3025' }}>
                  <h4 style={{ fontSize: '14px', color: '#FFF', marginBottom: '8px' }}> Operating Hours</h4>
                  <div style={{ fontSize: '13px', color: '#A39686' }}>
                    {selectedGym.discoveryProfile?.openingTime} - {selectedGym.discoveryProfile?.closingTime}
                  </div>
                  <div style={{ fontSize: '12px', color: '#F0A020', marginTop: '6px' }}>
                    Working Days: {selectedGym.discoveryProfile?.workingDays?.join(', ')}
                  </div>
                </div>
              </div>

              {/* Amenities & Equipment */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', color: '#F0A020', marginBottom: '12px' }}>Facilities & Amenities</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {selectedGym.discoveryProfile?.amenities?.map(item => (
                    <span key={item} style={{ padding: '6px 14px', borderRadius: '20px', background: '#2D251C', color: '#FFF', fontSize: '13px', border: '1px solid #3A3025' }}>
                      <Check size={14} /> {item}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', color: '#F0A020', marginBottom: '12px' }}>Equipment Available</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {selectedGym.discoveryProfile?.equipments?.map(item => (
                    <span key={item} style={{ padding: '6px 14px', borderRadius: '20px', background: '#2D251C', color: '#A39686', fontSize: '13px' }}>
                       {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* Gym Posts */}
              {selectedGym.posts && selectedGym.posts.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '16px', color: '#F0A020', marginBottom: '12px' }}>Gym Highlights & Workouts</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                    {selectedGym.posts.map(post => (
                      <div key={post.id} style={{ background: '#2D251C', borderRadius: '10px', overflow: 'hidden', border: '1px solid #3A3025' }}>
                        {post.images && post.images.length > 0 && (
                          <img src={post.images[0]} alt={post.title} style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
                        )}
                        <div style={{ padding: '10px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#FFF' }}>{post.title}</div>
                          <div style={{ fontSize: '11px', color: '#A39686' }}>{post.caption}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

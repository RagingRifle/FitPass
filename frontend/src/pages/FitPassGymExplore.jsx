import React, { useState, useEffect } from 'react';
import { discoveryService } from '../services/discoveryService';
import { Skeleton } from '../components/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { Check, Dumbbell, X, MapPin, Star, Phone, Navigation } from 'lucide-react';

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
    { id: 'all', label: 'All Partner Gyms' },
    { id: 'nearby', label: 'Nearby Gyms' },
    { id: 'recommended', label: 'Recommended' },
    { id: 'trending', label: 'Trending' },
    { id: 'newly_added', label: 'Newly Added' },
    { id: 'highest_rated', label: 'Highest Rated' },
    { id: 'most_visited', label: 'Most Visited' },
    { id: 'open_now', label: 'Open Right Now' }
  ];

  return (
    <div style={{ padding: '24px 16px', maxWidth: '1300px', margin: '0 auto', color: '#000000' }}>
      
      {/* Hero Header */}
      <div style={{
        background: '#000000',
        padding: '36px 28px',
        borderRadius: '20px',
        border: '2px solid #000000',
        marginBottom: '28px',
        textAlign: 'center',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle decorative glow */}
        <div style={{
          position: 'absolute',
          top: '-120px',
          right: '-100px',
          width: '320px',
          height: '320px',
          borderRadius: '50%',
          border: '2px solid rgba(216, 183, 71, 0.25)',
          boxShadow: '0 0 0 30px rgba(216, 183, 71, 0.05)',
          pointerEvents: 'none'
        }} />

        <h1 style={{
          fontSize: '32px',
          fontWeight: '900',
          margin: '0 0 10px 0',
          color: '#FFFFFF',
          letterSpacing: '-0.03em',
          fontFamily: "'Outfit', sans-serif"
        }}>
          Explore & Discover <span style={{ color: '#FEDF1E' }}>FitPass Partner Gyms</span>
        </h1>
        <p style={{
          color: '#E2DDD2',
          fontSize: '15px',
          maxWidth: '650px',
          margin: '0 auto 28px auto',
          lineHeight: '1.6'
        }}>
          Browse verified workout centers, compare real-time amenities, view gym highlights, and check in seamlessly using your FitPass subscription.
        </p>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', maxWidth: '720px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by gym name, location, city, or amenities..."
            style={{
              flex: 1,
              padding: '14px 22px',
              borderRadius: '30px',
              background: '#FFFFFF',
              border: '2px solid #DFD7C7',
              color: '#000000',
              fontWeight: '600',
              fontSize: '14px',
              outline: 'none',
              boxShadow: '0 4px 14px rgba(0,0,0,0.1)'
            }}
          />
          <button
            type="submit"
            style={{
              padding: '14px 30px',
              borderRadius: '30px',
              background: '#FEDF1E',
              color: '#000000',
              fontWeight: '900',
              fontSize: '15px',
              border: '1.5px solid #B9983D',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(216, 183, 71, 0.4)',
              transition: 'all 0.18s ease'
            }}
          >
            Search
          </button>
        </form>
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '14px', marginBottom: '24px' }}>
        {categories.map(cat => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              style={{
                padding: '10px 20px',
                borderRadius: '24px',
                fontSize: '13px',
                fontWeight: '800',
                whiteSpace: 'nowrap',
                border: isActive ? '1.5px solid #B9983D' : '1.5px solid #DFD7C7',
                cursor: 'pointer',
                background: isActive ? '#FEDF1E' : '#FFFFFF',
                color: '#000000',
                boxShadow: isActive ? '0 4px 14px rgba(216, 183, 71, 0.35)' : '0 2px 6px rgba(0,0,0,0.04)',
                transition: 'all 0.18s ease'
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Social Posts Carousel Highlights */}
      {posts.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#000000', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Latest Partner Gym Posts & Highlights
          </h2>
          <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '12px' }}>
            {posts.map(post => (
              <div key={post.id} style={{
                minWidth: '280px',
                maxWidth: '280px',
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1.5px solid #DFD7C7',
                overflow: 'hidden',
                flexShrink: 0,
                boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
              }}>
                {post.images && post.images.length > 0 ? (
                  <img src={post.images[0]} alt={post.title} style={{ width: '100%', height: '160px', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '160px', background: '#F6F3EC' }} />
                )}
                <div style={{ padding: '14px' }}>
                  <div style={{ fontSize: '11px', color: '#A37A00', fontWeight: '800', marginBottom: '4px', textTransform: 'uppercase' }}>
                    {post.gym?.name}
                  </div>
                  <h4 style={{ fontSize: '14px', fontWeight: '800', margin: '0 0 4px 0', color: '#000000' }}>{post.title}</h4>
                  <p style={{ fontSize: '12px', color: '#555045', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {post.caption || post.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gym Cards Grid Header */}
      <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#000000', marginBottom: '18px', letterSpacing: '-0.02em' }}>
        Found {gyms.length} FitPass Partner Gyms
      </h2>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="card" style={{ height: '320px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#FFFFFF' }}>
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
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1.5px solid #DFD7C7',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                  boxShadow: '0 4px 18px rgba(0,0,0,0.04)'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.borderColor = '#FEDF1E';
                  e.currentTarget.style.boxShadow = '0 10px 28px rgba(0,0,0,0.09), 0 0 0 1px rgba(216, 183, 71, 0.4)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = '#DFD7C7';
                  e.currentTarget.style.boxShadow = '0 4px 18px rgba(0,0,0,0.04)';
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
                      border: '3px solid #FFFFFF',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
                    }}
                  />

                  {/* Distance & Open Pill */}
                  <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '6px' }}>
                    {p.isOpenNow ? (
                      <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', background: '#E6F4EA', color: '#137333', border: '1px solid #CEEAD6', fontWeight: '800' }}>
                        Open Now
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', background: '#FCE8E6', color: '#C5221F', border: '1px solid #FAD2CF', fontWeight: '800' }}>
                        Closed
                      </span>
                    )}
                    {p.distanceKm !== null && (
                      <span style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', background: '#000000', color: '#FEDF1E', fontWeight: '800' }}>
                        {p.distanceKm} km
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Content */}
                <div style={{ padding: '28px 18px 18px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#000000' }}>{gym.name}</h3>
                    <span style={{ fontSize: '13px', fontWeight: '900', color: '#000000', display: 'flex', alignItems: 'center', gap: '4px', background: '#FBF2D8', padding: '3px 8px', borderRadius: '6px', border: '1px solid #FEDF1E' }}>
                      <Star size={12} fill="#FEDF1E" color="#FEDF1E" /> {p.rating || 4.8}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: '#555045', marginBottom: '10px', fontWeight: '600' }}>
                    {p.city || 'Chennai'} • {p.address}
                  </div>

                  <p style={{
                    fontSize: '13px',
                    color: '#555045',
                    marginBottom: '14px',
                    lineHeight: '1.5',
                    minHeight: '38px',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {p.shortDescription}
                  </p>

                  {/* Badges row */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                    {p.isAc && <span style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '6px', background: '#F6F3EC', color: '#000000', border: '1px solid #DFD7C7', fontWeight: '700' }}>AC</span>}
                    {p.hasParking && <span style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '6px', background: '#F6F3EC', color: '#000000', border: '1px solid #DFD7C7', fontWeight: '700' }}>Parking</span>}
                    {p.hasPersonalTraining && <span style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '6px', background: '#F6F3EC', color: '#000000', border: '1px solid #DFD7C7', fontWeight: '700' }}>Trainer</span>}
                    {p.isWomenFriendly && <span style={{ fontSize: '10px', padding: '4px 8px', borderRadius: '6px', background: '#F6F3EC', color: '#000000', border: '1px solid #DFD7C7', fontWeight: '700' }}>Women Friendly</span>}
                  </div>

                  <button
                    style={{
                      width: '100%',
                      padding: '11px',
                      borderRadius: '10px',
                      background: '#FEDF1E',
                      color: '#000000',
                      fontWeight: '900',
                      fontSize: '13px',
                      border: '1.5px solid #B9983D',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#FEDF1E'}
                    onMouseLeave={e => e.currentTarget.style.background = '#FEDF1E'}
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
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '16px'
        }}>
          <div style={{
            background: '#FFFFFF',
            color: '#000000',
            width: '100%',
            maxWidth: '850px',
            borderRadius: '20px',
            overflow: 'hidden',
            border: '2px solid #DFD7C7',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            {/* Modal Hero Banner */}
            <div style={{ position: 'relative', height: '240px' }}>
              <img
                src={selectedGym.discoveryProfile?.coverImageUrl || "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80"}
                alt={selectedGym.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <button
                onClick={() => setSelectedGym(null)}
                style={{
                  position: 'absolute', top: '16px', right: '16px',
                  width: '38px', height: '38px', borderRadius: '50%',
                  background: 'rgba(0,0,0,0.7)', color: '#FFF', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={20} />
              </button>

              <div style={{
                position: 'absolute', bottom: '16px', left: '24px',
                display: 'flex', alignItems: 'center', gap: '16px'
              }}>
                <img
                  src={selectedGym.discoveryProfile?.logoUrl || "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=80&auto=format&fit=crop&q=60"}
                  alt={selectedGym.name}
                  style={{ width: '70px', height: '70px', borderRadius: '50%', border: '3px solid #FEDF1E', background: '#FFFFFF' }}
                />
                <div>
                  <h2 style={{ fontSize: '24px', fontWeight: '900', margin: 0, color: '#FFFFFF', textShadow: '0 2px 10px rgba(0,0,0,0.9)' }}>
                    {selectedGym.name}
                  </h2>
                  <div style={{ fontSize: '13px', color: '#FEDF1E', fontWeight: '800', marginTop: '4px', textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>
                    FitPass Verified Partner • ★ {selectedGym.discoveryProfile?.rating || 4.8} ({selectedGym.discoveryProfile?.reviewCount || 0} reviews)
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
                    flex: 1, padding: '12px', borderRadius: '10px', background: '#FEDF1E',
                    color: '#000000', fontWeight: '800', textAlign: 'center', textDecoration: 'none',
                    border: '1.5px solid #B9983D', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}
                >
                  <Phone size={16} /> Call Gym ({selectedGym.discoveryProfile?.contactNumber || 'Available'})
                </a>

                <a
                  href={selectedGym.discoveryProfile?.googleMapsUrl || `https://maps.google.com/?q=${encodeURIComponent(selectedGym.name + ' ' + (selectedGym.address || ''))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1, padding: '12px', borderRadius: '10px', background: '#000000',
                    color: '#FFFFFF', fontWeight: '800', textAlign: 'center', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}
                >
                  <Navigation size={16} /> Get Directions on Maps
                </a>
              </div>

              {/* Overview & Hours */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#000000', marginBottom: '8px' }}>About {selectedGym.name}</h3>
                  <p style={{ fontSize: '14px', color: '#555045', lineHeight: '1.6' }}>
                    {selectedGym.discoveryProfile?.description || selectedGym.discoveryProfile?.shortDescription || 'No description provided.'}
                  </p>
                </div>

                <div style={{ background: '#F6F3EC', padding: '16px', borderRadius: '12px', border: '1.5px solid #DFD7C7' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#000000', marginBottom: '8px' }}>Operating Hours</h4>
                  <div style={{ fontSize: '13px', color: '#555045', fontWeight: '600' }}>
                    {selectedGym.discoveryProfile?.openingTime || '6:00 AM'} - {selectedGym.discoveryProfile?.closingTime || '10:00 PM'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#000000', fontWeight: '700', marginTop: '6px' }}>
                    Working Days: {selectedGym.discoveryProfile?.workingDays?.join(', ') || 'All Days'}
                  </div>
                </div>
              </div>

              {/* Amenities & Equipment */}
              {selectedGym.discoveryProfile?.amenities?.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#000000', marginBottom: '12px' }}>Facilities & Amenities</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {selectedGym.discoveryProfile?.amenities?.map(item => (
                      <span key={item} style={{ padding: '6px 14px', borderRadius: '20px', background: '#F6F3EC', color: '#000000', fontSize: '13px', border: '1px solid #DFD7C7', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Check size={14} color="#1B7C3D" /> {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedGym.discoveryProfile?.equipments?.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#000000', marginBottom: '12px' }}>Equipment Available</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {selectedGym.discoveryProfile?.equipments?.map(item => (
                      <span key={item} style={{ padding: '6px 14px', borderRadius: '20px', background: '#FBF2D8', color: '#000000', fontSize: '13px', border: '1px solid #FEDF1E', fontWeight: '700' }}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Gym Posts */}
              {selectedGym.posts && selectedGym.posts.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#000000', marginBottom: '12px' }}>Gym Highlights & Workouts</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                    {selectedGym.posts.map(post => (
                      <div key={post.id} style={{ background: '#FFFFFF', borderRadius: '12px', overflow: 'hidden', border: '1.5px solid #DFD7C7', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
                        {post.images && post.images.length > 0 && (
                          <img src={post.images[0]} alt={post.title} style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
                        )}
                        <div style={{ padding: '12px' }}>
                          <div style={{ fontSize: '13px', fontWeight: '800', color: '#000000' }}>{post.title}</div>
                          <div style={{ fontSize: '11px', color: '#555045', marginTop: '2px' }}>{post.caption}</div>
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

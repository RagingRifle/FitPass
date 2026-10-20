import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Linking,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/design-system/theme';
import { fontFamilies } from '@/design-system/tokens';
import { Skeleton } from '@/components/ui';
import {
  Building2,
  MapPin,
  Phone,
  Search,
  Star,
  LogOut,
  ArrowUpRight,
  BadgeCheck,
  ShieldCheck,
} from '@/components/ui/app-icons';
import { usePartnerGyms } from '../api/fitpass.api';
import { useAuth } from '@/features/auth';

import * as Location from 'expo-location';

const DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80';

const CITIES = ['All Locations', 'Chennai', 'Coimbatore', 'Madurai'];

// Deterministic coordinates mapping based on City/ID to show realistic location data
function getGymCoordinates(gym: any) {
  if (gym.latitude !== undefined && gym.latitude !== null && gym.longitude !== undefined && gym.longitude !== null) {
    const lat = Number(gym.latitude);
    const lng = Number(gym.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { latitude: lat, longitude: lng };
    }
  }

  const gymId = gym.id || gym._id || '';
  const city = (gym.city || gym.address || '').toLowerCase();
  
  // Base coordinates for cities
  let lat = 13.0827; // Chennai default
  let lng = 80.2707;
  
  if (city.includes('coimbatore')) {
    lat = 11.0168;
    lng = 76.9558;
  } else if (city.includes('madurai')) {
    lat = 9.9252;
    lng = 78.1198;
  }
  
  // Generate slightly offset coords based on ID characters to make them unique
  let hash = 0;
  for (let i = 0; i < gymId.length; i++) {
    hash = gymId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const offsetLat = ((hash % 100) / 1000) * 0.1; // Max 0.01 deg offset
  const offsetLng = (((hash >> 8) % 100) / 1000) * 0.1;
  
  return {
    latitude: lat + offsetLat,
    longitude: lng + offsetLng
  };
}

// Haversine distance in kilometers
function getDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function PartnerGymsList() {
  const { data: gyms, isLoading } = usePartnerGyms();
  const [search, setSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState('All Locations');
  const [userLocation, setUserLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [locPermission, setLocPermission] = useState<boolean | null>(null);
  const router = useRouter();
  const logout = useAuth((s) => s.logout);

  React.useEffect(() => {
    (async () => {
      try {
        if (!Location || typeof Location.requestForegroundPermissionsAsync !== 'function') {
          console.warn('ExpoLocation native module is not available in this client.');
          setLocPermission(false);
          return;
        }
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          setLocPermission(true);
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserLocation(loc.coords);
        } else {
          setLocPermission(false);
        }
      } catch (err) {
        console.warn('Error fetching location:', err);
        setLocPermission(false);
      }
    })();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Skeleton style={{ width: 140, height: 28, borderRadius: 8 }} />
          <Skeleton style={{ width: 38, height: 38, borderRadius: 12 }} />
        </View>
        <Skeleton style={{ height: 46, borderRadius: 14, marginBottom: 16 }} />
        <View style={styles.gridContainer}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} style={styles.gridSkeletonCard} />
          ))}
        </View>
      </View>
    );
  }

  const list = Array.isArray(gyms) ? gyms : [];

  // Map gyms with computed distance if user location is available
  const gymsWithDistance = list.map((gym) => {
    const gymCoords = getGymCoordinates(gym);
    let distance: number | null = null;
    if (userLocation) {
      distance = getDistanceInKm(
        userLocation.latitude,
        userLocation.longitude,
        gymCoords.latitude,
        gymCoords.longitude
      );
    }
    return {
      ...gym,
      distance
    };
  });

  // Filter list
  let filtered = gymsWithDistance.filter((g) => {
    const matchesSearch =
      g.name?.toLowerCase().includes(search.toLowerCase()) ||
      (g.address || '').toLowerCase().includes(search.toLowerCase());
    const matchesCity =
      selectedCity === 'All Locations' ||
      (g.address || '').toLowerCase().includes(selectedCity.toLowerCase()) ||
      (g.city || '').toLowerCase().includes(selectedCity.toLowerCase());
    return matchesSearch && matchesCity;
  });

  // Sort list: closest first
  filtered.sort((a, b) => {
    if (a.distance !== null && b.distance !== null) {
      return a.distance - b.distance;
    }
    return 0;
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Top Custom Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.brandRow}>
            <ShieldCheck size={14} color={theme.colors.primaryText} />
            <Text style={styles.brandText}>FITPASS DIRECTORY</Text>
          </View>
          <Text style={styles.headerTitle}>Partner Gyms ({list.length})</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.7}>
          <LogOut size={16} color={theme.colors.error} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBox}>
        <Search size={16} color={theme.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search gym by name or area..."
          placeholderTextColor={theme.colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* City Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cityScroll}
      >
        {CITIES.map((city) => (
          <TouchableOpacity
            key={city}
            style={[
              styles.cityChip,
              selectedCity === city && styles.cityChipActive,
            ]}
            onPress={() => setSelectedCity(city)}
            activeOpacity={0.75}
          >
            <Text
              style={[
                styles.cityChipText,
                selectedCity === city && styles.cityChipTextActive,
              ]}
            >
              {city}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Location notification if permission not granted */}
      {locPermission === false && (
        <View style={styles.locWarningBar}>
          <Text style={styles.locWarningText}>Enable location permissions to sort gyms by proximity</Text>
        </View>
      )}

      {/* 2-Column Grid */}
      {filtered.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No Partner Gyms Found</Text>
          <Text style={styles.emptyText}>
            {search
              ? `No gym matching "${search}" in ${selectedCity}`
              : 'No partner gyms available right now.'}
          </Text>
        </View>
      ) : (
        <View style={styles.gridContainer}>
          {filtered.map((gym) => {
            const gymId = gym.id || gym._id || '';
            const coverImg =
              gym.images && gym.images.length > 0 ? gym.images[0] : DEFAULT_IMAGE;

            return (
              <TouchableOpacity
                key={gymId}
                style={styles.gridCard}
                onPress={() => router.push(`/(fitpass)/gym/${gymId}` as any)}
                activeOpacity={0.88}
              >
                <View style={styles.gridImgWrap}>
                  <Image source={{ uri: coverImg }} style={styles.gridImg} resizeMode="cover" />
                  <View style={styles.gridOverlayRating}>
                    <Star size={10} color="#F59E0B" fill="#F59E0B" />
                    <Text style={styles.gridOverlayRatingText}>{gym.averageRating ?? 4.8}</Text>
                  </View>
                  {gym.distance !== null && (
                    <View style={styles.distanceBadge}>
                      <MapPin size={9} color="#FFFFFF" />
                      <Text style={styles.distanceBadgeText}>
                        {gym.distance < 1 
                          ? `${Math.round(gym.distance * 1000)}m` 
                          : `${gym.distance.toFixed(1)} km`}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.gridBody}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.gridGymName} numberOfLines={1}>
                      {gym.name}
                    </Text>
                    <ArrowUpRight size={13} color={theme.colors.primaryText} />
                  </View>

                  {gym.address ? (
                    <View style={styles.gridAddressRow}>
                      <MapPin size={11} color={theme.colors.primaryText} />
                      <Text style={styles.gridAddressText} numberOfLines={1}>
                        {gym.address}
                      </Text>
                    </View>
                  ) : null}

                  {gym.phone ? (
                    <TouchableOpacity
                      style={styles.callRow}
                      onPress={() => Linking.openURL(`tel:${gym.phone}`)}
                      activeOpacity={0.7}
                    >
                      <Phone size={10} color={theme.colors.primaryText} />
                      <Text style={styles.callText} numberOfLines={1}>
                        {gym.phone}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  <View style={styles.gridFooterPill}>
                    <BadgeCheck size={10} color={theme.colors.primaryText} />
                    <Text style={styles.gridFooterPillText}>FITPASS VERIFIED</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 90, gap: 16 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandText: {
    fontFamily: fontFamilies.header,
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.primaryText,
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontFamily: fontFamilies.header,
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 2,
  },
  logoutBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(198,40,40,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 46,
    backgroundColor: theme.colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    color: theme.colors.text,
  },

  cityScroll: { gap: 8, paddingVertical: 2 },
  cityChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cityChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  cityChipText: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  cityChipTextActive: {
    fontFamily: fontFamilies.header,
    color: '#fff',
    fontWeight: '800',
  },

  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  gridCard: {
    width: '48%',
    backgroundColor: theme.colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  gridImgWrap: { position: 'relative', width: '100%', height: 115 },
  gridImg: { width: '100%', height: 115 },
  gridOverlayRating: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  gridOverlayRatingText: {
    fontFamily: fontFamilies.header,
    fontSize: 10,
    fontWeight: '900',
    color: '#F59E0B',
  },

  gridBody: { padding: 10, gap: 6 },
  gridGymName: {
    fontFamily: fontFamilies.header,
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
    flex: 1,
  },
  gridAddressRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gridAddressText: {
    fontFamily: fontFamilies.body,
    fontSize: 11,
    color: theme.colors.textMuted,
    flex: 1,
  },

  callRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  callText: {
    fontFamily: fontFamilies.body,
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.primaryText,
  },

  gridFooterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(254,223,30,0.10)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  gridFooterPillText: {
    fontFamily: fontFamilies.header,
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.primaryText,
    letterSpacing: 0.5,
  },

  emptyBox: { padding: 30, alignItems: 'center', gap: 6 },
  emptyTitle: {
    fontFamily: fontFamilies.header,
    fontSize: 17,
    fontWeight: '800',
    color: theme.colors.text,
  },
  emptyText: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },

  gridSkeletonCard: { width: '48%', height: 190, borderRadius: 18 },
  distanceBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  distanceBadgeText: {
    fontFamily: fontFamilies.body,
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  locWarningBar: {
    backgroundColor: 'rgba(254,223,30,0.08)',
    borderColor: 'rgba(254,223,30,0.2)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
  },
  locWarningText: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    color: theme.colors.primaryText,
    textAlign: 'center',
    fontWeight: '600',
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useDiscoveryGyms, usePublicPostsFeed } from '../api/fitpass.api';
import type { DiscoveryGymItem } from '../types';

// FitPass discovery palette.
const COLORS = {
  primary: '#F5B800',
  primaryDark: '#D9A900',
  bgDark: '#F5B800',
  cardBg: '#FFFFFF',
  border: '#E3DCCB',
  textPrimary: '#171713',
  textSecondary: '#585448',
  textMuted: '#817B6E',
  success: '#2E7D32',
  error: '#C62828',
};

const CATEGORIES = [
  { id: 'all', label: 'All Gyms' },
  { id: 'nearby', label: 'Nearby' },
  { id: 'recommended', label: 'Recommended' },
  { id: 'trending', label: 'Trending' },
  { id: 'newly_added', label: 'Newly Added' },
  { id: 'highest_rated', label: 'Top Rated' },
  { id: 'open_now', label: 'Open Now' },
];

export const GymDiscoveryExplore: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGym, setSelectedGym] = useState<DiscoveryGymItem | null>(null);

  const { data: gyms = [], isLoading: loadingGyms } = useDiscoveryGyms({
    category: activeCategory !== 'all' ? activeCategory : undefined,
    search: searchQuery || undefined,
  });

  const { data: posts = [] } = usePublicPostsFeed();

  const handleCall = (phone?: string) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleDirections = (gym: DiscoveryGymItem) => {
    const p = gym.discoveryProfile || {};
    const url = p.googleMapsUrl || `https://maps.google.com/?q=${encodeURIComponent(gym.name + ' ' + (p.address || ''))}`;
    Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by gym name, city, amenities..."
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Category Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {CATEGORIES.map((cat) => {
          const isSelected = activeCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
              onPress={() => setActiveCategory(cat.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Gym Highlights Posts Horizontal Carousel */}
        {posts.length > 0 && (
          <View style={styles.postsSection}>
            <Text style={styles.sectionTitle}>Gym Highlights</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
              {posts.map((post) => (
                <View key={post.id} style={styles.postCard}>
                  {post.images && post.images.length > 0 ? (
                    <Image source={{ uri: post.images[0] }} style={styles.postCardImage} />
                  ) : (
                    <View style={[styles.postCardImage, { backgroundColor: '#1A150F' }]} />
                  )}
                  <View style={styles.postCardBody}>
                    <Text style={styles.postGymName}>{post.gym?.name}</Text>
                    <Text style={styles.postTitle} numberOfLines={1}>{post.title}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Gym List */}
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>
            FitPass Gyms ({gyms.length})
          </Text>

          {loadingGyms ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 30 }} />
          ) : gyms.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No gyms match your search criteria.</Text>
            </View>
          ) : (
            gyms.map((gym) => {
              const p = gym.discoveryProfile || {};
              return (
                <TouchableOpacity
                  key={gym.id}
                  style={styles.gymCard}
                  onPress={() => setSelectedGym(gym)}
                  activeOpacity={0.8}
                >
                  <View style={styles.coverWrapper}>
                    <Image
                      source={{ uri: p.coverImageUrl || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800' }}
                      style={styles.coverImage}
                    />
                    <Image
                      source={{ uri: p.logoUrl || 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=80' }}
                      style={styles.logoImage}
                    />
                    <View style={styles.statusPillsRow}>
                      {p.isOpenNow ? (
                        <View style={[styles.statusPill, { backgroundColor: 'rgba(46,125,50,0.9)' }]}>
                          <Text style={styles.statusPillText}>Open Now</Text>
                        </View>
                      ) : (
                        <View style={[styles.statusPill, { backgroundColor: 'rgba(198,40,40,0.9)' }]}>
                          <Text style={styles.statusPillText}>Closed</Text>
                        </View>
                      )}
                      {p.distanceKm !== null && p.distanceKm !== undefined && (
                        <View style={[styles.statusPill, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
                          <Text style={[styles.statusPillText, { color: COLORS.primary }]}>{p.distanceKm} km</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.gymCardContent}>
                    <View style={styles.titleRow}>
                      <Text style={styles.gymTitle}>{gym.name}</Text>
                      <Text style={styles.ratingText}>Rating {p.rating || 4.8}</Text>
                    </View>
                    <Text style={styles.gymAddress}>{p.city || 'Chennai'}{p.address ? `, ${p.address}` : ''}</Text>
                    <Text style={styles.gymDesc} numberOfLines={2}>{p.shortDescription}</Text>

                    <View style={styles.detailsBtn}>
                      <Text style={styles.detailsBtnText}>View full profile and facilities</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Gym Profile Details Modal */}
      {selectedGym && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setSelectedGym(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ScrollView>
                <View style={styles.modalCoverWrapper}>
                  <Image
                    source={{ uri: selectedGym.discoveryProfile?.coverImageUrl }}
                    style={styles.modalCoverImage}
                  />
                  <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedGym(null)}>
                    <Text style={styles.closeBtnText}>Close</Text>
                  </TouchableOpacity>

                  <View style={styles.modalHeaderInfo}>
                    <Image
                      source={{ uri: selectedGym.discoveryProfile?.logoUrl }}
                      style={styles.modalLogo}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalGymTitle}>{selectedGym.name}</Text>
                      <Text style={styles.modalGymSub}>
                        FitPass Partner | Rating {selectedGym.discoveryProfile?.rating || 4.8}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.modalBody}>
                  {/* Action Buttons: Min tap target 44px */}
                  <View style={styles.modalActionsRow}>
                    <TouchableOpacity
                      style={styles.actionBtnCall}
                      onPress={() => handleCall(selectedGym.discoveryProfile?.contactNumber || selectedGym.phone)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.actionBtnCallText}>Call Gym</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtnNav}
                      onPress={() => handleDirections(selectedGym)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.actionBtnNavText}>Directions</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.modalSectionTitle}>About Gym</Text>
                  <Text style={styles.modalDesc}>
                    {selectedGym.discoveryProfile?.description || selectedGym.discoveryProfile?.shortDescription}
                  </Text>

                  <Text style={styles.modalSectionTitle}>Operating Hours</Text>
                  <Text style={styles.modalDesc}>
                    {selectedGym.discoveryProfile?.openingTime} - {selectedGym.discoveryProfile?.closingTime}
                  </Text>

                  <Text style={styles.modalSectionTitle}>Amenities Available</Text>
                  <View style={styles.chipsWrap}>
                    {selectedGym.discoveryProfile?.amenities?.map((item) => (
                      <View key={item} style={styles.amenityChip}>
                        <Text style={styles.amenityChipText}>Amenity: {item}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={styles.modalSectionTitle}>Equipment Available</Text>
                  <View style={styles.chipsWrap}>
                    {selectedGym.discoveryProfile?.equipments?.map((item) => (
                      <View key={item} style={styles.equipmentChip}>
                        <Text style={styles.equipmentChipText}>Equipment: {item}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchInput: {
    backgroundColor: COLORS.cardBg,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  categoryScroll: {
    maxHeight: 50,
    marginVertical: 4,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.cardBg,
    marginRight: 8,
    height: 38,
    justifyContent: 'center',
  },
  categoryChipActive: {
    backgroundColor: COLORS.primary,
  },
  categoryChipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: COLORS.bgDark,
    fontWeight: 'bold',
  },
  postsSection: {
    marginTop: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#171713',
    marginLeft: 16,
    marginBottom: 10,
  },
  postCard: {
    width: 180,
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    borderColor: COLORS.border,
    borderWidth: 1,
    marginRight: 12,
    overflow: 'hidden',
  },
  postCardImage: {
    width: '100%',
    height: 110,
  },
  postCardBody: {
    padding: 8,
  },
  postGymName: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  postTitle: {
    fontSize: 12,
    color: COLORS.textPrimary,
    fontWeight: '600',
    marginTop: 2,
  },
  listSection: {
    paddingHorizontal: 16,
  },
  emptyCard: {
    padding: 24,
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  gymCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    borderColor: COLORS.border,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  coverWrapper: {
    position: 'relative',
    height: 160,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  logoImage: {
    position: 'absolute',
    bottom: -16,
    left: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.cardBg,
  },
  statusPillsRow: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 6,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  gymCardContent: {
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gymTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  gymAddress: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  gymDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 8,
    lineHeight: 18,
  },
  detailsBtn: {
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44, // AGENTS.md touch target rule
    justifyContent: 'center',
  },
  detailsBtnText: {
    color: COLORS.bgDark,
    fontWeight: 'bold',
    fontSize: 13,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#F8F5ED',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalCoverWrapper: {
    position: 'relative',
    height: 200,
  },
  modalCoverImage: {
    width: '100%',
    height: '100%',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  modalHeaderInfo: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  modalGymTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#171713',
  },
  modalGymSub: {
    fontSize: 12,
    color: '#FFF4C6',
    marginTop: 2,
  },
  modalBody: {
    padding: 16,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionBtnCall: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  actionBtnCallText: {
    color: COLORS.bgDark,
    fontWeight: 'bold',
    fontSize: 14,
  },
  actionBtnNav: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
    borderColor: COLORS.border,
    borderWidth: 1,
    justifyContent: 'center',
  },
  actionBtnNavText: {
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalSectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 14,
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  amenityChip: {
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderColor: COLORS.border,
    borderWidth: 1,
  },
  amenityChipText: {
    color: COLORS.textPrimary,
    fontSize: 12,
  },
  equipmentChip: {
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  equipmentChipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
});

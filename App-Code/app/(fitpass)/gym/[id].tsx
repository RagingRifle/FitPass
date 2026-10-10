import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Linking,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  MapPin,
  Phone,
  Clock,
  Star,
  ShieldCheck,
  ChevronLeft,
  Users,
  MessageSquarePlus,
  Edit2,
  X,
  CheckCircle,
  BadgeCheck,
  QrCode,
  Share2,
} from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';
import { fontFamilies } from '@/design-system/tokens';
import { Skeleton } from '@/components/ui';
import {
  usePartnerGymDetail,
  useGymReviews,
  useAddGymReview,
} from '@/features/fitpass/api/fitpass.api';
import { useToast } from '@/hooks/useToast';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&auto=format&fit=crop&q=80',
];

const AMENITIES = [
  { label: 'Air Conditioned', icon: '❄️' },
  { label: 'Lockers & Showers', icon: '🚿' },
  { label: 'Free Parking', icon: '🅿️' },
  { label: 'Cardio & Strength', icon: '🏋️' },
  { label: 'Personal Trainers', icon: '🧑‍🏫' },
  { label: 'Free Wi-Fi', icon: '📶' },
];

export default function GymDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();

  const { data: gym, isLoading: isGymLoading, error } = usePartnerGymDetail(id);
  const { data: reviewData, isLoading: isReviewsLoading } = useGymReviews(id);
  const addReviewMutation = useAddGymReview();

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);
  const [commentText, setCommentText] = useState('');
  const [selectedStarFilter, setSelectedStarFilter] = useState<'ALL' | 5 | 4 | 3 | 2 | 1>('ALL');

  if (isGymLoading) {
    return (
      <View style={styles.loadingRoot}>
        <Skeleton style={{ width: SCREEN_WIDTH, height: 280 }} />
        <View style={{ padding: 20, gap: 16 }}>
          <Skeleton style={{ height: 32, width: '75%', borderRadius: 8 }} />
          <Skeleton style={{ height: 100, borderRadius: 16 }} />
          <Skeleton style={{ height: 130, borderRadius: 16 }} />
        </View>
      </View>
    );
  }

  if (error || !gym) {
    return (
      <View style={styles.loadingRoot}>
        <Text style={styles.errorText}>Could not load gym details.</Text>
        <TouchableOpacity style={styles.backBtnSimple} onPress={() => router.back()}>
          <Text style={styles.backBtnSimpleText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const images = gym.images && gym.images.length > 0 ? gym.images.slice(0, 4) : FALLBACK_IMAGES;
  const reviews: any[] = reviewData?.reviews ?? [];
  const myReview = reviewData?.myReview;
  const averageRating = reviewData?.averageRating ?? gym.averageRating ?? 4.8;
  const totalReviews = reviewData?.totalReviews ?? reviews.length ?? 0;

  // Rating breakdown counts for filter pills
  const count5 = reviews.filter((r) => r.rating === 5).length;
  const count4 = reviews.filter((r) => r.rating === 4).length;
  const count3 = reviews.filter((r) => r.rating === 3).length;
  const count2 = reviews.filter((r) => r.rating === 2).length;
  const count1 = reviews.filter((r) => r.rating === 1).length;

  const filteredReviews =
    selectedStarFilter === 'ALL'
      ? reviews
      : reviews.filter((r) => r.rating === selectedStarFilter);

  const handleOpenReviewModal = () => {
    if (myReview) {
      setSelectedRating(myReview.rating || 5);
      setCommentText(myReview.comment || '');
    } else {
      setSelectedRating(5);
      setCommentText('');
    }
    setIsReviewModalOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!commentText.trim()) {
      toast.show('Please enter a brief comment describing your workout experience.', 'warning');
      return;
    }
    try {
      const res = await addReviewMutation.mutateAsync({
        gymId: id || '',
        rating: selectedRating,
        comment: commentText.trim(),
      });
      setIsReviewModalOpen(false);
      toast.show(res?.message || (myReview ? 'Your review has been updated!' : 'Thank you! Your review has been published.'), 'success');
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        'Review locked: You must purchase a FitPass plan and check in at this gym at least once before rating.';
      toast.show(msg, 'error');
    }
  };

  const handleShare = () => {
    Alert.alert('Share Partner Gym', `Check out ${gym.name} on FitPass!`);
  };

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Cover Gallery Carousel */}
        <View style={styles.galleryWrap}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const slide = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              if (slide !== activeImageIdx) setActiveImageIdx(slide);
            }}
            scrollEventThrottle={16}
          >
            {images.map((imgUrl, idx) => (
              <Image key={idx} source={{ uri: imgUrl }} style={styles.galleryImg} resizeMode="cover" />
            ))}
          </ScrollView>

          {/* Glass Top Overlay Nav */}
          <View style={styles.topNavRow}>
            <TouchableOpacity style={styles.navCircle} onPress={() => router.back()} activeOpacity={0.8}>
              <ChevronLeft size={20} color="#fff" />
            </TouchableOpacity>
            
            <View style={styles.rightNavRow}>
              <TouchableOpacity style={styles.navCircle} onPress={handleShare} activeOpacity={0.8}>
                <Share2 size={18} color="#fff" />
              </TouchableOpacity>

              <View style={styles.fitpassBadge}>
                <BadgeCheck size={13} color="#FF5F1F" />
                <Text style={styles.fitpassBadgeText}>FITPASS VERIFIED</Text>
              </View>
            </View>
          </View>

          {/* Glowing Carousel Dot Indicators */}
          <View style={styles.paginationRow}>
            {images.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  activeImageIdx === idx && styles.dotActive,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Content Body Below Image */}
        <View style={styles.detailsContainer}>
          {/* Gym Title & Rating */}
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.gymName}>{gym.name}</Text>
              {gym.parentGymName ? (
                <Text style={styles.parentBranchText}>Branch of {gym.parentGymName}</Text>
              ) : null}
            </View>

            <View style={styles.ratingBox}>
              <Star size={14} color="#F59E0B" fill="#F59E0B" />
              <Text style={styles.ratingText}>{averageRating}</Text>
              <Text style={styles.ratingCount}>({totalReviews})</Text>
            </View>
          </View>

          {/* Quick Info Meta Card */}
          <View style={styles.metaBox}>
            {gym.address ? (
              <View style={styles.metaRow}>
                <MapPin size={16} color="#FF5F1F" />
                <Text style={styles.metaText}>{gym.address}</Text>
              </View>
            ) : null}

            {gym.phone ? (
              <TouchableOpacity
                style={styles.metaRow}
                onPress={() => Linking.openURL(`tel:${gym.phone}`)}
                activeOpacity={0.7}
              >
                <Phone size={16} color="#FF5F1F" />
                <Text style={[styles.metaText, styles.linkText]}>Call Gym: {gym.phone}</Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.metaRow}>
              <Clock size={16} color="#FF5F1F" />
              <Text style={styles.metaText}>
                Open Daily • 06:00 AM - 10:00 PM ({gym.defaultSessionDurationMinutes ?? 120} min limit)
              </Text>
            </View>

            <View style={styles.metaRow}>
              <Users size={16} color="#FF5F1F" />
              <Text style={styles.metaText}>
                Live Occupancy:{' '}
                <Text style={{ fontWeight: '800', color: theme.colors.text }}>
                  {gym.activeSessions ?? 0} members training
                </Text>
              </Text>
            </View>
          </View>

          {/* Amenities Grid */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Included Amenities</Text>
            <View style={styles.amenitiesGrid}>
              {AMENITIES.map((item, idx) => (
                <View key={idx} style={styles.amenityChip}>
                  <Text style={styles.amenityIcon}>{item.icon}</Text>
                  <Text style={styles.amenityLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* FitPass Security Policy */}
          <View style={styles.policyCard}>
            <ShieldCheck size={20} color="#FF5F1F" />
            <View style={{ flex: 1 }}>
              <Text style={styles.policyTitle}>Verified FitPass Entry</Text>
              <Text style={styles.policyText}>
                Scan the QR code displayed at this gym counter to instantly check in and deduct 1 session credit.
              </Text>
            </View>
          </View>

          {/* Premium Verified Customer Reviews Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.sectionTitle}>Verified Member Reviews</Text>
                <Text style={styles.sectionSub}>Gated rating system — verified check-in required</Text>
              </View>

              <TouchableOpacity
                style={[styles.writeReviewBtn, myReview && { backgroundColor: '#2563EB' }]}
                onPress={handleOpenReviewModal}
                activeOpacity={0.8}
              >
                {myReview ? <Edit2 size={13} color="#fff" /> : <MessageSquarePlus size={13} color="#fff" />}
                <Text style={styles.writeReviewBtnText}>
                  {myReview ? 'Edit Review' : 'Write Review'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Rating Breakdown Header Card */}
            <View style={styles.reviewSummaryCard}>
              <View style={styles.ratingBigCol}>
                <Text style={styles.ratingBigNum}>{averageRating}</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={14}
                      color={star <= Math.round(averageRating) ? '#F59E0B' : theme.colors.border}
                      fill={star <= Math.round(averageRating) ? '#F59E0B' : 'transparent'}
                    />
                  ))}
                </View>
                <Text style={styles.ratingBigCount}>{totalReviews} verified reviews</Text>
              </View>

              <View style={styles.ratingBarsCol}>
                <Text style={styles.filterTitle}>Filter Reviews by Rating:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  <TouchableOpacity
                    style={[
                      styles.filterPill,
                      selectedStarFilter === 'ALL' && styles.filterPillActive,
                    ]}
                    onPress={() => setSelectedStarFilter('ALL')}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        selectedStarFilter === 'ALL' && styles.filterPillTextActive,
                      ]}
                    >
                      All ({reviews.length})
                    </Text>
                  </TouchableOpacity>

                  {([5, 4, 3, 2, 1] as const).map((star) => {
                    const count =
                      star === 5
                        ? count5
                        : star === 4
                        ? count4
                        : star === 3
                        ? count3
                        : star === 2
                        ? count2
                        : count1;

                    return (
                      <TouchableOpacity
                        key={star}
                        style={[
                          styles.filterPill,
                          selectedStarFilter === star && styles.filterPillActive,
                        ]}
                        onPress={() => setSelectedStarFilter(star)}
                        activeOpacity={0.8}
                      >
                        <Star
                          size={10}
                          color={selectedStarFilter === star ? '#fff' : '#F59E0B'}
                          fill={selectedStarFilter === star ? '#fff' : '#F59E0B'}
                        />
                        <Text
                          style={[
                            styles.filterPillText,
                            selectedStarFilter === star && styles.filterPillTextActive,
                          ]}
                        >
                          {star} ★ ({count})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {/* Filtered Reviews List */}
            {isReviewsLoading ? (
              <Skeleton style={{ height: 90, borderRadius: 14 }} />
            ) : filteredReviews.length === 0 ? (
              <View style={styles.emptyReviewBox}>
                <Text style={styles.emptyReviewTitle}>
                  {selectedStarFilter === 'ALL'
                    ? 'No Reviews Yet'
                    : `No ${selectedStarFilter}★ Reviews Found`}
                </Text>
                <Text style={styles.emptyReviewText}>
                  {selectedStarFilter === 'ALL'
                    ? 'Be the first verified member to rate your workout experience here!'
                    : `There are currently no ${selectedStarFilter}-star reviews for this gym.`}
                </Text>
              </View>
            ) : (
              filteredReviews.map((rev) => (
                <View key={rev.id || rev._id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewUserRow}>
                      <View style={styles.reviewAvatar}>
                        <Text style={styles.reviewAvatarText}>
                          {(rev.memberName?.[0] ?? 'M').toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={styles.reviewUserName}>{rev.memberName || 'Verified Member'}</Text>
                        <View style={styles.verifiedTag}>
                          <CheckCircle size={10} color="#4CAF50" />
                          <Text style={styles.verifiedTagText}>Verified Check-In</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={12}
                          color={star <= rev.rating ? '#F59E0B' : theme.colors.border}
                          fill={star <= rev.rating ? '#F59E0B' : 'transparent'}
                        />
                      ))}
                    </View>
                  </View>

                  {rev.comment ? (
                    <Text style={styles.reviewComment}>{rev.comment}</Text>
                  ) : null}

                  <Text style={styles.reviewDate}>
                    {rev.createdAt
                      ? new Date(rev.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Verified Review'}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Action Bar */}
      <View style={styles.stickyBar}>
        <View style={styles.stickyPriceInfo}>
          <Text style={styles.stickyLabel}>CHECK-IN ACCESS</Text>
          <Text style={styles.stickyValue}>1 Session Credit</Text>
        </View>
        <TouchableOpacity
          style={styles.checkInBtn}
          onPress={() => router.push('/(fitpass)/scan')}
          activeOpacity={0.85}
        >
          <QrCode size={16} color="#fff" />
          <Text style={styles.checkInBtnText}>Check In Now</Text>
        </TouchableOpacity>
      </View>

      {/* Write Verified Review Modal */}
      <Modal
        visible={isReviewModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsReviewModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.reviewModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{myReview ? 'Edit Your Review' : 'Rate Your Experience'}</Text>
              <TouchableOpacity onPress={() => setIsReviewModalOpen(false)}>
                <X size={22} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              {myReview
                ? 'You are updating your previously submitted review for this gym.'
                : 'Reviews are verified and locked to members who have purchased a plan and checked in at this gym.'}
            </Text>

            {/* Star Selector */}
            <View style={styles.starSelectRow}>
              {[1, 2, 3, 4, 5].map((num) => (
                <TouchableOpacity
                  key={num}
                  onPress={() => setSelectedRating(num)}
                  activeOpacity={0.7}
                >
                  <Star
                    size={32}
                    color={num <= selectedRating ? '#F59E0B' : theme.colors.border}
                    fill={num <= selectedRating ? '#F59E0B' : 'transparent'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.commentInput}
              placeholder="Share details about equipment quality, cleanliness, staff..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              numberOfLines={4}
              value={commentText}
              onChangeText={setCommentText}
            />

            <TouchableOpacity
              style={[
                styles.submitReviewBtn,
                addReviewMutation.isPending && { opacity: 0.7 },
              ]}
              onPress={handleSubmitReview}
              disabled={addReviewMutation.isPending}
              activeOpacity={0.85}
            >
              {addReviewMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitReviewBtnText}>
                  {myReview ? 'Update Your Review' : 'Submit Verified Review'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loadingRoot: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: { fontFamily: fontFamilies.body, fontSize: 15, color: theme.colors.error, fontWeight: '700' },
  backBtnSimple: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: theme.colors.card, borderRadius: 10 },
  backBtnSimpleText: { fontFamily: fontFamilies.body, fontSize: 13, color: theme.colors.text, fontWeight: '600' },

  scrollContent: { paddingBottom: 110 },

  // Gallery Header Carousel
  galleryWrap: { position: 'relative', width: SCREEN_WIDTH, height: 290, backgroundColor: '#14100B' },
  galleryImg: { width: SCREEN_WIDTH, height: 290 },
  topNavRow: {
    position: 'absolute',
    top: 44,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rightNavRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(20, 16, 11, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  fitpassBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(35, 29, 20, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 95, 31, 0.4)',
  },
  fitpassBadgeText: {
    fontFamily: fontFamilies.header,
    fontSize: 11,
    fontWeight: '800',
    color: '#FF5F1F',
    letterSpacing: 0.5,
  },

  paginationRow: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#FF5F1F',
  },

  // Details Container Below Image
  detailsContainer: { padding: 20, gap: 20 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  gymName: {
    fontFamily: fontFamilies.header,
    fontSize: 26,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: 0.2,
  },
  parentBranchText: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    color: '#FF5F1F',
    fontWeight: '700',
    marginTop: 2,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  ratingText: {
    fontFamily: fontFamilies.header,
    fontSize: 14,
    fontWeight: '900',
    color: '#F59E0B',
  },
  ratingCount: {
    fontFamily: fontFamilies.body,
    fontSize: 11,
    color: theme.colors.textMuted,
  },

  metaBox: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 12,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaText: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    color: theme.colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  linkText: { color: '#FF5F1F', fontWeight: '700' },

  section: { gap: 12 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: {
    fontFamily: fontFamilies.header,
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.text,
  },
  sectionSub: {
    fontFamily: fontFamilies.body,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  writeReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF5F1F',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  writeReviewBtnText: {
    fontFamily: fontFamilies.header,
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },

  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  amenityIcon: { fontSize: 14 },
  amenityLabel: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text,
  },

  policyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 95, 31, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 95, 31, 0.25)',
    borderRadius: 14,
    padding: 16,
  },
  policyTitle: {
    fontFamily: fontFamilies.header,
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.text,
  },
  policyText: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
    lineHeight: 17,
  },

  // Review Summary & Filter Card
  reviewSummaryCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 14,
  },
  ratingBigCol: { alignItems: 'center', gap: 4 },
  ratingBigNum: {
    fontFamily: fontFamilies.header,
    fontSize: 36,
    fontWeight: '900',
    color: theme.colors.text,
  },
  ratingBigCount: {
    fontFamily: fontFamilies.body,
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },

  ratingBarsCol: { gap: 8 },
  filterTitle: {
    fontFamily: fontFamilies.body,
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterPillActive: {
    backgroundColor: '#FF5F1F',
    borderColor: '#FF5F1F',
  },
  filterPillText: {
    fontFamily: fontFamilies.header,
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  filterPillTextActive: {
    color: '#fff',
    fontWeight: '800',
  },

  // Reviews
  emptyReviewBox: {
    padding: 24,
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    gap: 6,
  },
  emptyReviewTitle: {
    fontFamily: fontFamilies.header,
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  emptyReviewText: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
  reviewCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 10,
    marginBottom: 8,
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewUserRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 95, 31, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 95, 31, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewAvatarText: {
    fontFamily: fontFamilies.header,
    fontSize: 15,
    fontWeight: '800',
    color: '#FF5F1F',
  },
  reviewUserName: {
    fontFamily: fontFamilies.header,
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.text,
  },
  verifiedTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  verifiedTagText: {
    fontFamily: fontFamilies.body,
    fontSize: 10,
    fontWeight: '700',
    color: '#4CAF50',
  },
  starsRow: { flexDirection: 'row', gap: 2 },
  reviewComment: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 18,
  },
  reviewDate: {
    fontFamily: fontFamilies.body,
    fontSize: 10,
    color: theme.colors.textMuted,
  },

  // Sticky Bar
  stickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stickyPriceInfo: { gap: 2 },
  stickyLabel: {
    fontFamily: fontFamilies.header,
    fontSize: 10,
    fontWeight: '800',
    color: '#FF5F1F',
    letterSpacing: 0.5,
  },
  stickyValue: {
    fontFamily: fontFamilies.header,
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  checkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF5F1F',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  checkInBtnText: {
    fontFamily: fontFamilies.header,
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  reviewModalCard: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: {
    fontFamily: fontFamilies.header,
    fontSize: 20,
    fontWeight: '900',
    color: theme.colors.text,
  },
  modalSub: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 17,
  },
  starSelectRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 8 },
  commentInput: {
    backgroundColor: theme.colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    color: theme.colors.text,
    textAlignVertical: 'top',
    height: 100,
  },
  submitReviewBtn: {
    backgroundColor: '#FF5F1F',
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitReviewBtnText: {
    fontFamily: fontFamilies.header,
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
});

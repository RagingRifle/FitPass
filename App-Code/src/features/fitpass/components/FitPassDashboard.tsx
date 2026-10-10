import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  QrCode,
  Clock,
  Building2,
  MapPin,
  Search,
  ChevronRight,
  Star,
  LogOut,
  ArrowUpRight,
  ShieldCheck,
  Activity,
  Flame,
  BadgeCheck,
} from '@/components/ui/app-icons';
import { Skeleton } from '@/components/ui';
import { theme } from '@/design-system/theme';
import { fontFamilies } from '@/design-system/tokens';
import { useSessionStatus, usePartnerGyms } from '../api/fitpass.api';
import { useAuth } from '@/features/auth';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';
import { LinearGradient } from 'expo-linear-gradient';

const DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80';

// ─── Custom Top Header Bar ───────────────────────────────────────────────────
function Header({ onScanQR }: { onScanQR: () => void }) {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <View style={styles.avatarWrap}>
          <ProfileAvatar size={48} nameFallback="F" />
          <View style={styles.onlineDot} />
        </View>
        <View>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.userName}>{user?.name?.split(' ')[0] ?? 'Member'}</Text>
        </View>
      </View>
      <View style={styles.headerRightRow}>
        <TouchableOpacity style={styles.scanBtn} onPress={onScanQR} activeOpacity={0.85}>
          <QrCode size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.7}>
          <LogOut size={16} color={theme.colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Active Plan Card ────────────────────────────────────────────────────────
function PassCard() {
  const { data, isLoading } = useSessionStatus();
  const router = useRouter();

  if (isLoading) return <Skeleton style={styles.skeletonPassCard} />;

  const isLive = data?.currentSessionEndsAt
    ? new Date(data.currentSessionEndsAt) > new Date()
    : false;
  const inCooldown =
    !isLive && data?.cooldownEndsAt
      ? new Date(data.cooldownEndsAt) > new Date()
      : false;
  const sessionsLeft = data?.sessionsRemaining ?? 0;
  const sessionsTotal = data?.sessionsTotal ?? 0;
  const progress = sessionsTotal > 0 ? sessionsLeft / sessionsTotal : 0;
  const hasPlan = Boolean(data?.planName && data?.planStatus === 'Active');

  return (
    <View style={styles.passCard}>
      <LinearGradient
        colors={['#E8EEFC', '#FFFFFF', '#F1F4FB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.passCardTop}>
        <View>
          <View style={styles.passBadgeRow}>
            <ShieldCheck size={13} color={theme.colors.primary} />
            <Text style={styles.passLabel}>FITPASS NETWORK</Text>
          </View>
          <Text style={styles.passName}>{data?.planName ?? 'No Active Plan'}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.statusPill,
            {
              backgroundColor: hasPlan
                ? 'rgba(46,125,50,0.14)'
                : 'rgba(240,160,32,0.14)',
              borderColor: hasPlan ? 'rgba(76,175,80,0.3)' : 'rgba(240,160,32,0.3)',
            },
          ]}
          onPress={() => router.push('/(fitpass)/plans')}
          activeOpacity={0.8}
        >
          <BadgeCheck size={14} color={hasPlan ? theme.colors.success : theme.colors.primary} />
          <Text
            style={[
              styles.statusText,
              { color: hasPlan ? '#4CAF50' : theme.colors.primary },
            ]}
          >
            {hasPlan ? 'Active Pass' : 'Get Pass'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Meter */}
      <View style={styles.sessionsRow}>
        <View style={styles.sessionCircle}>
          <Text style={styles.sessionsNum}>{sessionsLeft}</Text>
          <Text style={styles.sessionsUnit}>LEFT</Text>
        </View>

        <View style={styles.sessionsMeter}>
          <View style={styles.meterBg}>
            <View
              style={[
                styles.meterFill,
                { width: `${Math.min(100, progress * 100)}%` as any },
              ]}
            />
          </View>
          <Text style={styles.meterLabel}>
            {sessionsLeft} of {sessionsTotal} session credits remaining
          </Text>
          {data?.expiryDate && (
            <Text style={styles.expiryText}>
              Valid through{' '}
              {new Date(data.expiryDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          )}
        </View>
      </View>

      {/* Banners */}
      {isLive && (
        <View style={styles.liveBanner}>
          <Activity size={15} color="#4CAF50" />
          <Text style={styles.liveBannerText}>
            Workout Session Active — Ends at{' '}
            {new Date(data!.currentSessionEndsAt!).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      )}

      {inCooldown && (
        <View style={styles.cooldownBanner}>
          <Clock size={15} color="#4FC3F7" />
          <Text style={styles.cooldownText}>
            Cooldown active until{' '}
            {new Date(data!.cooldownEndsAt!).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Featured Gyms Horizontal Carousel ──────────────────────────────────────
function PopularFitPassGyms() {
  const { data: gyms, isLoading } = usePartnerGyms();
  const router = useRouter();

  const list = Array.isArray(gyms) ? gyms : [];

  return (
    <View style={styles.section}>
      <View style={styles.sectionRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Flame size={16} color={theme.colors.primary} />
          <Text style={styles.sectionTitle}>Featured Gyms</Text>
        </View>
        <TouchableOpacity
          style={styles.viewAllBtn}
          onPress={() => router.push('/(fitpass)/gyms')}
          activeOpacity={0.7}
        >
          <Text style={styles.viewAllText}>View all</Text>
          <ChevronRight size={14} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} style={styles.popularSkeletonCard} />
          ))}
        </ScrollView>
      ) : list.length === 0 ? null : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 14 }}
        >
          {list.slice(0, 5).map((gym) => {
            const gymId = gym.id || gym._id || '';
            const coverImg =
              gym.images && gym.images.length > 0 ? gym.images[0] : DEFAULT_IMAGE;

            return (
              <TouchableOpacity
                key={gymId}
                style={styles.popularCard}
                onPress={() => router.push(`/(fitpass)/gym/${gymId}` as any)}
                activeOpacity={0.85}
              >
                <Image source={{ uri: coverImg }} style={styles.popularImg} />
                <View style={styles.popularOverlay}>
                  <View style={styles.ratingPill}>
                    <Star size={11} color="#F59E0B" fill="#F59E0B" />
                    <Text style={styles.ratingPillText}>{gym.averageRating ?? 4.8}</Text>
                  </View>
                </View>
                <View style={styles.popularBody}>
                  <Text style={styles.popularTitle} numberOfLines={1}>
                    {gym.name}
                  </Text>
                  {gym.address ? (
                    <View style={styles.gymMeta}>
                      <MapPin size={11} color={theme.colors.textMuted} />
                      <Text style={styles.gymAddress} numberOfLines={1}>
                        {gym.address}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

// ─── All Partner Gyms ───────────────────────────────────────────────────────
function AllPartnerGyms() {
  const { data: gyms, isLoading } = usePartnerGyms();
  const [search, setSearch] = useState('');
  const router = useRouter();

  const list = Array.isArray(gyms) ? gyms : [];
  const filtered = list.filter(
    (g) =>
      g.name?.toLowerCase().includes(search.toLowerCase()) ||
      (g.address || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Partner Gym Directory</Text>

      {/* Search */}
      <View style={styles.searchBox}>
        <Search size={15} color={theme.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search gym by name or city..."
          placeholderTextColor={theme.colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {isLoading ? (
        <View style={styles.gridContainer}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} style={styles.gridSkeletonCard} />
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>
            {search ? `No gym matching "${search}"` : 'No partner gyms available right now.'}
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
                </View>

                <View style={styles.gridBody}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={styles.gridGymName} numberOfLines={1}>
                      {gym.name}
                    </Text>
                    <ArrowUpRight size={13} color={theme.colors.primary} />
                  </View>

                  {gym.address ? (
                    <View style={styles.gridAddressRow}>
                      <MapPin size={11} color={theme.colors.primary} />
                      <Text style={styles.gridAddressText} numberOfLines={1}>
                        {gym.address}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.gridFooterPill}>
                    <BadgeCheck size={10} color={theme.colors.primary} />
                    <Text style={styles.gridFooterPillText}>FITPASS VERIFIED</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Root Dashboard ────────────────────────────────────────────────────────
export function FitPassDashboard({ onScanQR }: { onScanQR: () => void }) {
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Header onScanQR={onScanQR} />
      <PassCard />
      <PopularFitPassGyms />
      <AllPartnerGyms />
    </ScrollView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 90, gap: 24 },

  // Top Custom Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(240,160,32,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(240,160,32,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: fontFamilies.header,
    fontSize: 20,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
    borderWidth: 1.5,
    borderColor: theme.colors.background,
  },
  greeting: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  userName: {
    fontFamily: fontFamilies.header,
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.2,
  },
  headerRightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scanBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(198,40,40,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Active Pass Card
  passCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 16,
    overflow: 'hidden',
  },
  passCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  passBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  passLabel: {
    fontFamily: fontFamilies.header,
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 1,
  },
  passName: {
    fontFamily: fontFamilies.header,
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: {
    fontFamily: fontFamilies.header,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // Sessions Meter
  sessionsRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  sessionCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(240,160,32,0.12)',
    borderWidth: 2,
    borderColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionsNum: {
    fontFamily: fontFamilies.header,
    fontSize: 24,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  sessionsUnit: {
    fontFamily: fontFamilies.header,
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.textMuted,
    marginTop: -2,
    letterSpacing: 0.5,
  },
  sessionsMeter: { flex: 1, gap: 6 },
  meterBg: { height: 7, backgroundColor: theme.colors.border, borderRadius: 4, overflow: 'hidden' },
  meterFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 4 },
  meterLabel: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: '600',
  },
  expiryText: {
    fontFamily: fontFamilies.body,
    fontSize: 11,
    color: theme.colors.textMuted,
  },

  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(76,175,80,0.12)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(76,175,80,0.25)',
  },
  liveBannerText: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '700',
  },
  cooldownBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(25,118,210,0.12)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.25)',
  },
  cooldownText: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    color: '#4FC3F7',
    fontWeight: '700',
  },

  // Sections
  section: { gap: 14 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: {
    fontFamily: fontFamilies.header,
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.2,
  },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },

  // Popular Carousel Card
  popularCard: {
    width: 210,
    backgroundColor: theme.colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  popularImg: { width: '100%', height: 125 },
  popularOverlay: { position: 'absolute', top: 10, right: 10 },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingPillText: {
    fontFamily: fontFamilies.header,
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
  },
  popularBody: { padding: 14, gap: 4 },
  popularTitle: {
    fontFamily: fontFamilies.header,
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  gymMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  gymAddress: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    flex: 1,
  },

  // Search
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

  // 2-COLUMN GRID (2 Gyms per row)
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

  gridFooterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(240,160,32,0.10)',
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
    color: theme.colors.primary,
    letterSpacing: 0.5,
  },

  emptyBox: {
    paddingVertical: 30,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },

  skeletonPassCard: { height: 180, borderRadius: 20 },
  popularSkeletonCard: { width: 210, height: 175, borderRadius: 18 },
  gridSkeletonCard: { width: '48%', height: 180, borderRadius: 18 },
});

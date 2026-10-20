import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { theme } from '@/design-system/theme';
import { useRouter } from 'expo-router';
import {
  CalendarCheck,
  CreditCard,
  Dumbbell,
  Utensils,
  ChevronRight,
  Activity,
  Flame,
  Users,
  UserCheck,
  Scale,
  LifeBuoy,
  ShieldCheck,
  Clock,
  Sparkles,
  CheckCircle2,
  Apple,
  Droplets,
  Plus,
  Minus,
  Play,
} from '@/components/ui/app-icons';
import { Skeleton } from '@/components/ui';
import { useH4Dashboard, useH4Plan, useH4Classes, useH4BookClass, useH4CancelClass, useH4WorkoutPlans, useH4DietPlans } from '../api/h4.api';
import { useAuth } from '@/features/auth';
import { storage } from '@/lib/storage';
import { H4TopHeader } from './H4TopHeader';
import { Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

//  Member Hero Banner 
// Replaces the old MembershipPassCard + ActivityStats split into one premium hero.
function MemberHeroBanner() {
  const { data: plan } = useH4Plan();
  const { data } = useH4Dashboard();
  const router = useRouter();

  const isActive = plan?.status === 'Active';
  const expiry = plan?.expiryDate
    ? new Date(plan.expiryDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  const visits = data?.attendanceCount ?? 0;
  const lastPaid = data?.recentPayments?.[0]?.amount ?? (data?.member as any)?.paidAmount;
  const memberName = (data?.member as any)?.name;
  const firstName = memberName ? memberName.split(' ')[0] : null;

  return (
    <TouchableOpacity
      activeOpacity={0.97}
      onPress={() => router.push('/(h4)/attendance')}
      style={styles.heroCard}
    >
      <LinearGradient
        colors={['#FBF2D8', '#F8FBFB', '#FFF3E5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.heroOrbitOuter} />
      <View pointerEvents="none" style={styles.heroOrbitInner} />
      <View style={styles.heroInner}>
        {/* Top row: eyebrow + status pill */}
        <View style={styles.heroTopRow}>
          <Text style={styles.heroEyebrow}>MEMBERSHIP</Text>
          <View style={[styles.heroStatusPill, { backgroundColor: isActive ? '#E5F2EC' : '#F9E9E8' }]}>
            <CheckCircle2 size={14} color={isActive ? theme.colors.success : theme.colors.error} />
            <Text style={[styles.heroStatusLabel, { color: isActive ? theme.colors.success : theme.colors.error }]}>
              {isActive ? 'MEMBERSHIP ACTIVE' : 'MEMBERSHIP INACTIVE'}
            </Text>
          </View>
        </View>

        {/* Plan name  the dominant element */}
        <Text style={styles.heroPlanName} numberOfLines={1}>
          {plan?.planName ?? 'H4 Elite Access'}
        </Text>

        {/* Greeting + expiry row */}
        <View style={styles.heroMetaRow}>
          {firstName
            ? <Text style={styles.heroMeta}>Welcome back, <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{firstName}</Text></Text>
            : <Text style={styles.heroMeta}>H4 Fitness Member</Text>
          }
          {expiry && <Text style={styles.heroMeta}>Exp {expiry}</Text>}
        </View>

        {/* Divider */}
        <View style={styles.heroDivider} />

        {/* Stats row */}
        <View style={styles.heroStatRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatNum}>{visits}</Text>
            <Text style={styles.heroStatLabel}>Check-ins</Text>
          </View>
          <View style={styles.heroStatRule} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatNum}>{visits > 0 ? `${visits}d` : ''}</Text>
            <Text style={styles.heroStatLabel}>Streak</Text>
          </View>
          <View style={styles.heroStatRule} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatNum}>{lastPaid ? `}` : ''}</Text>
            <Text style={styles.heroStatLabel}>Last Paid</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}



//  Upcoming Studio Classes 
function HomeStudioClassesSection() {
  const { data: classes, isLoading } = useH4Classes();
  const bookMutation = useH4BookClass();
  const cancelMutation = useH4CancelClass();
  const [actionId, setActionId] = React.useState<string | null>(null);
  const router = useRouter();

  if (isLoading) return <Skeleton style={{ height: 120, borderRadius: 0, marginBottom: 16 }} />;

  const list = Array.isArray(classes) ? classes : [];

  const handleBook = async (cls: any) => {
    const classId = cls._id || cls.id;
    try {
      setActionId(classId);
      await bookMutation.mutateAsync(classId);
      Alert.alert('Seat reserved', `You are booked for ${cls.name}.`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Could not book class';
      Alert.alert('Booking Error', msg);
    } finally {
      setActionId(null);
    }
  };

  const confirmBook = (cls: any) => {
    const details = [
      cls.description?.trim(),
      `Time: ${cls.startTime || 'To be announced'}`,
      `Coach: ${cls.trainerName || 'H4 Trainer'}`,
    ].filter(Boolean).join('\n\n');
    Alert.alert(`Book ${cls.name}?`, details, [
      { text: 'Keep browsing', style: 'cancel' },
      { text: 'Confirm booking', onPress: () => { void handleBook(cls); } },
    ]);
  };

  const showClassDetails = (cls: any) => {
    const details = [
      cls.description?.trim() || 'No class description has been added yet.',
      `Time: ${cls.startTime || 'To be announced'}`,
      `Coach: ${cls.trainerName || 'H4 Trainer'}`,
      `Seats left: ${cls.seatsAvailable ?? ''}`,
    ].join('\n\n');
    Alert.alert(cls.name || 'Class details', details, [{ text: 'Close' }]);
  };

  const handleCancel = async (cls: any) => {
    const classId = cls._id || cls.id;
    try {
      setActionId(classId);
      await cancelMutation.mutateAsync(classId);
      Alert.alert('Booking Cancelled', `Reservation for ${cls.name} has been cancelled.`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Could not cancel booking';
      Alert.alert('Error', msg);
    } finally {
      setActionId(null);
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>CLASSES TODAY</Text>
        <TouchableOpacity
          onPress={() => router.push('/(h4)/classes')}
          activeOpacity={0.7}
        >
          <Text style={styles.textLink}>All ({list.length})</Text>
        </TouchableOpacity>
      </View>

      {list.length === 0 ? (
        <Text style={styles.emptyText}>No classes scheduled today.</Text>
      ) : (
        <View style={[styles.card, { gap: 12, paddingVertical: 8 }]}>
          {list.slice(0, 2).map((cls, idx) => {
            const classId = cls._id || cls.id || '';
            const isFull = cls.seatsAvailable <= 0 && !cls.isBooked;
            const isPending = actionId === classId;

            return (
              <React.Fragment key={classId}>
                {idx > 0 && <View style={styles.dividerThin} />}
                <View style={styles.classRow}>
                  {cls.imageUrl ? (
                    <Image source={{ uri: cls.imageUrl }} style={styles.classThumbnail} resizeMode="cover" />
                  ) : (
                    <View style={styles.classThumbnailFallback}>
                      <Dumbbell size={16} color={theme.colors.primaryText} />
                    </View>
                  )}
                  <TouchableOpacity
                    style={{ flex: 1, minWidth: 0, marginRight: 4, paddingVertical: 3 }}
                    onPress={() => showClassDetails(cls)}
                    activeOpacity={0.72}
                    accessibilityRole="button"
                    accessibilityLabel={`View details for ${cls.name}`}
                  >
                    <Text style={styles.classNameText} numberOfLines={2}>{cls.name}</Text>
                    <Text style={styles.classMetaText} numberOfLines={2}>
                      {cls.description?.trim() || `${cls.startTime || 'Time TBA'}  Coach: ${cls.trainerName || 'H4 Trainer'}`}
                    </Text>
                  </TouchableOpacity>

                  {cls.isBooked ? (
                    <TouchableOpacity
                      style={styles.cancelTextBtn}
                      onPress={() => handleCancel(cls)}
                      disabled={isPending}
                    >
                      <Text style={styles.cancelTextBtnLabel}>Cancel</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.bookTextBtn, isFull && { opacity: 0.5 }]}
                      onPress={() => confirmBook(cls)}
                      disabled={isFull || isPending}
                    >
                      <Text style={styles.bookTextBtnLabel}>
                        {isFull ? 'Full' : 'Book'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </React.Fragment>
            );
          })}
        </View>
      )}
    </View>
  );
}

//  Recent Check-ins 
function RecentCheckIns() {
  const { data, isLoading } = useH4Dashboard();
  const router = useRouter();
  if (isLoading) return <Skeleton style={{ height: 80, borderRadius: 0 }} />;

  const records = (data?.recentAttendance ?? []).slice(0, 2);

  return (
    <View style={styles.section}>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>ACTIVITY LOG</Text>
        <TouchableOpacity
          onPress={() => router.push('/(h4)/attendance')}
          activeOpacity={0.7}
        >
          <Text style={styles.textLink}>History</Text>
        </TouchableOpacity>
      </View>

      {records.length === 0 ? (
        <Text style={styles.emptyText}>No recent activity.</Text>
      ) : (
        <View style={[styles.card, { gap: 10, paddingVertical: 8 }]}>
          {records.map((rec, idx) => (
            <React.Fragment key={rec.id}>
              {idx > 0 && <View style={styles.dividerThin} />}
              <View style={styles.logRow}>
                <Text style={styles.logDate}>
                  {new Date(rec.date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
                <Text style={styles.logGym} numberOfLines={1}>
                  {!rec.gymName || rec.gymName === 'Partner Gym' || rec.gymName.includes('Partner') ? 'H4 Gym' : rec.gymName}
                </Text>
                <Text style={styles.logTime}>{rec.checkInTime}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      )}
    </View>
  );
}

function TodayWorkoutSummaryCard() {
  const { data: plans } = useH4WorkoutPlans();
  const router = useRouter();

  const activePlan = Array.isArray(plans) && plans.length > 0 ? plans[0] : null;
  const exercises = activePlan?.exercises || [];
  const totalSets = exercises.reduce((sum: number, ex: any) => sum + (Number(ex.sets) || 4), 0);
  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const today = dayNames[new Date().getDay()];

  return (
    <View style={styles.section}>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>TODAY'S WORKOUT</Text>
        <TouchableOpacity onPress={() => router.push('/(h4)/workouts')} activeOpacity={0.7}>
          <Text style={styles.textLink}>View Plan</Text>
        </TouchableOpacity>
      </View>

      {/*  Ticket Card  */}
      <TouchableOpacity
        activeOpacity={0.96}
        onPress={() => router.push('/(h4)/workouts')}
        style={styles.wktTicket}
      >
        {/* Orange header band */}
        <View style={styles.wktHeader}>
          <View style={styles.wktHeaderLeft}>
            <Text style={styles.wktDayLabel}>{today}</Text>
            <Text style={styles.wktPlanName} numberOfLines={2}>
              {activePlan?.name || 'Chest & Triceps'}
            </Text>
          </View>
          <View style={styles.wktHeaderRight}>
            <Text style={styles.wktSetsCount}>{totalSets || (exercises.length || 3) * 4}</Text>
            <Text style={styles.wktSetsLabel}>TOTAL{`\n`}SETS</Text>
          </View>
        </View>

        {/* Perforation tear-line */}
        <View style={styles.wktPerforationRow}>
          <View style={styles.wktCircleLeft} />
          <View style={styles.wktDashedLine} />
          <View style={styles.wktCircleRight} />
        </View>

        {/* White exercise body */}
        <View style={styles.wktBody}>
          {/* Quick-stat strip */}
          <View style={styles.wktStatStrip}>
            <View style={styles.wktStat}>
              <Clock size={13} color="#171713" strokeWidth={2.5} />
              <Text style={styles.wktStatValue}>45 min</Text>
            </View>
            <View style={styles.wktStatDot} />
            <View style={styles.wktStat}>
              <Dumbbell size={13} color="#171713" strokeWidth={2.5} />
              <Text style={styles.wktStatValue}>{exercises.length || 0} exercises</Text>
            </View>
            <View style={styles.wktStatDot} />
            <View style={styles.wktStat}>
              <Flame size={13} color="#171713" strokeWidth={2.5} />
              <Text style={styles.wktStatValue}>High</Text>
            </View>
          </View>

          {/* Exercise rows */}
          <View style={styles.wktExList}>
            {exercises.length === 0 && (
              <Text style={styles.wktNoEx}>No exercises assigned yet  tap to add.</Text>
            )}
            {exercises.slice(0, 4).map((ex: any, idx: number) => (
              <View key={idx} style={[
                styles.wktExRow,
                idx < Math.min(exercises.length, 4) - 1 && styles.wktExRowBorder,
              ]}>
                <Text style={styles.wktExNum}>{String(idx + 1).padStart(2, '0')}</Text>
                <Text style={styles.wktExName} numberOfLines={1}>{ex.name || 'Strength Exercise'}</Text>
                <Text style={styles.wktExSets}>{ex.sets || 4}x{ex.reps || 10}</Text>
              </View>
            ))}
            {exercises.length > 4 && (
              <Text style={styles.wktMoreEx}>+{exercises.length - 4} more exercises</Text>
            )}
          </View>

          {/* CTA row */}
          <TouchableOpacity
            style={styles.wktCta}
            onPress={() => router.push('/(h4)/workouts')}
            activeOpacity={0.82}
          >
            <Text style={styles.wktCtaText}>Begin Session</Text>
            <ChevronRight size={15} color="#171713" strokeWidth={3} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );
}

//  Today's Nutrition & Water Summary Card 
function TodayNutritionSummaryCard() {
  const { data: dietPlans, isLoading } = useH4DietPlans();
  const user = useAuth((s) => s.user);
  const router = useRouter();
  const [waterCups, setWaterCups] = React.useState(0);

  const TOTAL_CUPS = 12;

  React.useEffect(() => {
    if (!user?.id) return;
    const today = new Date().toISOString().split('T')[0];
    storage.getItem(`h4_water_${user.id}_${today}`).then((val) => {
      if (val !== null && val !== undefined) {
        setWaterCups(Math.min(TOTAL_CUPS, Math.max(0, parseInt(val, 10) || 0)));
      }
    });
  }, [user?.id]);

  const addCup = async () => {
    const next = Math.min(TOTAL_CUPS, waterCups + 1);
    setWaterCups(next);
    if (user?.id) {
      const today = new Date().toISOString().split('T')[0];
      await storage.setItem(`h4_water_${user.id}_${today}`, next.toString());
    }
  };

  const removeCup = async () => {
    const next = Math.max(0, waterCups - 1);
    setWaterCups(next);
    if (user?.id) {
      const today = new Date().toISOString().split('T')[0];
      await storage.setItem(`h4_water_${user.id}_${today}`, next.toString());
    }
  };

  if (isLoading) return <Skeleton style={{ height: 120, borderRadius: 0 }} />;

  const activeDiet = Array.isArray(dietPlans) && dietPlans.length > 0 ? dietPlans[0] : null;
  const meals = activeDiet?.meals || [];

  const targets = meals.reduce(
    (acc: any, curr: any) => ({
      calories: acc.calories + (Number(curr.calories) || 0),
      protein: acc.protein + (Number(curr.protein) || 0),
      carbs: acc.carbs + (Number(curr.carbs) || 0),
      fats: acc.fats + (Number(curr.fats) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  const calGoal = targets.calories > 0 ? targets.calories : 2280;
  const protGoal = targets.protein > 0 ? targets.protein : 182;
  const waterProgress = Math.min(100, (waterCups / TOTAL_CUPS) * 100);

  return (
    <View style={styles.section}>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>NUTRITION</Text>
        <TouchableOpacity
          onPress={() => router.push('/(h4)/diets')}
          activeOpacity={0.7}
        >
          <Text style={styles.textLink}>Meal Plan</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.card, { gap: 14 }]}>
        <View style={styles.nutritionRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.macroValue}>{calGoal} kcal</Text>
            <Text style={styles.macroLabel}>Energy Goal</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.macroValue}>{protGoal}g</Text>
            <Text style={styles.macroLabel}>Protein</Text>
          </View>
          <View style={{ flex: 1.5, alignItems: 'flex-end' }}>
            <Text style={styles.waterTitle}>{waterCups} / {TOTAL_CUPS} Cups</Text>
            <Text style={styles.macroLabel}>Hydration</Text>
          </View>
        </View>

        <View style={styles.waterProgressRow}>
          <View style={styles.waterProgressTrack}>
            <View style={[styles.waterProgressBar, { width: `${waterProgress}%` }]} />
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity style={styles.waterBtn} onPress={addCup}>
              <Plus size={14} color={theme.colors.text} />
            </TouchableOpacity>
            {waterCups > 0 && (
              <TouchableOpacity style={styles.waterBtn} onPress={removeCup}>
                <Minus size={14} color={theme.colors.text} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

//  Unified Loading Skeleton 
function H4DashboardSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <H4TopHeader title="H4 Fitness" />
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        scrollEnabled={false}
      >
        <Skeleton style={{ height: 80, borderRadius: 16 }} />
        <Skeleton style={{ height: 90, borderRadius: 16 }} />
        <Skeleton style={{ height: 260, borderRadius: 20 }} />
        <Skeleton style={{ height: 130, borderRadius: 16 }} />
        <Skeleton style={{ height: 160, borderRadius: 16 }} />
      </ScrollView>
    </View>
  );
}

//  Export Component 
export function H4Dashboard() {
  const { isLoading: dbLoading } = useH4Dashboard();
  const { isLoading: planLoading } = useH4Plan();
  const { isLoading: classesLoading } = useH4Classes();
  const { isLoading: workoutLoading } = useH4WorkoutPlans();
  const { isLoading: dietLoading } = useH4DietPlans();

  const isInitialLoading = dbLoading || planLoading || classesLoading || workoutLoading || dietLoading;

  if (isInitialLoading) {
    return <H4DashboardSkeleton />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <H4TopHeader title="H4 Fitness" />
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <MemberHeroBanner />
        <TodayWorkoutSummaryCard />
        <TodayNutritionSummaryCard />
        <HomeStudioClassesSection />
        <RecentCheckIns />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 100, gap: 32 },

  // Base Premium Card layout
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: theme.dark ? 0.2 : 0.03,
    shadowRadius: 6,
  },

  //  Premium Minimalist Hero Card 
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E3DCCB',
    overflow: 'hidden',
    shadowColor: '#171713',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
    flexDirection: 'row',
  },
  heroAccentBar: {
    width: 4,
    backgroundColor: '#171713',
  },
  heroInner: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    gap: 0,
  },
  heroOrbitOuter: {
    position: 'absolute',
    width: 156,
    height: 156,
    borderRadius: 78,
    borderWidth: 1,
    borderColor: 'rgba(36,107,120,0.13)',
    top: -64,
    right: -42,
  },
  heroOrbitInner: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1,
    borderColor: 'rgba(197,106,53,0.16)',
    top: -40,
    right: -18,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  heroEyebrow: {
    fontSize: 9,
    fontWeight: '900',
    color: '#817B6E',
    letterSpacing: 2,
    fontFamily: theme.typography.caption.fontFamily,
  },
  heroStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
  },
  heroStatusLabel: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: theme.typography.caption.fontFamily,
  },
  heroPlanName: {
    fontSize: 26,
    fontWeight: '900',
    color: '#171713',
    fontFamily: theme.typography.h1.fontFamily,
    lineHeight: 28,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  heroMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroMeta: {
    fontSize: 11,
    fontWeight: '500',
    color: '#817B6E',
    fontFamily: theme.typography.caption.fontFamily,
  },
  heroDivider: {
    height: 1,
    backgroundColor: '#E3DCCB',
    marginBottom: 14,
  },
  heroStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  heroStatNum: {
    fontSize: 20,
    fontWeight: '900',
    color: '#171713',
    fontFamily: theme.typography.h2.fontFamily,
    lineHeight: 22,
  },
  heroStatLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#817B6E',
    letterSpacing: 0.5,
    fontFamily: theme.typography.caption.fontFamily,
  },
  heroStatRule: {
    width: 1,
    height: 32,
    backgroundColor: '#E3DCCB',
  },

  passSkeleton: { height: 140, borderRadius: 20 },

  // Sections
  section: { gap: 14 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 },
  sectionTitle: { fontSize: 10, fontWeight: '900', color: theme.colors.textMuted, fontFamily: theme.typography.h1.fontFamily, letterSpacing: 1.5 },
  textLink: { fontSize: 11, fontWeight: '800', color: theme.colors.primaryText, fontFamily: theme.typography.h3.fontFamily },
  emptyText: { fontSize: 12, color: theme.colors.textMuted, fontStyle: 'italic', paddingHorizontal: 4 },

  // Classes (Typographic List)
  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  classThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: 12,
  },
  classThumbnailFallback: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: theme.colors.bgTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  classNameText: { fontSize: 14, fontWeight: '800', color: theme.colors.text, fontFamily: theme.typography.h2.fontFamily, flexShrink: 1 },
  classMetaText: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 3, flexShrink: 1 },
  bookTextBtn: {
    minWidth: 68,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    flexShrink: 0,
  },
  bookTextBtnLabel: { fontSize: 11, fontWeight: '900', color: '#FFFFFF', fontFamily: theme.typography.h3.fontFamily },
  cancelTextBtn: {
    minWidth: 68,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.error,
    borderRadius: 10,
    flexShrink: 0,
  },
  cancelTextBtnLabel: { fontSize: 11, fontWeight: '900', color: theme.colors.error, fontFamily: theme.typography.h3.fontFamily },

  // Activity logs
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  logDate: { fontSize: 12, fontWeight: '800', color: theme.colors.text, fontFamily: theme.typography.h3.fontFamily, width: 60 },
  logGym: { fontSize: 12, color: theme.colors.textSecondary, flex: 1 },
  logTime: { fontSize: 12, fontWeight: '800', color: theme.colors.textSecondary, width: 60, textAlign: 'right' },

  // Workout Summary
  workoutContainer: {
    gap: 8,
  },
  workoutName: { fontSize: 15, fontWeight: '900', color: theme.colors.text, fontFamily: theme.typography.h2.fontFamily, marginBottom: 2 },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseName: { fontSize: 13, fontWeight: '700', color: theme.colors.text, flex: 1 },
  exerciseSets: { fontSize: 12, fontWeight: '800', color: theme.colors.textSecondary, fontFamily: theme.typography.caption.fontFamily },

  // Nutrition & Water
  nutritionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  macroValue: { fontSize: 16, fontWeight: '900', color: theme.colors.text, fontFamily: theme.typography.h2.fontFamily },
  macroLabel: { fontSize: 9, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 1 },
  waterTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.text, fontFamily: theme.typography.h2.fontFamily },
  waterProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  waterProgressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: theme.colors.bgTertiary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  waterProgressBar: {
    height: '100%',
    backgroundColor: '#5F4A00',
  },
  waterBtn: {
    width: 28,
    height: 28,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },

  dividerThin: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },

  //  Sports-Ticket Workout Card 
  wktTicket: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#171713',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 5,
  },
  // Orange header band
  wktHeader: {
    backgroundColor: '#171713',
    paddingTop: 20,
    paddingBottom: 22,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  wktHeaderLeft: {
    flex: 1,
    paddingRight: 12,
  },
  wktDayLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 2.5,
    marginBottom: 4,
    fontFamily: theme.typography.caption.fontFamily,
  },
  wktPlanName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: theme.typography.h1.fontFamily,
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  wktHeaderRight: {
    alignItems: 'flex-end',
    paddingBottom: 2,
  },
  wktSetsCount: {
    fontSize: 40,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: theme.typography.h1.fontFamily,
    lineHeight: 40,
    opacity: 0.9,
  },
  wktSetsLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.60)',
    letterSpacing: 1.2,
    textAlign: 'right',
    marginTop: 2,
    fontFamily: theme.typography.caption.fontFamily,
  },
  // Perforation tear-line
  wktPerforationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    marginTop: -1,
  },
  wktCircleLeft: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.background,
    marginLeft: -10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  wktDashedLine: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    marginHorizontal: 4,
  },
  wktCircleRight: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.background,
    marginRight: -10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  // White body
  wktBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
    backgroundColor: theme.colors.card,
  },
  wktStatStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 6,
  },
  wktStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  wktStatValue: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text,
    fontFamily: theme.typography.bodySm.fontFamily,
  },
  wktStatDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
  },
  // Exercise list
  wktExList: {
    marginBottom: 18,
  },
  wktNoEx: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  wktExRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 10,
  },
  wktExRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  wktExNum: {
    fontSize: 11,
    fontWeight: '900',
    color: '#171713',
    width: 22,
    fontFamily: theme.typography.h1.fontFamily,
    letterSpacing: 0.5,
  },
  wktExName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text,
    fontFamily: theme.typography.body.fontFamily,
  },
  wktExSets: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.caption.fontFamily,
    letterSpacing: 0.3,
  },
  wktMoreEx: {
    fontSize: 11,
    color: theme.colors.primaryText,
    fontWeight: '700',
    paddingTop: 8,
    fontFamily: theme.typography.caption.fontFamily,
  },
  // CTA row
  wktCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.bgTertiary,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 12,
  },
  wktCtaText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#171713',
    fontFamily: theme.typography.h3.fontFamily,
    letterSpacing: 0.2,
  },
});

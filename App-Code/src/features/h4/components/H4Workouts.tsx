import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Dumbbell, CheckCircle, Circle, Flame, Award, Trophy, Calendar, ShieldCheck, Clock } from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';
import { API_CLIENT } from '@/lib/api-client';
import { storage } from '@/lib/storage';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { H4TopHeader } from './H4TopHeader';
import { useH4WorkoutPlans } from '../api/h4.api';
import { useToast } from '@/hooks/useToast';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

export function H4Workouts() {
  const user = useAuth((s) => s.user);
  const toast = useToast();
  const { data: plans, isLoading: isQueryLoading } = useH4WorkoutPlans();
  const [selectedDayIdx, setSelectedDayIdx] = useState(
    new Date().getDay() === 0 ? 6 : new Date().getDay() - 1
  );
  const [completed, setCompleted] = useState<Record<number, boolean>>({});
  const [streak, setStreak] = useState(0);
  const [isLoggedToday, setIsLoggedToday] = useState(false);
  const [workoutLogsHistory, setWorkoutLogsHistory] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activePlan = Array.isArray(plans) && plans.length > 0 ? plans[0] : null;

  const userId = user?.id || user?._id || user?.memberId || user?.email;

  const loadWorkoutState = useCallback(async () => {
    if (!userId) return;
    const day = todayKey();

    const savedStreak = await storage.getItem(`h4_streak_${userId}`);
    if (savedStreak) setStreak(parseInt(savedStreak, 10));

    const savedCompleted = await storage.getItem(`h4_workout_completed_map_${userId}_${day}`);
    if (savedCompleted) {
      try {
        setCompleted(JSON.parse(savedCompleted));
      } catch {}
    } else {
      setCompleted({});
    }

    const logged = await storage.getItem(`h4_workout_completed_${userId}_${day}`);
    if (logged === 'true') {
      setIsLoggedToday(true);
    } else {
      setIsLoggedToday(false);
    }

    const savedHistory = await storage.getItem(`h4_workout_history_${userId}`);
    if (savedHistory) {
      try {
        setWorkoutLogsHistory(JSON.parse(savedHistory));
      } catch {}
    }
  }, [userId]);

  useEffect(() => {
    if (userId) loadWorkoutState();
  }, [userId, loadWorkoutState]);

  const toggleComplete = async (idx: number) => {
    const nextVal = !completed[idx];
    const nextMap = { ...completed, [idx]: nextVal };
    setCompleted(nextMap);
    if (userId) {
      const day = todayKey();
      await storage.setItem(`h4_workout_completed_map_${userId}_${day}`, JSON.stringify(nextMap));
    }
    toast.show(nextVal ? 'Exercise completed! ' : 'Exercise unmarked ', 'info');
  };

  const handleLogWorkout = async (exercises: any[]) => {
    const userId = user?.id || user?._id || user?.memberId || user?.email;
    if (!userId) {
      toast.show('Please log in to save your workout.', 'error');
      return;
    }

    if (exercises.length === 0) {
      toast.show('There are no assigned exercises for today.', 'warning');
      return;
    }

    // Determine completed exercises
    const checkedCount = exercises.filter((_, i) => completed[i]).length;
    const isAllDone = checkedCount === exercises.length || checkedCount === 0;
    
    // If user clicked log directly without checking, mark all completed
    let finalCompletedMap = completed;
    if (checkedCount === 0) {
      const allDoneMap: Record<number, boolean> = {};
      exercises.forEach((_, i) => { allDoneMap[i] = true; });
      finalCompletedMap = allDoneMap;
      setCompleted(allDoneMap);
    }

    const activeDoneCount = Object.values(finalCompletedMap).filter(Boolean).length;
    const fullyCompleted = activeDoneCount >= exercises.length;

    setIsSubmitting(true);
    try {
      await API_CLIENT.post('/workout-plans/log', {
        planId: activePlan?.id || activePlan?._id || '',
        exercises: exercises.filter((_, i) => finalCompletedMap[i]),
        notes: fullyCompleted
          ? `Completed all ${activeDoneCount} exercises today!`
          : `Progress update: ${activeDoneCount} of ${exercises.length} exercises completed.`
      });

      const day = todayKey();
      if (fullyCompleted) {
        const newStreak = streak + 1;
        setStreak(newStreak);
        setIsLoggedToday(true);
        await storage.setItem(`h4_streak_${userId}`, newStreak.toString());
        await storage.setItem(`h4_workout_completed_${userId}_${day}`, 'true');
      }

      const newLogItem = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
        planName: activePlan?.name || 'Chest & Triceps Routine',
        exerciseCount: activeDoneCount,
        totalCount: exercises.length,
        status: fullyCompleted ? 'COMPLETED' : 'IN_PROGRESS',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const updatedLogs = [newLogItem, ...workoutLogsHistory.filter(l => l.date !== newLogItem.date).slice(0, 10)];
      setWorkoutLogsHistory(updatedLogs);
      await storage.setItem(`h4_workout_history_${userId}`, JSON.stringify(updatedLogs));

      if (fullyCompleted) {
        toast.show(`Workout goals completed. Streak: ${streak + 1} days.`, 'success');
      } else {
        toast.show(`Workout progress updated. (${activeDoneCount}/${exercises.length} done)`, 'success');
      }
    } catch (e: any) {
      console.warn('[H4Workouts] API log failed:', e?.response?.data || e?.message);
      toast.show(e?.response?.data?.message || 'Failed to save workout progress', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isQueryLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primaryText} />
      </View>
    );
  }

  const todayDayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  const isSelectedToday = selectedDayIdx === todayDayIdx;
  const isSelectedFuture = selectedDayIdx > todayDayIdx;
  const isSelectedPast = selectedDayIdx < todayDayIdx;

  const getExercises = () => {
    if (!activePlan?.exercises) return [];
    let list: any[] = [];
    if (typeof activePlan.exercises === 'string') {
      try {
        list = JSON.parse(activePlan.exercises);
      } catch {
        list = [];
      }
    } else if (Array.isArray(activePlan.exercises)) {
      list = activePlan.exercises;
    }
    // Filter by selected day if day property exists, else show general list for today/past
    const targetDayName = FULL_DAYS[selectedDayIdx];
    const dayFiltered = list.filter((ex: any) => ex.day && ex.day.toLowerCase() === targetDayName.toLowerCase());
    
    if (dayFiltered.length > 0) return dayFiltered;
    // If exercises have no day tag, show for today/past
    if (selectedDayIdx <= todayDayIdx) return list;
    return [];
  };

  const todayExercises = activePlan ? getExercises() : [];
  const isStarterMode = !activePlan;
  const tomorrowDayName = FULL_DAYS[(selectedDayIdx + 1) % 7];

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F5ED' }}>
      <H4TopHeader title="Training & Workouts" />
      <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Consistency Streak Banner */}
      <View style={styles.streakRow}>
        <View>
          <Text style={styles.streakLabel}>CONSISTENCY STREAK</Text>
          <Text style={styles.streakNum}>{streak} {streak === 1 ? 'Day' : 'Days'} Active</Text>
        </View>
        <Flame size={32} color={streak > 0 ? theme.colors.primary : theme.colors.textMuted} />
      </View>

      {/* Day Selector Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScrollWrap}>
        <View style={styles.dayRow}>
          {DAYS.map((d, i) => (
            <TouchableOpacity
              key={d}
              style={[styles.dayBtn, selectedDayIdx === i && styles.dayBtnActive]}
              onPress={() => {
                setSelectedDayIdx(i);
                setCompleted({});
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.dayText, selectedDayIdx === i && styles.dayTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Day Notice Banners */}
      {isStarterMode ? (
        <View style={styles.infoBanner}>
          <Trophy size={20} color={theme.colors.primaryText} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.infoTitle}>Personalised Workout Schedule Pending</Text>
            <Text style={styles.infoText}>
              Your assigned H4 Fitness coach has not updated your customized training routine yet. Once your coach creates your plan, it will load here automatically!
            </Text>
          </View>
        </View>
      ) : isSelectedFuture ? (
        <View style={styles.infoBanner}>
          <Clock size={20} color={theme.colors.primaryText} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.infoTitle}>Upcoming Workout  {FULL_DAYS[selectedDayIdx]}</Text>
            <Text style={styles.infoText}>
              Your H4 Fitness coach will assign your workout routine for {FULL_DAYS[selectedDayIdx]} tomorrow. Check back then!
            </Text>
          </View>
        </View>
      ) : isSelectedToday && todayExercises.length === 0 ? (
        <View style={styles.infoBanner}>
          <Trophy size={20} color={theme.colors.primaryText} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.infoTitle}>No Workout Assigned for Today ({FULL_DAYS[selectedDayIdx]})</Text>
            <Text style={styles.infoText}>
              For today, nothing is assigned by your trainer yet. Please ask your coach to update your routine for today!
            </Text>
          </View>
        </View>
      ) : null}

      {/* Exercise Section Title */}
      <Text style={styles.sectionTitle}>
        {isSelectedToday ? "Today's Target Routine" : `${FULL_DAYS[selectedDayIdx]} Exercises`}
      </Text>

      {/* Exercise List */}
      {todayExercises.length === 0 ? (
        <View style={styles.restCard}>
          <Award size={32} color={theme.colors.textMuted} />
          <Text style={styles.restText}>
            {isSelectedFuture
              ? `No workout assigned for ${FULL_DAYS[selectedDayIdx]} yet`
              : 'Rest Day  Active Recovery'}
          </Text>
        </View>
      ) : (
        <View style={styles.exerciseList}>
          {todayExercises.map((ex: any, idx: number) => {
            const isDone = !!completed[idx];
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.exRow, isDone && styles.exDone]}
                onPress={() => toggleComplete(idx)}
                activeOpacity={0.8}
                disabled={!isSelectedToday || isLoggedToday}
              >
                <View style={styles.exLeft}>
                  {isDone ? (
                    <CheckCircle size={22} color="#2E7D32" />
                  ) : (
                    <Circle size={22} color={theme.colors.border} />
                  )}
                  <View style={styles.exInfo}>
                    <Text style={[styles.exName, isDone && styles.exNameDone]}>{ex.name}</Text>
                    <Text style={styles.exMeta}>
                      {ex.sets} sets x {ex.reps} reps
                      {ex.weight ? `  ${ex.weight}kg` : ''}
                      {ex.note ? `  ${ex.note}` : ''}
                    </Text>
                  </View>
                </View>
                {isDone && (
                  <View style={styles.donePill}>
                    <Text style={styles.donePillText}>Done</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Log Workout Button */}
      {isSelectedToday && todayExercises.length > 0 && (
        isLoggedToday ? (
          <View style={[styles.logBtn, { backgroundColor: '#16A34A' }]}>
            <CheckCircle size={20} color="#FFFFFF" />
            <Text style={styles.logBtnText} numberOfLines={1} adjustsFontSizeToFit>Today's Goal Completed! </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.logBtn, isSubmitting && { opacity: 0.7 }]}
            onPress={() => handleLogWorkout(todayExercises)}
            activeOpacity={0.85}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Dumbbell size={20} color="#FFFFFF" />
            )}
            <Text style={styles.logBtnText} numberOfLines={1} adjustsFontSizeToFit>
              {isSubmitting
                ? 'Updating Progress...'
                : Object.values(completed).filter(Boolean).length > 0 && Object.values(completed).filter(Boolean).length < todayExercises.length
                ? `Update Progress (${Object.values(completed).filter(Boolean).length}/${todayExercises.length})`
                : `Log Today's Workout`}
            </Text>
          </TouchableOpacity>
        )
      )}

      {/* Workout History & Logs Section */}
      <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Workout History & Logs</Text>
      {workoutLogsHistory.length === 0 ? (
        <View style={styles.historyEmptyCard}>
          <Clock size={20} color="#94A3B8" />
          <Text style={styles.historyEmptyText}>
            No past workout logs recorded yet. Complete today's workout to start your history log!
          </Text>
        </View>
      ) : (
        <View style={styles.historyList}>
          {workoutLogsHistory.map((item) => (
            <View key={item.id} style={styles.historyLogCard}>
              <View style={styles.historyLogLeft}>
                <CheckCircle size={18} color="#16A34A" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyLogTitle}>{item.planName}</Text>
                  <Text style={styles.historyLogSub}>
                    {item.date} at {item.timestamp}  {item.exerciseCount} Exercises Completed
                  </Text>
                </View>
              </View>
              <View style={styles.verifiedPill}>
                <Text style={styles.verifiedPillText}>SENT TO COACH</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F5ED' },
  content: { padding: 18, paddingBottom: 100, gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F5ED' },

  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  streakLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', letterSpacing: 1 },
  streakNum: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginTop: 4 },

  victoryCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#16A34A',
    gap: 16,
  },
  victoryHeader: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  checkBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  victoryTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  victorySub: { fontSize: 13, color: '#64748B', marginTop: 2, lineHeight: 18 },

  nextTaskBanner: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(254,223,30,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(254,223,30,0.3)',
    gap: 4,
  },
  nextTaskTitle: { fontSize: 13, fontWeight: '700', color: '#735B00' },
  nextTaskDesc: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginTop: 2 },

  tomorrowInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F8F5ED',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tomorrowInfoText: { flex: 1, fontSize: 12, color: '#64748B', lineHeight: 17 },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(254,223,30,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(254,223,30,0.3)',
  },
  infoTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  infoText: { fontSize: 12, color: '#64748B', lineHeight: 18, marginTop: 2 },

  dayScrollWrap: { marginHorizontal: -4 },
  dayRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  dayBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  dayBtnActive: { backgroundColor: '#FEDF1E', borderColor: '#FEDF1E' },
  dayText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  dayTextActive: { color: '#FFFFFF' },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },

  restCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 36,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  restText: { fontSize: 14, color: '#64748B', fontWeight: '600' },

  exerciseList: { gap: 10 },
  exRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  exDone: { borderColor: '#16A34A', backgroundColor: 'rgba(22,163,74,0.06)' },
  exLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  exInfo: { flex: 1 },
  exName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  exNameDone: { textDecorationLine: 'line-through', color: '#64748B' },
  exMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  donePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(22,163,74,0.12)',
  },
  donePillText: { fontSize: 11, fontWeight: '700', color: '#16A34A' },

  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FEDF1E',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginTop: 6,
  },
  logBtnText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', flexShrink: 1 },

  historyEmptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyEmptyText: { flex: 1, fontSize: 12, color: '#64748B' },
  historyList: { gap: 10 },
  historyLogCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyLogLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  historyLogTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  historyLogSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  verifiedPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.3)',
  },
  verifiedPillText: { fontSize: 10, fontWeight: '900', color: '#16A34A' },
});

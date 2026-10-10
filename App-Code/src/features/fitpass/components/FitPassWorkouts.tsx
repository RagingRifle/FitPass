import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Text } from 'react-native';
import { Dumbbell, CheckCircle, Flame, Award, Circle, ShieldCheck } from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';
import { fontFamilies } from '@/design-system/tokens';
import { Card } from '@/components/ui';
import { API_CLIENT } from '@/lib/api-client';
import { storage } from '@/lib/storage';
import { useAuth } from '@/features/auth/hooks/useAuth';

export function FitPassWorkouts() {
  const user = useAuth((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<any>(null);
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [completed, setCompleted] = useState<Record<number, boolean>>({});
  const [streak, setStreak] = useState(3);

  const fetchActivePlan = useCallback(async () => {
    try {
      const res = await API_CLIENT.get('/workout-plans');
      if (res.data && res.data.length > 0) {
        setActivePlan(res.data[0]);
      }
    } catch (err) {
      console.warn('Failed fetching FitPass workout plans:', err);
    }
  }, []);

  const loadStreak = useCallback(async () => {
    if (!user?.id) return;
    const saved = await storage.getItem(`fitpass_streak_${user.id}`);
    if (saved) setStreak(parseInt(saved));
  }, [user]);

  useEffect(() => {
    const init = async () => {
      if (user?.id) {
        await Promise.all([fetchActivePlan(), loadStreak()]);
      }
      setLoading(false);
    };
    init();
  }, [user?.id, fetchActivePlan, loadStreak]);

  const saveStreak = async (newVal: number) => {
    if (!user?.id) return;
    setStreak(newVal);
    await storage.setItem(`fitpass_streak_${user.id}`, newVal.toString());
  };

  const getExercises = () => {
    if (!activePlan || !activePlan.exercises) return [];
    return activePlan.exercises.filter((ex: any) => ex.day === selectedDay);
  };

  const toggleComplete = (idx: number) => {
    setCompleted((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleLogWorkout = async () => {
    const dayEx = getExercises();
    const count = dayEx.filter((_: any, i: number) => completed[i]).length;
    if (count === 0) return;

    alert(`💪 FitPass Active Routine logged! Completed ${count} exercises.`);
    await saveStreak(streak + 1);
    setCompleted({});
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF5F1F" />
      </View>
    );
  }

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Card style={styles.streakCard}>
        <View style={{ flex: 1 }}>
          <View style={styles.badgeRow}>
            <ShieldCheck size={14} color="#FF5F1F" />
            <Text style={styles.badgeText}>FITPASS NETWORK FITNESS</Text>
          </View>
          <Text style={styles.streakTitle}>{streak} Days Multi-Gym Streak</Text>
        </View>
        <Flame size={32} color="#FF5F1F" />
      </Card>

      {!activePlan ? (
        <View style={styles.emptyContainer}>
          <Dumbbell size={48} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>General Network Workout Plan</Text>
          <Text style={styles.emptyDesc}>
            Use your FitPass pass at any partner gym. Standard workout guidance routines will load here.
          </Text>
        </View>
      ) : (
        <View>
          <Text style={styles.planTitle}>{activePlan.name}</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daySelector}>
            {days.map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => { setSelectedDay(d); setCompleted({}); }}
                style={[styles.dayButton, selectedDay === d && styles.dayActive]}
              >
                <Text style={[styles.dayButtonText, selectedDay === d && styles.dayButtonTextActive]}>
                  {d.slice(0, 3)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.exercisesList}>
            {getExercises().length === 0 ? (
              <View style={styles.restDay}>
                <Award size={32} color={theme.colors.textMuted} />
                <Text style={styles.restDayText}>Rest Day / Active Cooldown</Text>
              </View>
            ) : (
              getExercises().map((ex: any, idx: number) => {
                const isDone = !!completed[idx];
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.exRow, isDone && styles.exDone]}
                    activeOpacity={0.8}
                    onPress={() => toggleComplete(idx)}
                  >
                    <View style={styles.exLeft}>
                      {isDone ? (
                        <CheckCircle size={22} color={theme.colors.success} />
                      ) : (
                        <Circle size={22} color={theme.colors.border} />
                      )}
                      <View style={styles.exInfo}>
                        <Text style={[styles.exName, isDone && styles.textStrikethrough]}>
                          {ex.name}
                        </Text>
                        <Text style={styles.exSub}>
                          {ex.sets} sets × {ex.reps} reps {ex.weight ? `• ${ex.weight}kg` : ''}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {getExercises().length > 0 && (
            <TouchableOpacity style={styles.logButton} onPress={handleLogWorkout}>
              <Text style={styles.logText}>Log Cross-Gym Session</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  streakCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.md, marginBottom: theme.spacing.md, borderLeftWidth: 4, borderLeftColor: '#FF5F1F' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  badgeText: {
    fontFamily: fontFamilies.header,
    fontSize: 11,
    fontWeight: '800',
    color: '#FF5F1F',
    letterSpacing: 0.5,
  },
  streakTitle: {
    fontFamily: fontFamilies.header,
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: {
    fontFamily: fontFamilies.header,
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: theme.spacing.md,
  },
  emptyDesc: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xl,
  },
  planTitle: {
    fontFamily: fontFamilies.header,
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  daySelector: { flexDirection: 'row', marginBottom: theme.spacing.md },
  dayButton: { paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.border, marginRight: theme.spacing.xs, minWidth: 50, alignItems: 'center' },
  dayActive: { backgroundColor: '#FF5F1F', borderColor: '#FF5F1F' },
  dayButtonText: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: '700',
  },
  dayButtonTextActive: {
    color: '#ffffff',
  },
  exercisesList: { gap: theme.spacing.sm },
  restDay: { alignItems: 'center', paddingVertical: 40, gap: theme.spacing.xs },
  restDayText: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  exRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.md, borderRadius: theme.radii.md, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  exDone: { borderColor: theme.colors.success, backgroundColor: 'rgba(46, 125, 50, 0.05)' },
  exLeft: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flex: 1 },
  exInfo: { flex: 1 },
  exName: {
    fontFamily: fontFamilies.header,
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '700',
  },
  exSub: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  textStrikethrough: { textDecorationLine: 'line-through', color: theme.colors.textMuted },
  logButton: { backgroundColor: '#FF5F1F', paddingVertical: theme.spacing.md, borderRadius: theme.radii.md, alignItems: 'center', marginTop: theme.spacing.lg },
  logText: {
    fontFamily: fontFamilies.header,
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});

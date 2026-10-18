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
import { Apple, Droplets, Check, Flame, Plus, Minus, RotateCcw, UserCheck, Clock, CheckCircle } from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';
import { API_CLIENT } from '@/lib/api-client';
import { storage } from '@/lib/storage';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { H4TopHeader } from './H4TopHeader';
import { useH4DietPlans } from '../api/h4.api';
import { useToast } from '@/hooks/useToast';

const TOTAL_CUPS = 12; // 12 cups = 3,000 ml
const CUP_VOLUME_ML = 250;

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

export function H4Diets() {
  const user = useAuth((s) => s.user);
  const toast = useToast();
  const { data: dietPlans, isLoading: isQueryLoading } = useH4DietPlans();
  const [consumed, setConsumed] = useState<Record<number, boolean>>({});
  const [waterCups, setWaterCups] = useState(0);
  const [assignedTrainer, setAssignedTrainer] = useState<string>('');
  const [nutritionLogsHistory, setNutritionLogsHistory] = useState<any[]>([]);
  const [isNutritionLoggedToday, setIsNutritionLoggedToday] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeDiet = Array.isArray(dietPlans) && dietPlans.length > 0 ? dietPlans[0] : null;

  const fetchTrainerAssignment = useCallback(async () => {
    try {
      const res = await API_CLIENT.get('/trainer-assignments');
      const items = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
      if (items.length > 0 && items[0].trainer?.name) {
        setAssignedTrainer(items[0].trainer.name);
      }
    } catch {
      /* fallback */
    }
  }, []);

  const userId = user?.id || user?._id || user?.memberId || user?.email;

  const loadDailyData = useCallback(async () => {
    if (!userId) return;
    const day = todayKey();

    const savedWater = await storage.getItem(`h4_water_${userId}_${day}`);
    if (savedWater !== null && savedWater !== undefined) {
      setWaterCups(Math.min(TOTAL_CUPS, Math.max(0, parseInt(savedWater, 10) || 0)));
    } else {
      setWaterCups(0);
    }

    const savedConsumed = await storage.getItem(`h4_consumed_${userId}_${day}`);
    if (savedConsumed) {
      try {
        setConsumed(JSON.parse(savedConsumed));
      } catch {
        /* ignore */
      }
    }

    const loggedToday = await storage.getItem(`h4_nutrition_logged_${userId}_${day}`);
    if (loggedToday === 'true') {
      setIsNutritionLoggedToday(true);
    }

    const savedHistory = await storage.getItem(`h4_nutrition_history_${userId}`);
    if (savedHistory) {
      try {
        setNutritionLogsHistory(JSON.parse(savedHistory));
      } catch {}
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      loadDailyData();
      fetchTrainerAssignment();
    }
  }, [userId, loadDailyData, fetchTrainerAssignment]);

  const updateWater = async (newCups: number) => {
    const clamped = Math.max(0, Math.min(TOTAL_CUPS, newCups));
    const isAdding = clamped > waterCups;
    setWaterCups(clamped);
    if (userId) {
      await storage.setItem(`h4_water_${userId}_${todayKey()}`, clamped.toString());
    }
    if (newCups !== waterCups) {
      toast.show(isAdding ? 'Water logged! ' : 'Water log updated ', 'success');
    }
  };

  const toggleConsumed = async (idx: number) => {
    const next = { ...consumed, [idx]: !consumed[idx] };
    setConsumed(next);
    if (userId) {
      await storage.setItem(`h4_consumed_${userId}_${todayKey()}`, JSON.stringify(next));
    }
    toast.show(next[idx] ? 'Meal completed! ' : 'Meal unmarked ', 'info');
  };

  const targets = activeDiet?.meals?.reduce(
    (acc: any, curr: any) => ({
      calories: acc.calories + (Number(curr.calories) || 0),
      protein: acc.protein + (Number(curr.protein) || 0),
      carbs: acc.carbs + (Number(curr.carbs) || 0),
      fats: acc.fats + (Number(curr.fats) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  ) ?? { calories: 2200, protein: 160, carbs: 220, fats: 70 };

  const consumedMacros = activeDiet?.meals?.reduce(
    (acc: any, curr: any, idx: number) =>
      consumed[idx]
        ? {
            calories: acc.calories + (Number(curr.calories) || 0),
            protein: acc.protein + (Number(curr.protein) || 0),
            carbs: acc.carbs + (Number(curr.carbs) || 0),
            fats: acc.fats + (Number(curr.fats) || 0),
          }
        : acc,
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  ) ?? { calories: 0, protein: 0, carbs: 0, fats: 0 };

  const handleLogNutrition = async () => {
    if (!userId) {
      toast.show('Please log in to save your nutrition log.', 'error');
      return;
    }

    const totalMeals = activeDiet?.meals?.length || 0;
    const eatenMeals = Object.values(consumed).filter(Boolean).length;
    const fullyCompleted = (totalMeals > 0 && eatenMeals >= totalMeals) || waterCups >= TOTAL_CUPS;

    setIsSubmitting(true);
    try {
      await API_CLIENT.post('/diet-plans/log', {
        planId: activeDiet?.id || activeDiet?._id || '',
        calories: consumedMacros.calories,
        protein: consumedMacros.protein,
        waterCups,
        notes: fullyCompleted
          ? `All nutrition goals completed! (${consumedMacros.calories} kcal, ${waterCups}/${TOTAL_CUPS} water cups)`
          : `Progress update: ${eatenMeals}/${totalMeals} meals eaten, ${waterCups}/${TOTAL_CUPS} water cups.`
      });

      const day = todayKey();
      if (fullyCompleted) {
        setIsNutritionLoggedToday(true);
        await storage.setItem(`h4_nutrition_logged_${userId}_${day}`, 'true');
      }

      const newHistoryItem = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
        planName: activeDiet?.name || 'High-Protein Muscle Building Diet',
        calories: consumedMacros.calories,
        protein: consumedMacros.protein,
        waterCups,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const updatedHistory = [newHistoryItem, ...nutritionLogsHistory.filter(h => h.date !== newHistoryItem.date).slice(0, 10)];
      setNutritionLogsHistory(updatedHistory);
      await storage.setItem(`h4_nutrition_history_${userId}`, JSON.stringify(updatedHistory));

      if (fullyCompleted) {
        toast.show(' Today\'s Nutrition Goals Completed! Coach notified.', 'success');
      } else {
        toast.show(` Progress saved! ${consumedMacros.calories} kcal logged.`, 'success');
      }
    } catch (e: any) {
      console.warn('[H4Diets] Nutrition API log failed:', e?.response?.data || e?.message);
      toast.show(e?.response?.data?.message || 'Failed to save progress', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isQueryLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const currentVolumeMl = waterCups * CUP_VOLUME_ML;
  const targetVolumeMl = TOTAL_CUPS * CUP_VOLUME_ML;
  const waterPercent = Math.min(100, Math.round((waterCups / TOTAL_CUPS) * 100));

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F5ED' }}>
      <H4TopHeader title="Nutrition & Diet" />
      <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/*  Hydration Tracker  */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardLabel}>HYDRATION TRACKER</Text>
            <Text style={styles.cardTitle}>{currentVolumeMl} / {targetVolumeMl} mL</Text>
            <Text style={styles.cardSub}>{waterCups} of {TOTAL_CUPS} Glasses (250 mL each)</Text>
          </View>
          <View style={styles.dropletBadge}>
            <Droplets size={24} color="#5F4A00" />
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${waterPercent}%` }]} />
          </View>
          <Text style={styles.progressText}>{waterPercent}% Completed</Text>
        </View>

        {/* Cup Grid */}
        <View style={styles.cupsGrid}>
          {Array.from({ length: TOTAL_CUPS }).map((_, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.cupBox, i < waterCups && styles.cupBoxFilled]}
              onPress={() => updateWater(i < waterCups && i + 1 === waterCups ? i : i + 1)}
              activeOpacity={0.7}
            >
              <Droplets size={16} color={i < waterCups ? '#FFFFFF' : '#5F4A00'} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Water Action Buttons */}
        <View style={styles.waterControls}>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => updateWater(waterCups + 1)}
            disabled={waterCups >= TOTAL_CUPS}
            activeOpacity={0.8}
          >
            <Plus size={18} color="#FFFFFF" />
            <Text style={styles.addBtnText} numberOfLines={1} adjustsFontSizeToFit>+ Add Cup</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.controlIconBtn}
            onPress={() => updateWater(waterCups - 1)}
            disabled={waterCups <= 0}
            activeOpacity={0.8}
          >
            <Minus size={18} color="#64748B" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.controlIconBtn}
            onPress={() => updateWater(0)}
            disabled={waterCups === 0}
            activeOpacity={0.8}
          >
            <RotateCcw size={18} color="#64748B" />
          </TouchableOpacity>
        </View>
      </View>

      {/*  Diet Plan / Macros  */}
      {!activeDiet ? (
        <View style={styles.emptyCard}>
          <Apple size={40} color={theme.colors.primary} />
          <Text style={styles.emptyTitle}>Personalised Diet Plan Pending</Text>
          <Text style={styles.emptyDesc}>
            Your assigned H4 Fitness nutrition coach has not updated your customized meal schedule and macro targets yet. Once your coach creates your plan, it will load here automatically!
          </Text>
        </View>
      ) : (
        <>
          {/* Plan Header Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardLabel}>DAILY NUTRITION PLAN</Text>
                <Text style={styles.cardTitle}>{activeDiet.name}</Text>
                {activeDiet.description ? (
                  <Text style={styles.cardSub}>{activeDiet.description}</Text>
                ) : null}
              </View>
              <View style={styles.appleBadge}>
                <Apple size={24} color={theme.colors.primary} />
              </View>
            </View>

            {/* Macro Summary Grid */}
            <View style={styles.macroGrid}>
              <View style={styles.macroBox}>
                <Text style={styles.macroVal}>
                  {consumedMacros.calories} / {targets.calories}
                </Text>
                <Text style={styles.macroUnit}>kcal</Text>
                <Text style={styles.macroLabel}>Energy</Text>
              </View>
              <View style={styles.macroBox}>
                <Text style={styles.macroVal}>
                  {consumedMacros.protein} / {targets.protein}g
                </Text>
                <Text style={styles.macroUnit}>Protein</Text>
                <Text style={styles.macroLabel}>Muscle Build</Text>
              </View>
              <View style={styles.macroBox}>
                <Text style={styles.macroVal}>
                  {consumedMacros.carbs} / {targets.carbs}g
                </Text>
                <Text style={styles.macroUnit}>Carbs</Text>
                <Text style={styles.macroLabel}>Fuel</Text>
              </View>
              <View style={styles.macroBox}>
                <Text style={styles.macroVal}>
                  {consumedMacros.fats} / {targets.fats}g
                </Text>
                <Text style={styles.macroUnit}>Fats</Text>
                <Text style={styles.macroLabel}>Essential</Text>
              </View>
            </View>
          </View>

          {/* Meals Schedule List */}
          <Text style={styles.sectionTitle}>Meal Schedule</Text>
          <View style={styles.mealsList}>
            {activeDiet.meals?.map((meal: any, idx: number) => {
              const isDone = !!consumed[idx];
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.mealRow, isDone && styles.mealDone]}
                  onPress={() => toggleConsumed(idx)}
                  activeOpacity={0.85}
                >
                  <View style={styles.mealLeft}>
                    {isDone ? (
                      <View style={styles.checkCircle}>
                        <Check size={12} color="#FFFFFF" />
                      </View>
                    ) : (
                      <View style={styles.uncheckCircle} />
                    )}
                    <View style={styles.mealInfo}>
                      <Text style={[styles.mealName, isDone && styles.mealNameDone]}>{meal.name}</Text>
                      <Text style={styles.mealItems} numberOfLines={1}>{meal.items || 'Meal items'}</Text>
                    </View>
                  </View>
                  <View style={styles.mealRight}>
                    <Text style={styles.mealCal}>{meal.calories} kcal</Text>
                    <Text style={styles.mealTime}>{meal.time}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Log Nutrition & Water Button */}
          {isNutritionLoggedToday ? (
            <View style={[styles.logNutritionBtn, { backgroundColor: '#16A34A' }]}>
              <CheckCircle size={20} color="#FFFFFF" />
              <Text style={styles.logNutritionBtnText} numberOfLines={1} adjustsFontSizeToFit>Today's Goal Completed! </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.logNutritionBtn, isSubmitting && { opacity: 0.7 }]}
              onPress={handleLogNutrition}
              activeOpacity={0.85}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Apple size={20} color="#FFFFFF" />
              )}
              <Text style={styles.logNutritionBtnText} numberOfLines={1} adjustsFontSizeToFit>
                {isSubmitting
                  ? 'Saving Progress...'
                  : Object.values(consumed).filter(Boolean).length > 0 || waterCups > 0
                  ? `Update Progress (${consumedMacros.calories} kcal)`
                  : `Log Today's Goal`}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/*  Nutrition & Hydration History Section  */}
      <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Nutrition & Hydration History</Text>
      <View style={styles.historyCard}>
        <View style={styles.historyRow}>
          <View style={styles.historyDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.historyDate}>Today ({new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })})</Text>
            <Text style={styles.historyMeta}>
              {consumedMacros.calories} / {targets.calories} kcal  {consumedMacros.protein}g Protein  {waterCups}/{TOTAL_CUPS} Water Glasses
            </Text>
          </View>
          <View style={styles.todayPill}>
            <Text style={styles.todayPillText}>{waterPercent >= 100 ? 'TARGET REACHED' : 'IN PROGRESS'}</Text>
          </View>
        </View>
      </View>

      {/*  Trainer Attribution Card (Bottom)  */}
      <View style={styles.trainerFooterCard}>
        <View style={styles.trainerAvatarBg}>
          <UserCheck size={22} color={theme.colors.primary} />
        </View>
        <View style={styles.trainerFooterInfo}>
          <Text style={styles.trainerFooterTag}>ASSIGNED NUTRITION COACH</Text>
          <Text style={styles.trainerFooterName}>
            {activeDiet?.trainer?.name || activeDiet?.trainerName || assignedTrainer || 'H4 Certified Master Trainer'}
          </Text>
          <Text style={styles.trainerFooterBio}>
            Your personalized macro goals and meal schedule are designed by your H4 Fitness coach.
          </Text>
        </View>
      </View>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F5ED' },
  content: { padding: 18, paddingBottom: 100, gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F5ED' },

  card: {
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', letterSpacing: 1 },
  cardTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  cardSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  dropletBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,117,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  progressContainer: { gap: 6 },
  progressBg: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#5F4A00', borderRadius: 4 },
  progressText: { fontSize: 11, fontWeight: '600', color: '#5F4A00', textAlign: 'right' },

  cupsGrid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  cupBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#5F4A00',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  cupBoxFilled: { backgroundColor: '#5F4A00', borderColor: '#5F4A00' },

  cupActions: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 6 },
  addCupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#5F4A00',
  },
  addCupBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },

  emptyCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 40,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  emptyDesc: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20 },

  macroTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  macroBar: { gap: 8 },
  macroBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  macroLbl: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  macroVal: { fontSize: 12, color: '#64748B' },
  barBg: { height: 7, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#F5B800', borderRadius: 4 },
  macroGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  macroItem: { flex: 1, alignItems: 'center', gap: 2 },
  macroItemLabel: { fontSize: 11, color: '#64748B' },
  macroItemVal: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  macroItemTarget: { fontSize: 11, color: '#64748B' },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  mealList: { gap: 10 },
  mealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  mealDone: { borderColor: '#16A34A', backgroundColor: 'rgba(22,163,74,0.06)' },
  mealLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  mealInfo: { flex: 1 },
  mealName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  mealNameDone: { textDecorationLine: 'line-through', color: '#64748B' },
  mealItems: { fontSize: 12, color: '#64748B', marginTop: 2 },
  mealRight: { alignItems: 'flex-end', marginLeft: 12 },
  mealCal: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  mealTime: { fontSize: 11, color: '#64748B' },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#16A34A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uncheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },

  trainerFooterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
    gap: 14,
  },
  trainerAvatarBg: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(240, 160, 32, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trainerFooterInfo: { flex: 1, gap: 2 },
  trainerFooterTag: { fontSize: 10, fontWeight: '700', color: '#64748B', letterSpacing: 0.8 },
  trainerFooterName: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  trainerFooterBio: { fontSize: 12, color: '#64748B', lineHeight: 17, marginTop: 2 },

  waterControls: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 6 },
  addBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#5F4A00',
  },
  addBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  controlIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  appleBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(240,160,32,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  macroBox: { flex: 1, alignItems: 'center', gap: 2 },
  macroUnit: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  macroLabel: { fontSize: 10, color: '#94A3B8' },
  mealsList: { gap: 10 },
  historyCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16A34A' },
  historyDate: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  historyMeta: { fontSize: 11, color: '#64748B', marginTop: 2 },
  todayPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.3)',
  },
  todayPillText: { fontSize: 10, fontWeight: '900', color: '#16A34A' },

  logNutritionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#16A34A',
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginTop: 10,
  },
  logNutritionBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', flexShrink: 1 },
});

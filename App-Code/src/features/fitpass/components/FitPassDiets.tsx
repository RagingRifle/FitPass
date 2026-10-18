import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Apple, Droplet, Check, Flame } from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';
import { Typography, Card } from '@/components/ui';
import { API_CLIENT } from '@/lib/api-client';
import { storage } from '@/lib/storage';
import { useAuth } from '@/features/auth/hooks/useAuth';

export function FitPassDiets() {
  const user = useAuth((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [activeDiet, setActiveDiet] = useState<any>(null);
  const [consumed, setConsumed] = useState<Record<number, boolean>>({});
  const [water, setWater] = useState(0);

  const fetchActiveDiet = useCallback(async () => {
    try {
      const res = await API_CLIENT.get('/diet-plans');
      if (res.data && res.data.length > 0) {
        setActiveDiet(res.data[0]);
      }
    } catch (err) {
      console.warn('Failed fetching FitPass diet plans:', err);
    }
  }, []);

  const loadWaterAndConsumed = useCallback(async () => {
    if (!user?.id) return;
    const savedWater = await storage.getItem(`fitpass_water_${user.id}`);
    if (savedWater) setWater(parseInt(savedWater));

    const savedConsumed = await storage.getItem(`fitpass_consumed_${user.id}`);
    if (savedConsumed) {
      try {
        setConsumed(JSON.parse(savedConsumed));
      } catch {
        // ignore error
      }
    }
  }, [user]);

  useEffect(() => {
    const init = async () => {
      if (user?.id) {
        await Promise.all([fetchActiveDiet(), loadWaterAndConsumed()]);
      }
      setLoading(false);
    };
    init();
  }, [user?.id, fetchActiveDiet, loadWaterAndConsumed]);

  const saveWater = async (val: number) => {
    if (!user?.id) return;
    const newVal = Math.max(0, val);
    setWater(newVal);
    await storage.setItem(`fitpass_water_${user.id}`, newVal.toString());
  };

  const toggleConsumed = async (idx: number) => {
    if (!user?.id) return;
    const nextConsumed = { ...consumed, [idx]: !consumed[idx] };
    setConsumed(nextConsumed);
    await storage.setItem(`fitpass_consumed_${user.id}`, JSON.stringify(nextConsumed));
  };

  const targets = activeDiet?.meals?.reduce((acc: any, curr: any) => {
    acc.calories += Number(curr.calories) || 0;
    acc.protein += Number(curr.protein) || 0;
    acc.carbs += Number(curr.carbs) || 0;
    acc.fats += Number(curr.fats) || 0;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fats: 0 }) || { calories: 2200, protein: 140, carbs: 220, fats: 70 };

  const consumedMacros = activeDiet?.meals?.reduce((acc: any, curr: any, idx: number) => {
    if (consumed[idx]) {
      acc.calories += Number(curr.calories) || 0;
      acc.protein += Number(curr.protein) || 0;
      acc.carbs += Number(curr.carbs) || 0;
      acc.fats += Number(curr.fats) || 0;
    }
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fats: 0 }) || { calories: 0, protein: 0, carbs: 0, fats: 0 };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#171713" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Card style={styles.waterCard}>
        <View style={styles.waterHeader}>
          <View>
            <Typography variant="caption" style={{ color: '#171713', fontWeight: '700' }}>FITPASS HYDRATION GOAL</Typography>
            <Typography variant="h2" style={{ color: theme.colors.text }}>{water} / 8 Cups</Typography>
          </View>
          <Droplet size={32} color="#171713" fill={water > 0 ? '#171713' : 'none'} />
        </View>
        <View style={styles.waterBtns}>
          <TouchableOpacity style={styles.waterBtn} onPress={() => saveWater(water + 1)}>
            <Typography variant="bodySm" style={styles.waterBtnText}>Add 1 Cup</Typography>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.waterBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.border }]} onPress={() => saveWater(water - 1)} disabled={water === 0}>
            <Typography variant="bodySm" style={{ color: theme.colors.text, fontWeight: '700' }}>Remove</Typography>
          </TouchableOpacity>
        </View>
      </Card>

      {!activeDiet ? (
        <View style={styles.emptyContainer}>
          <Apple size={48} color={theme.colors.textMuted} />
          <Typography variant="h3" style={styles.emptyTitle}>General Nutrition Guidelines</Typography>
          <Typography variant="bodySm" color="secondary" style={styles.emptyDesc}>
            Stay energized during your multi-gym visits! Standard nutrition tracking will show here when configured.
          </Typography>
        </View>
      ) : (
        <View>
          <Card style={styles.macroCard}>
            <Typography variant="h3" style={styles.macroTitle}>Today's Target Progress</Typography>

            <View style={styles.macroBarContainer}>
              <View style={styles.macroLabelRow}>
                <Typography variant="bodySm" style={{ fontWeight: '700', color: theme.colors.text }}><Flame size={14} color="#171713" /> Calories</Typography>
                <Typography variant="caption" color="secondary">{consumedMacros.calories} / {targets.calories} kcal</Typography>
              </View>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { backgroundColor: '#171713', width: `${Math.min(100, (consumedMacros.calories / targets.calories) * 100)}%` }]} />
              </View>
            </View>

            <View style={styles.macroGrid}>
              <View style={styles.gridItem}>
                <Typography variant="caption" color="secondary">Protein</Typography>
                <Typography variant="bodySm" style={{ fontWeight: '700', color: theme.colors.text }}>{consumedMacros.protein}g / {targets.protein}g</Typography>
              </View>
              <View style={styles.gridItem}>
                <Typography variant="caption" color="secondary">Carbs</Typography>
                <Typography variant="bodySm" style={{ fontWeight: '700', color: theme.colors.text }}>{consumedMacros.carbs}g / {targets.carbs}g</Typography>
              </View>
              <View style={styles.gridItem}>
                <Typography variant="caption" color="secondary">Fats</Typography>
                <Typography variant="bodySm" style={{ fontWeight: '700', color: theme.colors.text }}>{consumedMacros.fats}g / {targets.fats}g</Typography>
              </View>
            </View>
          </Card>

          <Typography variant="h3" style={styles.mealsHeader}>Meal Schedule</Typography>

          <View style={styles.mealsList}>
            {activeDiet.meals?.map((meal: any, idx: number) => {
              const isDone = !!consumed[idx];
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.mealRow, isDone && styles.mealDone]}
                  activeOpacity={0.8}
                  onPress={() => toggleConsumed(idx)}
                >
                  <View style={styles.mealLeft}>
                    {isDone ? (
                      <View style={styles.doneCheck}><Check size={14} color="#ffffff" /></View>
                    ) : (
                      <View style={styles.undoneCheck} />
                    )}
                    <View style={styles.mealInfo}>
                      <Typography variant="bodySm" style={[styles.mealName, isDone && styles.textStrikethrough]}>
                        {meal.name}
                      </Typography>
                      <Typography variant="caption" color="secondary" numberOfLines={1}>
                        {meal.items || 'No items listed'}
                      </Typography>
                    </View>
                  </View>
                  <View style={styles.mealRight}>
                    <Typography variant="bodySm" style={{ fontWeight: '700', color: theme.colors.text }}>{meal.calories} kcal</Typography>
                    <Typography variant="caption" color="muted">{meal.time}</Typography>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  waterCard: { padding: theme.spacing.md, marginBottom: theme.spacing.md, borderLeftWidth: 4, borderLeftColor: '#171713' },
  waterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  waterBtns: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  waterBtn: { flex: 1, backgroundColor: '#171713', paddingVertical: theme.spacing.sm, borderRadius: theme.radii.md, alignItems: 'center' },
  waterBtnText: { color: '#ffffff', fontWeight: '700' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { color: theme.colors.text, marginTop: theme.spacing.md },
  emptyDesc: { textAlign: 'center', marginTop: theme.spacing.xs, paddingHorizontal: theme.spacing.xl },
  macroCard: { padding: theme.spacing.md, marginBottom: theme.spacing.lg },
  macroTitle: { color: theme.colors.text, marginBottom: theme.spacing.md },
  macroBarContainer: { marginBottom: theme.spacing.md },
  macroLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.xs },
  barBg: { height: 8, backgroundColor: theme.colors.border, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%' },
  macroGrid: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing.md },
  gridItem: { flex: 1, alignItems: 'center' },
  mealsHeader: { color: theme.colors.text, marginBottom: theme.spacing.sm },
  mealsList: { gap: theme.spacing.sm },
  mealRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.md, borderRadius: theme.radii.md, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  mealDone: { borderColor: theme.colors.success, backgroundColor: 'rgba(46, 125, 50, 0.05)' },
  mealLeft: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flex: 1 },
  mealInfo: { flex: 1 },
  mealName: { color: theme.colors.text, fontWeight: '700' },
  textStrikethrough: { textDecorationLine: 'line-through', color: theme.colors.textMuted },
  mealRight: { alignItems: 'flex-end', marginLeft: theme.spacing.sm },
  doneCheck: { width: 20, height: 20, borderRadius: 10, backgroundColor: theme.colors.success, justifyContent: 'center', alignItems: 'center' },
  undoneCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: theme.colors.border },
});

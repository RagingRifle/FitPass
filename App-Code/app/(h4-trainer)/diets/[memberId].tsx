import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Apple, Plus, Trash2, Utensils } from '@/components/ui/app-icons';
import { API_CLIENT } from '@/lib/api-client';
import { theme } from '@/design-system/theme';
import { ScreenContainer } from '@/components/layout';
import { useToast } from '@/hooks/useToast';

type Meal = {
  time: string;
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fats: string;
  items: string;
};

type DietPlan = {
  id?: string;
  _id?: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string;
  meals?: any[] | string;
};

type DietTemplate = {
  id?: string;
  _id?: string;
  name: string;
  meals?: any[] | string;
};

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const defaultMeals = (): Meal[] => [
  { time: '08:00 AM', name: 'Breakfast', calories: '0', protein: '0', carbs: '0', fats: '0', items: '' },
];

const parseMeals = (raw: any): Meal[] => {
  let list = raw || [];
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { list = []; }
  }
  if (!Array.isArray(list) || !list.length) return defaultMeals();
  return list.map((meal: any) => ({
    time: String(meal.time || '08:00 AM'),
    name: String(meal.name || ''),
    calories: String(meal.calories ?? 0),
    protein: String(meal.protein ?? 0),
    carbs: String(meal.carbs ?? 0),
    fats: String(meal.fats ?? 0),
    items: Array.isArray(meal.foods) ? meal.foods.join(', ') : String(meal.items || meal.foods || meal.description || ''),
  }));
};

export default function TrainerDietPlan() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const showToast = useToast((s) => s.show);
  const [memberName, setMemberName] = useState('Member');
  const [name, setName] = useState('');
  const [meals, setMeals] = useState<Meal[]>(defaultMeals());
  const [templates, setTemplates] = useState<DietTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<DietPlan[]>([]);
  const [editingPlanId, setEditingPlanId] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [memberRes, plansRes, templatesRes] = await Promise.all([
        API_CLIENT.get(`/members/${memberId}`),
        API_CLIENT.get('/diet-plans', { params: { memberId, limit: 100 } }),
        API_CLIENT.get('/diet-templates').catch(() => ({ data: [] })),
      ]);
      setMemberName(memberRes.data.name || 'Member');
      setPlans(plansRes.data?.data || []);
      setTemplates(Array.isArray(templatesRes.data) ? templatesRes.data : templatesRes.data?.data || []);
    } catch {
      showToast('Could not load this member’s diet plans.', 'error');
    } finally {
      setLoading(false);
    }
  }, [memberId, showToast]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totals = useMemo(() => meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + (Number(meal.calories) || 0),
      protein: acc.protein + (Number(meal.protein) || 0),
      carbs: acc.carbs + (Number(meal.carbs) || 0),
      fats: acc.fats + (Number(meal.fats) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  ), [meals]);

  const updateMeal = (index: number, key: keyof Meal, value: string) => {
    setMeals((items) => items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  };

  const addMeal = () => {
    setMeals((items) => [...items, { time: '01:00 PM', name: '', calories: '0', protein: '0', carbs: '0', fats: '0', items: '' }]);
  };

  const removeMeal = (index: number) => {
    setMeals((items) => (items.length > 1 ? items.filter((_, i) => i !== index) : items));
  };

  const applyTemplate = (template: DietTemplate) => {
    setMeals(parseMeals(template.meals));
    if (!name.trim()) setName(template.name);
    showToast(`Loaded template: ${template.name}`, 'success');
  };

  const resetForm = () => {
    setEditingPlanId('');
    setName('');
    setMeals(defaultMeals());
    setStartDate(today());
    setEndDate('');
  };

  const save = async () => {
    const validMeals = meals
      .filter((meal) => meal.name.trim() || meal.items.trim())
      .map((meal) => ({
        time: meal.time.trim() || '08:00 AM',
        name: meal.name.trim() || 'Meal',
        calories: Number(meal.calories) || 0,
        protein: Number(meal.protein) || 0,
        carbs: Number(meal.carbs) || 0,
        fats: Number(meal.fats) || 0,
        items: meal.items.trim(),
      }));

    if (!name.trim() || !validMeals.length) {
      return showToast('Add a plan name and at least one meal.', 'error');
    }
    if (startDate && endDate && startDate > endDate) {
      return showToast('The end date must be after the start date.', 'error');
    }

    setSaving(true);
    try {
      const payload = {
        memberId,
        memberIds: [memberId],
        name: name.trim(),
        meals: validMeals,
        startDate: startDate || null,
        endDate: endDate || null,
      };
      if (editingPlanId) await API_CLIENT.put(`/diet-plans/${editingPlanId}`, payload);
      else await API_CLIENT.post('/diet-plans', payload);
      showToast(editingPlanId ? 'Diet plan updated.' : 'Diet plan assigned.', 'success');
      resetForm();
      await load();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Could not assign the diet plan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const visiblePlans = plans.filter((plan) => {
    const start = String(plan.startDate || plan.createdAt || '').slice(0, 10);
    const end = String(plan.endDate || plan.startDate || plan.createdAt || '').slice(0, 10);
    return (!filterFrom || !end || end >= filterFrom) && (!filterTo || !start || start <= filterTo);
  });

  const editPlan = (plan: DietPlan) => {
    setEditingPlanId(String(plan.id || plan._id));
    setName(plan.name || '');
    setMeals(parseMeals(plan.meals));
    setStartDate(String(plan.startDate || '').slice(0, 10));
    setEndDate(String(plan.endDate || '').slice(0, 10));
  };

  return (
    <ScreenContainer scrollable={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.member}>
            <View style={styles.icon}><Apple size={18} color="#735B00" /></View>
            <View>
              <Text style={styles.kicker}>NUTRITION PLAN FOR</Text>
              <Text style={styles.memberName}>{memberName}</Text>
            </View>
          </View>

          {loading ? <ActivityIndicator color={theme.colors.primaryText} style={{ marginVertical: 20 }} /> : null}

          <Text style={styles.section}>Assigned diet plans</Text>
          <View style={styles.filterCard}>
            <Text style={styles.filterTitle}>Filter by plan dates</Text>
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 1 }]} value={filterFrom} onChangeText={setFilterFrom} placeholder="From · YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted} />
              <TextInput style={[styles.input, { flex: 1 }]} value={filterTo} onChangeText={setFilterTo} placeholder="To · YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted} />
            </View>
          </View>

          {visiblePlans.length ? visiblePlans.map((plan) => {
            const parsed = parseMeals(plan.meals);
            const planKcal = parsed.reduce((sum, m) => sum + (Number(m.calories) || 0), 0);
            return (
              <TouchableOpacity key={String(plan.id || plan._id)} style={styles.planRow} onPress={() => editPlan(plan)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planDates}>
                    {String(plan.startDate || 'No start date').slice(0, 10)} → {String(plan.endDate || 'Ongoing').slice(0, 10)}
                    {planKcal > 0 ? `  ·  ${planKcal} kcal/day` : ''}
                  </Text>
                </View>
                <Text style={styles.editLabel}>EDIT</Text>
              </TouchableOpacity>
            );
          }) : <Text style={styles.empty}>No plans in this date range. Create one below.</Text>}

          <Text style={styles.section}>{editingPlanId ? 'Edit diet plan' : 'Assign diet plan'}</Text>

          <View style={styles.macroSummary}>
            <MacroBox label="TARGET ENERGY" value={`${totals.calories} kcal`} color="#92700A" />
            <MacroBox label="PROTEIN" value={`${totals.protein} g`} color="#1D4ED8" />
            <MacroBox label="CARBS" value={`${totals.carbs} g`} color="#B45309" />
            <MacroBox label="FATS" value={`${totals.fats} g`} color="#B91C1C" />
          </View>

          {templates.length > 0 && (
            <View style={styles.templateBox}>
              <Text style={styles.label}>Load from template</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateRow}>
                {templates.map((tpl) => (
                  <TouchableOpacity key={String(tpl.id || tpl._id)} style={styles.templateChip} onPress={() => applyTemplate(tpl)}>
                    <Text style={styles.templateText}>{tpl.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <Text style={styles.label}>Plan Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Ketogenic weight loss meal plan" placeholderTextColor={theme.colors.textMuted} />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Start Date</Text>
              <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>End Date</Text>
              <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="Optional · YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted} />
            </View>
          </View>

          <View style={styles.mealsHeader}>
            <Text style={styles.section}>Meals & Macro-nutrients</Text>
            <TouchableOpacity style={styles.addMealBtn} onPress={addMeal}>
              <Plus size={15} color="#514500" />
              <Text style={styles.addMealText}>Add Meal</Text>
            </TouchableOpacity>
          </View>

          {meals.map((meal, index) => (
            <View key={index} style={styles.mealCard}>
              <View style={styles.mealHeader}>
                <View style={styles.mealTitle}>
                  <Utensils size={15} color="#735B00" />
                  <Text style={styles.mealText}>Meal {index + 1}</Text>
                </View>
                {meals.length > 1 && (
                  <TouchableOpacity onPress={() => removeMeal(index)} hitSlop={8}>
                    <Trash2 size={17} color={theme.colors.error} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Time</Text>
                  <TextInput style={styles.input} value={meal.time} onChangeText={(v) => updateMeal(index, 'time', v)} placeholder="08:00 AM" placeholderTextColor={theme.colors.textMuted} />
                </View>
                <View style={{ flex: 1.4 }}>
                  <Text style={styles.fieldLabel}>Meal Name *</Text>
                  <TextInput style={styles.input} value={meal.name} onChangeText={(v) => updateMeal(index, 'name', v)} placeholder="Breakfast" placeholderTextColor={theme.colors.textMuted} />
                </View>
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Calories (kcal)</Text>
                  <TextInput style={styles.input} value={meal.calories} onChangeText={(v) => updateMeal(index, 'calories', v)} keyboardType="number-pad" placeholder="0" placeholderTextColor={theme.colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Protein (g)</Text>
                  <TextInput style={styles.input} value={meal.protein} onChangeText={(v) => updateMeal(index, 'protein', v)} keyboardType="number-pad" placeholder="0" placeholderTextColor={theme.colors.textMuted} />
                </View>
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Carbs (g)</Text>
                  <TextInput style={styles.input} value={meal.carbs} onChangeText={(v) => updateMeal(index, 'carbs', v)} keyboardType="number-pad" placeholder="0" placeholderTextColor={theme.colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Fats (g)</Text>
                  <TextInput style={styles.input} value={meal.fats} onChangeText={(v) => updateMeal(index, 'fats', v)} keyboardType="number-pad" placeholder="0" placeholderTextColor={theme.colors.textMuted} />
                </View>
              </View>

              <View>
                <Text style={styles.fieldLabel}>Food Items</Text>
                <TextInput
                  style={[styles.input, styles.mealInput]}
                  value={meal.items}
                  onChangeText={(v) => updateMeal(index, 'items', v)}
                  placeholder="e.g. 3 eggs, 100g oats, 1 banana"
                  placeholderTextColor={theme.colors.textMuted}
                  multiline
                />
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#171713" /> : <Text style={styles.saveText}>{editingPlanId ? 'Save diet changes' : 'Assign diet plan'}</Text>}
          </TouchableOpacity>
          {editingPlanId ? (
            <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
              <Text style={styles.cancelText}>Cancel editing</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function MacroBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.macroBox}>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={[styles.macroValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 10, paddingBottom: 36 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#FFFFFF' },
  icon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF4B1' },
  kicker: { color: theme.colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  memberName: { marginTop: 3, color: theme.colors.text, fontSize: 14, fontWeight: '800' },
  label: { marginTop: 4, marginBottom: 5, color: theme.colors.textSecondary, fontSize: 11, fontWeight: '700' },
  fieldLabel: { marginBottom: 4, color: theme.colors.textSecondary, fontSize: 10, fontWeight: '700' },
  input: { minHeight: 43, paddingHorizontal: 11, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, backgroundColor: '#FFFFFF', color: theme.colors.text, fontSize: 13 },
  section: { marginTop: 8, color: theme.colors.text, fontSize: 15, fontWeight: '900' },
  macroSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, borderRadius: 14, backgroundColor: '#FAF7EE', borderWidth: 1, borderColor: '#EAE2C9' },
  macroBox: { width: '48%', gap: 2 },
  macroLabel: { fontSize: 9, fontWeight: '800', color: theme.colors.textMuted, letterSpacing: 0.4 },
  macroValue: { fontSize: 15, fontWeight: '900' },
  templateBox: { gap: 4 },
  templateRow: { gap: 8, paddingVertical: 2 },
  templateChip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, backgroundColor: '#FFF4B1' },
  templateText: { color: '#514500', fontSize: 11, fontWeight: '800' },
  mealsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  addMealBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10, backgroundColor: '#FFF4B1' },
  addMealText: { color: '#514500', fontSize: 11, fontWeight: '800' },
  mealCard: { gap: 10, padding: 13, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, backgroundColor: '#FAF8F2' },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mealTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  mealText: { color: theme.colors.text, fontWeight: '800', fontSize: 13 },
  mealInput: { minHeight: 68, textAlignVertical: 'top', paddingTop: 10 },
  saveButton: { minHeight: 49, alignItems: 'center', justifyContent: 'center', marginTop: 6, borderRadius: 13, backgroundColor: theme.colors.primary },
  saveText: { color: '#171713', fontWeight: '900', fontSize: 13 },
  row: { flexDirection: 'row', gap: 10 },
  filterCard: { padding: 11, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#FFFFFF', gap: 8 },
  filterTitle: { color: theme.colors.textSecondary, fontSize: 10, fontWeight: '800' },
  planRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#FFFFFF', gap: 10 },
  planName: { color: theme.colors.text, fontSize: 12, fontWeight: '800' },
  planDates: { color: theme.colors.textMuted, fontSize: 10, marginTop: 4 },
  editLabel: { color: '#735B00', fontSize: 9, fontWeight: '900' },
  empty: { color: theme.colors.textMuted, fontSize: 11, padding: 12 },
  cancelButton: { minHeight: 40, justifyContent: 'center', alignItems: 'center' },
  cancelText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '800' },
});

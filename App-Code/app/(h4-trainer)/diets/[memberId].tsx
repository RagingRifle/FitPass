import React, { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Apple, Utensils } from '@/components/ui/app-icons';
import { API_CLIENT } from '@/lib/api-client';
import { theme } from '@/design-system/theme';
import { ScreenContainer } from '@/components/layout';
import { useToast } from '@/hooks/useToast';

type DietPlan = { id?: string; _id?: string; name: string; startDate?: string | null; endDate?: string | null; createdAt?: string; meals?: any[] | string };
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
export default function TrainerDietPlan() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const showToast = useToast((s) => s.show);
  const [memberName, setMemberName] = useState('Member');
  const [name, setName] = useState('');
  const [meals, setMeals] = useState({ breakfast: '', lunch: '', dinner: '', snacks: '' });
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
      const [memberRes, plansRes] = await Promise.all([
        API_CLIENT.get(`/members/${memberId}`),
        API_CLIENT.get('/diet-plans', { params: { memberId, limit: 100 } })
      ]);
      setMemberName(memberRes.data.name || 'Member');
      setPlans(plansRes.data?.data || []);
    } catch {
      showToast('Could not load this member’s diet plans.', 'error');
    } finally {
      setLoading(false);
    }
  }, [memberId, showToast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const save = async () => {
    if (!name.trim() || !Object.values(meals).some((value) => value.trim())) return showToast('Add a plan name and at least one meal.', 'error');
    if (startDate && endDate && startDate > endDate) return showToast('The end date must be after the start date.', 'error');
    setSaving(true);
    try {
      const mealList = Object.entries(meals).filter(([, value]) => value.trim()).map(([mealName, foods]) => ({ name: mealName.charAt(0).toUpperCase() + mealName.slice(1), foods: foods.trim() }));
      const payload = { memberId, name: name.trim(), meals: mealList, startDate: startDate || null, endDate: endDate || null };
      if (editingPlanId) await API_CLIENT.put(`/diet-plans/${editingPlanId}`, payload);
      else await API_CLIENT.post('/diet-plans', payload);
      showToast(editingPlanId ? 'Diet plan updated.' : 'Diet plan assigned.', 'success');
      setEditingPlanId(''); setName(''); setMeals({ breakfast: '', lunch: '', dinner: '', snacks: '' }); setStartDate(today()); setEndDate('');
      await load();
    } catch (err: any) { showToast(err.response?.data?.message || 'Could not assign the diet plan.', 'error'); }
    finally { setSaving(false); }
  };
  const visiblePlans = plans.filter((plan) => {
    const start = String(plan.startDate || plan.createdAt || '').slice(0, 10);
    const end = String(plan.endDate || plan.startDate || plan.createdAt || '').slice(0, 10);
    return (!filterFrom || !end || end >= filterFrom) && (!filterTo || !start || start <= filterTo);
  });
  const editPlan = (plan: DietPlan) => {
    let parsed: any = plan.meals || [];
    if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch { parsed = []; } }
    const values = { breakfast: '', lunch: '', dinner: '', snacks: '' };
    if (Array.isArray(parsed)) parsed.forEach((meal: any) => {
      const key = String(meal.name || '').toLowerCase();
      if (key in values) values[key as keyof typeof values] = Array.isArray(meal.foods) ? meal.foods.join(', ') : String(meal.foods || meal.description || '');
    });
    setEditingPlanId(String(plan.id || plan._id)); setName(plan.name || ''); setMeals(values);
    setStartDate(String(plan.startDate || '').slice(0, 10)); setEndDate(String(plan.endDate || '').slice(0, 10));
  };
  return <ScreenContainer scrollable={false}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.member}><View style={styles.icon}><Apple size={18} color="#735B00" /></View><View><Text style={styles.kicker}>NUTRITION PLAN FOR</Text><Text style={styles.memberName}>{memberName}</Text></View></View>
    {loading ? <ActivityIndicator color={theme.colors.primaryText} style={{ marginVertical: 20 }} /> : null}
    <Text style={styles.section}>Assigned diet plans</Text>
    <View style={styles.filterCard}><Text style={styles.filterTitle}>Filter by plan dates</Text><View style={styles.row}><TextInput style={[styles.input, { flex: 1 }]} value={filterFrom} onChangeText={setFilterFrom} placeholder="From · YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted} /><TextInput style={[styles.input, { flex: 1 }]} value={filterTo} onChangeText={setFilterTo} placeholder="To · YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted} /></View></View>
    {visiblePlans.length ? visiblePlans.map((plan) => <TouchableOpacity key={String(plan.id || plan._id)} style={styles.planRow} onPress={() => editPlan(plan)}><View style={{ flex: 1 }}><Text style={styles.planName}>{plan.name}</Text><Text style={styles.planDates}>{String(plan.startDate || 'No start date').slice(0, 10)}  →  {String(plan.endDate || 'Ongoing').slice(0, 10)}</Text></View><Text style={styles.editLabel}>EDIT</Text></TouchableOpacity>) : <Text style={styles.empty}>No plans in this date range. Create one below.</Text>}
    <Text style={styles.section}>{editingPlanId ? 'Edit diet plan' : 'Create diet plan'}</Text>
    <Text style={styles.label}>Plan name *</Text><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Balanced weekday plan" placeholderTextColor={theme.colors.textMuted} />
    <View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.label}>Start date</Text><TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted} /></View><View style={{ flex: 1 }}><Text style={styles.label}>End date</Text><TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="Optional · YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted} /></View></View>
    <Text style={styles.section}>Meals</Text>
    {(['breakfast', 'lunch', 'dinner', 'snacks'] as const).map((key) => <View key={key} style={styles.mealCard}><View style={styles.mealTitle}><Utensils size={15} color="#735B00" /><Text style={styles.mealText}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text></View><TextInput style={[styles.input, styles.mealInput]} value={meals[key]} onChangeText={(value) => setMeals((current) => ({ ...current, [key]: value }))} placeholder="Foods and portion guidance" placeholderTextColor={theme.colors.textMuted} multiline /></View>)}
    <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>{saving ? <ActivityIndicator color="#171713" /> : <Text style={styles.saveText}>{editingPlanId ? 'Save diet changes' : 'Assign diet plan'}</Text>}</TouchableOpacity>
    {editingPlanId ? <TouchableOpacity style={styles.cancelButton} onPress={() => { setEditingPlanId(''); setName(''); setMeals({ breakfast: '', lunch: '', dinner: '', snacks: '' }); setStartDate(today()); setEndDate(''); }}><Text style={styles.cancelText}>Cancel editing</Text></TouchableOpacity> : null}
  </ScrollView></KeyboardAvoidingView></ScreenContainer>;
}
const styles = StyleSheet.create({ content: { gap: 10, paddingBottom: 28 }, member: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#FFFFFF' }, icon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF4B1' }, kicker: { color: theme.colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1 }, memberName: { marginTop: 3, color: theme.colors.text, fontSize: 14, fontWeight: '850' }, label: { marginTop: 4, marginBottom: 5, color: theme.colors.textSecondary, fontSize: 10, fontWeight: '800' }, input: { minHeight: 45, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 11, backgroundColor: '#FFFFFF', color: theme.colors.text, fontSize: 13 }, section: { marginTop: 8, color: theme.colors.text, fontSize: 15, fontWeight: '900' }, mealCard: { gap: 8, padding: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, backgroundColor: '#FFFFFF' }, mealTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 }, mealText: { color: theme.colors.text, fontWeight: '850', fontSize: 12 }, mealInput: { minHeight: 75, textAlignVertical: 'top', paddingTop: 11 }, saveButton: { minHeight: 49, alignItems: 'center', justifyContent: 'center', marginTop: 6, borderRadius: 13, backgroundColor: theme.colors.primary }, saveText: { color: '#171713', fontWeight: '900', fontSize: 13 }, row: { flexDirection: 'row', gap: 10 }, filterCard: { padding: 11, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#FFFFFF', gap: 8 }, filterTitle: { color: theme.colors.textSecondary, fontSize: 10, fontWeight: '800' }, planRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#FFFFFF', gap: 10 }, planName: { color: theme.colors.text, fontSize: 12, fontWeight: '850' }, planDates: { color: theme.colors.textMuted, fontSize: 10, marginTop: 4 }, editLabel: { color: '#735B00', fontSize: 9, fontWeight: '900' }, empty: { color: theme.colors.textMuted, fontSize: 11, padding: 12 }, cancelButton: { minHeight: 40, justifyContent: 'center', alignItems: 'center' }, cancelText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '800' } });

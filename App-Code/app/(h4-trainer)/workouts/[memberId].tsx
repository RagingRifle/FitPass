import React, { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Dumbbell, Plus, Trash2 } from '@/components/ui/app-icons';
import { API_CLIENT } from '@/lib/api-client';
import { theme } from '@/design-system/theme';
import { ScreenContainer } from '@/components/layout';
import { useToast } from '@/hooks/useToast';

type Exercise = { name: string; sets: string; reps: string };
type WorkoutPlan = { id?: string; _id?: string; name: string; startDate?: string | null; endDate?: string | null; createdAt?: string; exercises?: Exercise[] | string };
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
export default function TrainerWorkoutPlan() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const toast = useToast();
  const [memberName, setMemberName] = useState('Member');
  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([{ name: '', sets: '3', reps: '10' }]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
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
        API_CLIENT.get('/workout-plans', { params: { memberId, limit: 100 } })
      ]);
      setMemberName(memberRes.data.name || 'Member');
      setPlans(plansRes.data?.data || []);
    } catch {
      toast.show('Could not load this member’s workout plans.', 'error');
    } finally {
      setLoading(false);
    }
  }, [memberId, toast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const update = (index: number, key: keyof Exercise, value: string) => setExercises((items) => items.map((item, i) => i === index ? { ...item, [key]: value } : item));
  const save = async () => {
    const planName = name.trim();
    const rows = exercises.filter((item) => item.name.trim()).map((item) => ({ name: item.name.trim(), sets: Number(item.sets) || 3, reps: Number(item.reps) || 10 }));
    if (!planName || !rows.length) return toast.show('Enter a plan name and at least one exercise.', 'error');
    if (startDate && endDate && startDate > endDate) return toast.show('The end date must be after the start date.', 'error');
    setSaving(true);
    try {
      const payload = { memberId, name: planName, exercises: rows, startDate: startDate || null, endDate: endDate || null };
      if (editingPlanId) await API_CLIENT.put(`/workout-plans/${editingPlanId}`, payload);
      else await API_CLIENT.post('/workout-plans', payload);
      toast.show(editingPlanId ? 'Workout plan updated.' : 'Workout plan assigned.', 'success');
      setEditingPlanId(''); setName(''); setExercises([{ name: '', sets: '3', reps: '10' }]); setStartDate(today()); setEndDate('');
      await load();
    } catch (err: any) { toast.show(err.response?.data?.message || 'Could not assign the workout plan.', 'error'); }
    finally { setSaving(false); }
  };
  const visiblePlans = plans.filter((plan) => {
    const start = String(plan.startDate || plan.createdAt || '').slice(0, 10);
    const end = String(plan.endDate || plan.startDate || plan.createdAt || '').slice(0, 10);
    return (!filterFrom || !end || end >= filterFrom) && (!filterTo || !start || start <= filterTo);
  });
  const editPlan = (plan: WorkoutPlan) => {
    let parsed: any = plan.exercises || [];
    if (typeof parsed === 'string') { try { parsed = JSON.parse(parsed); } catch { parsed = []; } }
    setEditingPlanId(String(plan.id || plan._id)); setName(plan.name || ''); setExercises(Array.isArray(parsed) && parsed.length ? parsed.map((item: any) => ({ name: item.name || '', sets: String(item.sets || 3), reps: String(item.reps || 10) })) : [{ name: '', sets: '3', reps: '10' }]);
    setStartDate(String(plan.startDate || '').slice(0, 10)); setEndDate(String(plan.endDate || '').slice(0, 10));
  };
  return <ScreenContainer scrollable={false}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.member}><View style={styles.icon}><Dumbbell size={18} color="#735B00" /></View><View><Text style={styles.kicker}>WORKOUT FOR</Text><Text style={styles.memberName}>{memberName}</Text></View></View>
    {loading ? <ActivityIndicator color={theme.colors.primaryText} style={{ marginVertical: 20 }} /> : null}
    <Text style={styles.section}>Assigned workout plans</Text>
    <View style={styles.filterCard}><Text style={styles.filterTitle}>Filter by plan dates</Text><View style={styles.row}><TextInput style={[styles.input, { flex: 1 }]} value={filterFrom} onChangeText={setFilterFrom} placeholder="From · YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted} /><TextInput style={[styles.input, { flex: 1 }]} value={filterTo} onChangeText={setFilterTo} placeholder="To · YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted} /></View></View>
    {visiblePlans.length ? visiblePlans.map((plan) => <TouchableOpacity key={String(plan.id || plan._id)} style={styles.planRow} onPress={() => editPlan(plan)}><View style={{ flex: 1 }}><Text style={styles.planName}>{plan.name}</Text><Text style={styles.planDates}>{String(plan.startDate || 'No start date').slice(0, 10)}  →  {String(plan.endDate || 'Ongoing').slice(0, 10)}</Text></View><Text style={styles.editLabel}>EDIT</Text></TouchableOpacity>) : <Text style={styles.empty}>No plans in this date range. Create one below.</Text>}
    <Text style={styles.section}>{editingPlanId ? 'Edit workout plan' : 'Create workout plan'}</Text>
    <Text style={styles.label}>Plan name *</Text><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Beginner strength · 4 weeks" placeholderTextColor={theme.colors.textMuted} />
    <View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.label}>Start date</Text><TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted} /></View><View style={{ flex: 1 }}><Text style={styles.label}>End date</Text><TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="Optional · YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted} /></View></View>
    <Text style={styles.section}>Exercises</Text>
    {exercises.map((exercise, index) => <View key={index} style={styles.exerciseCard}><View style={styles.exerciseTop}><Text style={styles.exerciseTitle}>Exercise {index + 1}</Text>{exercises.length > 1 && <TouchableOpacity onPress={() => setExercises((items) => items.filter((_, i) => i !== index))}><Trash2 size={17} color={theme.colors.error} /></TouchableOpacity>}</View><TextInput style={styles.input} value={exercise.name} onChangeText={(value) => update(index, 'name', value)} placeholder="Exercise name" placeholderTextColor={theme.colors.textMuted} /><View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.label}>Sets</Text><TextInput style={styles.input} value={exercise.sets} onChangeText={(value) => update(index, 'sets', value)} keyboardType="number-pad" /></View><View style={{ flex: 1 }}><Text style={styles.label}>Reps</Text><TextInput style={styles.input} value={exercise.reps} onChangeText={(value) => update(index, 'reps', value)} keyboardType="number-pad" /></View></View></View>)}
    <TouchableOpacity style={styles.addButton} onPress={() => setExercises((items) => [...items, { name: '', sets: '3', reps: '10' }])}><Plus size={17} color="#514500" /><Text style={styles.addText}>Add exercise</Text></TouchableOpacity>
    <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>{saving ? <ActivityIndicator color="#171713" /> : <Text style={styles.saveText}>{editingPlanId ? 'Save workout changes' : 'Assign workout plan'}</Text>}</TouchableOpacity>
    {editingPlanId ? <TouchableOpacity style={styles.cancelButton} onPress={() => { setEditingPlanId(''); setName(''); setExercises([{ name: '', sets: '3', reps: '10' }]); setStartDate(today()); setEndDate(''); }}><Text style={styles.cancelText}>Cancel editing</Text></TouchableOpacity> : null}
  </ScrollView></KeyboardAvoidingView></ScreenContainer>;
}
const styles = StyleSheet.create({ content: { gap: 10, paddingBottom: 28 }, member: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#FFFFFF' }, icon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF4B1' }, kicker: { color: theme.colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1 }, memberName: { marginTop: 3, color: theme.colors.text, fontSize: 14, fontWeight: '850' }, label: { marginTop: 4, marginBottom: 5, color: theme.colors.textSecondary, fontSize: 10, fontWeight: '800' }, input: { minHeight: 45, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 11, backgroundColor: '#FFFFFF', color: theme.colors.text, fontSize: 13 }, section: { marginTop: 8, color: theme.colors.text, fontSize: 15, fontWeight: '900' }, exerciseCard: { gap: 9, padding: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, backgroundColor: '#FFFFFF' }, exerciseTop: { flexDirection: 'row', justifyContent: 'space-between' }, exerciseTitle: { color: theme.colors.text, fontWeight: '850', fontSize: 12 }, row: { flexDirection: 'row', gap: 10 }, addButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 11, borderWidth: 1, borderColor: '#E4D67C', backgroundColor: '#FFF9D9' }, addText: { color: '#514500', fontSize: 12, fontWeight: '800' }, saveButton: { minHeight: 49, alignItems: 'center', justifyContent: 'center', marginTop: 6, borderRadius: 13, backgroundColor: theme.colors.primary }, saveText: { color: '#171713', fontWeight: '900', fontSize: 13 }, filterCard: { padding: 11, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#FFFFFF', gap: 8 }, filterTitle: { color: theme.colors.textSecondary, fontSize: 10, fontWeight: '800' }, planRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#FFFFFF', gap: 10 }, planName: { color: theme.colors.text, fontSize: 12, fontWeight: '850' }, planDates: { color: theme.colors.textMuted, fontSize: 10, marginTop: 4 }, editLabel: { color: '#735B00', fontSize: 9, fontWeight: '900' }, empty: { color: theme.colors.textMuted, fontSize: 11, padding: 12 }, cancelButton: { minHeight: 40, justifyContent: 'center', alignItems: 'center' }, cancelText: { color: theme.colors.textSecondary, fontSize: 12, fontWeight: '800' } });

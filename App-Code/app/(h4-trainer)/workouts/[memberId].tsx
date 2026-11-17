import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Dumbbell, Plus, Trash2 } from '@/components/ui/app-icons';
import { API_CLIENT } from '@/lib/api-client';
import { theme } from '@/design-system/theme';
import { ScreenContainer } from '@/components/layout';
import { useToast } from '@/hooks/useToast';

type Exercise = { name: string; sets: string; reps: string };
export default function TrainerWorkoutPlan() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const router = useRouter();
  const toast = useToast();
  const [memberName, setMemberName] = useState('Member');
  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([{ name: '', sets: '3', reps: '10' }]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { API_CLIENT.get(`/members/${memberId}`).then(({ data }) => setMemberName(data.name || 'Member')).catch(() => {}); }, [memberId]);
  const update = (index: number, key: keyof Exercise, value: string) => setExercises((items) => items.map((item, i) => i === index ? { ...item, [key]: value } : item));
  const save = async () => {
    const planName = name.trim();
    const rows = exercises.filter((item) => item.name.trim()).map((item) => ({ name: item.name.trim(), sets: Number(item.sets) || 3, reps: Number(item.reps) || 10 }));
    if (!planName || !rows.length) return toast.show('Enter a plan name and at least one exercise.', 'error');
    setSaving(true);
    try {
      await API_CLIENT.post('/workout-plans', { memberId, name: planName, exercises: rows });
      toast.show('Workout plan assigned.', 'success');
      router.back();
    } catch (err: any) { toast.show(err.response?.data?.message || 'Could not assign the workout plan.', 'error'); }
    finally { setSaving(false); }
  };
  return <ScreenContainer scrollable={false}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.member}><View style={styles.icon}><Dumbbell size={18} color="#735B00" /></View><View><Text style={styles.kicker}>WORKOUT FOR</Text><Text style={styles.memberName}>{memberName}</Text></View></View>
    <Text style={styles.label}>Plan name *</Text><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Beginner strength · 4 weeks" placeholderTextColor={theme.colors.textMuted} />
    <Text style={styles.section}>Exercises</Text>
    {exercises.map((exercise, index) => <View key={index} style={styles.exerciseCard}><View style={styles.exerciseTop}><Text style={styles.exerciseTitle}>Exercise {index + 1}</Text>{exercises.length > 1 && <TouchableOpacity onPress={() => setExercises((items) => items.filter((_, i) => i !== index))}><Trash2 size={17} color={theme.colors.error} /></TouchableOpacity>}</View><TextInput style={styles.input} value={exercise.name} onChangeText={(value) => update(index, 'name', value)} placeholder="Exercise name" placeholderTextColor={theme.colors.textMuted} /><View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.label}>Sets</Text><TextInput style={styles.input} value={exercise.sets} onChangeText={(value) => update(index, 'sets', value)} keyboardType="number-pad" /></View><View style={{ flex: 1 }}><Text style={styles.label}>Reps</Text><TextInput style={styles.input} value={exercise.reps} onChangeText={(value) => update(index, 'reps', value)} keyboardType="number-pad" /></View></View></View>)}
    <TouchableOpacity style={styles.addButton} onPress={() => setExercises((items) => [...items, { name: '', sets: '3', reps: '10' }])}><Plus size={17} color="#514500" /><Text style={styles.addText}>Add exercise</Text></TouchableOpacity>
    <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>{saving ? <ActivityIndicator color="#171713" /> : <Text style={styles.saveText}>Assign workout plan</Text>}</TouchableOpacity>
  </ScrollView></ScreenContainer>;
}
const styles = StyleSheet.create({ content: { gap: 10, paddingBottom: 28 }, member: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#FFFFFF' }, icon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF4B1' }, kicker: { color: theme.colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1 }, memberName: { marginTop: 3, color: theme.colors.text, fontSize: 14, fontWeight: '850' }, label: { marginTop: 4, marginBottom: 5, color: theme.colors.textSecondary, fontSize: 10, fontWeight: '800' }, input: { minHeight: 45, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 11, backgroundColor: '#FFFFFF', color: theme.colors.text, fontSize: 13 }, section: { marginTop: 8, color: theme.colors.text, fontSize: 15, fontWeight: '900' }, exerciseCard: { gap: 9, padding: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, backgroundColor: '#FFFFFF' }, exerciseTop: { flexDirection: 'row', justifyContent: 'space-between' }, exerciseTitle: { color: theme.colors.text, fontWeight: '850', fontSize: 12 }, row: { flexDirection: 'row', gap: 10 }, addButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 11, borderWidth: 1, borderColor: '#E4D67C', backgroundColor: '#FFF9D9' }, addText: { color: '#514500', fontSize: 12, fontWeight: '800' }, saveButton: { minHeight: 49, alignItems: 'center', justifyContent: 'center', marginTop: 6, borderRadius: 13, backgroundColor: theme.colors.primary }, saveText: { color: '#171713', fontWeight: '900', fontSize: 13 } });

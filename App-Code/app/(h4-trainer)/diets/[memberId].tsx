import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Apple, Utensils } from '@/components/ui/app-icons';
import { API_CLIENT } from '@/lib/api-client';
import { theme } from '@/design-system/theme';
import { ScreenContainer } from '@/components/layout';
import { useToast } from '@/hooks/useToast';

export default function TrainerDietPlan() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const router = useRouter();
  const toast = useToast();
  const [memberName, setMemberName] = useState('Member');
  const [name, setName] = useState('');
  const [meals, setMeals] = useState({ breakfast: '', lunch: '', dinner: '', snacks: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => { API_CLIENT.get(`/members/${memberId}`).then(({ data }) => setMemberName(data.name || 'Member')).catch(() => {}); }, [memberId]);
  const save = async () => {
    if (!name.trim() || !Object.values(meals).some((value) => value.trim())) return toast.show('Add a plan name and at least one meal.', 'error');
    setSaving(true);
    try {
      const mealList = Object.entries(meals).filter(([, value]) => value.trim()).map(([mealName, foods]) => ({ name: mealName.charAt(0).toUpperCase() + mealName.slice(1), foods: foods.trim() }));
      await API_CLIENT.post('/diet-plans', { memberId, name: name.trim(), meals: mealList });
      toast.show('Diet plan assigned.', 'success');
      router.back();
    } catch (err: any) { toast.show(err.response?.data?.message || 'Could not assign the diet plan.', 'error'); }
    finally { setSaving(false); }
  };
  return <ScreenContainer scrollable={false}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.member}><View style={styles.icon}><Apple size={18} color="#735B00" /></View><View><Text style={styles.kicker}>NUTRITION PLAN FOR</Text><Text style={styles.memberName}>{memberName}</Text></View></View>
    <Text style={styles.label}>Plan name *</Text><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Balanced weekday plan" placeholderTextColor={theme.colors.textMuted} />
    <Text style={styles.section}>Meals</Text>
    {(['breakfast', 'lunch', 'dinner', 'snacks'] as const).map((key) => <View key={key} style={styles.mealCard}><View style={styles.mealTitle}><Utensils size={15} color="#735B00" /><Text style={styles.mealText}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text></View><TextInput style={[styles.input, styles.mealInput]} value={meals[key]} onChangeText={(value) => setMeals((current) => ({ ...current, [key]: value }))} placeholder="Foods and portion guidance" placeholderTextColor={theme.colors.textMuted} multiline /></View>)}
    <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>{saving ? <ActivityIndicator color="#171713" /> : <Text style={styles.saveText}>Assign diet plan</Text>}</TouchableOpacity>
  </ScrollView></ScreenContainer>;
}
const styles = StyleSheet.create({ content: { gap: 10, paddingBottom: 28 }, member: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#FFFFFF' }, icon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF4B1' }, kicker: { color: theme.colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1 }, memberName: { marginTop: 3, color: theme.colors.text, fontSize: 14, fontWeight: '850' }, label: { marginTop: 4, marginBottom: 5, color: theme.colors.textSecondary, fontSize: 10, fontWeight: '800' }, input: { minHeight: 45, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 11, backgroundColor: '#FFFFFF', color: theme.colors.text, fontSize: 13 }, section: { marginTop: 8, color: theme.colors.text, fontSize: 15, fontWeight: '900' }, mealCard: { gap: 8, padding: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, backgroundColor: '#FFFFFF' }, mealTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 }, mealText: { color: theme.colors.text, fontWeight: '850', fontSize: 12 }, mealInput: { minHeight: 75, textAlignVertical: 'top', paddingTop: 11 }, saveButton: { minHeight: 49, alignItems: 'center', justifyContent: 'center', marginTop: 6, borderRadius: 13, backgroundColor: theme.colors.primary }, saveText: { color: '#171713', fontWeight: '900', fontSize: 13 } });

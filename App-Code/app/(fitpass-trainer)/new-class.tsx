import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { API_CLIENT } from '@/lib/api-client';
import { ScreenContainer } from '@/components/layout';
import { theme } from '@/design-system/theme';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/features/auth/hooks/useAuth';

const categories = ['Personal Training', 'Yoga', 'Zumba', 'Pilates', 'Strength', 'Boxing', 'Dance', 'Mobility'];
export default function FitPassTrainerNewClass() {
  const router = useRouter();
  const toast = useToast();
  const user = useAuth((state) => state.user);
  const [name, setName] = useState('');
  const [type, setType] = useState(categories[0]);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [seats, setSeats] = useState('6');
  const [price, setPrice] = useState('30');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim() || !date || !startTime || !endTime || Number(seats) < 1 || Number(price) < 1) return toast.show('Enter a class name, valid time, seats and FitCoin price.', 'error');
    setSaving(true);
    try {
      await API_CLIENT.post('/classes', { name: name.trim(), type, description: description.trim(), trainerName: user?.name || '', scheduleDate: date, startTime, endTime, maxSeats: Number(seats), isAddOn: true, priceCoins: Number(price) });
      toast.show('Add-on session scheduled.', 'success');
      router.replace('/(fitpass-trainer)/dashboard');
    } catch (err: any) { toast.show(err.response?.data?.message || 'Could not schedule this session.', 'error'); }
    finally { setSaving(false); }
  };

  return <ScreenContainer scrollable={false} style={styles.screen}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.note}><Text style={styles.noteTitle}>Schedule for your branch</Text><Text style={styles.noteText}>Members see available seats and the FitCoin cost before reserving. Your manager controls whether you can schedule classes and set prices.</Text></View>
    <Field label="Session name *" value={name} onChangeText={setName} placeholder="e.g. 1:1 strength coaching" />
    <Text style={styles.label}>Class type</Text><View style={styles.categories}>{categories.map((item) => <TouchableOpacity key={item} onPress={() => setType(item)} style={[styles.category, type === item && styles.categoryActive]}><Text style={[styles.categoryText, type === item && styles.categoryTextActive]}>{item}</Text></TouchableOpacity>)}</View>
    <Field label="What members will do" value={description} onChangeText={setDescription} placeholder="Optional session details" multiline />
    <Field label="Date * (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-11-09" />
    <View style={styles.row}><View style={{ flex: 1 }}><Field label="Start * (HH:MM)" value={startTime} onChangeText={setStartTime} placeholder="09:00" /></View><View style={{ flex: 1 }}><Field label="End * (HH:MM)" value={endTime} onChangeText={setEndTime} placeholder="10:00" /></View></View>
    <View style={styles.row}><View style={{ flex: 1 }}><Field label="Seats *" value={seats} onChangeText={setSeats} keyboardType="number-pad" placeholder="6" /></View><View style={{ flex: 1 }}><Field label="FitCoins per person *" value={price} onChangeText={setPrice} keyboardType="number-pad" placeholder="30" /></View></View>
    <TouchableOpacity style={[styles.save, saving && { opacity: .7 }]} onPress={save} disabled={saving}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Publish class session</Text>}</TouchableOpacity>
  </ScrollView></ScreenContainer>;
}

function Field({ label, value, onChangeText, placeholder, keyboardType, multiline }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; keyboardType?: 'number-pad'; multiline?: boolean }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput style={[styles.input, multiline && { minHeight: 78, textAlignVertical: 'top' }]} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#918CA0" keyboardType={keyboardType || 'default'} multiline={multiline} /></View>; }

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#F5F3FB' }, content: { padding: 17, paddingBottom: 35, gap: 12 }, note: { padding: 13, borderRadius: 13, backgroundColor: '#EAE6FF' }, noteTitle: { color: '#4935A1', fontSize: 12, fontWeight: '900' }, noteText: { marginTop: 4, color: '#625A7E', fontSize: 10, lineHeight: 15 }, field: { gap: 6, flex: 1 }, label: { color: '#5F5A70', fontSize: 9, fontWeight: '900', letterSpacing: .45 }, input: { minHeight: 44, paddingHorizontal: 11, paddingVertical: 10, borderWidth: 1, borderColor: '#E0DCEC', borderRadius: 10, backgroundColor: '#FFFFFF', color: '#29253A', fontSize: 12 }, categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, category: { paddingHorizontal: 9, paddingVertical: 7, borderWidth: 1, borderColor: '#E0DCEC', borderRadius: 9, backgroundColor: '#FFFFFF' }, categoryActive: { borderColor: '#5140A0', backgroundColor: '#EFECFF' }, categoryText: { color: '#6C677B', fontSize: 9, fontWeight: '700' }, categoryTextActive: { color: '#5140A0', fontWeight: '900' }, row: { flexDirection: 'row', gap: 10 }, save: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 3, borderRadius: 12, backgroundColor: '#5140A0' }, saveText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' } });

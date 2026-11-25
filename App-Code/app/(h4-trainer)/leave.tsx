import React, { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { API_CLIENT } from '@/lib/api-client';
import { theme } from '@/design-system/theme';
import { ScreenContainer } from '@/components/layout';
import { useToast } from '@/hooks/useToast';

type LeaveRequest = { id: string; startDate: string; endDate: string; reason?: string | null; status: string; approvedStartDate?: string | null; approvedEndDate?: string | null; adminNote?: string | null };

const formatLocalDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const today = () => formatLocalDate(new Date());
const shiftDate = (iso: string, days: number) => {
  const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const base = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date();
  base.setDate(base.getDate() + days);
  return formatLocalDate(base);
};

export default function TrainerLeaveScreen() {
  const showToast = useToast((s) => s.show);
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [reason, setReason] = useState('');
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadRequests = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError('');
    try {
      const { data } = await API_CLIENT.get('/trainer-attendance/leave-requests');
      setRequests(Array.isArray(data) ? data : []);
    } catch (err: any) {
      const message = err.response?.data?.message || 'Could not load leave requests.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadRequests(); }, [loadRequests]));

  const applyPreset = (offsetDays: number, spanDays = 0) => {
    const start = shiftDate(today(), offsetDays);
    const end = shiftDate(start, spanDays);
    setStartDate(start);
    setEndDate(end);
  };

  const stepStart = (delta: number) => {
    const next = shiftDate(startDate, delta);
    setStartDate(next);
    if (next > endDate) setEndDate(next);
  };

  const stepEnd = (delta: number) => {
    const next = shiftDate(endDate, delta);
    setEndDate(next < startDate ? startDate : next);
  };

  const submit = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
      showToast('Enter valid YYYY-MM-DD dates with end date on or after start date.', 'error');
      return;
    }
    setSaving(true);
    try {
      await API_CLIENT.post('/trainer-attendance/leave-requests', { startDate, endDate, reason: reason.trim(), timezoneOffset: new Date().getTimezoneOffset() });
      setReason('');
      await loadRequests();
      showToast('Leave request sent to your branch admin.', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Could not send leave request.', 'error');
    } finally { setSaving(false); }
  };

  return <ScreenContainer scrollable={false} style={styles.screen}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadRequests(true)} tintColor={theme.colors.primaryText} />}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Request time off</Text>
          <Text style={styles.copy}>Choose the days you need. Your request stays pending until your branch admin reviews it.</Text>
          <View style={styles.presetRow}>
            <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(0, 0)}><Text style={styles.presetText}>Today</Text></TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(1, 0)}><Text style={styles.presetText}>Tomorrow</Text></TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(1, 1)}><Text style={styles.presetText}>2 days</Text></TouchableOpacity>
            <TouchableOpacity style={styles.presetChip} onPress={() => applyPreset(1, 6)}><Text style={styles.presetText}>1 week</Text></TouchableOpacity>
          </View>
          <Text style={styles.label}>From date</Text>
          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => stepStart(-1)}><Text style={styles.stepText}>-1d</Text></TouchableOpacity>
            <TextInput value={startDate} onChangeText={(value) => { setStartDate(value); if (value > endDate) setEndDate(value); }} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted} style={[styles.input, styles.dateInput]} autoCapitalize="none" />
            <TouchableOpacity style={styles.stepBtn} onPress={() => stepStart(1)}><Text style={styles.stepText}>+1d</Text></TouchableOpacity>
          </View>
          <Text style={styles.label}>Through date</Text>
          <View style={styles.dateRow}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => stepEnd(-1)}><Text style={styles.stepText}>-1d</Text></TouchableOpacity>
            <TextInput value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted} style={[styles.input, styles.dateInput]} autoCapitalize="none" />
            <TouchableOpacity style={styles.stepBtn} onPress={() => stepEnd(1)}><Text style={styles.stepText}>+1d</Text></TouchableOpacity>
          </View>
          <Text style={styles.label}>Reason (optional)</Text>
          <TextInput value={reason} onChangeText={setReason} placeholder="Add a note for your admin" placeholderTextColor={theme.colors.textMuted} style={[styles.input, styles.reason]} multiline maxLength={500} />
          <TouchableOpacity style={[styles.button, saving && { opacity: 0.65 }]} onPress={submit} disabled={saving} activeOpacity={0.8}>
            {saving ? <ActivityIndicator color="#171713" /> : <Text style={styles.buttonText}>Send leave request</Text>}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>My requests</Text>
        {!!error && <Text style={styles.errorText}>{error}</Text>}
        {loading ? <ActivityIndicator color={theme.colors.primaryText} style={{ marginTop: 20 }} /> : requests.length ? requests.map((request) => <View key={request.id} style={styles.requestCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.requestDates}>{request.startDate.slice(0, 10)} – {request.endDate.slice(0, 10)}</Text>
            {!!request.reason && <Text style={styles.requestReason}>{request.reason}</Text>}
            {request.status === 'Approved' && request.approvedStartDate && request.approvedEndDate && (request.approvedStartDate.slice(0, 10) !== request.startDate.slice(0, 10) || request.approvedEndDate.slice(0, 10) !== request.endDate.slice(0, 10)) && <Text style={styles.adminNote}>Approved dates: {request.approvedStartDate.slice(0, 10)} – {request.approvedEndDate.slice(0, 10)}</Text>}
            {!!request.adminNote && <Text style={styles.adminNote}>Admin note: {request.adminNote}</Text>}
          </View>
          <Text style={[styles.status, request.status === 'Approved' ? styles.approved : request.status === 'Rejected' ? styles.rejected : styles.pending]}>{request.status}</Text>
        </View>) : <Text style={styles.empty}>No leave requests yet.</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 18, paddingBottom: 40, gap: 12 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, padding: 16 },
  title: { color: theme.colors.text, fontWeight: '900', fontSize: 19 },
  copy: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 10 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 4 },
  presetChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, backgroundColor: '#FFF4B1' },
  presetText: { color: '#514500', fontSize: 11, fontWeight: '800' },
  label: { color: theme.colors.text, fontWeight: '700', fontSize: 12, marginTop: 10, marginBottom: 5 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateInput: { flex: 1 },
  stepBtn: { minHeight: 44, minWidth: 44, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#FAF8F2', alignItems: 'center', justifyContent: 'center' },
  stepText: { color: '#514500', fontWeight: '800', fontSize: 11 },
  input: { minHeight: 44, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 11, color: theme.colors.text, backgroundColor: '#FFFFFF' },
  reason: { minHeight: 78, paddingTop: 10, textAlignVertical: 'top' },
  button: { minHeight: 48, borderRadius: 12, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  buttonText: { color: '#171713', fontWeight: '900', fontSize: 13 },
  sectionTitle: { color: theme.colors.text, fontWeight: '900', fontSize: 17, marginTop: 8 },
  requestCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 13, backgroundColor: '#FFFFFF' },
  requestDates: { color: theme.colors.text, fontWeight: '800', fontSize: 13 },
  requestReason: { color: theme.colors.textSecondary, fontSize: 11, marginTop: 4 },
  adminNote: { color: theme.colors.textSecondary, fontSize: 11, marginTop: 5 },
  status: { fontSize: 10, fontWeight: '900', overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99 },
  pending: { color: '#8A5A00', backgroundColor: '#FFF4CF' },
  approved: { color: '#166534', backgroundColor: '#DCFCE7' },
  rejected: { color: '#991B1B', backgroundColor: '#FEE2E2' },
  empty: { color: theme.colors.textSecondary, textAlign: 'center', paddingVertical: 22, fontSize: 12 },
  errorText: { color: theme.colors.error, fontSize: 12, padding: 12, borderRadius: 10, backgroundColor: '#FFF1ED' },
});

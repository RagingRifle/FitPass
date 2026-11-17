import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { API_CLIENT } from '@/lib/api-client';
import { theme } from '@/design-system/theme';
import { ScreenContainer } from '@/components/layout';

type LeaveRequest = { id: string; startDate: string; endDate: string; reason?: string | null; status: string; approvedStartDate?: string | null; approvedEndDate?: string | null; adminNote?: string | null };

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export default function TrainerLeaveScreen() {
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [reason, setReason] = useState('');
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadRequests = useCallback(async () => {
    try {
      const { data } = await API_CLIENT.get('/trainer-attendance/leave-requests');
      setRequests(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Could not load requests', error.response?.data?.message || 'Please try again.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const submit = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
      Alert.alert('Check the dates', 'Enter dates as YYYY-MM-DD and make sure the end date is not before the start date.');
      return;
    }
    setSaving(true);
    try {
      await API_CLIENT.post('/trainer-attendance/leave-requests', { startDate, endDate, reason: reason.trim(), timezoneOffset: new Date().getTimezoneOffset() });
      setReason('');
      await loadRequests();
      Alert.alert('Request sent', 'Your branch admin can now review your requested dates.');
    } catch (error: any) {
      Alert.alert('Could not send request', error.response?.data?.message || 'Please try again.');
    } finally { setSaving(false); }
  };

  return <ScreenContainer scrollable={false} style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.title}>Request time off</Text>
        <Text style={styles.copy}>Choose the days you need. Your request stays pending until your branch admin reviews it.</Text>
        <Text style={styles.label}>From date</Text>
        <TextInput value={startDate} onChangeText={(value) => { setStartDate(value); if (value > endDate) setEndDate(value); }} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted} style={styles.input} autoCapitalize="none" />
        <Text style={styles.label}>Through date</Text>
        <TextInput value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted} style={styles.input} autoCapitalize="none" />
        <Text style={styles.label}>Reason (optional)</Text>
        <TextInput value={reason} onChangeText={setReason} placeholder="Add a note for your admin" placeholderTextColor={theme.colors.textMuted} style={[styles.input, styles.reason]} multiline maxLength={500} />
        <TouchableOpacity style={[styles.button, saving && { opacity: 0.65 }]} onPress={submit} disabled={saving} activeOpacity={0.8}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Send leave request</Text>}
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>My requests</Text>
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
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 18, paddingBottom: 36, gap: 12 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, padding: 16 },
  title: { color: theme.colors.text, fontWeight: '900', fontSize: 19 },
  copy: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: 14 },
  label: { color: theme.colors.text, fontWeight: '700', fontSize: 12, marginTop: 10, marginBottom: 5 },
  input: { minHeight: 44, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 11, color: theme.colors.text, backgroundColor: '#FFFFFF' },
  reason: { minHeight: 78, paddingTop: 10, textAlignVertical: 'top' },
  button: { minHeight: 46, borderRadius: 11, backgroundColor: theme.colors.primaryText, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
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
});

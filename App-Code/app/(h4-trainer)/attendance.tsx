import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CalendarCheck, ChevronRight, Clock, SlidersHorizontal } from '@/components/ui/app-icons';
import { API_CLIENT } from '@/lib/api-client';
import { theme } from '@/design-system/theme';
import { ScreenContainer } from '@/components/layout';

const day = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function TrainerAttendance() {
  const router = useRouter();
  const now = new Date();
  const [from, setFrom] = useState(day(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(day(now));
  const [appliedDates, setAppliedDates] = useState({ from: day(new Date(now.getFullYear(), now.getMonth(), 1)), to: day(now) });
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data } = await API_CLIENT.get('/trainer-attendance', { params: { ...appliedDates, timezoneOffset: new Date().getTimezoneOffset(), limit: 100 } });
      setLogs(Array.isArray(data?.data) ? data.data : []);
    } catch (err: any) { setError(err.response?.data?.message || 'Could not load attendance records.'); }
    finally { setLoading(false); }
  }, [appliedDates]);
  useEffect(() => { load(); }, [load]);

  const totalHours = logs.reduce((sum, log) => sum + Number(log.workingHours || 0), 0);
  return <ScreenContainer scrollable={false} style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.heading}><Text style={styles.eyebrow}>TIME & PRESENCE</Text><Text style={styles.title}>My attendance</Text><Text style={styles.subtitle}>Review your shifts and recorded hours.</Text></View>
    <View style={styles.summaryRow}><Summary label="Shifts" value={logs.length} /><Summary label="Hours" value={totalHours.toFixed(1)} /><Summary label="Period" value="Selected" /></View>
    <View style={styles.filterCard}><View style={styles.filterTitle}><SlidersHorizontal size={15} color="#735B00" /><Text style={styles.filterLabel}>Filter dates</Text></View><View style={styles.fields}><View style={{ flex: 1 }}><Text style={styles.fieldLabel}>FROM</Text><TextInput value={from} onChangeText={setFrom} style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="#989487" /></View><View style={{ flex: 1 }}><Text style={styles.fieldLabel}>TO</Text><TextInput value={to} onChangeText={setTo} style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="#989487" /></View></View><TouchableOpacity style={styles.apply} onPress={() => setAppliedDates({ from, to })}><Text style={styles.applyText}>Apply dates</Text></TouchableOpacity></View>
    <TouchableOpacity style={styles.leaveLink} onPress={() => router.push('/(h4-trainer)/leave' as any)}><View style={styles.leaveIcon}><CalendarCheck size={16} color="#735B00" /></View><Text style={styles.leaveText}>Leave requests</Text><ChevronRight size={17} color="#898579" /></TouchableOpacity>
    <Text style={styles.section}>Shift history</Text>
    {loading ? <ActivityIndicator color="#735B00" style={{ marginTop: 20 }} /> : error ? <Text style={styles.error}>{error}</Text> : logs.length ? logs.map(log => <View key={String(log.id || log._id)} style={styles.logCard}>
      <View style={styles.logIcon}><Clock size={17} color="#735B00" /></View><View style={{ flex: 1 }}>
        <Text style={styles.logDate}>{new Date(log.date || log.checkInTime).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
        <Text style={styles.logTime}>In {log.checkInTime ? new Date(log.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}  ·  Out {log.checkOutTime ? new Date(log.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</Text>
      </View><View style={styles.duration}><Text style={styles.durationValue}>{log.workingHours ? `${log.workingHours}h` : '—'}</Text><Text style={styles.durationLabel}>{log.status || 'Present'}</Text></View>
    </View>) : <View style={styles.empty}><Clock size={22} color="#AAA69A" /><Text style={styles.emptyText}>No shifts recorded for these dates.</Text></View>}
  </ScrollView></ScreenContainer>;
}

function Summary({ label, value }: { label: string; value: string | number }) { return <View style={styles.summary}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#F5F3ED' }, content: { padding: 17, paddingBottom: 34, gap: 12 }, heading: { marginBottom: 2 }, eyebrow: { color: '#938043', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, title: { color: '#24231E', fontSize: 25, fontWeight: '900', marginTop: 5 }, subtitle: { color: '#77746A', fontSize: 11, marginTop: 4 },
  summaryRow: { flexDirection: 'row', gap: 8 }, summary: { flex: 1, minHeight: 72, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9E6DE' }, summaryValue: { color: '#29271F', fontSize: 20, fontWeight: '900' }, summaryLabel: { color: '#898579', fontSize: 9, marginTop: 3 },
  filterCard: { padding: 13, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9E6DE', gap: 10 }, filterTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 }, filterLabel: { color: '#38362E', fontSize: 11, fontWeight: '850' }, fields: { flexDirection: 'row', gap: 9 }, fieldLabel: { color: '#938043', fontSize: 8, fontWeight: '900', marginBottom: 5 }, input: { minHeight: 40, paddingHorizontal: 9, borderWidth: 1, borderColor: '#E4E1D8', borderRadius: 10, color: '#29271F', backgroundColor: '#FFFDF8', fontSize: 10 }, apply: { minHeight: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: '#F8DF4B' }, applyText: { color: '#28271F', fontSize: 10, fontWeight: '900' },
  leaveLink: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 46, paddingHorizontal: 11, borderRadius: 13, borderWidth: 1, borderColor: '#E9E6DE', backgroundColor: '#FFFFFF' }, leaveIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#FFF4B1' }, leaveText: { flex: 1, color: '#39372F', fontSize: 11, fontWeight: '800' },
  section: { color: '#29271F', fontSize: 15, fontWeight: '900', marginTop: 4 }, logCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#E9E6DE', backgroundColor: '#FFFFFF' }, logIcon: { width: 35, height: 35, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#FFF4B1' }, logDate: { color: '#29271F', fontSize: 11, fontWeight: '850' }, logTime: { color: '#77746A', fontSize: 9, marginTop: 4 }, duration: { alignItems: 'flex-end' }, durationValue: { color: '#29271F', fontSize: 13, fontWeight: '900' }, durationLabel: { color: '#898579', fontSize: 8, marginTop: 3 }, empty: { minHeight: 100, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: '#FFFFFF' }, emptyText: { color: '#77746A', fontSize: 11 }, error: { color: theme.colors.error, fontSize: 11, padding: 12, borderRadius: 10, backgroundColor: '#FFF1ED' }
});

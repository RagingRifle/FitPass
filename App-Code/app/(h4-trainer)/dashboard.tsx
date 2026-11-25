import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, CalendarCheck, LogOut, Sparkles } from '@/components/ui/app-icons';
import { API_CLIENT } from '@/lib/api-client';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { theme } from '@/design-system/theme';
import { ScreenContainer } from '@/components/layout';

const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function H4TrainerHome() {
  const router = useRouter();
  const user = useAuth((state) => state.user);
  const logout = useAuth((state) => state.logout);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const date = localDate();
      const { data } = await API_CLIENT.get('/trainer-attendance', { params: { from: date, to: date, timezoneOffset: new Date().getTimezoneOffset(), limit: 100 } });
      const logs = Array.isArray(data?.data) ? data.data : [];
      setTodayAttendance(logs.find((log: any) => log.status === 'Present') || null);
    } catch {
      setTodayAttendance(null);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const signOut = () => Alert.alert('Sign out', 'Sign out of the H4 Trainer app?', [
    { text: 'Stay signed in', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login' as any); } }
  ]);

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const todayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return <ScreenContainer scrollable={false} style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.colors.primaryText} />}>
      <View style={styles.topline}><View><Text style={styles.eyebrow}>H4 TRAINER</Text><Text style={styles.date}>{todayLabel}</Text></View><TouchableOpacity style={styles.signOut} onPress={signOut} accessibilityLabel="Sign out"><LogOut size={17} color="#514500" /><Text style={styles.signOutText}>Sign out</Text></TouchableOpacity></View>
      <View style={styles.greetingCard}>
        <View style={styles.greetingIcon}><Sparkles size={18} color="#594B00" /></View>
        <Text style={styles.greeting}>{greeting},</Text>
        <Text style={styles.name}>{user?.name?.split(' ')[0] || 'Coach'}.</Text>
        <Text style={styles.copy}>Here’s your H4 coaching desk for today.</Text>
      </View>

      <View style={[styles.attendanceCard, todayAttendance && styles.attendanceCardChecked]}>
        <View style={[styles.attendanceIcon, todayAttendance && styles.attendanceIconChecked]}><CalendarCheck size={21} color={todayAttendance ? '#167046' : '#735B00'} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.attendanceEyebrow}>TODAY’S ATTENDANCE</Text>
          {loading ? <ActivityIndicator color={theme.colors.primaryText} style={{ alignSelf: 'flex-start', marginTop: 7 }} /> : <>
            <Text style={styles.attendanceTitle}>{todayAttendance ? 'You’ve checked in today' : 'You’re yet to check in today'}</Text>
            <Text style={styles.attendanceCopy}>{todayAttendance?.checkInTime ? `Started at ${new Date(todayAttendance.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${todayAttendance.checkOutTime ? ` · finished ${new Date(todayAttendance.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}` : 'Your attendance record will appear here.'}</Text>
          </>}
        </View>
        <View style={[styles.statusDot, todayAttendance && styles.statusDotChecked]} />
      </View>

      <View style={styles.nextCard}>
        <Text style={styles.nextEyebrow}>YOUR WORKSPACE</Text>
        <Text style={styles.nextTitle}>Ready for your coaching day?</Text>
        <Text style={styles.nextCopy}>Open your roster, review member plans, or check your sales performance from the tabs below.</Text>
        <TouchableOpacity
          style={styles.notificationsLink}
          onPress={() => router.push('/(h4-trainer)/notifications' as any)}
          accessibilityRole="button"
          accessibilityLabel="Open notifications"
        >
          <Bell size={16} color="#514500" />
          <Text style={styles.notificationsLinkText}>Open notifications</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F3ED' },
  content: { padding: 20, paddingBottom: 32, gap: 15 },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  eyebrow: { color: '#8B7A39', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  date: { color: '#777263', fontSize: 11, marginTop: 4, fontWeight: '600' },
  signOut: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, borderRadius: 12, borderWidth: 1, borderColor: '#E4DFC9', backgroundColor: '#FFFDF5' },
  signOutText: { color: '#514500', fontSize: 10, fontWeight: '800' },
  greetingCard: { padding: 21, borderRadius: 22, backgroundColor: '#171713', overflow: 'hidden' },
  greetingIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#F8DF4B', marginBottom: 22 },
  greeting: { color: '#D4CFBF', fontSize: 17, fontWeight: '600' },
  name: { color: '#FFFDF5', fontSize: 31, fontWeight: '900', letterSpacing: -.5, marginTop: 1 },
  copy: { color: '#B5B1A5', fontSize: 12, lineHeight: 18, marginTop: 10 },
  attendanceCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 17, borderWidth: 1, borderColor: '#E7D89A', backgroundColor: '#FFF9DC' },
  attendanceCardChecked: { borderColor: '#CFE5D7', backgroundColor: '#F0FAF3' },
  attendanceIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#FFF0A7' },
  attendanceIconChecked: { backgroundColor: '#D9F1E1' },
  attendanceEyebrow: { color: '#887324', fontSize: 8, fontWeight: '900', letterSpacing: .9 },
  attendanceTitle: { color: '#28271F', fontSize: 13, fontWeight: '850', marginTop: 5 },
  attendanceCopy: { color: '#777263', fontSize: 10, marginTop: 4 },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#D29A2E' },
  statusDotChecked: { backgroundColor: '#25945C' },
  nextCard: { padding: 17, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9E6DE' },
  nextEyebrow: { color: '#9B8841', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  nextTitle: { color: '#26251F', fontSize: 15, fontWeight: '850', marginTop: 8 },
  nextCopy: { color: '#77746A', fontSize: 11, lineHeight: 17, marginTop: 5 },
  notificationsLink: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginTop: 14, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 11, backgroundColor: '#FFF4BC' },
  notificationsLinkText: { color: '#514500', fontSize: 11, fontWeight: '800' },
});

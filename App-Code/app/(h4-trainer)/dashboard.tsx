import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Search, Users, ChevronRight, Dumbbell, CalendarCheck, Clock, LogIn, LogOut } from '@/components/ui/app-icons';
import { API_CLIENT } from '@/lib/api-client';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { theme } from '@/design-system/theme';
import { ScreenContainer } from '@/components/layout';

type AssignedMember = { id?: string; _id?: string; name: string; phone?: string; email?: string; registrationNumber?: string; heightCm?: number | null; branchName?: string | null; status?: string };

export default function H4TrainerDashboard() {
  const router = useRouter();
  const user = useAuth((state) => state.user);
  const [members, setMembers] = useState<AssignedMember[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeShift, setActiveShift] = useState<any>(null);
  const [attendanceBusy, setAttendanceBusy] = useState(false);

  const today = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const loadAttendance = useCallback(async () => {
    try {
      const { data } = await API_CLIENT.get('/trainer-attendance', { params: { from: today(), to: today(), timezoneOffset: new Date().getTimezoneOffset(), limit: 100 } });
      const logs = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      setActiveShift(logs.find((log: any) => !log.checkOutTime && log.status !== 'Leave') || null);
    } catch (err: any) {
      Alert.alert('Attendance unavailable', err.response?.data?.message || 'Could not load your duty status.');
    }
  }, []);

  const toggleAttendance = async () => {
    setAttendanceBusy(true);
    try {
      const { data } = await API_CLIENT.post(`/trainer-attendance/${activeShift ? 'checkout' : 'checkin'}`);
      if (activeShift) setActiveShift(null);
      else setActiveShift(data);
    } catch (err: any) {
      Alert.alert(activeShift ? 'Could not clock out' : 'Could not clock in', err.response?.data?.message || 'Please try again.');
    } finally { setAttendanceBusy(false); }
  };

  const loadMembers = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const { data } = await API_CLIENT.get('/members', { params: { page: 1, limit: 100 } });
      setMembers(Array.isArray(data?.members) ? data.members : []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not load your assigned members.');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadMembers(); loadAttendance(); }, [loadMembers, loadAttendance]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) => [member.name, member.phone, member.registrationNumber].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [members, search]);

  return (
    <ScreenContainer scrollable={false} style={styles.screen}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id || item._id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadMembers(true)} tintColor={theme.colors.primaryText} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<>
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeTop}><View><Text style={styles.eyebrow}>H4 TRAINER WORKSPACE</Text><Text style={styles.greeting}>Good work, {user?.name?.split(' ')[0] || 'Coach'}</Text></View><View style={styles.iconBadge}><Dumbbell size={21} color="#735B00" /></View></View>
            <Text style={styles.welcomeCopy}>Your assigned members and coaching tools, together in one place.</Text>
            <View style={styles.countRow}><View style={styles.countIcon}><Users size={16} color="#735B00" /></View><Text style={styles.countText}><Text style={styles.countNumber}>{members.length}</Text> assigned {members.length === 1 ? 'member' : 'members'}</Text></View>
          </View>
          <View style={styles.attendanceCard}>
            <View style={styles.attendanceTop}>
              <View style={styles.attendanceIcon}><Clock size={17} color={activeShift ? '#14633D' : '#735B00'} /></View>
              <View style={{ flex: 1 }}><Text style={styles.attendanceTitle}>{activeShift ? 'You are on duty' : 'Duty attendance'}</Text><Text style={styles.attendanceCopy}>{activeShift?.checkInTime ? `Clocked in ${new Date(activeShift.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Record your shift start and finish'}</Text></View>
              <View style={[styles.shiftBadge, activeShift && styles.shiftBadgeActive]}><Text style={[styles.shiftBadgeText, activeShift && styles.shiftBadgeTextActive]}>{activeShift ? 'ON SHIFT' : 'OFF SHIFT'}</Text></View>
            </View>
            <TouchableOpacity style={[styles.shiftButton, activeShift && styles.shiftButtonOut, attendanceBusy && { opacity: .65 }]} onPress={toggleAttendance} disabled={attendanceBusy} activeOpacity={.82}>
              {attendanceBusy ? <ActivityIndicator color={activeShift ? '#FFFFFF' : '#171713'} /> : <><View style={styles.shiftButtonIcon}>{activeShift ? <LogOut size={17} color="#FFFFFF" /> : <LogIn size={17} color="#171713" />}</View><Text style={[styles.shiftButtonText, activeShift && { color: '#FFFFFF' }]}>{activeShift ? 'Clock out' : 'Clock in'}</Text></>}
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.leaveLink} activeOpacity={0.8} onPress={() => router.push('/(h4-trainer)/leave' as any)}>
            <View style={styles.leaveIcon}><CalendarCheck size={18} color="#735B00" /></View>
            <View style={{ flex: 1 }}><Text style={styles.leaveTitle}>Request time off</Text><Text style={styles.leaveCopy}>Send dates to your branch admin and follow the status.</Text></View>
            <ChevronRight size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
          <Text style={styles.sectionTitle}>Your members</Text>
          <View style={styles.searchBox}><Search size={18} color={theme.colors.textMuted} /><TextInput value={search} onChangeText={setSearch} placeholder="Search name, phone, or member ID" placeholderTextColor={theme.colors.textMuted} style={styles.searchInput} returnKeyType="search" /></View>
          {loading && <ActivityIndicator color={theme.colors.primaryText} style={{ marginTop: 28 }} />}
          {!!error && <Text style={styles.error}>{error}</Text>}
          {!loading && !error && filtered.length === 0 && <View style={styles.empty}><Users size={24} color={theme.colors.textMuted} /><Text style={styles.emptyTitle}>{members.length ? 'No matching members' : 'No members assigned yet'}</Text><Text style={styles.emptyCopy}>{members.length ? 'Try another name or member ID.' : 'Ask your branch admin to assign members to your trainer account.'}</Text></View>}
        </>}
        renderItem={({ item }) => {
          const id = String(item.id || item._id);
          return <TouchableOpacity style={styles.memberCard} activeOpacity={0.78} onPress={() => router.push(`/(h4-trainer)/members/${id}` as any)}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{item.name?.trim()?.charAt(0)?.toUpperCase() || 'M'}</Text></View>
            <View style={styles.memberInfo}><Text style={styles.memberName}>{item.name}</Text><Text style={styles.memberMeta}>{item.registrationNumber || 'H4 member'}{item.phone ? `  ·  ${item.phone}` : ''}</Text><Text style={styles.memberHeight}>{item.heightCm ? `Height baseline ${item.heightCm} cm` : 'Height baseline needed at first assessment'}</Text></View>
            <ChevronRight size={19} color={theme.colors.textMuted} />
          </TouchableOpacity>;
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 18, paddingBottom: 38, gap: 12 },
  welcomeCard: { padding: 20, borderRadius: 22, backgroundColor: '#171713', marginBottom: 12 },
  welcomeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: '#D5C467', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  greeting: { marginTop: 7, color: '#FFFDF5', fontSize: 24, fontWeight: '900', letterSpacing: -.4 },
  iconBadge: { width: 42, height: 42, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  welcomeCopy: { color: '#C6C2B6', fontSize: 12, lineHeight: 18, marginTop: 12 },
  countRow: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 11, backgroundColor: '#2A2922', marginTop: 16, paddingHorizontal: 11, paddingVertical: 8 },
  countIcon: { width: 25, height: 25, borderRadius: 8, backgroundColor: '#FFF3A6', alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#E9E5D8', fontSize: 12, fontWeight: '600' }, countNumber: { color: '#FFFDF5', fontSize: 14, fontWeight: '900' },
  leaveLink: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, marginBottom: 8, borderRadius: 15, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#FFFFFF' },
  attendanceCard: { padding: 14, marginBottom: 4, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#FFFFFF', gap: 12 },
  attendanceTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  attendanceIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#FFF4B1', alignItems: 'center', justifyContent: 'center' },
  attendanceTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '850' }, attendanceCopy: { marginTop: 3, color: theme.colors.textSecondary, fontSize: 10 },
  shiftBadge: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 99, backgroundColor: '#F2F0E8' }, shiftBadgeActive: { backgroundColor: '#E4F5EA' }, shiftBadgeText: { color: '#756A43', fontSize: 8, fontWeight: '900', letterSpacing: .5 }, shiftBadgeTextActive: { color: '#14633D' },
  shiftButton: { minHeight: 43, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 11, backgroundColor: theme.colors.primary }, shiftButtonOut: { backgroundColor: '#171713' }, shiftButtonIcon: { alignItems: 'center', justifyContent: 'center' }, shiftButtonText: { color: '#171713', fontSize: 12, fontWeight: '900' },
  leaveIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF4B1' },
  leaveTitle: { color: theme.colors.text, fontWeight: '800', fontSize: 13 },
  leaveCopy: { color: theme.colors.textSecondary, fontSize: 11, marginTop: 3 },
  sectionTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '900', marginTop: 4 },
  searchBox: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 13, backgroundColor: '#FFFFFF', paddingHorizontal: 13, marginBottom: 2 },
  searchInput: { flex: 1, minWidth: 0, color: theme.colors.text, fontSize: 13, paddingVertical: 11 },
  memberCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 15, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#FFFFFF' },
  avatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#FFF4B1', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#594B00', fontWeight: '900', fontSize: 17 },
  memberInfo: { flex: 1, gap: 3 }, memberName: { color: theme.colors.text, fontWeight: '800', fontSize: 14 }, memberMeta: { color: theme.colors.textSecondary, fontSize: 11 }, memberHeight: { color: theme.colors.textMuted, fontSize: 10, marginTop: 2 },
  empty: { alignItems: 'center', padding: 26, gap: 8, borderRadius: 15, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#FFFFFF' }, emptyTitle: { color: theme.colors.text, fontWeight: '800', fontSize: 14 }, emptyCopy: { color: theme.colors.textSecondary, textAlign: 'center', fontSize: 12, lineHeight: 18 },
  error: { color: theme.colors.error, fontSize: 12, padding: 12, backgroundColor: '#FFF1ED', borderRadius: 10 },
});

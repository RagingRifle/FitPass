import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Calendar, ChevronRight, Coins, Plus, Users } from '@/components/ui/app-icons';
import { API_CLIENT } from '@/lib/api-client';
import { theme } from '@/design-system/theme';
import { ScreenContainer } from '@/components/layout';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

type Session = { id?: string; _id?: string; name: string; type: string; scheduleDate: string; startTime: string; endTime: string; seatsAvailable: number; maxSeats: number; priceCoins?: number; isAddOn?: boolean };

export default function FitPassTrainerDashboard() {
  const router = useRouter();
  const toast = useToast();
  const user = useAuth((state) => state.user);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async (pull = false) => {
    pull ? setRefreshing(true) : setLoading(true);
    try {
      const { data } = await API_CLIENT.get('/classes', { params: { isAddOn: true } });
      setSessions(Array.isArray(data) ? data : []);
    } catch (err: any) { toast.show(err.response?.data?.message || 'Could not load your class schedule.', 'error'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [toast]);
  useEffect(() => { load(); }, [load]);

  return <ScreenContainer scrollable={false} style={styles.screen}>
    <FlatList data={sessions} keyExtractor={(item) => String(item.id || item._id)} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#5140A0" />} contentContainerStyle={styles.content} ListHeaderComponent={<>
      <View style={styles.hero}><Text style={styles.eyebrow}>FITPASS PARTNER · TRAINER WORKSPACE</Text><Text style={styles.greeting}>Your class floor, {user?.name?.split(' ')[0] || 'Coach'}</Text><Text style={styles.heroCopy}>Schedule coach-led add-ons, check your roster and mark attendance.</Text><View style={styles.permissionNote}><Coins size={15} color="#E4C84E" /><Text style={styles.permissionText}>Coin pricing and class tools follow your branch manager’s permissions.</Text></View></View>
      <TouchableOpacity style={styles.create} onPress={() => router.push('/(fitpass-trainer)/new-class')}><View style={styles.createIcon}><Plus size={19} color="#FFFFFF" /></View><View style={{ flex: 1 }}><Text style={styles.createTitle}>Schedule a paid session</Text><Text style={styles.createCopy}>Set the time, capacity and FitCoin price.</Text></View><ChevronRight size={18} color="#5140A0" /></TouchableOpacity>
      <Text style={styles.section}>Upcoming add-on sessions</Text>
      {loading && <ActivityIndicator color="#5140A0" style={{ marginTop: 25 }} />}
      {!loading && sessions.length === 0 && <View style={styles.empty}><Calendar size={24} color="#5140A0" /><Text style={styles.emptyTitle}>No sessions scheduled</Text><Text style={styles.emptyCopy}>Create a class session for your branch or ask your manager to enable scheduling.</Text></View>}
    </>} renderItem={({ item }) => <TouchableOpacity style={styles.session} onPress={() => router.push(`/(fitpass-trainer)/roster/${item.id || item._id}` as any)}><View style={styles.sessionTop}><View style={styles.type}><Text style={styles.typeText}>{item.type}</Text></View><View style={styles.price}><Coins size={13} color="#5140A0" /><Text style={styles.priceText}>{item.priceCoins || 0}</Text></View></View><Text style={styles.sessionName}>{item.name}</Text><Text style={styles.date}>{new Date(item.scheduleDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · {item.startTime}–{item.endTime}</Text><View style={styles.sessionFoot}><View style={styles.meta}><Users size={13} color="#716C80" /><Text style={styles.metaText}>{item.maxSeats - item.seatsAvailable}/{item.maxSeats} booked</Text></View><View style={styles.roster}><Text style={styles.rosterText}>Open roster</Text><ChevronRight size={14} color="#5140A0" /></View></View></TouchableOpacity>} />
  </ScreenContainer>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#F5F3FB' }, content: { padding: 17, paddingBottom: 35, gap: 11 }, hero: { padding: 19, borderRadius: 19, backgroundColor: '#241C50' }, eyebrow: { color: '#C8C1F3', fontSize: 8, letterSpacing: 1.1, fontWeight: '900' }, greeting: { marginTop: 9, color: '#FFFFFF', fontSize: 22, fontWeight: '900' }, heroCopy: { marginTop: 6, color: '#D1CDE4', fontSize: 11, lineHeight: 17 }, permissionNote: { flexDirection: 'row', gap: 7, marginTop: 14, padding: 10, borderRadius: 10, backgroundColor: '#342B69' }, permissionText: { flex: 1, color: '#EEE9FF', fontSize: 9, lineHeight: 14 }, create: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DED9EF' }, createIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#5140A0' }, createTitle: { color: '#28243A', fontSize: 12, fontWeight: '900' }, createCopy: { marginTop: 3, color: '#817B90', fontSize: 9 }, section: { marginTop: 8, color: '#29253A', fontSize: 16, fontWeight: '900' }, empty: { alignItems: 'center', gap: 7, padding: 22, borderRadius: 15, backgroundColor: '#FFFFFF' }, emptyTitle: { color: '#29253A', fontSize: 13, fontWeight: '900' }, emptyCopy: { color: '#817B90', textAlign: 'center', fontSize: 10, lineHeight: 16 }, session: { padding: 14, borderRadius: 15, borderWidth: 1, borderColor: '#E2DEEF', backgroundColor: '#FFFFFF' }, sessionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, type: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, backgroundColor: '#EFECFF' }, typeText: { color: '#5140A0', fontSize: 8, fontWeight: '900' }, price: { flexDirection: 'row', alignItems: 'center', gap: 4 }, priceText: { color: '#5140A0', fontSize: 10, fontWeight: '900' }, sessionName: { marginTop: 9, color: '#272337', fontSize: 14, fontWeight: '900' }, date: { marginTop: 4, color: '#716C80', fontSize: 10 }, sessionFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 13, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0EDF5' }, meta: { flexDirection: 'row', alignItems: 'center', gap: 5 }, metaText: { color: '#716C80', fontSize: 9, fontWeight: '700' }, roster: { flexDirection: 'row', alignItems: 'center', gap: 1 }, rosterText: { color: '#5140A0', fontSize: 9, fontWeight: '900' } });

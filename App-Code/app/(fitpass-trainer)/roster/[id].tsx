import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Calendar, Check, Users } from '@/components/ui/app-icons';
import { API_CLIENT } from '@/lib/api-client';
import { ScreenContainer } from '@/components/layout';
import { theme } from '@/design-system/theme';
import { useToast } from '@/hooks/useToast';

type Roster = { memberId: string; name: string; status: string; phone?: string; bookedAt?: string; coinsCharged?: number };
type Session = { id?: string; name: string; type: string; scheduleDate: string; startTime: string; endTime: string; maxSeats: number; priceCoins: number; bookings: Roster[] };
export default function FitPassTrainerRoster() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const load = useCallback(async () => {
    try { const { data } = await API_CLIENT.get(`/classes/${id}/bookings`); setSession(data); }
    catch (err: any) { toast.show(err.response?.data?.message || 'Roster could not be loaded.', 'error'); }
    finally { setLoading(false); }
  }, [id, toast]);
  useEffect(() => { load(); }, [load]);
  const toggle = async (memberId: string, status: string) => {
    setBusy(memberId);
    try { await API_CLIENT.put(`/classes/${id}/attendees/${memberId}`, { status: status === 'Attended' ? 'Reserved' : 'Attended' }); await load(); }
    catch (err: any) { toast.show(err.response?.data?.message || 'Attendance could not be updated.', 'error'); }
    finally { setBusy(''); }
  };
  if (loading) return <ScreenContainer><ActivityIndicator color="#5140A0" style={{ marginTop: 40 }} /></ScreenContainer>;
  if (!session) return <ScreenContainer><Text style={styles.empty}>This class session is unavailable or outside your branch.</Text></ScreenContainer>;
  const attended = session.bookings?.filter((item) => item.status === 'Attended').length || 0;
  return <ScreenContainer scrollable={false} style={styles.screen}><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor="#5140A0" />}>
    <View style={styles.hero}><Text style={styles.type}>{session.type}</Text><Text style={styles.title}>{session.name}</Text><View style={styles.meta}><Calendar size={14} color="#D3CBFF" /><Text style={styles.metaText}>{new Date(session.scheduleDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })} · {session.startTime}–{session.endTime}</Text></View><View style={styles.meta}><Users size={14} color="#D3CBFF" /><Text style={styles.metaText}>{attended} attended · {session.bookings?.length || 0} reserved · {session.maxSeats} seats</Text></View></View>
    <Text style={styles.section}>Member check-in</Text>
    {!session.bookings?.length ? <Text style={styles.empty}>No reservations yet. Members can book from FitPass.</Text> : session.bookings.map((member) => <View key={member.memberId} style={styles.member}><View style={styles.avatar}><Text style={styles.avatarText}>{member.name?.charAt(0)?.toUpperCase() || 'M'}</Text></View><View style={{ flex: 1 }}><Text style={styles.memberName}>{member.name}</Text><Text style={styles.memberMeta}>{member.phone || 'FitPass member'} · {member.status}{member.coinsCharged ? ` · ${member.coinsCharged} FC` : ''}</Text></View><TouchableOpacity disabled={busy === member.memberId} onPress={() => toggle(member.memberId, member.status)} style={[styles.checkButton, member.status === 'Attended' && styles.checked]}>{busy === member.memberId ? <ActivityIndicator color="#5140A0" /> : <><Check size={15} color={member.status === 'Attended' ? '#FFFFFF' : '#5140A0'} /><Text style={[styles.checkText, member.status === 'Attended' && { color: '#FFFFFF' }]}>{member.status === 'Attended' ? 'Done' : 'Check in'}</Text></>}</TouchableOpacity></View>)}
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#F5F3FB' }, content: { padding: 17, paddingBottom: 35, gap: 11 }, hero: { padding: 17, borderRadius: 16, backgroundColor: '#241C50' }, type: { color: '#CFC8FF', fontSize: 9, fontWeight: '900', letterSpacing: .8 }, title: { marginTop: 7, color: '#FFFFFF', fontSize: 20, fontWeight: '900' }, meta: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9 }, metaText: { color: '#E2DFFF', fontSize: 10 }, section: { marginTop: 8, color: '#29253A', fontSize: 16, fontWeight: '900' }, member: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderWidth: 1, borderColor: '#E2DEEF', borderRadius: 13, backgroundColor: '#FFFFFF' }, avatar: { width: 37, height: 37, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#EFECFF' }, avatarText: { color: '#5140A0', fontWeight: '900', fontSize: 15 }, memberName: { color: '#29253A', fontSize: 12, fontWeight: '900' }, memberMeta: { marginTop: 3, color: '#817B90', fontSize: 9 }, checkButton: { minWidth: 76, minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 8, borderRadius: 9, backgroundColor: '#EFECFF' }, checked: { backgroundColor: '#5140A0' }, checkText: { color: '#5140A0', fontSize: 9, fontWeight: '900' }, empty: { padding: 15, borderRadius: 12, backgroundColor: '#FFFFFF', color: theme.colors.textSecondary, fontSize: 12 } });

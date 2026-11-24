import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Activity, Apple, ChevronRight, Dumbbell, Search, Users } from '@/components/ui/app-icons';
import { API_CLIENT } from '@/lib/api-client';
import { theme } from '@/design-system/theme';
import { ScreenContainer } from '@/components/layout';

type Member = { id?: string; _id?: string; name: string; phone?: string; email?: string; registrationNumber?: string; heightCm?: number | null; status?: string };

export default function TrainerMembers() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const { data } = await API_CLIENT.get('/members', { params: { page: 1, limit: 100 } });
      setMembers(Array.isArray(data?.members) ? data.members : []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not load your assigned members.');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? members.filter(member => [member.name, member.phone, member.registrationNumber, member.email].some(value => String(value || '').toLowerCase().includes(query))) : members;
  }, [members, search]);

  return <ScreenContainer scrollable={false} style={styles.screen}>
    <FlatList
      data={filtered}
      keyExtractor={(item) => String(item.id || item._id)}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#735B00" />}
      ListHeaderComponent={<View style={styles.header}>
        <Text style={styles.eyebrow}>COACHING ROSTER</Text>
        <View style={styles.titleRow}><View><Text style={styles.title}>Your members</Text><Text style={styles.subtitle}>{members.length} assigned member{members.length === 1 ? '' : 's'}</Text></View><View style={styles.countPill}><Users size={15} color="#655400" /><Text style={styles.count}>{members.length}</Text></View></View>
        <View style={styles.search}><Search size={17} color="#898579" /><TextInput value={search} onChangeText={setSearch} placeholder="Search by name, phone or ID" placeholderTextColor="#989487" style={styles.searchInput} /></View>
        {loading && <ActivityIndicator color="#735B00" style={{ marginTop: 24 }} />}
        {!!error && <Text style={styles.error}>{error}</Text>}
        {!loading && !error && !filtered.length && <View style={styles.empty}><Users size={25} color="#AAA69A" /><Text style={styles.emptyTitle}>{members.length ? 'No matches' : 'Your roster is empty'}</Text><Text style={styles.emptyCopy}>{members.length ? 'Try another search.' : 'Ask your branch admin to assign members to you.'}</Text></View>}
      </View>}
      renderItem={({ item }) => {
        const id = String(item.id || item._id);
        const open = (section: string) => router.push(`/(h4-trainer)/${section}/${id}` as any);
        return <View style={styles.memberCard}>
          <TouchableOpacity style={styles.memberMain} onPress={() => router.push(`/(h4-trainer)/members/${id}` as any)} activeOpacity={.78}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{item.name?.trim()?.charAt(0)?.toUpperCase() || 'M'}</Text></View>
            <View style={styles.memberInfo}><Text style={styles.memberName}>{item.name}</Text><Text style={styles.memberMeta}>{item.registrationNumber || 'H4 member'}{item.phone ? `  ·  ${item.phone}` : ''}</Text><Text style={styles.memberStatus}>{item.heightCm ? `${item.heightCm} cm height baseline` : 'Assessment needed'} · {item.status || 'Active'}</Text></View>
            <ChevronRight size={19} color="#A19D91" />
          </TouchableOpacity>
          <View style={styles.actions}>
            <Action label="Diet" icon={<Apple size={14} color="#625200" />} onPress={() => open('diets')} />
            <Action label="Workout" icon={<Dumbbell size={14} color="#625200" />} onPress={() => open('workouts')} />
            <Action label="Assess" icon={<Activity size={14} color="#625200" />} onPress={() => open('assessments')} />
          </View>
        </View>;
      }}
    />
  </ScreenContainer>;
}

function Action({ label, icon, onPress }: { label: string; icon: React.ReactNode; onPress: () => void }) {
  return <TouchableOpacity style={styles.action} onPress={onPress} activeOpacity={.75}>{icon}<Text style={styles.actionText}>{label}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F3ED' }, content: { padding: 17, paddingBottom: 30, gap: 10 },
  header: { gap: 9, marginBottom: 3 }, eyebrow: { color: '#938043', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#22211C', fontSize: 25, fontWeight: '900', letterSpacing: -.4 }, subtitle: { color: '#77746A', fontSize: 11, marginTop: 3 }, countPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 99, backgroundColor: '#FFF2AF' }, count: { color: '#514500', fontSize: 12, fontWeight: '900' },
  search: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E4E1D8', borderRadius: 13, backgroundColor: '#FFFFFF', marginTop: 6 }, searchInput: { flex: 1, color: '#28271F', fontSize: 12, paddingVertical: 10 },
  memberCard: { padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#E9E6DE', backgroundColor: '#FFFFFF', gap: 10 }, memberMain: { flexDirection: 'row', alignItems: 'center', gap: 11 }, avatar: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#FFF3B0' }, avatarText: { color: '#514500', fontSize: 17, fontWeight: '900' }, memberInfo: { flex: 1, gap: 3 }, memberName: { color: '#27261F', fontSize: 13, fontWeight: '850' }, memberMeta: { color: '#77746A', fontSize: 10 }, memberStatus: { color: '#969185', fontSize: 9 },
  actions: { flexDirection: 'row', gap: 7, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#F0EEE8' }, action: { flex: 1, minHeight: 35, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 10, backgroundColor: '#FFF9DD' }, actionText: { color: '#514500', fontSize: 9, fontWeight: '850' },
  empty: { alignItems: 'center', padding: 24, borderRadius: 15, backgroundColor: '#FFFFFF', gap: 8, marginTop: 8 }, emptyTitle: { color: '#312F28', fontSize: 14, fontWeight: '850' }, emptyCopy: { color: '#77746A', fontSize: 11, textAlign: 'center' }, error: { color: theme.colors.error, fontSize: 11, padding: 12, backgroundColor: '#FFF1ED', borderRadius: 10 },
});

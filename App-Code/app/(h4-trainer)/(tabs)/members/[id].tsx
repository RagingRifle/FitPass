import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Activity, Apple, ChevronRight, Dumbbell, Scale, TrendingUp } from '@/components/ui/app-icons';
import { API_CLIENT } from '@/lib/api-client';
import { theme } from '@/design-system/theme';
import { ScreenContainer } from '@/components/layout';

type Member = { id?: string; _id?: string; name: string; phone?: string; email?: string; registrationNumber?: string; heightCm?: number | null; branchName?: string | null };
type Assessment = { weight: number; bmi?: number | null; bodyFat?: number | null; muscleMass?: number | null; waistCm?: number | null; assessmentDate: string };

export default function TrainerMemberDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [latest, setLatest] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([API_CLIENT.get(`/members/${id}`), API_CLIENT.get('/body-assessments', { params: { memberId: id, limit: 1 } })]).then(([memberRes, assessmentRes]) => {
      if (!active) return;
      setMember(memberRes.data);
      const rows = assessmentRes.data?.data || [];
      setLatest(rows[0] || null);
    }).catch(() => { if (active) setMember(null); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) return <ScreenContainer><ActivityIndicator color={theme.colors.primaryText} style={{ marginTop: 40 }} /></ScreenContainer>;
  if (!member) return <ScreenContainer><Text style={styles.error}>Member details could not be loaded. Check that this member is assigned to your account.</Text></ScreenContainer>;

  const routeTo = (kind: 'assessments' | 'workouts' | 'diets') => router.push(`/(h4-trainer)/${kind}/${id}` as any);
  return <ScreenContainer scrollable={false}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.profileCard}><View style={styles.avatar}><Text style={styles.avatarText}>{member.name?.trim()?.charAt(0)?.toUpperCase() || 'M'}</Text></View><Text style={styles.name}>{member.name}</Text><Text style={styles.meta}>{member.registrationNumber || 'H4 member'}{member.phone ? `  ·  ${member.phone}` : ''}</Text>{member.email && <Text style={styles.meta}>{member.email}</Text>}<View style={styles.heightPill}><Scale size={15} color="#735B00" /><Text style={styles.heightText}>{member.heightCm ? `Height baseline · ${member.heightCm} cm` : 'Height needed for first assessment'}</Text></View></View>

    <Text style={styles.sectionTitle}>Latest check-in</Text>
    {latest ? <View style={styles.metrics}><Metric icon={<Scale size={16} color="#735B00" />} label="WEIGHT" value={`${latest.weight} kg`} /><Metric icon={<Activity size={16} color="#735B00" />} label="BMI" value={latest.bmi == null ? '—' : String(latest.bmi)} /><Metric icon={<TrendingUp size={16} color="#735B00" />} label="BODY FAT" value={latest.bodyFat == null ? '—' : `${latest.bodyFat}%`} /><Metric icon={<Dumbbell size={16} color="#735B00" />} label="SKELETAL MUSCLE" value={latest.muscleMass == null ? '—' : `${latest.muscleMass} kg`} /></View> : <Text style={styles.noAssessment}>No assessment recorded yet.</Text>}

    <Text style={styles.sectionTitle}>Coaching tools</Text>
    <Action icon={<Activity size={19} color="#735B00" />} title="Record body assessment" detail="Weight, baseline height, device readings" onPress={() => routeTo('assessments')} />
    <Action icon={<Dumbbell size={19} color="#735B00" />} title="Assign workout plan" detail="Create a plan for this member" onPress={() => routeTo('workouts')} />
    <Action icon={<Apple size={19} color="#735B00" />} title="Assign diet plan" detail="Add a meal plan for this member" onPress={() => routeTo('diets')} />
  </ScrollView></ScreenContainer>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <View style={styles.metric}><View style={styles.metricIcon}>{icon}</View><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>; }
function Action({ icon, title, detail, onPress }: { icon: React.ReactNode; title: string; detail: string; onPress: () => void }) { return <TouchableOpacity style={styles.action} onPress={onPress} activeOpacity={0.75}><View style={styles.actionIcon}>{icon}</View><View style={styles.actionText}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionDetail}>{detail}</Text></View><ChevronRight size={19} color={theme.colors.textMuted} /></TouchableOpacity>; }

const styles = StyleSheet.create({
  content: { gap: 12, paddingBottom: 30 },
  profileCard: { alignItems: 'center', padding: 22, borderRadius: 20, backgroundColor: '#171713', marginBottom: 6 },
  avatar: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary }, avatarText: { color: '#594B00', fontSize: 24, fontWeight: '900' },
  name: { marginTop: 12, color: '#FFFDF5', fontSize: 21, fontWeight: '900' }, meta: { marginTop: 4, color: '#C6C2B6', fontSize: 12 },
  heightPill: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, backgroundColor: '#FFF1A3' }, heightText: { color: '#514500', fontSize: 11, fontWeight: '750' },
  sectionTitle: { marginTop: 8, color: theme.colors.text, fontSize: 16, fontWeight: '900' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, metric: { width: '48%', minHeight: 83, padding: 11, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 13, backgroundColor: '#FFFFFF' }, metricIcon: { position: 'absolute', right: 10, top: 10 }, metricLabel: { color: theme.colors.textMuted, fontSize: 9, fontWeight: '800' }, metricValue: { marginTop: 13, color: theme.colors.text, fontSize: 18, fontWeight: '900' },
  noAssessment: { padding: 14, borderRadius: 12, backgroundColor: '#FFFFFF', color: theme.colors.textSecondary, fontSize: 12 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, backgroundColor: '#FFFFFF' }, actionIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#FFF4B1' }, actionText: { flex: 1 }, actionTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '800' }, actionDetail: { marginTop: 3, color: theme.colors.textMuted, fontSize: 10 },
  error: { padding: 16, borderRadius: 12, backgroundColor: '#FFF1ED', color: theme.colors.error, fontSize: 13 },
});

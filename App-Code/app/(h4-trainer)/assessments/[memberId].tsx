import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Activity, Calendar, CheckCircle, Info, Scale } from '@/components/ui/app-icons';
import { API_CLIENT } from '@/lib/api-client';
import { theme } from '@/design-system/theme';
import { ScreenContainer } from '@/components/layout';
import { useToast } from '@/hooks/useToast';

type Member = { id?: string; _id?: string; name: string; heightCm?: number | null };
type Assessment = { id?: string; _id?: string; weight: number; bmi?: number | null; bodyFat?: number | null; muscleMass?: number | null; bmr?: number | null; waistCm?: number | null; assessmentDate: string };

export default function TrainerAssessmentForm() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const router = useRouter();
  const toast = useToast();
  const [member, setMember] = useState<Member | null>(null);
  const [history, setHistory] = useState<Assessment[]>([]);
  const [heightCm, setHeightCm] = useState('');
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [muscleMass, setMuscleMass] = useState('');
  const [bmr, setBmr] = useState('');
  const [waistCm, setWaistCm] = useState('');
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([API_CLIENT.get(`/members/${memberId}`), API_CLIENT.get('/body-assessments', { params: { memberId, limit: 10 } })]).then(([memberRes, assessmentRes]) => {
      if (!active) return;
      setMember(memberRes.data);
      setHeightCm(memberRes.data?.heightCm ? String(memberRes.data.heightCm) : '');
      setHistory(assessmentRes.data?.data || []);
    }).catch((err: any) => toast.show(err.response?.data?.message || 'Could not load member details.', 'error')).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [memberId]);

  const bmi = useMemo(() => {
    const height = Number(heightCm || member?.heightCm || 0) / 100;
    const weightValue = Number(weight);
    return height > 0 && weightValue > 0 ? (weightValue / (height * height)).toFixed(1) : '';
  }, [heightCm, member?.heightCm, weight]);

  const saveAssessment = async () => {
    if (!weight || Number(weight) <= 0 || (!member?.heightCm && (!heightCm || Number(heightCm) < 80 || Number(heightCm) > 250))) {
      toast.show('Enter a valid weight and the member’s height baseline.', 'error');
      return;
    }
    setSaving(true);
    try {
      const { data } = await API_CLIENT.post('/body-assessments', {
        memberId,
        weight: Number(weight),
        ...(!member?.heightCm ? { heightCm: Number(heightCm) } : {}),
        bodyFat: bodyFat ? Number(bodyFat) : null,
        muscleMass: muscleMass ? Number(muscleMass) : null,
        bmr: bmr ? Number(bmr) : null,
        waistCm: waistCm ? Number(waistCm) : null,
        assessmentDate,
      });
      setHistory((items) => [data, ...items]);
      setMember((current) => current ? { ...current, heightCm: current.heightCm || Number(heightCm) } : current);
      setWeight(''); setBodyFat(''); setMuscleMass(''); setBmr(''); setWaistCm('');
      toast.show(`Assessment saved · BMI ${data.bmi}`, 'success');
    } catch (err: any) {
      toast.show(err.response?.data?.message || 'Could not save the assessment.', 'error');
    } finally { setSaving(false); }
  };

  if (loading) return <ScreenContainer><ActivityIndicator color={theme.colors.primaryText} style={{ marginTop: 35 }} /></ScreenContainer>;

  return <ScreenContainer scrollable={false}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.memberLine}><View style={styles.memberIcon}><Activity size={17} color="#735B00" /></View><View style={{ flex: 1 }}><Text style={styles.memberLabel}>ASSESSING</Text><Text style={styles.memberName}>{member?.name || 'H4 member'}</Text></View></View>
        <View style={styles.infoCard}><Info size={17} color="#735B00" /><Text style={styles.infoText}>Height is saved once as a member baseline. BMI is calculated automatically from height and each new weight.</Text></View>

        {!member?.heightCm && <Field label="Height baseline (cm) *" value={heightCm} onChangeText={setHeightCm} keyboardType="decimal-pad" placeholder="e.g. 172" hint="Confirm the member’s height before saving their first assessment." />}
        {member?.heightCm && <View style={styles.baseline}><Scale size={15} color="#735B00" /><Text style={styles.baselineText}>Saved height baseline: <Text style={{ fontWeight: '900' }}>{member.heightCm} cm</Text></Text></View>}

        <Field label="Weight (kg) *" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="e.g. 68.5" />
        <View style={styles.bmiCard}><View style={styles.bmiIcon}><Activity size={17} color="#735B00" /></View><View style={{ flex: 1 }}><Text style={styles.fieldLabel}>CALCULATED BMI</Text><Text style={styles.bmiValue}>{bmi || '—'}</Text></View><Text style={styles.readOnly}>AUTO</Text></View>

        <Text style={styles.sectionTitle}>Optional device readings</Text>
        <Text style={styles.sectionCopy}>Copy these only from the InBody machine result. Leave blank when no device reading is available.</Text>
        <Field label="Body fat (PBF %)" value={bodyFat} onChangeText={setBodyFat} keyboardType="decimal-pad" placeholder="e.g. 24.2" />
        <Field label="Skeletal muscle mass (kg)" value={muscleMass} onChangeText={setMuscleMass} keyboardType="decimal-pad" placeholder="e.g. 29.4" />
        <Field label="BMR (kcal)" value={bmr} onChangeText={setBmr} keyboardType="number-pad" placeholder="Device reading, if shown" />
        <Field label="Waist circumference (cm)" value={waistCm} onChangeText={setWaistCm} keyboardType="decimal-pad" placeholder="Optional · measure consistently" />
        <Field label="Assessment date (YYYY-MM-DD)" value={assessmentDate} onChangeText={setAssessmentDate} icon={<Calendar size={16} color={theme.colors.textMuted} />} />

        <TouchableOpacity style={[styles.saveButton, saving && { opacity: .65 }]} onPress={saveAssessment} disabled={saving} activeOpacity={.85}>{saving ? <ActivityIndicator color="#171713" /> : <><CheckCircle size={18} color="#171713" /><Text style={styles.saveText}>Save assessment</Text></>}</TouchableOpacity>

        <Text style={styles.sectionTitle}>Recent readings</Text>
        {history.length ? history.map((item) => <View key={String(item.id || item._id)} style={styles.historyCard}><Text style={styles.historyDate}>{new Date(item.assessmentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text><View style={styles.historyRow}><Text style={styles.historyMain}>{item.weight} kg</Text><Text style={styles.historyMetric}>BMI {item.bmi ?? '—'}</Text>{item.bodyFat != null && <Text style={styles.historyMetric}>{item.bodyFat}% fat</Text>}</View></View>) : <Text style={styles.emptyHistory}>No previous assessments for this member.</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  </ScreenContainer>;
}

function Field({ label, value, onChangeText, keyboardType, placeholder, hint, icon }: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: 'decimal-pad' | 'number-pad'; placeholder?: string; hint?: string; icon?: React.ReactNode }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><View style={styles.inputRow}>{icon}{<TextInput style={styles.input} value={value} onChangeText={onChangeText} keyboardType={keyboardType || 'default'} placeholder={placeholder} placeholderTextColor={theme.colors.textMuted} />}</View>{hint && <Text style={styles.hint}>{hint}</Text>}</View>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32, gap: 11 },
  memberLine: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: theme.colors.border },
  memberIcon: { width: 35, height: 35, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF4B1' }, memberLabel: { color: theme.colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1 }, memberName: { marginTop: 3, color: theme.colors.text, fontSize: 14, fontWeight: '850' },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderRadius: 12, backgroundColor: '#FFF7D1' }, infoText: { flex: 1, color: '#5D5017', fontSize: 11, lineHeight: 17 },
  baseline: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 11, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: theme.colors.border }, baselineText: { color: theme.colors.textSecondary, fontSize: 12 },
  field: { gap: 6 }, fieldLabel: { color: theme.colors.textSecondary, fontSize: 10, fontWeight: '850', letterSpacing: .35 }, inputRow: { minHeight: 47, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#FFFFFF' }, input: { flex: 1, minWidth: 0, paddingVertical: 11, color: theme.colors.text, fontSize: 13 }, hint: { color: theme.colors.textMuted, fontSize: 10, lineHeight: 15 },
  bmiCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5DDAE', backgroundColor: '#FFFCED' }, bmiIcon: { width: 33, height: 33, borderRadius: 10, backgroundColor: '#FFF2A3', alignItems: 'center', justifyContent: 'center' }, bmiValue: { marginTop: 3, color: theme.colors.text, fontSize: 19, fontWeight: '900' }, readOnly: { color: '#786500', fontSize: 9, fontWeight: '900', letterSpacing: .7 },
  sectionTitle: { marginTop: 9, color: theme.colors.text, fontSize: 15, fontWeight: '900' }, sectionCopy: { marginTop: -7, color: theme.colors.textMuted, fontSize: 11, lineHeight: 17 },
  saveButton: { minHeight: 49, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 5, borderRadius: 13, backgroundColor: theme.colors.primary }, saveText: { color: '#171713', fontSize: 13, fontWeight: '900' },
  historyCard: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: '#FFFFFF' }, historyDate: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '750' }, historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }, historyMain: { color: theme.colors.text, fontSize: 16, fontWeight: '900' }, historyMetric: { color: theme.colors.textSecondary, fontSize: 11, fontWeight: '650' }, emptyHistory: { color: theme.colors.textMuted, fontSize: 12, paddingVertical: 8 },
});

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BarChart3, Coins, RefreshCw, TrendingUp, Users } from '@/components/ui/app-icons';
import { API_CLIENT } from '@/lib/api-client';
import { theme } from '@/design-system/theme';
import { ScreenContainer } from '@/components/layout';

const TYPES: Record<string, string> = { NEW_MEMBER: 'New members', RENEWAL: 'Renewals', UPGRADE: 'Package upgrades', BALANCE_COLLECTION: 'Balance collections', LEGACY: 'Other sales' };
type PerformanceData = { summary: { transactions: number; salesAmount: number; points: number; membersConverted: number; incentiveEnabled: boolean; incentiveMultiplier: number; projectedIncentive: number; fixedSalary: number }; rules: Record<string, number>; breakdown: Array<{ saleType: string; transactions: number; amount: number; points: number }>; timeline: Array<{ key: string; transactions: number; amount: number; points: number }> };

export default function TrainerPerformance() {
  const [period, setPeriod] = useState<'month' | 'year' | 'all' | 'custom'>('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [appliedRange, setAppliedRange] = useState({ from: '', to: '' });
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params: Record<string, string> = { period };
      if (period === 'custom') { if (appliedRange.from) params.from = appliedRange.from; if (appliedRange.to) params.to = appliedRange.to; }
      const response = await API_CLIENT.get('/payroll/performance', { params });
      setData(response.data);
    } catch (err: any) { setError(err.response?.data?.message || 'Could not load your sales performance.'); }
    finally { setLoading(false); }
  }, [period, appliedRange]);
  useEffect(() => { load(); }, [load]);

  const summary = data?.summary;
  const maxAmount = Math.max(...(data?.timeline || []).map(row => Number(row.amount) || 0), 1);
  return <ScreenContainer scrollable={false} style={styles.screen}><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.heading}><Text style={styles.eyebrow}>SALES & REWARDS</Text><View style={styles.headingRow}><View><Text style={styles.title}>Performance</Text><Text style={styles.subtitle}>Your conversions, points, and incentive progress.</Text></View><TouchableOpacity style={styles.refresh} onPress={load}><RefreshCw size={16} color="#675600" /></TouchableOpacity></View></View>

    <View style={styles.periods}>{(['month', 'year', 'all', 'custom'] as const).map(value => <TouchableOpacity key={value} onPress={() => setPeriod(value)} style={[styles.periodButton, period === value && styles.periodActive]}><Text style={[styles.periodText, period === value && styles.periodTextActive]}>{value === 'month' ? 'This month' : value === 'year' ? 'This year' : value === 'all' ? 'All time' : 'Dates'}</Text></TouchableOpacity>)}</View>
    {period === 'custom' && <View style={styles.dateFilter}><TextInput value={from} onChangeText={setFrom} placeholder="From · YYYY-MM-DD" placeholderTextColor="#989487" style={styles.dateInput} /><TextInput value={to} onChangeText={setTo} placeholder="To · YYYY-MM-DD" placeholderTextColor="#989487" style={styles.dateInput} /><TouchableOpacity style={styles.applyDates} onPress={() => setAppliedRange({ from, to })}><Text style={styles.applyText}>Apply</Text></TouchableOpacity></View>}

    {loading ? <ActivityIndicator color="#735B00" style={{ marginTop: 38 }} /> : error ? <Text style={styles.error}>{error}</Text> : summary && <>
      <View style={styles.pointsCard}><View style={styles.pointsTop}><View><Text style={styles.pointsLabel}>SALES POINTS</Text><Text style={styles.pointsNumber}>{summary.points}</Text><Text style={styles.pointsCopy}>{period === 'all' ? 'Cumulative points' : period === 'year' ? 'Earned this year' : period === 'custom' ? 'Earned in selected dates' : 'Earned this month'}</Text></View><View style={styles.pointsIcon}><TrendingUp size={23} color="#574A00" /></View></View><View style={styles.pointsFoot}><Text style={styles.pointsFootText}>{summary.transactions} sale{summary.transactions === 1 ? '' : 's'} · ₹{Number(summary.salesAmount).toLocaleString('en-IN')} recorded</Text><Text style={styles.pointsFootText}>{summary.membersConverted} member conversions</Text></View></View>

      <Text style={styles.section}>Your numbers</Text>
      <View style={styles.metricGrid}><Metric icon={<Users size={16} color="#735B00" />} value={summary.membersConverted} label="Members converted" /><Metric icon={<BarChart3 size={16} color="#735B00" />} value={summary.transactions} label="Sales recorded" /><Metric icon={<Coins size={16} color="#735B00" />} value={summary.incentiveEnabled ? `₹${Number(summary.projectedIncentive).toLocaleString('en-IN')}` : 'Off'} label="Projected incentive" /></View>

      <View style={styles.incentiveCard}><View style={{ flex: 1 }}><Text style={styles.incentiveTitle}>Sales incentive</Text><Text style={styles.incentiveCopy}>{summary.incentiveEnabled ? `${summary.points} points × ₹${Number(summary.incentiveMultiplier).toLocaleString('en-IN')} per point` : 'Your admin has turned off point incentives.'}</Text></View><View style={[styles.pill, summary.incentiveEnabled && styles.pillOn]}><Text style={[styles.pillText, summary.incentiveEnabled && styles.pillTextOn]}>{summary.incentiveEnabled ? 'ACTIVE' : 'OFF'}</Text></View></View>
      <View style={styles.payCard}><View style={{ flex: 1 }}><Text style={styles.payLabel}>MONTHLY FIXED SALARY</Text><Text style={styles.payValue}>₹{Number(summary.fixedSalary).toLocaleString('en-IN')}</Text></View><View style={styles.payDivider} /><View style={{ flex: 1 }}><Text style={styles.payLabel}>INCENTIVE EARNED IN PERIOD</Text><Text style={styles.payValue}>{summary.incentiveEnabled ? `₹${Number(summary.projectedIncentive).toLocaleString('en-IN')}` : '₹0'}</Text></View></View>

      <Text style={styles.section}>Conversion breakdown</Text>
      {data.breakdown.length ? data.breakdown.map(row => <View key={row.saleType} style={styles.breakdownRow}><View style={styles.breakdownName}><Text style={styles.typeName}>{TYPES[row.saleType] || row.saleType}</Text><Text style={styles.typeMeta}>{row.transactions} sale{row.transactions === 1 ? '' : 's'} · ₹{Number(row.amount).toLocaleString('en-IN')}</Text></View><View style={styles.pointPill}><Text style={styles.pointValue}>+{row.points}</Text><Text style={styles.pointUnit}>pts</Text></View></View>) : <Text style={styles.empty}>No sales in this date range yet.</Text>}

      <Text style={styles.section}>Sales timeline</Text>
      {data.timeline.length ? <View style={styles.timelineCard}>{data.timeline.slice(-12).map(row => <View key={row.key} style={styles.timelineItem}><Text style={styles.timelineDate}>{new Date(`${row.key.length === 7 ? `${row.key}-01` : row.key}T12:00:00`).toLocaleDateString('en-IN', row.key.length === 7 ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' })}</Text><View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.max(4, Number(row.amount) / maxAmount * 100)}%` }]} /></View><Text style={styles.timelinePoints}>{row.points} pt</Text></View>)}</View> : <Text style={styles.empty}>The timeline will appear when sales are recorded against your account.</Text>}
      <Text style={styles.note}>Point values are set by your H4 admin. New member, renewal, and upgrade sales count when the sale is recorded under your staff account.</Text>
    </>}
  </ScrollView></ScreenContainer>;
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: string | number; label: string }) { return <View style={styles.metric}>{icon}<Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#F5F3ED' }, content: { padding: 17, paddingBottom: 34, gap: 12 }, heading: { gap: 5 }, eyebrow: { color: '#938043', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 }, headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { color: '#24231E', fontSize: 25, fontWeight: '900' }, subtitle: { color: '#77746A', fontSize: 10, marginTop: 3 }, refresh: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFDF5', borderWidth: 1, borderColor: '#E9E6DE' },
  periods: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: 12, backgroundColor: '#EAE7DE' }, periodButton: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 9 }, periodActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: .06, shadowRadius: 4, elevation: 1 }, periodText: { color: '#77746A', fontSize: 9, fontWeight: '750' }, periodTextActive: { color: '#342D0C', fontWeight: '900' }, dateFilter: { flexDirection: 'row', gap: 6 }, dateInput: { flex: 1, minHeight: 42, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E4E1D8', backgroundColor: '#FFFFFF', color: '#29271F', fontSize: 9 }, applyDates: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 11, borderRadius: 10, backgroundColor: '#F8DF4B' }, applyText: { color: '#514500', fontSize: 9, fontWeight: '900' },
  pointsCard: { padding: 18, borderRadius: 19, backgroundColor: '#171713' }, pointsTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, pointsLabel: { color: '#D5C467', fontSize: 8, fontWeight: '900', letterSpacing: 1.1 }, pointsNumber: { color: '#FFFDF5', fontSize: 43, lineHeight: 50, fontWeight: '900' }, pointsCopy: { color: '#C6C2B6', fontSize: 10 }, pointsIcon: { width: 47, height: 47, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#F8DF4B' }, pointsFoot: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap', paddingTop: 12, marginTop: 13, borderTopWidth: 1, borderTopColor: '#3B3930' }, pointsFootText: { color: '#D3CEBF', fontSize: 9 },
  section: { color: '#29271F', fontSize: 14, fontWeight: '900', marginTop: 3 }, metricGrid: { flexDirection: 'row', gap: 7 }, metric: { flex: 1, minHeight: 91, padding: 10, borderRadius: 13, borderWidth: 1, borderColor: '#E9E6DE', backgroundColor: '#FFFFFF' }, metricValue: { color: '#29271F', fontSize: 15, fontWeight: '900', marginTop: 7 }, metricLabel: { color: '#77746A', fontSize: 8, lineHeight: 12, marginTop: 3 },
  incentiveCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: '#E9E6DE', backgroundColor: '#FFFFFF' }, incentiveTitle: { color: '#302E27', fontSize: 11, fontWeight: '850' }, incentiveCopy: { color: '#77746A', fontSize: 9, marginTop: 4 }, pill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99, backgroundColor: '#F0EEE8' }, pillOn: { backgroundColor: '#E4F5EA' }, pillText: { color: '#77746A', fontSize: 8, fontWeight: '900' }, pillTextOn: { color: '#167046' },
  payCard: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 13, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9E6DE' }, payLabel: { color: '#898579', fontSize: 7, fontWeight: '900', letterSpacing: .5 }, payValue: { color: '#29271F', fontSize: 14, fontWeight: '900', marginTop: 6 }, payDivider: { width: 1, height: 37, backgroundColor: '#E9E6DE' },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', padding: 11, borderRadius: 12, borderWidth: 1, borderColor: '#E9E6DE', backgroundColor: '#FFFFFF' }, breakdownName: { flex: 1 }, typeName: { color: '#302E27', fontSize: 10, fontWeight: '850' }, typeMeta: { color: '#898579', fontSize: 8, marginTop: 4 }, pointPill: { flexDirection: 'row', alignItems: 'baseline', gap: 3, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 9, backgroundColor: '#FFF5C4' }, pointValue: { color: '#514500', fontSize: 12, fontWeight: '900' }, pointUnit: { color: '#827018', fontSize: 7, fontWeight: '800' },
  timelineCard: { padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#E9E6DE', backgroundColor: '#FFFFFF', gap: 10 }, timelineItem: { flexDirection: 'row', alignItems: 'center', gap: 8 }, timelineDate: { width: 55, color: '#77746A', fontSize: 8 }, barTrack: { flex: 1, height: 7, overflow: 'hidden', borderRadius: 99, backgroundColor: '#F0EEE8' }, barFill: { height: '100%', borderRadius: 99, backgroundColor: '#E6C821' }, timelinePoints: { width: 38, color: '#514500', textAlign: 'right', fontSize: 8, fontWeight: '850' }, note: { color: '#8B877B', fontSize: 9, lineHeight: 14, paddingHorizontal: 2 }, empty: { color: '#77746A', fontSize: 10, padding: 12, borderRadius: 12, backgroundColor: '#FFFFFF' }, error: { color: theme.colors.error, padding: 12, borderRadius: 11, backgroundColor: '#FFF1ED', fontSize: 11 }
});

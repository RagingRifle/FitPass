import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Text } from 'react-native';
import { Activity, Scale, Flame, Award, Calendar, TrendingUp } from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';
import { Typography, Card } from '@/components/ui';
import { API_CLIENT } from '@/lib/api-client';
import { H4TopHeader } from './H4TopHeader';

interface Assessment {
  _id: string;
  id?: string;
  weight: number;
  bmi: number;
  bodyFat: number;
  muscleMass: number;
  bmr: number;
  inBodyScore?: number;
  assessmentDate: string;
}

export function H4Assessments() {
  const [loading, setLoading] = useState(true);
  const [assessments, setSessions] = useState<Assessment[]>([]);

  const fetchAssessments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API_CLIENT.get('/body-assessments');
      const data = res.data?.data || res.data;
      if (Array.isArray(data)) {
        setSessions(data);
      }
    } catch (err: any) {
      console.warn('Failed to fetch body assessments:', err?.message || err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const latest = assessments.length > 0 ? assessments[0] : null;

  return (
    <View style={{ flex: 1, backgroundColor: '#FAFAFC' }}>
      <H4TopHeader title="Body Progress" />
      <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerGroup}>
          <View style={styles.headerIconWrap}>
            <TrendingUp size={18} color="#F0A020" strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Typography variant="h2" style={styles.headerTitle}>InBody Analysis</Typography>
            <Typography variant="caption" color="secondary" style={styles.headerSub}>
              Track muscle mass, body fat percentage, and overall composition progress
            </Typography>
          </View>
        </View>

        {!latest ? (
          <Card style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Activity size={28} color="#F0A020" />
            </View>
            <Typography variant="bodySm" style={styles.emptyTitle}>No Body Assessment Data</Typography>
            <Typography variant="caption" color="secondary" style={styles.emptyDesc}>
              Visit your coach at H4 Gym to perform an InBody analysis and log your body measurements.
            </Typography>
          </Card>
        ) : (
          <View style={styles.mainGroup}>
            <View style={styles.metricsGrid}>
              <Card style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Scale size={15} color="#F0A020" />
                  <Typography variant="caption" color="secondary" style={styles.metricLabel}>WEIGHT</Typography>
                </View>
                <Text style={styles.metricVal}>
                  {latest.weight} <Text style={styles.metricUnit}>kg</Text>
                </Text>
              </Card>

              <Card style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <TrendingUp size={15} color="#F0A020" />
                  <Typography variant="caption" color="secondary" style={styles.metricLabel}>BMI</Typography>
                </View>
                <Text style={styles.metricVal}>{latest.bmi}</Text>
              </Card>

              <Card style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Flame size={15} color="#F0A020" />
                  <Typography variant="caption" color="secondary" style={styles.metricLabel}>BODY FAT</Typography>
                </View>
                <Text style={styles.metricVal}>
                  {latest.bodyFat} <Text style={styles.metricUnit}>%</Text>
                </Text>
              </Card>

              <Card style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Activity size={15} color="#F0A020" />
                  <Typography variant="caption" color="secondary" style={styles.metricLabel}>MUSCLE (SMM)</Typography>
                </View>
                <Text style={styles.metricVal}>
                  {latest.muscleMass} <Text style={styles.metricUnit}>kg</Text>
                </Text>
              </Card>

              <Card style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <Award size={15} color="#F0A020" />
                  <Typography variant="caption" color="secondary" style={styles.metricLabel}>BMR</Typography>
                </View>
                <Text style={styles.metricVal}>
                  {latest.bmr} <Text style={styles.metricUnit}>kcal</Text>
                </Text>
              </Card>

              {latest.inBodyScore ? (
                <View style={[styles.metricCard, styles.scoreCard]}>
                  <View style={styles.metricHeader}>
                    <Award size={15} color="#FFFFFF" />
                    <Typography variant="caption" style={[styles.metricLabel, { color: '#FFFFFF' }]}>INBODY SCORE</Typography>
                  </View>
                  <Text style={[styles.metricVal, { color: '#FFFFFF' }]}>{latest.inBodyScore}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.sectionTitle}>Assessment History</Text>
            <View style={styles.historyList}>
              {assessments.map((item) => {
                const itemId = item._id || item.id || '';
                const dateStr = new Date(item.assessmentDate).toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });

                return (
                  <Card key={itemId} style={styles.historyCard}>
                    <View style={styles.historyHeader}>
                      <View style={styles.dateGroup}>
                        <Calendar size={14} color="#F0A020" />
                        <Text style={styles.dateText}>{dateStr}</Text>
                      </View>
                      {item.inBodyScore ? (
                        <Text style={styles.scoreBadge}>Score: {item.inBodyScore}</Text>
                      ) : null}
                    </View>

                    <View style={styles.cardDivider} />

                    <View style={styles.historyStatsRow}>
                      <View style={styles.statCol}>
                        <Text style={styles.statLabel}>Weight</Text>
                        <Text style={styles.statVal}>{item.weight} kg</Text>
                      </View>
                      <View style={styles.statCol}>
                        <Text style={styles.statLabel}>BMI</Text>
                        <Text style={styles.statVal}>{item.bmi}</Text>
                      </View>
                      <View style={styles.statCol}>
                        <Text style={styles.statLabel}>Body Fat</Text>
                        <Text style={styles.statVal}>{item.bodyFat}%</Text>
                      </View>
                      <View style={styles.statCol}>
                        <Text style={styles.statLabel}>Muscle</Text>
                        <Text style={styles.statVal}>{item.muscleMass} kg</Text>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAFC' },
  content: { padding: 18, paddingBottom: 100, gap: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFC' },
  
  headerGroup: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    marginBottom: 4 
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { 
    color: '#0F172A', 
    fontWeight: '800', 
    fontSize: 20 
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },

  emptyCard: { 
    padding: 30, 
    alignItems: 'center', 
    gap: 10, 
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(240, 160, 32, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: { color: '#0F172A', fontWeight: '800', fontSize: 16 },
  emptyDesc: { textAlign: 'center', fontSize: 12, color: '#64748B', lineHeight: 18 },
  
  mainGroup: { gap: 16 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricCard: { 
    width: '48%', 
    padding: 16, 
    gap: 6, 
    backgroundColor: '#FFFFFF', 
    borderColor: '#E2E8F0', 
    borderWidth: 1,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
  },
  scoreCard: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  metricHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metricLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: '#64748B' },
  metricVal: { color: '#0F172A', fontWeight: '800', fontSize: 20 },
  metricUnit: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 8 },
  historyList: { gap: 12 },
  historyCard: { 
    padding: 16, 
    gap: 12, 
    backgroundColor: '#FFFFFF', 
    borderColor: '#E2E8F0', 
    borderWidth: 1,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
  },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { color: '#0F172A', fontWeight: '800', fontSize: 13 },
  scoreBadge: { 
    color: '#F0A020', 
    fontWeight: '800', 
    fontSize: 10, 
    backgroundColor: 'rgba(240, 160, 32, 0.08)', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(240, 160, 32, 0.15)',
  },
  
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  
  historyStatsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statCol: { gap: 4 },
  statLabel: { fontSize: 10, color: '#64748B', fontWeight: '600' },
  statVal: { color: '#0F172A', fontWeight: '800', fontSize: 13 },
});

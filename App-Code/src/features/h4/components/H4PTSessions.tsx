import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { UserCheck, Calendar, Clock, PackageCheck, Award } from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';
import { Typography, Card, Badge } from '@/components/ui';
import { API_CLIENT } from '@/lib/api-client';
import { H4TopHeader } from './H4TopHeader';

interface PTSession {
  _id: string;
  id?: string;
  sessionDate: string;
  status: string;
  notes?: string;
  trainer?: {
    id: string;
    name: string;
    email: string;
  };
  package?: {
    id: string;
    name: string;
    price: number;
    sessionCount: number;
  };
}

export function H4PTSessions() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<PTSession[]>([]);

  const fetchPTSessions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API_CLIENT.get('/pt-sessions');
      const data = res.data?.data || res.data;
      if (Array.isArray(data)) {
        setSessions(data);
      }
    } catch (err: any) {
      console.warn('Failed to fetch PT sessions:', err?.message || err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPTSessions();
  }, [fetchPTSessions]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primaryText} />
      </View>
    );
  }

  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'active';
      case 'cancelled':
        return 'expired';
      default:
        return 'info';
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F5ED' }}>
      <H4TopHeader title="PT Coaching" />
      <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerGroup}>
          <View style={styles.headerIconWrap}>
            <Award size={18} color="#735B00" strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Typography variant="h2" style={styles.headerTitle}>1-on-1 Sessions</Typography>
            <Typography variant="caption" color="secondary" style={styles.headerSub}>
              Track scheduled workout bookings & active training packages
            </Typography>
          </View>
        </View>

        {sessions.length === 0 ? (
          <Card style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <UserCheck size={28} color="#735B00" />
            </View>
            <Typography variant="bodySm" style={styles.emptyTitle}>No PT Sessions Scheduled</Typography>
            <Typography variant="caption" color="secondary" style={styles.emptyDesc}>
              You currently have no 1-on-1 sessions scheduled. Contact your H4 coach or admin to book a PT package.
            </Typography>
          </Card>
        ) : (
          <View style={styles.sessionList}>
            {sessions.map((s) => {
              const sessionId = s._id || s.id || '';
              const sessionDateObj = new Date(s.sessionDate);
              const dateStr = sessionDateObj.toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });
              const timeStr = sessionDateObj.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <View key={sessionId} style={styles.sessionCard}>
                  {/* Card Header */}
                  <View style={styles.cardHeader}>
                    <View style={styles.trainerGroup}>
                      <View style={styles.trainerAvatar}>
                        <Text style={styles.trainerAvatarText}>
                          {(s.trainer?.name?.[0] || 'T').toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Typography variant="h3" style={styles.trainerName}>
                          {s.trainer?.name || 'Assigned Coach'}
                        </Typography>
                        <Typography variant="caption" color="secondary" style={styles.trainerRole}>
                          H4 Personal Trainer
                        </Typography>
                      </View>
                    </View>
                    <Badge label={s.status} variant={getStatusVariant(s.status)} />
                  </View>

                  {/* Divider line */}
                  <View style={styles.cardDivider} />

                  {/* Session Date and Time */}
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Calendar size={14} color="#735B00" />
                      <Typography variant="caption" style={styles.metaText}>{dateStr}</Typography>
                    </View>
                    <View style={styles.metaItem}>
                      <Clock size={14} color="#735B00" />
                      <Typography variant="caption" style={styles.metaText}>{timeStr}</Typography>
                    </View>
                  </View>

                  {/* PT package block */}
                  {s.package ? (
                    <View style={styles.packageBanner}>
                      <PackageCheck size={14} color="#735B00" />
                      <Typography variant="caption" style={styles.packageText}>
                        Package: <Typography variant="caption" style={{ color: '#0F172A', fontWeight: '800' }}>{s.package.name}</Typography> ({s.package.sessionCount} Sessions)
                      </Typography>
                    </View>
                  ) : null}

                  {/* Trainer notes */}
                  {s.notes ? (
                    <View style={styles.notesBox}>
                      <Typography variant="caption" color="secondary" style={styles.notesLabel}>Coach Feedback:</Typography>
                      <Typography variant="bodySm" color="secondary" style={styles.notesContent}>{s.notes}</Typography>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F5ED' },
  content: { padding: 18, paddingBottom: 100, gap: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F5ED' },
  
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
    backgroundColor: 'rgba(254, 223, 30, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: { color: '#0F172A', fontWeight: '800', fontSize: 16 },
  emptyDesc: { textAlign: 'center', fontSize: 12, color: '#64748B', lineHeight: 18 },
  
  sessionList: { gap: 14 },
  sessionCard: { 
    padding: 16, 
    gap: 12, 
    borderRadius: 20,
    backgroundColor: '#FFFFFF', 
    borderColor: '#E2E8F0', 
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trainerGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  trainerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(254,223,30,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(254,223,30,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trainerAvatarText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#735B00',
  },
  trainerName: { color: '#0F172A', fontWeight: '800', fontSize: 14 },
  trainerRole: { fontSize: 11, color: '#64748B', marginTop: 1 },
  
  cardDivider: {
    height: 1,
    backgroundColor: '#F5F1E7',
  },
  
  metaRow: { flexDirection: 'row', gap: 16, paddingVertical: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: '#475569', fontWeight: '700', fontSize: 12 },
  
  packageBanner: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    backgroundColor: 'rgba(254, 223, 30, 0.08)', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: 'rgba(254, 223, 30, 0.25)' 
  },
  packageText: { color: '#475569', fontSize: 11 },
  
  notesBox: { 
    backgroundColor: '#F8F5ED', 
    padding: 12, 
    borderRadius: 10, 
    gap: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notesLabel: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', color: '#64748B', letterSpacing: 0.3 },
  notesContent: { fontSize: 12, lineHeight: 16, color: '#475569', marginTop: 1 },
});

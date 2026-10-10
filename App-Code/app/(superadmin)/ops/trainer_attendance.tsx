import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Tabs, useRouter } from 'expo-router';
import { ArrowLeft, Clock, Activity, CheckCircle } from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';
import { Typography, Card, Select, Button, EmptyState, Badge } from '@/components/ui';
import { SafeAreaWrapper } from '@/components/layout';
import { useToast } from '@/hooks/useToast';
import { API_CLIENT } from '@/lib/api-client';
import { useAuth } from '@/features/auth/hooks/useAuth';

export default function TrainerAttendanceScreen() {
  const toast = useToast();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [selectedTrainerId, setSelectedTrainerId] = useState('');

  // 1. Query Staff (Trainers only)
  const { data: staffList } = useQuery<any[]>({
    queryKey: ['h4-staff-trainers-list'],
    queryFn: async () => {
      const { data } = await API_CLIENT.get('/staff');
      return (data || []).filter((s: any) => s.role === 'trainer');
    },
    enabled: isAdmin,
  });

  // 2. Query Trainer Shift Logs
  const targetTrainer = selectedTrainerId || (user?.role === 'trainer' ? user.id : '');
  const { data: trainerLogs, isLoading: isLogsLoading, refetch: refetchLogs } = useQuery<any[]>({
    queryKey: ['h4-trainer-logs-details', targetTrainer],
    queryFn: async () => {
      const url = targetTrainer ? `/trainer-attendance?trainerId=${targetTrainer}` : '/trainer-attendance';
      const { data } = await API_CLIENT.get(url);
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.data)) return data.data;
      if (data && Array.isArray(data.logs)) return data.logs;
      return [];
    },
  });

  // 3. Trainer Check-in/Out Mutations
  const trainerCheckInMutation = useMutation({
    mutationFn: async (trainerId: string) => {
      const { data } = await API_CLIENT.post('/trainer-attendance/checkin', trainerId ? { trainerId } : {});
      return data;
    },
    onSuccess: () => {
      toast.show('Shift started successfully!', 'success');
      refetchLogs();
    },
    onError: (err: any) => {
      toast.show(err.response?.data?.message || 'Check In failed', 'error');
    },
  });

  const trainerCheckOutMutation = useMutation({
    mutationFn: async (trainerId: string) => {
      const { data } = await API_CLIENT.post('/trainer-attendance/checkout', trainerId ? { trainerId } : {});
      return data;
    },
    onSuccess: () => {
      toast.show('Shift ended successfully!', 'success');
      refetchLogs();
    },
    onError: (err: any) => {
      toast.show(err.response?.data?.message || 'Check Out failed', 'error');
    },
  });

  // Trainer Stats memo calculations
  const stats = React.useMemo(() => {
    const logsList = Array.isArray(trainerLogs) ? trainerLogs : [];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthlyLogs = logsList.filter((l: any) => {
      if (!l || !l.date) return false;
      const d = new Date(l.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const totalHours = monthlyLogs.reduce((sum: number, l: any) => sum + (l.workingHours || 0), 0).toFixed(1);
    const activeDays = monthlyLogs.length;

    // Is checked in? (Any entry where checkOutTime is empty)
    const activeLog = logsList.find((l: any) => (l.trainerId === targetTrainer || l.trainer?._id === targetTrainer) && !l.checkOutTime);

    return {
      totalHours,
      activeDays,
      isCheckedIn: !!activeLog,
      activeLog,
    };
  }, [trainerLogs, targetTrainer]);

  return (
    <SafeAreaWrapper scrollable={false}>
      <Tabs.Screen 
        options={{ 
          title: 'Trainer Attendance',
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => router.replace('/(superadmin)/ops-hub')}
              style={styles.headerBackBtn}
              activeOpacity={0.7}
            >
              <ArrowLeft color={theme.colors.text} size={20} />
            </TouchableOpacity>
          )
        }} 
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Trainer Selector */}
        {isAdmin && (
          <Card style={styles.filterCard}>
            <Select 
              label="Select Trainer to manage:"
              options={[
                { label: '-- All Trainer Logs --', value: '' },
                ...(staffList || []).map((t: any) => ({ label: t.name, value: t._id })),
              ]}
              value={selectedTrainerId}
              onValueChange={(val) => setSelectedTrainerId(String(val))}
            />
          </Card>
        )}

        {isLogsLoading ? (
          <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: theme.spacing['2xl'] }} />
        ) : (
          <>
            {/* Stats Indicators Row */}
            {stats && (
              <View style={styles.statsRow}>
                <Card style={styles.statBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: 4 }}>
                    <Activity size={20} color="#8b5cf6" />
                    <Typography variant="caption" color="secondary" style={{ textTransform: 'uppercase', fontWeight: '700' }}>
                      Hours Worked (This Month)
                    </Typography>
                  </View>
                  <Typography variant="h2">{stats.totalHours} hrs</Typography>
                  <Typography variant="caption" color="muted">Over {stats.activeDays} shifts logged</Typography>
                </Card>

                <Card style={styles.statBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: 4 }}>
                    <CheckCircle size={20} color="#10b981" />
                    <Typography variant="caption" color="secondary" style={{ textTransform: 'uppercase', fontWeight: '700' }}>
                      Attendance Rate
                    </Typography>
                  </View>
                  <Typography variant="h2">{stats.activeDays} days</Typography>
                  <Typography variant="caption" color="muted">Active shifts this calendar month</Typography>
                </Card>
              </View>
            )}

            {/* Check-In/Out Quick Payout Actions */}
            {stats && (user?.role === 'trainer' || (isAdmin && selectedTrainerId)) && (
              <Card style={styles.actionCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs }}>
                  <Clock size={24} color={stats.isCheckedIn ? '#10b981' : theme.colors.textSecondary} />
                  <Typography variant="body" style={{ fontWeight: '800' }}>
                    {stats.isCheckedIn ? 'You are Checked In' : 'You are Checked Out'}
                  </Typography>
                </View>
                <Typography variant="caption" color="secondary" style={{ marginBottom: theme.spacing.md }}>
                  {stats.isCheckedIn 
                    ? `Started at ${new Date(stats.activeLog?.checkInTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` 
                    : 'Please log your shift start/end times'
                  }
                </Typography>

                {stats.isCheckedIn ? (
                  <Button 
                    title="Check Out Shift"
                    onPress={() => {
                      Alert.alert('Check Out', 'Are you sure you want to Check Out now?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Confirm', onPress: () => trainerCheckOutMutation.mutate(targetTrainer) }
                      ]);
                    }}
                    style={styles.checkOutBtn}
                  />
                ) : (
                  <Button 
                    title="Check In Shift"
                    onPress={() => trainerCheckInMutation.mutate(targetTrainer)}
                    style={styles.checkInBtn}
                  />
                )}
              </Card>
            )}

            {/* History Table */}
            <Typography variant="h3" style={styles.sectionHeader}>Attendance Shift History</Typography>

            {(trainerLogs || []).length === 0 ? (
              <EmptyState 
                iconText="⏱️"
                title="No Attendance Records Found"
                description="No shifts have been logged for this period yet."
              />
            ) : (
              (trainerLogs || []).map((log: any) => (
                <Card key={log._id} style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <View>
                      <Typography variant="body" style={{ fontWeight: '700' }}>
                        {log.trainer?.name || user?.name || 'Trainer'}
                      </Typography>
                      <Typography variant="caption" color="secondary">
                        {new Date(log.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                      </Typography>
                    </View>
                    <Badge 
                      label={log.checkOutTime ? 'Completed' : 'Working'} 
                      variant={log.checkOutTime ? 'active' : 'warning'} 
                    />
                  </View>
                  
                  <View style={styles.historyDetail}>
                    <Typography variant="caption" color="secondary">
                      In: {new Date(log.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                    <Typography variant="caption" color="secondary">
                      Out: {log.checkOutTime ? new Date(log.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </Typography>
                    <Typography variant="caption" color="secondary" style={{ fontWeight: '700' }}>
                      {log.workingHours !== null ? `${log.workingHours} hrs` : 'Active'}
                    </Typography>
                  </View>
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  filterCard: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  statsRow: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  statBox: {
    padding: theme.spacing.md,
  },
  actionCard: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  checkInBtn: {
    backgroundColor: '#10b981',
    height: 44,
  },
  checkOutBtn: {
    backgroundColor: '#ef4444',
    height: 44,
  },
  sectionHeader: {
    fontWeight: '800',
    marginBottom: theme.spacing.md,
    textTransform: 'uppercase',
  },
  historyCard: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  historyDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
  },
  headerBackBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.xs,
  },
});

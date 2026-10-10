import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator } from 'react-native';
import { Users, XCircle } from '@/components/ui/app-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_CLIENT } from '@/lib/api-client';
import { Card, Typography, Input, Button, Badge } from '@/components/ui';

export const UserControlHub: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [sessionDeltaInput, setSessionDeltaInput] = useState('5');
  const [reasonInput, setReasonInput] = useState('Admin compensation credit');

  // Fetch FitPass Subscribers
  const { data: memberRes, isLoading } = useQuery<any>({
    queryKey: ['fitpass-subscribers-list', search],
    queryFn: async () => {
      const { data } = await API_CLIENT.get(`/superadmin/fitpass/members?search=${search}`);
      return data || { data: [] };
    },
  });

  const subscribers = memberRes?.data || [];

  // Session Adjustment Mutation
  const adjustSessionsMutation = useMutation({
    mutationFn: async ({ memberId, delta, reason }: { memberId: string; delta: number; reason: string }) => {
      const { data } = await API_CLIENT.post(`/superadmin/fitpass/users/${memberId}/adjust-sessions`, {
        delta,
        reason,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fitpass-subscribers-list'] });
      Alert.alert('Session Balance Updated', data.message || 'Sessions updated');
      setSelectedUser(null);
    },
    onError: (err: any) => {
      Alert.alert('Adjustment Failed', err.response?.data?.message || err.message || 'Could not adjust sessions');
    },
  });

  // User Status & Expiry Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ memberId, status, extendDays }: { memberId: string; status?: string; extendDays?: number }) => {
      const { data } = await API_CLIENT.put(`/superadmin/fitpass/users/${memberId}/status`, {
        status,
        extendDays,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fitpass-subscribers-list'] });
      Alert.alert('Success', 'User account updated successfully');
      setSelectedUser(null);
    },
    onError: (err: any) => {
      Alert.alert('Update Failed', err.response?.data?.message || err.message || 'Could not update user status');
    },
  });

  const handleOpenUser = (u: any) => {
    setSelectedUser(u);
    setSessionDeltaInput('5');
    setReasonInput('Admin compensation credit');
  };

  const handleAdjustSessions = (isAdd: boolean) => {
    if (!selectedUser) return;
    const count = parseInt(sessionDeltaInput);
    if (isNaN(count) || count <= 0) {
      Alert.alert('Invalid Count', 'Please enter a valid session count.');
      return;
    }
    const delta = isAdd ? count : -count;
    adjustSessionsMutation.mutate({
      memberId: selectedUser.id || selectedUser._id,
      delta,
      reason: reasonInput,
    });
  };

  const handleExtendExpiry = (days: number) => {
    if (!selectedUser) return;
    updateStatusMutation.mutate({
      memberId: selectedUser.id || selectedUser._id,
      extendDays: days,
    });
  };

  const handleToggleStatus = (newStatus: string) => {
    if (!selectedUser) return;
    updateStatusMutation.mutate({
      memberId: selectedUser.id || selectedUser._id,
      status: newStatus,
    });
  };

  return (
    <View style={styles.container}>
      {/* Header Widget */}
      <Card style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Users size={24} color="#D99B00" />
          <Typography variant="h2" style={styles.headerTitle}>User Control Hub (A-Z)</Typography>
        </View>
        <Typography variant="caption" color="secondary" style={{ marginTop: 4 }}>
          Inspect subscriber profiles, grant bonus session credits, adjust balances, and extend membership validity.
        </Typography>
      </Card>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Input
          placeholder="Search subscriber by name, phone, or email..."
          value={search}
          onChangeText={setSearch}
          style={{ flex: 1 }}
        />
      </View>

      {/* Subscribers Table */}
      {isLoading ? (
        <ActivityIndicator size="large" color="#ffe01b" style={{ marginVertical: 30 }} />
      ) : subscribers.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Typography variant="body" color="secondary">No FitPass subscribers found matching your query.</Typography>
        </Card>
      ) : (
        <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
          {subscribers.map((u: any) => {
            const isExpired = u.isExpired;
            const statusVariant = isExpired ? 'expired' : u.status === 'Active' ? 'active' : 'info';
            return (
              <TouchableOpacity
                key={u.id || u._id}
                style={styles.userRowCard}
                onPress={() => handleOpenUser(u)}
                activeOpacity={0.88}
              >
                <View style={styles.userMainInfo}>
                  <Typography variant="h3" style={{ fontWeight: '800', color: '#1A1510' }}>
                    {u.name}
                  </Typography>
                  <Typography variant="caption" color="secondary">📞 {u.phone} {u.email ? `• ✉️ ${u.email}` : ''}</Typography>
                  
                  <View style={styles.sessionPillRow}>
                    <View style={styles.sessionBadge}>
                      <Typography variant="caption" style={{ fontWeight: '800', color: '#1A1510' }}>
                        🎟️ {u.sessionsRemaining} / {u.sessionsTotal} sessions left
                      </Typography>
                    </View>
                  </View>
                </View>

                <View style={styles.userMetaSide}>
                  <Badge label={isExpired ? 'Expired' : u.status} variant={statusVariant} />
                  <Typography variant="caption" color="muted" style={{ marginTop: 6, fontSize: 10 }}>
                    📅 Exp: {new Date(u.expiryDate).toLocaleDateString()}
                  </Typography>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Deep User Inspection & Action Modal */}
      {selectedUser && (
        <Modal transparent animationType="slide" visible={!!selectedUser}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Typography variant="h2" style={{ fontWeight: '900', color: '#1A1510' }}>
                    {selectedUser.name}
                  </Typography>
                  <Typography variant="caption" color="secondary">ID: {selectedUser.id || selectedUser._id}</Typography>
                </View>
                <TouchableOpacity onPress={() => setSelectedUser(null)}>
                  <XCircle size={24} color="#655B50" />
                </TouchableOpacity>
              </View>

              <ScrollView bounces={false} style={{ maxHeight: 440 }}>
                {/* Account Summary */}
                <View style={styles.modalSection}>
                  <Typography variant="caption" color="secondary" style={styles.sectionLabel}>ACCOUNT SUMMARY</Typography>
                  <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                      <Typography variant="caption" color="secondary">Remaining</Typography>
                      <Typography variant="h2" style={{ color: '#D99B00', fontWeight: '900' }}>
                        {selectedUser.sessionsRemaining}
                      </Typography>
                    </View>
                    <View style={styles.statBox}>
                      <Typography variant="caption" color="secondary">Used</Typography>
                      <Typography variant="h2" style={{ color: '#2E7D32', fontWeight: '900' }}>
                        {selectedUser.sessionsUsed || 0}
                      </Typography>
                    </View>
                    <View style={styles.statBox}>
                      <Typography variant="caption" color="secondary">Total Grant</Typography>
                      <Typography variant="h2" style={{ color: '#1A1510', fontWeight: '900' }}>
                        {selectedUser.sessionsTotal}
                      </Typography>
                    </View>
                  </View>
                </View>

                {/* Adjust Sessions */}
                <View style={styles.modalSection}>
                  <Typography variant="caption" color="secondary" style={styles.sectionLabel}>SESSION BALANCE CONTROLS</Typography>
                  <Input
                    label="Reason / Audit Note"
                    placeholder="Reason for adjustment..."
                    value={reasonInput}
                    onChangeText={setReasonInput}
                    style={{ marginBottom: 10 }}
                  />
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <Input
                      placeholder="Count"
                      value={sessionDeltaInput}
                      onChangeText={setSessionDeltaInput}
                      keyboardType="number-pad"
                      style={{ width: 90 }}
                    />
                    <Button
                      title="+ Add Credits"
                      onPress={() => handleAdjustSessions(true)}
                      loading={adjustSessionsMutation.isPending}
                      style={{ flex: 1, backgroundColor: '#2E7D32' }}
                    />
                    <Button
                      title="- Deduct"
                      onPress={() => handleAdjustSessions(false)}
                      loading={adjustSessionsMutation.isPending}
                      style={{ flex: 1, backgroundColor: '#C62828' }}
                    />
                  </View>
                </View>

                {/* Extend Membership */}
                <View style={styles.modalSection}>
                  <Typography variant="caption" color="secondary" style={styles.sectionLabel}>MEMBERSHIP VALIDITY EXTENSION</Typography>
                  <Typography variant="caption" color="muted" style={{ marginBottom: 8 }}>
                    Current Expiry: {new Date(selectedUser.expiryDate).toLocaleDateString()}
                  </Typography>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button
                      title="+7 Days"
                      onPress={() => handleExtendExpiry(7)}
                      loading={updateStatusMutation.isPending}
                      style={styles.smallBtn}
                    />
                    <Button
                      title="+30 Days"
                      onPress={() => handleExtendExpiry(30)}
                      loading={updateStatusMutation.isPending}
                      style={styles.smallBtn}
                    />
                    <Button
                      title="+90 Days"
                      onPress={() => handleExtendExpiry(90)}
                      loading={updateStatusMutation.isPending}
                      style={styles.smallBtn}
                    />
                  </View>
                </View>

                {/* Account State Toggles */}
                <View style={styles.modalSection}>
                  <Typography variant="caption" color="secondary" style={styles.sectionLabel}>ACCOUNT ACCESS STATE</Typography>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    <Button
                      title={selectedUser.status === 'Active' ? 'Freeze Account' : 'Activate Account'}
                      onPress={() => handleToggleStatus(selectedUser.status === 'Active' ? 'Frozen' : 'Active')}
                      loading={updateStatusMutation.isPending}
                      style={{ flex: 1, backgroundColor: selectedUser.status === 'Active' ? '#D99B00' : '#2E7D32' }}
                    />
                    <Button
                      title={selectedUser.status === 'Blocked' ? 'Unblock User' : 'Block User'}
                      onPress={() => handleToggleStatus(selectedUser.status === 'Blocked' ? 'Active' : 'Blocked')}
                      loading={updateStatusMutation.isPending}
                      style={{ flex: 1, backgroundColor: selectedUser.status === 'Blocked' ? '#1A1510' : '#C62828' }}
                    />
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerCard: {
    padding: 18,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ffe01b',
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontWeight: '900',
    color: '#1A1510',
  },
  searchContainer: {
    marginBottom: 16,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  listScroll: {
    flex: 1,
  },
  userRowCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EAE7E1',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  userMainInfo: {
    flex: 1,
    marginRight: 12,
  },
  sessionPillRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionBadge: {
    backgroundColor: 'rgba(255, 224, 27, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 224, 27, 0.4)',
  },
  userMetaSide: {
    alignItems: 'flex-end',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EAE7E1',
    paddingBottom: 12,
  },
  modalSection: {
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F6F0',
    paddingBottom: 14,
  },
  sectionLabel: {
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8F6F0',
    borderRadius: 14,
    padding: 10,
    alignItems: 'center',
  },
  smallBtn: {
    flex: 1,
    height: 44,
    minHeight: 44,
    backgroundColor: '#1A1510',
  },
});

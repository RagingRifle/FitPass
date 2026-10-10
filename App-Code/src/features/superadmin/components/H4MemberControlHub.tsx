import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator } from 'react-native';
import { Users, XCircle } from '@/components/ui/app-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_CLIENT } from '@/lib/api-client';
import { Card, Typography, Input, Button, Badge } from '@/components/ui';

export const H4MemberControlHub: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<any | null>(null);

  // Fetch H4 members
  const { data: memberRes = [], isLoading } = useQuery<any[]>({
    queryKey: ['h4-members-list', search],
    queryFn: async () => {
      const { data } = await API_CLIENT.get(`/members?search=${search}`);
      return data || [];
    },
  });

  const members = Array.isArray(memberRes) ? memberRes : [];

  // Update member mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data } = await API_CLIENT.put(`/members/${id}`, updates);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['h4-members-list'] });
      Alert.alert('Success', 'Member account updated successfully');
      setSelectedMember(null);
    },
    onError: (err: any) => {
      Alert.alert('Update Failed', err.response?.data?.message || err.message || 'Failed to update member');
    },
  });

  const handleExtendExpiry = (days: number) => {
    if (!selectedMember) return;
    const currentExpiry = new Date(selectedMember.expiryDate > new Date().toISOString() ? selectedMember.expiryDate : new Date());
    currentExpiry.setDate(currentExpiry.getDate() + days);
    updateMutation.mutate({
      id: selectedMember.id || selectedMember._id,
      updates: { expiryDate: currentExpiry },
    });
  };

  const handleToggleStatus = (newStatus: string) => {
    if (!selectedMember) return;
    updateMutation.mutate({
      id: selectedMember.id || selectedMember._id,
      updates: { status: newStatus },
    });
  };

  return (
    <View style={styles.container}>
      {/* Header Widget */}
      <Card style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Users size={24} color="#D99B00" />
          <Typography variant="h2" style={styles.headerTitle}>H4 Member Control Hub (A-Z)</Typography>
        </View>
        <Typography variant="caption" color="secondary" style={{ marginTop: 4 }}>
          Inspect H4 physical branch members, extend membership validity, freeze/unfreeze access, and audit payment dues.
        </Typography>
      </Card>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Input
          placeholder="Search H4 member by name, phone, or email..."
          value={search}
          onChangeText={setSearch}
          style={{ flex: 1 }}
        />
      </View>

      {/* Member Table */}
      {isLoading ? (
        <ActivityIndicator size="large" color="#ffe01b" style={{ marginVertical: 30 }} />
      ) : members.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Typography variant="body" color="secondary">No H4 members found matching your search query.</Typography>
        </Card>
      ) : (
        <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
          {members.map((m: any) => {
            const isExpired = new Date(m.expiryDate) <= new Date();
            return (
              <TouchableOpacity
                key={m.id || m._id}
                style={styles.memberRowCard}
                onPress={() => setSelectedMember(m)}
                activeOpacity={0.88}
              >
                <View style={styles.memberMainInfo}>
                  <Typography variant="h3" style={{ fontWeight: '800', color: '#1A1510' }}>
                    {m.name}
                  </Typography>
                  <Typography variant="caption" color="secondary">📞 {m.phone} {m.email ? `• ✉️ ${m.email}` : ''}</Typography>
                  
                  <View style={styles.dueRow}>
                    <Typography variant="caption" style={{ fontSize: 11, fontWeight: '700', color: '#655B50' }}>
                      Plan Paid: ₹{(m.paidAmount || 0).toLocaleString()} / ₹{(m.planPrice || 0).toLocaleString()}
                    </Typography>
                  </View>
                </View>

                <View style={styles.memberMetaSide}>
                  <Badge label={isExpired ? 'Expired' : m.status || 'Active'} variant={isExpired ? 'expired' : 'active'} />
                  <Typography variant="caption" color="muted" style={{ marginTop: 6, fontSize: 10 }}>
                    📅 Exp: {new Date(m.expiryDate).toLocaleDateString()}
                  </Typography>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Deep Member Inspection & Action Modal */}
      {selectedMember && (
        <Modal transparent animationType="slide" visible={!!selectedMember}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
                  <Typography variant="h2" style={{ fontWeight: '900', color: '#1A1510' }}>
                    {selectedMember.name}
                  </Typography>
                  <Typography variant="caption" color="secondary">Phone: {selectedMember.phone}</Typography>
                </View>
                <TouchableOpacity onPress={() => setSelectedMember(null)}>
                  <XCircle size={24} color="#655B50" />
                </TouchableOpacity>
              </View>

              <ScrollView bounces={false} style={{ maxHeight: 420 }}>
                {/* Financial Summary */}
                <View style={styles.modalSection}>
                  <Typography variant="caption" color="secondary" style={styles.sectionLabel}>PAYMENT AUDIT</Typography>
                  <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                      <Typography variant="caption" color="secondary">Plan Price</Typography>
                      <Typography variant="h2" style={{ color: '#1A1510', fontWeight: '900' }}>
                        ₹{(selectedMember.planPrice || 0).toLocaleString()}
                      </Typography>
                    </View>
                    <View style={styles.statBox}>
                      <Typography variant="caption" color="secondary">Paid</Typography>
                      <Typography variant="h2" style={{ color: '#2E7D32', fontWeight: '900' }}>
                        ₹{(selectedMember.paidAmount || 0).toLocaleString()}
                      </Typography>
                    </View>
                    <View style={styles.statBox}>
                      <Typography variant="caption" color="secondary">Pending Dues</Typography>
                      <Typography variant="h2" style={{ color: '#C62828', fontWeight: '900' }}>
                        ₹{Math.max(0, (selectedMember.planPrice || 0) - (selectedMember.paidAmount || 0)).toLocaleString()}
                      </Typography>
                    </View>
                  </View>
                </View>

                {/* Membership Validity Extension */}
                <View style={styles.modalSection}>
                  <Typography variant="caption" color="secondary" style={styles.sectionLabel}>MEMBERSHIP VALIDITY EXTENSION</Typography>
                  <Typography variant="caption" color="muted" style={{ marginBottom: 8 }}>
                    Current Expiry: {new Date(selectedMember.expiryDate).toLocaleDateString()}
                  </Typography>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button
                      title="+7 Days"
                      onPress={() => handleExtendExpiry(7)}
                      loading={updateMutation.isPending}
                      style={styles.smallBtn}
                    />
                    <Button
                      title="+30 Days"
                      onPress={() => handleExtendExpiry(30)}
                      loading={updateMutation.isPending}
                      style={styles.smallBtn}
                    />
                    <Button
                      title="+90 Days"
                      onPress={() => handleExtendExpiry(90)}
                      loading={updateMutation.isPending}
                      style={styles.smallBtn}
                    />
                  </View>
                </View>

                {/* Account Access State */}
                <View style={styles.modalSection}>
                  <Typography variant="caption" color="secondary" style={styles.sectionLabel}>ACCESS CONTROLS</Typography>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    <Button
                      title={selectedMember.status === 'Active' ? 'Freeze Member' : 'Activate Member'}
                      onPress={() => handleToggleStatus(selectedMember.status === 'Active' ? 'Frozen' : 'Active')}
                      loading={updateMutation.isPending}
                      style={{ flex: 1, backgroundColor: selectedMember.status === 'Active' ? '#D99B00' : '#2E7D32' }}
                    />
                    <Button
                      title={selectedMember.status === 'Blocked' ? 'Unblock Member' : 'Block Member'}
                      onPress={() => handleToggleStatus(selectedMember.status === 'Blocked' ? 'Active' : 'Blocked')}
                      loading={updateMutation.isPending}
                      style={{ flex: 1, backgroundColor: selectedMember.status === 'Blocked' ? '#1A1510' : '#C62828' }}
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
  memberRowCard: {
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
  memberMainInfo: {
    flex: 1,
    marginRight: 12,
  },
  dueRow: {
    marginTop: 4,
  },
  memberMetaSide: {
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

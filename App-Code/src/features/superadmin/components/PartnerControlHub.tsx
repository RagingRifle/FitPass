import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator } from 'react-native';
import { Building2, MapPin, Phone, XCircle } from '@/components/ui/app-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_CLIENT } from '@/lib/api-client';
import { Card, Typography, Input, Button, Badge } from '@/components/ui';

export const PartnerControlHub: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<any | null>(null);
  const [durationInput, setDurationInput] = useState('120');

  // Fetch partner gyms
  const { data: partners = [], isLoading } = useQuery<any[]>({
    queryKey: ['fitpass-partners-list'],
    queryFn: async () => {
      const { data } = await API_CLIENT.get('/superadmin/gyms');
      return data || [];
    },
  });

  // Update gym status mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data } = await API_CLIENT.put(`/superadmin/gyms/${id}`, updates);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fitpass-partners-list'] });
      Alert.alert('Success', 'Partner gym updated successfully');
      setSelectedPartner(null);
    },
    onError: (err: any) => {
      Alert.alert('Update Error', err.response?.data?.message || err.message || 'Failed to update partner');
    },
  });

  // Delete gym mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await API_CLIENT.delete(`/superadmin/gyms/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fitpass-partners-list'] });
      Alert.alert('Deleted', 'Partner gym removed from system');
      setSelectedPartner(null);
    },
    onError: (err: any) => {
      Alert.alert('Delete Error', err.response?.data?.message || err.message || 'Failed to remove partner');
    },
  });

  const filteredPartners = partners.filter((p: any) => {
    const q = search.toLowerCase();
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.address && p.address.toLowerCase().includes(q)) ||
      (p.phone && p.phone.toLowerCase().includes(q))
    );
  });

  const handleOpenPartner = (p: any) => {
    setSelectedPartner(p);
    setDurationInput(String(p.defaultSessionDurationMinutes || 120));
  };

  const handleToggleStatus = (p: any) => {
    const newStatus = p.status === 'Active' ? 'Inactive' : 'Active';
    updateMutation.mutate({ id: p._id || p.id, updates: { status: newStatus } });
  };

  const handleSaveDuration = () => {
    if (!selectedPartner) return;
    const dur = parseInt(durationInput);
    if (isNaN(dur) || dur < 15 || dur > 600) {
      Alert.alert('Invalid Duration', 'Please enter session duration between 15 and 600 minutes.');
      return;
    }
    updateMutation.mutate({
      id: selectedPartner._id || selectedPartner.id,
      updates: { defaultSessionDurationMinutes: dur },
    });
  };

  const handleDeletePartner = () => {
    if (!selectedPartner) return;
    Alert.alert(
      'Confirm Removal',
      `Are you sure you want to remove ${selectedPartner.name}? This will remove associated admin accounts.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove Gym',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(selectedPartner._id || selectedPartner.id),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <Card style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Building2 size={24} color="#B9983D" />
          <Typography variant="h2" style={styles.headerTitle}>Partner Control Hub (A-Z)</Typography>
        </View>
        <Typography variant="caption" color="secondary" style={{ marginTop: 4 }}>
          Manage onboarded partner gyms, enable/disable FitPass access, and configure default session durations.
        </Typography>
      </Card>

      {/* Search Controls */}
      <View style={styles.searchContainer}>
        <Input
          placeholder="Search partner gym by name or location..."
          value={search}
          onChangeText={setSearch}
          style={{ flex: 1 }}
        />
      </View>

      {/* Roster Table List */}
      {isLoading ? (
        <ActivityIndicator size="large" color="#ffe01b" style={{ marginVertical: 30 }} />
      ) : filteredPartners.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Typography variant="body" color="secondary">No partner gyms match your search query.</Typography>
        </Card>
      ) : (
        <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
          {filteredPartners.map((p: any) => {
            const isActive = p.status === 'Active';
            return (
              <TouchableOpacity
                key={p._id || p.id}
                style={styles.partnerRowCard}
                onPress={() => handleOpenPartner(p)}
                activeOpacity={0.88}
              >
                <View style={styles.partnerMainInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Typography variant="h3" style={{ fontWeight: '800', color: '#1A1510' }}>
                      {p.name}
                    </Typography>
                    {p.isBranch && <Badge label="Branch" variant="info" />}
                  </View>

                  {p.address && (
                    <View style={styles.iconInfoRow}>
                      <MapPin size={13} color="#655B50" />
                      <Typography variant="caption" color="secondary" numberOfLines={1}>{p.address}</Typography>
                    </View>
                  )}

                  {p.phone && (
                    <View style={styles.iconInfoRow}>
                      <Phone size={13} color="#655B50" />
                      <Typography variant="caption" color="secondary">{p.phone}</Typography>
                    </View>
                  )}
                </View>

                <View style={styles.partnerMetaSide}>
                  <Badge label={isActive ? 'Active' : 'Suspended'} variant={isActive ? 'active' : 'expired'} />
                  <Typography variant="caption" color="muted" style={{ marginTop: 6, fontSize: 10 }}>
                    ⏱️ {p.defaultSessionDurationMinutes || 120}m duration
                  </Typography>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Deep Partner Detail Inspection Modal */}
      {selectedPartner && (
        <Modal transparent animationType="slide" visible={!!selectedPartner}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Typography variant="h2" style={{ fontWeight: '900', color: '#1A1510' }}>
                  {selectedPartner.name}
                </Typography>
                <TouchableOpacity onPress={() => setSelectedPartner(null)}>
                  <XCircle size={24} color="#655B50" />
                </TouchableOpacity>
              </View>

              <ScrollView bounces={false} style={{ maxHeight: 420 }}>
                <View style={styles.modalSection}>
                  <Typography variant="caption" color="secondary" style={styles.sectionLabel}>GYM DETAILS</Typography>
                  <Typography variant="bodySm" style={{ color: '#1A1510' }}>📍 {selectedPartner.address || 'Address not listed'}</Typography>
                  <Typography variant="bodySm" style={{ color: '#1A1510', marginTop: 4 }}>📞 {selectedPartner.phone || 'Phone not listed'}</Typography>
                  <Typography variant="bodySm" style={{ color: '#1A1510', marginTop: 4 }}>✉️ {selectedPartner.email || 'Email not listed'}</Typography>
                </View>

                {selectedPartner.admins && selectedPartner.admins.length > 0 && (
                  <View style={styles.modalSection}>
                    <Typography variant="caption" color="secondary" style={styles.sectionLabel}>GYM MANAGER / ADMIN</Typography>
                    {selectedPartner.admins.map((a: any) => (
                      <Typography key={a._id} variant="bodySm" style={{ fontWeight: '700', color: '#1A1510' }}>
                        👤 {a.name} ({a.email})
                      </Typography>
                    ))}
                  </View>
                )}

                <View style={styles.modalSection}>
                  <Typography variant="caption" color="secondary" style={styles.sectionLabel}>FITPASS SESSION PARAMETERS</Typography>
                  <Typography variant="caption" color="muted" style={{ marginBottom: 8 }}>
                    Default active session duration (minutes) for FitPass QR check-ins at this partner facility:
                  </Typography>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <Input
                      placeholder="Duration in mins"
                      value={durationInput}
                      onChangeText={setDurationInput}
                      keyboardType="number-pad"
                      style={{ width: 140 }}
                    />
                    <Button
                      title="Save"
                      onPress={handleSaveDuration}
                      loading={updateMutation.isPending}
                      style={{ height: 48, minHeight: 48 }}
                    />
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Typography variant="caption" color="secondary" style={styles.sectionLabel}>SUPER-ADMIN ACTIONS</Typography>
                  <View style={{ gap: 10, marginTop: 4 }}>
                    <Button
                      title={selectedPartner.status === 'Active' ? 'Suspend Partner Access' : 'Activate Partner Access'}
                      onPress={() => handleToggleStatus(selectedPartner)}
                      loading={updateMutation.isPending}
                      style={{ backgroundColor: selectedPartner.status === 'Active' ? '#C62828' : '#2E7D32' }}
                    />
                    <Button
                      title="Remove Partner Gym"
                      onPress={handleDeletePartner}
                      loading={deleteMutation.isPending}
                      style={{ backgroundColor: '#1A1510' }}
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
  partnerRowCard: {
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
  partnerMainInfo: {
    flex: 1,
    marginRight: 12,
  },
  iconInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  partnerMetaSide: {
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
    maxWidth: 420,
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
    marginBottom: 18,
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
    marginBottom: 6,
  },
});

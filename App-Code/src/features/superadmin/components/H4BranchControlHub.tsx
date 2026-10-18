import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal as RNModal } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Building2, MapPin, Phone, Mail, User, QrCode, Edit3, Trash2, Users, DollarSign, Sparkles } from '@/components/ui/app-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_CLIENT } from '@/lib/api-client';
import { Typography, Input, Button, Badge, Modal } from '@/components/ui';
import { theme } from '@/design-system/theme';
import { useAuth } from '@/features/auth/hooks/useAuth';

export const H4BranchControlHub: React.FC = () => {
  const queryClient = useQueryClient();
  const selectedGymId = useAuth((s) => s.selectedGymId);
  const [search, setSearch] = useState('');
  
  // Modals
  const [editingBranch, setEditingBranch] = useState<any | null>(null);
  const [qrBranch, setQrBranch] = useState<any | null>(null);

  // Fetch branches and gyms
  const { data: gyms = [], isLoading } = useQuery<any[]>({
    queryKey: ['h4-branches-list'],
    queryFn: async () => {
      const { data } = await API_CLIENT.get('/superadmin/gyms');
      return data || [];
    },
  });

  // Filter H4 branches / gyms
  const h4Branches = gyms.filter((g: any) => g.isBranch || (g.name && g.name.toLowerCase().includes('h4')));

  const filtered = h4Branches.filter((b: any) => {
    const q = search.toLowerCase();
    return (
      (b.name && b.name.toLowerCase().includes(q)) ||
      (b.address && b.address.toLowerCase().includes(q)) ||
      (b.phone && b.phone.toLowerCase().includes(q)) ||
      (b.managerName && b.managerName.toLowerCase().includes(q))
    );
  });

  // Update Branch Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data } = await API_CLIENT.put(`/superadmin/gyms/${id}`, updates);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['h4-branches-list'] });
      Alert.alert('Success', 'Branch details updated successfully');
      setEditingBranch(null);
    },
    onError: (err: any) => {
      Alert.alert('Update Error', err.response?.data?.message || err.message || 'Failed to update branch');
    },
  });

  // Delete Branch Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await API_CLIENT.delete(`/superadmin/gyms/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['h4-branches-list'] });
      Alert.alert('Success', 'Branch deleted successfully');
    },
    onError: (err: any) => {
      Alert.alert('Delete Error', err.response?.data?.message || err.message || 'Failed to delete branch');
    },
  });

  const handleSaveEdit = () => {
    if (!editingBranch) return;
    if (!editingBranch.name) {
      Alert.alert('Validation Error', 'Branch name is required');
      return;
    }
    updateMutation.mutate({
      id: editingBranch._id || editingBranch.id,
      updates: {
        name: editingBranch.name,
        address: editingBranch.address,
        phone: editingBranch.phone,
        email: editingBranch.email,
        managerName: editingBranch.managerName,
        status: editingBranch.status || 'Active',
      },
    });
  };

  const handleToggleStatus = (b: any) => {
    const newStatus = b.status === 'Active' ? 'Inactive' : 'Active';
    updateMutation.mutate({
      id: b._id || b.id,
      updates: { status: newStatus },
    });
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete H4 Branch',
      'Are you sure you want to delete this branch location? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(id),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Info Banner */}
      <View style={styles.bannerCard}>
        <View style={styles.bannerLeft}>
          <View style={styles.badgePill}>
            <Sparkles size={12} color={theme.colors.primary} />
            <Typography variant="caption" style={styles.badgePillText}>
              PHYSICAL BRANCH CONTROL
            </Typography>
          </View>
          <Typography variant="h1" style={styles.bannerTitle}>
            H4 Branch Directory (A-Z)
          </Typography>
          <Typography variant="caption" color="secondary">
            Inspect physical centers, edit branch manager assignments, phone, email, and generate check-in QR codes.
          </Typography>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Input
          placeholder="Search branch by name, location, manager, or phone..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Branch List */}
      {isLoading ? (
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginVertical: 30 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <Typography variant="bodySm" color="secondary">No H4 branches found matching your search query.</Typography>
        </View>
      ) : (
        <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
          {filtered.map((b: any) => {
            const isActive = b.status !== 'Inactive';
            return (
              <View key={b._id || b.id} style={styles.branchRowCard}>
                {/* Header Row */}
                <View style={styles.cardTopRow}>
                  <View style={styles.branchIconWrapper}>
                    <Building2 size={22} color={theme.colors.primary} />
                  </View>
                  <View style={styles.branchMainInfo}>
                    <View style={styles.titleStatusRow}>
                      <Typography variant="h3" style={styles.branchNameText}>
                        {b.name}
                      </Typography>
                      <TouchableOpacity onPress={() => handleToggleStatus(b)} activeOpacity={0.7}>
                        <Badge label={isActive ? 'Active' : 'Inactive'} variant={isActive ? 'active' : 'expired'} />
                      </TouchableOpacity>
                    </View>

                    {b.address ? (
                      <View style={styles.iconInfoRow}>
                        <MapPin size={13} color={theme.colors.textSecondary} />
                        <Typography variant="caption" color="secondary" numberOfLines={1}>{b.address}</Typography>
                      </View>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    onPress={() => setQrBranch(b)}
                    style={styles.qrIconWrapper}
                    activeOpacity={0.7}
                  >
                    <QrCode color={theme.colors.primary} size={18} />
                  </TouchableOpacity>
                </View>

                <View style={styles.divider} />

                {/* All Detailed Metadata Fields */}
                <View style={styles.detailSection}>
                  <View style={styles.iconInfoRow}>
                    <User size={14} color={theme.colors.primary} />
                    <Typography variant="bodySm" style={styles.detailTextBold}>
                      Branch Manager: <Typography variant="bodySm" color="secondary">{b.managerName || 'Not Assigned'}</Typography>
                    </Typography>
                  </View>

                  <View style={styles.iconInfoRow}>
                    <Phone size={14} color={theme.colors.textSecondary} />
                    <Typography variant="bodySm" color="secondary">
                      Phone: {b.phone || 'N/A'}
                    </Typography>
                  </View>

                  <View style={styles.iconInfoRow}>
                    <Mail size={14} color={theme.colors.textSecondary} />
                    <Typography variant="bodySm" color="secondary">
                      Email: {b.email || 'N/A'}
                    </Typography>
                  </View>

                  {/* Members & Revenue Stats Badges */}
                  <View style={styles.statsMetricsRow}>
                    <View style={styles.statMetric}>
                      <Users size={14} color={theme.colors.primary} />
                      <Typography variant="caption" color="primary">
                        {b.memberCount || 0} Members
                      </Typography>
                    </View>
                    <View style={styles.statMetric}>
                      <DollarSign size={14} color={theme.colors.success} />
                      <Typography variant="caption" color="success">
                        INR {b.totalRevenue || 0} Revenue
                      </Typography>
                    </View>
                  </View>
                </View>

                {/* Action Buttons: EDIT & DELETE */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => setEditingBranch(b)}
                    activeOpacity={0.7}
                  >
                    <Edit3 size={14} color={theme.colors.primary} />
                    <Typography variant="caption" style={styles.editBtnText}>Edit Branch</Typography>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(b._id || b.id)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={14} color={theme.colors.error} />
                    <Typography variant="caption" style={styles.deleteBtnText}>Delete</Typography>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* EDIT BRANCH MODAL */}
      <Modal
        visible={editingBranch !== null}
        onClose={() => setEditingBranch(null)}
        title="Edit Branch Details"
      >
        {editingBranch && (
          <ScrollView bounces={false} style={{ maxHeight: 420 }}>
            <View style={styles.modalForm}>
              <Input
                label="Branch Name *"
                value={editingBranch.name || ''}
                onChangeText={(val) => setEditingBranch({ ...editingBranch, name: val })}
                placeholder="e.g. H4 Fitness Main Center"
              />
              <Input
                label="Branch Address"
                value={editingBranch.address || ''}
                onChangeText={(val) => setEditingBranch({ ...editingBranch, address: val })}
                placeholder="e.g. 12 Park Avenue, South District"
              />
              <Input
                label="Manager Name"
                value={editingBranch.managerName || ''}
                onChangeText={(val) => setEditingBranch({ ...editingBranch, managerName: val })}
                placeholder="e.g. Sanjai Pandian"
              />
              <Input
                label="Phone Number"
                value={editingBranch.phone || ''}
                onChangeText={(val) => setEditingBranch({ ...editingBranch, phone: val })}
                placeholder="e.g. +91 98765 43210"
                keyboardType="phone-pad"
              />
              <Input
                label="Email Address"
                value={editingBranch.email || ''}
                onChangeText={(val) => setEditingBranch({ ...editingBranch, email: val })}
                placeholder="e.g. branch@h4gyms.com"
                keyboardType="email-address"
              />

              <Button
                title="Save Branch Changes"
                loading={updateMutation.isPending}
                onPress={handleSaveEdit}
                style={{ marginTop: theme.spacing.md }}
              />
            </View>
          </ScrollView>
        )}
      </Modal>

      {/* BRANCH CHECK-IN QR CODE MODAL */}
      <RNModal
        visible={qrBranch !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setQrBranch(null)}
      >
        <TouchableOpacity
          style={styles.qrOverlay}
          activeOpacity={1}
          onPress={() => setQrBranch(null)}
        >
          <View style={styles.qrCard} onStartShouldSetResponder={() => true}>
            <Typography variant="h3" style={styles.qrTitle}>{qrBranch?.name}</Typography>
            <Typography variant="caption" color="secondary" style={styles.qrSubtitle}>
              Members scan this QR code on check-in to verify entry at this H4 branch location.
            </Typography>
            <View style={styles.qrWrapper}>
              {qrBranch && (
                <QRCode
                  value={JSON.stringify({ 
                    gymId: qrBranch.parentGymId || qrBranch.gymId || selectedGymId || qrBranch._id || qrBranch.id,
                    branchId: qrBranch._id || qrBranch.id, 
                    gymName: qrBranch.name 
                  })}
                  size={200}
                  backgroundColor="#fff"
                />
              )}
            </View>
            <Button
              title="Close QR Code"
              variant="secondary"
              onPress={() => setQrBranch(null)}
              style={{ marginTop: theme.spacing.lg, width: '100%' }}
            />
          </View>
        </TouchableOpacity>
      </RNModal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 20,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
  bannerCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  bannerLeft: {
    gap: 4,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(240, 160, 32, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgePillText: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.8,
  },
  bannerTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  searchContainer: {
    marginBottom: theme.spacing.xs,
  },
  emptyCard: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  listScroll: {
    flex: 1,
  },
  branchRowCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.xs,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  branchIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(240, 160, 32, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchMainInfo: {
    flex: 1,
    gap: 2,
  },
  titleStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: 4,
  },
  branchNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
  },
  iconInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  detailTextBold: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.xs,
  },
  detailSection: {
    gap: theme.spacing.xs,
  },
  statsMetricsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  statMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.bgTertiary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(240, 160, 32, 0.12)',
    paddingVertical: 8,
    borderRadius: 10,
  },
  editBtnText: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(198, 40, 40, 0.12)',
    paddingVertical: 8,
    borderRadius: 10,
  },
  deleteBtnText: {
    color: theme.colors.error,
    fontWeight: '700',
    fontSize: 12,
  },
  qrIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(240, 160, 32, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalForm: {
    gap: theme.spacing.xs,
  },
  qrOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  qrCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
  },
  qrTitle: {
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
    fontSize: 18,
    fontWeight: '700',
  },
  qrSubtitle: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: theme.spacing.lg,
  },
  qrWrapper: {
    backgroundColor: '#fff',
    padding: theme.spacing.md,
    borderRadius: 12,
  },
});

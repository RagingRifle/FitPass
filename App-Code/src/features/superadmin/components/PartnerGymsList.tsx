import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Alert, Modal as RNModal } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { MapPin, User, Settings, Edit3, Trash2, QrCode, Phone, Mail, Users, DollarSign, Plus, ShieldCheck, Building2, Sparkles } from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { 
  usePartnerGyms, 
  useCreatePartnerGym, 
  useUpdatePartnerGym, 
  useDeletePartnerGym, 
  Gym,
  Branch,
  useBranches,
  useCreateBranch,
  useUpdateBranch,
  useDeleteBranch
} from '../api/superadmin.api';
import { Button, Input, Select, Modal, Skeleton, EmptyState, Typography } from '@/components/ui';

export const PartnerGymsList: React.FC = () => {
  const toast = useToast();
  const { activeDivision, selectedGymId } = useAuth();
  
  // Queries
  const { data: gyms, isLoading: gymsLoading } = usePartnerGyms();
  const { data: branches, isLoading: branchesLoading } = useBranches();
  
  // Mutations
  const createGymMutation = useCreatePartnerGym();
  const updateGymMutation = useUpdatePartnerGym();
  const deleteGymMutation = useDeletePartnerGym();
  
  const createBranchMutation = useCreateBranch();
  const updateBranchMutation = useUpdateBranch();
  const deleteBranchMutation = useDeleteBranch();

  // Form States
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [managerName, setManagerName] = useState('');
  const [sessionHours, setSessionHours] = useState<string | number>('2');
  const [adminName, setAdminName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  
  // Modals & Action States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGym, setEditingGym] = useState<Gym | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [qrGym, setQrGym] = useState<Gym | null>(null);
  const [qrBranch, setQrBranch] = useState<Branch | null>(null);

  const isH4 = activeDivision === 'h4';
  const isLoading = isH4 ? branchesLoading : gymsLoading;

  const handleCreate = async () => {
    if (isH4) {
      if (!name) {
        toast.show('Branch name is required', 'error');
        return;
      }
      createBranchMutation.mutate({
        name,
        address,
        phone,
        email,
        managerName,
        fitPassEnabled: true,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined
      }, {
        onSuccess: () => {
          toast.show('H4 Branch created successfully!', 'success');
          resetForm();
          setShowCreateModal(false);
        },
        onError: (err: any) => {
          toast.show(err.response?.data?.message || 'Failed to create branch', 'error');
        }
      });
    } else {
      if (!name || !address || !adminName || !email || !adminPassword) {
        toast.show('Please fill in all required fields', 'error');
        return;
      }
      createGymMutation.mutate({
        gymName: name,
        gymAddress: address,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
        defaultSessionDurationMinutes: Number(sessionHours) * 60 || 120,
        adminName,
        adminEmail: email,
        adminPassword,
      }, {
        onSuccess: () => {
          toast.show('Partner gym created successfully!', 'success');
          resetForm();
          setShowCreateModal(false);
        },
        onError: (err: any) => {
          toast.show(err.response?.data?.message || 'Failed to create gym', 'error');
        }
      });
    }
  };

  const handleUpdate = () => {
    if (isH4) {
      if (!editingBranch) return;
      if (!editingBranch.name) {
        toast.show('Branch name is required', 'error');
        return;
      }
      updateBranchMutation.mutate({
        id: editingBranch._id,
        name: editingBranch.name,
        address: editingBranch.address,
        phone: editingBranch.phone,
        email: editingBranch.email,
        managerName: editingBranch.managerName,
        latitude: editingBranch.latitude ? Number(editingBranch.latitude) : undefined,
        longitude: editingBranch.longitude ? Number(editingBranch.longitude) : undefined
      }, {
        onSuccess: () => {
          toast.show('H4 Branch details updated!', 'success');
          setEditingBranch(null);
        },
        onError: (err: any) => {
          toast.show(err.response?.data?.message || 'Failed to update branch', 'error');
        }
      });
    } else {
      if (!editingGym) return;
      if (!editingGym.name || !editingGym.address) {
        toast.show('Please fill in all details', 'error');
        return;
      }
      updateGymMutation.mutate({
        id: editingGym._id,
        name: editingGym.name,
        address: editingGym.address,
        latitude: editingGym.latitude ? Number(editingGym.latitude) : undefined,
        longitude: editingGym.longitude ? Number(editingGym.longitude) : undefined
      }, {
        onSuccess: () => {
          toast.show('Partner gym details updated!', 'success');
          setEditingGym(null);
        },
        onError: (err: any) => {
          toast.show(err.response?.data?.message || 'Failed to update details', 'error');
        }
      });
    }
  };

  const handleSaveDuration = (gymId: string, hours: number) => {
    updateGymMutation.mutate({
      id: gymId,
      defaultSessionDurationMinutes: hours * 60,
    }, {
      onSuccess: () => {
        toast.show('Check-in session duration updated!', 'success');
      },
      onError: (err: any) => {
        toast.show(err.response?.data?.message || 'Failed to save configuration', 'error');
      }
    });
  };

  const handleDelete = (id: string) => {
    const title = isH4 ? 'Delete H4 Branch' : 'Delete Partner Gym';
    const msg = isH4 
      ? 'Are you sure you want to delete this branch? This action is permanent.'
      : 'Are you sure you want to delete this gym and its associated admins? This action is permanent.';
    
    Alert.alert(
      title,
      msg,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (isH4) {
              deleteBranchMutation.mutate(id, {
                onSuccess: () => {
                  toast.show('H4 Branch deleted successfully.', 'success');
                },
                onError: (err: any) => {
                  toast.show(err.response?.data?.message || 'Failed to delete branch', 'error');
                }
              });
            } else {
              deleteGymMutation.mutate(id, {
                onSuccess: () => {
                  toast.show('Partner gym deleted successfully.', 'success');
                },
                onError: (err: any) => {
                  toast.show(err.response?.data?.message || 'Failed to delete gym', 'error');
                }
              });
            }
          }
        }
      ]
    );
  };

  const resetForm = () => {
    setName('');
    setAddress('');
    setPhone('');
    setEmail('');
    setManagerName('');
    setSessionHours('2');
    setAdminName('');
    setAdminPassword('');
    setLatitude('');
    setLongitude('');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingWrapper}>
        <Skeleton height={50} style={{ borderRadius: 16, marginBottom: theme.spacing.md }} />
        {Array.from({ length: 3 }).map((_, idx) => (
          <Skeleton key={idx} height={140} style={{ borderRadius: 16, marginBottom: theme.spacing.md }} />
        ))}
      </View>
    );
  }

  const durationOptions = [
    { label: '1 Hour', value: 1 },
    { label: '2 Hours', value: 2 },
    { label: '3 Hours', value: 3 },
    { label: '4 Hours', value: 4 },
    { label: '5 Hours', value: 5 },
    { label: '6 Hours', value: 6 },
  ];

  return (
    <ScrollView 
      style={styles.scroll} 
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Banner */}
      <View style={styles.bannerCard}>
        <View style={styles.bannerLeft}>
          <View style={styles.badgePill}>
            <Sparkles size={12} color={theme.colors.primary} />
            <Typography variant="caption" style={styles.badgePillText}>
              {isH4 ? 'PHYSICAL BRANCH NETWORK' : 'PARTNER GYMS DIRECTORY'}
            </Typography>
          </View>
          <Typography variant="h1" style={styles.bannerTitle}>
            {isH4 ? 'H4 Branches' : 'Partner Gyms'}
          </Typography>
          <Typography variant="caption" color="secondary">
            {isH4 ? 'Manage H4 branch locations, staffing, and check-in QR codes.' : 'Manage network partner gyms, session limits, and admin credentials.'}
          </Typography>
        </View>

        <TouchableOpacity 
          style={styles.createBtn} 
          onPress={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          activeOpacity={0.8}
        >
          <Plus size={16} color="#FFFFFF" />
          <Typography variant="bodySm" style={styles.createBtnText}>
            {isH4 ? 'New Branch' : 'New Gym'}
          </Typography>
        </TouchableOpacity>
      </View>

      {isH4 ? (
        // H4 BRANCHES LIST
        branches?.length === 0 ? (
          <EmptyState
            iconText="🏢"
            title="No H4 Branches Found"
            description="Create H4 physical branches to manage H4 locations and check-ins."
          />
        ) : (
          branches?.map((branch) => (
            <View key={branch._id} style={styles.gymCard}>
              <View style={styles.cardHeader}>
                <View style={styles.gymIconWrapper}>
                  <Building2 size={22} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Typography variant="h3" style={styles.gymName}>{branch.name}</Typography>
                  <View style={styles.metaRow}>
                    <MapPin size={13} color={theme.colors.textSecondary} />
                    <Typography variant="caption" color="secondary" style={styles.metaText} numberOfLines={1}>
                      {branch.address || 'No Address Specified'}
                    </Typography>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setQrBranch(branch)}
                  style={styles.qrIconWrapper}
                  activeOpacity={0.7}
                >
                  <QrCode color={theme.colors.primary} size={18} />
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              <View style={styles.detailSection}>
                <View style={styles.metaRow}>
                  <User size={14} color={theme.colors.textSecondary} />
                  <Typography variant="bodySm" color="secondary" style={styles.adminLabel}>
                    Manager: {branch.managerName || 'N/A'}
                  </Typography>
                </View>

                {branch.phone && (
                  <View style={styles.metaRow}>
                    <Phone size={14} color={theme.colors.textSecondary} />
                    <Typography variant="bodySm" color="secondary" style={styles.adminLabel}>
                      Phone: {branch.phone}
                    </Typography>
                  </View>
                )}

                {branch.email && (
                  <View style={styles.metaRow}>
                    <Mail size={14} color={theme.colors.textSecondary} />
                    <Typography variant="bodySm" color="secondary" style={styles.adminLabel}>
                      Email: {branch.email}
                    </Typography>
                  </View>
                )}

                <View style={styles.statsMetricsRow}>
                  <View style={styles.statMetric}>
                    <Users size={14} color={theme.colors.primary} />
                    <Typography variant="caption" color="primary">
                      {branch.memberCount || 0} Active Members
                    </Typography>
                  </View>
                  <View style={styles.statMetric}>
                    <DollarSign size={14} color={theme.colors.success} />
                    <Typography variant="caption" color="success">
                      ₹{branch.totalRevenue || 0} Revenue
                    </Typography>
                  </View>
                </View>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => setEditingBranch(branch)}
                  activeOpacity={0.7}
                >
                  <Edit3 size={14} color={theme.colors.primary} />
                  <Typography variant="caption" style={styles.editBtnText}>Edit</Typography>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(branch._id)}
                  activeOpacity={0.7}
                >
                  <Trash2 size={14} color={theme.colors.error} />
                  <Typography variant="caption" style={styles.deleteBtnText}>Delete</Typography>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )
      ) : (
        // FITPASS PARTNER GYMS LIST
        gyms?.length === 0 ? (
          <EmptyState
            iconText="🏢"
            title="No Partner Gyms Found"
            description="Create a partner gym above to begin onboarding subscriptions and gym systems."
          />
        ) : (
          gyms?.map((gym) => {
            const currentHours = (gym.defaultSessionDurationMinutes || 120) / 60;
            return (
              <View key={gym._id} style={styles.gymCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.gymIconWrapper}>
                    <Building2 size={22} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Typography variant="h3" style={styles.gymName}>{gym.name}</Typography>
                    <View style={styles.metaRow}>
                      <MapPin size={13} color={theme.colors.textSecondary} />
                      <Typography variant="caption" color="secondary" style={styles.metaText} numberOfLines={1}>
                        {gym.address}
                      </Typography>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setQrGym(gym)}
                    style={styles.qrIconWrapper}
                    activeOpacity={0.7}
                  >
                    <QrCode color={theme.colors.primary} size={18} />
                  </TouchableOpacity>
                </View>

                <View style={styles.divider} />

                <View style={styles.detailSection}>
                  <View style={styles.metaRow}>
                    <User size={14} color={theme.colors.textSecondary} />
                    <Typography variant="bodySm" color="secondary" style={styles.adminLabel}>
                      Admin: {gym.admins?.[0]?.name || 'N/A'} ({gym.admins?.[0]?.email || ''})
                    </Typography>
                  </View>

                  <View style={styles.durationSelector}>
                    <Settings size={14} color={theme.colors.textSecondary} />
                    <Typography variant="bodySm" color="secondary" style={styles.durationText}>Session Limit:</Typography>
                    <View style={styles.selectWrapper}>
                      <Select
                        label=""
                        placeholder="Hours"
                        options={durationOptions}
                        value={currentHours}
                        onValueChange={(val) => handleSaveDuration(gym._id, Number(val))}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => setEditingGym(gym)}
                    activeOpacity={0.7}
                  >
                    <Edit3 size={14} color={theme.colors.primary} />
                    <Typography variant="caption" style={styles.editBtnText}>Edit</Typography>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(gym._id)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={14} color={theme.colors.error} />
                    <Typography variant="caption" style={styles.deleteBtnText}>Delete</Typography>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )
      )}

      {/* CREATE MODAL */}
      <Modal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={isH4 ? 'Create H4 Branch' : 'Create Partner Gym'}
      >
        <Input 
          label={isH4 ? 'Branch Name *' : 'Gym Name *'} 
          value={name} 
          onChangeText={setName} 
          placeholder={isH4 ? 'e.g. H4 Fitness South End' : 'e.g. Titan Strength Hub'} 
        />
        <Input 
          label={isH4 ? 'Branch Address' : 'Gym Address *'} 
          value={address} 
          onChangeText={setAddress} 
          placeholder="e.g. 52 Fit Street, Landmark" 
        />
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Input 
              label="Latitude" 
              value={latitude} 
              onChangeText={setLatitude} 
              placeholder="e.g. 13.0827" 
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input 
              label="Longitude" 
              value={longitude} 
              onChangeText={setLongitude} 
              placeholder="e.g. 80.2707" 
              keyboardType="numeric"
            />
          </View>
        </View>
        
        {isH4 ? (
          <>
            <Input 
              label="Manager Name" 
              value={managerName} 
              onChangeText={setManagerName} 
              placeholder="e.g. Sanjai Pandian" 
            />
            <Input 
              label="Phone Number" 
              value={phone} 
              onChangeText={setPhone} 
              placeholder="e.g. +91 98765 43210" 
              keyboardType="phone-pad"
            />
            <Input 
              label="Email Address" 
              value={email} 
              onChangeText={setEmail} 
              placeholder="e.g. south@h4gyms.com" 
              keyboardType="email-address"
            />
          </>
        ) : (
          <>
            <Select
              label="Default Session Limit *"
              options={[
                { label: '1 Hour', value: '1' },
                { label: '2 Hours', value: '2' },
                { label: '3 Hours', value: '3' },
                { label: '4 Hours', value: '4' },
              ]}
              value={sessionHours}
              onValueChange={setSessionHours}
            />

            <View style={styles.modalSectionHeader}>
              <Typography variant="body" style={styles.modalSectionTitle}>Owner / Admin Credentials</Typography>
            </View>

            <Input 
              label="Admin Account Name *" 
              value={adminName} 
              onChangeText={setAdminName} 
              placeholder="e.g. John Doe" 
            />
            <Input 
              label="Admin Account Email *" 
              value={email} 
              onChangeText={setEmail} 
              placeholder="e.g. admin@gym.com" 
              keyboardType="email-address"
            />
            <Input 
              label="Admin Account Password *" 
              value={adminPassword} 
              onChangeText={setAdminPassword} 
              placeholder="••••••••" 
              secureTextEntry 
            />
          </>
        )}

        <Button
          title={isH4 ? 'Create Branch' : 'Create Partner Gym'}
          loading={isH4 ? createBranchMutation.isPending : createGymMutation.isPending}
          onPress={handleCreate}
          style={{ marginTop: theme.spacing.lg }}
        />
      </Modal>

      {/* EDIT MODAL */}
      {isH4 ? (
        <Modal
          visible={editingBranch !== null}
          onClose={() => setEditingBranch(null)}
          title="Edit Branch Details"
        >
          {editingBranch && (
            <>
              <Input
                label="Branch Name *"
                value={editingBranch.name}
                onChangeText={(val) => setEditingBranch({ ...editingBranch, name: val })}
              />
              <Input
                label="Branch Address"
                value={editingBranch.address || ''}
                onChangeText={(val) => setEditingBranch({ ...editingBranch, address: val })}
              />
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: theme.spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Input 
                    label="Latitude" 
                    value={editingBranch.latitude !== undefined && editingBranch.latitude !== null ? String(editingBranch.latitude) : ''} 
                    onChangeText={(val) => setEditingBranch({ ...editingBranch, latitude: val ? Number(val) : undefined })} 
                    placeholder="e.g. 13.0827" 
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input 
                    label="Longitude" 
                    value={editingBranch.longitude !== undefined && editingBranch.longitude !== null ? String(editingBranch.longitude) : ''} 
                    onChangeText={(val) => setEditingBranch({ ...editingBranch, longitude: val ? Number(val) : undefined })} 
                    placeholder="e.g. 80.2707" 
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <Input
                label="Manager Name"
                value={editingBranch.managerName || ''}
                onChangeText={(val) => setEditingBranch({ ...editingBranch, managerName: val })}
              />
              <Input
                label="Phone Number"
                value={editingBranch.phone || ''}
                onChangeText={(val) => setEditingBranch({ ...editingBranch, phone: val })}
                keyboardType="phone-pad"
              />
              <Input
                label="Email Address"
                value={editingBranch.email || ''}
                onChangeText={(val) => setEditingBranch({ ...editingBranch, email: val })}
                keyboardType="email-address"
              />
              <Button
                title="Save Branch Details"
                loading={updateBranchMutation.isPending}
                onPress={handleUpdate}
                style={{ marginTop: theme.spacing.lg }}
              />
            </>
          )}
        </Modal>
      ) : (
        <Modal
          visible={editingGym !== null}
          onClose={() => setEditingGym(null)}
          title="Edit Partner Gym"
        >
          {editingGym && (
            <>
              <Input
                label="Gym Name *"
                value={editingGym.name}
                onChangeText={(val) => setEditingGym({ ...editingGym, name: val })}
              />
              <Input
                label="Gym Address *"
                value={editingGym.address}
                onChangeText={(val) => setEditingGym({ ...editingGym, address: val })}
              />
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: theme.spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Input 
                    label="Latitude" 
                    value={editingGym.latitude !== undefined && editingGym.latitude !== null ? String(editingGym.latitude) : ''} 
                    onChangeText={(val) => setEditingGym({ ...editingGym, latitude: val ? Number(val) : undefined })} 
                    placeholder="e.g. 13.0827" 
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input 
                    label="Longitude" 
                    value={editingGym.longitude !== undefined && editingGym.longitude !== null ? String(editingGym.longitude) : ''} 
                    onChangeText={(val) => setEditingGym({ ...editingGym, longitude: val ? Number(val) : undefined })} 
                    placeholder="e.g. 80.2707" 
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <Button
                title="Save Gym Details"
                loading={updateGymMutation.isPending}
                onPress={handleUpdate}
                style={{ marginTop: theme.spacing.lg }}
              />
            </>
          )}
        </Modal>
      )}

      {/* QR MODALS */}
      <RNModal
        visible={qrGym !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setQrGym(null)}
      >
        <TouchableOpacity
          style={styles.qrOverlay}
          activeOpacity={1}
          onPress={() => setQrGym(null)}
        >
          <View style={styles.qrCard} onStartShouldSetResponder={() => true}>
            <Typography variant="h3" style={styles.qrTitle}>{qrGym?.name}</Typography>
            <Typography variant="caption" color="secondary" style={styles.qrSubtitle}>
              Members scan this QR code on check-in to access this gym location.
            </Typography>
            <View style={styles.qrWrapper}>
              {qrGym && (
                <QRCode
                  value={JSON.stringify({ gymId: qrGym._id, gymName: qrGym.name })}
                  size={200}
                  backgroundColor="#fff"
                />
              )}
            </View>
            <Button
              title="Close"
              variant="secondary"
              onPress={() => setQrGym(null)}
              style={{ marginTop: theme.spacing.lg, width: '100%' }}
            />
          </View>
        </TouchableOpacity>
      </RNModal>

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
              Members scan this QR code on check-in to access this H4 branch.
            </Typography>
            <View style={styles.qrWrapper}>
              {qrBranch && (qrBranch.parentGymId || qrBranch.gymId || selectedGymId) && (
                <QRCode
                  value={JSON.stringify({
                    gymId: qrBranch.parentGymId || qrBranch.gymId || selectedGymId,
                    branchId: qrBranch._id || qrBranch.id,
                    gymName: qrBranch.name,
                  })}
                  size={200}
                  backgroundColor="#fff"
                />
              )}
            </View>
            <Button
              title="Close"
              variant="secondary"
              onPress={() => setQrBranch(null)}
              style={{ marginTop: theme.spacing.lg, width: '100%' }}
            />
          </View>
        </TouchableOpacity>
      </RNModal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing['2xl'],
    gap: theme.spacing.lg,
  },
  loadingWrapper: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: theme.spacing.md,
  },
  bannerCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  bannerLeft: {
    flex: 1,
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
  createBtn: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  gymCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  gymIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(240, 160, 32, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gymName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  metaText: {
    color: theme.colors.textSecondary,
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
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.xs,
  },
  detailSection: {
    gap: theme.spacing.xs,
  },
  adminLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  durationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  durationText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  selectWrapper: {
    width: 130,
    height: 38,
    marginLeft: theme.spacing.xs,
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
  modalSectionHeader: {
    marginTop: theme.spacing.md,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    paddingBottom: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  modalSectionTitle: {
    fontWeight: '700',
    color: theme.colors.primary,
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
});

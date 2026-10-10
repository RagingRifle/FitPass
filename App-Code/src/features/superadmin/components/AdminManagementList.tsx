import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Alert } from 'react-native';
import { Trash2, Edit3 } from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';
import { useToast } from '@/hooks/useToast';
import { 
  useDedicatedAdmins, 
  useCreateDedicatedAdmin, 
  useUpdateDedicatedAdmin, 
  useDeleteDedicatedAdmin,
  DedicatedAdmin
} from '../api/superadmin.api';
import { Card, Button, Input, Select, Modal, Skeleton, EmptyState, Badge, Typography } from '@/components/ui';

export const AdminManagementList: React.FC = () => {
  const toast = useToast();
  
  // Queries & Mutations
  const { data: admins, isLoading } = useDedicatedAdmins();
  const createAdminMutation = useCreateDedicatedAdmin();
  const updateAdminMutation = useUpdateDedicatedAdmin();
  const deleteAdminMutation = useDeleteDedicatedAdmin();

  // Create Form States
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'fitpass_admin' | 'h4_admin'>('fitpass_admin');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Edit Form States
  const [editingAdmin, setEditingAdmin] = useState<DedicatedAdmin | null>(null);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editStatus, setEditStatus] = useState('Active');

  const handleCreate = () => {
    if (!name || !email || !password || !role) {
      toast.show('Please fill in all fields', 'error');
      return;
    }

    if (password.length < 6) {
      toast.show('Password must be at least 6 characters', 'error');
      return;
    }

    createAdminMutation.mutate({
      name,
      email,
      password,
      role,
    }, {
      onSuccess: () => {
        toast.show('Administrator account provisioned successfully!', 'success');
        setName('');
        setEmail('');
        setPassword('');
        setRole('fitpass_admin');
        setShowCreateModal(false);
      },
      onError: (err: any) => {
        toast.show(err.response?.data?.message || 'Failed to create administrator account', 'error');
      }
    });
  };

  const handleEditClick = (admin: DedicatedAdmin) => {
    setEditingAdmin(admin);
    setEditName(admin.name);
    setEditPassword('');
    setEditStatus(admin.status || 'Active');
  };

  const handleUpdate = () => {
    if (!editingAdmin) return;
    if (!editName) {
      toast.show('Name is required', 'error');
      return;
    }

    const payload: any = {
      id: editingAdmin._id,
      name: editName,
      status: editStatus,
    };

    if (editPassword) {
      if (editPassword.length < 6) {
        toast.show('Password must be at least 6 characters', 'error');
        return;
      }
      payload.password = editPassword;
    }

    updateAdminMutation.mutate(payload, {
      onSuccess: () => {
        toast.show('Administrator account updated successfully.', 'success');
        setEditingAdmin(null);
      },
      onError: (err: any) => {
        toast.show(err.response?.data?.message || 'Failed to update administrator account', 'error');
      }
    });
  };

  const handleDelete = (adminId: string) => {
    Alert.alert(
      'Revoke Admin Access',
      'Are you sure you want to permanently revoke this administrator access?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: () => {
            deleteAdminMutation.mutate(adminId, {
              onSuccess: () => {
                toast.show('Administrator access revoked.', 'success');
              },
              onError: (err: any) => {
                toast.show(err.response?.data?.message || 'Failed to revoke administrator access', 'error');
              }
            });
          }
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <View>
        <Skeleton height={48} style={{ marginBottom: theme.spacing.lg }} />
        {Array.from({ length: 3 }).map((_, idx) => (
          <Skeleton key={idx} height={120} style={{ marginBottom: theme.spacing.md }} />
        ))}
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      <Button
        title="+ Provision Admin Account"
        onPress={() => setShowCreateModal(true)}
        style={{ marginBottom: theme.spacing.lg }}
      />

      {admins?.length === 0 ? (
        <EmptyState
          iconText="🛡️"
          title="No Dedicated Admins Configured"
          description="Create a dedicated FitPass or H4 admin to delegate access control."
        />
      ) : (
        admins?.map((admin) => (
          <Card key={admin._id} style={styles.adminCard}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Typography variant="h3" style={styles.adminName}>{admin.name}</Typography>
                <Typography variant="caption" color="secondary" style={styles.adminEmail}>
                  {admin.email}
                </Typography>
              </View>
              <View style={styles.badgeContainer}>
                <Badge 
                  label={admin.role === 'fitpass_admin' ? 'FitPass Admin' : 'H4 Gym Admin'} 
                  variant={admin.role === 'fitpass_admin' ? 'active' : 'info'} 
                  style={styles.badge}
                />
                <Badge 
                  label={admin.status || 'Active'} 
                  variant={admin.status === 'Inactive' ? 'expired' : 'active'} 
                  style={styles.badge}
                />
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.actionRow}>
              <Button
                title="Edit"
                variant="secondary"
                icon={<Edit3 size={14} color={theme.colors.text} />}
                onPress={() => handleEditClick(admin)}
                style={styles.actionBtn}
              />
              <Button
                title="Revoke"
                variant="danger"
                icon={<Trash2 size={14} color={theme.colors.error} />}
                onPress={() => handleDelete(admin._id)}
                style={styles.actionBtn}
              />
            </View>
          </Card>
        ))
      )}

      {/* CREATE ADMIN MODAL */}
      <Modal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Provision Dedicated Admin"
      >
        <Input
          label="Name *"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Rachel Green"
        />
        <Input
          label="Email Address *"
          value={email}
          onChangeText={setEmail}
          placeholder="e.g. rachel@fitprime.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Input
          label="Password *"
          value={password}
          onChangeText={setPassword}
          placeholder="Minimum 6 characters"
          secureTextEntry
          autoCapitalize="none"
        />
        <Select
          label="Administrative Role *"
          options={[
            { label: 'FitPass Admin (Global network)', value: 'fitpass_admin' },
            { label: 'H4 Admin (Locked to H4 Gym/branches)', value: 'h4_admin' },
          ]}
          value={role}
          onValueChange={(val) => setRole(val as 'fitpass_admin' | 'h4_admin')}
        />

        <Button
          title="Provision Account"
          loading={createAdminMutation.isPending}
          onPress={handleCreate}
          style={{ marginTop: theme.spacing.lg }}
        />
      </Modal>

      {/* EDIT ADMIN MODAL */}
      <Modal
        visible={editingAdmin !== null}
        onClose={() => setEditingAdmin(null)}
        title="Modify Administrator Settings"
      >
        {editingAdmin && (
          <>
            <Input
              label="Name *"
              value={editName}
              onChangeText={setEditName}
            />
            <Input
              label="Password Reset (leave empty to keep current)"
              value={editPassword}
              onChangeText={setEditPassword}
              placeholder="Enter new password"
              secureTextEntry
              autoCapitalize="none"
            />
            <Select
              label="Status *"
              options={[
                { label: 'Active', value: 'Active' },
                { label: 'Inactive', value: 'Inactive' },
              ]}
              value={editStatus}
              onValueChange={(val) => setEditStatus(String(val))}
            />

            <Button
              title="Save Changes"
              loading={updateAdminMutation.isPending}
              onPress={handleUpdate}
              style={{ marginTop: theme.spacing.lg }}
            />
          </>
        )}
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  adminCard: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  adminName: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  adminEmail: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  badgeContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  badge: {
    paddingHorizontal: theme.spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionBtn: {
    flex: 1,
    minHeight: 40,
  },
});

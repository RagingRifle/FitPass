import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Ticket, Trash2, Edit3, Plus, Sparkles } from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';
import { useToast } from '@/hooks/useToast';
import { 
  useFitPrimePlans, 
  useCreateFitPrimePlan, 
  useUpdateFitPrimePlan, 
  useDeleteFitPrimePlan,
  FitPrimePlan
} from '../api/superadmin.api';
import { Button, Input, Modal, Skeleton, EmptyState, Badge, Typography } from '@/components/ui';

export const FitPrimePlansList: React.FC = () => {
  const toast = useToast();
  const { data: plans, isLoading } = useFitPrimePlans();
  const createPlanMutation = useCreateFitPrimePlan();
  const updatePlanMutation = useUpdateFitPrimePlan();
  const deletePlanMutation = useDeleteFitPrimePlan();

  // Create/Edit Form States
  const [editingPlan, setEditingPlan] = useState<FitPrimePlan | null>(null);
  const [name, setName] = useState('');
  const [sessions, setSessions] = useState('');
  const [price, setPrice] = useState('');
  const [showModal, setShowModal] = useState(false);

  const openCreateModal = () => {
    setEditingPlan(null);
    setName('');
    setSessions('');
    setPrice('');
    setShowModal(true);
  };

  const openEditModal = (plan: FitPrimePlan) => {
    setEditingPlan(plan);
    setName(plan.name);
    setSessions(String(plan.sessions));
    setPrice(String(plan.price));
    setShowModal(true);
  };

  const handleSave = () => {
    if (!name || !sessions || !price) {
      toast.show('Please fill in all required fields', 'error');
      return;
    }

    if (Number(sessions) <= 0) {
      toast.show('Sessions must be a positive number', 'error');
      return;
    }

    if (editingPlan) {
      // Update existing plan
      updatePlanMutation.mutate(
        {
          id: editingPlan._id,
          name,
          sessions: Number(sessions),
          price: Number(price),
        },
        {
          onSuccess: () => {
            toast.show('FitPrime plan updated successfully!', 'success');
            setShowModal(false);
          },
          onError: (err: any) => {
            toast.show(err.response?.data?.message || 'Failed to update plan', 'error');
          },
        }
      );
    } else {
      // Create new plan
      createPlanMutation.mutate(
        {
          name,
          sessions: Number(sessions),
          price: Number(price),
        },
        {
          onSuccess: () => {
            toast.show('FitPass member plan created!', 'success');
            setShowModal(false);
          },
          onError: (err: any) => {
            toast.show(err.response?.data?.message || 'Failed to create plan', 'error');
          },
        }
      );
    }
  };

  const handleDelete = (planId: string) => {
    Alert.alert(
      'Delete FitPrime Plan',
      'Are you sure you want to delete this FitPass member plan? Current members will retain remaining session balances.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deletePlanMutation.mutate(planId, {
              onSuccess: () => {
                toast.show('FitPass member plan deleted.', 'success');
              },
              onError: (err: any) => {
                toast.show(err.response?.data?.message || 'Failed to delete plan', 'error');
              },
            });
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingWrapper}>
        <Skeleton height={50} style={{ borderRadius: 16, marginBottom: theme.spacing.md }} />
        <View style={styles.grid}>
          {Array.from({ length: 4 }).map((_, idx) => (
            <View key={idx} style={styles.gridItemSkeleton}>
              <Skeleton height={150} style={{ borderRadius: 16 }} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.scroll} 
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Banner */}
      <View style={styles.bannerContainer}>
        <View style={styles.bannerLeft}>
          <View style={styles.badgePill}>
            <Sparkles size={12} color={theme.colors.primary} />
            <Typography variant="caption" style={styles.badgePillText}>
              FITPASS MEMBER SUBSCRIPTIONS
            </Typography>
          </View>
          <Typography variant="h1" style={styles.bannerTitle}>
            Subscription Plans Management
          </Typography>
          <Typography variant="caption" color="secondary">
            Configure the session passes FitPass members can purchase or renew in their portal.
          </Typography>
        </View>

        <TouchableOpacity 
          style={styles.createPillBtn} 
          onPress={openCreateModal}
          activeOpacity={0.8}
        >
          <Plus size={16} color="#FFFFFF" />
          <Typography variant="bodySm" style={styles.createBtnText}>
            New Plan
          </Typography>
        </TouchableOpacity>
      </View>

      {plans?.length === 0 ? (
        <EmptyState
          iconText="📋"
          title="No FitPass Plans Found"
          description="Create session passes for FitPass members to purchase or renew themselves."
        />
      ) : (
        <View style={styles.grid}>
          {plans?.map((plan) => (
            <View key={plan._id} style={styles.gridItem}>
              <View style={styles.planCard}>
                <View style={styles.planCardHeader}>
                  <Typography variant="body" style={styles.planName} numberOfLines={1}>
                    {plan.name}
                  </Typography>
                  <Badge label="FitPass only" variant="info" />
                </View>

                <View style={styles.priceRow}>
                  <Typography variant="h1" style={styles.priceLabel}>INR {plan.price}</Typography>
                </View>

                <View style={styles.sessionsRow}>
                  <Ticket size={14} color={theme.colors.primary} />
                  <Typography variant="bodySm" color="secondary" style={styles.sessionsText}>
                    {plan.sessions} Check-in Credits
                  </Typography>
                </View>

                <View style={styles.actionBtnRow}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => openEditModal(plan)}
                    activeOpacity={0.7}
                  >
                    <Edit3 size={14} color={theme.colors.primary} />
                    <Typography variant="caption" style={styles.editBtnText}>
                      Edit
                    </Typography>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(plan._id)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={14} color={theme.colors.error} />
                    <Typography variant="caption" style={styles.deleteBtnText}>
                      Delete
                    </Typography>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* CREATE / EDIT PLAN MODAL */}
      <Modal
        visible={showModal}
        onClose={() => setShowModal(false)}
        title={editingPlan ? 'Edit FitPrime Plan' : 'Create FitPrime Plan'}
      >
        <View style={styles.modalBody}>
          <Input
            label="Plan Name *"
            value={name}
            onChangeText={setName}
            placeholder="e.g. 10 Sessions Pass"
          />
          <Input
            label="Sessions Count (Check-in credits) *"
            value={sessions}
            onChangeText={setSessions}
            placeholder="e.g. 10"
            keyboardType="numeric"
          />
          <Input
            label="Price (INR) *"
            value={price}
            onChangeText={setPrice}
            placeholder="e.g. 1499"
            keyboardType="numeric"
          />

          <Button
            title={editingPlan ? 'Save Changes' : 'Create FitPass Plan'}
            loading={createPlanMutation.isPending || updatePlanMutation.isPending}
            onPress={handleSave}
            style={{ marginTop: theme.spacing.md }}
          />
        </View>
      </Modal>
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
  bannerContainer: {
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
  createPillBtn: {
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  gridItem: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  gridItemSkeleton: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  planCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'space-between',
    minHeight: 185,
  },
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  planName: {
    fontWeight: '700',
    color: theme.colors.text,
    flex: 1,
    marginRight: theme.spacing.xs,
    fontSize: 14,
  },
  priceRow: {
    marginVertical: theme.spacing.xs,
  },
  priceLabel: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 22,
  },
  sessionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: theme.spacing.sm,
  },
  sessionsText: {
    fontSize: 12,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
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
  modalBody: {
    gap: theme.spacing.sm,
  },
});

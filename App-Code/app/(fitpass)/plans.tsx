import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  X,
  Lock,
  LogOut,
  BadgeCheck,
  Flame,
  Award,
  Activity,
} from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';
import { fontFamilies } from '@/design-system/tokens';
import { Skeleton } from '@/components/ui';
import {
  useFitPassPlans,
  usePurchasePlan,
  useSessionStatus,
} from '@/features/fitpass/api/fitpass.api';
import { useAuth } from '@/features/auth';

export default function FitPassPlansScreen() {
  const router = useRouter();
  const logout = useAuth((s) => s.logout);
  const { data: plans, isLoading } = useFitPassPlans();
  const { data: sessionStatus } = useSessionStatus();
  const purchaseMutation = usePurchasePlan();
  const hasActivePass = sessionStatus?.planStatus === 'Active';

  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);

  const handleOpenPayModal = (plan: any) => {
    setSelectedPlan(plan);
    setIsPayModalOpen(true);
  };

  const handleConfirmTestPayment = async () => {
    if (!selectedPlan) return;
    try {
      await purchaseMutation.mutateAsync(selectedPlan.id || selectedPlan._id);
      setIsPayModalOpen(false);
      Alert.alert(
        'Pass renewed',
        `Your ${selectedPlan.name} pass is active and ${selectedPlan.sessions} sessions were added to your account.`,
        [
          {
            text: 'Go to Dashboard',
            onPress: () => router.push('/(fitpass)/dashboard'),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert(
        'Payment Error',
        err?.response?.data?.message || err?.message || 'Could not process plan subscription.'
      );
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Custom Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          
          <Text style={styles.headerEyebrow}>FITPASS MEMBERSHIP</Text>
          <Text style={styles.headerTitle}>Choose your next pass</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.7}>
          <LogOut size={16} color={theme.colors.error} />
        </TouchableOpacity>
      </View>

      <Text style={styles.headerSub}>
        Renew your sessions anytime. One pass gives you access across the FitPass partner network.
      </Text>

      {sessionStatus?.planName ? (
        <View style={styles.currentPassBox}>
          <Activity size={16} color={theme.colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.currentPassText}>
              Current pass:{' '}
              <Text style={styles.currentPassName}>
                {sessionStatus.planName}
              </Text>
            </Text>
            <Text style={styles.currentPassSub}>
              {sessionStatus.sessionsRemaining} sessions available
              {sessionStatus.expiryDate ? ` | Expires ${new Date(sessionStatus.expiryDate).toLocaleDateString()}` : ''}
            </Text>
          </View>
          <View style={[styles.activePillDot, !hasActivePass && styles.renewPill]}>
            <View style={[styles.greenDot, !hasActivePass && styles.renewDot]} />
            <Text style={[styles.activePillDotText, !hasActivePass && styles.renewPillText]}>
              {hasActivePass ? 'Active' : 'Renew'}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Plans List */}
      {isLoading ? (
        <View style={{ gap: 16 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} style={styles.planSkeletonCard} />
          ))}
        </View>
      ) : !plans || plans.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No membership plans available right now.</Text>
        </View>
      ) : (
        plans.map((plan: any, index: number) => {
          const isCurrent = sessionStatus?.planName === plan.name;
          const isPopular = index === 1 || plan.name.toLowerCase().includes('pro') || plan.name.toLowerCase().includes('unlimited');
          const costPerSession = Math.round(plan.price / (plan.sessions || 1));

          return (
            <View
              key={plan.id || plan._id}
              style={[
                styles.planCard,
                isPopular && styles.planCardPopular,
                isCurrent && styles.planCardCurrent,
              ]}
            >
              {isPopular && (
                <View style={styles.popularRibbon}>
                  <Flame size={12} color="#fff" />
                  <Text style={styles.popularRibbonText}>MOST POPULAR</Text>
                </View>
              )}

              {isCurrent && (
                <View style={styles.activeTag}>
                  <BadgeCheck size={12} color="#fff" />
                  <Text style={styles.activeTagText}>CURRENT PLAN</Text>
                </View>
              )}

              <View style={styles.planCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planSub}>
                    {plan.sessions} sessions | {plan.duration || 30} {plan.durationUnit || 'days'}
                  </Text>
                </View>
                <View style={styles.priceWrap}>
                  <Text style={styles.priceSymbol}>INR</Text>
                  <Text style={styles.priceNum}>{plan.price}</Text>
                </View>
              </View>

              <View style={styles.valueBar}>
                <Activity size={14} color={theme.colors.primary} />
                <Text style={styles.valueText}>
                  INR {costPerSession} per session | Save up to 50% vs single drop-ins
                </Text>
              </View>

              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <CheckCircle2 size={15} color="#4CAF50" />
                  <Text style={styles.featureText}>Full access to all FitPass Partner Gyms</Text>
                </View>
                <View style={styles.featureItem}>
                  <CheckCircle2 size={15} color="#4CAF50" />
                  <Text style={styles.featureText}>Instant QR code check-in attendance</Text>
                </View>
                <View style={styles.featureItem}>
                  <CheckCircle2 size={15} color="#4CAF50" />
                  <Text style={styles.featureText}>No hidden admission fees or contracts</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.buyBtn,
                  isCurrent && styles.buyBtnCurrent,
                ]}
                onPress={() => handleOpenPayModal(plan)}
                activeOpacity={0.85}
              >
                <CreditCard size={16} color="#fff" />
                <Text style={styles.buyBtnText}>
                  {isCurrent ? 'Renew this pass' : `Choose pass | INR ${plan.price}`}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}

      {/* Checkout mode stays explicit until the native Razorpay adapter is enabled. */}
      <View style={styles.reassuranceBox}>
        <ShieldCheck size={18} color={theme.colors.primary} />
        <Text style={styles.reassuranceText}>
          Demo checkout | No real payment is collected
        </Text>
      </View>

      {/* Demo checkout uses the same order and verification API as Razorpay later. */}
      <Modal
        visible={isPayModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsPayModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.payModalCard}>
            <View style={styles.payModalHeader}>
              <View style={styles.razorpayBrandRow}>
                <ShieldCheck size={20} color={theme.colors.primary} />
                <Text style={styles.razorpayTitle}>FitPass demo checkout</Text>
              </View>
              <TouchableOpacity onPress={() => setIsPayModalOpen(false)}>
                <X size={22} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {selectedPlan && (
              <View style={styles.payOrderSummary}>
                <Text style={styles.summaryLabel}>ORDER SUMMARY</Text>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryItemName}>{selectedPlan.name}</Text>
                  <Text style={styles.summaryItemPrice}>INR {selectedPlan.price}</Text>
                </View>
                <Text style={styles.summaryDetail}>
                  Adds {selectedPlan.sessions} sessions to your pass. Renewing early extends your current expiry date.
                </Text>
              </View>
            )}

            <View style={styles.testModeNotice}>
              <Lock size={14} color={theme.colors.primary} />
              <Text style={styles.testModeText}>
                This is a simulated payment. No card or bank details are needed and no money is charged.
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.confirmPayBtn,
                purchaseMutation.isPending && { opacity: 0.7 },
              ]}
              onPress={handleConfirmTestPayment}
              disabled={purchaseMutation.isPending}
              activeOpacity={0.85}
            >
              {purchaseMutation.isPending ? (
                <ActivityIndicator size="small" color="#171713" />
              ) : (
                <>
                  <CreditCard size={18} color="#171713" />
                  <Text style={styles.confirmPayText}>
                    Confirm demo payment | INR {selectedPlan?.price}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelPayBtn}
              onPress={() => setIsPayModalOpen(false)}
              disabled={purchaseMutation.isPending}
            >
              <Text style={styles.cancelPayText}>Cancel Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 110, gap: 16 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#171713', marginHorizontal: -20, marginTop: -16, paddingHorizontal: 20, paddingVertical: 18, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(240, 160, 32, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(240, 160, 32, 0.25)',
  },
  badgeText: {
    fontFamily: fontFamilies.header,
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 0.8,
  },
  headerEyebrow: {
    color: '#F5B800',
    fontFamily: fontFamilies.header,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontFamily: fontFamilies.header,
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
    letterSpacing: -0.2,
  },
  logoutBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#34332E',
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerSub: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    color: theme.colors.textMuted,
    lineHeight: 19,
  },

  currentPassBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    borderRadius: 16,
  },
  currentPassText: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  currentPassName: {
    fontFamily: fontFamilies.header,
    fontWeight: '800',
    color: theme.colors.text,
  },
  currentPassSub: {
    fontFamily: fontFamilies.body,
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  activePillDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EDF4EF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D5E5D9',
  },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CAF50' },
  activePillDotText: {
    fontFamily: fontFamilies.header,
    fontSize: 11,
    fontWeight: '700',
    color: '#4CAF50',
  },
  renewPill: { backgroundColor: '#FFF4C6', borderColor: '#F0E1A8' },
  renewDot: { backgroundColor: '#D9A900' },
  renewPillText: { color: '#5F4A00' },

  // Plan Cards
  planCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 20,
    gap: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  planCardPopular: {
    borderColor: '#D9A900',
    borderWidth: 1.5,
  },
  planCardCurrent: {
    borderColor: '#C9D9CB',
    borderWidth: 1.5,
  },
  popularRibbon: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#171713',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderBottomLeftRadius: 12,
  },
  popularRibbonText: {
    fontFamily: fontFamilies.header,
    fontSize: 10,
    fontWeight: '800',
    color: '#F5B800',
    letterSpacing: 0.5,
  },

  activeTag: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#397354',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderBottomRightRadius: 12,
  },
  activeTagText: {
    fontFamily: fontFamilies.header,
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },

  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  planName: {
    fontFamily: fontFamilies.header,
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
  },
  planSub: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  priceWrap: { flexDirection: 'row', alignItems: 'flex-start' },
  priceSymbol: {
    fontFamily: fontFamilies.header,
    fontSize: 16,
    fontWeight: '800',
    color: '#8D6A00',
    marginTop: 3,
  },
  priceNum: {
    fontFamily: fontFamilies.header,
    fontSize: 30,
    fontWeight: '900',
    color: '#8D6A00',
  },

  valueBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF8DF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F0E1A8',
  },
  valueText: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    fontWeight: '700',
    color: '#5F4A00',
  },

  featureList: { gap: 10 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: '500',
  },

  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#171713',
    height: 48,
    borderRadius: 14,
  },
  buyBtnCurrent: {
    backgroundColor: '#171713',
  },
  buyBtnText: {
    fontFamily: fontFamilies.header,
    fontSize: 15,
    fontWeight: '800',
    color: '#F5B800',
    letterSpacing: 0.3,
  },

  reassuranceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  reassuranceText: {
    fontFamily: fontFamilies.body,
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },

  emptyBox: { padding: 30, alignItems: 'center' },
  emptyText: {
    fontFamily: fontFamilies.body,
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  planSkeletonCard: { height: 210, borderRadius: 20 },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 19, 15, 0.58)',
    justifyContent: 'flex-end',
  },
  payModalCard: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  payModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  razorpayBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  razorpayTitle: {
    fontFamily: fontFamilies.header,
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },

  payOrderSummary: {
    backgroundColor: theme.colors.background,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  summaryLabel: {
    fontFamily: fontFamilies.header,
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 0.8,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryItemName: {
    fontFamily: fontFamilies.header,
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  summaryItemPrice: {
    fontFamily: fontFamilies.header,
    fontSize: 22,
    fontWeight: '900',
    color: theme.colors.primary,
  },
  summaryDetail: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 17,
  },

  testModeNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF8DF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0E1A8',
  },
  testModeText: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    color: theme.colors.textMuted,
    flex: 1,
    lineHeight: 16,
  },

  confirmPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F5B800',
    height: 48,
    borderRadius: 14,
  },
  confirmPayText: {
    fontFamily: fontFamilies.header,
    fontSize: 15,
    fontWeight: '800',
    color: '#171713',
    letterSpacing: 0.3,
  },
  cancelPayBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelPayText: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
});

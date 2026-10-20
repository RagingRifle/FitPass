import React from 'react';
import { StyleSheet, View, Dimensions, ScrollView } from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { 
  Users, DollarSign, 
  ArrowUpRight, ArrowDownRight, Activity, Ticket, TrendingUp, MapPin, 
  BarChart3, PieChart as PieIcon, ShieldCheck
} from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';
import { useGlobalStats } from '../api/superadmin.api';
import { Skeleton, Typography, Badge } from '@/components/ui';
import { BranchSelector } from './BranchSelector';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { API_CLIENT } from '@/lib/api-client';
import { useQuery } from '@tanstack/react-query';

const { width } = Dimensions.get('window');
const chartWidth = width - 40; // 20px padding on left and right

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const SuperAdminDashboard: React.FC = () => {
  const activeDivision = useAuth((state) => state.activeDivision);
  const selectedBranchId = useAuth((state) => state.selectedBranchId);
  const selectedGymId = useAuth((state) => state.selectedGymId);
  const isFitPass = activeDivision === 'fitpass';

  // 1. Query H4 Global Stats (Real API Data)
  const { data: h4Stats, isLoading: isH4Loading } = useGlobalStats(selectedBranchId, selectedGymId);

  // 2. Query FitPass Analytics (Real API Data)
  const { data: fitpassData, isLoading: isFitpassLoading } = useQuery<any>({
    queryKey: ['fitpass-analytics-stats'],
    queryFn: async () => {
      const { data } = await API_CLIENT.get('/sessions/analytics');
      return data.analytics || {};
    },
    enabled: isFitPass,
  });

  const isLoading = isFitPass ? isFitpassLoading : isH4Loading;

  const chartConfig = {
    backgroundColor: theme.colors.card,
    backgroundGradientFrom: theme.colors.card,
    backgroundGradientTo: theme.colors.card,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(254, 223, 30, ${opacity})`,
    labelColor: (opacity = 1) => theme.colors.textSecondary,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '5',
      strokeWidth: '2',
      stroke: theme.colors.primary,
    },
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Skeleton height={60} style={{ borderRadius: 16, marginBottom: theme.spacing.md }} />
        <View style={styles.grid}>
          {Array.from({ length: 4 }).map((_, idx) => (
            <View key={idx} style={styles.gridItem}>
              <Skeleton height={110} style={{ borderRadius: 16 }} />
            </View>
          ))}
        </View>
        <Skeleton height={220} style={{ borderRadius: 16, marginTop: theme.spacing.md }} />
      </View>
    );
  }

  // Real H4 Stats Numbers
  const totalMembers = h4Stats?.totalMembers || 0;
  const activeMembers = h4Stats?.activeMembers || 0;
  const expiredMembers = h4Stats?.expiredMembers || 0;
  const expiringSoon = h4Stats?.expiringSoonCount || 0;
  const monthlyRevenue = h4Stats?.monthlyRevenue || 0;
  const monthlyExpenses = h4Stats?.monthlyExpenses || 0;
  const netProfit = monthlyRevenue - monthlyExpenses;

  // Real FitPass Stats Numbers
  const fpSubscribers = fitpassData?.totalFitPassMembers || 0;
  const fpActive = fitpassData?.activeFitPassMembers || 0;
  const fpExpired = fitpassData?.expiredFitPassMembers || 0;
  const fpSold = fitpassData?.totalSessionsSold || 0;
  const fpUsed = fitpassData?.totalSessionsUsed || 0;
  const fpUtilization = fpSold > 0 ? ((fpUsed / fpSold) * 100).toFixed(1) : '0';

  // Construct REAL data object for monthly revenue chart
  const revenueTrendData = (h4Stats?.revenueTrend && h4Stats.revenueTrend.length > 0)
    ? {
        labels: h4Stats.revenueTrend.map((item: any) => MONTH_NAMES[(item._id?.month || 1) - 1] || 'M'),
        datasets: [{ data: h4Stats.revenueTrend.map((item: any) => item.total || 0) }],
      }
    : null;

  // Construct REAL data object for partner gym visits chart
  const gymVisitsData = (fitpassData?.mostVisitedPartnerGyms && fitpassData.mostVisitedPartnerGyms.length > 0)
    ? {
        labels: fitpassData.mostVisitedPartnerGyms.slice(0, 6).map((g: any) => g.gymName?.slice(0, 8) || 'Gym'),
        datasets: [{ data: fitpassData.mostVisitedPartnerGyms.slice(0, 6).map((g: any) => g.count || 0) }],
      }
    : null;

  return (
    <ScrollView 
      style={styles.mainWrapper} 
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Branch selector for H4 context */}
      {!isFitPass && <BranchSelector />}

      {/* Header Banner */}
      <View style={styles.bannerContainer}>
        <View style={styles.bannerLeft}>
          <View style={styles.badgePill}>
            {isFitPass ? <Activity size={12} color={theme.colors.primaryText} /> : <ShieldCheck size={12} color={theme.colors.primaryText} />}
            <Typography variant="caption" style={styles.badgePillText}>
              {isFitPass ? 'FITPASS NETWORK ANALYTICS' : 'H4 EXECUTIVE ANALYTICS'}
            </Typography>
          </View>
          <Typography variant="h1" style={styles.bannerTitle}>
            {isFitPass ? 'Network Overview' : 'Performance Command'}
          </Typography>
          <Typography variant="caption" color="secondary">
            Real-time operational metrics, financial health, and live check-in stats.
          </Typography>
        </View>
      </View>

      {/* ── Executive Metric KPI Cards (100% Real API Data) ────────────────── */}
      <View style={styles.grid}>
        {isFitPass ? (
          <>
            <View style={styles.gridItem}>
              <View style={styles.kpiCard}>
                <View style={styles.kpiHeader}>
                  <Typography variant="caption" color="secondary" style={styles.kpiTitle}>SUBSCRIBERS</Typography>
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(254, 223, 30, 0.12)' }]}>
                    <Users size={16} color={theme.colors.primaryText} />
                  </View>
                </View>
                <Typography variant="h2" style={styles.kpiValue}>{fpSubscribers}</Typography>
                <Typography variant="caption" color="secondary" style={styles.kpiSub}>
                  {fpActive} Active · {fpExpired} Expired
                </Typography>
              </View>
            </View>

            <View style={styles.gridItem}>
              <View style={styles.kpiCard}>
                <View style={styles.kpiHeader}>
                  <Typography variant="caption" color="secondary" style={styles.kpiTitle}>SESSIONS SOLD</Typography>
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(25, 118, 210, 0.12)' }]}>
                    <Ticket size={16} color={theme.colors.info} />
                  </View>
                </View>
                <Typography variant="h2" style={styles.kpiValue}>{fpSold}</Typography>
                <Typography variant="caption" color="secondary" style={styles.kpiSub}>
                  🎟️ {fitpassData?.remainingSessions || 0} Credits Left
                </Typography>
              </View>
            </View>

            <View style={styles.gridItem}>
              <View style={styles.kpiCard}>
                <View style={styles.kpiHeader}>
                  <Typography variant="caption" color="secondary" style={styles.kpiTitle}>UTILIZATION</Typography>
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(46, 125, 50, 0.12)' }]}>
                    <Activity size={16} color={theme.colors.success} />
                  </View>
                </View>
                <Typography variant="h2" style={styles.kpiValue}>{fpUtilization}%</Typography>
                <Typography variant="caption" color="secondary" style={styles.kpiSub}>
                  🔥 {fpUsed} Sessions Used
                </Typography>
              </View>
            </View>

            <View style={styles.gridItem}>
              <View style={styles.kpiCard}>
                <View style={styles.kpiHeader}>
                  <Typography variant="caption" color="secondary" style={styles.kpiTitle}>AVG CHECK-INS</Typography>
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(156, 39, 176, 0.12)' }]}>
                    <TrendingUp size={16} color="#ab47bc" />
                  </View>
                </View>
                <Typography variant="h2" style={styles.kpiValue}>{fitpassData?.avgVisitsPerMember || 0}</Typography>
                <Typography variant="caption" color="secondary" style={styles.kpiSub}>
                  📈 Visits per Subscriber
                </Typography>
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.gridItem}>
              <View style={styles.kpiCard}>
                <View style={styles.kpiHeader}>
                  <Typography variant="caption" color="secondary" style={styles.kpiTitle}>MEMBERSHIP</Typography>
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(254, 223, 30, 0.12)' }]}>
                    <Users size={16} color={theme.colors.primaryText} />
                  </View>
                </View>
                <Typography variant="h2" style={styles.kpiValue}>{totalMembers}</Typography>
                <Typography variant="caption" color="secondary" style={styles.kpiSub}>
                  {activeMembers} Active · {expiredMembers} Expired
                </Typography>
              </View>
            </View>

            <View style={styles.gridItem}>
              <View style={styles.kpiCard}>
                <View style={styles.kpiHeader}>
                  <Typography variant="caption" color="secondary" style={styles.kpiTitle}>MONTH REVENUE</Typography>
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(46, 125, 50, 0.12)' }]}>
                    <DollarSign size={16} color={theme.colors.success} />
                  </View>
                </View>
                <Typography variant="h2" style={styles.kpiValue}>INR {monthlyRevenue.toLocaleString()}</Typography>
                <Typography variant="caption" color="secondary" style={styles.kpiSub}>
                  {h4Stats?.newMembersThisMonth || 0} New Registrations
                </Typography>
              </View>
            </View>

            <View style={styles.gridItem}>
              <View style={styles.kpiCard}>
                <View style={styles.kpiHeader}>
                  <Typography variant="caption" color="secondary" style={styles.kpiTitle}>MONTH EXPENSES</Typography>
                  <View style={[styles.iconBox, { backgroundColor: 'rgba(198, 40, 40, 0.12)' }]}>
                    <ArrowDownRight size={16} color={theme.colors.error} />
                  </View>
                </View>
                <Typography variant="h2" style={styles.kpiValue}>INR {monthlyExpenses.toLocaleString()}</Typography>
                <Typography variant="caption" color="secondary" style={styles.kpiSub}>
                  Operational Costs
                </Typography>
              </View>
            </View>

            <View style={styles.gridItem}>
              <View style={styles.kpiCard}>
                <View style={styles.kpiHeader}>
                  <Typography variant="caption" color="secondary" style={styles.kpiTitle}>NET PROFIT</Typography>
                  <View style={[styles.iconBox, { backgroundColor: netProfit >= 0 ? 'rgba(46, 125, 50, 0.12)' : 'rgba(198, 40, 40, 0.12)' }]}>
                    <ArrowUpRight size={16} color={netProfit >= 0 ? theme.colors.success : theme.colors.error} />
                  </View>
                </View>
                <Typography variant="h2" style={[styles.kpiValue, { color: netProfit >= 0 ? theme.colors.success : theme.colors.error }]}>
                  INR {netProfit.toLocaleString()}
                </Typography>
                <Typography variant="caption" color="secondary" style={styles.kpiSub}>
                  Net Surplus Margin
                </Typography>
              </View>
            </View>
          </>
        )}
      </View>

      {/* ── Analytical Chart 1: Real API Financial & Usage Chart ───────────────────── */}
      <View style={styles.analyticsSection}>
        <View style={styles.sectionTitleRow}>
          <BarChart3 size={18} color={theme.colors.primaryText} />
          <Typography variant="h3" style={styles.sectionHeaderTitle}>
            {isFitPass ? 'Partner Gym Check-in Distribution (Real)' : 'Monthly Revenue Trend (Real Data)'}
          </Typography>
        </View>

        <View style={styles.chartCard}>
          {isFitPass ? (
            gymVisitsData ? (
              <BarChart
                data={gymVisitsData}
                width={chartWidth}
                height={200}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={chartConfig}
                style={styles.chartCanvas}
              />
            ) : (
              <View style={styles.emptyChartBox}>
                <Typography variant="bodySm" color="secondary">
                  No partner gym check-ins recorded yet.
                </Typography>
              </View>
            )
          ) : (
            revenueTrendData ? (
              <LineChart
                data={revenueTrendData}
                width={chartWidth}
                height={200}
                chartConfig={chartConfig}
                bezier
                style={styles.chartCanvas}
              />
            ) : (
              <View style={styles.emptyChartBox}>
                <Typography variant="bodySm" color="secondary">
                  No historical revenue transactions logged yet.
                </Typography>
              </View>
            )
          )}
        </View>
      </View>

      {/* ── Analytical Chart 2: Real Membership Distribution Breakdown ─────────────────── */}
      <View style={styles.analyticsSection}>
        <View style={styles.sectionTitleRow}>
          <PieIcon size={18} color={theme.colors.primaryText} />
          <Typography variant="h3" style={styles.sectionHeaderTitle}>
            {isFitPass ? 'FitPass Subscriber Breakdown' : 'Member Status Distribution'}
          </Typography>
        </View>

        <View style={styles.breakdownCard}>
          {/* Active Members Bar */}
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownHeader}>
              <Typography variant="bodySm" style={styles.breakdownLabel}>Active Passports</Typography>
              <Typography variant="bodySm" style={{ color: theme.colors.success, fontWeight: '700' }}>
                {isFitPass ? fpActive : activeMembers} ({isFitPass ? (fpSubscribers ? ((fpActive / fpSubscribers) * 100).toFixed(0) : 0) : (totalMembers ? ((activeMembers / totalMembers) * 100).toFixed(0) : 0)}%)
              </Typography>
            </View>
            <View style={styles.progressTrack}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    backgroundColor: theme.colors.success, 
                    width: `${isFitPass ? (fpSubscribers ? (fpActive / fpSubscribers) * 100 : 0) : (totalMembers ? (activeMembers / totalMembers) * 100 : 0)}%` 
                  }
                ]} 
              />
            </View>
          </View>

          {/* Expiring Soon Bar */}
          {!isFitPass && (
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownHeader}>
                <Typography variant="bodySm" style={styles.breakdownLabel}>Expiring in 7 Days</Typography>
                <Typography variant="bodySm" style={{ color: theme.colors.primaryText, fontWeight: '700' }}>
                  {expiringSoon} ({totalMembers ? ((expiringSoon / totalMembers) * 100).toFixed(0) : 0}%)
                </Typography>
              </View>
              <View style={styles.progressTrack}>
                <View 
                  style={[
                    styles.progressFill, 
                    { 
                      backgroundColor: theme.colors.primary, 
                      width: `${totalMembers ? (expiringSoon / totalMembers) * 100 : 0}%` 
                    }
                  ]} 
                />
              </View>
            </View>
          )}

          {/* Expired Members Bar */}
          <View style={styles.breakdownRow}>
            <View style={styles.breakdownHeader}>
              <Typography variant="bodySm" style={styles.breakdownLabel}>Expired / Needs Renewal</Typography>
              <Typography variant="bodySm" style={{ color: theme.colors.error, fontWeight: '700' }}>
                {isFitPass ? fpExpired : expiredMembers} ({isFitPass ? (fpSubscribers ? ((fpExpired / fpSubscribers) * 100).toFixed(0) : 0) : (totalMembers ? ((expiredMembers / totalMembers) * 100).toFixed(0) : 0)}%)
              </Typography>
            </View>
            <View style={styles.progressTrack}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    backgroundColor: theme.colors.error, 
                    width: `${isFitPass ? (fpSubscribers ? (fpExpired / fpSubscribers) * 100 : 0) : (totalMembers ? (expiredMembers / totalMembers) * 100 : 0)}%` 
                  }
                ]} 
              />
            </View>
          </View>
        </View>
      </View>

      {/* ── Top Partner Gym Performance Leaderboard (Real Data) ───────────────────── */}
      {isFitPass && (
        <View style={styles.analyticsSection}>
          <View style={styles.sectionTitleRow}>
            <MapPin size={18} color={theme.colors.primaryText} />
            <Typography variant="h3" style={styles.sectionHeaderTitle}>
              Top Performing Partner Gyms
            </Typography>
          </View>

          <View style={styles.leaderboardCard}>
            {(fitpassData?.mostVisitedPartnerGyms || []).length === 0 ? (
              <Typography variant="caption" color="secondary" style={{ textAlign: 'center', paddingVertical: 12 }}>
                No partner check-in history logged yet.
              </Typography>
            ) : (
              (fitpassData.mostVisitedPartnerGyms || []).map((g: any, index: number) => (
                <View key={g.gymId || index} style={styles.leaderboardRow}>
                  <View style={styles.rankBadge}>
                    <Typography variant="caption" style={styles.rankText}>
                      #{index + 1}
                    </Typography>
                  </View>
                  <View style={styles.gymNameGroup}>
                    <Typography variant="bodySm" style={styles.gymNameText}>
                      {g.gymName}
                    </Typography>
                    <Typography variant="caption" color="secondary">
                      Partner Gym Network
                    </Typography>
                  </View>
                  <Badge label={`${g.count} Visits`} variant="active" />
                </View>
              ))
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  mainWrapper: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing['2xl'],
    gap: theme.spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: theme.spacing.md,
  },

  // Banner
  bannerContainer: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.xs,
  },
  bannerLeft: {
    gap: 4,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(254, 223, 30, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgePillText: {
    color: theme.colors.primaryText,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.8,
  },
  bannerTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },

  // KPI Grid
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
  kpiCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: theme.spacing.md,
    height: 110,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kpiTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  kpiSub: {
    fontSize: 10,
  },

  // Analytics Sections & Charts
  analyticsSection: {
    gap: theme.spacing.xs,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: 2,
  },
  sectionHeaderTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  chartCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  chartCanvas: {
    borderRadius: 16,
    marginVertical: 4,
  },
  emptyChartBox: {
    paddingVertical: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Breakdown Card
  breakdownCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  breakdownRow: {
    gap: 6,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.bgTertiary,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Leaderboard
  leaderboardCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(254, 223, 30, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    color: theme.colors.primaryText,
    fontWeight: '700',
    fontSize: 12,
  },
  gymNameGroup: {
    flex: 1,
    marginLeft: theme.spacing.sm,
  },
  gymNameText: {
    color: theme.colors.text,
    fontWeight: '600',
  },
});

import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Tabs, useRouter } from 'expo-router';
import {
  ArrowLeft, TrendingDown, RefreshCw, Award, AlertTriangle,
  DollarSign, Users, ArrowUpRight, BarChart3,
  Layers, Target, ShieldCheck, Wallet
} from '@/components/ui/app-icons';
import { BarChart, LineChart } from 'react-native-chart-kit';
import { theme } from '@/design-system/theme';
import { Typography, Card, Badge, Button } from '@/components/ui';
import { SafeAreaWrapper } from '@/components/layout';
import { API_CLIENT } from '@/lib/api-client';

const { width } = Dimensions.get('window');

type AnalyticsSection = 'financial' | 'retention' | 'acquisition';

export default function AnalyticsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AnalyticsSection>('financial');

  // Query Analytics Data
  const { data: analyticsData, isLoading, error, refetch, isRefetching } = useQuery<any>({
    queryKey: ['h4-analytics'],
    queryFn: async () => {
      const { data } = await API_CLIENT.get('/analytics');
      return data;
    },
  });

  if (isLoading) {
    return (
      <SafeAreaWrapper scrollable={false}>
        <Tabs.Screen options={{ title: 'Business Analytics' }} />
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={theme.colors.primaryText} />
          <Typography style={{ marginTop: theme.spacing.md }}>Building 360° Business Analytics...</Typography>
        </View>
      </SafeAreaWrapper>
    );
  }

  if (error || !analyticsData) {
    return (
      <SafeAreaWrapper scrollable={false}>
        <Tabs.Screen options={{ title: 'Business Analytics' }} />
        <View style={styles.loaderContainer}>
          <Typography color="error" style={{ marginBottom: theme.spacing.md }}>
            Failed to compile business analytics.
          </Typography>
          <Button title="Retry loading" onPress={() => refetch()} />
        </View>
      </SafeAreaWrapper>
    );
  }

  // --- Financial Trend Charts ---
  const revLabels = (analyticsData.revenueTrend || []).map((t: any) => t.month);
  const revValues = (analyticsData.revenueTrend || []).map((t: any) => Math.round((t.revenue || 0) / 1000)); // in thousands INR 

  const revenueChartData = {
    labels: revLabels.length > 0 ? revLabels : ['N/A'],
    datasets: [
      {
        data: revValues.length > 0 ? revValues : [0],
        color: (opacity = 1) => `rgba(254, 223, 30, ${opacity})`,
        strokeWidth: 3,
      },
    ],
  };

  // --- Churn Bar Chart Configuration ---
  const trendLabels = (analyticsData.churnTrend || []).map((t: any) => t.month);
  const trendValues = (analyticsData.churnTrend || []).map((t: any) => t.churned || 0);

  const churnChartData = {
    labels: trendLabels.length > 0 ? trendLabels : ['N/A'],
    datasets: [
      {
        data: trendValues.length > 0 ? trendValues : [0],
      },
    ],
  };

  const chartConfig = {
    backgroundGradientFrom: theme.colors.card,
    backgroundGradientTo: theme.colors.card,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(254, 223, 30, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(163, 150, 134, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '5',
      strokeWidth: '2',
      stroke: theme.colors.primary,
    },
  };

  const churnChartConfig = {
    ...chartConfig,
    color: (opacity = 1) => `rgba(198, 40, 40, ${opacity})`,
  };

  const leadFunnel = analyticsData.leadFunnel || {
    totalLeads: 0,
    convertedLeads: 0,
    pendingLeads: 0,
    lostLeads: 0,
    conversionRate: 0,
  };

  return (
    <SafeAreaWrapper scrollable={false}>
      <Tabs.Screen 
        options={{ 
          title: 'Executive Analytics',
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => router.replace('/(superadmin)/ops-hub')}
              style={styles.headerBackBtn}
              activeOpacity={0.7}
            >
              <ArrowLeft color={theme.colors.text} size={20} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => refetch()}
              style={styles.headerBackBtn}
              disabled={isRefetching}
            >
              <RefreshCw size={18} color={theme.colors.primaryText} />
            </TouchableOpacity>
          )
        }} 
      />

      {/* Analytics Category Tabs */}
      <View style={styles.tabHeader}>
        <TouchableOpacity 
          onPress={() => setActiveTab('financial')}
          style={[styles.tabBtn, activeTab === 'financial' && styles.tabBtnActive]}
        >
          <DollarSign size={16} color={activeTab === 'financial' ? theme.colors.primary : theme.colors.textSecondary} />
          <Typography variant="bodySm" style={activeTab === 'financial' ? styles.tabTextActive : styles.tabText}>
            Financials
          </Typography>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => setActiveTab('retention')}
          style={[styles.tabBtn, activeTab === 'retention' && styles.tabBtnActive]}
        >
          <Users size={16} color={activeTab === 'retention' ? theme.colors.primary : theme.colors.textSecondary} />
          <Typography variant="bodySm" style={activeTab === 'retention' ? styles.tabTextActive : styles.tabText}>
            Retention & Churn
          </Typography>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => setActiveTab('acquisition')}
          style={[styles.tabBtn, activeTab === 'acquisition' && styles.tabBtnActive]}
        >
          <Target size={16} color={activeTab === 'acquisition' ? theme.colors.primary : theme.colors.textSecondary} />
          <Typography variant="bodySm" style={activeTab === 'acquisition' ? styles.tabTextActive : styles.tabText}>
            Leads & Growth
          </Typography>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* FINANCIAL PERFORMANCE TAB */}
        {activeTab === 'financial' && (
          <>
            {/* Top Revenue Summary Cards */}
            <View style={styles.statsGrid}>
              <Card style={styles.statCard}>
                <View style={styles.statHeader}>
                  <Typography variant="caption" color="secondary">Monthly Revenue</Typography>
                  <Wallet size={18} color={theme.colors.primaryText} />
                </View>
                <Typography variant="h2" style={styles.statValue}>
                  INR {(analyticsData.monthlyRevenue || 0).toLocaleString('en-IN')}
                </Typography>
                <Typography variant="caption" color="muted">Current Month Collections</Typography>
              </Card>

              <Card style={styles.statCard}>
                <View style={styles.statHeader}>
                  <Typography variant="caption" color="secondary">Net Monthly Profit</Typography>
                  <ArrowUpRight size={18} color={theme.colors.success} />
                </View>
                <Typography variant="h2" style={StyleSheet.flatten([styles.statValue, { color: theme.colors.success }])}>
                  INR {(analyticsData.monthlyProfit || 0).toLocaleString('en-IN')}
                </Typography>
                <Typography variant="caption" color="muted">
                  Exp: INR {(analyticsData.monthlyExpenses || 0).toLocaleString('en-IN')}
                </Typography>
              </Card>
            </View>

            <View style={styles.statsGrid}>
              <Card style={StyleSheet.flatten([styles.statCard, { borderLeftColor: '#8b5cf6' }])}>
                <View style={styles.statHeader}>
                  <Typography variant="caption" color="secondary">Total All-Time Revenue</Typography>
                  <ShieldCheck size={18} color="#8b5cf6" />
                </View>
                <Typography variant="h2" style={styles.statValue}>
                  INR {(analyticsData.totalLifetimeRevenue || 0).toLocaleString('en-IN')}
                </Typography>
                <Typography variant="caption" color="muted">Total Payments Recorded</Typography>
              </Card>

              <Card style={StyleSheet.flatten([styles.statCard, { borderLeftColor: theme.colors.info }])}>
                <View style={styles.statHeader}>
                  <Typography variant="caption" color="secondary">Avg Member LTV</Typography>
                  <Award size={18} color={theme.colors.info} />
                </View>
                <Typography variant="h2" style={styles.statValue}>
                  INR {(analyticsData.avgLTV || 0).toLocaleString('en-IN')}
                </Typography>
                <Typography variant="caption" color="muted">Avg Value / Gym Member</Typography>
              </Card>
            </View>

            {/* Revenue Trend Line Chart */}
            <Card style={styles.chartCard}>
              <View style={styles.cardHeaderRow}>
                <Typography variant="body" style={styles.cardHeaderTitle}>📈 Monthly Revenue Trend (INR  in Thousands)</Typography>
                <Badge label="6 Months" variant="info" />
              </View>
              {revValues.length > 0 ? (
                <LineChart
                  data={revenueChartData}
                  width={width - 48}
                  height={220}
                  chartConfig={chartConfig}
                  bezier
                  yAxisLabel="INR "
                  yAxisSuffix="k"
                  style={styles.chartStyle}
                />
              ) : (
                <Typography variant="caption" color="muted" style={{ marginVertical: theme.spacing.lg, textAlign: 'center' }}>
                  No payment trend data available.
                </Typography>
              )}
            </Card>

            {/* Plan Revenue Breakdown */}
            <Card style={styles.recordsCard}>
              <Typography variant="body" style={styles.cardHeaderTitle}>🏋️ Revenue & Popularity by Plan</Typography>
              {(analyticsData.planDistribution || []).length === 0 ? (
                <Typography variant="caption" color="muted">No plan collection history available.</Typography>
              ) : (
                (analyticsData.planDistribution || []).map((p: any, idx: number) => (
                  <View key={p.name || idx} style={styles.memberRow}>
                    <View style={{ flex: 1 }}>
                      <Typography variant="bodySm" style={{ fontWeight: '700' }}>{p.name}</Typography>
                      <Typography variant="caption" color="secondary">{p.memberCount} total payments</Typography>
                    </View>
                    <Typography variant="bodySm" style={styles.payoutText}>
                      INR {(p.totalRevenue || 0).toLocaleString('en-IN')}
                    </Typography>
                  </View>
                ))
              )}
            </Card>

            {/* Payment Method Breakdown */}
            <Card style={styles.recordsCard}>
              <Typography variant="body" style={styles.cardHeaderTitle}>💳 Payment Channels Breakdown</Typography>
              {(analyticsData.paymentMethods || []).length === 0 ? (
                <Typography variant="caption" color="muted">No payment channels logged.</Typography>
              ) : (
                (analyticsData.paymentMethods || []).map((m: any, idx: number) => (
                  <View key={m.method || idx} style={styles.memberRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                      <Layers size={16} color={theme.colors.primaryText} />
                      <Typography variant="bodySm" style={{ fontWeight: '700', textTransform: 'capitalize' }}>
                        {m.method || 'Direct Cash'}
                      </Typography>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Typography variant="bodySm" style={{ fontWeight: '700' }}>
                        INR {(m.totalAmount || 0).toLocaleString('en-IN')}
                      </Typography>
                      <Typography variant="caption" color="muted">{m.count} transactions</Typography>
                    </View>
                  </View>
                ))
              )}
            </Card>
          </>
        )}

        {/* RETENTION & CHURN TAB */}
        {activeTab === 'retention' && (
          <>
            <View style={styles.statsGrid}>
              <Card style={StyleSheet.flatten([styles.statCard, { borderLeftColor: theme.colors.error }])}>
                <View style={styles.statHeader}>
                  <Typography variant="caption" color="secondary">30-Day Churn Rate</Typography>
                  <TrendingDown size={18} color={theme.colors.error} />
                </View>
                <Typography variant="h2" style={styles.statValue}>{analyticsData.churnRate}%</Typography>
                <Typography variant="caption" color="muted">{analyticsData.expiredLast30} members expired</Typography>
              </Card>

              <Card style={styles.statCard}>
                <View style={styles.statHeader}>
                  <Typography variant="caption" color="secondary">90-Day Renewal Rate</Typography>
                  <RefreshCw size={18} color={theme.colors.success} />
                </View>
                <Typography variant="h2" style={styles.statValue}>{analyticsData.renewalRate}%</Typography>
                <Typography variant="caption" color="muted">{analyticsData.renewedCount} renewed pass</Typography>
              </Card>
            </View>

            <View style={styles.statsGrid}>
              <Card style={StyleSheet.flatten([styles.statCard, { borderLeftColor: theme.colors.warning }])}>
                <View style={styles.statHeader}>
                  <Typography variant="caption" color="secondary">At Risk Inactive (7d+)</Typography>
                  <AlertTriangle size={18} color={theme.colors.warning} />
                </View>
                <Typography variant="h2" style={styles.statValue}>{analyticsData.inactiveCount}</Typography>
                <Typography variant="caption" color="muted">Zero Attendance Logs</Typography>
              </Card>

              <Card style={styles.statCard}>
                <View style={styles.statHeader}>
                  <Typography variant="caption" color="secondary">Top LTV Champion</Typography>
                  <Award size={18} color={theme.colors.primaryText} />
                </View>
                <Typography variant="h2" style={styles.statValue}>
                  {(analyticsData.topMembers || [])[0]?.name?.split(' ')[0] || 'N/A'}
                </Typography>
                <Typography variant="caption" color="muted">
                  INR {(analyticsData.topMembers || [])[0]?.totalPaid || 0} Total Spent
                </Typography>
              </Card>
            </View>

            {/* Monthly Churn Bar Chart */}
            <Card style={styles.chartCard}>
              <Typography variant="body" style={styles.cardHeaderTitle}>📉 Monthly Churn Trend</Typography>
              {trendValues.length > 0 ? (
                <BarChart
                  data={churnChartData}
                  width={width - 48}
                  height={220}
                  chartConfig={churnChartConfig}
                  verticalLabelRotation={0}
                  yAxisLabel=""
                  yAxisSuffix=""
                  style={styles.chartStyle}
                />
              ) : (
                <Typography variant="caption" color="muted" style={{ marginVertical: theme.spacing.lg, textAlign: 'center' }}>
                  No churn history available.
                </Typography>
              )}
            </Card>

            {/* Top VIP Members */}
            <Card style={styles.recordsCard}>
              <Typography variant="body" style={styles.cardHeaderTitle}>💎 Top Lifetime Value Members</Typography>
              {(analyticsData.topMembers || []).length === 0 ? (
                <Typography variant="caption" color="muted">No payment metrics registered.</Typography>
              ) : (
                (analyticsData.topMembers || []).map((m: any, idx: number) => (
                  <View key={m._id || idx} style={styles.memberRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                      <Typography variant="bodySm" style={{ fontWeight: '800', color: theme.colors.primaryText }}>
                        #{idx + 1}
                      </Typography>
                      <View>
                        <Typography variant="bodySm" style={{ fontWeight: '700' }}>{m.name}</Typography>
                        <Typography variant="caption" color="secondary">{m.phone}</Typography>
                      </View>
                    </View>
                    <Typography variant="bodySm" style={styles.payoutText}>
                      INR {(m.totalPaid || 0).toLocaleString('en-IN')}
                    </Typography>
                  </View>
                ))
              )}
            </Card>

            {/* At Risk Inactive Members */}
            <Card style={styles.recordsCard}>
              <Typography variant="body" style={styles.cardHeaderTitle}>⚠️ At-Risk Inactive Members (7+ Days Absent)</Typography>
              {(analyticsData.inactiveMembers || []).length === 0 ? (
                <Typography variant="caption" color="muted">All active members checked in recently!</Typography>
              ) : (
                (analyticsData.inactiveMembers || []).map((m: any) => {
                  const daysLeft = Math.ceil((new Date(m.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <View key={m._id} style={styles.memberRow}>
                      <View style={{ flex: 1 }}>
                        <Typography variant="bodySm" style={{ fontWeight: '700' }}>{m.name}</Typography>
                        <Typography variant="caption" color="secondary">{m.phone} · {m.planId?.name || 'Plan'}</Typography>
                      </View>
                      <Badge 
                        label={daysLeft > 0 ? `${daysLeft}d left` : 'Expired'} 
                        variant={daysLeft > 0 ? 'warning' : 'expired'} 
                      />
                    </View>
                  );
                })
              )}
            </Card>
          </>
        )}

        {/* LEADS & GROWTH TAB */}
        {activeTab === 'acquisition' && (
          <>
            <View style={styles.statsGrid}>
              <Card style={styles.statCard}>
                <View style={styles.statHeader}>
                  <Typography variant="caption" color="secondary">Lead Conversion</Typography>
                  <Target size={18} color={theme.colors.success} />
                </View>
                <Typography variant="h2" style={styles.statValue}>{leadFunnel.conversionRate}%</Typography>
                <Typography variant="caption" color="muted">{leadFunnel.convertedLeads} Converted to Members</Typography>
              </Card>

              <Card style={StyleSheet.flatten([styles.statCard, { borderLeftColor: theme.colors.primary }])}>
                <View style={styles.statHeader}>
                  <Typography variant="caption" color="secondary">Total Leads Pipeline</Typography>
                  <BarChart3 size={18} color={theme.colors.primaryText} />
                </View>
                <Typography variant="h2" style={styles.statValue}>{leadFunnel.totalLeads}</Typography>
                <Typography variant="caption" color="muted">{leadFunnel.pendingLeads} Active Prospects</Typography>
              </Card>
            </View>

            {/* Lead Funnel Breakdown */}
            <Card style={styles.recordsCard}>
              <Typography variant="body" style={styles.cardHeaderTitle}>🎯 Acquisition Lead Conversion Funnel</Typography>
              
              <View style={styles.funnelItem}>
                <View style={styles.funnelHeader}>
                  <Typography variant="bodySm" style={{ fontWeight: '700' }}>Converted Members</Typography>
                  <Typography variant="bodySm" style={{ fontWeight: '800', color: theme.colors.success }}>
                    {leadFunnel.convertedLeads}
                  </Typography>
                </View>
                <View style={styles.barBg}>
                  <View 
                    style={[
                      styles.barFill, 
                      { 
                        width: `${leadFunnel.totalLeads > 0 ? (leadFunnel.convertedLeads / leadFunnel.totalLeads) * 100 : 0}%`,
                        backgroundColor: theme.colors.success 
                      }
                    ]} 
                  />
                </View>
              </View>

              <View style={styles.funnelItem}>
                <View style={styles.funnelHeader}>
                  <Typography variant="bodySm" style={{ fontWeight: '700' }}>Pending / In Follow-up</Typography>
                  <Typography variant="bodySm" style={{ fontWeight: '800', color: theme.colors.warning }}>
                    {leadFunnel.pendingLeads}
                  </Typography>
                </View>
                <View style={styles.barBg}>
                  <View 
                    style={[
                      styles.barFill, 
                      { 
                        width: `${leadFunnel.totalLeads > 0 ? (leadFunnel.pendingLeads / leadFunnel.totalLeads) * 100 : 0}%`,
                        backgroundColor: theme.colors.warning 
                      }
                    ]} 
                  />
                </View>
              </View>

              <View style={styles.funnelItem}>
                <View style={styles.funnelHeader}>
                  <Typography variant="bodySm" style={{ fontWeight: '700' }}>Lost Leads</Typography>
                  <Typography variant="bodySm" style={{ fontWeight: '800', color: theme.colors.error }}>
                    {leadFunnel.lostLeads}
                  </Typography>
                </View>
                <View style={styles.barBg}>
                  <View 
                    style={[
                      styles.barFill, 
                      { 
                        width: `${leadFunnel.totalLeads > 0 ? (leadFunnel.lostLeads / leadFunnel.totalLeads) * 100 : 0}%`,
                        backgroundColor: theme.colors.error 
                      }
                    ]} 
                  />
                </View>
              </View>
            </Card>

            {/* Quick Action Navigation */}
            <TouchableOpacity 
              onPress={() => router.push('/(superadmin)/crm/leads')}
              style={styles.actionBanner}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Typography variant="body" style={{ fontWeight: '700', color: '#FFFFFF' }}>
                  Manage Leads Pipeline
                </Typography>
                <Typography variant="caption" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                  View trial bookings, contact schedules, and follow-ups
                </Typography>
              </View>
              <ArrowUpRight size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  scrollContent: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing['2xl'],
  },
  tabHeader: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radii.md,
    padding: 4,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.sm,
  },
  tabBtnActive: {
    backgroundColor: theme.colors.brandLight,
  },
  tabText: {
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: theme.colors.primaryText,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  statCard: {
    flex: 1,
    padding: theme.spacing.md,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statValue: {
    fontWeight: '800',
    marginVertical: 4,
  },
  chartCard: {
    padding: theme.spacing.md,
    marginVertical: theme.spacing.xs,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  cardHeaderTitle: {
    fontWeight: '800',
    marginBottom: theme.spacing.sm,
  },
  chartStyle: {
    marginVertical: theme.spacing.xs,
    borderRadius: theme.radii.md,
  },
  recordsCard: {
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  payoutText: {
    fontWeight: '800',
    color: theme.colors.success,
  },
  funnelItem: {
    marginVertical: theme.spacing.xs,
  },
  funnelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  barBg: {
    height: 10,
    backgroundColor: theme.colors.bgTertiary,
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  actionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    marginTop: theme.spacing.md,
  },
  headerBackBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.xs,
  },
});

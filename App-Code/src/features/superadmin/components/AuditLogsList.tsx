import React, { useState } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity } from 'react-native';
import {
  LogIn, LogOut, UserPlus, UserCog, UserMinus, DollarSign, ArrowDown, ArrowUp,
  Clipboard, Calendar, Target, Snowflake, Sun, Building, Settings, ShieldAlert,
  Scan, MapPin, ChevronLeft, ChevronRight
} from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';
import { useAuditLogs, useAuditSummary } from '../api/superadmin.api';
import { Select, Skeleton, EmptyState, Badge, Typography } from '@/components/ui';

type LogTab = 'timeline' | 'logins' | 'sessions';

const ACTION_ICONS: Record<string, React.ReactNode> = {
  LOGIN: <LogIn size={16} color="#10b981" />,
  LOGOUT: <LogOut size={16} color="#6b7280" />,
  MEMBER_CREATED: <UserPlus size={16} color="#6366f1" />,
  MEMBER_UPDATED: <UserCog size={16} color="#f59e0b" />,
  MEMBER_DELETED: <UserMinus size={16} color="#ef4444" />,
  PAYMENT_ADDED: <DollarSign size={16} color="#10b981" />,
  PAYMENT_DELETED: <ArrowDown size={16} color="#ef4444" />,
  EXPENSE_ADDED: <ArrowDown size={16} color="#f59e0b" />,
  EXPENSE_DELETED: <ArrowUp size={16} color="#ef4444" />,
  PLAN_CREATED: <Clipboard size={16} color="#6366f1" />,
  PLAN_UPDATED: <Clipboard size={16} color="#f59e0b" />,
  PLAN_DELETED: <Clipboard size={16} color="#ef4444" />,
  CLASS_CREATED: <Calendar size={16} color="#0ea5e9" />,
  CLASS_DELETED: <Calendar size={16} color="#ef4444" />,
  LEAD_CREATED: <Target size={16} color="#8b5cf6" />,
  LEAD_UPDATED: <Target size={16} color="#f59e0b" />,
  LEAD_DELETED: <Target size={16} color="#ef4444" />,
  FREEZE_APPLIED: <Snowflake size={16} color="#6366f1" />,
  FREEZE_REMOVED: <Sun size={16} color="#10b981" />,
  BRANCH_CREATED: <Building size={16} color="#0ea5e9" />,
  BRANCH_UPDATED: <Building size={16} color="#f59e0b" />,
  BRANCH_DELETED: <Building size={16} color="#ef4444" />,
  CHECK_IN: <Scan size={16} color="#10b981" />,
  CHECK_IN_BLOCKED: <ShieldAlert size={16} color="#ef4444" />,
  ATTENDANCE_MARKED: <MapPin size={16} color="#0ea5e9" />,
  GYM_CREATED: <Building size={16} color="#0ea5e9" />,
  GYM_UPDATED: <Building size={16} color="#f59e0b" />,
  LOGIN_FAILED: <ShieldAlert size={16} color="#ef4444" />,
  OTHER: <Settings size={16} color="#6b7280" />,
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN: '#10b981', LOGOUT: '#6b7280',
  MEMBER_CREATED: '#6366f1', MEMBER_UPDATED: '#f59e0b', MEMBER_DELETED: '#ef4444',
  PAYMENT_ADDED: '#10b981', PAYMENT_DELETED: '#ef4444',
  EXPENSE_ADDED: '#f59e0b', EXPENSE_DELETED: '#ef4444',
  PLAN_CREATED: '#6366f1', PLAN_UPDATED: '#f59e0b', PLAN_DELETED: '#ef4444',
  CLASS_CREATED: '#0ea5e9', CLASS_DELETED: '#ef4444',
  LEAD_CREATED: '#8b5cf6', LEAD_UPDATED: '#f59e0b', LEAD_DELETED: '#ef4444',
  FREEZE_APPLIED: '#6366f1', FREEZE_REMOVED: '#10b981',
  BRANCH_CREATED: '#0ea5e9', BRANCH_UPDATED: '#f59e0b', BRANCH_DELETED: '#ef4444',
  CHECK_IN: '#10b981', CHECK_IN_BLOCKED: '#ef4444',
  ATTENDANCE_MARKED: '#0ea5e9', GYM_CREATED: '#0ea5e9', GYM_UPDATED: '#f59e0b',
  LOGIN_FAILED: '#ef4444', OTHER: '#6b7280',
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const AuditLogsList: React.FC = () => {
  const [tab, setTab] = useState<LogTab>('timeline');
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState<string | number>('');
  const [filterEntity, setFilterEntity] = useState<string | number>('');

  const { data: summary, isLoading: summaryLoading } = useAuditSummary();
  const { data: logsData, isLoading: logsLoading } = useAuditLogs({
    page,
    limit: 30,
    action: filterAction as string,
    entity: filterEntity as string,
  });

  const handleActionChange = (val: string | number) => {
    setFilterAction(val);
    setPage(1);
  };

  const handleEntityChange = (val: string | number) => {
    setFilterEntity(val);
    setPage(1);
  };

  if (summaryLoading || logsLoading) {
    return (
      <View style={styles.loadingWrapper}>
        <Skeleton height={40} style={{ borderRadius: 16, marginBottom: theme.spacing.lg }} />
        {Array.from({ length: 4 }).map((_, idx) => (
          <Skeleton key={idx} height={80} style={{ borderRadius: 16, marginBottom: theme.spacing.md }} />
        ))}
      </View>
    );
  }

  const actionOptions = [
    { label: 'All Actions', value: '' },
    ...(summary?.summary?.map((s) => ({
      label: s._id.replace(/_/g, ' '),
      value: s._id,
    })) || []),
  ];

  const entityOptions = [
    { label: 'All Entities', value: '' },
    { label: 'Member', value: 'Member' },
    { label: 'Gym', value: 'Gym' },
    { label: 'Plan', value: 'Plan' },
    { label: 'Branch', value: 'Branch' },
    { label: 'Expense', value: 'Expense' },
    { label: 'User', value: 'User' },
    { label: 'Payment', value: 'Payment' },
    { label: 'Attendance', value: 'Attendance' },
  ];

  const displayLogs = logsData?.logs.filter((l) => l.action !== 'SESSION_EXPIRED') || [];
  const loginsList = summary?.recentLogins || [];
  const sessionList = displayLogs.filter((l) =>
    ['CHECK_IN', 'CHECK_IN_BLOCKED', 'SESSION_ADJUSTED'].includes(l.action)
  );

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabsRow}>
        {(['timeline', 'sessions', 'logins'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tabBtn, tab === t && styles.activeTabBtn]}
            activeOpacity={0.8}
          >
            <Typography style={[styles.tabText, tab === t && styles.activeTabText]}>
              {t === 'timeline' ? 'Activity Log' : t === 'sessions' ? 'Sessions' : 'Auth Logins'}
            </Typography>
          </TouchableOpacity>
        ))}
      </View>

      {/* Timeline Controls */}
      {tab === 'timeline' && (
        <View style={styles.controlsRow}>
          <View style={styles.control}>
            <Select
              label="Filter Action"
              options={actionOptions}
              value={filterAction}
              onValueChange={handleActionChange}
            />
          </View>
          <View style={styles.control}>
            <Select
              label="Filter Entity"
              options={entityOptions}
              value={filterEntity}
              onValueChange={handleEntityChange}
            />
          </View>
        </View>
      )}

      {/* Main Lists */}
      {tab === 'timeline' && (
        <FlatList
          data={displayLogs}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => {
            const color = ACTION_COLORS[item.action] || theme.colors.textSecondary;
            const icon = ACTION_ICONS[item.action] || <Settings size={16} color={theme.colors.textSecondary} />;
            return (
              <View style={styles.logCard}>
                <View style={styles.logHeader}>
                  <View style={[styles.iconWrapper, { backgroundColor: `${color}18` }]}>
                    {icon}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.badgeRow}>
                      <Badge label={item.action.replace(/_/g, ' ')} variant="info" />
                      <Typography variant="caption" color="muted" style={styles.logTime}>{formatDate(item.createdAt)}</Typography>
                    </View>
                    <Typography variant="bodySm" style={styles.logDetails}>{item.details}</Typography>
                    <Typography variant="caption" color="secondary" style={styles.logUser}>
                      by {item.userName} ({item.userRole})
                    </Typography>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              iconText="🔍"
              title="No Activity Found"
              description="Adjust your filters or reload to see recent activity logs."
            />
          }
          ListFooterComponent={
            logsData && logsData.pages > 1 ? (
              <View style={styles.paginationRow}>
                <TouchableOpacity
                  disabled={page === 1}
                  onPress={() => setPage(page - 1)}
                  style={[styles.pageBtn, page === 1 && { opacity: 0.4 }]}
                  activeOpacity={0.7}
                >
                  <ChevronLeft color={theme.colors.text} size={20} />
                </TouchableOpacity>
                <Typography variant="bodySm" color="secondary" style={styles.pageText}>
                  Page {page} of {logsData.pages}
                </Typography>
                <TouchableOpacity
                  disabled={page === logsData.pages}
                  onPress={() => setPage(page + 1)}
                  style={[styles.pageBtn, page === logsData.pages && { opacity: 0.4 }]}
                  activeOpacity={0.7}
                >
                  <ChevronRight color={theme.colors.text} size={20} />
                </TouchableOpacity>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {tab === 'sessions' && (
        <FlatList
          data={sessionList}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => {
            const color = ACTION_COLORS[item.action] || theme.colors.textSecondary;
            const icon = ACTION_ICONS[item.action] || <Settings size={16} color={theme.colors.textSecondary} />;
            return (
              <View style={styles.logCard}>
                <View style={styles.logHeader}>
                  <View style={[styles.iconWrapper, { backgroundColor: `${color}18` }]}>
                    {icon}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.badgeRow}>
                      <Typography variant="caption" style={styles.sessionAction}>{item.action.replace(/_/g, ' ')}</Typography>
                      <Typography variant="caption" color="muted" style={styles.logTime}>{formatDate(item.createdAt)}</Typography>
                    </View>
                    <Typography variant="bodySm" style={styles.logDetails}>{item.details}</Typography>
                    {item.entityName && (
                      <Typography variant="caption" style={styles.sessionEntity}>Member: {item.entityName}</Typography>
                    )}
                    <Typography variant="caption" color="secondary" style={styles.logUser}>
                      Checked in by {item.userName} ({item.userRole})
                    </Typography>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              iconText="🏃"
              title="No Session Activity"
              description="No FitPrime check-in sessions or blocked activities found."
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {tab === 'logins' && (
        <FlatList
          data={loginsList}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <View style={styles.logCard}>
              <View style={styles.loginCardRow}>
                <View style={{ flex: 1 }}>
                  <Typography variant="body" style={styles.loginUserTitle}>{item.userName}</Typography>
                  <Typography variant="caption" color="secondary" style={styles.loginEmail}>{item.userEmail}</Typography>
                  <View style={styles.loginIpRow}>
                    <Typography variant="caption" color="muted" style={styles.loginIp}>IP: {item.ip || 'Unknown'}</Typography>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Badge label={item.userRole} variant="active" />
                  <Typography variant="caption" color="muted" style={styles.loginTimeText}>{formatDate(item.createdAt)}</Typography>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              iconText="🔐"
              title="No Login Records"
              description="No user sessions logins recorded recently."
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 20,
    paddingTop: theme.spacing.md,
  },
  loadingWrapper: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: theme.spacing.md,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: 4,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    minHeight: 40,
  },
  activeTabBtn: {
    backgroundColor: theme.colors.bgTertiary,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  activeTabText: {
    color: theme.colors.primary,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  control: {
    flex: 1,
  },
  logCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  logTime: {
    color: theme.colors.textMuted,
  },
  logDetails: {
    color: theme.colors.text,
    fontWeight: '600',
    marginVertical: 2,
  },
  logUser: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  sessionAction: {
    fontWeight: '800',
    color: theme.colors.primary,
  },
  sessionEntity: {
    color: theme.colors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  loginCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loginUserTitle: {
    fontWeight: '700',
    color: theme.colors.text,
  },
  loginEmail: {
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  loginIpRow: {
    marginTop: theme.spacing.xs,
  },
  loginIp: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  loginTimeText: {
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  pageBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.bgTertiary,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageText: {
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
});

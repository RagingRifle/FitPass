import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { 
  User, Users, Target, Package, Calendar, Award, Wrench, ShieldAlert,
  CreditCard, DollarSign, AlertCircle, Scan, MapPin, ClipboardList,
  Snowflake, FileText, BarChart2, ChevronRight
} from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';
import { Typography } from '@/components/ui';

interface HubItem {
  key: string;
  name: string;
  subtitle?: string;
  icon: React.ReactNode;
  bgColor: string;
}

interface HubGroup {
  title: string;
  items: HubItem[];
}

export const H4ManagementHub: React.FC = () => {
  const router = useRouter();

  const groups: HubGroup[] = [
    {
      title: 'Gym Management',
      items: [
        { key: 'profile', name: 'Gym Profile', subtitle: 'Settings & Specs', icon: <User size={20} color={theme.colors.primaryText} />, bgColor: 'rgba(254, 223, 30, 0.12)' },
        { key: 'members', name: 'Members', subtitle: 'Roster & Passports', icon: <Users size={20} color={theme.colors.primaryText} />, bgColor: 'rgba(254, 223, 30, 0.12)' },
        { key: 'leads', name: 'Leads', subtitle: 'Prospect Inquiries', icon: <Target size={20} color={theme.colors.primaryText} />, bgColor: 'rgba(254, 223, 30, 0.12)' },
        { key: 'plans', name: 'Plans', subtitle: 'Tiers & Pricing', icon: <Package size={20} color={theme.colors.primaryText} />, bgColor: 'rgba(254, 223, 30, 0.12)' },
        { key: 'classes', name: 'Classes', subtitle: 'Schedules & Slots', icon: <Calendar size={20} color={theme.colors.primaryText} />, bgColor: 'rgba(254, 223, 30, 0.12)' },
        { key: 'assessments', name: 'Assessments', subtitle: 'Fitness Tests', icon: <Award size={20} color={theme.colors.primaryText} />, bgColor: 'rgba(254, 223, 30, 0.12)' },
        { key: 'equipments', name: 'Equipments', subtitle: 'Assets & Repair', icon: <Wrench size={20} color={theme.colors.primaryText} />, bgColor: 'rgba(254, 223, 30, 0.12)' },
        { key: 'staff', name: 'Staff', subtitle: 'Roles & Access', icon: <ShieldAlert size={20} color={theme.colors.primaryText} />, bgColor: 'rgba(254, 223, 30, 0.12)' },
      ],
    },
    {
      title: 'Operations & Finance',
      items: [
        { key: 'payments', name: 'Payments', subtitle: 'Revenue Logs', icon: <CreditCard size={20} color={theme.colors.success} />, bgColor: 'rgba(46, 125, 50, 0.12)' },
        { key: 'expenses', name: 'Expenses', subtitle: 'Bills & Maintenance', icon: <DollarSign size={20} color={theme.colors.error} />, bgColor: 'rgba(198, 40, 40, 0.12)' },
        { key: 'pending_dues', name: 'Pending Dues', subtitle: 'Outstanding Balances', icon: <AlertCircle size={20} color={theme.colors.warning} />, bgColor: 'rgba(254, 223, 30, 0.12)' },
        { key: 'attendance', name: 'Attendance', subtitle: 'Member Scans', icon: <Scan size={20} color={theme.colors.info} />, bgColor: 'rgba(25, 118, 210, 0.12)' },
        { key: 'trainer_attendance', name: 'Trainer Attendance', subtitle: 'Duty Logs', icon: <MapPin size={20} color={theme.colors.info} />, bgColor: 'rgba(25, 118, 210, 0.12)' },
        { key: 'payroll', name: 'Payroll', subtitle: 'Salaries & Payouts', icon: <ClipboardList size={20} color={theme.colors.error} />, bgColor: 'rgba(198, 40, 40, 0.12)' },
      ],
    },
    {
      title: 'System & Analytics',
      items: [
        { key: 'reports', name: 'Reports', subtitle: 'Monthly Audits', icon: <FileText size={20} color={theme.colors.info} />, bgColor: 'rgba(25, 118, 210, 0.12)' },
        { key: 'analytics', name: 'Analytics', subtitle: 'Insights & KPIs', icon: <BarChart2 size={20} color={theme.colors.info} />, bgColor: 'rgba(25, 118, 210, 0.12)' },
        { key: 'freeze_system', name: 'Freeze System', subtitle: 'Membership Holds', icon: <Snowflake size={20} color={theme.colors.info} />, bgColor: 'rgba(25, 118, 210, 0.12)' },
      ],
    },
  ];

  const handlePress = (item: HubItem) => {
    const staticPages = ['attendance', 'trainer_attendance', 'payroll', 'reports', 'analytics'];
    if (staticPages.includes(item.key)) {
      router.push(`/(superadmin)/ops/${item.key}` as any);
    } else {
      router.push({
        pathname: '/(superadmin)/ops/[module]' as any,
        params: { module: item.key, name: item.name }
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBox}>
        <Typography variant="h2" style={styles.sectionHeader}>
          H4 Operations Command Hub
        </Typography>
        <Typography variant="caption" color="secondary" style={styles.subtitle}>
          Central control panel for H4 branch management, staffing, member records, financial ledgers, and live operational analytics.
        </Typography>
      </View>

      {groups.map((group) => (
        <View key={group.title} style={styles.groupContainer}>
          <Typography variant="h3" style={styles.groupTitle}>
            {group.title}
          </Typography>
          <View style={styles.grid}>
            {group.items.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.gridItem}
                onPress={() => handlePress(item)}
                activeOpacity={0.7}
              >
                <View style={styles.hubCard}>
                  <View style={[styles.iconWrapper, { backgroundColor: item.bgColor }]}>
                    {item.icon}
                  </View>
                  <View style={styles.textContainer}>
                    <Typography variant="bodySm" style={styles.cardLabel} numberOfLines={1}>
                      {item.name}
                    </Typography>
                    {item.subtitle ? (
                      <Typography variant="caption" color="secondary" style={styles.cardSubtitle} numberOfLines={1}>
                        {item.subtitle}
                      </Typography>
                    ) : null}
                  </View>
                  <ChevronRight size={14} color={theme.colors.textMuted} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  headerBox: {
    gap: 4,
  },
  sectionHeader: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  groupContainer: {
    gap: theme.spacing.sm,
  },
  groupTitle: {
    fontWeight: '700',
    color: theme.colors.textSecondary,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  grid: {
    gap: theme.spacing.xs,
  },
  gridItem: {
    width: '100%',
  },
  hubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  cardLabel: {
    fontWeight: '600',
    color: theme.colors.text,
    fontSize: 14,
  },
  cardSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
});

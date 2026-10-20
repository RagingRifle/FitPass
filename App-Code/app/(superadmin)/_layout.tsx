import React from 'react';
import { Tabs } from 'expo-router';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { LayoutDashboard, Building2, Package, History, LogOut, Shuffle, LayoutGrid, ShieldCheck } from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';

export default function SuperAdminLayout() {
  const logout = useAuth((state) => state.logout);
  const activeDivision = useAuth((state) => state.activeDivision);
  const changeActiveDivision = useAuth((state) => state.changeActiveDivision);
  const user = useAuth((state) => state.user);

  const isH4 = activeDivision === 'h4';

  return (
    <Tabs
      screenOptions={{
        headerStyle: styles.header,
        headerTitleStyle: styles.headerTitle,
          headerTintColor: '#FFFFFF',
        tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: '#FEDF1E',
          tabBarInactiveTintColor: '#D4D0C6',
        tabBarLabelStyle: styles.tabBarLabel,
        headerRight: () => (
          <View style={styles.headerActions}>
            <ProfileAvatar size={32} />
            {activeDivision !== null && (
              <TouchableOpacity 
                onPress={() => changeActiveDivision(null)} 
                style={styles.headerBtn} 
                activeOpacity={0.7}
                accessibilityLabel="Switch Portal"
              >
                <Shuffle color="#735B00" size={18} />
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              onPress={logout} 
              style={styles.headerBtn} 
              activeOpacity={0.7}
              accessibilityLabel="Logout"
            >
              <LogOut color="#FFFFFF" size={18} />
            </TouchableOpacity>
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="portal-selection"
        options={{
          href: null,
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: isH4 ? 'H4 Dashboard' : 'FitPass Dashboard',
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color }) => <LayoutDashboard color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="gyms"
        options={{
          title: isH4 ? 'H4 Branches' : 'Partner Gyms',
          tabBarLabel: isH4 ? 'Branches' : 'Gyms',
          tabBarIcon: ({ color }) => <Building2 color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: 'FitPrime Plans',
          tabBarLabel: 'Plans',
          tabBarIcon: ({ color }) => <Package color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="admins"
        options={{
          title: 'Admins Directory',
          tabBarLabel: 'Admins',
          href: (!isH4 && user?.role === 'superadmin') ? '/(superadmin)/admins' : null,
          tabBarIcon: ({ color }) => <ShieldCheck color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="ops-hub"
        options={{
          title: 'Operations',
          tabBarLabel: 'Operations',
          href: isH4 ? '/(superadmin)/ops-hub' : null,
          tabBarIcon: ({ color }) => <LayoutGrid color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="ops/[module]"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="ops/attendance"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="ops/trainer_attendance"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="ops/payroll"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="ops/reports"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="ops/analytics"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="audit"
        options={{
          title: 'Audit Logs',
          tabBarLabel: 'Audit',
          tabBarIcon: ({ color }) => <History color={color} size={22} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#171713',
    borderBottomWidth: 1,
    borderBottomColor: '#34332E',
    shadowOpacity: 0,
    elevation: 0,
  },
  headerTitle: {
    ...theme.typography.h3,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabBar: {
    backgroundColor: '#171713',
    borderTopWidth: 1,
    borderTopColor: '#34332E',
    height: 64,
    paddingBottom: 6,
    paddingTop: 6,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '700',
    paddingBottom: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

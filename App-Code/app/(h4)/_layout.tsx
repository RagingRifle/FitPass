import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { LayoutDashboard, CalendarCheck, Dumbbell, LayoutGrid, User } from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';
import { CustomTabBar } from '@/components/layout/CustomTabBar';

export default function H4Layout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} portalType="h4" />}
      screenOptions={{
        headerShown: false,
      }}
    >
      {/* Core destinations stay fixed; secondary tools live under More. */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'H4 Fitness',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <LayoutDashboard color={color} size={20} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarLabel: 'Attendance',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <CalendarCheck color={color} size={20} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Training',
          tabBarLabel: 'Train',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Dumbbell color={color} size={20} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarLabel: 'More',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <LayoutGrid color={color} size={20} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <User color={color} size={20} />
            </View>
          ),
        }}
      />

      {/* Secondary destinations are linked from the More hub. */}
      <Tabs.Screen name="diets"       options={{ href: null, title: 'Nutrition' }} />
      <Tabs.Screen name="payments"    options={{ href: null, title: 'Payments' }} />
      <Tabs.Screen name="classes"     options={{ href: null, title: 'Group Classes' }} />
      <Tabs.Screen name="pt-sessions" options={{ href: null, title: 'PT Sessions' }} />
      <Tabs.Screen name="assessments" options={{ href: null, title: 'Body Progress' }} />
      <Tabs.Screen name="support"     options={{ href: null, title: 'Help & Support' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    letterSpacing: 0.3,
  },
  tabBar: {
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    height: 64,
    paddingBottom: 8,
    paddingTop: 6,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  iconWrap: {
    width: 36,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  iconWrapActive: {
    backgroundColor: 'rgba(255, 95, 31, 0.1)',
  },
});

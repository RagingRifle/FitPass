import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarCheck, LayoutDashboard, TrendingUp, Users } from '@/components/ui/app-icons';

export default function H4TrainerTabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);
  const barStyle = {
    ...styles.bar,
    height: 60 + bottomInset,
    paddingBottom: bottomInset,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: '#F5F3ED' },
        tabBarActiveTintColor: '#F8DF4B',
        tabBarInactiveTintColor: '#B8B4A8',
        tabBarStyle: barStyle,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Home', tabBarIcon: ({ color }) => <LayoutDashboard size={20} color={color} /> }} />
      <Tabs.Screen name="members" options={{ title: 'Members', tabBarIcon: ({ color }) => <Users size={20} color={color} /> }} />
      <Tabs.Screen name="attendance" options={{ title: 'Attendance', tabBarIcon: ({ color }) => <CalendarCheck size={20} color={color} /> }} />
      <Tabs.Screen name="performance" options={{ title: 'Performance', tabBarIcon: ({ color }) => <TrendingUp size={20} color={color} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#171713',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#39382F',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.16, shadowRadius: 8 },
      android: { elevation: 12 },
    }),
  },
  item: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
});

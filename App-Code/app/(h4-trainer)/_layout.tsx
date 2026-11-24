import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { CalendarCheck, LayoutDashboard, TrendingUp, Users } from '@/components/ui/app-icons';

export default function H4TrainerLayout() {
  return <Tabs screenOptions={{
    headerShown: false,
    sceneStyle: { backgroundColor: '#F5F3ED' },
    tabBarActiveTintColor: '#F8DF4B',
    tabBarInactiveTintColor: '#B8B4A8',
    tabBarStyle: styles.bar,
    tabBarLabelStyle: styles.label,
    tabBarItemStyle: styles.item,
  }}>
    <Tabs.Screen name="dashboard" options={{ title: 'Home', tabBarIcon: ({ color }) => <LayoutDashboard size={19} color={color} /> }} />
    <Tabs.Screen name="members" options={{ title: 'Members', tabBarIcon: ({ color }) => <Users size={19} color={color} /> }} />
    <Tabs.Screen name="attendance" options={{ title: 'Attendance', tabBarIcon: ({ color }) => <CalendarCheck size={19} color={color} /> }} />
    <Tabs.Screen name="performance" options={{ title: 'Performance', tabBarIcon: ({ color }) => <TrendingUp size={19} color={color} /> }} />
    <Tabs.Screen name="leave" options={{ href: null, headerShown: true, title: 'Leave requests' }} />
    <Tabs.Screen name="diets/[memberId]" options={{ href: null, headerShown: true, title: 'Diet plan' }} />
    <Tabs.Screen name="workouts/[memberId]" options={{ href: null, headerShown: true, title: 'Workout plan' }} />
    <Tabs.Screen name="assessments/[memberId]" options={{ href: null, headerShown: true, title: 'Body assessment' }} />
  </Tabs>;
}

const styles = StyleSheet.create({
  bar: { backgroundColor: '#171713', paddingTop: 7, borderTopWidth: 1, borderTopColor: '#39382F', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: .16, shadowRadius: 8 }, android: { elevation: 12 } }) },
  item: { paddingVertical: 2 },
  label: { fontSize: 9, fontWeight: '700' },
});

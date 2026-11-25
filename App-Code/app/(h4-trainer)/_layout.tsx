import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, CalendarCheck, LayoutDashboard, TrendingUp, Users } from '@/components/ui/app-icons';

export default function H4TrainerLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const bottomInset = Math.max(insets.bottom, 8);
  const barStyle = {
    ...styles.bar,
    height: 60 + bottomInset,
    paddingBottom: bottomInset,
  };

  const renderBack = (fallback: string) => () => (
    <TouchableOpacity
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback as any))}
      style={styles.backButton}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <ArrowLeft size={20} color="#29271F" />
    </TouchableOpacity>
  );

  const subScreenHeader = (title: string, fallback: string) => ({
    href: null as null,
    headerShown: true,
    title,
    tabBarStyle: { display: 'none' as const },
    headerStyle: { backgroundColor: '#F5F3ED' },
    headerTintColor: '#29271F',
    headerTitleStyle: { fontWeight: '800' as const },
    headerShadowVisible: false,
    headerLeft: renderBack(fallback),
  });

  return (
    <Tabs
      backBehavior="history"
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
      <Tabs.Screen name="leave" options={subScreenHeader('Leave requests', '/(h4-trainer)/attendance')} />
      <Tabs.Screen name="diets/[memberId]" options={subScreenHeader('Diet plan', '/(h4-trainer)/members')} />
      <Tabs.Screen name="workouts/[memberId]" options={subScreenHeader('Workout plan', '/(h4-trainer)/members')} />
      <Tabs.Screen name="assessments/[memberId]" options={subScreenHeader('Body assessment', '/(h4-trainer)/members')} />
      <Tabs.Screen name="notifications" options={subScreenHeader('Notifications', '/(h4-trainer)/dashboard')} />
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
  backButton: {
    marginLeft: 12,
    padding: 6,
    borderRadius: 10,
  },
});

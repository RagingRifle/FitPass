import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarCheck, LayoutDashboard, TrendingUp, Users } from '@/components/ui/app-icons';

const TAB_ITEMS = [
  { name: 'dashboard', label: 'Home', Icon: LayoutDashboard },
  { name: 'members', label: 'Members', Icon: Users },
  { name: 'attendance', label: 'Attendance', Icon: CalendarCheck },
  { name: 'performance', label: 'Performance', Icon: TrendingUp },
];

function TrainerTabBar({ state }: any) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;
  const active = current === 'dashboard' || current === 'attendance' || current === 'performance' || current === 'members'
    ? current
    : current === 'leave' ? 'attendance' : 'members';
  return <View style={[styles.barWrap, { paddingBottom: Math.max(insets.bottom, 7) }]}><View style={styles.bar}>
    {TAB_ITEMS.map(({ name, label, Icon }) => {
      const selected = active === name;
      return <TouchableOpacity key={name} style={[styles.item, selected && styles.itemActive]} activeOpacity={.78} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }} onPress={() => {
        if (!selected) router.navigate(`/(h4-trainer)/${name}` as any);
      }}>
        <Icon size={19} color={selected ? '#F8DF4B' : '#B8B4A8'} />
        <Text style={[styles.label, selected && styles.labelActive]}>{label}</Text>
      </TouchableOpacity>;
    })}
  </View></View>;
}

export default function H4TrainerLayout() {
  return <Tabs tabBar={(props) => <TrainerTabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: '#F5F3ED' } }}>
    <Tabs.Screen name="dashboard" options={{ title: 'Home' }} />
    <Tabs.Screen name="members" options={{ title: 'Members' }} />
    <Tabs.Screen name="attendance" options={{ title: 'Attendance' }} />
    <Tabs.Screen name="performance" options={{ title: 'Performance' }} />
    <Tabs.Screen name="leave" options={{ href: null, headerShown: true, title: 'Leave requests' }} />
    <Tabs.Screen name="diets/[memberId]" options={{ href: null, headerShown: true, title: 'Diet plan' }} />
    <Tabs.Screen name="workouts/[memberId]" options={{ href: null, headerShown: true, title: 'Workout plan' }} />
    <Tabs.Screen name="assessments/[memberId]" options={{ href: null, headerShown: true, title: 'Body assessment' }} />
  </Tabs>;
}

const styles = StyleSheet.create({
  barWrap: { backgroundColor: '#171713', paddingTop: 7, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: '#39382F', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: .16, shadowRadius: 8 }, android: { elevation: 12 } }) },
  bar: { height: 55, flexDirection: 'row', alignItems: 'stretch', justifyContent: 'space-around' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 13 },
  itemActive: { backgroundColor: '#302E24' },
  label: { color: '#B8B4A8', fontSize: 8, fontWeight: '700' },
  labelActive: { color: '#F8DF4B', fontWeight: '900' },
});

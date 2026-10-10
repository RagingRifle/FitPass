import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BadgeCheck,
  Building2,
  CalendarCheck,
  Dumbbell,
  LayoutDashboard,
  LayoutGrid,
  ScanLine,
  User,
} from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';

interface CustomTabBarProps {
  state: any;
  navigation: any;
  portalType: 'h4' | 'fitpass';
}

const H4_TABS = ['dashboard', 'attendance', 'workouts', 'more', 'profile'];
const FITPASS_TABS = ['dashboard', 'gyms', 'scan', 'plans', 'profile'];

export const CustomTabBar: React.FC<CustomTabBarProps> = ({ state, navigation, portalType }) => {
  const insets = useSafeAreaInsets();
  const isH4 = portalType === 'h4';
  const activeColor = isH4 ? '#246B78' : '#3F63C8';
  const activeBackground = isH4
    ? '#E4F0F1'
    : '#E9EEFC';
  const visibleRoutes = (isH4 ? H4_TABS : FITPASS_TABS)
    .map((name) => state.routes.find((route: any) => route.name === name))
    .filter(Boolean);
  const currentRouteName = state.routes[state.index]?.name;
  const h4MoreRoutes = ['diets', 'payments', 'classes', 'pt-sessions', 'assessments', 'support'];
  const fitPassGymRoutes = ['gym/[id]'];
  const fitPassHomeRoutes = ['workouts', 'history', 'diets'];
  const selectedRouteName = isH4 && h4MoreRoutes.includes(currentRouteName)
    ? 'more'
    : !isH4 && fitPassGymRoutes.includes(currentRouteName)
      ? 'gyms'
      : !isH4 && fitPassHomeRoutes.includes(currentRouteName)
        ? 'dashboard'
        : currentRouteName;

  const getTab = (routeName: string) => {
    if (routeName === 'dashboard') return { label: 'Home', Icon: LayoutDashboard };
    if (routeName === 'attendance') return { label: 'Check-in', Icon: CalendarCheck };
    if (routeName === 'workouts') return { label: 'Train', Icon: Dumbbell };
    if (routeName === 'more') return { label: 'More', Icon: LayoutGrid };
    if (routeName === 'gyms') return { label: 'Gyms', Icon: Building2 };
    if (routeName === 'scan') return { label: 'Scan', Icon: ScanLine };
    if (routeName === 'plans') return { label: 'Plans', Icon: BadgeCheck };
    return { label: 'Profile', Icon: User };
  };

  return (
    <View style={[styles.mainWrapper, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={[styles.bar, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        {visibleRoutes.map((route: any) => {
          const focused = selectedRouteName === route.name;
          const { label, Icon } = getTab(route.name);
          const color = focused ? activeColor : theme.colors.textSecondary;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: focused }}
              style={[styles.tab, focused && { backgroundColor: activeBackground }]}
            >
              <Icon color={color} size={21} strokeWidth={focused ? 2.5 : 2} />
              <Text style={[styles.label, { color }]} numberOfLines={1} adjustsFontSizeToFit>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mainWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  bar: {
    height: 68,
    borderRadius: 23,
    borderWidth: 1,
    padding: 6,
    flexDirection: 'row',
    alignItems: 'stretch',
    ...Platform.select({
      ios: { shadowColor: '#15222A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  tab: {
    flex: 1,
    minWidth: 0,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 2,
  },
  label: {
    width: '100%',
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
  },
});

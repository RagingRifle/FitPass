import React from 'react';
import { Stack } from 'expo-router';
import { theme } from '@/design-system/theme';

export default function FitPassTrainerLayout() {
  return <Stack screenOptions={{ headerStyle: { backgroundColor: theme.colors.background }, headerTintColor: theme.colors.text, headerTitleStyle: { fontWeight: '800' }, contentStyle: { backgroundColor: theme.colors.background } }}>
    <Stack.Screen name="dashboard" options={{ title: 'FitPass Coach Desk' }} />
    <Stack.Screen name="new-class" options={{ title: 'Schedule add-on class' }} />
    <Stack.Screen name="roster/[id]" options={{ title: 'Class roster' }} />
  </Stack>;
}

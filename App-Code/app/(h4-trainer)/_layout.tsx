import React from 'react';
import { Stack } from 'expo-router';
import { theme } from '@/design-system/theme';

export default function H4TrainerLayout() {
  return <Stack screenOptions={{
    headerStyle: { backgroundColor: theme.colors.background },
    headerTintColor: theme.colors.text,
    headerTitleStyle: { fontWeight: '800' },
    contentStyle: { backgroundColor: theme.colors.background },
  }}>
    <Stack.Screen name="dashboard" options={{ title: 'H4 Coach Desk' }} />
    <Stack.Screen name="leave" options={{ title: 'Leave requests' }} />
    <Stack.Screen name="members/[id]" options={{ title: 'Member' }} />
    <Stack.Screen name="assessments/[memberId]" options={{ title: 'Body assessment' }} />
    <Stack.Screen name="workouts/[memberId]" options={{ title: 'Workout plan' }} />
    <Stack.Screen name="diets/[memberId]" options={{ title: 'Diet plan' }} />
  </Stack>;
}

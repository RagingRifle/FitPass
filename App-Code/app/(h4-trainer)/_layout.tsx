import React from 'react';
import { Stack } from 'expo-router';

export default function H4TrainerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#F5F3ED' },
        headerTintColor: '#29271F',
        headerTitleStyle: { fontWeight: '800' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#F5F3ED' },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="leave" options={{ title: 'Leave requests' }} />
      <Stack.Screen name="diets/[memberId]" options={{ title: 'Diet plan' }} />
      <Stack.Screen name="workouts/[memberId]" options={{ title: 'Workout plan' }} />
      <Stack.Screen name="assessments/[memberId]" options={{ title: 'Body assessment' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
    </Stack>
  );
}

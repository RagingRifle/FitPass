import React from 'react';
import { Stack } from 'expo-router';

export default function TrainerMembersLayout() {
  return <Stack screenOptions={{ headerShown: true, headerStyle: { backgroundColor: '#F5F3ED' }, headerTintColor: '#29271F', headerTitleStyle: { fontWeight: '800' }, contentStyle: { backgroundColor: '#F5F3ED' } }}>
    <Stack.Screen name="index" options={{ title: 'Your members' }} />
    <Stack.Screen name="[id]" options={{ title: 'Member details' }} />
  </Stack>;
}

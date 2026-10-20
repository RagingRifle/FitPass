import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, StatusBar } from 'react-native';
import { theme } from '@/design-system/theme';
import { FitPassDashboard } from '@/features/fitpass';

export default function FitPassDashboardScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#171713" />
      <FitPassDashboard onScanQR={() => router.push('/(fitpass)/scan')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#171713' },
});

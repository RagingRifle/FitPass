import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GymDiscoveryExplore } from '@/features/fitpass';

export default function FitPassGymsScreen() {
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <GymDiscoveryExplore />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F5ED' },
});

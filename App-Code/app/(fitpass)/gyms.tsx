import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { GymDiscoveryExplore } from '@/features/fitpass';

export default function FitPassGymsScreen() {
  return (
    <SafeAreaView style={styles.root}>
      <GymDiscoveryExplore />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#171713' },
});

import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import { StyleSheet } from 'react-native';
import { theme } from '@/design-system/theme';
import { FitPassWorkouts } from '@/features/fitpass';

export default function FitPassWorkoutsScreen() {
  return (
    <SafeAreaView style={styles.root}>
      <FitPassWorkouts />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
});

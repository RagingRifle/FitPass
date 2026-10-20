import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import { StyleSheet } from 'react-native';
import { theme } from '@/design-system/theme';
import { H4Workouts } from '@/features/h4';

export default function H4WorkoutsScreen() {
  return (
    <SafeAreaView style={styles.root}>
      <H4Workouts />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
});

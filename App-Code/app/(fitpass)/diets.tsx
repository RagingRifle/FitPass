import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import { StyleSheet } from 'react-native';
import { theme } from '@/design-system/theme';
import { FitPassDiets } from '@/features/fitpass';

export default function FitPassDietsScreen() {
  return (
    <SafeAreaView style={styles.root}>
      <FitPassDiets />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
});

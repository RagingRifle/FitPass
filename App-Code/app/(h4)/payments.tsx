import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import { StyleSheet } from 'react-native';
import { theme } from '@/design-system/theme';
import { H4PaymentHistory } from '@/features/h4';

export default function H4PaymentsScreen() {
  return (
    <SafeAreaView style={styles.root}>
      <H4PaymentHistory />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
});

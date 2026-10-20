import React from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { theme } from '@/design-system/theme';

export default function IndexScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primaryText} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

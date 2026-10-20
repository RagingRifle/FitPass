import React from 'react';
import { StyleSheet, View, ScrollView, StatusBar, ActivityIndicator, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/design-system/theme';

interface ScreenContainerProps {
  children: React.ReactNode;
  scrollable?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  scrollable = true,
  loading = false,
  style,
}) => {
  const insets = useSafeAreaInsets();

  const containerStyle = [
    styles.container,
    { backgroundColor: theme.colors.background },
    {
      paddingTop: insets.top || 16,
      paddingBottom: insets.bottom || 16,
      paddingLeft: insets.left || 16,
      paddingRight: insets.right || 16,
    },
    style,
  ];

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
        <ActivityIndicator size="large" color={theme.colors.primaryText} />
      </View>
    );
  }

  return (
    <View style={[styles.outerContainer, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} backgroundColor={theme.colors.background} />
      {scrollable ? (
        <ScrollView
          style={[styles.scroll, { backgroundColor: theme.colors.background }]}
          contentContainerStyle={containerStyle}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[containerStyle, { backgroundColor: theme.colors.background }]}>{children}</View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flexGrow: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

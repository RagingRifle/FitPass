import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { fontFamilies } from '@/design-system/tokens';

export type BadgeVariant = 'active' | 'expired' | 'frozen' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  showDot?: boolean;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'info', showDot = true, style }) => {
  const getBadgeColors = (): { bg: string; text: string; border: string; dot: string } => {
    switch (variant) {
      case 'active':
      case 'success':
        return {
          bg: 'rgba(46, 125, 50, 0.14)',
          text: '#4CAF50',
          border: 'rgba(76, 175, 80, 0.3)',
          dot: '#4CAF50',
        };
      case 'expired':
      case 'error':
        return {
          bg: 'rgba(198, 40, 40, 0.14)',
          text: '#EF5350',
          border: 'rgba(239, 83, 80, 0.3)',
          dot: '#EF5350',
        };
      case 'frozen':
      case 'warning':
        return {
          bg: 'rgba(254, 223, 30, 0.14)',
          text: '#FFB74D',
          border: 'rgba(255, 183, 77, 0.3)',
          dot: '#FFB74D',
        };
      case 'info':
      default:
        return {
          bg: 'rgba(25, 118, 210, 0.14)',
          text: '#4FC3F7',
          border: 'rgba(79, 195, 247, 0.3)',
          dot: '#4FC3F7',
        };
    }
  };

  const colors = getBadgeColors();

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg, borderColor: colors.border }, style]}>
      {showDot && <View style={[styles.dot, { backgroundColor: colors.dot }]} />}
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    justifyContent: 'center',
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontFamily: fontFamilies.header,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});

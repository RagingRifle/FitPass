import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { theme } from '@/design-system/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}) => {
  const isDarkText = variant === 'primary'; // Yellow primary actions use dark, high-contrast text.

  const buttonStyles = [
    styles.baseButton,
    styles[`${variant}Button` as keyof typeof styles] as ViewStyle,
    disabled && styles.disabledButton,
    style,
  ];

  const labelStyles = [
    styles.baseText,
    isDarkText ? styles.darkText : styles.lightText,
    variant === 'ghost' && styles.ghostText,
    variant === 'danger' && styles.dangerText,
    disabled && styles.disabledText,
    textStyle,
  ];

  const spinnerColor = isDarkText
    ? theme.colors.text
    : variant === 'danger'
    ? theme.colors.error
    : theme.colors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled || loading}
      style={buttonStyles}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <>
          {icon && icon}
          <Text style={[labelStyles, icon ? { marginLeft: theme.spacing.sm } : null]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  baseButton: {
    minHeight: 48,
    minWidth: 48,
    borderRadius: theme.radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 7,
    elevation: 2,
  },
  secondaryButton: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dangerButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  ghostButton: {
    backgroundColor: 'transparent',
  },
  disabledButton: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    shadowOpacity: 0,
    elevation: 0,
    opacity: 0.5,
  },
  baseText: {
    ...theme.typography.bodySm,
    fontWeight: '700',
  },
  darkText: {
    color: theme.colors.text,
  },
  lightText: {
    color: theme.colors.text,
  },
  ghostText: {
    color: theme.colors.textSecondary,
  },
  dangerText: {
    color: theme.colors.error,
  },
  disabledText: {
    color: theme.colors.textMuted,
  },
});

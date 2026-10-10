import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TextInputProps, TouchableOpacity } from 'react-native';
import { Eye, EyeOff } from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  secureTextEntry?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  secureTextEntry,
  style,
  onFocus,
  onBlur,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isSecureVisible, setIsSecureVisible] = useState(false);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const hasSecureToggle = secureTextEntry;
  const isSecure = secureTextEntry && !isSecureVisible;

  const inputBorderColor = error
    ? theme.colors.error
    : isFocused
    ? theme.colors.borderFocus
    : '#3f3f46'; // High contrast outline matching web input:hover

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputWrapper, { borderColor: inputBorderColor }]}>
        <TextInput
          style={[styles.textInput, style]}
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry={isSecure}
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoCapitalize="none"
          {...props}
        />
        {hasSecureToggle && (
          <TouchableOpacity
            onPress={() => setIsSecureVisible(!isSecureVisible)}
            style={styles.toggleBtn}
            activeOpacity={0.7}
          >
            {isSecureVisible ? (
              <EyeOff color={theme.colors.textSecondary} size={20} />
            ) : (
              <Eye color={theme.colors.textSecondary} size={20} />
            )}
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.md,
    width: '100%',
  },
  label: {
    ...theme.typography.bodySm,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  inputWrapper: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radii.md,
    borderWidth: 1.5,
    backgroundColor: theme.colors.bgTertiary,
    paddingHorizontal: theme.spacing.md,
  },
  textInput: {
    flex: 1,
    height: '100%',
    color: theme.colors.text,
    ...theme.typography.bodySm,
  },
  toggleBtn: {
    padding: theme.spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
});

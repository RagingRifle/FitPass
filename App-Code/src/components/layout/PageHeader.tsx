import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { ChevronLeft } from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';
import { fontFamilies } from '@/design-system/tokens';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  onBack,
  rightAction,
}) => {
  return (
    <View style={styles.headerContainer}>
      <View style={styles.leftRow}>
        {onBack && (
            <TouchableOpacity onPress={onBack} style={[styles.backButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} activeOpacity={0.75}>
            <ChevronLeft color={theme.colors.text} size={22} />
          </TouchableOpacity>
        )}
        <View style={styles.titleColumn}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
          {subtitle && <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>}
        </View>
      </View>
      {rightAction && <View style={styles.rightContainer}>{rightAction}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
    width: '100%',
    paddingVertical: 4,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  titleColumn: {
    flex: 1,
  },
  title: {
    fontFamily: fontFamilies.header,
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  rightContainer: {
    marginLeft: theme.spacing.md,
  },
});

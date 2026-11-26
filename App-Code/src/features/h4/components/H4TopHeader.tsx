import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { Bell, LogOut, QrCode } from '@/components/ui/app-icons';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { API_CLIENT } from '@/lib/api-client';
import { theme } from '@/design-system/theme';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';

interface H4TopHeaderProps {
  title: string;
  subtitle?: string;
  showScanBtn?: boolean;
  showNotificationBtn?: boolean;
}

export function H4TopHeader({ title, subtitle, showScanBtn = true, showNotificationBtn = true }: H4TopHeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const isMember = user?.role === 'member';

  const { data: notifications } = useQuery({
    queryKey: ['h4', 'notifications'],
    queryFn: async () => {
      const { data } = await API_CLIENT.get('/notifications');
      return Array.isArray(data) ? data : [];
    },
    enabled: isMember && showNotificationBtn,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const unreadCount = Array.isArray(notifications)
    ? notifications.filter((n: any) => !n.read).length
    : 0;

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#171713" />
      <View style={[styles.headerRoot, { backgroundColor: '#171713', borderBottomColor: '#34332E' }]}>
        <View style={styles.leftGroup}>
          <ProfileAvatar size={36} nameFallback="H" />
          <View style={styles.titleWrap}>
            <Text style={[styles.headerTitle, { color: '#FFFFFF' }]} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.headerSub, { color: '#D4D0C6' }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.rightGroup}>
          {isMember && showNotificationBtn && (
            <TouchableOpacity
              style={[styles.iconBtn, { borderColor: '#34332E', backgroundColor: '#25241E' }]}
              onPress={() => router.navigate('/(h4)/notifications' as any)}
              activeOpacity={0.8}
              accessibilityLabel={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            >
              <Bell size={18} color="#FEDF1E" />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {showScanBtn && (
            <TouchableOpacity
              style={[styles.iconBtn, { borderColor: '#FEDF1E', backgroundColor: '#FEDF1E' }]}
              onPress={() => router.push('/(h4)/scan' as any)}
              activeOpacity={0.8}
              accessibilityLabel="Scan QR"
            >
              <QrCode size={18} color="#171713" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={logout}
            activeOpacity={0.8}
            accessibilityLabel="Logout"
          >
            <LogOut size={14} color="#FFFFFF" />
            <Text style={[styles.logoutText, { color: '#FFFFFF' }]}>Exit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  headerRoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 36) + 12 : 54,
    paddingBottom: 16,
    backgroundColor: '#171713',
    borderBottomWidth: 1,
    borderBottomColor: '#34332E',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: theme.colors.brandMuted,
    borderWidth: 1,
    borderColor: 'rgba(255, 95, 31, 0.25)',
  },
  brandText: {
    fontSize: 9,
    fontFamily: theme.typography.h1.fontFamily,
    fontWeight: '900',
    color: theme.colors.primaryText,
    letterSpacing: 0.8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.brandMuted,
    borderWidth: 1,
    borderColor: 'rgba(255, 95, 31, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontFamily: theme.typography.h1.fontFamily,
    fontWeight: '900',
    color: theme.colors.primaryText,
  },
  titleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: theme.typography.h1.fontFamily,
    fontWeight: '900',
    color: theme.colors.text,
    letterSpacing: 0.2,
  },
  headerSub: {
    fontSize: 11,
    fontFamily: theme.typography.body.fontFamily,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bgTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#DC2626',
    borderWidth: 1.5,
    borderColor: '#171713',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 11,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(198, 40, 40, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(198, 40, 40, 0.15)',
  },
  logoutText: {
    fontSize: 11,
    fontFamily: theme.typography.h3.fontFamily,
    fontWeight: '800',
    color: theme.colors.error,
  },
});


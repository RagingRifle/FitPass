import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCircle2, Clock3, Trash2, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_CLIENT } from '@/lib/api-client';
import { theme } from '@/design-system/theme';
import { H4TopHeader } from '@/features/h4/components/H4TopHeader';

const AUTO_CLEAR_KEY = 'h4_notif_autoclear_days';
const readAutoClear = async (): Promise<string | null> => {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem(AUTO_CLEAR_KEY); } catch { return null; }
  }
  return SecureStore.getItemAsync(AUTO_CLEAR_KEY).catch(() => null);
};
const writeAutoClear = async (value: string): Promise<void> => {
  if (Platform.OS === 'web') {
    try { localStorage.setItem(AUTO_CLEAR_KEY, value); } catch {}
    return;
  }
  await SecureStore.setItemAsync(AUTO_CLEAR_KEY, value).catch(() => {});
};
const AUTO_CLEAR_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '2d', value: 2 },
  { label: '7d', value: 7 },
  { label: '14d', value: 14 },
  { label: '30d', value: 30 },
];

interface AppNotification {
  id?: string;
  _id?: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface NotificationInboxProps {
  title: string;
  subtitle: string;
}

export function NotificationInbox({ title, subtitle }: NotificationInboxProps) {
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [autoClearDays, setAutoClearDays] = useState<number>(0);

  useEffect(() => {
    readAutoClear()
      .then((val: string | null) => {
        const parsed = Number(val);
        if (Number.isFinite(parsed) && parsed > 0) setAutoClearDays(parsed);
      })
      .catch(() => {});
  }, []);

  const loadNotifications = useCallback(async (refresh = false, clearDaysOverride?: number) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const days = clearDaysOverride ?? autoClearDays;
      if (days > 0) {
        await API_CLIENT.delete(`/notifications/clear?olderThanDays=${days}`).catch(() => {});
      }
      const { data } = await API_CLIENT.get('/notifications');
      const list = Array.isArray(data) ? data : [];
      setNotifications(list);
      queryClient.setQueryData(['h4', 'notifications'], list);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'Could not load notifications. Pull down to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [autoClearDays, queryClient]);

  useFocusEffect(useCallback(() => {
    void loadNotifications();
  }, [loadNotifications]));

  const markRead = async (item: AppNotification) => {
    const id = item.id || item._id;
    if (!id || item.read) return;
    try {
      await API_CLIENT.put(`/notifications/${id}`);
      setNotifications(current => current.map(notification => (
        (notification.id || notification._id) === id ? { ...notification, read: true } : notification
      )));
      void queryClient.invalidateQueries({ queryKey: ['h4', 'notifications'] });
    } catch (requestError: any) {
      Alert.alert('Could not update notification', requestError?.response?.data?.message || 'Try again in a moment.');
    }
  };

  const deleteNotification = async (item: AppNotification) => {
    const id = item.id || item._id;
    if (!id) return;
    try {
      await API_CLIENT.delete(`/notifications/${id}`);
      setNotifications(current => current.filter(n => (n.id || n._id) !== id));
      void queryClient.invalidateQueries({ queryKey: ['h4', 'notifications'] });
    } catch (requestError: any) {
      Alert.alert('Could not delete notification', requestError?.response?.data?.message || 'Try again in a moment.');
    }
  };

  const clearNotifications = (mode: 'read' | 'all') => {
    const label = mode === 'all' ? 'Clear all notifications?' : 'Clear all read notifications?';
    Alert.alert('Clear Notifications', label, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            await API_CLIENT.delete(`/notifications/clear?mode=${mode}`);
            setNotifications(current => (mode === 'all' ? [] : current.filter(n => !n.read)));
            void queryClient.invalidateQueries({ queryKey: ['h4', 'notifications'] });
          } catch (requestError: any) {
            Alert.alert('Could not clear notifications', requestError?.response?.data?.message || 'Try again in a moment.');
          }
        },
      },
    ]);
  };

  const handleSelectAutoClear = async (days: number) => {
    setAutoClearDays(days);
    await writeAutoClear(String(days));
    if (days > 0) {
      await loadNotifications(true, days);
    }
  };

  const unreadCount = notifications.filter(item => !item.read).length;
  const hasRead = notifications.some(item => item.read);

  return (
    <SafeAreaView style={styles.root} edges={['left', 'right', 'bottom']}>
      <H4TopHeader title={title} showScanBtn={false} showNotificationBtn={false} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadNotifications(true)} tintColor={theme.colors.primaryText} />}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>H4 INBOX · {unreadCount} UNREAD</Text>
            <Text style={styles.title}>{subtitle}</Text>
          </View>
          {notifications.length > 0 && (
            <View style={styles.actionRow}>
              {hasRead && (
                <TouchableOpacity onPress={() => clearNotifications('read')} style={styles.clearBtn}>
                  <Text style={styles.clearBtnText}>Clear read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => clearNotifications('all')} style={[styles.clearBtn, styles.clearAllBtn]}>
                <Trash2 size={12} color="#991B1B" />
                <Text style={[styles.clearBtnText, { color: '#991B1B' }]}>Clear all</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Member auto-clear preference */}
        <View style={styles.autoClearBar}>
          <Text style={styles.autoClearLabel}>Auto-clear older than:</Text>
          <View style={styles.autoClearPills}>
            {AUTO_CLEAR_OPTIONS.map(opt => {
              const active = autoClearDays === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => handleSelectAutoClear(opt.value)}
                  style={[styles.autoClearPill, active && styles.autoClearPillActive]}
                >
                  <Text style={[styles.autoClearPillText, active && styles.autoClearPillTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={theme.colors.primaryText} style={styles.loader} />
        ) : error ? (
          <View style={styles.emptyCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => loadNotifications()} style={styles.retryButton}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><CheckCircle2 size={24} color="#477955" /></View>
            <Text style={styles.emptyTitle}>You’re up to date</Text>
            <Text style={styles.emptyCopy}>New follow-up and visit reminders will appear here.</Text>
          </View>
        ) : notifications.map((item, index) => (
          <TouchableOpacity
            key={item.id || item._id || `${item.createdAt}-${index}`}
            onPress={() => markRead(item)}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={`${item.read ? 'Read' : 'Unread'} notification. ${item.message}`}
            style={[styles.notification, !item.read && styles.unreadNotification]}
          >
            <View style={[styles.notificationIcon, !item.read && styles.unreadIcon]}>
              <Bell size={17} color={item.read ? '#777263' : '#6A5700'} />
            </View>
            <View style={styles.notificationBody}>
              <Text style={[styles.message, item.read && styles.readMessage]}>{item.message}</Text>
              <View style={styles.timeRow}>
                <Clock3 size={12} color="#8A867A" />
                <Text style={styles.time}>{new Date(item.createdAt).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                })}</Text>
              </View>
            </View>
            <View style={styles.cardRight}>
              {!item.read && <View style={styles.unreadDot} />}
              <TouchableOpacity
                onPress={() => deleteNotification(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Delete notification"
                style={styles.deleteIconBtn}
              >
                <X size={15} color="#8A867A" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 112, gap: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 },
  eyebrow: { color: '#927B25', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: theme.colors.text, fontSize: 25, lineHeight: 31, fontWeight: '900', marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card },
  clearAllBtn: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  clearBtnText: { fontSize: 11, fontWeight: '800', color: theme.colors.textSecondary },
  autoClearBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card },
  autoClearLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary },
  autoClearPills: { flexDirection: 'row', gap: 5 },
  autoClearPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, backgroundColor: theme.colors.surface },
  autoClearPillActive: { backgroundColor: '#171713' },
  autoClearPillText: { fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary },
  autoClearPillTextActive: { color: '#FEDF1E' },
  loader: { padding: 48 },
  notification: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  unreadNotification: { borderColor: '#D8C35E', backgroundColor: '#FFFBE8' },
  notificationIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface },
  unreadIcon: { backgroundColor: '#F8E99A' },
  notificationBody: { flex: 1, gap: 8 },
  message: { color: theme.colors.text, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  readMessage: { color: theme.colors.textSecondary, fontWeight: '500' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  time: { color: '#8A867A', fontSize: 10, fontWeight: '600' },
  cardRight: { alignItems: 'center', gap: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#B38A00' },
  deleteIconBtn: { padding: 2 },
  emptyCard: { alignItems: 'center', padding: 28, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card },
  emptyIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#E8F4EA', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: theme.colors.text, fontSize: 15, fontWeight: '900', marginTop: 12 },
  emptyCopy: { color: theme.colors.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5 },
  errorText: { color: '#991B1B', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  retryButton: { marginTop: 14, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#171713' },
  retryText: { color: '#FEDF1E', fontSize: 12, fontWeight: '800' },
});

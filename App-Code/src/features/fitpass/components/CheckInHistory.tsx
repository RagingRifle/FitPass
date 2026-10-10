import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { theme } from '@/design-system/theme';
import { fontFamilies } from '@/design-system/tokens';
import { Badge, Skeleton, EmptyState } from '@/components/ui';
import { useSessionHistory } from '../api/fitpass.api';
import type { CheckInHistoryItem } from '../types';
import { Clock, ChevronLeft, ChevronRight, Check } from '@/components/ui/app-icons';

export function CheckInHistory() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'ALL' | 'Active' | 'Completed' | 'Expired'>('ALL');
  const { data, isLoading } = useSessionHistory(page);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={{ gap: 6 }}>
            <Skeleton width={150} height={20} borderRadius={8} />
            <Skeleton width={180} height={12} borderRadius={6} />
          </View>
        </View>
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.skeletonCardRow}>
            <Skeleton width={32} height={32} borderRadius={16} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="60%" height={14} borderRadius={6} />
              <Skeleton width="40%" height={10} borderRadius={4} />
            </View>
            <Skeleton width={50} height={20} borderRadius={8} />
          </View>
        ))}
      </View>
    );
  }

  const rawItems: CheckInHistoryItem[] = data?.data ?? [];
  const totalRecords = data?.total ?? rawItems.length;
  const totalPages = Math.ceil(totalRecords / 20) || 1;

  const items = filter === 'ALL' ? rawItems : rawItems.filter((i: CheckInHistoryItem) => i.status === filter);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Check-in History</Text>
          <Text style={styles.subtitle}>Your FitPass workout sessions log</Text>
        </View>
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeText}>{totalRecords} Sessions</Text>
        </View>
      </View>

      {/* Status filter chips */}
      <View style={styles.chipRow}>
        {(['ALL', 'Active', 'Completed', 'Expired'] as const).map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setFilter(s)}
            style={[
              styles.chip,
              filter === s && styles.chipActive
            ]}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.chipText,
                filter === s && styles.chipTextActive
              ]}
            >
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {items.length === 0 ? (
        <EmptyState title="No Sessions Found" description={filter !== 'ALL' ? `No ${filter.toLowerCase()} check-ins.` : "No check-in history found."} />
      ) : (
        <View style={styles.timeline}>
          {items.map((item: CheckInHistoryItem, index: number) => {
            const isCompleted = item.status === 'Completed';
            const isActive = item.status === 'Active';
            
            return (
              <View key={item.id} style={styles.timelineNode}>
                {/* Visual timeline connector line */}
                {index < items.length - 1 && <View style={styles.timelineConnector} />}
                
                {/* Node icon indicator */}
                <View style={[
                  styles.nodePoint,
                  isActive && styles.nodePointActive,
                  isCompleted && styles.nodePointCompleted
                ]}>
                  {isCompleted ? (
                    <Check size={10} color="#FFFFFF" strokeWidth={3} />
                  ) : (
                    <View style={[styles.innerDot, isActive && styles.innerDotActive]} />
                  )}
                </View>

                {/* Node content ticket */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.itemGymName}>{item.gymName || 'Partner Gym'}</Text>
                    <View style={[
                      styles.statusPill,
                      isActive && styles.statusPillActive,
                      isCompleted && styles.statusPillCompleted
                    ]}>
                      <Text style={[
                        styles.statusPillText,
                        isActive && styles.statusPillTextActive,
                        isCompleted && styles.statusPillTextCompleted
                      ]}>
                        {item.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  {item.branchName ? (
                    <Text style={styles.itemBranchName}>🏢 {item.branchName}</Text>
                  ) : null}

                  <View style={styles.timeRow}>
                    <Clock size={11} color={theme.colors.textMuted} />
                    <Text style={styles.itemTime}>
                      {new Date(item.startedAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <View style={styles.paginationRow}>
          <TouchableOpacity
            onPress={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={[styles.pageBtn, page <= 1 && { opacity: 0.4 }]}
          >
            <ChevronLeft size={16} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.pageText}>
            Page {page} of {totalPages}
          </Text>
          <TouchableOpacity
            onPress={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={[styles.pageBtn, page >= totalPages && { opacity: 0.4 }]}
          >
            <ChevronRight size={16} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: {
    fontFamily: fontFamilies.header,
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text,
  },
  subtitle: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  totalBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  totalBadgeText: {
    fontFamily: fontFamilies.header,
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
  },
  chipRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  chipText: {
    fontFamily: fontFamilies.body,
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  skeletonCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
    gap: 12,
  },
  timeline: {
    paddingLeft: 6,
  },
  timelineNode: {
    flexDirection: 'row',
    gap: 14,
    position: 'relative',
    paddingBottom: 16,
  },
  timelineConnector: {
    position: 'absolute',
    left: 9,
    top: 20,
    bottom: 0,
    width: 2,
    backgroundColor: '#E5E7EB',
  },
  nodePoint: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    marginTop: 10,
  },
  nodePointActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  nodePointCompleted: {
    borderColor: '#10B981',
    backgroundColor: '#10B981',
  },
  innerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#9CA3AF',
  },
  innerDotActive: {
    backgroundColor: '#2563EB',
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    gap: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  itemGymName: {
    fontFamily: fontFamilies.header,
    fontSize: 14,
    fontWeight: '800',
    color: '#1F2937',
    flex: 1,
  },
  itemBranchName: {
    fontFamily: fontFamilies.body,
    fontSize: 11,
    color: '#6B7280',
    marginTop: -2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  itemTime: {
    fontFamily: fontFamilies.body,
    fontSize: 11,
    color: '#9CA3AF',
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  statusPillActive: {
    backgroundColor: '#EFF6FF',
  },
  statusPillCompleted: {
    backgroundColor: '#ECFDF5',
  },
  statusPillText: {
    fontFamily: fontFamilies.header,
    fontSize: 8,
    fontWeight: '800',
    color: '#6B7280',
  },
  statusPillTextActive: {
    color: '#2563EB',
  },
  statusPillTextCompleted: {
    color: '#10B981',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  pageBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageText: {
    fontFamily: fontFamilies.body,
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
  },
});

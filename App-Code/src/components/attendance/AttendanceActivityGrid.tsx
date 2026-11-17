import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Flame } from '@/components/ui/app-icons';

const DAY_MS = 24 * 60 * 60 * 1000;
const dateKey = (value: string | Date) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const dayOrdinal = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
};
const previousDateKey = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() - 1);
  return dateKey(date);
};

function getStreaks(keys: Set<string>, todayKey: string) {
  const sorted = [...keys].map(dayOrdinal).sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let previous = 0;
  for (const ordinal of sorted) {
    run = previous && ordinal - previous === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = ordinal;
  }

  let cursor = keys.has(todayKey) ? todayKey : previousDateKey(todayKey);
  let current = 0;
  while (keys.has(cursor)) {
    current += 1;
    cursor = previousDateKey(cursor);
  }
  return { longest, current };
}

export function AttendanceActivityGrid({ dates }: { dates: (string | Date)[] }) {
  const activity = useMemo(() => {
    const attendedKeys = new Set(dates.map(dateKey).filter(Boolean));
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const days = Array.from({ length: 84 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (83 - index));
      const key = dateKey(date);
      return { key, attended: attendedKeys.has(key) };
    });
    const columns = Array.from({ length: 12 }, (_, index) => days.slice(index * 7, index * 7 + 7));
    const attendedInWindow = days.filter(day => day.attended).length;
    return { columns, attendedInWindow, ...getStreaks(attendedKeys, dateKey(today)) };
  }, [dates]);

  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.titleRow}>
          <View style={styles.flame}><Flame size={16} color="#171713" fill="#FEDF1E" /></View>
          <Text style={styles.title}>Workout activity</Text>
        </View>
        <Text style={styles.subtitle}>Your last 12 weeks, one square per day</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gridScroll}>
        <View style={styles.grid}>
          {activity.columns.map((column, columnIndex) => (
            <View key={columnIndex} style={styles.column}>
              {column.map(day => (
                <View
                  key={day.key}
                  accessibilityLabel={`${day.key}: ${day.attended ? 'attended' : 'no check-in'}`}
                  style={[styles.cell, day.attended && styles.attendedCell]}
                />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={styles.legendSwatch} /><Text style={styles.legendText}>No check-in</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendSwatch, styles.attendedCell]} /><Text style={styles.legendText}>Attended</Text></View>
        <Text style={styles.period}>84 days</Text>
      </View>

      <View style={styles.rule} />
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{activity.attendedInWindow}<Text style={styles.statSuffix}> / 84</Text></Text>
          <Text style={styles.statLabel}>days attended</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{activity.longest}<Text style={styles.statSuffix}> days</Text></Text>
          <Text style={styles.statLabel}>longest streak</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{activity.current}<Text style={styles.statSuffix}> days</Text></Text>
          <Text style={styles.statLabel}>current streak</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderWidth: 1, borderColor: '#DED9CB', borderRadius: 18, backgroundColor: '#FFFFFF', gap: 12 },
  heading: { gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flame: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#FFF5C2' },
  title: { color: '#171713', fontSize: 15, fontWeight: '900' },
  subtitle: { color: '#777366', fontSize: 11, marginLeft: 36 },
  gridScroll: { paddingVertical: 3 },
  grid: { flexDirection: 'row', gap: 4 },
  column: { gap: 4 },
  cell: { width: 12, height: 12, borderRadius: 3, backgroundColor: '#F0EFEA', borderWidth: 1, borderColor: '#E4E1D8' },
  attendedCell: { backgroundColor: '#FEDF1E', borderColor: '#DAB900' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 11, height: 11, borderRadius: 3, backgroundColor: '#F0EFEA', borderWidth: 1, borderColor: '#E4E1D8' },
  legendText: { color: '#625E52', fontSize: 10, fontWeight: '700' },
  period: { color: '#898577', fontSize: 10, marginLeft: 'auto' },
  rule: { height: 1, backgroundColor: '#EEECE5' },
  stats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stat: { flex: 1, gap: 3 },
  statValue: { color: '#171713', fontSize: 17, fontWeight: '900' },
  statSuffix: { color: '#777366', fontSize: 10, fontWeight: '700' },
  statLabel: { color: '#777366', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  statDivider: { width: 1, height: 31, backgroundColor: '#EEECE5', marginHorizontal: 8 },
});

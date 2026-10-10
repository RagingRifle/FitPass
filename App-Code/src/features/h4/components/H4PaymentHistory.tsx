import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { theme } from '@/design-system/theme';
import { Typography, Card, Skeleton } from '@/components/ui';
import { useH4Payments } from '../api/h4.api';
import { CreditCard, Award } from '@/components/ui/app-icons';
import { H4TopHeader } from './H4TopHeader';

export function H4PaymentHistory() {
  const { data, isLoading } = useH4Payments();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} style={styles.skeleton} />
        ))}
      </View>
    );
  }

  const items = data?.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: '#FAFAFC' }}>
      <H4TopHeader title="Payments & Renewals" />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerGroup}>
          <View style={styles.headerIconWrap}>
            <Award size={18} color="#F0A020" strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Typography variant="h2" style={styles.headerTitle}>Renewals & Receipts</Typography>
            <Typography variant="caption" color="secondary" style={styles.headerSub}>
              Track paid invoices and membership renewal records
            </Typography>
          </View>
        </View>

        {items.length === 0 ? (
          <Card style={styles.emptyCard}>
            <CreditCard size={32} color="#94A3B8" />
            <Typography variant="bodySm" color="secondary" style={styles.emptyText}>No payment records found.</Typography>
          </Card>
        ) : (
          <View style={styles.paymentList}>
            {items.map((p) => (
              <Card key={p.id} style={styles.row}>
                <View style={styles.icon}>
                  <CreditCard size={16} color="#F0A020" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Typography variant="bodySm" style={styles.planNameText}>
                    {p.planName || 'Membership Payment'}
                  </Typography>
                  <Typography variant="caption" color="secondary" style={styles.paymentMeta}>
                    {new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {p.method}
                  </Typography>
                </View>
                <Typography variant="bodySm" style={styles.amountText}>₹{p.amount}</Typography>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFC' },
  content: { padding: 18, paddingBottom: 100, gap: 16 },
  loadingContainer: { flex: 1, padding: 18, gap: 12, backgroundColor: '#FAFAFC' },
  
  headerGroup: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    marginBottom: 4 
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { 
    color: '#0F172A', 
    fontWeight: '800', 
    fontSize: 20 
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },

  paymentList: { gap: 10 },
  row: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    padding: 16, 
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
  },
  planNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  paymentMeta: {
    fontSize: 11,
    color: '#64748B',
  },
  amountText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#16A34A',
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(240, 160, 32, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: { 
    padding: 30, 
    alignItems: 'center', 
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
  },
  skeleton: { height: 64, borderRadius: 16 },
});

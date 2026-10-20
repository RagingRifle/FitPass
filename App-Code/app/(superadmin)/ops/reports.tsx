import React, { useState } from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView, Share, ActivityIndicator } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { ArrowLeft, Download, DollarSign, FileText } from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';
import { Typography, Card, Select, Input } from '@/components/ui';
import { SafeAreaWrapper } from '@/components/layout';
import { useToast } from '@/hooks/useToast';
import { API_CLIENT } from '@/lib/api-client';

export default function ReportsScreen() {
  const toast = useToast();
  const router = useRouter();

  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [loadingType, setLoadingType] = useState<string | null>(null);

  const downloadReport = async (type: string) => {
    setLoadingType(type);
    try {
      const { data } = await API_CLIENT.get(`/reports/${type}?month=${month}&year=${year}`);
      if (data) {
        await Share.share({
          message: typeof data === 'string' ? data : JSON.stringify(data),
          title: `Monthly ${type} Report`,
        });
        toast.show(`${type} report shared successfully!`, 'success');
      }
    } catch {
      toast.show(`Failed to generate ${type} report`, 'error');
    } finally {
      setLoadingType(null);
    }
  };

  const monthsList = [
    { label: 'January', value: '1' },
    { label: 'February', value: '2' },
    { label: 'March', value: '3' },
    { label: 'April', value: '4' },
    { label: 'May', value: '5' },
    { label: 'June', value: '6' },
    { label: 'July', value: '7' },
    { label: 'August', value: '8' },
    { label: 'September', value: '9' },
    { label: 'October', value: '10' },
    { label: 'November', value: '11' },
    { label: 'December', value: '12' },
  ];

  return (
    <SafeAreaWrapper scrollable={false}>
      <Tabs.Screen 
        options={{ 
          title: 'Export Reports',
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => router.replace('/(superadmin)/ops-hub')}
              style={styles.headerBackBtn}
              activeOpacity={0.7}
            >
              <ArrowLeft color={theme.colors.text} size={20} />
            </TouchableOpacity>
          )
        }} 
      />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Card style={styles.headerCard}>
          <FileText size={48} color={theme.colors.primaryText} style={{ marginBottom: theme.spacing.sm }} />
          <Typography variant="h3" style={{ fontWeight: '800', textAlign: 'center', marginBottom: 4 }}>
            Monthly Business Reports
          </Typography>
          <Typography variant="caption" color="secondary" style={{ textAlign: 'center' }}>
            Select a calendar month and year below to compile and share structured CSV records.
          </Typography>
        </Card>

        {/* Date Filters block */}
        <View style={styles.filterRow}>
          <View style={{ flex: 1.5 }}>
            <Select 
              label="Select Month"
              options={monthsList}
              value={month}
              onValueChange={(val) => setMonth(String(val))}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input 
              label="Select Year"
              value={year}
              onChangeText={setYear}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Action downloads block */}
        <View style={styles.buttonsBlock}>
          <TouchableOpacity 
            onPress={() => downloadReport('revenue')}
            style={styles.downloadBtn}
            disabled={loadingType !== null}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <DollarSign size={20} color="white" />
              <Typography style={styles.btnText}>Monthly Revenue Report</Typography>
            </View>
            {loadingType === 'revenue' ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Download size={18} color="white" />
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => downloadReport('expenses')}
            style={[styles.downloadBtn, { backgroundColor: '#ef4444' }]}
            disabled={loadingType !== null}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <FileText size={20} color="white" />
              <Typography style={styles.btnText}>Monthly Expense Report</Typography>
            </View>
            {loadingType === 'expenses' ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Download size={18} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.md,
  },
  headerCard: {
    padding: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  filterRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  buttonsBlock: {
    gap: theme.spacing.md,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    height: 56,
  },
  btnText: {
    color: 'white',
    fontWeight: '700',
  },
  headerBackBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.xs,
  },
});

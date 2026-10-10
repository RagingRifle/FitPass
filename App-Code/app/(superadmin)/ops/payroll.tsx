import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Tabs, useRouter } from 'expo-router';
import { ArrowLeft, PlusCircle, Sparkles, Settings } from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';
import { Typography, Card, Select, Button, Modal, Input, EmptyState, Badge } from '@/components/ui';
import { SafeAreaWrapper } from '@/components/layout';
import { useToast } from '@/hooks/useToast';
import { API_CLIENT } from '@/lib/api-client';
import { useAuth } from '@/features/auth/hooks/useAuth';

export default function PayrollScreen() {
  const toast = useToast();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [activeTab, setActiveTab] = useState<'records' | 'config'>('records');

  // Filters State
  const [filterTrainerId, setFilterTrainerId] = useState('');
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1));
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));

  // Modals state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showCommissionModal, setShowCommissionModal] = useState(false);

  // Form states
  const [configTrainer, setConfigTrainer] = useState<any | null>(null);
  const [fixedSalary, setFixedSalary] = useState('');
  const [commissionPt, setCommissionPt] = useState('');
  
  const [genTrainerId, setGenTrainerId] = useState('');
  const [genMonth, setGenMonth] = useState(String(new Date().getMonth() + 1));
  const [genYear, setGenYear] = useState(String(new Date().getFullYear()));
  const [genIncentives, setGenIncentives] = useState('0');

  const [commTrainerId, setCommTrainerId] = useState('');
  const [commAmount, setCommAmount] = useState('');

  // 1. Query Trainers List
  const { data: trainersList } = useQuery<any[]>({
    queryKey: ['h4-trainers-payroll'],
    queryFn: async () => {
      const { data } = await API_CLIENT.get('/staff');
      const list = Array.isArray(data) ? data : (data?.data || []);
      return list.filter((s: any) => s.role === 'trainer');
    },
    enabled: isAdmin,
  });

  // 2. Query Pay slips Records
  const { data: paySlips, isLoading: isSlipsLoading, refetch: refetchSlips } = useQuery<any[]>({
    queryKey: ['h4-payslips', filterTrainerId, filterMonth, filterYear],
    queryFn: async () => {
      let url = `/payroll?month=${filterMonth}&year=${filterYear}`;
      if (filterTrainerId) url += `&trainerId=${filterTrainerId}`;
      const { data } = await API_CLIENT.get(url);
      const slipsArray = Array.isArray(data) ? data : (data?.data || []);
      return slipsArray;
    },
  });

  // 3. Mark as Paid Mutation
  const disburseMutation = useMutation({
    mutationFn: async (payrollId: string) => {
      const { data } = await API_CLIENT.put(`/payroll/${payrollId}`, { status: 'Paid' });
      return data;
    },
    onSuccess: () => {
      toast.show('Payroll disbursed successfully!', 'success');
      refetchSlips();
    },
    onError: (err: any) => {
      toast.show(err.response?.data?.message || 'Failed to update payroll', 'error');
    },
  });

  // 4. Upsert Salary Structure Mutation
  const saveStructureMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await API_CLIENT.post('/payroll/salary-structure', payload);
      return data;
    },
    onSuccess: () => {
      toast.show('Salary settings saved!', 'success');
      setShowConfigModal(false);
    },
    onError: (err: any) => {
      toast.show(err.response?.data?.message || 'Failed to update salary config', 'error');
    },
  });

  // 5. Generate Payout Mutation
  const generateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await API_CLIENT.post('/payroll', payload);
      return data;
    },
    onSuccess: () => {
      toast.show('Monthly payroll generated/recalculated!', 'success');
      setShowGenerateModal(false);
      refetchSlips();
    },
    onError: (err: any) => {
      toast.show(err.response?.data?.message || 'Failed to generate payroll', 'error');
    },
  });

  // 6. Log Commission Mutation
  const logCommissionMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await API_CLIENT.post('/payroll/commission', payload);
      return data;
    },
    onSuccess: () => {
      toast.show('PT Commission logged successfully!', 'success');
      setShowCommissionModal(false);
      refetchSlips();
    },
    onError: (err: any) => {
      toast.show(err.response?.data?.message || 'Failed to log commission', 'error');
    },
  });

  const handleOpenConfig = async (trainer: any) => {
    setConfigTrainer(trainer);
    setFixedSalary('');
    setCommissionPt('');
    try {
      const { data } = await API_CLIENT.get(`/payroll/salary-structure/${trainer._id}`);
      if (data) {
        setFixedSalary(String(data.fixedSalary || ''));
        setCommissionPt(String(data.commissionPt || ''));
      }
    } catch {
      // Structure might not exist yet, allow creating a new one
    }
    setShowConfigModal(true);
  };

  const handleSaveConfig = () => {
    if (!fixedSalary || !commissionPt) {
      toast.show('Please provide fixed base salary and PT rates', 'error');
      return;
    }
    saveStructureMutation.mutate({
      trainerId: configTrainer?._id,
      fixedSalary: Number(fixedSalary),
      commissionPt: Number(commissionPt),
    });
  };

  const handleGenerateSubmit = () => {
    if (!genTrainerId) {
      toast.show('Please select a trainer', 'error');
      return;
    }
    generateMutation.mutate({
      trainerId: genTrainerId,
      month: Number(genMonth),
      year: Number(genYear),
      incentives: Number(genIncentives) || 0,
    });
  };

  const handleLogCommissionSubmit = () => {
    if (!commTrainerId || !commAmount) {
      toast.show('Trainer and commission amount are required', 'error');
      return;
    }
    logCommissionMutation.mutate({
      trainerId: commTrainerId,
      amount: Number(commAmount),
      date: new Date(),
    });
  };

  const monthsList = [
    { label: 'Jan', value: '1' },
    { label: 'Feb', value: '2' },
    { label: 'Mar', value: '3' },
    { label: 'Apr', value: '4' },
    { label: 'May', value: '5' },
    { label: 'Jun', value: '6' },
    { label: 'Jul', value: '7' },
    { label: 'Aug', value: '8' },
    { label: 'Sep', value: '9' },
    { label: 'Oct', value: '10' },
    { label: 'Nov', value: '11' },
    { label: 'Dec', value: '12' },
  ];

  const yearsList = [
    { label: '2025', value: '2025' },
    { label: '2026', value: '2026' },
    { label: '2027', value: '2027' },
    { label: '2028', value: '2028' },
  ];

  return (
    <SafeAreaWrapper scrollable={false}>
      <Tabs.Screen 
        options={{ 
          title: 'Payroll Directory',
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

      {/* Tabs Header */}
      <View style={styles.tabHeader}>
        <TouchableOpacity 
          onPress={() => setActiveTab('records')}
          style={[styles.tabBtn, activeTab === 'records' && styles.tabBtnActive]}
        >
          <Typography variant="bodySm" style={activeTab === 'records' ? styles.tabTextActive : styles.tabText}>
            Payroll Records
          </Typography>
        </TouchableOpacity>
        {isAdmin && (
          <TouchableOpacity 
            onPress={() => setActiveTab('config')}
            style={[styles.tabBtn, activeTab === 'config' && styles.tabBtnActive]}
          >
            <Typography variant="bodySm" style={activeTab === 'config' ? styles.tabTextActive : styles.tabText}>
              Salary Configurations
            </Typography>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.container}>
        {activeTab === 'records' ? (
          <>
            {/* Quick Actions Panel */}
            {isAdmin && (
              <View style={styles.actionsPanel}>
                <TouchableOpacity onPress={() => setShowCommissionModal(true)} style={styles.commBtn}>
                  <PlusCircle size={18} color={theme.colors.text} />
                  <Typography style={styles.btnText}>Log Commission</Typography>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowGenerateModal(true)} style={styles.genBtn}>
                  <Sparkles size={18} color="white" />
                  <Typography style={styles.genBtnText}>Generate Payroll</Typography>
                </TouchableOpacity>
              </View>
            )}

            {/* Filter controls row */}
            <View style={styles.filterRow}>
              {isAdmin && (
                <View style={{ flex: 1.5 }}>
                  <Select
                    label=""
                    options={[
                      { label: 'All Trainers', value: '' },
                      ...(trainersList || []).map((t: any) => ({ label: t.name, value: t._id })),
                    ]}
                    value={filterTrainerId}
                    onValueChange={(val) => setFilterTrainerId(String(val))}
                    placeholder="Trainer"
                  />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Select
                  label=""
                  options={monthsList}
                  value={filterMonth}
                  onValueChange={(val) => setFilterMonth(String(val))}
                  placeholder="Month"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Select
                  label=""
                  options={yearsList}
                  value={filterYear}
                  onValueChange={(val) => setFilterYear(String(val))}
                  placeholder="Year"
                />
              </View>
            </View>

            {isSlipsLoading ? (
              <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: theme.spacing['2xl'] }} />
            ) : (paySlips || []).length === 0 ? (
              <EmptyState 
                iconText="💵"
                title="No Payroll Records"
                description="Choose other filters or generate payroll slips."
              />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {(paySlips || []).map((slip: any) => (
                  <Card key={slip._id} style={styles.slipCard}>
                    <View style={styles.slipHeader}>
                      <View style={{ flex: 1 }}>
                        <Typography variant="body" style={{ fontWeight: '700' }}>
                          {slip.trainer?.name || 'Trainer Profile'}
                        </Typography>
                        <Typography variant="caption" color="secondary">
                          Period: {monthsList.find(m => m.value === String(slip.month))?.label || slip.month} {slip.year}
                        </Typography>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                        {slip.status === 'Paid' ? (
                          <Badge label="Paid" variant="active" />
                        ) : (
                          <Badge label="Unpaid" variant="expired" />
                        )}
                        {isAdmin && slip.status !== 'Paid' && (
                          <Button 
                            title="Disburse"
                            onPress={() => {
                              Alert.alert('Disburse Payout', 'Are you sure you want to disburse salary payment?', [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Confirm', onPress: () => disburseMutation.mutate(slip._id) }
                              ]);
                            }}
                            style={styles.disburseBtn}
                          />
                        )}
                      </View>
                    </View>
                    <View style={styles.splitRow}>
                      <Typography variant="caption" color="muted">Base Pay: ₹{slip.fixedSalary}</Typography>
                      <Typography variant="caption" color="muted">Commissions: ₹{slip.commissions}</Typography>
                      <Typography variant="caption" color="muted">Bonus: ₹{slip.incentives}</Typography>
                    </View>
                    <View style={styles.totalBlock}>
                      <Typography variant="bodySm" style={{ fontWeight: '700' }}>Net Payout Amount:</Typography>
                      <Typography variant="body" style={styles.totalValue}>₹{slip.totalAmount}</Typography>
                    </View>
                  </Card>
                ))}
              </ScrollView>
            )}
          </>
        ) : (
          /* Salary Configurations List */
          <ScrollView showsVerticalScrollIndicator={false}>
            {(trainersList || []).map((trainer: any) => (
              <Card key={trainer._id} style={styles.configCard}>
                <View style={styles.configHeader}>
                  <View>
                    <Typography variant="body" style={{ fontWeight: '700' }}>{trainer.name}</Typography>
                    <Typography variant="caption" color="secondary">{trainer.email}</Typography>
                  </View>
                  <TouchableOpacity onPress={() => handleOpenConfig(trainer)} style={styles.configBtn}>
                    <Settings size={18} color={theme.colors.text} />
                  </TouchableOpacity>
                </View>
              </Card>
            ))}
          </ScrollView>
        )}
      </View>

      {/* SALARY STRUCTURE CONFIGURATION MODAL */}
      <Modal visible={showConfigModal} onClose={() => setShowConfigModal(false)} title={`Configure Salary Rates`}>
        <ScrollView style={{ maxHeight: 350 }}>
          <Typography variant="bodySm" color="secondary" style={{ marginBottom: theme.spacing.md }}>
            Setup base fixed monthly pay and PT commission session rates.
          </Typography>
          <Input 
            label="Fixed Salary (₹ / month) *"
            value={fixedSalary}
            onChangeText={setFixedSalary}
            placeholder="e.g. 25000"
            keyboardType="numeric"
          />
          <Input 
            label="PT Commission Session Rate (₹) *"
            value={commissionPt}
            onChangeText={setCommissionPt}
            placeholder="e.g. 200"
            keyboardType="numeric"
          />
        </ScrollView>
        <Button 
          title="Save Config Rates"
          loading={saveStructureMutation.isPending}
          onPress={handleSaveConfig}
          style={{ marginTop: theme.spacing.lg }}
        />
      </Modal>

      {/* GENERATE PAYROLL MODAL */}
      <Modal visible={showGenerateModal} onClose={() => setShowGenerateModal(false)} title="Generate Monthly Payroll">
        <ScrollView style={{ maxHeight: 350 }}>
          <Select 
            label="Select Trainer *"
            options={(trainersList || []).map((t: any) => ({ label: t.name, value: t._id }))}
            value={genTrainerId}
            onValueChange={(val) => setGenTrainerId(String(val))}
            placeholder="Choose trainer"
          />
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Select 
                label="Month *"
                options={monthsList}
                value={genMonth}
                onValueChange={(val) => setGenMonth(String(val))}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Select 
                label="Year *"
                options={yearsList}
                value={genYear}
                onValueChange={(val) => setGenYear(String(val))}
              />
            </View>
          </View>
          <Input 
            label="Incentives & Bonuses (₹)"
            value={genIncentives}
            onChangeText={setGenIncentives}
            placeholder="e.g. 1500"
            keyboardType="numeric"
          />
        </ScrollView>
        <Button 
          title="Log & Generate Slip"
          loading={generateMutation.isPending}
          onPress={handleGenerateSubmit}
          style={{ marginTop: theme.spacing.lg }}
        />
      </Modal>

      {/* MANUALLY RECORD PT COMMISSION MODAL */}
      <Modal visible={showCommissionModal} onClose={() => setShowCommissionModal(false)} title="Log PT Commission">
        <Select 
          label="Select Trainer Profile *"
          options={(trainersList || []).map((t: any) => ({ label: t.name, value: t._id }))}
          value={commTrainerId}
          onValueChange={(val) => setCommTrainerId(String(val))}
          placeholder="Choose trainer"
        />
        <Input 
          label="Commission Payout Amount (₹) *"
          value={commAmount}
          onChangeText={setCommAmount}
          placeholder="e.g. 500"
          keyboardType="numeric"
        />
        <Button 
          title="Record Commission"
          loading={logCommissionMutation.isPending}
          onPress={handleLogCommissionSubmit}
          style={{ marginTop: theme.spacing.lg }}
        />
      </Modal>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.spacing.md,
  },
  tabHeader: {
    flexDirection: 'row',
    backgroundColor: theme.colors.bgTertiary,
    borderRadius: theme.radii.md,
    padding: 4,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.sm,
  },
  tabBtnActive: {
    backgroundColor: theme.colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: theme.colors.text,
    fontWeight: '700',
  },
  actionsPanel: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  commBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.bgTertiary,
    borderRadius: theme.radii.md,
    borderWidth: 1.5,
    borderColor: '#3f3f46',
    height: 48,
  },
  btnText: {
    fontWeight: '700',
  },
  genBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.md,
    height: 48,
  },
  genBtnText: {
    color: 'white',
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  slipCard: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  slipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    paddingBottom: theme.spacing.xs,
  },
  disburseBtn: {
    minHeight: 30,
    height: 30,
    paddingHorizontal: theme.spacing.sm,
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  totalBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.bgTertiary,
    padding: theme.spacing.sm,
    borderRadius: theme.radii.sm,
  },
  totalValue: {
    fontWeight: '800',
    color: theme.colors.primary,
  },
  configCard: {
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  configHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  configBtn: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.bgTertiary,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  headerBackBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.xs,
  },
});

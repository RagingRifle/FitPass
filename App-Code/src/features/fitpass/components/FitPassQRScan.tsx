import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, ScrollView, Modal, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { X, QrCode, Building2, ChevronLeft, MapPin, Search, ShieldCheck, CheckCircle2, ArrowRight, Activity, Flame } from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';
import { fontFamilies } from '@/design-system/tokens';
import { Button } from '@/components/ui';
import { useAuth } from '@/features/auth';
import { useCheckIn, usePartnerGyms, useSessionStatus } from '../api/fitpass.api';

type ScanState = 'idle' | 'scanning' | 'confirming' | 'processing' | 'done' | 'error';

export function FitPassQRScan() {
  const router = useRouter();
  const { activeDivision } = useAuth();
  const targetDashboard = activeDivision === 'h4' ? '/(h4)/dashboard' : '/(fitpass)/dashboard';
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const checkIn = useCheckIn();
  const { data: gyms } = usePartnerGyms();
  const { data: sessionData, refetch: refreshSessionStatus } = useSessionStatus();
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualSearch, setManualSearch] = useState('');

  const confirmCheckIn = useCallback(async (payload: { gymId: string; branchId?: string; qrCode: string; gymName?: string }) => {
    const refreshedStatus = await refreshSessionStatus().catch(() => null);
    const remaining = refreshedStatus?.data?.sessionsRemaining ?? sessionData?.sessionsRemaining ?? 0;
    setScanState('confirming');
    Alert.alert(
      'Confirm attendance',
      `${payload.gymName || 'This gym'}\n\nYou have ${remaining} session${remaining === 1 ? '' : 's'} remaining. Confirm attendance?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setScanState('idle') },
        {
          text: 'Confirm attendance',
          onPress: async () => {
            setScanState('processing');
            try {
              const result = await checkIn.mutateAsync({ gymId: payload.gymId, branchId: payload.branchId, qrCode: payload.qrCode });
              setScanState('done');
              Alert.alert(
                'Attendance confirmed',
                `${payload.gymName || 'Gym'} check-in is complete. You have ${result.sessionsRemaining ?? Math.max(remaining - 1, 0)} session${(result.sessionsRemaining ?? Math.max(remaining - 1, 0)) === 1 ? '' : 's'} remaining.`,
                [{ text: 'Go to Dashboard', onPress: () => router.push(targetDashboard as any) }],
              );
            } catch (err: any) {
              const msg = err?.response?.data?.message || err?.message || 'Check-in failed. Please try again.';
              setErrorMessage(msg);
              setScanState('error');
              Alert.alert('Check-in Failed', msg, [
                { text: 'Try Again', onPress: () => { setScanState('idle'); setErrorMessage(null); } },
                { text: 'Cancel', onPress: () => router.back() },
              ]);
            }
          },
        },
      ],
    );
  }, [checkIn, refreshSessionStatus, router, sessionData?.sessionsRemaining, targetDashboard]);

  const handleBarCodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scanState !== 'idle') return;
      setScanState('scanning');

      try {
        let payload: { gymId: string; branchId?: string; gymName?: string };
        try {
          payload = JSON.parse(data);
        } catch {
          payload = { gymId: data };
        }

        if (!payload?.gymId) throw new Error('Invalid QR code — missing gymId');
        const gym = (gyms || []).find(g => (g.id || g._id) === payload.gymId);
        const branch = gym?.branches?.find(b => (b.id || b._id) === payload.branchId);
        confirmCheckIn({ ...payload, gymName: branch?.name || gym?.name || payload.gymName, qrCode: data });
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Check-in failed. Please try again.';
        setErrorMessage(msg);
        setScanState('error');
        Alert.alert('Check-in Failed', msg, [
          { text: 'Try Again', onPress: () => { setScanState('idle'); setErrorMessage(null); } },
          { text: 'Cancel', onPress: () => router.back() },
        ]);
      }
    },
    [scanState, confirmCheckIn, gyms],
  );

  const handleManualCheckIn = async (gym: any) => {
    setIsManualModalOpen(false);
    const gymId = gym.id || gym._id;
    confirmCheckIn({ gymId, qrCode: JSON.stringify({ gymId, gymName: gym.name }), gymName: gym.name });
  };

  const filteredGyms = (gyms || []).filter(g =>
    g.name?.toLowerCase().includes(manualSearch.toLowerCase()) ||
    (g.address || '').toLowerCase().includes(manualSearch.toLowerCase())
  );

  if (!permission) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.permSubtitle}>Requesting camera permission…</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.permIconCircle}>
          <QrCode size={36} color={theme.colors.primary} />
        </View>
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permSubtitle}>
          FitPass uses your camera to scan partner gym QR codes for attendance check-ins.
        </Text>
        <TouchableOpacity style={styles.grantBtn} onPress={requestPermission} activeOpacity={0.85}>
          <Text style={styles.grantBtnText}>Grant Camera Access</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.manualFallbackBtn}
          onPress={() => setIsManualModalOpen(true)}
          activeOpacity={0.8}
        >
          <Building2 size={16} color={theme.colors.primary} />
          <Text style={styles.manualFallbackText}>Select Gym Manually</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.goBackBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>

        {/* Manual Modal */}
        <Modal visible={isManualModalOpen} animationType="slide" onRequestClose={() => setIsManualModalOpen(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.modalBadgeRow}>
                  <ShieldCheck size={13} color={theme.colors.primary} />
                  <Text style={styles.modalBadgeText}>FITPASS NETWORK</Text>
                </View>
                <Text style={styles.modalTitle}>Select Partner Gym</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsManualModalOpen(false)}>
                <X size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchBox}>
              <Search size={16} color={theme.colors.textMuted} />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search gym by name or location..."
                placeholderTextColor={theme.colors.textMuted}
                value={manualSearch}
                onChangeText={setManualSearch}
              />
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
              {filteredGyms.length === 0 ? (
                <View style={styles.emptyManualBox}>
                  <Text style={styles.emptyManualText}>No matching partner gym found.</Text>
                </View>
              ) : (
                filteredGyms.map((g) => (
                  <TouchableOpacity
                    key={g.id || g._id}
                    style={styles.gymRow}
                    onPress={() => handleManualCheckIn(g)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.gymIconBox}>
                      <Building2 size={20} color={theme.colors.primary} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.gymRowName}>{g.name}</Text>
                      {g.address ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <MapPin size={11} color={theme.colors.textMuted} />
                          <Text style={styles.gymRowAddress} numberOfLines={1}>{g.address}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.checkInChip}>
                      <Text style={styles.checkInChipText}>Check In</Text>
                      <ArrowRight size={12} color="#fff" />
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      {/* Top Header Floating Card */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backCircleBtn}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <ChevronLeft size={22} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerMainTitle}>Scan QR Code</Text>
          <Text style={styles.headerSubTitle}>FitPass Express Attendance</Text>
        </View>

        <View style={styles.creditPill}>
          <Activity size={12} color={theme.colors.primary} />
          <Text style={styles.creditPillText}>{sessionData?.sessionsRemaining ?? 0} LEFT</Text>
        </View>
      </View>

      {/* Main Creative Viewfinder Frame */}
      <View style={styles.scannerViewportFrame}>
        <View style={styles.cameraClipContainer}>
          <CameraView
            style={styles.cameraInstance}
            facing="back"
            onBarcodeScanned={scanState === 'idle' ? handleBarCodeScanned : undefined}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          >
            {/* Viewfinder Target Reticle */}
            <View style={styles.viewfinderCenter}>
              <View style={styles.cornerTL} />
              <View style={styles.cornerTR} />
              <View style={styles.cornerBL} />
              <View style={styles.cornerBR} />
              <View style={styles.laserLine} />
            </View>
          </CameraView>
        </View>
      </View>

      {/* Bottom Action Sheet Card */}
      <View style={styles.bottomCardContainer}>
        <View style={styles.statusIndicatorRow}>
          <View
            style={[
              styles.statusPulseDot,
              {
                backgroundColor:
                  scanState === 'error'
                    ? '#EF5350'
                    : scanState === 'done'
                    ? '#4CAF50'
                    : theme.colors.primary,
              },
            ]}
          />
          <Text style={styles.scanStatusText}>
            {scanState === 'idle' && 'Align gym counter QR code inside frame'}
            {scanState === 'scanning' && 'Reading FitPass QR code…'}
            {scanState === 'confirming' && 'Confirm attendance in the popup…'}
            {scanState === 'processing' && 'Validating pass & deducting 1 session…'}
            {scanState === 'done' && '✅ Entry Authorized!'}
            {scanState === 'error' && `❌ ${errorMessage ?? 'Check-in failed'}`}
          </Text>
        </View>

        {/* Manual Gym Selection Button */}
        <TouchableOpacity
          style={styles.manualTriggerBtn}
          onPress={() => setIsManualModalOpen(true)}
          activeOpacity={0.85}
        >
          <Building2 size={16} color={theme.colors.primary} />
          <Text style={styles.manualTriggerText}>
            Can't scan QR? Select Gym Manually
          </Text>
        </TouchableOpacity>
      </View>

      {/* Manual Gym Selection Modal Sheet */}
      <Modal visible={isManualModalOpen} animationType="slide" onRequestClose={() => setIsManualModalOpen(false)}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.modalBadgeRow}>
                <ShieldCheck size={13} color={theme.colors.primary} />
                <Text style={styles.modalBadgeText}>FITPASS NETWORK</Text>
              </View>
              <Text style={styles.modalTitle}>Select Gym for Entry</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsManualModalOpen(false)}>
              <X size={20} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalSearchBox}>
            <Search size={16} color={theme.colors.textMuted} />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search partner gym by name or city..."
              placeholderTextColor={theme.colors.textMuted}
              value={manualSearch}
              onChangeText={setManualSearch}
            />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
            {filteredGyms.length === 0 ? (
              <View style={styles.emptyManualBox}>
                <Text style={styles.emptyManualText}>No matching partner gym found.</Text>
              </View>
            ) : (
              filteredGyms.map((g) => (
                <TouchableOpacity
                  key={g.id || g._id}
                  style={styles.gymRow}
                  onPress={() => handleManualCheckIn(g)}
                  activeOpacity={0.85}
                >
                  <View style={styles.gymIconBox}>
                    <Building2 size={20} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.gymRowName}>{g.name}</Text>
                    {g.address ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <MapPin size={11} color={theme.colors.textMuted} />
                        <Text style={styles.gymRowAddress} numberOfLines={1}>{g.address}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.checkInChip}>
                    <Text style={styles.checkInChipText}>Check In</Text>
                    <ArrowRight size={12} color="#fff" />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFC',
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    backgroundColor: '#FAFAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  permIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 95, 31, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 95, 31, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permTitle: {
    fontFamily: fontFamilies.header,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  permSubtitle: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 20,
  },
  grantBtn: {
    backgroundColor: '#FF5F1F',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  grantBtnText: {
    fontFamily: fontFamilies.header,
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  manualFallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 95, 31, 0.08)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 95, 31, 0.25)',
    width: '100%',
    justifyContent: 'center',
  },
  manualFallbackText: {
    fontFamily: fontFamilies.header,
    fontSize: 14,
    fontWeight: '800',
    color: '#FF5F1F',
  },
  goBackBtn: { paddingVertical: 8 },
  goBackText: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },

  // Light Top Header Bar
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerMainTitle: {
    fontFamily: fontFamilies.header,
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  headerSubTitle: {
    fontFamily: fontFamilies.body,
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  creditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 95, 31, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 95, 31, 0.25)',
  },
  creditPillText: {
    fontFamily: fontFamilies.header,
    fontSize: 11,
    fontWeight: '800',
    color: '#FF5F1F',
  },

  // Creative Framed Camera Reticle Viewport
  scannerViewportFrame: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginVertical: 14,
  },
  cameraClipContainer: {
    width: '100%',
    maxWidth: 320,
    aspectRatio: 1,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FF5F1F',
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  cameraInstance: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinderCenter: {
    width: 210,
    height: 210,
    borderRadius: 20,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cornerTL: { position: 'absolute', top: 0, left: 0, width: 28, height: 28, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#FF5F1F', borderTopLeftRadius: 14 },
  cornerTR: { position: 'absolute', top: 0, right: 0, width: 28, height: 28, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#FF5F1F', borderTopRightRadius: 14 },
  cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 28, height: 28, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#FF5F1F', borderBottomLeftRadius: 14 },
  cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#FF5F1F', borderBottomRightRadius: 14 },
  laserLine: {
    width: '90%',
    height: 2,
    backgroundColor: '#FF5F1F',
    shadowColor: '#FF5F1F',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },

  // Bottom Light Action Card
  bottomCardContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 90,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusPulseDot: { width: 8, height: 8, borderRadius: 4 },
  scanStatusText: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  manualTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 95, 31, 0.08)',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 95, 31, 0.25)',
  },
  manualTriggerText: {
    fontFamily: fontFamilies.header,
    fontSize: 14,
    fontWeight: '800',
    color: '#FF5F1F',
    letterSpacing: 0.2,
  },

  // Light Manual Gym Sheet Modal
  modalContent: {
    flex: 1,
    backgroundColor: '#FAFAFC',
    padding: 20,
    paddingTop: 50,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  modalBadgeText: {
    fontFamily: fontFamilies.header,
    fontSize: 10,
    fontWeight: '800',
    color: '#FF5F1F',
    letterSpacing: 0.8,
  },
  modalTitle: {
    fontFamily: fontFamilies.header,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 46,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalSearchInput: {
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    color: '#0F172A',
  },
  gymRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  gymIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 95, 31, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 95, 31, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gymRowName: {
    fontFamily: fontFamilies.header,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  gymRowAddress: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },
  checkInChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF5F1F',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  checkInChipText: {
    fontFamily: fontFamilies.header,
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyManualBox: {
    padding: 30,
    alignItems: 'center',
  },
  emptyManualText: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    color: '#64748B',
  },
});

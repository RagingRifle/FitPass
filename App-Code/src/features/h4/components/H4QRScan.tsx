import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, ScrollView, Modal, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { X, QrCode, Dumbbell, ChevronLeft, MapPin, Search, ShieldCheck, CheckCircle2, ArrowRight, Activity, Flame, Building2 } from '@/components/ui/app-icons';
import { theme } from '@/design-system/theme';
import { fontFamilies } from '@/design-system/tokens';
import { useH4CheckIn, useH4Dashboard } from '../api/h4.api';
import { useQuery } from '@tanstack/react-query';
import { API_CLIENT } from '@/lib/api-client';

type ScanState = 'idle' | 'scanning' | 'confirming' | 'processing' | 'done' | 'error';

interface H4GymItem {
  id: string;
  _id?: string;
  name: string;
  address?: string;
  isHomeGym?: boolean;
}

export function H4QRScan() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const checkInMutation = useH4CheckIn();
  const { data: dashboardData, refetch: refreshDashboard } = useH4Dashboard();
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualSearch, setManualSearch] = useState('');

  // Fetch gyms and filter STRICTLY for H4 Gyms & Branches only
  const { data: h4GymsList, isLoading: isGymsLoading } = useQuery<H4GymItem[]>({
    queryKey: ['h4-gyms-and-branches-only'],
    queryFn: async () => {
      try {
        const { data } = await API_CLIENT.get('/member-portal/gyms');
        const all = Array.isArray(data) ? data : data?.data ?? [];
        // Filter strictly for H4 gyms or H4 branches
        const h4Only = all.filter((g: any) =>
          (g.name && g.name.toLowerCase().includes('h4')) ||
          g.isBranch === true
        );
        return h4Only;
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });

  const memberHomeGymName = dashboardData?.member?.gymName || 'H4 Fitness Main Flagship Gym';
  const memberHomeGymId = dashboardData?.member?.gymId || '327d37e7-f978-43a9-82ef-e6c4a4dc3c5d';
  const confirmCheckIn = useCallback(async (payload: { gymId: string; branchId?: string; qrCode: string; gymName?: string }) => {
    const refreshedDashboard = await refreshDashboard().catch(() => null);
    const memberData = refreshedDashboard?.data?.member || dashboardData?.member;
    const remaining = memberData?.sessionsRemaining;
    const total = memberData?.sessionsTotal;
    const balanceText = (total ?? 0) > 0 ? `${remaining ?? 0} sessions remaining` : 'Unlimited access';
    setScanState('confirming');
    Alert.alert('Confirm attendance', `${payload.gymName || 'H4 Fitness'}\n\n${balanceText}. Confirm attendance?`, [
      { text: 'Cancel', style: 'cancel', onPress: () => setScanState('idle') },
      {
        text: 'Confirm attendance',
        onPress: async () => {
          setScanState('processing');
          try {
            const result = await checkInMutation.mutateAsync({ gymId: payload.gymId, branchId: payload.branchId, qrCode: payload.qrCode });
            setScanState('done');
            const updatedRemaining = result.sessionsRemaining ?? remaining;
            const resultBalance = (total ?? 0) > 0
              ? `${updatedRemaining ?? 0} sessions remaining`
              : 'Unlimited access';
            Alert.alert('Attendance confirmed', `Your check-in at ${payload.gymName || 'H4 Fitness'} is complete. ${resultBalance}.`, [
              { text: 'Go to Dashboard', onPress: () => router.push('/(h4)/dashboard') },
            ]);
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
    ]);
  }, [checkInMutation, dashboardData?.member, refreshDashboard, router]);

  // Consolidated H4 Gym List  always includes registered Home Gym at top
  const h4Locations: H4GymItem[] = [
    {
      id: memberHomeGymId,
      name: memberHomeGymName,
      address: 'H4 Main Fitness Center & Headquarters',
      isHomeGym: true,
    },
    ...(h4GymsList || []).filter(g => g.id !== memberHomeGymId && g._id !== memberHomeGymId),
  ];

  const filteredH4Locations = h4Locations.filter(g =>
    g.name.toLowerCase().includes(manualSearch.toLowerCase()) ||
    (g.address || '').toLowerCase().includes(manualSearch.toLowerCase())
  );

  const handleBarCodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (scanState !== 'idle') return;
      setScanState('scanning');

      try {
        let payload: { gymId?: string; branchId?: string; gymName?: string };
        try {
          payload = JSON.parse(data);
        } catch {
          payload = { gymId: data };
        }

        setScanState('processing');
        confirmCheckIn({
          gymId: payload.gymId || memberHomeGymId,
          branchId: payload.branchId,
          qrCode: data,
          gymName: payload.gymName,
        });
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
    [scanState, confirmCheckIn, memberHomeGymId],
  );

  const handleManualCheckIn = async (gym: H4GymItem) => {
    setIsManualModalOpen(false);
    const gymId = gym.id || gym._id || memberHomeGymId;
    const qrCode = JSON.stringify({ gymId, gymName: gym.name, source: 'manual_h4_select' });
    confirmCheckIn({ gymId, qrCode, gymName: gym.name });
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.permSubtitle}>Requesting camera permission</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.permIconCircle}>
          <Dumbbell size={36} color="#F5B800" />
        </View>
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permSubtitle}>
          H4 Fitness uses your camera to scan H4 gym QR codes for instant attendance check-ins.
        </Text>
        <TouchableOpacity style={styles.grantBtn} onPress={requestPermission} activeOpacity={0.85}>
          <Text style={styles.grantBtnText}>Grant Camera Access</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.manualFallbackBtn}
          onPress={() => setIsManualModalOpen(true)}
          activeOpacity={0.8}
        >
          <Dumbbell size={16} color="#F5B800" />
          <Text style={styles.manualFallbackText}>Select H4 Branch Manually</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.goBackBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>

        {/* Manual H4 Gym Selection Modal */}
        <Modal visible={isManualModalOpen} animationType="slide" onRequestClose={() => setIsManualModalOpen(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.modalBadgeRow}>
                  <ShieldCheck size={13} color="#F5B800" />
                  <Text style={styles.modalBadgeText}>H4 ATHLETE VERIFICATION</Text>
                </View>
                <Text style={styles.modalTitle}>Select H4 Gym / Branch</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsManualModalOpen(false)}>
                <X size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchBox}>
              <Search size={16} color="#64748B" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search H4 location by branch name..."
                placeholderTextColor="#64748B"
                value={manualSearch}
                onChangeText={setManualSearch}
              />
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
              {filteredH4Locations.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.gymRow, g.isHomeGym && styles.homeGymRow]}
                  onPress={() => handleManualCheckIn(g)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.gymIconBox, g.isHomeGym && styles.homeGymIconBox]}>
                    <Dumbbell size={20} color="#F5B800" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.gymRowName}>{g.name}</Text>
                      {g.isHomeGym && (
                        <View style={styles.homePill}>
                          <Text style={styles.homePillText}>REGISTERED HOME</Text>
                        </View>
                      )}
                    </View>
                    {g.address ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <MapPin size={11} color="#64748B" />
                        <Text style={styles.gymRowAddress} numberOfLines={1}>{g.address}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.checkInChip}>
                    <Text style={styles.checkInChipText}>Check In</Text>
                    <ArrowRight size={12} color="#fff" />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backCircleBtn}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <ChevronLeft size={22} color="#0F172A" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerMainTitle}>H4 Attendance QR</Text>
          <Text style={styles.headerSubTitle}>Physical Entry & Attendance Check-in</Text>
        </View>

        <View style={styles.brandBadge}>
          <Dumbbell size={13} color="#F5B800" />
          <Text style={styles.brandBadgeText}>H4</Text>
        </View>
      </View>

      {/* Main Reticle Viewfinder Frame */}
      <View style={styles.scannerViewportFrame}>
        <View style={styles.cameraClipContainer}>
          <CameraView
            style={styles.cameraInstance}
            facing="back"
            onBarcodeScanned={scanState === 'idle' ? handleBarCodeScanned : undefined}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          >
            {/* Viewfinder Reticle */}
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
                    ? '#DC2626'
                    : scanState === 'done'
                    ? '#16A34A'
                    : '#F5B800',
              },
            ]}
          />
          <Text style={styles.scanStatusText}>
            {scanState === 'idle' && 'Align H4 gym counter QR code inside frame'}
            {scanState === 'scanning' && 'Reading H4 attendance QR code'}
            {scanState === 'confirming' && 'Confirm attendance in the popup'}
            {scanState === 'processing' && 'Validating H4 athlete access'}
            {scanState === 'done' && ' H4 Attendance Marked!'}
            {scanState === 'error' && ` ${errorMessage ?? 'Check-in failed'}`}
          </Text>
        </View>

        {/* Manual Gym Selection Button */}
        <TouchableOpacity
          style={styles.manualTriggerBtn}
          onPress={() => setIsManualModalOpen(true)}
          activeOpacity={0.85}
        >
          <Dumbbell size={16} color="#F5B800" />
          <Text style={styles.manualTriggerText}>
            Can't scan? Select H4 Branch Manually
          </Text>
        </TouchableOpacity>
      </View>

      {/* Manual Gym Selection Modal Sheet */}
      <Modal visible={isManualModalOpen} animationType="slide" onRequestClose={() => setIsManualModalOpen(false)}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.modalBadgeRow}>
                <ShieldCheck size={13} color="#F5B800" />
                <Text style={styles.modalBadgeText}>H4 FITNESS BRANCHES ONLY</Text>
              </View>
              <Text style={styles.modalTitle}>Select H4 Branch / Gym</Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsManualModalOpen(false)}>
              <X size={20} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalSearchBox}>
            <Search size={16} color="#64748B" />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search H4 location..."
              placeholderTextColor="#64748B"
              value={manualSearch}
              onChangeText={setManualSearch}
            />
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
            {filteredH4Locations.map((g) => (
              <TouchableOpacity
                key={g.id}
                style={[styles.gymRow, g.isHomeGym && styles.homeGymRow]}
                onPress={() => handleManualCheckIn(g)}
                activeOpacity={0.85}
              >
                <View style={[styles.gymIconBox, g.isHomeGym && styles.homeGymIconBox]}>
                  <Dumbbell size={20} color="#F5B800" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.gymRowName}>{g.name}</Text>
                    {g.isHomeGym && (
                      <View style={styles.homePill}>
                        <Text style={styles.homePillText}>REGISTERED HOME</Text>
                      </View>
                    )}
                  </View>
                  {g.address ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <MapPin size={11} color="#64748B" />
                      <Text style={styles.gymRowAddress} numberOfLines={1}>{g.address}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.checkInChip}>
                  <Text style={styles.checkInChipText}>Check In</Text>
                  <ArrowRight size={12} color="#fff" />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F5ED',
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    backgroundColor: '#F8F5ED',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  permIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(240, 160, 32, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(240, 160, 32, 0.35)',
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
    backgroundColor: '#F5B800',
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
    backgroundColor: 'rgba(240, 160, 32, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(240, 160, 32, 0.25)',
    width: '100%',
    justifyContent: 'center',
  },
  manualFallbackText: {
    fontFamily: fontFamilies.header,
    fontSize: 14,
    fontWeight: '800',
    color: '#F5B800',
  },
  goBackBtn: { paddingVertical: 8 },
  goBackText: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },

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
    backgroundColor: '#F8F5ED',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerMainTitle: {
    fontFamily: fontFamilies.header,
    fontSize: 19,
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
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(240, 160, 32, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(240, 160, 32, 0.3)',
  },
  brandBadgeText: {
    fontFamily: fontFamilies.header,
    fontSize: 11,
    fontWeight: '900',
    color: '#F5B800',
  },

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
    borderColor: '#F5B800',
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
  cornerTL: { position: 'absolute', top: 0, left: 0, width: 28, height: 28, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#F5B800', borderTopLeftRadius: 14 },
  cornerTR: { position: 'absolute', top: 0, right: 0, width: 28, height: 28, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#F5B800', borderTopRightRadius: 14 },
  cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 28, height: 28, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#F5B800', borderBottomLeftRadius: 14 },
  cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#F5B800', borderBottomRightRadius: 14 },
  laserLine: {
    width: '90%',
    height: 2,
    backgroundColor: '#F5B800',
    shadowColor: '#F5B800',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },

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
    backgroundColor: '#F8F5ED',
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
    backgroundColor: 'rgba(240, 160, 32, 0.1)',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(240, 160, 32, 0.3)',
  },
  manualTriggerText: {
    fontFamily: fontFamilies.header,
    fontSize: 14,
    fontWeight: '800',
    color: '#F5B800',
    letterSpacing: 0.2,
  },

  modalContent: {
    flex: 1,
    backgroundColor: '#F8F5ED',
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
    color: '#F5B800',
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
  },
  homeGymRow: {
    borderColor: 'rgba(240, 160, 32, 0.4)',
    backgroundColor: '#FFFDF9',
  },
  gymIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(240, 160, 32, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(240, 160, 32, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeGymIconBox: {
    backgroundColor: 'rgba(240, 160, 32, 0.18)',
  },
  gymRowName: {
    fontFamily: fontFamilies.header,
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  homePill: {
    backgroundColor: 'rgba(240, 160, 32, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  homePillText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#F5B800',
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
    backgroundColor: '#F5B800',
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
});

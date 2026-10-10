import React from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView, Image, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Globe, ArrowRight, ShieldCheck, Lock } from '@/components/ui/app-icons';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Typography } from '@/components/ui';

const H4_LOGO = require('../../assets/h4.jpeg');

export default function PortalSelectionScreen() {
  const changeActiveDivision = useAuth((state) => state.changeActiveDivision);
  const user = useAuth((state) => state.user);
  const router = useRouter();

  const handleSelect = async (division: 'fitpass' | 'h4') => {
    try {
      await changeActiveDivision(division);
      router.replace('/(superadmin)/dashboard');
    } catch (err) {
      console.error('Failed to change division:', err);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} bounces={false} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.h4LogoContainer}>
            <Image source={H4_LOGO} style={styles.h4LogoImage} resizeMode="cover" />
          </View>
          <Typography variant="h1" style={styles.title}>
            SUPER ADMIN PORTAL
          </Typography>
          <Typography variant="bodySm" color="secondary" style={styles.subtitle}>
            Welcome, {user?.name || 'Super Admin'}. Please choose the administration console you wish to access.
          </Typography>
        </View>

        {/* Portal Cards Selection */}
        <View style={styles.grid}>
          {/* FitPass Portal Card */}
          <TouchableOpacity
            onPress={() => handleSelect('fitpass')}
            activeOpacity={0.88}
            style={styles.cardWrapper}
          >
            <View style={[styles.portalCard, styles.fitpassBorder]}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 224, 27, 0.15)' }]}>
                  <Globe size={28} color="#D99B00" strokeWidth={2.2} />
                </View>
                <View style={styles.arrowBadge}>
                  <ArrowRight size={18} color="#1A1510" strokeWidth={2.5} />
                </View>
              </View>

              <Typography variant="h2" style={styles.cardTitle}>
                FitPass Portal
              </Typography>
              <Typography variant="bodySm" color="secondary" style={styles.cardDesc}>
                Manage global partner gyms, subscription plans, platform revenue, and system-wide audit records.
              </Typography>
            </View>
          </TouchableOpacity>

          {/* H4 Gym Portal Card */}
          <TouchableOpacity
            onPress={() => handleSelect('h4')}
            activeOpacity={0.88}
            style={styles.cardWrapper}
          >
            <View style={[styles.portalCard, styles.h4Border]}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(46, 125, 50, 0.12)' }]}>
                  <ShieldCheck size={28} color="#2E7D32" strokeWidth={2.2} />
                </View>
                <View style={styles.arrowBadge}>
                  <ArrowRight size={18} color="#1A1510" strokeWidth={2.5} />
                </View>
              </View>

              <Typography variant="h2" style={styles.cardTitle}>
                H4 Gym Portal
              </Typography>
              <Typography variant="bodySm" color="secondary" style={styles.cardDesc}>
                Access physical H4 branches database, check-ins, local member listings, trainer payroll, and expenses.
              </Typography>
            </View>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Lock size={14} color="#9B9084" />
          <Typography variant="caption" color="muted" style={styles.footerText}>
            Secured Super-Admin Management Access
          </Typography>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
    maxWidth: 340,
    width: '100%',
  },
  h4LogoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#ffe01b',
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#ffe01b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  h4LogoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1A1510',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#655B50',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  grid: {
    width: '100%',
    maxWidth: 400,
    gap: 20,
  },
  cardWrapper: {
    width: '100%',
  },
  portalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#EAE7E1',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  fitpassBorder: {
    borderLeftWidth: 5,
    borderLeftColor: '#ffe01b',
  },
  h4Border: {
    borderLeftWidth: 5,
    borderLeftColor: '#2E7D32',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8F6F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAE7E1',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1510',
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 14,
    color: '#655B50',
    lineHeight: 20,
    fontWeight: '400',
  },
  footer: {
    marginTop: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 12,
    color: '#9B9084',
    fontWeight: '600',
  },
});

import React, { useEffect } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/lib/query-client';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Toast } from '@/components/ui';
import { useThemeStore } from '@/design-system/theme';

function NavigationGuard() {
  const { token, loading, initializeAuth, activeDivision, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Load auth state on app startup
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Monitor auth status and navigate accordingly
  useEffect(() => {
    if (loading) return;

    const segmentsList = segments as string[];
    const inAuthGroup = segmentsList[0] === '(auth)';
    const inSuperadmin = segmentsList[0] === '(superadmin)';
    const inFitpass = segmentsList[0] === '(fitpass)';
    const inH4 = segmentsList[0] === '(h4)';
    const inH4Trainer = segmentsList[0] === '(h4-trainer)';
    const inFitPassTrainer = segmentsList[0] === '(fitpass-trainer)';
    const onPortalSelection = inSuperadmin && segmentsList[1] === 'portal-selection';

    if (!token) {
      // Unauthenticated: go to unified login page
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
      return;
    }

    // Authenticated — resolve correct destination
    const role = user?.role;
    const isStaff = role && ['superadmin', 'partner', 'admin', 'trainer', 'receptionist', 'fitpass_admin', 'h4_admin', 'h4_branch_admin'].includes(role);
    const isMember = role === 'member';

    if (isStaff) {
      if (role === 'trainer' && activeDivision === 'h4') {
        if (!inH4Trainer) router.replace('/(h4-trainer)/dashboard');
        return;
      }
      if (role === 'trainer' && activeDivision === 'fitpass') {
        if (!inFitPassTrainer) router.replace('/(fitpass-trainer)/dashboard');
        return;
      }
      // Staff/admin portal
      if (activeDivision === null) {
        if (!onPortalSelection) router.replace('/(superadmin)/portal-selection');
      } else {
        if (inAuthGroup || onPortalSelection || !segmentsList[0]) {
          router.replace('/(superadmin)/dashboard');
        }
      }
    } else if (isMember && activeDivision === 'h4') {
      // H4 member portal
      if (!inH4 && !segmentsList.includes('scan')) router.replace('/(h4)/dashboard');
    } else if (isMember && activeDivision === 'fitpass') {
      // FitPass member portal
      if (!inFitpass && !segmentsList.includes('scan')) router.replace('/(fitpass)/dashboard');
    } else if (isMember && activeDivision === null) {
      // Member logged in but division not yet set — go to login page
      if (!inAuthGroup) router.replace('/(auth)/login');
    }
  }, [token, loading, activeDivision, user, segments, router]);

  return <Slot />;
}




import { Platform } from 'react-native';

export default function RootLayout() {
  const { themeMode, initTheme } = useThemeStore();

  useEffect(() => {
    initTheme();

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const fontId = 'google-fonts-oswald-sans';
      if (!document.getElementById(fontId)) {
        const link = document.createElement('link');
        link.id = fontId;
        link.rel = 'stylesheet';
        link.href =
          'https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700;800;900&family=Google+Sans+Flex:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800;900&display=swap';
        document.head.appendChild(link);
      }
    }
  }, [initTheme]);

  return (
    <SafeAreaProvider key={themeMode}>
      <QueryClientProvider client={queryClient}>
        <NavigationGuard />
        <Toast />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

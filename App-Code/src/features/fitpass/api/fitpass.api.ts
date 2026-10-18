// FitPass API layer — TanStack Query hooks
// Consumes existing backend: /api/member-portal/* and /api/discovery/*
// AGENTS.md §4, §12 — server data via TanStack Query, never duplicated

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_CLIENT } from '@/lib/api-client';
import type {
  SessionStatus,
  CheckInHistoryItem,
  PartnerGym,
  FitPassPlan,
  FitPassDashboardData,
  GymReview,
  DiscoveryGymItem,
  GymPost,
} from '../types';

// ─── Query Keys ─────────────────────────────────────────────────────────────
export const FITPASS_KEYS = {
  dashboard: ['fitpass', 'dashboard'] as const,
  sessionStatus: ['fitpass', 'sessionStatus'] as const,
  history: (page = 1) => ['fitpass', 'history', page] as const,
  partnerGyms: ['fitpass', 'partnerGyms'] as const,
  partnerGymDetail: (id: string) => ['fitpass', 'partnerGym', id] as const,
  gymReviews: (id: string) => ['fitpass', 'gymReviews', id] as const,
  plans: ['fitpass', 'plans'] as const,
  discoveryGyms: (params: Record<string, any>) => ['fitpass', 'discovery', 'gyms', params] as const,
  discoveryGymDetails: (gymId: string) => ['fitpass', 'discovery', 'gym', gymId] as const,
  postsFeed: ['fitpass', 'discovery', 'posts'] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────
export const useFitPassDashboard = () =>
  useQuery<FitPassDashboardData>({
    queryKey: FITPASS_KEYS.dashboard,
    queryFn: async () => {
      const { data } = await API_CLIENT.get('/member-portal/dashboard');
      return data;
    },
    staleTime: 30_000,
  });

export const useSessionStatus = () =>
  useQuery<SessionStatus>({
    queryKey: FITPASS_KEYS.sessionStatus,
    queryFn: async () => {
      const { data } = await API_CLIENT.get('/member-portal/sessions/status');
      return data;
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

export const useSessionHistory = (page = 1) =>
  useQuery<{ data: CheckInHistoryItem[]; total: number }>({
    queryKey: FITPASS_KEYS.history(page),
    queryFn: async () => {
      const { data } = await API_CLIENT.get(`/member-portal/sessions/history?page=${page}&limit=20`);
      return data;
    },
    staleTime: 60_000,
  });

export const usePartnerGyms = () =>
  useQuery<PartnerGym[]>({
    queryKey: FITPASS_KEYS.partnerGyms,
    queryFn: async () => {
      const { data } = await API_CLIENT.get('/member-portal/gyms');
      return Array.isArray(data) ? data : data?.data ?? [];
    },
    staleTime: 5 * 60_000,
  });

export const usePartnerGymDetail = (gymId?: string) =>
  useQuery<PartnerGym>({
    queryKey: FITPASS_KEYS.partnerGymDetail(gymId || ''),
    queryFn: async () => {
      if (!gymId) throw new Error('Gym ID is required');
      const { data } = await API_CLIENT.get(`/member-portal/gyms/${gymId}`);
      return data;
    },
    enabled: Boolean(gymId),
    staleTime: 3 * 60_000,
  });

export const useGymReviews = (gymId?: string) =>
  useQuery<{ reviews: GymReview[]; averageRating: number; totalReviews: number; myReview?: GymReview | null }>({
    queryKey: FITPASS_KEYS.gymReviews(gymId || ''),
    queryFn: async () => {
      if (!gymId) throw new Error('Gym ID is required');
      const { data } = await API_CLIENT.get(`/member-portal/gyms/${gymId}/reviews`);
      return data;
    },
    enabled: Boolean(gymId),
    staleTime: 2 * 60_000,
  });

export const useFitPassPlans = () =>
  useQuery<FitPassPlan[]>({
    queryKey: FITPASS_KEYS.plans,
    queryFn: async () => {
      const { data } = await API_CLIENT.get('/member-portal/fitprime-plans');
      return Array.isArray(data) ? data : data?.data ?? [];
    },
    staleTime: 10 * 60_000,
  });

export const useDiscoveryGyms = (params: Record<string, any> = {}) =>
  useQuery<DiscoveryGymItem[]>({
    queryKey: FITPASS_KEYS.discoveryGyms(params),
    queryFn: async () => {
      const { data } = await API_CLIENT.get('/discovery/gyms', { params });
      return data.data || [];
    },
    staleTime: 30_000,
  });

export const useDiscoveryGymDetails = (gymId: string, params: Record<string, any> = {}) =>
  useQuery<DiscoveryGymItem>({
    queryKey: FITPASS_KEYS.discoveryGymDetails(gymId),
    queryFn: async () => {
      const { data } = await API_CLIENT.get(`/discovery/gyms/${gymId}`, { params });
      return data.data;
    },
    enabled: !!gymId,
    staleTime: 30_000,
  });

export const usePublicPostsFeed = () =>
  useQuery<GymPost[]>({
    queryKey: FITPASS_KEYS.postsFeed,
    queryFn: async () => {
      const { data } = await API_CLIENT.get('/discovery/posts');
      return data.data || [];
    },
    staleTime: 60_000,
  });

// ─── Mutations ───────────────────────────────────────────────────────────────
export const useCheckIn = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { gymId: string; branchId?: string; qrCode: string }) => {
      const { data } = await API_CLIENT.post('/member-portal/sessions/check-in', payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FITPASS_KEYS.sessionStatus });
      qc.invalidateQueries({ queryKey: FITPASS_KEYS.dashboard });
      qc.invalidateQueries({ queryKey: ['fitpass', 'history'] });
    },
  });
};

export const useAddGymReview = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { gymId: string; rating: number; comment: string }) => {
      const { data } = await API_CLIENT.post(`/member-portal/gyms/${payload.gymId}/reviews`, {
        rating: payload.rating,
        comment: payload.comment,
      });
      return data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: FITPASS_KEYS.gymReviews(variables.gymId) });
      qc.invalidateQueries({ queryKey: FITPASS_KEYS.partnerGymDetail(variables.gymId) });
      qc.invalidateQueries({ queryKey: FITPASS_KEYS.partnerGyms });
    },
  });
};

export const usePurchasePlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (planId: string) => {
      // The mock gateway exercises the same signed order/verification path as Razorpay.
      // Replace this adapter with the native Razorpay SDK when mobile checkout is enabled.
      const { data: order } = await API_CLIENT.post('/member-portal/purchase-plan/create-order', { planId, gateway: 'mock' });
      if (!order.is_mock || !order.mock_token) {
        throw new Error('Mobile checkout is not configured for live payments yet.');
      }
      const { data: verifyResult } = await API_CLIENT.post('/member-portal/purchase-plan/verify', {
        razorpay_order_id: order.id,
        razorpay_payment_id: `pay_test_${Date.now()}`,
        mock_token: order.mock_token,
        planId,
      });
      return verifyResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: FITPASS_KEYS.sessionStatus });
      qc.invalidateQueries({ queryKey: FITPASS_KEYS.dashboard });
      qc.invalidateQueries({ queryKey: FITPASS_KEYS.plans });
    },
  });
};

import { useQuery, useMutation } from '@tanstack/react-query';
import { API_CLIENT } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------
export interface Gym {
  _id: string;
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  defaultSessionDurationMinutes: number;
  admins?: {
    name: string;
    email: string;
  }[];
}

export interface FitPrimePlan {
  _id: string;
  name: string;
  sessions: number;
  price: number;
  gymId: string;
}

export interface AuditLog {
  _id: string;
  action: string;
  details: string;
  userName: string;
  userRole?: string;
  userEmail?: string;
  entityName?: string;
  createdAt: string;
  ip?: string;
}

export interface AuditSummary {
  summary: {
    _id: string;
    count: number;
  }[];
  recentLogins: {
    _id: string;
    userName: string;
    userRole: string;
    userEmail: string;
    createdAt: string;
    ip?: string;
  }[];
}

export interface GlobalStats {
  totalMembers: number;
  activeMembers: number;
  expiredMembers: number;
  expiringSoonCount: number;
  newMembersThisMonth: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  monthlyProfit: number;
  revenueTrend?: {
    _id: { month: number; year: number };
    total: number;
  }[];
  planBreakdown?: {
    _id: string;
    value: number;
  }[];
  methodBreakdown?: {
    _id: string;
    value: number;
  }[];
}

// ------------------------------------------------------------
// API Queries & Mutations
// ------------------------------------------------------------

// 1. Stats
export const useGlobalStats = (branchId?: string, gymId?: string) => {
  return useQuery<GlobalStats>({
    queryKey: ['global-stats', branchId, gymId],
    queryFn: async () => {
      const { data } = await API_CLIENT.get('/dashboard/stats');
      return data;
    },
  });
};

// 2. Partner Gyms
export const usePartnerGyms = () => {
  return useQuery<Gym[]>({
    queryKey: ['partner-gyms'],
    queryFn: async () => {
      const { data } = await API_CLIENT.get('/superadmin/gyms');
      // Filter out SYSTEM gym if present
      return data.filter((g: Gym) => g.name !== 'SYSTEM');
    },
  });
};

export const useCreatePartnerGym = () => {
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await API_CLIENT.post('/superadmin/gyms', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-gyms'] });
    },
  });
};

export const useUpdatePartnerGym = () => {
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; name?: string; address?: string; latitude?: number; longitude?: number; defaultSessionDurationMinutes?: number }) => {
      const { data } = await API_CLIENT.put(`/superadmin/gyms/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-gyms'] });
    },
  });
};

export const useDeletePartnerGym = () => {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await API_CLIENT.delete(`/superadmin/gyms/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-gyms'] });
    },
  });
};

// 3. FitPrime Plans
export const useFitPrimePlans = () => {
  return useQuery<FitPrimePlan[]>({
    queryKey: ['fitprime-plans'],
    queryFn: async () => {
      const { data } = await API_CLIENT.get('/superadmin/plans');
      return data;
    },
  });
};

export const useCreateFitPrimePlan = () => {
  return useMutation({
    mutationFn: async (payload: { name: string; sessions: number; price: number }) => {
      const { data } = await API_CLIENT.post('/superadmin/plans', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fitprime-plans'] });
    },
  });
};

export const useUpdateFitPrimePlan = () => {
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; name?: string; sessions?: number; price?: number }) => {
      const { data } = await API_CLIENT.put(`/superadmin/plans/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fitprime-plans'] });
    },
  });
};

export const useDeleteFitPrimePlan = () => {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await API_CLIENT.delete(`/superadmin/plans/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fitprime-plans'] });
    },
  });
};

// 4. Audit Logs
export const useAuditLogs = (params: { page: number; limit: number; action?: string; entity?: string }) => {
  return useQuery<{ logs: AuditLog[]; total: number; pages: number }>({
    queryKey: ['audit-logs', params],
    queryFn: async () => {
      const query = new URLSearchParams();
      query.append('page', String(params.page));
      query.append('limit', String(params.limit));
      if (params.action) query.append('action', params.action);
      if (params.entity) query.append('entity', params.entity);

      const { data } = await API_CLIENT.get(`/audit?${query.toString()}`);
      return data;
    },
  });
};

export const useAuditSummary = () => {
  return useQuery<AuditSummary>({
    queryKey: ['audit-summary'],
    queryFn: async () => {
      const { data } = await API_CLIENT.get('/audit/summary');
      return data;
    },
  });
};

// 5. H4 Branches
export interface Branch {
  _id: string;
  id?: string;
  parentGymId?: string;
  gymId?: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  managerName?: string;
  fitPassEnabled?: boolean;
  latitude?: number;
  longitude?: number;
  memberCount?: number;
  totalRevenue?: number;
}

export const useBranches = () => {
  return useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data } = await API_CLIENT.get('/branches');
      return data;
    },
  });
};

export const useCreateBranch = () => {
  return useMutation({
    mutationFn: async (payload: Omit<Branch, '_id' | 'memberCount' | 'totalRevenue'>) => {
      const { data } = await API_CLIENT.post('/branches', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
};

export const useUpdateBranch = () => {
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Omit<Branch, 'memberCount' | 'totalRevenue'>> & { id: string }) => {
      const { data } = await API_CLIENT.put(`/branches/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
};

export const useDeleteBranch = () => {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await API_CLIENT.delete(`/branches/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
};

// 6. Generic H4 Module List Query
export const useGenericList = <T>(queryKey: string, path: string, options?: { enabled?: boolean }) => {
  return useQuery<T[]>({
    queryKey: [queryKey],
    queryFn: async () => {
      const { data } = await API_CLIENT.get(path);
      if (data && typeof data === 'object') {
        if (data.members && Array.isArray(data.members)) {
          return data.members;
        }
        if (data.success && Array.isArray(data.data)) {
          return data.data;
        }
        if (Array.isArray(data)) {
          return data;
        }
      }
      return Array.isArray(data) ? data : [];
    },
    enabled: options?.enabled,
  });
};

export const useGenericCreate = (queryKey: string, path: string) => {
  return useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await API_CLIENT.post(path, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
  });
};

export const useGenericUpdate = (queryKey: string, path: string) => {
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const { data } = await API_CLIENT.put(`${path}/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
  });
};

export const useGenericDelete = (queryKey: string, path: string) => {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await API_CLIENT.delete(`${path}/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
  });
};

// 7. Dedicated Admins
export interface DedicatedAdmin {
  _id: string;
  name: string;
  email: string;
  role: 'fitpass_admin' | 'h4_admin';
  status?: string;
}

export const useDedicatedAdmins = () => {
  return useQuery<DedicatedAdmin[]>({
    queryKey: ['dedicated-admins'],
    queryFn: async () => {
      const { data } = await API_CLIENT.get('/superadmin/admins');
      return data || [];
    },
  });
};

export const useCreateDedicatedAdmin = () => {
  return useMutation({
    mutationFn: async (payload: Omit<DedicatedAdmin, '_id' | 'status'> & { password?: string }) => {
      const { data } = await API_CLIENT.post('/superadmin/admins', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dedicated-admins'] });
    },
  });
};

export const useUpdateDedicatedAdmin = () => {
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Omit<DedicatedAdmin, '_id'>> & { id: string; password?: string }) => {
      const { data } = await API_CLIENT.put(`/superadmin/admins/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dedicated-admins'] });
    },
  });
};

export const useDeleteDedicatedAdmin = () => {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await API_CLIENT.delete(`/superadmin/admins/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dedicated-admins'] });
    },
  });
};

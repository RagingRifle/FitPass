import { create } from 'zustand';
import { API_CLIENT, registerUnauthorizedHandler } from '@/lib/api-client';
import { storage } from '@/lib/storage';
import { queryClient } from '@/lib/query-client';

export interface User {
  id: string;
  _id: string;
  name: string;
  email: string;
  role: 'superadmin' | 'admin' | 'receptionist' | 'trainer' | 'member' | 'partner' | 'fitpass_admin' | 'h4_admin';
  gymId?: string;
  gymName?: string;
  branchId?: string;
  memberId?: string;
  phone?: string;
  profileImageUrl?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  selectedGymId: string;
  selectedBranchId: string;
  activeDivision: 'fitpass' | 'h4' | null;
  
  initializeAuth: () => Promise<void>;
  checkUser: (email: string) => Promise<{ status: 'new' | 'exists'; message: string; role?: string }>;
  verifyOTP: (email: string, otp: string) => Promise<{ success: boolean; message?: string }>;
  login: (email: string, password: string, portal?: 'staff' | 'h4' | 'fitpass') => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  changeSelectedGym: (gymId: string) => Promise<void>;
  changeSelectedBranch: (branchId: string) => Promise<void>;
  changeActiveDivision: (division: 'fitpass' | 'h4' | null) => Promise<void>;
  updateUserLocal: (updatedUserFields: Partial<User>) => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => {
  // Register interceptor handler to sync with store on 401s
  registerUnauthorizedHandler(() => {
    set({
      user: null,
      token: null,
      selectedGymId: '',
      selectedBranchId: '',
      activeDivision: null,
    });
  });

  return {
    user: null,
    token: null,
    loading: true,
    selectedGymId: '',
    selectedBranchId: '',
    activeDivision: null,

    initializeAuth: async () => {
      try {
        const token = await storage.getToken();
        const storedUser = await storage.getItem('user');
        const selectedGymId = await storage.getItem('selectedGymId') || '';
        const selectedBranchId = await storage.getItem('selectedBranchId') || '';
        const activeDivision = (await storage.getItem('activeDivision') as 'fitpass' | 'h4' | null) || null;

        if (token && storedUser) {
          set({
            token,
            user: JSON.parse(storedUser),
            selectedGymId,
            selectedBranchId,
            activeDivision,
          });
        }
      } catch (error) {
        console.error('Failed to restore auth state', error);
      } finally {
        set({ loading: false });
      }
    },

    checkUser: async (email: string) => {
      const { data } = await API_CLIENT.post('/auth/check-user', { email });
      return data;
    },

    verifyOTP: async (email: string, otp: string) => {
      try {
        const { data } = await API_CLIENT.post('/auth/verify-otp', { email, otp });
        
        let division: 'fitpass' | 'h4' | null = null;
        if (data.role !== 'superadmin') {
          const userGymName = data.gymName || '';
          const userGymId = data.gymId || '';
          const isH4Gym = userGymName.toUpperCase() === 'H4' || userGymId === '05a08fdf-7427-48a5-8b25-e18d5a5668cd';
          division = isH4Gym ? 'h4' : 'fitpass';
        }

        await storage.setToken(data.token);
        await storage.setItem('user', JSON.stringify(data));
        
        if (division) {
          await storage.setItem('activeDivision', division);
        } else {
          await storage.removeItem('activeDivision');
        }

        set({
          token: data.token,
          user: data,
          selectedGymId: data.gymId || '',
          selectedBranchId: data.branchId || '',
          activeDivision: division,
        });

        return { success: true };
      } catch (error: any) {
        let message = 'OTP verification failed';
        if (error.response?.data?.message) {
          message = error.response.data.message;
        } else if (error.message) {
          message = error.message;
        }
        return { success: false, message };
      }
    },

    login: async (email, password, portal) => {
      try {
        const payload: Record<string, string> = { email, password };
        if (portal) payload.portalType = portal;

        const { data } = await API_CLIENT.post('/auth/login', payload);
        
        const userRole = data.role;
        const userGymName = data.gymName || '';
        const userGymId = data.gymId || '';

        const isAdministrative = ['superadmin', 'admin', 'trainer', 'receptionist', 'partner', 'fitpass_admin', 'h4_admin'].includes(userRole);

        // Portal-specific role and gym routing validation (if portal specified)
        if (portal) {
          if (portal === 'staff') {
            if (!isAdministrative) {
              throw new Error('Access Denied: This portal is restricted to Staffs and Partners.');
            }
          } else if (portal === 'h4') {
            const isH4 = isAdministrative || (userRole === 'member' && (userGymName.toUpperCase() === 'H4' || userGymId === '05a08fdf-7427-48a5-8b25-e18d5a5668cd'));
            if (!isH4) {
              throw new Error('Access Denied: This portal is restricted to H4 Gym Members.');
            }
          } else if (portal === 'fitpass') {
            const isFitpass = isAdministrative || (userRole === 'member' && (userGymName.toUpperCase() !== 'H4' && userGymId !== '05a08fdf-7427-48a5-8b25-e18d5a5668cd'));
            if (!isFitpass) {
              throw new Error('Access Denied: This portal is restricted to Fitpass Members.');
            }
          }
        }

        // Determine active division based on user context
        let division: 'fitpass' | 'h4' | null = null;
        if (data.role !== 'superadmin') {
          const isH4Gym = userGymName.toUpperCase() === 'H4' || userGymId === '05a08fdf-7427-48a5-8b25-e18d5a5668cd';
          division = isH4Gym ? 'h4' : 'fitpass';
        }

        // Save to secure storage
        await storage.setToken(data.token);
        await storage.setItem('user', JSON.stringify(data));
        
        if (division) {
          await storage.setItem('activeDivision', division);
        } else {
          await storage.removeItem('activeDivision');
        }

        if (data.gymId) {
          await storage.setItem('selectedGymId', data.gymId);
        } else {
          await storage.removeItem('selectedGymId');
        }

        if (data.branchId) {
          await storage.setItem('selectedBranchId', data.branchId);
        } else {
          await storage.removeItem('selectedBranchId');
        }

        set({
          token: data.token,
          user: data,
          selectedGymId: data.gymId || '',
          selectedBranchId: data.branchId || '',
          activeDivision: division,
        });
        
        return { success: true };
      } catch (error: any) {
        console.error('Login failed with error:', error);
        
        let message = 'Login failed';
        if (error.response) {
          const resData = error.response.data;
          if (resData && typeof resData === 'object') {
            message = resData.message || resData.error || JSON.stringify(resData);
          } else if (typeof resData === 'string') {
            message = resData;
          }
        } else if (error.request) {
          const endpoint = `${error.config?.baseURL || ''}${error.config?.url || ''}`;
          message = `No response from ${endpoint || 'the API server'} (${error.message || 'network error'}).`;
        } else {
          message = error.message || 'An unexpected error occurred';
        }

        return {
          success: false,
          message,
        };
      }
    },

    logout: async () => {
      await storage.removeToken();
      await storage.removeItem('user');
      await storage.removeItem('selectedGymId');
      await storage.removeItem('selectedBranchId');
      await storage.removeItem('activeDivision');
      
      set({
        user: null,
        token: null,
        selectedGymId: '',
        selectedBranchId: '',
        activeDivision: null,
      });
    },

    changeSelectedGym: async (gymId) => {
      if (gymId) {
        await storage.setItem('selectedGymId', gymId);
      } else {
        await storage.removeItem('selectedGymId');
      }
      set({ selectedGymId: gymId });
    },

    changeSelectedBranch: async (branchId) => {
      if (branchId) {
        await storage.setItem('selectedBranchId', branchId);
      } else {
        await storage.removeItem('selectedBranchId');
      }
      set({ selectedBranchId: branchId });
      queryClient.invalidateQueries();
    },

    changeActiveDivision: async (division) => {
      if (division === null) {
        await storage.removeItem('activeDivision');
        await storage.removeItem('selectedGymId');
        await storage.removeItem('selectedBranchId');
        set({ activeDivision: null, selectedGymId: '', selectedBranchId: '' });
      } else if (division === 'h4') {
        try {
          const { data } = await API_CLIENT.get('/superadmin/h4-gym');
          if (data) {
            const h4GymId = data._id || data.id;
            await storage.setItem('selectedGymId', h4GymId);
            await storage.setItem('activeDivision', 'h4');
            await storage.removeItem('selectedBranchId');
            set({ activeDivision: 'h4', selectedGymId: h4GymId, selectedBranchId: '' });
          }
        } catch (error) {
          console.error('Failed to switch to H4 division:', error);
          throw error;
        }
      } else {
        await storage.setItem('activeDivision', 'fitpass');
        await storage.removeItem('selectedGymId');
        await storage.removeItem('selectedBranchId');
        set({ activeDivision: 'fitpass', selectedGymId: '', selectedBranchId: '' });
      }
      // Force reload all query caches for the new division context
      queryClient.invalidateQueries();
    },
    updateUserLocal: async (updatedUserFields) => {
      const currentUser = get().user;
      if (currentUser) {
        const newUser = { ...currentUser, ...updatedUserFields };
        await storage.setItem('user', JSON.stringify(newUser));
        set({ user: newUser });
      }
    },
  };
});

import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { storage } from './storage';

// Dynamically extract Metro Bundler Host IP for physical devices on Wi-Fi
const getMetroHostIp = () => {
  try {
    const hostUri = Constants?.expoConfig?.hostUri || Constants?.manifest?.debuggerHost || Constants?.manifest2?.extra?.expoGo?.debuggerHost;
    if (hostUri) {
      const ip = String(hostUri).split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return ip;
      }
    }
  } catch {
    // Fallback if Constants module is unlinked or unavailable
  }
  return null;
};

const hostIp = getMetroHostIp() || 'localhost';

// Release builds must always use the VPS. Keep the environment override for
// Metro/dev work, where developers may point at a local backend.
const VPS_API_URL = 'http://50.6.44.247/api/v1';
const DEV_API_URL = __DEV__
  ? process.env.EXPO_PUBLIC_API_URL || Platform.select({
      android: `http://${hostIp}:5000/api/v1`,
      ios: `http://${hostIp}:5000/api/v1`,
      web: 'http://localhost:5000/api/v1',
      default: `http://${hostIp}:5000/api/v1`,
    })
  : VPS_API_URL;

if (__DEV__) {
  console.log('[API_CLIENT] Configured Base URL:', DEV_API_URL);
}

export const API_CLIENT = axios.create({
  baseURL: DEV_API_URL,
  timeout: 10000,
});

// Interceptor to inject JWT token & headers from storage/auth state
API_CLIENT.interceptors.request.use(async (config) => {
  const token = await storage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const selectedGymId = await storage.getItem('selectedGymId');
  if (selectedGymId) {
    config.headers['x-gym-id'] = selectedGymId;
  }

  const selectedBranchId = await storage.getItem('selectedBranchId');
  if (selectedBranchId) {
    config.headers['x-branch-id'] = selectedBranchId;
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

// Inject auth state cleaner dynamically to avoid circular dependencies
let onUnauthorizedCallback: (() => void) | null = null;

export const registerUnauthorizedHandler = (callback: () => void) => {
  onUnauthorizedCallback = callback;
};

// Response interceptor to handle global 401s
API_CLIENT.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      await storage.removeToken();
      await storage.removeItem('user');
      await storage.removeItem('selectedGymId');
      await storage.removeItem('selectedBranchId');
      
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
    }
    return Promise.reject(error);
  }
);

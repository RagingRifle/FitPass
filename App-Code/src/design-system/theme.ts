import { create } from 'zustand';
import { radii, spacing, typography } from './tokens';

// Spacing, Colors, Typography, and Radii design tokens for GYM-CRM Mobile App
// Compliance: AGENTS.md §5

// Fixed mobile palette: mineral neutrals with a deep teal FitPrime accent.
export const lightColors = {
  primary: '#246B78',
  background: '#F2F5F6',
  card: '#FFFFFF',
  surface: '#E8EFF1',
  text: '#182630',
  border: '#D8E1E4',
  notification: '#C56A35',
  textSecondary: '#52636C',
  textMuted: '#819098',
  textInverse: '#FFFFFF',
  accent: '#C56A35',
  success: '#28785D',
  warning: '#C56A35',
  error: '#B84747',
  info: '#3979A8',
  bgTertiary: '#E4EBED',
  borderFocus: '#246B78',
  brandLight: '#E4F0F1',
  brandMuted: 'rgba(36, 107, 120, 0.14)',
};

// Keep the root layout's existing initialization hook while using one app theme.
export type ThemeMode = 'light';

interface ThemeState {
  themeMode: ThemeMode;
  initTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  themeMode: 'light',
  initTheme: async () => { set({ themeMode: 'light' }); },
}));

// Dynamic proxy theme to maintain full backwards compatibility with static imports
export const theme = {
  get dark() {
    return false;
  },
  get colors() {
    return lightColors;
  },
  radii,
  spacing,
  typography,
};

export type AppTheme = typeof theme;

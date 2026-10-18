import { create } from 'zustand';
import { radii, spacing, typography } from './tokens';

// Spacing, Colors, Typography, and Radii design tokens for GYM-CRM Mobile App
// Compliance: AGENTS.md §5

// Bold FitPass palette: yellow canvas, black navigation, and cream/white content surfaces.
export const lightColors = {
  primary: '#F5B800',
  background: '#F5B800',
  card: '#FFFFFF',
  surface: '#F8F5ED',
  text: '#171713',
  border: '#E3DCCB',
  notification: '#171713',
  textSecondary: '#585448',
  textMuted: '#817B6E',
  textInverse: '#FFFFFF',
  accent: '#171713',
  success: '#397354',
  warning: '#A97900',
  error: '#A4473F',
  info: '#5C6F70',
  bgTertiary: '#FFF4C6',
  borderFocus: '#D9A900',
  brandLight: '#FFF4C6',
  brandMuted: 'rgba(245, 184, 0, 0.15)',
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

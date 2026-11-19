import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';

interface SettingsState {
  theme: Theme;
  accessCode: string;
  setTheme: (theme: Theme) => void;
  setAccessCode: (code: string) => void;
}

const THEME_STORAGE_KEY = 'convertit_theme';
const ACCESS_CODE_STORAGE_KEY = 'convertit_access_code';

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const systemPrefersDark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  const isDark =
    theme === 'dark' || (theme === 'system' && Boolean(systemPrefersDark));

  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: getStoredTheme(),
  accessCode:
    typeof window !== 'undefined'
      ? (localStorage.getItem(ACCESS_CODE_STORAGE_KEY) ?? '')
      : '',
  setTheme: (theme: Theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
    applyTheme(theme);
    set({ theme });
  },
  setAccessCode: (accessCode: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACCESS_CODE_STORAGE_KEY, accessCode);
    }
    set({ accessCode });
  },
}));

// Initialize theme on load and listen for system preference changes
if (typeof window !== 'undefined') {
  applyTheme(getStoredTheme());

  if (typeof window.matchMedia === 'function') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener?.('change', () => {
      const currentTheme = useSettingsStore.getState().theme;
      if (currentTheme === 'system') {
        applyTheme('system');
      }
    });
  }
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, type ColorSchemeName } from 'react-native';

export const brand = { navy: '#1B2C5B', red: '#C8102E' };
export const splashColors = {
  text: '#FFFFFF',
  textSecondary: '#C2CDE3',
  progressTrack: 'rgba(255,255,255,0.16)',
  skip: 'rgba(255,255,255,0.5)',
};

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentText: string;
  danger: string;
  success: string;
  successBackground: string;
  accentBackground: string;
  primary: string;
};

export const light: ThemeColors = {
  background: '#F4F5F7',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F2F5',
  border: '#E2E5EA',
  textPrimary: '#16202E',
  textSecondary: '#5B6675',
  textMuted: '#98A2B3',
  accent: brand.red,
  accentText: '#FFFFFF',
  danger: brand.red,
  success: '#1B7F45',
  successBackground: '#E7F5EC',
  accentBackground: '#EAF0FA',
  primary: brand.navy,
};

export const dark: ThemeColors = {
  background: '#0E1626',
  surface: '#182234',
  surfaceAlt: '#1F2C42',
  border: '#2A3852',
  textPrimary: '#EEF2F8',
  textSecondary: '#A5B2C6',
  textMuted: '#6B7A93',
  accent: '#E24B4A',
  accentText: '#FFFFFF',
  danger: '#E24B4A',
  success: '#5FD08A',
  successBackground: '#12301F',
  accentBackground: '#1B2A45',
  primary: '#4A63A8',
};

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedScheme = 'light' | 'dark';

const THEME_PREF_KEY = 'ssg.themePreference';

type ThemeContextValue = {
  colors: ThemeColors;
  preference: ThemePreference;
  resolved: ResolvedScheme;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveScheme(
  preference: ThemePreference,
  system: ColorSchemeName
): ResolvedScheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [system, setSystem] = useState<ColorSchemeName>(
    Appearance.getColorScheme() ?? 'light'
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const stored = await AsyncStorage.getItem(THEME_PREF_KEY);
      if (stored === 'system' || stored === 'light' || stored === 'dark') {
        setPreferenceState(stored);
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystem(colorScheme);
    });
    return () => sub.remove();
  }, []);

  const setPreference = useCallback(async (next: ThemePreference) => {
    setPreferenceState(next);
    await AsyncStorage.setItem(THEME_PREF_KEY, next);
  }, []);

  const resolved = resolveScheme(preference, system);
  const colors = resolved === 'dark' ? dark : light;

  const value = useMemo(
    () => ({ colors, preference, resolved, setPreference }),
    [colors, preference, resolved, setPreference]
  );

  if (!ready) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

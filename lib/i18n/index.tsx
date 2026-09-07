import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { initReactI18next } from 'react-i18next';
import { applyRtl, reloadForRtl } from '../rtl';
import en from './en.json';
import ur from './ur.json';

export type LanguageCode = 'en' | 'ur';

const LANG_KEY = 'ssg.language';

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ur: { translation: ur },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

function isLanguageCode(value: string | null): value is LanguageCode {
  return value === 'en' || value === 'ur';
}

type LanguageContextValue = {
  ready: boolean;
  language: LanguageCode | null;
  setLanguage: (language: LanguageCode) => Promise<boolean>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      // `ready` must be set on every path. Leaving it false renders the
      // whole app as null with no error to explain it.
      try {
        const stored = await AsyncStorage.getItem(LANG_KEY);
        if (isLanguageCode(stored)) {
          await i18n.changeLanguage(stored);
          setLanguageState(stored);
          if (applyRtl(stored)) {
            await reloadForRtl();
          }
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setLanguage = useCallback(async (next: LanguageCode) => {
    await AsyncStorage.setItem(LANG_KEY, next);
    await i18n.changeLanguage(next);
    const needsReload = applyRtl(next);
    if (!needsReload) {
      setLanguageState(next);
    }
    return needsReload;
  }, []);

  const value = useMemo(
    () => ({ ready, language, setLanguage }),
    [ready, language, setLanguage]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}

export { i18n };
export default i18n;

import { DevSettings, I18nManager, Platform } from 'react-native';
import * as Updates from 'expo-updates';

export function isRtlLanguage(language: 'en' | 'ur'): boolean {
  return language === 'ur';
}

/** Returns true when the native direction changed and a reload is required. */
export function applyRtl(language: 'en' | 'ur'): boolean {
  const wantRtl = isRtlLanguage(language);
  if (I18nManager.isRTL === wantRtl) {
    return false;
  }
  I18nManager.allowRTL(wantRtl);
  I18nManager.forceRTL(wantRtl);
  // Only native needs a restart to pick up the new direction. On web the
  // next render already flips, and no reload mechanism exists in dev, so
  // claiming one is needed strands the caller waiting for a restart that
  // will never happen.
  return Platform.OS !== 'web';
}

export async function reloadForRtl(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch {
    if (__DEV__ && Platform.OS !== 'web') {
      DevSettings.reload();
    }
  }
}

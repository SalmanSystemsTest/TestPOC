import { Linking, Platform } from 'react-native';

/** Opens https / tel / mailto links. Web uses a new tab with same-tab fallback. */
export async function openExternalUrl(url: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (opened) return;
    window.location.assign(url);
    return;
  }
  await Linking.openURL(url);
}

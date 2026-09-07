import { Redirect, type Href } from 'expo-router';
import { useAuthSession } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n';

export default function Index() {
  const { ready, language } = useLanguage();
  const { ready: authReady, session } = useAuthSession();

  if (!ready || !authReady) return null;
  if (!language) return <Redirect href={'/(auth)/language' as Href} />;
  if (!session) return <Redirect href={'/(auth)/sign-in' as Href} />;
  return <Redirect href={'/(tabs)' as Href} />;
}

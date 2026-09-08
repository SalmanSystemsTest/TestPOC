import { Redirect, type Href } from 'expo-router';
import { useAuthSession } from '@/lib/auth-context';
import { useLanguage } from '@/lib/i18n';
import { isProfileComplete } from '@/lib/profile-complete';
import { useProfile } from '@/lib/queries/profile';

export default function Index() {
  const { ready, language } = useLanguage();
  const { ready: authReady, session } = useAuthSession();
  const profile = useProfile(session?.user.id);

  if (!ready || !authReady) return null;
  if (!language) return <Redirect href={'/(auth)/language' as Href} />;
  if (!session) return <Redirect href={'/(auth)/sign-in' as Href} />;
  if (profile.isPending) return null;
  if (!isProfileComplete(profile.data)) {
    return <Redirect href={'/(auth)/complete-profile' as Href} />;
  }
  return <Redirect href={'/(tabs)' as Href} />;
}

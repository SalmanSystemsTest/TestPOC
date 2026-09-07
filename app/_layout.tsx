import { NotoNastaliqUrdu_400Regular } from '@expo-google-fonts/noto-nastaliq-urdu';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { AppSplash } from '@/components/AppSplash';
import { AuthProvider, useAuthSession } from '@/lib/auth-context';
import { LanguageProvider, useLanguage } from '@/lib/i18n';
import { ThemeProvider, useTheme } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <RootShell />
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function RootShell() {
  const { ready } = useLanguage();
  const { ready: authReady } = useAuthSession();
  const { resolved } = useTheme();
  const [showSplash, setShowSplash] = useState(true);
  const [fontsLoaded, fontError] = useFonts({
    NotoNastaliqUrdu_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // A font that fails to download must fall back to system type rather
  // than hold the entire app on a blank screen.
  const fontsSettled = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready && authReady && fontsSettled) {
      void SplashScreen.hideAsync();
    }
  }, [authReady, ready, fontsSettled]);

  const finishSplash = useCallback(() => {
    setShowSplash(false);
  }, []);

  if (!ready || !authReady || !fontsSettled) {
    return null;
  }

  if (showSplash) {
    return (
      <>
        <StatusBar style="light" />
        <AppSplash onFinish={finishSplash} />
      </>
    );
  }

  return (
    <>
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

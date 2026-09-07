import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { config } from './config';
import type { Database } from '../types/database';

const serverStorage: SupportedStorage = {
  getItem: async () => null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
};

const storage =
  Platform.OS === 'web' && typeof window === 'undefined'
    ? serverStorage
    : AsyncStorage;

export const supabase = createClient<Database>(config.supabaseUrl, config.supabaseKey, {
  auth: {
    // Keeps the session on the device so returning users skip login entirely.
    storage,
    persistSession: true,
    autoRefreshToken: true,
    // Must be false in React Native — there is no URL to parse a session from.
    detectSessionInUrl: false,
  },
});

// Pause token refresh while backgrounded, resume on foreground.
// Without this, refresh timers fire in the background and burn battery.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

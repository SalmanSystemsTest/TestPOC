import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { config } from './config';

// After stage 2 (`supabase gen types typescript`), change this to:
//   import type { Database } from '../types/database';
//   createClient<Database>(...)
// Until then it stays untyped so stage 1 compiles.

export const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
  auth: {
    // Keeps the session on the device so returning users skip login entirely.
    storage: AsyncStorage,
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

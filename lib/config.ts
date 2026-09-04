/**
 * Single source of truth for environment configuration.
 * Nothing else in the app should read process.env directly.
 */

export type AuthMode = 'dev' | 'phone';

function required(name: string, value: string | undefined): string {
  if (!value || value.includes('REPLACE_ME')) {
    throw new Error(
      `Missing environment variable: ${name}\n\n` +
        `Check that .env.local exists in the project root (next to package.json), ` +
        `that ${name} is set, and that you restarted the dev server after editing it. ` +
        `Values are baked in at bundle time, so Fast Refresh will not pick them up.`
    );
  }
  return value;
}

function optional(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

const rawAuthMode = process.env.EXPO_PUBLIC_AUTH_MODE ?? 'dev';

if (rawAuthMode !== 'dev' && rawAuthMode !== 'phone') {
  throw new Error(
    `EXPO_PUBLIC_AUTH_MODE must be 'dev' or 'phone', got '${rawAuthMode}'.`
  );
}

export const config = {
  supabaseUrl: required(
    'EXPO_PUBLIC_SUPABASE_URL',
    process.env.EXPO_PUBLIC_SUPABASE_URL
  ),
  supabaseKey: required(
    'EXPO_PUBLIC_SUPABASE_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_KEY
  ),

  /**
   * 'dev'   — email + password. Works with zero external providers.
   * 'phone' — phone + SMS OTP. Needs an SMS provider in Supabase.
   *
   * The rest of the app never branches on this. Only lib/auth.ts and the
   * two sign-in screens care.
   */
  authMode: rawAuthMode as AuthMode,

  /**
   * Null until SSG provides real numbers. Consumers must handle null by
   * disabling the relevant button rather than rendering a broken link.
   */
  ssgWhatsapp: optional(process.env.EXPO_PUBLIC_SSG_WHATSAPP),
  ssgPhone: optional(process.env.EXPO_PUBLIC_SSG_PHONE),
} as const;

export const isDevAuth = config.authMode === 'dev';
export const hasWhatsapp = config.ssgWhatsapp !== null;

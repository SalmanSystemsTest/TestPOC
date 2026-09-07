/**
 * Auth adapter.
 *
 * The app has two sign-in mechanisms that produce an identical session:
 *
 *   dev   — email + password. Built into Supabase, no external provider,
 *           no cost. Used while Twilio is unavailable.
 *   phone — phone + 6-digit SMS OTP. The production mechanism.
 *
 * Switching between them is EXPO_PUBLIC_AUTH_MODE in .env.local.
 * Nothing outside this file and the sign-in screens should know which
 * mode is active. Everything downstream keys off auth.uid().
 */

import { supabase } from './supabase';
import { config, isDevAuth } from './config';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

export type SignInResult =
  /** Session established. Route to the app. */
  | { status: 'signed_in' }
  /** OTP sent. Route to the verify screen. Phone mode only. */
  | { status: 'code_sent' }
  /** Identifier is not on the allowlist. Show the contact-SSG screen. */
  | { status: 'not_registered' }
  /** Wrong password or wrong OTP code. */
  | { status: 'bad_credentials' }
  /** Anything else. `message` is for logs, not for users. */
  | { status: 'error'; message: string };

/** Supabase stores phones in E.164 without a '+'. Normalise to digits. */
export function normalisePhone(input: string): string {
  const digits = input.replace(/[^0-9]/g, '');
  // Local Pakistani format: 03001234567 → 923001234567
  if (digits.startsWith('0')) return '92' + digits.slice(1);
  if (digits.startsWith('92')) return digits;
  return '92' + digits;
}

/** The allowlist hook returns this sentinel; never show it to a user. */
function isNotRegistered(message: string): boolean {
  return message.includes('NOT_REGISTERED');
}

/**
 * Step one. In dev mode this completes sign-in outright. In phone mode it
 * dispatches an OTP and you must follow up with completeSignIn().
 */
export async function startSignIn(params: {
  identifier: string;
  password?: string;
}): Promise<SignInResult> {
  const { identifier, password } = params;

  try {
    if (isDevAuth) {
      if (!password) {
        return { status: 'error', message: 'Password required in dev mode' };
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: identifier.trim().toLowerCase(),
        password,
      });

      if (error) {
        if (isNotRegistered(error.message)) return { status: 'not_registered' };
        if (error.status === 400) return { status: 'bad_credentials' };
        return { status: 'error', message: error.message };
      }
      return { status: 'signed_in' };
    }

    // Phone mode. signInWithOtp does not care whether the user exists;
    // if they do not, Supabase begins creating them, which fires the
    // before-user-created hook and the allowlist check.
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalisePhone(identifier),
    });

    if (error) {
      if (isNotRegistered(error.message)) return { status: 'not_registered' };
      return { status: 'error', message: error.message };
    }
    return { status: 'code_sent' };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Unknown' };
  }
}

/** Step two. Phone mode only. Never called in dev mode. */
export async function completeSignIn(params: {
  identifier: string;
  code: string;
}): Promise<SignInResult> {
  if (isDevAuth) {
    return { status: 'error', message: 'completeSignIn is not used in dev mode' };
  }

  try {
    const { error } = await supabase.auth.verifyOtp({
      phone: normalisePhone(params.identifier),
      token: params.code.trim(),
      type: 'sms',
    });

    if (error) {
      if (isNotRegistered(error.message)) return { status: 'not_registered' };
      return { status: 'bad_credentials' };
    }
    return { status: 'signed_in' };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : 'Unknown' };
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function subscribeToSession(
  listener: (session: Session | null, event: AuthChangeEvent) => void
): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    listener(session, event);
  });
  return () => subscription.unsubscribe();
}

/**
 * What the first sign-in screen should collect. Drives which fields the
 * screen renders, so the screen itself has no mode branching.
 */
export const signInShape = isDevAuth
  ? { identifierType: 'email' as const, needsPassword: true, twoStep: false }
  : { identifierType: 'phone' as const, needsPassword: false, twoStep: true };

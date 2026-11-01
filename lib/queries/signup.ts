import { normalisePhone, registerAccount, type SignUpResult } from '../auth';
import { supabase } from '../supabase';
import { isDevAuth } from '../config';

export type SignUpEligibilityStatus =
  | 'eligible'
  | 'not_on_list'
  | 'already_registered';

export async function checkSignupEligibility(
  identifier: string,
): Promise<SignUpEligibilityStatus> {
  const trimmed = identifier.trim();
  if (!trimmed) return 'not_on_list';

  const p_identifier = isDevAuth ? trimmed.toLowerCase() : normalisePhone(trimmed);

  const { data, error } = await supabase.rpc('check_signup_eligibility', {
    p_identifier,
  });
  if (error) throw error;

  const status =
    typeof data === 'object' && data !== null && 'status' in data
      ? String((data as { status: unknown }).status)
      : '';

  if (status === 'eligible' || status === 'not_on_list' || status === 'already_registered') {
    return status;
  }
  return 'not_on_list';
}

export async function completeRegistration(params: {
  identifier: string;
  password?: string;
}): Promise<SignUpResult> {
  return registerAccount(params);
}

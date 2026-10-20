import type { Profile } from './queries/profile';

export function isProfileComplete(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  return Boolean(
    profile.contact_name?.trim() &&
      profile.business_name?.trim() &&
      profile.city?.trim() &&
      profile.address?.trim()
  );
}

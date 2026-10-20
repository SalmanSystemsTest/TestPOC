-- Buyer catalogue preferences from first-login onboarding (sort order in browse).

alter table profiles
  add column if not exists preferred_makes text[] not null default '{}',
  add column if not exists preferred_groups text[] not null default '{}';

-- A brand manager's one-time link that lets a member set a new password (there is no email budget for reset mails).
-- Only a fingerprint of the link is stored. No policies: only the app's server reads or writes this table.
create table if not exists public.password_resets (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  used_at timestamptz
);
alter table public.password_resets enable row level security;
revoke all on public.password_resets from anon, authenticated;

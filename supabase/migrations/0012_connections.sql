-- Round 3: check content where it is made and published.
-- API tokens let the browser extension and the Google Docs add-on run checks for a workspace.
create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  token_hash text not null unique,
  hint text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists api_tokens_workspace on public.api_tokens (workspace_id);
alter table public.api_tokens enable row level security;
grant select, insert, delete on public.api_tokens to authenticated;
create policy "managers see tokens" on public.api_tokens for select to authenticated using (public.manages(workspace_id));
create policy "managers create tokens" on public.api_tokens for insert to authenticated with check (public.manages(workspace_id) and created_by = (select auth.uid()));
create policy "managers delete tokens" on public.api_tokens for delete to authenticated using (public.manages(workspace_id));

-- Outgoing hooks: where "post approved" is sent, and the Slack channel that hears when a post needs someone.
-- The addresses are secrets (anyone holding a Slack hook address can post to the channel), so they are stored
-- encrypted next to the AI key and only the server reads them.
alter table public.workspace_secrets
  add column if not exists webhook_url_enc text,
  add column if not exists webhook_host text,
  add column if not exists webhook_secret_enc text,
  add column if not exists slack_url_enc text,
  add column if not exists slack_hint text;

-- What was sent and what came back, so a manager can see that a hook works.
create table if not exists public.hook_deliveries (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null check (kind in ('webhook', 'slack')),
  event text not null,
  post_id uuid,
  post_title text not null default '',
  target text not null default '',
  ok boolean not null default false,
  status integer,
  ms integer,
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists hook_deliveries_workspace on public.hook_deliveries (workspace_id, created_at desc);
alter table public.hook_deliveries enable row level security;
grant select on public.hook_deliveries to authenticated;
create policy "members see deliveries" on public.hook_deliveries for select to authenticated using (public.is_member(workspace_id));

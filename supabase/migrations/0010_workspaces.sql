-- Round 3: real teams. Login (Supabase Auth), company workspaces, and database rules so each company
-- sees only its own brands. The app's server now talks to the database AS the signed-in person
-- (their own session token), so these rules are enforced by Postgres itself, not only by app code.

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  is_demo boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 'guest' is the public no-sign-in visitor of the demo workspace, who may switch between the three roles
  role text not null check (role in ('creator', 'expert', 'brand_manager', 'guest')),
  name text not null default '',
  email text not null default '',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_members_user on public.workspace_members (user_id);

-- An invite is a link for one person. Only a hash of its token is stored.
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role text not null check (role in ('creator', 'expert', 'brand_manager')),
  token_hash text not null unique,
  note text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users(id) on delete set null,
  used_by_name text,
  used_at timestamptz
);
create index if not exists invites_workspace on public.invites (workspace_id);

-- A workspace's own AI key (encrypted by the app's server) and outgoing hooks. No policies: only the server reads it.
create table if not exists public.workspace_secrets (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  ai_key_enc text,
  ai_key_hint text,
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);

-- The demo workspace holds the fictional brands that anyone can try without signing in.
insert into public.workspaces (id, name, is_demo)
values ('00000000-0000-4000-8000-000000000001', 'BrandSentinel demo', true)
on conflict (id) do nothing;

alter table public.brands add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade
  default '00000000-0000-4000-8000-000000000001';
update public.brands set workspace_id = '00000000-0000-4000-8000-000000000001' where workspace_id is null;
alter table public.brands alter column workspace_id set not null;
-- two companies may both have a brand called "acme": names are unique inside a workspace
alter table public.brands drop constraint if exists brands_slug_key;
create unique index if not exists brands_workspace_slug on public.brands (workspace_id, slug);
create index if not exists brands_workspace on public.brands (workspace_id);

-- ── Who am I allowed to see? (security definer: they read the membership table for the policies) ──
create or replace function public.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = (select auth.uid()));
$$;

-- true when the caller holds one of the roles in this workspace (the demo's guest may act as any role)
create or replace function public.has_role(ws uuid, roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid()) and (m.role = any (roles) or m.role = 'guest')
  );
$$;

-- a brand manager of a real (non-demo) workspace: may invite people, change roles and settings
create or replace function public.manages(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members m join public.workspaces w on w.id = m.workspace_id
    where m.workspace_id = ws and m.user_id = (select auth.uid()) and m.role = 'brand_manager' and not w.is_demo
  );
$$;

create or replace function public.brand_ws(b uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select workspace_id from public.brands where id = b;
$$;

create or replace function public.post_ws(p uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select b.workspace_id from public.posts p0 join public.brands b on b.id = p0.brand_id where p0.id = p;
$$;

revoke all on function public.is_member(uuid), public.has_role(uuid, text[]), public.manages(uuid), public.brand_ws(uuid), public.post_ws(uuid) from public, anon;
grant execute on function public.is_member(uuid), public.has_role(uuid, text[]), public.manages(uuid), public.brand_ws(uuid), public.post_ws(uuid) to authenticated, service_role;

-- ── Row level security: signed-in people reach only their own workspaces' rows ──
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.invites enable row level security;
alter table public.workspace_secrets enable row level security;

grant select, update on public.workspaces to authenticated;
grant select, update, delete on public.workspace_members to authenticated;
grant select, insert, delete on public.invites to authenticated;
grant select, insert, update, delete on public.brands, public.guideline_docs, public.rules, public.facts, public.posts, public.reviews, public.decisions, public.history to authenticated;

create policy "members see their workspaces" on public.workspaces for select to authenticated using (public.is_member(id));
create policy "managers rename their workspace" on public.workspaces for update to authenticated using (public.manages(id)) with check (public.manages(id) and not is_demo);

create policy "members see their team" on public.workspace_members for select to authenticated using (public.is_member(workspace_id));
create policy "managers change roles" on public.workspace_members for update to authenticated using (public.manages(workspace_id)) with check (public.manages(workspace_id) and role in ('creator', 'expert', 'brand_manager'));
create policy "managers remove people" on public.workspace_members for delete to authenticated using (public.manages(workspace_id));

create policy "managers see invites" on public.invites for select to authenticated using (public.manages(workspace_id));
create policy "managers create invites" on public.invites for insert to authenticated with check (public.manages(workspace_id) and created_by = (select auth.uid()));
create policy "managers cancel invites" on public.invites for delete to authenticated using (public.manages(workspace_id));

create policy "members see brands" on public.brands for select to authenticated using (public.is_member(workspace_id));
create policy "managers add brands" on public.brands for insert to authenticated with check (public.has_role(workspace_id, array['brand_manager']));
create policy "managers edit brands" on public.brands for update to authenticated using (public.has_role(workspace_id, array['brand_manager'])) with check (public.has_role(workspace_id, array['brand_manager']));
create policy "managers delete brands" on public.brands for delete to authenticated using (public.has_role(workspace_id, array['brand_manager']));

create policy "members see rulebooks" on public.guideline_docs for select to authenticated using (public.is_member(public.brand_ws(brand_id)));
create policy "managers change rulebooks" on public.guideline_docs for all to authenticated using (public.has_role(public.brand_ws(brand_id), array['brand_manager'])) with check (public.has_role(public.brand_ws(brand_id), array['brand_manager']));

create policy "members see rules" on public.rules for select to authenticated using (public.is_member(public.brand_ws(brand_id)));
create policy "managers change rules" on public.rules for all to authenticated using (public.has_role(public.brand_ws(brand_id), array['brand_manager'])) with check (public.has_role(public.brand_ws(brand_id), array['brand_manager']));

create policy "members see facts" on public.facts for select to authenticated using (public.is_member(public.brand_ws(brand_id)));
create policy "experts and managers change facts" on public.facts for all to authenticated using (public.has_role(public.brand_ws(brand_id), array['brand_manager', 'expert'])) with check (public.has_role(public.brand_ws(brand_id), array['brand_manager', 'expert']));

create policy "members work on posts" on public.posts for all to authenticated using (public.is_member(public.brand_ws(brand_id))) with check (public.is_member(public.brand_ws(brand_id)));
create policy "members see checks" on public.reviews for all to authenticated using (public.is_member(public.post_ws(post_id))) with check (public.is_member(public.post_ws(post_id)));
create policy "members see decisions" on public.decisions for all to authenticated using (public.is_member(public.post_ws(post_id))) with check (public.is_member(public.post_ws(post_id)));
create policy "members see history" on public.history for select to authenticated using (public.is_member(public.post_ws(post_id)));
create policy "members add history" on public.history for insert to authenticated with check (public.is_member(public.post_ws(post_id)));

-- ── What the app asks for on every request: who is this and where do they belong ──
create or replace function public.my_context() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'user_id', (select auth.uid()),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object('workspace_id', w.id, 'workspace', w.name, 'is_demo', w.is_demo, 'role', m.role, 'name', m.name, 'email', m.email) order by w.is_demo, m.created_at)
      from public.workspace_members m join public.workspaces w on w.id = m.workspace_id
      where m.user_id = (select auth.uid())
    ), '[]'::jsonb)
  );
$$;

-- true for the shared demo accounts (set by the server when it creates them; people can't change it)
create or replace function public.is_demo_account() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'demo')::boolean, false);
$$;

-- A signed-in person starts a company workspace and becomes its brand manager.
create or replace function public.create_workspace(p_name text, p_member_name text, p_email text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); ws uuid; n int;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if public.is_demo_account() then raise exception 'Demo accounts cannot create workspaces'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 80 then raise exception 'Give the workspace a name'; end if;
  select count(*) into n from public.workspaces where created_by = uid;
  if n >= 3 then raise exception 'You have reached the limit of 3 workspaces'; end if;
  insert into public.workspaces (name, created_by) values (btrim(p_name), uid) returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role, name, email)
    values (ws, uid, 'brand_manager', left(btrim(coalesce(p_member_name, '')), 40), left(coalesce(p_email, ''), 200));
  return ws;
end $$;

-- What an invite link leads to, shown before joining. Says nothing unless the link is real.
create or replace function public.invite_info(p_token_hash text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('workspace', w.name, 'role', i.role, 'invited_by', i.created_by_name,
    'state', case when i.used_at is not null then 'used' when i.expires_at < now() then 'expired' else 'open' end)
  from public.invites i join public.workspaces w on w.id = i.workspace_id
  where i.token_hash = p_token_hash;
$$;

-- Join the workspace an invite link points to, with the role the manager chose.
create or replace function public.accept_invite(p_token_hash text, p_member_name text, p_email text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); inv public.invites%rowtype;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if public.is_demo_account() then raise exception 'Demo accounts cannot join workspaces'; end if;
  select * into inv from public.invites where token_hash = p_token_hash for update;
  if not found then raise exception 'This invite link is not valid'; end if;
  if inv.used_at is not null then raise exception 'This invite link has already been used'; end if;
  if inv.expires_at < now() then raise exception 'This invite link has expired'; end if;
  if exists (select 1 from public.workspace_members where workspace_id = inv.workspace_id and user_id = uid) then
    raise exception 'You are already in this workspace';
  end if;
  insert into public.workspace_members (workspace_id, user_id, role, name, email)
    values (inv.workspace_id, uid, inv.role, left(btrim(coalesce(p_member_name, '')), 40), left(coalesce(p_email, ''), 200));
  update public.invites set used_by = uid, used_by_name = left(btrim(coalesce(p_member_name, '')), 40), used_at = now() where id = inv.id;
  return inv.workspace_id;
end $$;

revoke all on function public.my_context(), public.is_demo_account(), public.create_workspace(text, text, text), public.invite_info(text), public.accept_invite(text, text, text) from public, anon;
grant execute on function public.my_context(), public.is_demo_account(), public.create_workspace(text, text, text), public.invite_info(text), public.accept_invite(text, text, text) to authenticated, service_role;

-- BrandSentinel schema (demo: single public brand, no login)

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  settings jsonb not null default '{}'::jsonb,   -- palette, product names, misspellings, hashtag
  rulebook_version int not null default 1,
  created_at timestamptz not null default now()
);

create table public.rules (
  brand_id uuid not null references public.brands(id) on delete cascade,
  id text not null,                               -- e.g. CLAIM-01
  category text not null check (category in ('tone','words','claims','visuals','readability')),
  severity text not null check (severity in ('high','medium','low')),
  check_type text not null check (check_type in ('code','ai','code+ai')),
  scope text not null default 'all',
  rule text not null,
  guideline text not null default '',
  good text not null default '',
  bad text not null default '',
  params jsonb not null default '{}'::jsonb,      -- word lists, limits used by code checks
  status text not null default 'approved' check (status in ('approved','draft')),
  version int not null default 1,
  updated_at timestamptz not null default now(),
  primary key (brand_id, id)
);

create table public.facts (
  brand_id uuid not null references public.brands(id) on delete cascade,
  id text not null,                               -- e.g. F-01
  product text not null,
  fact text not null,
  source text not null,
  valid_until date not null,
  type text not null default 'general',
  updated_at timestamptz not null default now(),
  primary key (brand_id, id)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  title text not null default '',
  channel text not null default 'instagram',
  post_type text not null default 'product',
  product text not null default '',
  partner boolean not null default false,
  caption text not null,
  images jsonb not null default '[]'::jsonb,      -- [{src, alt_text, ocr_text, contrast, colours}]
  goal jsonb not null default '{}'::jsonb,        -- {post_type, message, call_to_action}
  status text not null default 'draft'
    check (status in ('draft','in_review','changes_requested','approved')),
  needs_expert boolean not null default false,
  sample_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  caption text not null,
  score int not null,
  band text not null,
  findings jsonb not null default '[]'::jsonb,
  ask_human jsonb not null default '[]'::jsonb,
  rulebook_version int not null,
  model text,
  ai_status text not null default 'ok',
  created_at timestamptz not null default now()
);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  review_id uuid references public.reviews(id) on delete set null,
  finding_id text not null,
  rule_id text not null,
  action text not null check (action in ('accept','edit','disagree')),
  reason text,
  role text not null,
  actor text not null default 'demo',
  created_at timestamptz not null default now()
);

create table public.history (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.posts(id) on delete cascade,
  action text not null,
  role text not null,
  actor text not null default 'demo',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Cache AI results by content hash so repeated checks cost no AI quota
create table public.ai_cache (
  key text primary key,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create index on public.posts (brand_id, updated_at desc);
create index on public.reviews (post_id, created_at desc);
create index on public.decisions (post_id);
create index on public.decisions (rule_id, action);
create index on public.history (post_id, created_at);

-- Row level security: the server uses the publishable key only (never sent to browsers).
-- Demo policies allow read/insert/update; nothing can be deleted through the API.
alter table public.brands enable row level security;
alter table public.rules enable row level security;
alter table public.facts enable row level security;
alter table public.posts enable row level security;
alter table public.reviews enable row level security;
alter table public.decisions enable row level security;
alter table public.history enable row level security;
alter table public.ai_cache enable row level security;

create policy "demo read" on public.brands for select to anon using (true);
create policy "demo update" on public.brands for update to anon using (true) with check (true);

create policy "demo read" on public.rules for select to anon using (true);
create policy "demo insert" on public.rules for insert to anon with check (true);
create policy "demo update" on public.rules for update to anon using (true) with check (true);

create policy "demo read" on public.facts for select to anon using (true);
create policy "demo insert" on public.facts for insert to anon with check (true);
create policy "demo update" on public.facts for update to anon using (true) with check (true);

create policy "demo read" on public.posts for select to anon using (true);
create policy "demo insert" on public.posts for insert to anon with check (true);
create policy "demo update" on public.posts for update to anon using (true) with check (true);

create policy "demo read" on public.reviews for select to anon using (true);
create policy "demo insert" on public.reviews for insert to anon with check (true);

create policy "demo read" on public.decisions for select to anon using (true);
create policy "demo insert" on public.decisions for insert to anon with check (true);

create policy "demo read" on public.history for select to anon using (true);
create policy "demo insert" on public.history for insert to anon with check (true);

create policy "demo read" on public.ai_cache for select to anon using (true);
create policy "demo insert" on public.ai_cache for insert to anon with check (true);
create policy "demo update" on public.ai_cache for update to anon using (true) with check (true);

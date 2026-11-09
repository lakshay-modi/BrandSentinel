-- Several rulebooks per brand: each imported guidelines document (or the seed guidelines) is a rulebook.
-- A rulebook can be paused (its rules leave the checks) or removed (its rules are deleted with it).
create table if not exists public.guideline_docs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  file_name text not null default '',
  kind text not null default 'pdf' check (kind in ('pdf', 'text', 'seed')),
  status text not null default 'active' check (status in ('active', 'paused')),
  created_by text not null default '',
  created_at timestamptz not null default now()
);
alter table public.guideline_docs enable row level security; -- no policies: only the server reaches it
create index if not exists guideline_docs_brand_idx on public.guideline_docs (brand_id);

alter table public.rules add column if not exists document_id uuid references public.guideline_docs(id) on delete cascade;
create index if not exists rules_document_idx on public.rules (document_id);

-- the demo brand's seeded rules come from its guidelines PDF
insert into public.guideline_docs (brand_id, name, file_name, kind, created_by)
select b.id, 'Oatvia brand guidelines', 'Oatvia_Brand_Guidelines.pdf', 'seed', 'Brand team'
from public.brands b where b.slug = 'oatvia'
  and not exists (select 1 from public.guideline_docs d where d.brand_id = b.id and d.kind = 'seed');
update public.rules r set document_id = d.id
from public.guideline_docs d join public.brands b on b.id = d.brand_id
where b.slug = 'oatvia' and d.kind = 'seed' and r.brand_id = b.id and r.source = '' and r.document_id is null;

-- imported rules: one rulebook per brand and file
insert into public.guideline_docs (brand_id, name, file_name, kind, created_by)
select distinct r.brand_id, regexp_replace(regexp_replace(split_part(r.source, ': “', 1), '\.(pdf|txt|md)$', '', 'i'), '_', ' ', 'g'), split_part(r.source, ': “', 1), 'pdf', 'Brand manager'
from public.rules r
where r.source <> '' and r.document_id is null
  and not exists (select 1 from public.guideline_docs d where d.brand_id = r.brand_id and d.file_name = split_part(r.source, ': “', 1));
update public.rules r set document_id = d.id
from public.guideline_docs d
where r.source <> '' and r.document_id is null and d.brand_id = r.brand_id and d.file_name = split_part(r.source, ': “', 1);

-- the two demo brands can't be deleted, so the public demo always works
update public.brands set settings = settings || '{"protected": true}'::jsonb where slug in ('oatvia', 'solvira');

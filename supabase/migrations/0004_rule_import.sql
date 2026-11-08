-- Rules drafted by AI from a guidelines document: keep where each rule came from,
-- and let the brand manager reject a draft (nothing is ever deleted).
alter table public.rules drop constraint if exists rules_status_check;
alter table public.rules add constraint rules_status_check check (status in ('approved', 'draft', 'rejected'));
alter table public.rules add column if not exists source text not null default '';

-- The demo brands' sample posts are shared by everyone trying the app, so they can't be deleted.
-- Drafts people create themselves can be deleted by the creator.
alter table public.posts add column if not exists demo boolean not null default false;
update public.posts p set demo = true
from public.brands b
where p.brand_id = b.id and coalesce((b.settings ->> 'protected')::boolean, false);

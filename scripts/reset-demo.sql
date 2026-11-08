-- Resets the live demo to a clean state before judging: removes test posts (reviews,
-- decisions and history go with them) and rules imported during testing.
-- Seed rules and facts are kept; run supabase/seed.sql afterwards to restore edited ones.
delete from public.posts where brand_id = (select id from public.brands where slug = 'oatvia');
delete from public.rules where brand_id = (select id from public.brands where slug = 'oatvia') and source <> '';
update public.rules set status = 'approved', version = 1 where brand_id = (select id from public.brands where slug = 'oatvia');
update public.brands set rulebook_version = 1 where slug = 'oatvia';

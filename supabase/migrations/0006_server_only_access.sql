-- Server-only database access. Run this only after the app uses a Supabase secret key
-- (BRANDSENTINEL_DB_KEY in Vercel). From then on nobody can read or change the tables directly with the
-- public (publishable) key: every change has to go through the app's API and its checks.
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;
-- row level security stays on, with no policies: the public roles get nothing
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

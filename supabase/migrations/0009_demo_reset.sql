-- "Reset demo": a saved copy of the two demo brands (rulebooks, rules, facts, sample posts with their checks,
-- decisions and history) and one function that puts it all back in a single transaction.
-- For trying the app only: a real workspace would not have it.
create table if not exists public.demo_snapshot (
  brand_id uuid primary key references public.brands(id) on delete cascade,
  taken_at timestamptz not null default now(),
  data jsonb not null
);
alter table public.demo_snapshot enable row level security;

create or replace function public.take_demo_snapshot() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from demo_snapshot;
  insert into demo_snapshot (brand_id, data)
  select b.id, jsonb_build_object(
    'brand', jsonb_build_object('name', b.name, 'settings', b.settings, 'rulebook_version', b.rulebook_version),
    'docs', coalesce((select jsonb_agg(to_jsonb(d)) from guideline_docs d where d.brand_id = b.id), '[]'::jsonb),
    'rules', coalesce((select jsonb_agg(to_jsonb(r)) from rules r where r.brand_id = b.id), '[]'::jsonb),
    'facts', coalesce((select jsonb_agg(to_jsonb(f)) from facts f where f.brand_id = b.id), '[]'::jsonb),
    'posts', coalesce((select jsonb_agg(to_jsonb(p)) from posts p where p.brand_id = b.id and p.demo), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(to_jsonb(v)) from reviews v join posts p on p.id = v.post_id where p.brand_id = b.id and p.demo), '[]'::jsonb),
    'decisions', coalesce((select jsonb_agg(to_jsonb(x)) from decisions x join posts p on p.id = x.post_id where p.brand_id = b.id and p.demo), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(to_jsonb(h) - 'id') from history h join posts p on p.id = h.post_id where p.brand_id = b.id and p.demo), '[]'::jsonb)
  )
  from brands b
  where coalesce((b.settings ->> 'protected')::boolean, false);
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.reset_demo() returns jsonb
language plpgsql security definer set search_path = public as $$
declare s record; brands_reset int := 0; posts_back int := 0;
begin
  for s in select * from demo_snapshot loop
    -- the samples and the brand's rulebooks and facts go; posts people created themselves stay
    delete from posts where brand_id = s.brand_id and demo;
    delete from rules where brand_id = s.brand_id;
    delete from guideline_docs where brand_id = s.brand_id;
    delete from facts where brand_id = s.brand_id;
    update brands set name = s.data -> 'brand' ->> 'name', settings = s.data -> 'brand' -> 'settings',
      -- the same version as before, so earlier AI answers for the samples are reused from the cache
      rulebook_version = (s.data -> 'brand' ->> 'rulebook_version')::int
      where id = s.brand_id;
    insert into guideline_docs select * from jsonb_populate_recordset(null::guideline_docs, s.data -> 'docs');
    insert into rules select * from jsonb_populate_recordset(null::rules, s.data -> 'rules');
    insert into facts select * from jsonb_populate_recordset(null::facts, s.data -> 'facts');
    insert into posts select * from jsonb_populate_recordset(null::posts, s.data -> 'posts');
    insert into reviews select * from jsonb_populate_recordset(null::reviews, s.data -> 'reviews');
    insert into decisions select * from jsonb_populate_recordset(null::decisions, s.data -> 'decisions');
    insert into history (post_id, action, role, actor, detail, created_at)
      select post_id, action, role, actor, detail, created_at from jsonb_populate_recordset(null::history, s.data -> 'history');
    brands_reset := brands_reset + 1;
    posts_back := posts_back + jsonb_array_length(s.data -> 'posts');
  end loop;
  return jsonb_build_object('brands', brands_reset, 'posts', posts_back);
end $$;

-- only the app's server (secret key) may run these
revoke all on function public.take_demo_snapshot() from public, anon, authenticated;
revoke all on function public.reset_demo() from public, anon, authenticated;
grant execute on function public.take_demo_snapshot() to service_role;
grant execute on function public.reset_demo() to service_role;

select public.take_demo_snapshot();

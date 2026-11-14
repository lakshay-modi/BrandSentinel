-- A blank brand for trying BrandSentinel with your own guidelines: no rules, no facts, no sample posts.
-- Pick it with the Brand switcher, import your guidelines into the Rulebook, add facts in the Fact Bank, then check posts.
insert into public.brands (slug, name, settings)
values ('blank', 'Blank brand (bring your own)', '{"name": "Blank brand (bring your own)", "palette": [], "palette_tolerance": 40, "products": [], "product_misspellings": [], "brand_hashtag": ""}'::jsonb)
on conflict (workspace_id, slug) do update set name = excluded.name, settings = excluded.settings;

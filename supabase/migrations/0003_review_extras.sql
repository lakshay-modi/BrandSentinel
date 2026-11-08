-- AI goal guess, suggested caption and proof-check stats per review; goal confirmation and author per post
alter table public.reviews add column if not exists goal jsonb;
alter table public.reviews add column if not exists suggested_caption text;
alter table public.reviews add column if not exists dropped int not null default 0;
alter table public.reviews add column if not exists images jsonb not null default '[]'::jsonb;
alter table public.posts add column if not exists goal_confirmed boolean not null default false;
alter table public.posts add column if not exists created_by text not null default 'Guest';

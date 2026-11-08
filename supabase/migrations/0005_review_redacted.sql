-- How many personal or confidential details were hidden from the AI in each check.
alter table public.reviews add column if not exists redacted integer not null default 0;

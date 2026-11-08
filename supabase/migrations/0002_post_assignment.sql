-- Who must act next on a post in review, and whether the expert has signed off
alter table public.posts add column if not exists assigned_role text check (assigned_role in ('brand_manager','expert'));
alter table public.posts add column if not exists expert_approved boolean not null default false;

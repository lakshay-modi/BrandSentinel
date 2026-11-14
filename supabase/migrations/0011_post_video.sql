-- Round 3: video posts. The video file is never uploaded: its checked frames are stored with the post's
-- images, and this column holds its name, length and the speech transcript with timestamps.
alter table public.posts add column if not exists video jsonb;

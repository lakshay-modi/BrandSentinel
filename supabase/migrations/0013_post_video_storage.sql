-- Videos of checked posts, so a reviewer on another device can play them and jump to each problem.
-- Private: files are reached only through short-lived signed links that the app's server creates
-- after checking that the person can see the post. No policies on storage.objects: nobody else can read them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-videos', 'post-videos', false, 41943040, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

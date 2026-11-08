# Database

- `migrations/0001_initial_schema.sql`: tables, indexes and row level security
- `migrations/0002_post_assignment.sql`: approval routing columns
- `seed.sql`: the Oatvia Foods demo brand (25 rules, 16 facts). Regenerate with `node scripts/generate-seed.mjs > supabase/seed.sql`.

The app talks to Supabase only from the server (API routes), using the publishable key.
Row level security allows read, insert and update for the demo; nothing can be deleted through the API.

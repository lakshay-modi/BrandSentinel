# Database

Run the files in `migrations/` in order (`0001` to `0016`) in the Supabase SQL Editor, then the seeds.

| File | What it adds |
| --- | --- |
| `0001`–`0005` | Brands, rules, facts, posts, checks, decisions, history, rule import |
| `0006_server_only_access.sql` | Removes all direct public access: only the app's server reaches the tables |
| `0007_rulebooks.sql` | Several rulebooks per brand |
| `0008`, `0009` | Demo posts and Reset demo |
| `0010_workspaces.sql` | Workspaces, members, invites and the row rules that keep companies apart |
| `0011_post_video.sql` | Video posts (length and transcript; the file itself is never stored) |
| `0012_connections.sql` | API tokens, webhook and Slack settings, delivery log |
| `0013_post_video_storage.sql` | Private storage for checked videos (played through signed links) |
| `0014_password_resets.sql` | One-time password reset links made by a brand manager |
| `0015_starter_claim_rules.sql` | Adds the health-claim and number rules to brands that started from the starter rules |
| `0016_starter_superlatives.sql` | Widens the starter superlative rule (safest, fastest, unbreakable…) for brands that already have it |

Seeds:

- `seed.sql`: the Oatvia Foods demo brand (26 rules, 16 facts). Regenerate with `node scripts/generate-seed.mjs > supabase/seed.sql`.
- `seed_solvira.sql`: a second demo brand whose rules were imported from its PDF.
- `seed_blank.sql`: an empty brand, for trying the import from scratch.

After seeding, `select public.take_demo_snapshot();` saves the state that **Reset demo** restores.

The app talks to Supabase only from the server. People's requests carry their own session token, so row level
security applies; the secret key is used for the few jobs that are not done on someone's behalf.

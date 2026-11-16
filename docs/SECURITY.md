# Security, privacy and human control

The full list. The summary is in the [README](../README.md#security-and-privacy).

## Safety, privacy and human control

- AI never publishes or changes anything by itself. Every fix is a suggestion; a named person approves every post.
- Every AI finding is labelled and must cite a real rule and quote; severity always comes from the rule, never the AI.
- Emails, phone numbers and the brand's confidential terms are replaced with placeholders before any AI call, including the backup AI.
- A company that adds its own Gemini key keeps its posts with Google only: the backup AI is used just for the shared key.
- The demo uses the Gemini free tier, where Google may use prompts to improve its products, so the demo uses fictional data only. A production version would use a paid tier where customer data isn't used for training.

## Security

- **Keys stay on the server.** The AI key and the database key are only read by API routes; the browser never talks to the database.
- **Strict input checks.** Every API body is validated with zod: image sources must be data URLs (PNG, JPEG, WebP) or bundled demo images, colours must be hex, names can't hold markup, sizes are capped.
- **Writes only from this site.** Requests that change data must be JSON and come from the app's own origin (checked with `Origin` and `Sec-Fetch-Site`), and are limited to 60 a minute per visitor; AI calls have their own per-visitor and global limits.
- **Roles and states are enforced on the server.** One permission table decides who may do what. Only the creator can check, re-check, confirm the goal or decide on findings, and only while the post is a draft or sent back; only the assigned reviewer can approve or send back; only the brand manager can change rulebooks, rules and brands.
- **Careful deletes.** The creator can delete a draft (from the Review queue or the post page), with an **Undo** button for 5 seconds before it is really deleted; posts in review or approved are kept for the record.
- **Reset demo (for testing only).** Everyone trying the live demo shares one database, so a **Reset demo** panel on the Review queue (for the demo brands) and the Brands page puts Oatvia Foods and Solvira Skincare back as they were set up: sample posts with their checks and history, rulebooks and facts. It affects every visitor, leaves posts people created and other brands alone, and would not exist in a real workspace. Deleting a rule, fact or rulebook asks first; deleting a brand needs its name typed and is refused for the demo brands. Rejected rules are kept and hidden, and past reports keep their own copy of the rules they cite.
- **Login and workspaces.** Sessions are httpOnly, Secure, SameSite cookies. Sign-in and sign-up are rate-limited. Each request reaches the database with the person's own token, so row level security keeps workspaces apart (`0010_workspaces.sql`); the server's own secret key is used only to create accounts, for the AI answer cache, for encrypted workspace secrets and for Reset demo.
- **Secrets at rest.** A workspace's AI key, webhook address, signing secret and Slack address are encrypted with AES-256-GCM. Invite links and API tokens are stored only as SHA-256 fingerprints and shown once.
- **Outgoing requests.** A webhook must be HTTPS and may not point at a private or local address (checked again after DNS lookup); Slack addresses must be on `hooks.slack.com`. Requests time out after a few seconds and are signed.
- **Public API.** `/api/v1/*` needs a workspace token, is rate-limited per token and visitor, and the demo workspace's public token can only read and check the fictional demo brands.
- **Errors don't leak.** Server errors are logged; the browser only sees a plain message.
- **Prompt injection.** Post text and imported PDFs are marked as content to review, never instructions, and the proof check drops anything without a real rule, quote and fact.
- **Security headers.** A Content Security Policy allows only the site's own scripts, styles, fonts (self-hosted), images, workers and API; framing is blocked; HSTS, `nosniff`, a strict referrer policy and a locked-down permissions policy are on.
- **Health check.** Public health shows only whether the database answers and AI is set up; probing AI models needs a secret token.
- **Database access.** With `BRANDSENTINEL_DB_KEY` set to a Supabase secret key, the public policies are removed (`supabase/migrations/0006_server_only_access.sql`) so the tables can't be read or changed directly at all. If the database ever rejects that key, the server falls back to the publishable key instead of going down, and `/api/health` reports it.

# BrandSentinel

**Catch brand mistakes before they go live.** BrandSentinel checks a brand's social posts (a caption with images, a carousel or a short video) against the brand's own rules and approved facts. It shows the proof behind every problem, suggests a fix that keeps the creator's message, and sends the post to the right person for approval.

Built by Team O(1) for the CodeTitans India 2026 hackathon (problem statement by Inkloom AI).

**Live app:** https://brand-sentinel-delta.vercel.app

| How to get in | What you get |
| --- | --- |
| **No sign-in** | The open demo. Switch between all three roles at the top right. |
| **Sign in → Try as Creator / Expert reviewer / Brand manager** | One click into a ready-made demo account with one fixed role, the way a real team member works. |
| Demo account emails | `creator@brandsentinel.demo`, `expert@brandsentinel.demo`, `manager@brandsentinel.demo`, password `brandsentinel-demo` (also shown on the sign-in page) |
| **Sign in → Create a workspace** | Your own private workspace. No confirmation email is sent, so it works at once. |

The demo workspace holds only fictional brands (Oatvia Foods, Solvira Skincare, Voltaro).

## Try it in 5 minutes

1. Open the live app. Without signing in you are the **Creator** (switch roles at the top right).
2. Click a sample post, for example **Launch post**. The **live preview** underlines problems while you type. Click **Check post**.
3. Every problem is underlined and numbered. Each shows the rule ID, the fact that proves it, and a fix. **Accept**, **Edit** or **Reject** (with a reason), then **Re-check** and **Submit for review**.
4. Switch to **Expert reviewer** or **Brand manager** and approve it or send it back from the **Review queue**.
5. **Video:** on Check a post, click **Try the sample video**. The browser takes a frame every 2.5 seconds, reads the on-screen text and turns the speech into text. After the check, every problem has a time; click it to jump to that second.
6. **Carousel:** add several images to one post. They are checked slide by slide and each problem names its slide.
7. **Connect** (in the menu): download the browser extension or the Google Docs add-on. Both come set up for the demo, so they work straight away.
8. **Sign in → Create a workspace.** You start as brand manager with 14 starter rules, so the first check already finds problems. Open **Team** to invite people with a role or connect your own AI key.
9. As **Brand manager**, open **Rulebook → Add a rulebook** to turn a guidelines PDF into draft rules, and **Insights** to see the most common problems and the rules people disagree with.
10. **Test results** (link in the footer) runs the fast checks on all 10 sample posts in your browser and compares them with the answer key.

## Round 3: the three improvements

These are the three improvements named at Round 2. All three are live.

### 1. Real teams and real brands

- **Login** with Supabase Auth. The session is kept in httpOnly cookies that only the server reads.
- **Company workspaces.** Each workspace has its own brands, rulebooks, facts and posts.
- **Database rules.** The server talks to the database *as the signed-in person* (with their own session token), so Postgres row level security decides what they can read and change. One company can't see another's rows, even if the app's code had a bug. See `supabase/migrations/0010_workspaces.sql`.
- **Invites with roles.** A brand manager creates an invite link for a creator, expert reviewer or brand manager. The link works for one person for 7 days; only a fingerprint of it is stored. Roles can be changed and people removed.
- **Your own AI key.** A workspace can connect its own Gemini API key, so its posts are processed under the company's own Google account and data terms. The key is checked with Google, encrypted (AES-256-GCM) before it is stored, and never shown again.
- **Judges keep full access.** The open demo needs no sign-in, and **Try as…** signs straight into a demo account.
- A brand manager of a real workspace can also act as creator or expert, so a one-person team isn't stuck. History records their own name on everything.

### 2. Check content where it is made and published

- **Browser extension** (Chrome, Edge, Brave): checks what you are writing on any website and marks the problems, with one-click fixes in plain text boxes. Loaded from a folder, so there is no store fee.
- **Google Docs add-on:** a sidebar that checks the document and re-checks while you write.
- **Public check API** (`POST /api/v1/check`) with workspace tokens. The extension and the add-on use it, and so can any other tool.
- **“Post approved” signal:** a signed webhook (`x-brandsentinel-signature`, HMAC-SHA256) sent when a post is approved, which a scheduling tool can wait for. A tool can also ask `GET /api/v1/posts/<id>` whether a post is approved.
- **Slack message** when a post needs someone: submitted for review, approved by the expert, or sent back.
- The **Connect** page has the downloads, install steps, tokens, the webhook and Slack settings, a **Send a test** button and a log of the last 20 signals with what came back.

### 3. Video and carousel checks

- **Carousels:** up to 10 slides, checked slide by slide. Each problem names its slide.
- **Videos up to 60 seconds:** the browser takes a frame every 2.5 seconds and runs the image checks on it (text reading and contrast). Frames that show the same picture or the same words are merged, so one mistake is reported once, with how long it stays on screen.
- **Speech:** the browser pulls out the sound and the AI writes down what is said, with times. The creator can correct the text, or type the script by hand. What is said is checked like a caption.
- **Timestamps:** every problem in a video shows when it happens. Clicking it jumps the player to that second.
- The video file is never uploaded. Only the frames with text, and the sound for the speech-to-text step, leave the device.

## Known limits

- **AI can be slow or busy.** On the Gemini free tier a check can take up to about 15 seconds, or return the fast-check results with a note that the AI was unavailable. **Re-check** usually fixes it. Speech-to-text has the same limit; the script can be typed by hand instead.
- **The video is not stored.** A reviewer on another device sees the frames and the transcript with times. To play the video itself, they load the same file on the post page.
- **Speech rules.** Rules about how text is written (capitals, spelling, units, prices) are not applied to speech, because a transcript's spelling is the transcriber's.
- **Extension fixes** are applied in plain text boxes. In rich editors (for example LinkedIn's) the problems are listed and the fix is copied by hand.
- **Google Docs add-on** is installed by pasting three files into Apps Script (about 2 minutes). It is not in the Workspace Marketplace.
- **The open demo is shared.** Other visitors' changes show up. **Reset demo** (for testing only) restores the demo brands. Your own workspace is never reset.
- **Fixing text inside images** is for small wording changes only. It uses a standard font and refuses on photos, strong gradients and styled lettering.
- **New brands** get the starter rules as fast checks; rules imported from a PDF are checked by AI, so they need the AI to be available.
- **No password reset by email** yet (the free plan has no mail budget). A brand manager can remove a member and send a new invite.

## Brands, rulebooks and roles

- **Any number of brands.** The brand manager creates a brand (name, products, hashtag, colours, confidential names), edits it, and deletes it with everything in it after typing its name. The two demo brands can't be deleted. Switching brand changes every page at once, without a reload.
- **Several rulebooks per brand.** Each guidelines PDF becomes its own rulebook with its own drafted rules. A rulebook can be renamed, **paused** (its rules leave the checks but are kept), **replaced** (upload the right file if the wrong PDF went in: the old rulebook is removed only once the new rules are ready) or removed. Rules can be filtered by rulebook, status and category, searched, edited, and deleted one by one.
- **Clear roles, enforced on the server.** One permission table (`src/lib/roles.ts`) drives both the API checks and the screens:

  | | Creator | Expert reviewer | Brand manager |
  | --- | --- | --- | --- |
  | Write, check, fix and submit posts | ✓ | | |
  | Accept, edit or reject problems | ✓ | | |
  | Delete their drafts | ✓ | | |
  | Approve claims on risky posts | | ✓ | |
  | Final approval | | | ✓ |
  | Add, correct and remove facts | | ✓ | ✓ |
  | Rulebooks and rules | | | ✓ |
  | Create, edit and delete brands | | | ✓ |

  Every page opens with a one-line note on what the current role does there, the menu shows what's waiting for that role, and **Who does what?** explains all three.
- **Easy input.** Drop or paste images straight into a post (a screenshot with Ctrl+V works), or drop a PDF, Word (.docx), .txt or .md file to fill the caption. Rulebooks can be imported from PDF or Word files.
- **Fix text inside images.** When a problem is in an image (for example "Top speed 95 km/h"), **Accept fix in image** or **Edit text in image** (or **Recolour text** for a contrast problem) finds that line with the in-browser text reader, paints over it with its own background and draws the new words in the same place, size and colour. The new image is used from the next re-check, and **Undo** puts the old one back.

  **Limits, stated on the page too:** it is for small wording changes only. It draws in a standard font matched to the old size and weight, not the brand's own typeface. It works on plain or gently shaded backgrounds and refuses (with a reason) on photos, strong gradients, outlined or styled lettering, when it can't find the text, or when the new words would not fit or would cover other parts of the image. Text the reader can't see (very small, curved or decorative) can't be changed. A designer should still replace the image for the final post; the edit lets the check and the approval move on.
- **Score at a glance.** The brand score is shown on a simple dial with green, amber and red bands, beside a bar where each problem is a clickable segment.
- **Instant buttons.** Approving a rule, removing a fact or accepting a fix changes the screen at once; the server confirms in the background and the change is undone, with a message, if it refuses. The server runs in Mumbai (`bom1`), next to the database.

Both demo brands are fictional. **Oatvia Foods**' [guidelines PDF](public/demo/Oatvia_Brand_Guidelines.pdf) defines 26 rules and 16 approved facts; **Solvira Skincare**'s [guidelines PDF](public/demo/solvira/Solvira_Brand_Guidelines.pdf) became 18 rules through the import, plus 7 facts.

## What makes it different

| The common approach | BrandSentinel |
| --- | --- |
| Paste the guidelines into an AI chatbot | **Rulebook with IDs**: numbered rules with good and bad examples, approved by a person and versioned |
| "This feels off-brand" | **No proof, no flag**: every problem points to a real rule or approved fact, checked by plain code |
| AI rewrites the whole post | **Keep the message**: the creator confirms the post's goal, and fixes are small edits |
| Everything checked by AI | **Code first, AI second**: exact checks run as plain code; AI looks for reworded claims and tone |
| Counts mistakes per person | **Unclear-rule alerts**: when people keep disagreeing with a rule, the rule is flagged, not the people |
| Same approver for everything | **Risk-based approval**: posts with claims, serious problems or disputes go to an expert first |
| Copy rules out of the PDF by hand | **PDF to Rulebook**: AI drafts rules from a guidelines PDF; each must quote a real sentence from it, duplicates are skipped, a person approves each one |

## How a check works

```
caption + images
   │
   ├─ in the browser: read text in images (OCR), measure text contrast, find main colours
   │
   ├─ 1. fast checks (plain code, no AI)    names, spelling, units, prices, hashtags, emojis,
   │                                         rankings, numbers vs the Fact Bank, green / health /
   │                                         diet claims, expired offers, ad disclosure, allergens,
   │                                         brand colours, contrast, alt text
   ├─ 2. AI check (one Gemini call per post) reworded claims, tone, post goal, alt text, fixes
   ├─ 3. proof check (plain code)            drops AI findings whose rule, quote or fact isn't real;
   │                                         unsure items go to "for a human to decide"
   └─ 4. brand score                          100 minus 15 / 7 / 3 per high / medium / low problem
```

If the AI is busy (free-tier limit) or off, the fast checks still return a full report. The app tries Gemini Flash first and falls back to Flash-Lite when Flash is overloaded. AI results are cached by content, so repeat checks cost nothing.

## Tested against an answer key

The 10 sample posts contain **41 planted mistakes**, from "India's No. 1" to "20g" instead of "20 g", plus one clean post that must get zero flags. The answer key is in [`demo/expected_findings.json`](demo/expected_findings.json).

```bash
npm test
```

- The fast checks alone catch **all 41 planted mistakes with zero false flags** on these posts. (The same rules and posts were written by the same team, so this proves the checks work, not that they catch everything. The AI layer exists for reworded and new cases.)
- The proof check is tested to drop hallucinated quotes, unknown rules and fake fact IDs, and to merge duplicates.
- Fix application and insights (unclear-rule detection, expiring facts) have their own tests.
- 82 automated tests in total (`npm test`), plus a live run of all 10 posts with the AI on: every score matches the answer key.
- The PDF import's quote check is tested against the sample PDF.

## Works for any brand: tested with a second brand

A second fictional brand, **Solvira Skincare**, was set up only through the product itself (pick it with the **Brand** switcher at the top):

1. Its [guidelines PDF](public/demo/solvira/Solvira_Brand_Guidelines.pdf) was imported into an empty Rulebook. The AI drafted 15 rules, each quoting a real sentence from the PDF. A second import added the 3 rules the first one left out and recognised the other 15 as duplicates. The brand manager approved all 18.
2. Its 7 approved facts were added through the Fact Bank.
3. Its 6 sample posts (21 planted mistakes and one clean post, answer key in [`demo/solvira/answer_key.json`](demo/solvira/answer_key.json)) were checked live.

| Post | Planted | Caught | Note |
| --- | --- | --- | --- |
| Sunscreen launch | 5 | 5 | |
| Influencer post | 4 | 4 | after a fix: missing things (#ad) are now reported with an empty quote |
| Weekend offer | 4 | 4 | the missing "T&C apply" is part of the same offer finding |
| Clean post | 0 | 0 flags | |
| Barrier Cream claims | 4 | 3 | "chemical-free" was only flagged inside the comparison finding |
| LinkedIn update | 4 | 4 | plus 1 false flag (exclamation rule on a post with one "!") |

**20 of 21 caught, 1 false flag.** For a new brand every rule starts as an AI check; the demo brand's rules also have exact fast checks, which is why its answer key scores perfectly. Turning imported rules into fast checks is a planned improvement.

## Tech

| Part | Choice |
| --- | --- |
| Web app | Next.js 16 (App Router) + React 19 + TypeScript, Tailwind CSS v4 |
| Database | Supabase Postgres with row level security |
| Login | Supabase Auth (email and password), session in httpOnly cookies |
| AI | Gemini Flash API (Flash-Lite as fallback), called only from the server; JSON answers validated with zod |
| Image and video text | tesseract.js, self-hosted in `/public/tesseract`, runs in the browser |
| Video | The browser's own `<video>`, canvas and Web Audio: no upload, no paid service |
| PDF text | unpdf, on the server |
| Colour and contrast | Canvas pixel maths in the browser, WCAG contrast formula |
| Extension | Chrome Manifest V3, plain JavaScript (`/extension`) |
| Docs add-on | Google Apps Script (`/public/downloads/google-docs-addon`) |
| Tests | Vitest (82 tests) |
| Hosting | Vercel, Mumbai region, next to the database |

Everything runs on free tiers.

### How the pieces fit together

```
Browser ──► Next.js API routes ──► Supabase Postgres (row level security)
  │              │  │
  │              │  └─► Gemini API (one call per check; speech-to-text for videos)
  │              └────► webhook / Slack (when a post is approved or needs someone)
  ├─ reads text in images and video frames (tesseract.js)
  └─ samples video frames and pulls out the sound

Extension, Docs add-on ──► POST /api/v1/check (workspace token)
```

1. **Session.** `withSession` (`src/lib/session.ts`) wraps every API route. It finds out who is asking and gives the route a database client that carries that person's token. Not signed in means a guest account that belongs only to the demo workspace.
2. **Roles.** One table (`src/lib/roles.ts`) says who may do what. The role comes from the person's membership, never from the request. The database policies repeat the important rules.
3. **A check** (`src/lib/review/run-review.ts`): fast checks in plain code, then one AI call for what code missed, then the proof check, which drops any AI finding without a real rule, an exact quote and real facts.
4. **Secrets** (`src/lib/secrets.ts`): a workspace's AI key, webhook address and Slack address are encrypted before they are stored.

Key files:

- `src/lib/checks/code-checks.ts`, `visual-checks.ts`: fast checks
- `src/lib/ai/prompt.ts`, `gemini.ts`, `proof.ts`: the AI call and the proof check
- `src/lib/session.ts`, `workspaces.ts`, `secrets.ts`: login, workspaces, invites, encrypted keys
- `src/lib/video.ts`, `src/lib/client/video.ts`, `src/app/api/transcribe/route.ts`: video frames, speech and timestamps
- `src/app/api/v1/`, `src/lib/tokens.ts`, `src/lib/hooks.ts`: public API, tokens, webhook and Slack
- `src/lib/starter-rules.ts`: the 14 starter rules for a new brand
- `src/app/api/posts/[id]/action/route.ts`: approval workflow
- `supabase/migrations/`: database schema and row rules
- `extension/`: the browser extension

## Run it locally

You need Node.js 20 or newer and a free [Supabase](https://supabase.com) project. About 10 minutes.

**1. Get the code**

```bash
git clone https://github.com/lakshay-modi/BrandSentinel.git
cd BrandSentinel
npm install
```

**2. Set up the database.** In your Supabase project, open **SQL Editor** and run these files in order (paste each one and click Run):

1. Every file in `supabase/migrations/`, from `0001` to `0012`.
2. `supabase/seed.sql` (the Oatvia Foods demo brand: 26 rules, 16 facts).
3. Optional: `supabase/seed_solvira.sql` (a second demo brand).
4. Optional: `select public.take_demo_snapshot();` so **Reset demo** has something to restore.

**3. Set the keys**

```bash
cp .env.example .env.local
```

| Name | Needed | What it is |
| --- | --- | --- |
| `SUPABASE_URL` | yes | Project URL (Supabase → Project Settings → API) |
| `BRANDSENTINEL_DB_KEY` | yes | The project's **secret** key (`sb_secret_…`). Server only. Used to create accounts, and it is also what the workspace secrets are encrypted with. |
| `GEMINI_API_KEY` | no | A Gemini API key from Google AI Studio. Without it only the fast checks run, and speech in videos is typed by hand. |
| `SUPABASE_PUBLISHABLE_KEY` | no | The project's publishable key. If set, people's requests use it instead of the secret key. |
| `BRANDSENTINEL_ENC_KEY` | no | A separate secret for encrypting workspace keys, if you don't want to derive it from the database key. |
| `GEMINI_MODEL` | no | Model name override |
| `HEALTH_TOKEN` | no | Lets `/api/health?ai=1` probe the AI models (sent as an `x-health-token` header) |

**4. Run**

```bash
npm run dev
```

Open http://localhost:3000. The guest account and the three demo accounts are created by the server the first time they are needed. `http://localhost:3000/api/health` should show `"db":"ok"` and `"auth":"ok"`.

Other commands: `npm test` (82 tests), `npm run lint`, `npm run build`.

**Extension:** open `chrome://extensions`, turn on Developer mode, click **Load unpacked** and choose the `extension` folder. In its Connection settings, set the address to `http://localhost:3000` and paste a token from the Connect page.

**Deploy:** import the repository into Vercel and add the same environment variables. `vercel.json` pins the region to Mumbai; change it to the region of your database.

## Testing

**Automated (`npm test`, 82 tests in 13 files):**

- The fast checks against the answer key for the 10 sample posts: 41 planted mistakes, all caught, with no extra findings on the clean post.
- The proof check: unknown rules, quotes that aren't in the post, made-up facts and out-of-scope rules are dropped.
- Roles: every permission for every role.
- Starter rules on a brand that is not the demo brand.
- Video: timestamps for spoken and on-screen problems, speech checked like a caption, frames checked like images.
- Webhook and Slack: signatures, blocked private addresses, message text.
- Fixes, fixing text in images, document text, insights and API input checks.

**Database rules:** tested in SQL as three different people in two workspaces: a manager sees only their own workspace's brands, posts and team; a creator can't change brands, promote themselves, or read or delete another workspace's posts.

**By hand, on the live app:**

- Sign up, sign in, sign out; a weak password and a repeated email are refused with a plain message.
- Each demo account can do only its own role's actions; a forged role in a request is ignored.
- A new workspace can't open the demo's posts (404) or reset the demo (403).
- Invite link: create, join as a second person, cancel; a used or expired link is refused.
- A wrong AI key is rejected by Google and not stored.
- Main journey for each kind of post (images, carousel, video): check, fix, re-check, submit, approve, send back.
- Extension and Docs add-on against the demo token.
- Webhook and Slack with **Send a test**, and the delivery log.
- Bad input, empty states, a refresh mid-way, the same button twice, and phone width (390 px) on every page.

## Roadmap

**Next (1 to 2 months)**

- Password reset and sign-in with Google, once there is a mail sender.
- Store videos (compressed) so reviewers can play them on any device.
- Publish the extension in the Chrome Web Store and the add-on in the Workspace Marketplace.
- Turn more imported rules into fast checks automatically, so new brands depend less on the AI.

**Later (3 to 6 months)**

- A Canva app and a Figma plugin, on the same check API.
- Direct publishing: approved posts go to the scheduler without a copy step.
- Hindi and other Indian languages for captions, on-screen text and speech.
- Custom approval flows per brand (for example a legal step for offers).
- An audit export for compliance teams.

**How it pays for itself:** it runs free for the demo and early unpaid pilots. Paid hosting starts only when real customers pay, and each company brings its own AI key.

## Safety, privacy and human control

- AI never publishes or changes anything by itself. Every fix is a suggestion; a named person approves every post.
- Every AI finding is labelled and must cite a real rule and quote; severity always comes from the rule, never the AI.
- Emails, phone numbers and the brand's confidential terms are replaced with placeholders before any AI call.
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
- **Public API.** `/api/v1/*` needs a workspace token, is rate-limited per token and visitor, and the open demo's public token can only read and check the fictional demo brands.
- **Errors don't leak.** Server errors are logged; the browser only sees a plain message.
- **Prompt injection.** Post text and imported PDFs are marked as content to review, never instructions, and the proof check drops anything without a real rule, quote and fact.
- **Security headers.** A Content Security Policy allows only the site's own scripts, styles, fonts (self-hosted), images, workers and API; framing is blocked; HSTS, `nosniff`, a strict referrer policy and a locked-down permissions policy are on.
- **Health check.** Public health shows only whether the database answers and AI is set up; probing AI models needs a secret token.
- **Database access.** With `BRANDSENTINEL_DB_KEY` set to a Supabase secret key, the public policies are removed (`supabase/migrations/0006_server_only_access.sql`) so the tables can't be read or changed directly at all. If the database ever rejects that key, the server falls back to the publishable key instead of going down, and `/api/health` reports it.

## Pages

| Path | What it is |
| --- | --- |
| `/` | Check a post |
| `/posts/<id>` | The report for one post (old `/post?id=` links redirect here) |
| `/queue` | Review queue |
| `/rulebook` (`/rulebook#CLAIM-01` opens one rule) | Rulebook |
| `/facts` (`/facts#F-10` opens one fact) | Fact Bank |
| `/insights` | Insights |
| `/brands` | Brands: create, edit, delete and switch |
| `/connect` | Extension, Docs add-on, tokens, webhook, Slack and the delivery log |
| `/workspace` | Team: people, roles, invites and the AI key |
| `/login`, `/signup`, `/join/<token>` | Sign in, create a workspace, join by invite |
| `/tests` | Test results on the sample posts |

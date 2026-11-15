# BrandSentinel

**Catch brand mistakes before they go live.** BrandSentinel checks a brand's social posts (a caption with images, a carousel or a short video) against the brand's own rules and approved facts. It shows the proof behind every problem, suggests a fix that keeps the creator's message, and sends the post to the right person for approval.

Built by Team O(1) for the CodeTitans India 2026 hackathon (problem statement by Inkloom AI).

**Live app:** https://brand-sentinel-delta.vercel.app

The app opens on a **sign-in page**. Every page needs a signed-in account: a demo account or your own.

## Demo accounts

Use these to try BrandSentinel. They are also listed on the sign-in page, where one click signs you in.

| Role | Email | Password | What this person does |
| --- | --- | --- | --- |
| Creator | `creator@brandsentinel.demo` | `brandsentinel-demo` | Writes posts, checks them and fixes problems before review |
| Expert reviewer | `expert@brandsentinel.demo` | `brandsentinel-demo` | Signs off claims and keeps the Fact Bank true |
| Brand manager | `manager@brandsentinel.demo` | `brandsentinel-demo` | Owns the brand: its rulebooks, facts and final approval |

- On the sign-in page, click **Sign in as Creator / Expert reviewer / Brand manager**, or type an email and the password above.
- Each demo account has one fixed role. To act as another person, **sign out** (menu at the top right) and sign in with that role's account. That is how one person walks a post through the whole approval flow.
- The demo accounts open only the demo workspace and its fictional brands (Oatvia Foods, Solvira Skincare, Voltaro). They can't create or join other workspaces.
- **Your own workspace:** on the sign-in page, click **Create a workspace**. No confirmation email is sent, so it works at once, and only people you invite can see it.

> **Webhook and Slack need your own workspace.** The demo workspace is shared by everyone, so it never sends anything outside BrandSentinel: on its Connect page the webhook and Slack settings are switched off, and approving a demo post only *logs* what would have been sent. To see a real webhook or Slack message, create your own workspace (takes a minute, steps below).

## Try it in 5 minutes

1. Open the live app. On the sign-in page, click **Sign in as Creator**.
2. Click a sample post, for example **Launch post**. The **live preview** underlines problems while you type. Click **Check post**.
3. Every problem is underlined and numbered. Each shows the rule ID, the fact that proves it, and a fix. **Accept**, **Edit** or **Reject** (with a reason), then **Re-check** and **Submit for review**.
4. Sign out and sign in as the **Expert reviewer** or **Brand manager**, then approve the post or send it back from the **Review queue**.
5. **Video:** on Check a post, click **Try the sample reel**. The browser takes a frame every 2.5 seconds, reads the on-screen text and turns the speech into text. After the check, every problem has a time; click it to jump to that second.
6. **Carousel:** add several images to one post. They are checked slide by slide and each problem names its slide.
7. **Connect** (in the menu): download the browser extension or the Google Docs add-on. Both come set up for the demo, so they work straight away.
8. **Sign out, then Create a workspace.** You start as brand manager with 16 starter rules, so the first check already finds problems. Open **Team** to invite people with a role or connect your own AI key.
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
- **Judges keep full access.** The sign-in page lists the three demo accounts with their password, and one click signs into each. No sign-up is needed.
- A brand manager of a real workspace can also act as creator or expert, so a one-person team isn't stuck. History records their own name on everything.
- **Passwords:** a brand manager makes a one-time reset link for a member (Team → Reset password, valid for 24 hours), and anyone can change their own password from the account menu. No email is needed.

### 2. Check content where it is made and published

- **Browser extension** (Chrome, Edge, Brave): checks what you are writing on any website and marks the problems, with one-click fixes in plain text boxes. Loaded from a folder, so there is no store fee.
- **Google Docs add-on:** a sidebar that checks the document and re-checks while you write.
- **Public check API** (`POST /api/v1/check`) with workspace tokens. The extension and the add-on use it, and so can any other tool.
- **“Post approved” signal:** a signed webhook (`x-brandsentinel-signature`, HMAC-SHA256) sent when a post is approved, which a scheduling tool can wait for. A tool can also ask `GET /api/v1/posts/<id>` whether a post is approved.
- **Slack message** when a post needs someone: submitted for review, approved by the expert, or sent back.
- The **Connect** page has the downloads, install steps, tokens, the webhook and Slack settings, a **Send a test** button and a log of the last 20 signals with what came back.
- The browser extension and the Docs add-on work with the demo accounts straight away (they come with the demo token).

**To try the webhook and Slack (they need your own workspace):**

1. Sign out, then on the sign-in page click **Create a workspace**. Enter a name, any email address and a password. No confirmation email is needed.
2. Open **Connect** in the menu.
3. **Webhook:** paste an HTTPS address that shows what it receives, for example a free inbox from [webhook.site](https://webhook.site), and click **Save**. Copy the signing secret it shows once. Click **Send a test**: the request arrives at the inbox, and the log at the bottom of Connect shows "Delivered".
4. **Slack:** in a Slack workspace you can use, create an incoming webhook for a channel (Slack → Apps → Incoming Webhooks), paste its `https://hooks.slack.com/services/…` address on Connect, save, and click **Send a test**. The message appears in the channel.
5. To see the real signals, act as creator to check and submit a post, then approve it. As brand manager of your own workspace you can cover the creator and expert roles with **Acting as** at the top right. The webhook receives `post.approved`, and Slack gets a message at each step.

### 3. Video and carousel checks

- **Carousels:** up to 10 slides, checked slide by slide. Each problem names its slide.
- **Videos up to 60 seconds:** the browser takes a frame every 2.5 seconds and runs the image checks on it (text reading and contrast). Frames that show the same picture or the same words are merged, so one mistake is reported once, with how long it stays on screen.
- **Speech:** the browser pulls out the sound and the AI writes down what is said, with times. The creator can correct the text, or type the script by hand. What is said is checked like a caption.
- **Timestamps:** every problem in a video shows when it happens. Clicking it jumps the player to that second.
- **Reviewers can play the video on any device.** After the check, the video (up to 40 MB) is saved privately and played through a signed link that lasts an hour, so a reviewer clicks a problem and the player jumps to that second. Reading the frames happens on the creator's device; only the sound is sent for speech-to-text.

## Known limits

- **AI can be slow or busy.** On the Gemini free tier a check can take up to about 15 seconds. When Gemini is busy, the backup AI (ASI:One) takes over for text; only if both are busy does the report have the fast checks alone, with a note saying so. **Re-check** usually fixes it. Speech-to-text has the same limit; the script can be typed by hand instead.
- **Videos over 40 MB are not saved.** They are still checked, and a reviewer sees the frames and the transcript with times; to play one, they load the same file on the post page. The free storage plan allows about 40 saved videos per workspace (the shared demo keeps its newest 20).
- **Speech rules.** Rules about how text is written (capitals, spelling, units, prices) are not applied to speech, because a transcript's spelling is the transcriber's.
- **Extension fixes** are applied in plain text boxes. In rich editors (for example LinkedIn's) the problems are listed and the fix is copied by hand.
- **Google Docs add-on** is installed by pasting three files into Apps Script (about 2 minutes). It is not in the Workspace Marketplace.
- **The demo workspace is shared.** Everyone using the demo accounts sees each other's changes. **Reset demo** (for testing only) restores the demo brands. Your own workspace is never reset.
- **Fixing text inside images** is for small wording changes only. It uses a standard font and refuses on photos, strong gradients and styled lettering.
- **New brands** get the starter rules as fast checks (the health-claim and number rules are read by the AI too); rules imported from a PDF are checked by AI, so they need the AI to be available.
- **No password reset by email** (the free plan has no mail budget). Instead a brand manager makes a one-time reset link on the Team page and passes it on, and anyone can change their own password from the account menu.

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

If the AI is busy (free-tier limit) or off, the fast checks still return a full report. The app tries Gemini Flash first and falls back to Flash-Lite when Flash is overloaded. If Gemini fails (for example when the free quota runs out while many people test at once), the text checks go straight to a backup AI, ASI:One; if Gemini is just slow, ASI:One starts after 10 seconds as well and the first good answer is used. The report says when the backup did the check. The backup reads text only: the caption, the text found in images and the speech, not the pictures themselves. AI results are cached by content, so repeat checks cost nothing.

## Tested against an answer key

The 10 sample posts contain **41 planted mistakes**, from "India's No. 1" to "20g" instead of "20 g", plus one clean post that must get zero flags. The answer key is in [`demo/expected_findings.json`](demo/expected_findings.json).

```bash
npm test
```

- The fast checks alone catch **all 41 planted mistakes with zero false flags** on these posts. (The same rules and posts were written by the same team, so this proves the checks work, not that they catch everything. The AI layer exists for reworded and new cases.)
- The proof check is tested to drop hallucinated quotes, unknown rules and fake fact IDs, and to merge duplicates.
- Fix application and insights (unclear-rule detection, expiring facts) have their own tests.
- 122 automated tests in total (`npm test`), plus a live run of all 10 posts with the AI on: every score matches the answer key.
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

**20 of 21 caught, 1 false flag.** For a new brand every rule starts as an AI check; the demo brand's rules also have exact fast checks, which is why its answer key scores perfectly. Since then, word lists in imported guidelines (banned words, and "write X, not Y" pairs) become exact fast checks too; see the Mailchimp test below.

## Tested with a real brand: Mailchimp

To see how BrandSentinel does with a real company's public brand data, a private test workspace was set up for **Mailchimp** on 15 November 2026, using only what Mailchimp publishes:

- **Guidelines:** a two-page summary, written in our own words, of rules from Mailchimp's public [Content Style Guide](https://styleguide.mailchimp.com/) (published under CC BY-NC 4.0): voice, the name (Mailchimp, never MailChimp), its word list (email, never e-mail) and banned words (leverage, automagical, rockstar…), punctuation, gender-neutral language, social media rules (no engagement bait, no trending hashtags, at most one emoji on Instagram) and claims.
- **Facts:** 7 facts from mailchimp.com: the plan limits from the help centre's pricing page (Free: 250 contacts and 500 sends a month; Essentials, Standard and Premium limits), the "up to 27x ROI" and "save 15%" claims and the 4.5-star rating from the homepage.
- **Brand settings:** name spellings to correct, and the brand colours Cavendish Yellow and Peppercorn.

The guidelines were imported through the normal Rulebook import (16 draft rules in about 10 seconds, 4 of them with exact word lists) and approved. Then 4 real lines from Mailchimp's homepage and 12 posts with 31 planted mistakes (answer key written before the run) were checked:

| Post | Planted | Caught |
| --- | --- | --- |
| "MailChimp makes e-mail marketing easy…" | 2 | 2 (both fast checks, one-click fixes) |
| Free plan with 2,000 contacts and 10,000 sends | 2 | 2 (fast check against the Fact Bank; the rewrite uses 250 and 500) |
| Leverage, AUTOMAGICAL, crushing it, funnel, "!!!" | 6 | 6 |
| "Like and share…" with 3 emoji and trending hashtags | 3 | 2 (the emoji count went to Ask a human: the starter rule allows 3) |
| Freddie speaking, "chimp", "bananas", "chimptastic" | 3 | 3 |
| "The best email platform", "rated 5 stars by every customer" | 2 | 2 (the rewrite uses the real 4.5 stars) |
| "Gr8 news 4 u… Click here to read this" | 2 | 2 |
| "Save 25%… Hurry, last chance!" | 3 | 3 (wrong discount, pressure, no "terms apply") |
| "Every marketer needs his own…", "rockstar" | 2 | 2 |
| "30 percent", "&" | 3 | 2 (the word "percent" was fixed in the rewrite but not flagged) |
| Comment on an election | 1 | 1 |
| Image with "MailChimp: e-mail made easy" in Mailchimp's colours | 2 | 2 (read from the image; colours recognised as on-brand) |

**29 of 31 planted mistakes caught (94%), and no false alarms on Mailchimp's real copy.** Two of the four real homepage lines were flagged, rightly by the guide's own rules: the headline uses "&", and the "save 15%" line doesn't say that terms apply. Checks took 2 to 4 seconds each.

The first run (before fixes) caught 24 of 31 with 2 false alarms. What the real brand showed, and what was changed:

- **Word lists were left to the AI**, which missed "leverage" and "automagical". The import now saves a rule's exact words (banned words, and "write X, not Y" pairs such as e-mail → email) as fast checks, keeping only words that really are in the document and never everyday words like "like" or "share".
- **Acronyms such as ROI and SMS were treated as shouting.** Common acronyms are now allowed.
- **"30 percent" and "2,000 contacts" weren't compared with the facts.** The number check now reads percent written as a word and counts of contacts, subscribers, users, customers, sends and emails.
- **A garbled AI answer lost the AI checks.** It now gets one more try from the backup AI.
- **Rulebook import ran out of time** on a busy afternoon. Documents are now drafted in parts at the same time, Gemini 3 models are asked to think "low" (faster), and the import says which AI models were tried when none answered.
- **Rewrites sometimes came back in quote marks.** They are now removed.

## Tech

| Part | Choice |
| --- | --- |
| Web app | Next.js 16 (App Router) + React 19 + TypeScript, Tailwind CSS v4 |
| Database | Supabase Postgres with row level security |
| Login | Supabase Auth (email and password), session in httpOnly cookies |
| AI | Gemini Flash API (Flash-Lite as fallback), with ASI:One as a backup AI for text when Gemini is busy. Called only from the server; JSON answers validated with zod |
| Image and video text | tesseract.js, self-hosted in `/public/tesseract`, runs in the browser |
| Video | The browser's own `<video>`, canvas and Web Audio: no upload, no paid service |
| PDF text | unpdf, on the server |
| Colour and contrast | Canvas pixel maths in the browser, WCAG contrast formula |
| Extension | Chrome Manifest V3, plain JavaScript (`/extension`) |
| Docs add-on | Google Apps Script (`/public/downloads/google-docs-addon`) |
| Tests | Vitest (122 tests) |
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

1. **Session.** `withSession` (`src/lib/session.ts`) wraps every API route. It finds out who is asking and gives the route a database client that carries that person's token. Without a session the API answers 401, and `src/proxy.ts` sends pages to the sign-in page.
2. **Roles.** One table (`src/lib/roles.ts`) says who may do what. The role comes from the person's membership, never from the request. The database policies repeat the important rules.
3. **A check** (`src/lib/review/run-review.ts`): fast checks in plain code, then one AI call for what code missed, then the proof check, which drops any AI finding without a real rule, an exact quote and real facts.
4. **Secrets** (`src/lib/secrets.ts`): a workspace's AI key, webhook address and Slack address are encrypted before they are stored.

Key files:

- `src/lib/checks/code-checks.ts`, `visual-checks.ts`: fast checks
- `src/lib/ai/prompt.ts`, `gemini.ts`, `proof.ts`: the AI call and the proof check
- `src/lib/session.ts`, `workspaces.ts`, `secrets.ts`: login, workspaces, invites, encrypted keys
- `src/lib/video.ts`, `src/lib/client/video.ts`, `src/app/api/transcribe/route.ts`: video frames, speech and timestamps
- `src/app/api/v1/`, `src/lib/tokens.ts`, `src/lib/hooks.ts`: public API, tokens, webhook and Slack
- `src/lib/starter-rules.ts`: the 16 starter rules for a new brand
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

1. Every file in `supabase/migrations/`, from `0001` to `0016`.
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
| `ASI1_API_KEY` (or `ASIAPI`) | no | A key for ASI:One, the backup AI used for text when Gemini is busy. Without it, a busy Gemini means the fast checks only. Never used for a workspace with its own Gemini key. |
| `AI_BACKUP_FIRST` | no | Set to `1` to send text checks to the backup AI first (for testing it). A brand manager can also test the backup with `POST /api/ai/backup-check`. |
| `GEMINI_MODEL` | no | Model name override |
| `HEALTH_TOKEN` | no | Lets `/api/health?ai=1` probe the AI models (sent as an `x-health-token` header) |

**4. Run**

```bash
npm run dev
```

Open http://localhost:3000. You land on the sign-in page. The three demo accounts are created by the server the first time someone signs in with them. `http://localhost:3000/api/health` should show `"db":"ok"` and `"auth":"ok"`.

Other commands: `npm test` (122 tests), `npm run lint`, `npm run build`.

**Extension:** open `chrome://extensions`, turn on Developer mode, click **Load unpacked** and choose the `extension` folder. In its Connection settings, set the address to `http://localhost:3000` and paste a token from the Connect page.

**Deploy:** import the repository into Vercel and add the same environment variables. `vercel.json` pins the region to Mumbai; change it to the region of your database.

## Testing

**Automated (`npm test`, 122 tests in 17 files):**

- The fast checks against the answer key for the 10 sample posts: 41 planted mistakes, all caught, with no extra findings on the clean post.
- The proof check: unknown rules, quotes that aren't in the post, made-up facts and out-of-scope rules are dropped.
- Roles: every permission for every role.
- Starter rules on a brand that is not the demo brand.
- Video: timestamps for spoken and on-screen problems, speech checked like a caption, frames checked like images.
- Webhook and Slack: signatures, blocked private addresses, message text.
- Backup AI: starts at once when Gemini fails and alongside a slow Gemini (first good answer wins), gets text only, never used for speech-to-text or for a company with its own Gemini key, and stops at its time limit.
- Disguised text: invisible characters and look-alike digits ("Clin\u200bically pr0ven", "N0. 1") are still caught, and the original characters are quoted; codes like KIRO10 and amounts like 20g stay as they are.
- Spec numbers with units (km, kg, hours, mAh…) compared with the Fact Bank; common superlatives ("the safest", "fastest").
- Fair use of the shared AI: per-visitor limit, overflow to the backup AI, no shared limit on a company's own key.
- Fixes, fixing text in images, document text, insights and API input checks.

**Extension and Google Docs add-on (`npm run test:integrations`, needs Playwright with Chromium):**

- The real extension runs in Chromium: the popup connects with the demo token and lists the brands, the checker marks 6 problems in typed text, **Apply fix** changes the text box, it re-checks while you keep typing, and a wrong token is reported in plain words.
- The real Docs add-on code and sidebar run with stand-ins for Google's services: it checks the whole document or just the selection, applies a fix in the document, re-checks while you write, and refuses a non-HTTPS server address.
- Both use a stand-in API that replays answers recorded from the live API (`tests/integrations/recorded-api.json`), so they run on any machine.

**Database rules:** tested in SQL as three different people in two workspaces: a manager sees only their own workspace's brands, posts and team; a creator can't change brands, promote themselves, or read or delete another workspace's posts.

**Judge-style stress test on the live app (15 November).** Everything below was done on the live site with brand-new data: a made-up e-bike company ("Kiro Bikes") with its own guidelines PDF and Word file, 9 facts, and three real accounts (brand manager, creator, expert), plus a second company to attack the first. Every failure found was fixed, deployed and tested again; the results here are after the fixes.

- **Accounts and access:** signed out, every page goes to sign-in and keeps the link; every API answers 401. Sign-up refuses a short or too-long password, a bad email and a missing name; names with HTML tags are saved as plain text. Invite links give the chosen role and can't be reused; the only brand manager can't demote or remove themselves; reset links and password changes work, and demo passwords can't be changed.
- **Isolation:** the second company couldn't read, change, approve, re-check, delete or switch into the first company's posts, brands, facts or team, including by setting the brand cookie by hand. A token only reaches its own workspace; a revoked token stops at once.
- **Roles:** creators can't approve, edit rules, add facts, invite, make tokens or change hooks; experts can't write posts; a role claimed in a request is ignored and the person's real role is used.
- **Rulebook import:** the new guidelines PDF became 9 draft rules with their source quotes, the Word file 2 more; rules already in the Rulebook were skipped (and can be added anyway). A scan with no text, a fake PDF and an .exe are refused with plain messages.
- **11 hard captions:** wrong numbers against the Fact Bank (with the closest true fact and a rewrite using a current offer), an expired offer, a competitor name, "the fastest", slang, Hinglish, hidden characters and look-alike digits, a prompt-injection attempt (ignored), confidential names and misspellings, a safety post (phone in hand, missing helmet line, wrong speed), a 3,000-character caption with a claim at the end, emoji and hashtag spam, and a paid partner post. All were caught; a clean post got 100 with no false alarms.
- **Images:** a 3-slide carousel with pale yellow text on white (contrast 1.26:1), a "Safest e-bike" slide and dark-grey text on black: each problem was reported on its own slide, with contrast measured and alt text suggested.
- **Video:** a new 20-second reel recorded in the browser (WebM, no sound): all four on-screen texts were read, "Burns fat" at 0:05 and "99 km" at 0:10 were caught with their times, the video was saved for reviewers, and clicking 0:05 moved the player there. A 65-second video is refused; a 41 MB video is checked but not saved, with a clear message.
- **Workflow:** accept, disagree (a reason is required), submit, send back (a comment is required), re-check, expert approval and final approval, with every step in the history under the real person's name. Two submits or two approvals at the same moment took effect once; approved posts can't be edited or deleted.
- **Load:** when Gemini was slow, the backup AI answered instead (ASI:One checked a clean post live). Checks past the shared Gemini budget go to the backup AI, and a visitor checking very fast is told to wait a minute instead of getting a silent "busy" (both covered by automated tests).
- **Every page as a judge would see it:** each page at phone width (375 px) with no sideways scrolling and no errors in the browser console; the demo's clean post still scores 100, its off-brand image and sample reel give the same results as before.
- **Bugs found and fixed in this round:** health claims and unproven numbers passing in new workspaces; disguised text and superlatives slipping through; "KIRO10 at any store" read as "10 stores"; pale and dark-on-dark text not read in images; video frames skipped when only the words changed; an AI rewrite swapping a confidential product for another; a duplicate rule wrongly skipped on import; the check form re-submitting the last post when you came back to it; sign-out needing a request body; a missing fact giving a server error; stale wording about video uploads.

**By hand, on the live app (14 November):**

- Sign up, create a workspace and run a first check (the new workspace starts with 16 rules).
- A weak password, a repeated email and a wrong password are each refused with a plain message.
- Each demo account signs in with one click and can do only its own role's actions; a forged role in a request is ignored.
- Invite link: create, join as a second person with the chosen role; reusing the link is refused.
- A new workspace can't open the demo's posts (404) or reset the demo (403).
- A wrong AI key is rejected by Google and not stored.
- Sample reel: read in 34 seconds (5 on-screen texts, 5 spoken lines), 10 problems each with its time, and clicking one moved the player to 0:10.
- Carousel: check and submit.
- Submit three times at once and approve twice at once: each took effect once.
- The public check API with the demo token and with a workspace's own token; a wrong token is refused.
- Bad input (unknown channel, empty caption, broken request, bad post address) is refused with a plain message.
- Real Slack: a BrandSentinel app with an incoming webhook in a real Slack workspace, connected on the Connect page of a new workspace. The test message, "needs the brand manager's approval" and "approved and ready to publish" all arrived in the channel within about 0.2 seconds each, with links back to the post, and the delivery log recorded each one.
- Backup AI on the live site: ASI:One answered a test question in about 1 second, and ran a full check of a sample Oatvia post on its own in about 34 seconds. It found the made-up health claim, and its rewrite passed the proof check with nothing dropped.
- Saved video: a creator added a video and checked it, and it uploaded to private storage. Signed in as the expert, the post page played it from a signed link, and clicking a problem jumped the player to 0:10. Deleting the draft removed the file.
- The full approval journey as the three demo accounts (check, send back, re-check, disagree, resubmit, expert approval, final approval).
- Passwords: a wrong current password is refused; after a change the old password fails and the new one works. A reset link shows whose account it is for, refuses a short password, signs the person in and can't be used twice. A creator can't make reset links, and the demo password can't be changed.
- Webhook **Send a test** to a public request inbox: delivered and signed; the signature was checked against the secret, and a changed body fails. Approving a post sent `post.approved` with the post and its link. A private or `http://` address and a non-Slack address are refused.
- Slack messages are sent and logged for submitted, expert approved and approved (tested against an invalid Slack address, so the log shows Slack's 404).

## Roadmap

**Next (1 to 2 months)**

- Password reset by email and sign-in with Google, once there is a mail sender.
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

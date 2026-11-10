# BrandSentinel

**Catch brand mistakes before they go live.** BrandSentinel checks a brand's social posts and ads (caption plus up to 5 images) against the brand's own rules and approved facts. It shows the proof behind every problem, suggests a fix that keeps the creator's message, and sends the post to the right person for approval.

Built for the CodeTitans India 2026 hackathon (problem statement by Inkloom AI).

**Live demo:** https://brand-sentinel-delta.vercel.app · No sign-in needed

## Try it in 2 minutes

1. Open the live demo. You're the **Creator** (switch roles at the top right).
2. Click a sample post, for example **Launch post**. The **live preview** underlines problems in the caption as you type. Then click **Check post**.
3. Every problem is underlined in the post and numbered. Each one shows the rule ID, the fact that proves it, and a fix. Filter by severity, point at a mark to find its problem, or press **J** and **K** to move between problems.
4. **Accept** a fix, **Edit** it, or **Reject** it with a reason (problems inside an image can be fixed in the image too). Then **Re-check** and **Submit for review**.
5. Switch to **Expert reviewer** or **Brand manager** and approve it or send it back from the **Review queue**.
6. Open **Insights** to see the most common problems and the rules people disagree with.
7. Open **Test results** (link in the footer) to see the fast checks run on all 10 sample posts in your browser, compared with the answer key.
8. As **Brand manager**, open **Rulebook → Add a rulebook → Try the sample addendum**. The AI drafts new rules from the PDF, skips the ones the Rulebook already has, and you approve or reject each draft (or all of them at once). Approved rules are used in the next check.
9. Switch the **Brand** (under the header) to **Solvira Skincare**, a second brand whose Rulebook was imported from its own PDF, and check its sample posts.
10. Bring your own brand: as **Brand manager**, open **Manage brands** (next to the brand menu) → **New brand**, then add its guidelines PDF as a rulebook and its facts. Click **Who does what?** at any time to see each role's job and what's waiting for it.

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
- 41 automated tests in total (`npm test`), plus a live run of all 10 posts with the AI on: every score matches the answer key.
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
| Web app | Next.js 16 (App Router) + TypeScript, Tailwind CSS v4 |
| Type | Schibsted Grotesk, Newsreader and IBM Plex Mono, self-hosted via Fontsource |
| Database | Supabase Postgres with row level security |
| AI | Gemini Flash API, called only from the server; one call per post; JSON answers validated with zod |
| Image text | tesseract.js, self-hosted in `/public/tesseract`, runs in the browser |
| PDF text | unpdf, on the server |
| Colour and contrast | Canvas pixel maths in the browser, WCAG contrast formula |
| Tests | Vitest |
| Hosting | Vercel |

Key files:

- `src/lib/checks/code-checks.ts`: fast checks for tone, words and claims
- `src/lib/checks/visual-checks.ts`: brand colours, contrast, alt text
- `src/lib/ai/prompt.ts`, `src/lib/ai/gemini.ts`: the single AI call
- `src/lib/ai/proof.ts`: the proof check
- `src/lib/review/run-review.ts`: the full pipeline
- `src/app/api/rules/import/route.ts`, `src/lib/ai/import-prompt.ts`: PDF to Rulebook drafts
- `src/app/api/posts/[id]/action/route.ts`: approval workflow and routing
- `supabase/migrations/`: database schema

## Run it locally

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

Environment variables:

| Name | What it is |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `BRANDSENTINEL_DB_KEY` | Supabase secret key, server only (recommended: lets the database refuse all direct public access) |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key, server only (fallback when no secret key is set) |
| `GEMINI_API_KEY` | Gemini API key (optional: without it, only fast checks run) |
| `GEMINI_MODEL` | Optional model name override |
| `HEALTH_TOKEN` | Optional: lets `/api/health?ai=1` probe the AI models (sent as an `x-health-token` header) |

Set up the database by running `supabase/migrations/*.sql` and then `supabase/seed.sql`.

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
| `/tests` | Test results on the sample posts |

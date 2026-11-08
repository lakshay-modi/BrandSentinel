# BrandSentinel

**Catch brand mistakes before they go live.** BrandSentinel checks a brand's social posts and ads (caption plus up to 5 images) against the brand's own rules and approved facts. It shows the proof behind every problem, suggests a fix that keeps the creator's message, and sends the post to the right person for approval.

Built for the CodeTitans India 2026 hackathon (problem statement by Inkloom AI).

**Live demo:** https://brand-sentinel-delta.vercel.app · No sign-in needed

## Try it in 2 minutes

1. Open the live demo. You're the **Creator** (switch roles at the top right).
2. Click a sample post, for example **Launch post**, then **Check post**.
3. Every problem is underlined in the caption and numbered. Each one shows the rule ID, the fact that proves it, and a fix.
4. **Accept** a fix, **Edit** it, or **Disagree** with a reason. Then **Re-check** and **Submit for review**.
5. Switch to **Expert reviewer** or **Brand manager** and approve it or send it back from the **Review queue**.
6. Open **Insights** to see the most common problems and the rules people disagree with.

The demo brand, **Oatvia Foods**, is fictional. Its [brand guidelines PDF](public/demo/Oatvia_Brand_Guidelines.pdf) defines 25 rules and 16 approved facts.

## What makes it different

| The common approach | BrandSentinel |
| --- | --- |
| Paste the guidelines into an AI chatbot | **Rulebook with IDs**: numbered rules with good and bad examples, approved by a person and versioned |
| "This feels off-brand" | **No proof, no flag**: every problem points to a real rule or approved fact, checked by plain code |
| AI rewrites the whole post | **Keep the message**: the creator confirms the post's goal, and fixes are small edits |
| Everything checked by AI | **Code first, AI second**: exact checks run as plain code; AI looks for reworded claims and tone |
| Counts mistakes per person | **Unclear-rule alerts**: when people keep disagreeing with a rule, the rule is flagged, not the people |
| Same approver for everything | **Risk-based approval**: posts with claims, serious problems or disputes go to an expert first |

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

## Tech

| Part | Choice |
| --- | --- |
| Web app | Next.js 16 (App Router) + TypeScript, Tailwind CSS |
| Database | Supabase Postgres with row level security |
| AI | Gemini Flash API, called only from the server; one call per post; JSON answers validated with zod |
| Image text | tesseract.js, self-hosted in `/public/tesseract`, runs in the browser |
| Colour and contrast | Canvas pixel maths in the browser, WCAG contrast formula |
| Tests | Vitest |
| Hosting | Vercel |

Key files:

- `src/lib/checks/code-checks.ts`: fast checks for tone, words and claims
- `src/lib/checks/visual-checks.ts`: brand colours, contrast, alt text
- `src/lib/ai/prompt.ts`, `src/lib/ai/gemini.ts`: the single AI call
- `src/lib/ai/proof.ts`: the proof check
- `src/lib/review/run-review.ts`: the full pipeline
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
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (used only on the server) |
| `GEMINI_API_KEY` | Gemini API key (optional: without it, only fast checks run) |
| `GEMINI_MODEL` | Optional model name override |

Set up the database by running `supabase/migrations/*.sql` and then `supabase/seed.sql`.

## Safety, privacy and human control

- AI never publishes or changes anything by itself. Every fix is a suggestion; a named person approves every post.
- Every AI finding is labelled and must cite a real rule and quote; severity always comes from the rule, never the AI.
- The AI key and database key stay on the server. Nothing can be deleted through the API.
- The demo uses the Gemini free tier, where Google may use prompts to improve its products, so the demo uses fictional data only. A production version would use a paid tier where customer data isn't used for training.

# Testing and results

Every test run on BrandSentinel, in full. The summary is in the [README](../README.md#results).

## Tested against an answer key

The 10 sample posts contain **41 planted mistakes**, from "India's No. 1" to "20g" instead of "20 g", plus one clean post that must get zero flags. The answer key is in [`demo/expected_findings.json`](../demo/expected_findings.json).

```bash
npm test
```

- The fast checks alone catch **all 41 planted mistakes with zero false flags** on these posts. (The same rules and posts were written by the same team, so this proves the checks work, not that they catch everything. The AI layer exists for reworded and new cases.)
- The proof check is tested to drop hallucinated quotes, unknown rules and fake fact IDs, and to merge duplicates.
- Fix application and insights (unclear-rule detection, expiring facts) have their own tests.
- 128 automated tests in total (`npm test`), plus a live run of all 10 posts with the AI on: every score matches the answer key.
- The PDF import's quote check is tested against the sample PDF.

## Works for any brand: tested with a second brand

A second fictional brand, **Solvira Skincare**, was set up only through the product itself (pick it with the **Brand** switcher at the top):

1. Its [guidelines PDF](../public/demo/solvira/Solvira_Brand_Guidelines.pdf) was imported into an empty Rulebook. The AI drafted 15 rules, each quoting a real sentence from the PDF. A second import added the 3 rules the first one left out and recognised the other 15 as duplicates. The brand manager approved all 18.
2. Its 7 approved facts were added through the Fact Bank.
3. Its 6 sample posts (21 planted mistakes and one clean post, answer key in [`demo/solvira/answer_key.json`](../demo/solvira/answer_key.json)) were checked live.

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

## Test log

**Automated (`npm test`, 128 tests in 18 files):**

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
- Backup AI: ASI:One Mini is asked first and the general model only if Mini is refused; a check the backup answered keeps its fast-check problems, sends the backup's own findings to a person, and caches nothing.
- Rewrites that add a number the post and the facts don't have are dropped; a fix that begins a sentence starts with a capital; a contrast problem on a brand without a palette suggests near-black or white, so **Recolour text** works.
- Fixes accepted one by one read cleanly: a fix that is a whole statement starts its own sentence, in either order.
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

**Final check before submission (16 November)**, on the live app with a real account (the team's own workspace) and the three demo accounts:

- **Code:** lint, type check, 128 unit tests, the extension and Docs add-on tests in a real Chromium, and a production build: all pass. The live database has all 16 migrations, row level security on all 17 tables and the demo snapshot.
- **Own workspace:** a fact added to the Fact Bank; a 13-problem post (caption and an image with pale text) caught in full, with the price compared with the new fact; fixes accepted, one rejected (a reason is required), re-checked, sent back by the expert (a comment is required), resubmitted, approved by the expert and the brand manager using **Acting as**. Each step sent a real Slack message (all delivered) and an approved post can't be deleted. Invites, the join page, tokens, the public API and revoking (a revoked token stops at once) all worked; unsafe webhook addresses were refused. A 6-second video was read frame by frame, saved, played from a signed link and removed with its draft. A guidelines PDF became 21 draft rules while Gemini was overloaded (the backup drafted them).
- **Demo accounts:** one-click sign-in for each role, returning to the page asked for; the Launch post scores 14, the Clean post 100 and the Off-brand image 57, as in the answer key; the sample reel gave 10 problems with times, and clicking 0:10 moved the player; the full approval journey across the three demo accounts; every demo restriction (webhook, Slack, AI key, tokens, invites, reset links, password, new workspace, renaming, deleting a demo brand) refused with a plain reason; **Test results** shows 41 of 41 caught; every page at 375 px with no sideways scrolling and no script errors.
- **Found and fixed during this check:** "Edit text in image" couldn't find pale text that the check had found; a brand without a palette got no **Recolour text** button; on a day when Gemini's free tier was overloaded, the backup model (asi1) timed out, so the backup now uses ASI:One Mini (2 to 7 seconds); Mini once flagged "Made for students" as a health claim, so the backup's findings now go to a person; a rewrite invented "20 g of protein", so rewrites can't add numbers; an accepted fix after "!" started with a small letter; fixes accepted one by one could leave a dangling word and a run-on ("…oats, our outer box is made from recyclable paperboard pack"), so a fix that is a whole statement now starts its own sentence and drops the leftover word.

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

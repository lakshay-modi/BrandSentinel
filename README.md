# BrandSentinel

**Catch brand mistakes before they go live.** BrandSentinel checks a brand's social posts (a caption with images, a carousel or a short video) against the brand's own rules and approved facts. It shows the proof behind every problem, suggests a fix that keeps the creator's message, and sends the post to the right person for approval.

Built by Team O(1) for the CodeTitans India 2026 hackathon (problem statement by Inkloom AI).

**Live app:** https://brand-sentinel-delta.vercel.app

**Contents:** [Demo accounts](#demo-accounts) · [Try it in 5 minutes](#try-it-in-5-minutes) · [The three improvements](#round-3-the-three-improvements) · [Every feature](#every-feature-and-how-to-use-it) · [Beyond the three](#beyond-the-three-improvements-what-we-added-and-why) · [Problems we solved](#problems-we-faced-and-how-we-solved-them) · [How a check works](#how-a-check-works) · [Results](#results) · [Known limits](#known-limits) · [Tech](#tech) · [Run it locally](#run-it-locally) · [Security](#security-and-privacy) · [Roadmap](#roadmap)

**More detail:** [every test and result](docs/TESTING.md) · [security in full](docs/SECURITY.md) · [more on the features](docs/FEATURES.md)

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

### Demo account or your own account?

Everything for checking and approving posts works with the demo accounts. These features need your own account, because the demo workspace is shared by every visitor: anything that sends data out, holds a secret or adds people stays off there.

**To get your own account:** sign out, click **Create a workspace** on the sign-in page, and enter a workspace name, an email and a password. You start as brand manager of a new brand with 16 starter rules.

| Feature | With a demo account | With your own account | Why the demo can't |
| --- | --- | --- | --- |
| Webhook "post approved" signal | Switched off; approving only logs what would be sent | Delivered and signed to your HTTPS address; **Send a test** shows it at once | A shared account must not send visitors' posts to addresses someone else typed in |
| Slack messages | Switched off, logged only | Sent to your channel when a post is submitted, approved by the expert, sent back or approved | Same as the webhook |
| Your own Gemini AI key | Uses BrandSentinel's shared free key | Connect it on **Team**; checked with Google, encrypted, no shared limit | A secret key can't live in a workspace everyone can open |
| Private API tokens | One public demo token, built into the extension and Docs add-on | Create, name and revoke tokens on **Connect** | The public token can only reach the fictional demo brands |
| Inviting a team with roles | No invites | Invite links for each role, one person each, 7 days | The demo is open to everyone already |
| **Acting as** another role | Sign out and sign in with another demo account | A brand manager can act as creator or expert | Keeps each demo account to one clear role |
| Password reset links and changing your password | The demo password is public and fixed | Reset links on **Team**; **Change password** in the account menu | Changing it would lock other judges out |
| Creating or joining other workspaces | Refused | Create one, or join with an invite link | Demo accounts belong only to the demo workspace |
| Renaming the workspace, deleting brands | The demo workspace and its demo brands are protected | Rename; delete a brand after typing its name | Keeps the demo the same for every judge |
| Privacy and saved videos | Shared; **Reset demo** restores it; newest 20 videos kept | Private, never reset; about 40 saved videos | The demo is shared by design |

Works the same in both: checking captions, images, carousels and videos, fixes (including inside images), the review queue and approvals, Rulebook import, the Fact Bank, Insights, brands, the extension, the Docs add-on and **Test results**.

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

## Every feature and how to use it

Teams, video, carousels and connections are in the three improvements above.

**Checking a post**

| Feature | How to use it | Who |
| --- | --- | --- |
| Check a post | On **Check a post**, write the caption, pick the channel (Instagram, LinkedIn, X, Website, Email), post type and product, then **Check post** | Creator |
| Live preview | Problems are underlined while you type | Creator |
| Sample posts | Click a sample (for example **Launch post**) to fill the form with planted mistakes | Anyone |
| Easy input | Drop or paste images (Ctrl+V works); drop a PDF, Word, .txt or .md file to fill the caption | Creator |
| Post goal | After a check, confirm what the post is for (**Is that right?**), so fixes keep that message | Creator |
| The report | A score dial and a bar with one segment per problem; each problem shows its rule ID, the exact words, the fact that proves it and a fix; filter by caption or images | Everyone |
| For a human to decide | AI findings the proof check couldn't confirm are listed apart, not counted | Creator, reviewers |
| Image checks | Text in images is read in the browser, contrast measured (WCAG 4.5:1), colours compared with the palette, alt text suggested | Automatic |

**Fixing problems**

| Feature | How to use it | Who |
| --- | --- | --- |
| Accept, edit or reject a fix | **Accept**, **Edit**, or **Reject** with a reason (required) | Creator |
| Whole post with every fix | **Suggested version with every fix applied**, under the report | Creator |
| Fix text inside an image | **Accept fix in image**, **Edit text in image** or **Recolour text**; **Undo** restores the old image | Creator |
| Re-check | **Re-check** after fixing | Creator |

**Approval**

| Feature | How to use it | Who |
| --- | --- | --- |
| Submit for review | **Submit for review**. Claims, serious problems or disputed fixes go to the expert first; the rest straight to the brand manager | Creator |
| Review queue | **Review queue** lists what waits for your role; the menu shows the count | Reviewers |
| Approve or send back | **Approve claims** (expert) or **Approve post** (brand manager), or **Send back** with a comment (required) | Expert, brand manager |
| History | Every step on the post page, under the real person's name | Everyone |
| Delete a draft | From the queue or the post page, with 5 seconds to **Undo** | Creator |

**Rulebook and Fact Bank**

| Feature | How to use it | Who |
| --- | --- | --- |
| Starter rules | Every new brand gets 16 ready rules | Automatic |
| Guidelines to rules | **Rulebook → Add a rulebook**: upload a PDF or Word file. Each drafted rule quotes a real sentence; word lists become exact fast checks | Brand manager |
| Review drafts | Approve, edit or reject each; duplicates are skipped, with **Add anyway** | Brand manager |
| Manage rulebooks | Rename, pause, replace or remove; filter and search rules; **Add a rule by hand** | Brand manager |
| Fact Bank | **Add a fact**: the claim, product, source and **Valid until**. Numbers in posts are compared with these; expired facts stop counting as proof | Expert, brand manager |

**Brands, insights and tools**

| Feature | How to use it | Who |
| --- | --- | --- |
| Brands | **Brands**: create, edit or delete (type the name); the **Brand** switcher changes every page | Brand manager |
| Insights | Posts checked, average score first to latest, fixes accepted, common problems, rules people disagree with, gaps in the guidelines, facts ending within 30 days | Brand manager |
| Test results | **Test results** in the footer runs the answer key in your browser | Anyone |
| Reset demo | On the demo's **Review queue** or **Brands** page | Demo only |
| Who does what? | In the role bar at the top; each page also opens with a note for your role | Everyone |

**Who can do what** (one permission table, `src/lib/roles.ts`, drives both the server checks and the screens):

| | Creator | Expert reviewer | Brand manager |
| --- | --- | --- | --- |
| Write, check, fix and submit posts | ✓ | | |
| Approve claims on risky posts | | ✓ | |
| Final approval | | | ✓ |
| Add, correct and remove facts | | ✓ | ✓ |
| Rulebooks, rules and brands | | | ✓ |

More detail, including the limits of fixing text inside images: [docs/FEATURES.md](docs/FEATURES.md).

## Beyond the three improvements: what we added and why

The three improvements made BrandSentinel usable by real teams. These additions make it trustworthy and useful from day one for any brand. Each fixes a gap we hit while building or testing.

| Addition | Why we added it | Why it matters |
| --- | --- | --- |
| **Proof check: no proof, no flag** | AI sometimes invents rules, quotes or facts | Every problem points to a real rule, the exact words and an approved fact; plain code drops the rest |
| **Code first, AI second** | Exact checks shouldn't depend on an AI that can be busy | The report always comes back; the fast checks caught all 41 planted mistakes |
| **16 starter rules** | A new workspace started empty and found nothing | The first check already finds problems, including health claims and unproven numbers |
| **Guidelines PDF or Word to rulebook** | Brands keep rules in PDFs, not tables | Mailchimp's guide became 16 rules in about 10 seconds, each quoting its source |
| **Fact Bank with sources and end dates** | The costliest mistakes are wrong numbers and expired offers | A wrong figure is flagged with the true fact, and the rewrite uses it |
| **Backup AI and fair-use limits** | The free Gemini tier gets busy when many judges test at once | AI checks keep working, and a fast clicker is asked to wait instead of getting a silent error |
| **Fixes inside images** | An image problem left the creator waiting for a designer | The wording is fixed in place, so the check and approval move on |
| **Risk-based approval** | Not every post needs an expert | Risky posts go to the expert first; simple ones straight to the brand manager |
| **Unclear-rule alerts** | When people keep disagreeing with a rule, the rule is usually the problem | The rule is flagged, not the people |
| **Keep the message** | AI that rewrites a whole post loses the creator's voice | Live preview, a confirmed post goal and small fixes |
| **Several brands and rulebooks** | Agencies run more than one brand | One workspace covers them all |
| **Defences against tricks** | Invisible characters, look-alike digits, and posts that give the AI orders | Still caught, and orders in a post are ignored |
| **Security for real data** | Real teams will put unreleased work in it | Database-level isolation, encrypted secrets, no webhooks to private addresses |
| **Built for judges to verify** | Judges must try everything without setup | One-click demo accounts, **Test results**, **Reset demo**, passwords without email |

## Problems we faced and how we solved them

The hardest part was staying reliable and accurate with no budget: a free AI tier, free storage, no email sender and no paid video service. Most problems came from our own tests; each fix was deployed and tested again.

| Area | Problem | How we solved it |
| --- | --- | --- |
| AI | Gemini busy or out of free quota when many people test at once | Three Gemini models in turn, then ASI:One; results cached by content; 8 AI checks a minute per visitor and 12 Gemini calls a minute overall, with overflow to the backup |
| AI | A slow Gemini answer could keep a check waiting 20 seconds or more | The backup starts as soon as Gemini fails, or after 10 seconds; the first good answer wins |
| AI | The AI sometimes invented rules, quotes or facts | The proof check drops findings without a real rule, exact words and a real fact; unsure ones go to a human |
| AI | Importing Mailchimp's guide timed out | Thinking level "low" for Gemini 3 models; documents drafted in up to 8 parts at once; failed parts marked; the error names the models tried |
| AI | A garbled answer lost the AI checks | One more try with the backup AI |
| AI | On a day Gemini's free tier was overloaded, the backup (asi1) timed out on full checks | Measured live: ASI:One Mini finishes in 2 to 7 seconds, so it goes first; its own findings go to a person, because it once flagged "Made for students" as a health claim |
| AI | A rewrite invented "20 g of protein" | Rewrites that add a number the post and the Fact Bank don't have are dropped |
| AI | A rewrite swapped products or came back in quote marks | A prompt rule against changing products; quote marks removed in code |
| AI | A post or PDF could try to give the AI orders | Content is marked as content to review, never instructions; the proof check catches the rest |
| Accuracy | New workspaces let health claims and made-up numbers pass | Starter rules for both (also read by the AI), migrations for existing brands, wider superlatives |
| Accuracy | Hidden characters and look-alike digits slipped through; the first fix broke "20g" | Rules match a cleaned copy; a 0 counts as an O only after a letter and not before a digit; the original is quoted |
| Accuracy | "KIRO10 at any store" read as "10 stores" | Numbers glued to letters are left alone |
| Accuracy | Imported word lists were left to the AI; the first fix banned "like" and "share" | Exact checks, keeping only words in the document and never everyday words |
| Accuracy | ROI and SMS flagged as shouting | Common acronyms allowed |
| Accuracy | "30 percent" and "2,000 contacts" not compared with facts | The number check reads "percent" and counts of contacts, users, sends and similar |
| Accuracy | A new rule wrongly skipped as a duplicate | Stricter matching and **Add anyway** |
| Media | The text reader missed pale-on-white and dark-on-black text | A second reading on a background-separated copy, and a colour measure for close colours |
| Media | "Edit text in image" couldn't find pale text that the check had found | It reads the background-separated copy too, like the check; a brand without a palette is offered near-black or white for **Recolour text** |
| Media | Video frames merged when only the words changed | Frames compared cell by cell |
| Media | Free storage is about 1 GB | Videos up to 40 MB saved with one-hour links; demo keeps 20, workspaces about 40; bigger videos still checked |
| Media | Speech-to-text has a cost and a limit | Only the sound is sent; the script can be typed by hand |
| Accounts | No budget for email | No confirmation email; reset links from the brand manager; change your own password |
| Accounts | Any visitor could change or break the shared demo | **Reset demo** from a snapshot, protected demo brands, one fixed role per demo account |
| Security | The shared demo must never send visitors' posts outside | Webhook and Slack off in the demo, logged only |
| Security | A webhook could point at internal addresses | HTTPS only; private addresses blocked, checked again after lookup |
| Workflow | Two clicks at once could submit or approve twice | Each step takes effect once (tested with 3 submits and 2 approvals at once) |
| Polish | Fixes accepted one by one could leave a dangling word and a run-on ("…oats, our outer box is made from recyclable paperboard pack"); a fix after "!" started with a small letter | A fix that is a whole statement starts its own sentence and drops the leftover word; fixes that begin a sentence are capitalised |
| Polish | Sign-out needed a request body, a missing fact gave a server error, names with HTML were saved oddly, the form re-sent the last post | All fixed and tested again on the live site |

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

If the AI is busy (free-tier limit) or off, the fast checks still return a full report. The app tries Gemini Flash first and falls back to Flash-Lite when Flash is overloaded. If Gemini fails (for example when the free quota runs out while many people test at once), the text checks go straight to a backup AI, ASI:One; if Gemini is just slow, ASI:One starts after 10 seconds as well and the first good answer is used. The backup is ASI:One Mini, the fastest ASI:One model (a full check in about 2 to 7 seconds, where the larger models took over 35). Because it is a smaller model, its own findings are listed under **For a human to decide** instead of counting as problems, and its answers are never cached. The report says when the backup did the check. A suggested rewrite from either AI is dropped if it adds a number the post and the Fact Bank don't have. The backup reads text only: the caption, the text found in images and the speech, not the pictures themselves. AI results are cached by content, so repeat checks cost nothing.

## Results

| Test | What was checked | Result |
| --- | --- | --- |
| Answer key, fast checks only | 10 sample posts with 41 planted mistakes, and 1 clean post | **41 of 41 caught, 0 false flags.** Run it yourself on the [Test results](https://brand-sentinel-delta.vercel.app/tests) page |
| Second brand (Solvira Skincare), set up only through the app | Rules imported from its PDF; 6 posts with 21 planted mistakes | **20 of 21 caught**, 1 false flag |
| Real brand: Mailchimp | Rules from Mailchimp's public style guide, 7 facts from mailchimp.com, 12 posts with 31 planted mistakes, 4 real homepage lines | **29 of 31 caught (94%)**, 0 false alarms on the real copy |
| Judge-style stress test (15 November) | A new brand, three real accounts, a second company attacking the first, 11 hard captions, images, video, races | All passed after fixes; every bug found is listed above |
| Final check (16 November) | Every feature with the team's own account and the three demo accounts, including real Slack | All passed; 7 issues found and fixed the same day |
| Automated tests | `npm test`, plus the real extension and Docs add-on in Chromium | 128 tests in 18 files, all passing |

The same team wrote the demo rules and the demo posts, so the answer key shows the checks work as designed; the Mailchimp test is the fairer measure. Full tables, the misses and every test log: [docs/TESTING.md](docs/TESTING.md).

## Known limits

- **AI can be slow or busy.** On the Gemini free tier a check can take up to about 15 seconds, and at busy times Google answers "overloaded". Then the backup AI (ASI:One Mini) takes over for text, and its findings are shown for a person to decide; only if both are busy does the report have the fast checks alone, with a note saying so. **Re-check** usually fixes it. Speech-to-text has the same limit; the script can be typed by hand instead.
- **Videos over 40 MB are not saved.** They are still checked, and a reviewer sees the frames and the transcript with times; to play one, they load the same file on the post page. The free storage plan allows about 40 saved videos per workspace (the shared demo keeps its newest 20).
- **Speech rules.** Rules about how text is written (capitals, spelling, units, prices) are not applied to speech, because a transcript's spelling is the transcriber's.
- **Extension fixes** are applied in plain text boxes. In rich editors (for example LinkedIn's) the problems are listed and the fix is copied by hand.
- **Google Docs add-on** is installed by pasting three files into Apps Script (about 2 minutes). It is not in the Workspace Marketplace.
- **The demo workspace is shared.** Everyone using the demo accounts sees each other's changes. **Reset demo** (for testing only) restores the demo brands. Your own workspace is never reset.
- **Fixing text inside images** is for small wording changes only. It uses a standard font and refuses on photos, strong gradients and styled lettering.
- **New brands** get the starter rules as fast checks (the health-claim and number rules are read by the AI too). Rules imported from a PDF are checked by AI, except their word lists, which become fast checks.
- **Starter rule limits** (such as 3 emoji on Instagram) can't be edited yet; this caused one of the two Mailchimp misses.
- **No password reset by email** (the free plan has no mail budget). Instead a brand manager makes a one-time reset link on the Team page and passes it on, and anyone can change their own password from the account menu.

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
| Tests | Vitest (128 tests) |
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

Other commands: `npm test` (128 tests), `npm run lint`, `npm run build`.

**Extension:** open `chrome://extensions`, turn on Developer mode, click **Load unpacked** and choose the `extension` folder. In its Connection settings, set the address to `http://localhost:3000` and paste a token from the Connect page.

**Deploy:** import the repository into Vercel and add the same environment variables. `vercel.json` pins the region to Mumbai; change it to the region of your database.

## Security and privacy

- **A person approves every post.** AI never publishes or changes anything; every fix is a suggestion.
- **No proof, no flag.** Every AI finding must cite a real rule and the exact words; severity comes from the rule, never the AI.
- **Companies are kept apart by the database.** Each request reaches Postgres with the person's own token, so row level security decides what they see.
- **Roles are enforced on the server.** A role claimed in a request is ignored.
- **Secrets are encrypted** (AES-256-GCM): a workspace's AI key, webhook address and Slack address. Tokens and invite links are stored only as fingerprints.
- **Private data stays out of the AI.** Emails, phone numbers and confidential names are replaced with placeholders before any AI call.
- **Outgoing requests are limited.** Webhooks must be HTTPS and can't reach private addresses; Slack addresses must be on `hooks.slack.com`.
- **Prompt injection is handled.** Post text and PDFs are treated as content to review, never as instructions.
- **The demo uses fictional data only**, because it runs on the Gemini free tier.

The full list (input checks, rate limits, headers, careful deletes): [docs/SECURITY.md](docs/SECURITY.md).

## Roadmap

**Next (1 to 2 months)**

- Password reset by email and sign-in with Google, once there is a mail sender.
- Editable limits on the starter rules (for example the emoji count per channel).
- Compress and store videos over 40 MB, so reviewers can play every video.
- Publish the extension in the Chrome Web Store and the add-on in the Workspace Marketplace.
- Turn more imported rules (beyond word lists) into fast checks automatically, so new brands depend less on the AI.

**Later (3 to 6 months)**

- A Canva app and a Figma plugin, on the same check API.
- Direct publishing: approved posts go to the scheduler without a copy step.
- Hindi and other Indian languages for captions, on-screen text and speech.
- Custom approval flows per brand (for example a legal step for offers).
- An audit export for compliance teams.

**How it pays for itself:** it runs free for the demo and early unpaid pilots. Paid hosting starts only when real customers pay, and each company brings its own AI key.

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

# More on the features

Detail that doesn't fit the [README](../README.md#every-feature-and-how-to-use-it)'s tables.

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

Both demo brands are fictional. **Oatvia Foods**' [guidelines PDF](../public/demo/Oatvia_Brand_Guidelines.pdf) defines 26 rules and 16 approved facts; **Solvira Skincare**'s [guidelines PDF](../public/demo/solvira/Solvira_Brand_Guidelines.pdf) became 18 rules through the import, plus 7 facts.

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

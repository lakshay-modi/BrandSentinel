# Oatvia Foods: demo brand for BrandSentinel

Oatvia Foods is a fictional snack brand used to demo and test BrandSentinel. No real company or personal data.

| File | What it is |
| --- | --- |
| `Oatvia_Brand_Guidelines.pdf` | The brand's guideline PDF, written like a real one (used to demo PDF → Rulebook) |
| `brand.json` | Palette, exact product names, common misspellings, brand hashtag |
| `rules.json` | 25 approved rules with IDs, severity, scope, check type (code / ai / code+ai), do and don't examples |
| `facts.json` | 16 approved facts with source and end date (F-14 is an expired offer, F-16 is a "not gluten-free" restriction) |
| `sample_posts.json` | 10 sample posts (caption, channel, post type, partner flag, images, alt text) |
| `images/` | 5 post images with planted visual mistakes (OCR-tested: tesseract reads every line exactly) |
| `expected_findings.json` | Answer key: every planted mistake, its rule, severity, expected score, and things that must NOT be flagged |

## Sample posts

| Post | What it tests | Planted mistakes | Expected score |
| --- | --- | --- | --- |
| P01 | Launch post (walkthrough example) | 10 | 14, red |
| P02 | LinkedIn update: casing, US spelling, wrong number, emoji limit | 5 | 69, amber |
| P03 | Expired offer, missing T&C | 2 | 70, amber |
| P04 | Influencer post: no #ad, guilt-free, weight loss, "best", hashtags | 5 | 37, red |
| P05 | Wrong diet claims, missing allergen line | 3 | 55, red |
| P06 | Greenwashing in caption **and** in the image | 4 | 40, red |
| P07 | Wrong calcium number, "#1", comparison with dairy | 5 | 53, red |
| P08 | **Clean post: must get zero flags** | 0 | 100, green |
| P09 | Neon off-brand image, low contrast, misspelled names in the image | 5 | 57, red |
| P10 | Valid offer with small formatting mistakes | 3 | 79, amber |

Score: start at 100, minus 15 (high), 7 (medium) or 3 (low) per finding.

## How to use the answer key
Run all 10 posts through the checker and compare with `expected_findings.json`:
- **Caught** = expected findings the app found (recall)
- **Real** = app flags that are in the key (precision)
- Anything in `should_not_flag` that gets flagged is a false alarm.

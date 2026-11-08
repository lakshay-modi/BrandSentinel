"""Second fictional demo brand, Solvira Skincare, used to test that BrandSentinel works for any brand.
Builds its guidelines PDF (imported into the Rulebook through the app), its settings with 6 sample posts,
its approved facts (added through the Fact Bank API) and an answer key written in plain words, because rule
IDs are only known after the import."""
import json, os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# DejaVu has the rupee sign (₹), which the built-in PDF fonts don't
pdfmetrics.registerFont(TTFont("DV", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DV-Bold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
TEAL, CORAL, GREY = HexColor("#1E4E5A"), HexColor("#B4532F"), HexColor("#5B6475")
h1 = ParagraphStyle("h1", fontName="DV-Bold", fontSize=22, textColor=TEAL, spaceAfter=4)
sub = ParagraphStyle("sub", fontName="DV", fontSize=10, textColor=GREY, spaceAfter=16)
h2 = ParagraphStyle("h2", fontName="DV-Bold", fontSize=13, textColor=CORAL, spaceBefore=12, spaceAfter=5)
body = ParagraphStyle("body", fontName="DV", fontSize=10.5, leading=15.5, textColor=TEAL, spaceAfter=5)

SECTIONS = [
    ("About Solvira", ["Solvira Skincare makes simple, effective skincare for Indian weather. This document sets the rules for every post, ad and influencer collaboration. It is reviewed every quarter by the brand team."]),
    ("Voice and tone", [
        "Our tone is calm, kind and honest. Never use urgency or pressure, such as 'buy now', 'hurry', 'last chance' or 'only today'.",
        "Use at most one exclamation mark in a post.",
        "Never use words in ALL CAPS for emphasis. Offer codes are the only exception.",
    ]),
    ("Names and words", [
        "Always write our product names exactly as: Solvira, Daily Shield Sunscreen, Barrier Cream and Vitamin C Serum. Never write Solveira, Salvira or Solvera.",
        "Prices are written with the rupee symbol and no space, for example ₹649. Never write Rs. or INR.",
        "Every Instagram post must include the hashtag #SolviraSkin.",
        "On LinkedIn, use at most one emoji per post.",
    ]),
    ("Claims", [
        "Never use the words fairness, fairer, whitening, lightening or 'skin tone correction'. Skin of every tone is healthy skin.",
        "Never make medical claims: our products do not cure, treat or heal any skin condition such as acne, eczema or psoriasis.",
        "Never call a product the best, India's number one or better than another brand, and never compare it with other brands.",
        "Every number we publish (SPF, percentages, prices, number of stores or cities) must match an approved fact exactly.",
        "Never promise results in a time frame, such as 'in 7 days', and never claim 100% protection or 100% results.",
        "Only say 'dermatologist tested' for products with an approved test report. Never say 'dermatologist recommended' or 'clinically proven'.",
        "Never call a product chemical-free or toxin-free.",
        "Offers must match an active approved offer exactly, including the code and dates, and must say 'T&C apply'.",
    ]),
    ("Partners and influencers", [
        "Every paid or partner post must start with #ad or 'Paid partnership'.",
        "Influencers must not show before-and-after photos.",
    ]),
    ("Confidential", [
        "Never mention internal project names or unreleased products in any post.",
    ]),
]

def pdf():
    out = os.path.join(ROOT, "public", "demo", "solvira", "Solvira_Brand_Guidelines.pdf")
    story = [Paragraph("Solvira Skincare: Brand Guidelines", h1), Paragraph("Version 1.2, November 2026. Demo document: Solvira Skincare is fictional.", sub)]
    for title, paras in SECTIONS:
        story.append(Paragraph(title, h2))
        story += [Paragraph(p, body) for p in paras]
    SimpleDocTemplate(out, pagesize=A4, leftMargin=56, rightMargin=56, topMargin=56, bottomMargin=56, title="Solvira Skincare Brand Guidelines", author="Solvira Skincare (fictional)").build(story)
    return out

SAMPLES = [
    dict(id="S1", label="Sunscreen launch", hint="Superlative, wrong SPF, 100% claim, pushy tone", title="Sunscreen launch with many mistakes",
         channel="instagram", post_type="launch", product="Daily Shield Sunscreen", partner=False,
         caption="India's best sunscreen! Daily Shield gives you SPF 60 and 100% protection all day. Buy now!!! #SolviraSkin"),
    dict(id="S2", label="Influencer post", hint="No #ad, a fairness claim, a result in a time frame", title="Influencer post without disclosure",
         channel="instagram", post_type="partner", product="Vitamin C Serum", partner=True,
         caption="Obsessed with my glow 😍 The Solvira Vitamin C Serum made my skin 3 shades fairer in just 7 days! #skincare #glowup"),
    dict(id="S3", label="Weekend offer", hint="An offer that doesn't match, urgency, price format", title="Offer post with the wrong offer",
         channel="instagram", post_type="offer", product="Solvira", partner=False,
         caption="Flat 25% off everything with code SOLVIRA25, this weekend only. Hurry, prices from Rs. 499! #SolviraSkin"),
    dict(id="S4", label="Clean post", hint="Follows every rule, so it should pass cleanly", title="Clean product post",
         channel="instagram", post_type="product", product="Daily Shield Sunscreen", partner=False,
         caption="Meet Daily Shield Sunscreen: SPF 50 PA++++ in a light gel for everyday use. ₹649 for 50 ml on solvira.in. #SolviraSkin"),
    dict(id="S5", label="Barrier Cream claims", hint="Dermatologist claim, a medical claim, a comparison, 'chemical-free'", title="Product post with health claims",
         channel="instagram", post_type="product", product="Barrier Cream", partner=False,
         caption="Our Barrier Cream is dermatologist recommended and cures eczema. Unlike other brands, it's chemical-free. #SolviraSkin"),
    dict(id="S6", label="LinkedIn update", hint="Misspelled name, emojis, a number with no fact, a confidential name", title="LinkedIn company update",
         channel="linkedin", post_type="company update", product="Brand", partner=False,
         caption="Big news 🎉🚀✨ Solveira is now in 40 cities! And a sneak peek: Project Dawn is coming soon."),
]
for s in SAMPLES:
    s["images"] = []

# What each post should be flagged for, in plain words (rule IDs are assigned by the import)
ANSWER_KEY = {
    "S1": ["superlative 'India's best'", "SPF 60 doesn't match the approved SPF 50", "'100% protection' absolute claim", "'Buy now' pressure", "too many exclamation marks"],
    "S2": ["no #ad on a partner post", "fairness claim ('fairer')", "result in a time frame ('in just 7 days')", "missing #SolviraSkin on Instagram"],
    "S3": ["offer doesn't match the approved offer (25% / SOLVIRA25)", "urgency ('this weekend only', 'Hurry')", "'Rs.' price format", "missing 'T&C apply'"],
    "S4": [],
    "S5": ["'dermatologist recommended'", "medical claim ('cures eczema')", "comparison with other brands", "'chemical-free'"],
    "S6": ["misspelled brand name 'Solveira'", "more than one emoji on LinkedIn", "'40 cities' has no approved fact", "confidential name 'Project Dawn'"],
}

FACTS = [
    dict(product="Daily Shield Sunscreen", fact="SPF 50, PA++++ broad-spectrum protection.", source="Lab report SPF-2026-07", valid_until="2027-06-30", type="general"),
    dict(product="Daily Shield Sunscreen", fact="Price: ₹649 for 50 ml.", source="Price list, November 2026", valid_until="2026-12-31", type="price"),
    dict(product="Barrier Cream", fact="Dermatologist tested.", source="Study DT-221 (2026)", valid_until="2027-12-31", type="general"),
    dict(product="Barrier Cream", fact="Fragrance-free.", source="Formulation sheet FS-12", valid_until="2027-12-31", type="general"),
    dict(product="Vitamin C Serum", fact="Contains 10% vitamin C (ascorbic acid).", source="Formulation sheet FS-31", valid_until="2027-12-31", type="general"),
    dict(product="All products", fact="Offer: 15% off on solvira.in with code SOLVIRA15, valid 1-30 Nov 2026. T&C apply.", source="Offer brief OB-11", valid_until="2026-11-30", type="offer"),
    dict(product="Solvira", fact="Available in 120 stores across 18 cities.", source="Retail report Q3 2026", valid_until="2027-03-31", type="availability"),
]

BRAND = {
    "name": "Solvira Skincare",
    "tagline": "Simple skincare for Indian weather.",
    "palette": [{"name": "Sand", "hex": "#F3E9DF", "use": "Backgrounds"}, {"name": "Deep Teal", "hex": "#1E4E5A", "use": "Text and logo"},
                {"name": "Coral", "hex": "#E07A5F", "use": "Accents"}, {"name": "White", "hex": "#FFFFFF", "use": "Text on teal"}],
    "palette_tolerance": 40,
    "products": ["Solvira", "Daily Shield Sunscreen", "Barrier Cream", "Vitamin C Serum"],
    "product_misspellings": ["Solveira", "Salvira", "Solvera"],
    "brand_hashtag": "#SolviraSkin",
    "confidential_terms": ["Project Dawn"],
    "guidelines_pdf": "/demo/solvira/Solvira_Brand_Guidelines.pdf",
    "import_sample": {"url": "/demo/solvira/Solvira_Brand_Guidelines.pdf", "name": "Solvira_Brand_Guidelines.pdf", "label": "Import Solvira's guidelines PDF"},
    "samples": SAMPLES,
}

if __name__ == "__main__":
    print(pdf())
    d = os.path.join(ROOT, "demo", "solvira")
    json.dump(BRAND, open(os.path.join(d, "brand.json"), "w"), ensure_ascii=False, indent=2)
    json.dump(FACTS, open(os.path.join(d, "facts.json"), "w"), ensure_ascii=False, indent=2)
    json.dump(ANSWER_KEY, open(os.path.join(d, "answer_key.json"), "w"), ensure_ascii=False, indent=2)
    print(sum(len(v) for v in ANSWER_KEY.values()), "planted mistakes")

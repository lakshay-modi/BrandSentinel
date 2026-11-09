"""Third fictional demo brand, Tallyra Money (a fintech app). Its Rulebook starts empty: a brand manager imports
it from this guidelines PDF in the app. Builds the PDF, the brand settings with sample posts, the facts and an
answer key in plain words."""
import json, os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

pdfmetrics.registerFont(TTFont("DV", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DV-Bold", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
INK, PLUM, GREY = HexColor("#1B1F3B"), HexColor("#6B3FA0"), HexColor("#5B6475")
h1 = ParagraphStyle("h1", fontName="DV-Bold", fontSize=21, textColor=INK, spaceAfter=4)
sub = ParagraphStyle("sub", fontName="DV", fontSize=10, textColor=GREY, spaceAfter=16)
h2 = ParagraphStyle("h2", fontName="DV-Bold", fontSize=13, textColor=PLUM, spaceBefore=12, spaceAfter=5)
body = ParagraphStyle("body", fontName="DV", fontSize=10.5, leading=15.5, textColor=INK, spaceAfter=5)

SECTIONS = [
    ("About Tallyra", ["Tallyra Money is a savings and payments app. Money is a serious topic, so every post must be clear, honest and calm. These rules apply to all posts, ads and partner content."]),
    ("Voice and tone", [
        "Be calm and clear. Never use urgency or pressure, such as 'act now', 'join now', 'hurry', 'offer ends tonight' or 'last chance'.",
        "Use at most one exclamation mark in a post, and never write words in ALL CAPS for emphasis. Offer codes are the only exception.",
    ]),
    ("Names, prices and hashtags", [
        "Always write our names exactly as Tallyra, Tallyra Save and Tallyra Card. Never write Talyra, TallyRa or Tallyra Money Card.",
        "Write amounts with the rupee symbol and no space, for example ₹100. Never write Rs. or INR.",
        "Every Instagram post must include the hashtag #MoneyWithTallyra.",
        "On LinkedIn, use at most one emoji per post.",
    ]),
    ("Financial claims", [
        "Never promise returns. Never use the words guaranteed, risk-free, zero risk or 'double your money'.",
        "Every interest rate, cashback percentage, bonus amount and user number must match an approved fact exactly.",
        "Cashback must always be described as 'up to' the approved percentage.",
        "Never say Tallyra is 'RBI approved' or 'government backed'. Only describe deposit insurance in the approved words.",
        "Never compare Tallyra with banks or other apps, and never call Tallyra the best.",
        "Any post that mentions mutual funds or a SIP must include: 'Mutual fund investments are subject to market risks, read all scheme related documents carefully.'",
        "Every offer, bonus or cashback post must match an active approved offer and must say 'T&C apply'.",
    ]),
    ("Partners and confidential work", [
        "Every paid or partner post must start with #ad or 'Paid partnership'.",
        "Never mention internal project names or unreleased features in any post.",
    ]),
]

SAMPLES = [
    dict(id="T1", label="Savings launch", hint="Guaranteed returns, a wrong rate, a bank comparison, caps and urgency", title="Tallyra Save launch with many mistakes",
         channel="instagram", post_type="launch", product="Tallyra Save", partner=False,
         caption="Tallyra Save gives you GUARANTEED 9% returns with zero risk! Better than any bank. Join now!! #MoneyWithTallyra"),
    dict(id="T2", label="Influencer cashback post", hint="No #ad, a misspelled name, a wrong cashback claim without 'up to'", title="Partner post about the card",
         channel="instagram", post_type="partner", product="Tallyra Card", partner=True,
         caption="Paid for my whole trip with cashback from my Talyra Card 😎 You get 5% back on everything. #fintech #travel"),
    dict(id="T3", label="Joining bonus offer", hint="Wrong bonus amount, 'Rs.' format, urgency, no 'T&C apply'", title="Offer post with the wrong bonus",
         channel="instagram", post_type="offer", product="Tallyra", partner=False,
         caption="Sign up with code TALLYRA100 and get Rs. 150 free. Offer ends tonight. #MoneyWithTallyra"),
    dict(id="T4", label="Mutual fund post", hint="Promises returns, no market-risk disclaimer", title="SIP post without the disclaimer",
         channel="instagram", post_type="product", product="Tallyra", partner=False,
         caption="Start a SIP on Tallyra and double your money in 3 years. #MoneyWithTallyra"),
    dict(id="T5", label="Clean post", hint="Follows every rule, so it should pass cleanly", title="Clean savings post",
         channel="instagram", post_type="product", product="Tallyra Save", partner=False,
         caption="Tallyra Save earns 7.25% p.a. on balances up to ₹1 lakh. Deposits are insured up to ₹5 lakh by DICGC through our partner bank. T&C apply. #MoneyWithTallyra"),
    dict(id="T6", label="LinkedIn update", hint="'RBI approved', a wrong user number, emojis, a confidential name", title="LinkedIn company update",
         channel="linkedin", post_type="company update", product="Brand", partner=False,
         caption="Proud to share that Tallyra is now RBI approved 🚀🎉 and trusted by 5 million users. Project Orbit launches soon."),
]
for s in SAMPLES:
    s["images"] = []

ANSWER_KEY = {
    "T1": ["'GUARANTEED' / 'zero risk'", "9% doesn't match the approved 7.25%", "comparison with banks", "ALL CAPS 'GUARANTEED'", "urgency 'Join now'", "too many exclamation marks"],
    "T2": ["no #ad on a partner post", "misspelled 'Talyra'", "5% doesn't match the approved 'up to 2%' and 'up to' is missing", "missing #MoneyWithTallyra"],
    "T3": ["bonus ₹150 doesn't match the approved ₹100", "'Rs.' price format", "urgency 'Offer ends tonight'", "missing 'T&C apply'"],
    "T4": ["'double your money' promise", "missing mutual fund risk disclaimer"],
    "T5": [],
    "T6": ["'RBI approved'", "'5 million users' doesn't match the approved 2 million", "more than one emoji on LinkedIn", "confidential name 'Project Orbit'"],
}

FACTS = [
    dict(product="Tallyra Save", fact="Interest: 7.25% p.a. on balances up to ₹1 lakh.", source="Rate card RC-11", valid_until="2026-12-31", type="general"),
    dict(product="Tallyra Save", fact="Deposits are insured up to ₹5 lakh by DICGC through our partner bank.", source="Partner bank disclosure PB-2", valid_until="2027-12-31", type="general"),
    dict(product="Tallyra Card", fact="Up to 2% cashback on UPI payments, capped at ₹500 a month. T&C apply.", source="Card terms CT-4", valid_until="2027-03-31", type="offer"),
    dict(product="Tallyra", fact="Joining bonus: ₹100 with code TALLYRA100, valid 1-30 Nov 2026. T&C apply.", source="Offer brief OB-7", valid_until="2026-11-30", type="offer"),
    dict(product="Tallyra", fact="2 million users.", source="Users report Q3 2026", valid_until="2027-03-31", type="company"),
]

BRAND = {
    "name": "Tallyra Money",
    "tagline": "Calm money, clear numbers.",
    "palette": [{"name": "Night", "hex": "#1B1F3B", "use": "Text"}, {"name": "Plum", "hex": "#6B3FA0", "use": "Brand colour"},
                {"name": "Mist", "hex": "#F1EEF8", "use": "Backgrounds"}, {"name": "White", "hex": "#FFFFFF", "use": "Text on plum"}],
    "palette_tolerance": 40,
    "products": ["Tallyra", "Tallyra Save", "Tallyra Card"],
    "product_misspellings": ["Talyra", "TallyRa"],
    "brand_hashtag": "#MoneyWithTallyra",
    "confidential_terms": ["Project Orbit"],
    "guidelines_pdf": "/demo/tallyra/Tallyra_Brand_Guidelines.pdf",
    "import_sample": {"url": "/demo/tallyra/Tallyra_Brand_Guidelines.pdf", "name": "Tallyra_Brand_Guidelines.pdf", "label": "Import Tallyra's guidelines PDF"},
    "samples": SAMPLES,
}

if __name__ == "__main__":
    out = os.path.join(ROOT, "public", "demo", "tallyra", "Tallyra_Brand_Guidelines.pdf")
    story = [Paragraph("Tallyra Money: Brand Guidelines", h1), Paragraph("Version 2.0, November 2026. Demo document: Tallyra Money is fictional.", sub)]
    for title, paras in SECTIONS:
        story.append(Paragraph(title, h2))
        story += [Paragraph(p, body) for p in paras]
    SimpleDocTemplate(out, pagesize=A4, leftMargin=56, rightMargin=56, topMargin=56, bottomMargin=56, title="Tallyra Money Brand Guidelines", author="Tallyra Money (fictional)").build(story)
    d = os.path.join(ROOT, "demo", "tallyra")
    for name, obj in [("brand.json", BRAND), ("facts.json", FACTS), ("answer_key.json", ANSWER_KEY)]:
        json.dump(obj, open(os.path.join(d, name), "w"), ensure_ascii=False, indent=2)
    j = json.dumps(BRAND, ensure_ascii=False).replace("'", "''")
    open(os.path.join(ROOT, "supabase", "seed_tallyra.sql"), "w").write(
        "-- Third fictional demo brand (fintech). Only the brand row is seeded: the Rulebook is imported from its PDF in the app.\n"
        f"insert into public.brands (slug, name, settings) values ('tallyra', 'Tallyra Money', '{j}'::jsonb)\non conflict (slug) do update set name = excluded.name, settings = excluded.settings;\n")
    print(out, sum(len(v) for v in ANSWER_KEY.values()), "planted mistakes")

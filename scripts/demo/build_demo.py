import json, os, sys
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(__file__))
from demo_data import BRAND, RULES, FACTS, POSTS, SEVERITY_POINTS
from contrast import ratio

OUT = sys.argv[1]
IMG = os.path.join(OUT, "images")
os.makedirs(IMG, exist_ok=True)
FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_R = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
rule_by_id = {r["id"]: r for r in RULES}

# ---------- images ----------
def make_image(path, spec):
    W = H = 1080
    im = Image.new("RGB", (W, H), spec["bg"])
    d = ImageDraw.Draw(im)
    font = ImageFont.truetype(FONT_B, spec["size"])
    heights = [d.textbbox((0, 0), l, font=font) for l in spec["lines"]]
    total = sum(b[3] - b[1] for b in heights) + 40 * (len(heights) - 1)
    y = (H - total) // 2
    if spec.get("accent"):
        d.rectangle([140, y - 70, W - 140, y - 58], fill=spec["accent"])
    for line, b in zip(spec["lines"], heights):
        w = b[2] - b[0]
        d.text(((W - w) // 2, y), line, font=font, fill=spec["fg"])
        y += (b[3] - b[1]) + 40
    if spec.get("accent"):
        d.rectangle([140, y + 30, W - 140, y + 42], fill=spec["accent"])
    im.save(path)

for p in POSTS:
    for img in p["images"]:
        make_image(os.path.join(IMG, img["file"]), img["spec"])
        img["contrast_ratio"] = round(ratio(img["spec"]["fg"], img["spec"]["bg"]), 2)

# ---------- JSON ----------
def dump(name, data):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

dump("brand.json", BRAND)
dump("rules.json", RULES)
dump("facts.json", FACTS)

posts_out, key_out = [], []
for p in POSTS:
    posts_out.append({k: p[k] for k in ("id", "title", "channel", "post_type", "product", "partner", "caption")} |
                     {"images": [{"file": f"images/{i['file']}", "alt_text": i["alt_text"]} for i in p["images"]]})
    findings = []
    for e in p["expected"]:
        sev = rule_by_id[e["rule"]]["severity"]
        findings.append(e | {"severity": sev, "points": SEVERITY_POINTS[sev]})
    score = max(0, 100 - sum(f["points"] for f in findings))
    band = "green" if score >= 85 else "amber" if score >= 60 else "red"
    key_out.append({"post": p["id"], "title": p["title"], "expected_score": score, "band": band,
                    "expected_findings": findings, "should_not_flag": p["should_not_flag"],
                    "image_contrast": {i["file"]: i["contrast_ratio"] for i in p["images"]}})
dump("sample_posts.json", posts_out)
dump("expected_findings.json", key_out)

# ---------- guideline PDF ----------
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

pdfmetrics.registerFont(TTFont("DV", FONT_R))
pdfmetrics.registerFont(TTFont("DVB", FONT_B))
NAVY, GREEN, HONEY, CREAM = [colors.HexColor(c) for c in ("#1F2A44", "#2F5D3A", "#E8A33D", "#F5EBDD")]
H1 = ParagraphStyle("h1", fontName="DVB", fontSize=24, leading=30, textColor=GREEN, spaceAfter=6)
H2 = ParagraphStyle("h2", fontName="DVB", fontSize=15, leading=20, textColor=GREEN, spaceBefore=14, spaceAfter=6)
BODY = ParagraphStyle("b", fontName="DV", fontSize=10, leading=14.5, textColor=NAVY, spaceAfter=6)
SMALL = ParagraphStyle("s", fontName="DV", fontSize=8.5, leading=12, textColor=NAVY)
SMALLB = ParagraphStyle("sb", parent=SMALL, fontName="DVB")
COVER = ParagraphStyle("c", fontName="DVB", fontSize=34, leading=42, textColor=GREEN)
SUB = ParagraphStyle("sub", fontName="DV", fontSize=14, leading=20, textColor=NAVY)

def esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

story = [Spacer(1, 70 * mm), Paragraph("Oatvia Foods", COVER), Paragraph("Brand Guidelines", COVER), Spacer(1, 6 * mm),
         Paragraph(f"{BRAND['tagline']}  ·  Version 3.0  ·  November 2026", SUB), Spacer(1, 4 * mm),
         Paragraph("Demo brand created for the BrandSentinel prototype. Oatvia Foods is fictional.", SMALL), PageBreak()]

story += [Paragraph("Who we are", H1),
          Paragraph("Oatvia Foods makes simple, high-protein snacks from whole-grain oats grown in India. We were founded in 2023 in Pune. Our products: Oatvia ProBar (Choco Almond and Peanut Butter) and Oatvia Oat Milk.", BODY),
          Paragraph("Everyone who writes for Oatvia (our team, agencies, partners and AI tools) must follow these guidelines. Every post is checked before it goes live.", BODY)]

sections = [("Voice and tone", "tone"), ("Words and names", "words"), ("Claims", "claims"),
            ("Visual identity", "visuals"), ("Readability and accessibility", "readability")]
for title, cat in sections:
    story.append(Paragraph(title, H2))
    if cat == "visuals":
        rows = [[Paragraph("<b>Colour</b>", SMALLB), Paragraph("<b>Hex</b>", SMALLB), Paragraph("<b>Use</b>", SMALLB), ""]]
        for c in BRAND["palette"]:
            rows.append([Paragraph(c["name"], SMALL), Paragraph(c["hex"], SMALL), Paragraph(esc(c["use"]), SMALL), ""])
        t = Table(rows, colWidths=[32 * mm, 22 * mm, 100 * mm, 14 * mm])
        st = [("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#C8C2B8")), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]
        for i, c in enumerate(BRAND["palette"], 1):
            st.append(("BACKGROUND", (3, i), (3, i), colors.HexColor(c["hex"])))
        t.setStyle(TableStyle(st))
        story += [t, Spacer(1, 4 * mm)]
    for r in [r for r in RULES if r["category"] == cat]:
        story.append(Paragraph(esc(r["guideline"]), BODY))
        ex = Table([[Paragraph("<b>Do:</b> " + esc(r["good"]), SMALL), Paragraph("<b>Don't:</b> " + esc(r["bad"]), SMALL)]],
                   colWidths=[84 * mm, 84 * mm])
        ex.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#E3EEE5")),
                                ("BACKGROUND", (1, 0), (1, 0), colors.HexColor("#F8E3DF")),
                                ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 6),
                                ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
        story += [ex, Spacer(1, 3 * mm)]

story += [PageBreak(), Paragraph("Approved facts (November 2026)", H1),
          Paragraph("Only these facts may be used in content. Each has a source and an end date. After the end date, the fact can no longer be used.", BODY)]
rows = [[Paragraph(f"<b>{h}</b>", SMALLB) for h in ("ID", "Product", "Fact", "Source", "Valid until")]]
for f in FACTS:
    rows.append([Paragraph(f["id"], SMALL), Paragraph(esc(f["product"]), SMALL), Paragraph(esc(f["fact"]), SMALL),
                 Paragraph(esc(f["source"]), SMALL), Paragraph(f["valid_until"], SMALL)])
t = Table(rows, colWidths=[11 * mm, 32 * mm, 66 * mm, 34 * mm, 24 * mm], repeatRows=1)
t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#C8C2B8")),
                       ("BACKGROUND", (0, 0), (-1, 0), CREAM), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
story.append(t)

def page_deco(c, doc):
    c.saveState()
    c.setFillColor(HONEY); c.rect(0, A4[1] - 6 * mm, A4[0], 6 * mm, fill=1, stroke=0)
    if doc.page > 1:
        c.setFont("DV", 8); c.setFillColor(NAVY)
        c.drawString(18 * mm, 10 * mm, "Oatvia Foods · Brand Guidelines v3.0")
        c.drawRightString(A4[0] - 18 * mm, 10 * mm, str(doc.page))
    c.restoreState()

SimpleDocTemplate(os.path.join(OUT, "Oatvia_Brand_Guidelines.pdf"), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                  topMargin=18 * mm, bottomMargin=18 * mm, title="Oatvia Foods Brand Guidelines",
                  author="Oatvia Foods (demo)").build(story, onFirstPage=page_deco, onLaterPages=page_deco)

for k in key_out:
    print(k["post"], k["expected_score"], k["band"], len(k["expected_findings"]), k["image_contrast"])

# ---------- reference image analysis (what the browser analysis should produce) ----------
from collections import Counter
analysis = {}
for p in POSTS:
    for img in p["images"]:
        spec = img["spec"]
        im = Image.open(os.path.join(IMG, img["file"])).convert("RGB")
        counts = Counter(im.get_flattened_data() if hasattr(im, "get_flattened_data") else im.getdata()); total = im.width * im.height
        dominant = [{"hex": "#%02X%02X%02X" % c, "share": round(n / total, 3)} for c, n in counts.most_common(3) if n / total >= 0.01]
        analysis[img["file"]] = {
            "ocr_text": "\n".join(spec["lines"]),
            "lines": [{"text": l, "contrast": round(ratio(spec["fg"], spec["bg"]), 2), "fg": spec["fg"].upper(), "bg": spec["bg"].upper(), "large": True} for l in spec["lines"]],
            "dominant": dominant,
        }
dump("image_analysis.json", analysis)

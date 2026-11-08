"""Builds public/demo/Oatvia_Social_Addendum.pdf: a short second guidelines document
used to demo "Import rules from PDF". It mixes new checkable rules, two rules the Rulebook
already has (to show duplicate detection) and text that isn't a rule (to show it's skipped)."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

NAVY, GREEN, GREY = HexColor("#1F2A44"), HexColor("#2F5D3A"), HexColor("#5B6475")
h1 = ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=20, textColor=NAVY, spaceAfter=4)
sub = ParagraphStyle("sub", fontName="Helvetica", fontSize=10, textColor=GREY, spaceAfter=14)
h2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=13, textColor=GREEN, spaceBefore=10, spaceAfter=4)
body = ParagraphStyle("body", fontName="Helvetica", fontSize=10.5, leading=15, textColor=NAVY, spaceAfter=5)

S = [
    Paragraph("Oatvia Foods: Social Media Addendum", h1),
    Paragraph("Adds to Brand Guidelines v3.0 · November 2026 · Demo document: Oatvia Foods is fictional.", sub),
    Paragraph("Why this addendum", h2),
    Paragraph("This addendum was written after the Q3 social media review. The social team meets every Monday to plan the week's posts, and these points came up most often.", body),
    Paragraph("Children", h2),
    Paragraph("Never present Oatvia products as a snack for children under 12, and never show a child eating a ProBar without an adult in the picture.", body),
    Paragraph("Festivals", h2),
    Paragraph("Festive posts may wish followers a happy festival, but must not show our products as part of a religious ritual or offering.", body),
    Paragraph("Festive posts should name the festival correctly and wish everyone, not one community only.", body),
    Paragraph("Links and shopping", h2),
    Paragraph("Every call to action must send people to oatvia.in. Don't link to third-party marketplaces in captions.", body),
    Paragraph("Don't mention or tag competitor brands by name in any post.", body),
    Paragraph("Caption length and layout", h2),
    Paragraph("Instagram captions should stay under 220 characters so the main message shows before the 'more' cut-off.", body),
    Paragraph("Put the product name in the first sentence of every product post.", body),
    Paragraph("Logo", h2),
    Paragraph("The Oatvia logo must never be stretched, rotated or recoloured, and must sit on a plain area of the image.", body),
    Paragraph("Reminders from the main guidelines", h2),
    Paragraph("Never call any Oatvia product 'the best' or 'No. 1' unless an approved fact supports it.", body),
    Paragraph("Every image we publish must include alt text for screen readers.", body),
    Paragraph("Questions about this addendum go to the brand team on the #brand channel.", body),
]
SimpleDocTemplate("public/demo/Oatvia_Social_Addendum.pdf", pagesize=A4, leftMargin=56, rightMargin=56, topMargin=56, bottomMargin=56,
                  title="Oatvia Social Media Addendum", author="Oatvia Foods (fictional)").build(S)
print("ok")

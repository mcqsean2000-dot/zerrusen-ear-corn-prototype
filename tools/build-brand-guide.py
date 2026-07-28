from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "theos-farm-brand-guidelines.pdf"
PRIMARY = ROOT / "assets" / "brand" / "theos-farm-primary-logo-concept.png"
BADGE = ROOT / "assets" / "brand" / "theos-farm-badge-logo.png"
PRODUCT = ROOT / "assets" / "theos-both-bags.jpg"

W, H = letter
M = 48

COLORS = {
    "forest": HexColor("#30451F"),
    "harvest": HexColor("#CF9418"),
    "soil": HexColor("#4A2E18"),
    "parchment": HexColor("#F1DFC0"),
    "cream": HexColor("#FBF5E9"),
    "charcoal": HexColor("#2B251E"),
}


def image_cover(c, path, x, y, w, h):
    with Image.open(path) as im:
        iw, ih = im.size
    scale = max(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    c.saveState()
    clip = c.beginPath()
    clip.rect(x, y, w, h)
    c.clipPath(clip, stroke=0, fill=0)
    c.drawImage(ImageReader(str(path)), x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, mask="auto")
    c.restoreState()


def image_contain(c, path, x, y, w, h):
    with Image.open(path) as im:
        iw, ih = im.size
    scale = min(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    c.drawImage(ImageReader(str(path)), x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, mask="auto")


def footer(c, page):
    c.setStrokeColor(HexColor("#D4B77E"))
    c.line(M, 30, W - M, 30)
    c.setFillColor(COLORS["soil"])
    c.setFont("Helvetica-Bold", 8)
    c.drawString(M, 18, "THEO'S FARM BRAND GUIDELINES")
    c.setFont("Helvetica", 8)
    c.drawRightString(W - M, 18, f"{page:02d}")


def heading(c, title, subtitle=None):
    c.setFillColor(COLORS["forest"])
    c.setFont("Helvetica-Bold", 25)
    c.drawString(M, H - 68, title)
    if subtitle:
        c.setFillColor(COLORS["soil"])
        c.setFont("Helvetica", 11)
        c.drawString(M, H - 88, subtitle)


def para(c, text, x, y, width, leading=16, size=10.5, color=None):
    c.setFillColor(color or COLORS["charcoal"])
    c.setFont("Helvetica", size)
    words = text.split()
    lines, line = [], ""
    for word in words:
        proposed = f"{line} {word}".strip()
        if c.stringWidth(proposed, "Helvetica", size) <= width:
            line = proposed
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    for item in lines:
        c.drawString(x, y, item)
        y -= leading
    return y


c = canvas.Canvas(str(OUT), pagesize=letter)
c.setTitle("Theo's Farm Brand Guidelines")

# 1 - Cover
c.setFillColor(COLORS["parchment"])
c.rect(0, 0, W, H, fill=1, stroke=0)
image_cover(c, PRODUCT, W * 0.56, 0, W * 0.44, H)
c.setFillColor(COLORS["forest"])
c.rect(0, 0, 14, H, fill=1, stroke=0)
c.setFillColor(COLORS["soil"])
c.setFont("Helvetica-Bold", 13)
c.drawString(M, H - 66, "THEO'S FARM")
c.setFillColor(COLORS["forest"])
c.setFont("Helvetica-Bold", 36)
c.drawString(M, H - 132, "Brand")
c.drawString(M, H - 174, "Guidelines")
c.setFillColor(COLORS["harvest"])
c.rect(M, H - 198, 190, 5, fill=1, stroke=0)
c.setFillColor(COLORS["soil"])
c.setFont("Helvetica", 13)
c.drawString(M, H - 230, "Whole ear corn. Farm to feeder.")
c.setFont("Helvetica-Bold", 10)
c.drawString(M, 58, "VERSION 1.0  /  JULY 2026")
c.showPage()

# 2 - Brand foundation
heading(c, "Brand foundation", "A heritage farm identity grounded in the actual product.")
c.setFillColor(COLORS["cream"])
c.roundRect(M, 430, W - 2 * M, 235, 14, fill=1, stroke=0)
c.setFillColor(COLORS["forest"])
c.setFont("Helvetica-Bold", 19)
c.drawString(70, 625, "Position")
para(c, "Theo's Farm brings cleaned whole ear corn from a family farm directly to wildlife feeders. The brand should feel honest, established, practical, and unmistakably agricultural.", 70, 596, 445, 18, 11.5)
c.setFillColor(COLORS["harvest"])
c.rect(70, 525, 72, 4, fill=1, stroke=0)
c.setFillColor(COLORS["soil"])
c.setFont("Helvetica-Bold", 12)
c.drawString(70, 496, "BRAND PROMISE")
para(c, "Real whole ears. Real farm handling. Straightforward choices in 20 lb and 40 lb bags.", 70, 473, 445, 17, 11)

pillars = [
    ("REAL PRODUCT", "Show actual white bags and whole ears of corn on the cob."),
    ("FARM HERITAGE", "Use confident vintage forms without pretending the package is something it is not."),
    ("PRACTICAL TRUST", "Favor clear facts, readable labels, and direct farm-to-feeder language."),
]
yy = 370
for title, body in pillars:
    c.setFillColor(COLORS["forest"])
    c.circle(69, yy + 2, 6, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(88, yy, title)
    para(c, body, 88, yy - 20, 425, 15, 10.5)
    yy -= 86
footer(c, 2)
c.showPage()

# 3 - Logo system
heading(c, "Logo system", "Use the detailed mark for storytelling and the badge for small spaces.")
c.setFillColor(COLORS["cream"])
c.roundRect(M, 350, 265, 340, 14, fill=1, stroke=0)
image_contain(c, PRIMARY, 68, 375, 225, 290)
c.setFillColor(COLORS["soil"])
c.setFont("Helvetica-Bold", 11)
c.drawString(70, 365, "PRIMARY HERITAGE LOCKUP")

c.setFillColor(COLORS["cream"])
c.roundRect(329, 350, 215, 340, 14, fill=1, stroke=0)
image_contain(c, BADGE, 351, 405, 170, 240)
c.setFillColor(COLORS["soil"])
c.setFont("Helvetica-Bold", 11)
c.drawString(351, 365, "COMPACT BADGE")

c.setFillColor(COLORS["forest"])
c.setFont("Helvetica-Bold", 14)
c.drawString(M, 305, "Clear space")
para(c, "Keep open space around either logo equal to the height of one EAR CORN capital letter. Do not place text, photos, or borders inside that area.", M, 281, 496, 16, 10.5)
c.setFont("Helvetica-Bold", 14)
c.setFillColor(COLORS["forest"])
c.drawString(M, 220, "Minimum size")
para(c, "Primary lockup: 180 px digital or 1.75 in print. Badge: 64 px digital or 0.65 in print. Below those sizes, use only the corn emblem.", M, 196, 496, 16, 10.5)
c.setFont("Helvetica-Bold", 14)
c.setFillColor(COLORS["forest"])
c.drawString(M, 135, "Naming")
para(c, "Always write the public brand as Theo's Farm, with the apostrophe and a space. Use theosfarm.com only for the web address.", M, 111, 496, 16, 10.5)
footer(c, 3)
c.showPage()

# 4 - Color
heading(c, "Color palette", "Warm, agricultural, and readable.")
swatches = [
    ("FIELD FOREST", "#30451F", "Primary wordmark, line art"),
    ("HARVEST GOLD", "#CF9418", "Corn, rules, highlights"),
    ("SOIL BROWN", "#4A2E18", "EAR CORN, body accents"),
    ("WARM PARCHMENT", "#F1DFC0", "Primary brand background"),
    ("CREAM", "#FBF5E9", "Clean layouts and breathing room"),
    ("CHARCOAL", "#2B251E", "Long-form copy"),
]
yy = 635
for name, value, use in swatches:
    color = HexColor(value)
    c.setFillColor(color)
    c.roundRect(M, yy - 34, 76, 54, 8, fill=1, stroke=0)
    c.setFillColor(COLORS["charcoal"])
    c.setFont("Helvetica-Bold", 12)
    c.drawString(144, yy + 3, name)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(144, yy - 15, value)
    c.setFont("Helvetica", 10)
    c.drawString(235, yy - 15, use)
    yy -= 88
c.setFillColor(COLORS["forest"])
c.setFont("Helvetica-Bold", 12)
c.drawString(M, 95, "ACCESSIBILITY")
para(c, "Use forest, soil, or charcoal text on parchment and cream. Reserve harvest gold for large type, icons, rules, and highlights - not small body copy.", M, 73, 496, 15, 9.8)
footer(c, 4)
c.showPage()

# 5 - Typography and voice
heading(c, "Typography and voice", "The logo script is artwork; supporting type should stay simple.")
c.setFillColor(COLORS["forest"])
c.setFont("Helvetica-Bold", 18)
c.drawString(M, 650, "Logo script")
para(c, "Do not retype or recreate the Theo's Farm wordmark. Use the supplied logo artwork. For campaign accents only, use a licensed heritage script with similar confidence - never for paragraphs.", M, 625, 496, 16, 10.5)
c.setFillColor(COLORS["soil"])
c.setFont("Helvetica-Bold", 38)
c.drawString(M, 535, "EAR CORN")
c.setFont("Helvetica-Bold", 11)
c.drawString(M, 508, "HEADLINES: ROBOTO SLAB CONDENSED BOLD")
c.setFillColor(COLORS["charcoal"])
c.setFont("Helvetica", 18)
c.drawString(M, 445, "Whole ear corn from our farm to your feeder.")
c.setFont("Helvetica-Bold", 11)
c.drawString(M, 418, "BODY: INTER REGULAR / SEMIBOLD")

c.setFillColor(COLORS["cream"])
c.roundRect(M, 155, W - 2 * M, 200, 14, fill=1, stroke=0)
c.setFillColor(COLORS["forest"])
c.setFont("Helvetica-Bold", 13)
c.drawString(70, 320, "VOICE: NATURAL, SPECIFIC, USEFUL")
voice = [
    "Say whole ears of corn on the cob - not loose kernels.",
    "Use farm-to-feeder language without exaggerated claims.",
    "Name the 20 lb and 40 lb options when useful.",
    "Sound like a working family farm, not a national feed conglomerate.",
    "End social posts with a clear invitation to visit theosfarm.com.",
]
yy = 290
for item in voice:
    c.setFillColor(COLORS["harvest"])
    c.circle(75, yy + 2, 3.5, fill=1, stroke=0)
    c.setFillColor(COLORS["charcoal"])
    c.setFont("Helvetica", 10.5)
    c.drawString(88, yy, item)
    yy -= 28
footer(c, 5)
c.showPage()

# 6 - Photography and applications
heading(c, "Photography and applications", "The logo can be nostalgic. The product photography must be literal.")
image_cover(c, PRODUCT, M, 410, 265, 275)
c.setFillColor(COLORS["cream"])
c.roundRect(329, 410, 215, 275, 14, fill=1, stroke=0)
image_contain(c, BADGE, 352, 450, 170, 195)
c.setFillColor(COLORS["soil"])
c.setFont("Helvetica-Bold", 10)
c.drawCentredString(436, 430, "SOCIAL PROFILE BADGE")

c.setFillColor(COLORS["forest"])
c.setFont("Helvetica-Bold", 14)
c.drawString(M, 365, "Always show")
para(c, "Actual white bags, actual whole ears, real shipping boxes, and real farm handling whenever a visual represents the purchasable product.", M, 342, 496, 16, 10.5)
c.setFillColor(COLORS["forest"])
c.setFont("Helvetica-Bold", 14)
c.drawString(M, 275, "Never imply")
para(c, "Do not put the logo on a fictional brown retail bag and present it as product photography. Do not show loose kernels as the item being sold. Do not alter ear size, fill, or color to make unsupported quality claims.", M, 252, 496, 16, 10.5)

c.setFillColor(COLORS["cream"])
c.roundRect(M, 92, W - 2 * M, 105, 14, fill=1, stroke=0)
c.setFillColor(COLORS["soil"])
c.setFont("Helvetica-Bold", 11)
c.drawString(70, 168, "SOCIAL TEMPLATE")
c.setFont("Helvetica", 10.5)
c.drawString(70, 145, "Left or top: logo / short hook")
c.drawString(70, 125, "Right or bottom: unaltered real product photo")
c.drawString(310, 145, "Caption: practical farm voice")
c.drawString(310, 125, "CTA: Visit theosfarm.com")
footer(c, 6)
c.showPage()

c.save()
print(OUT)

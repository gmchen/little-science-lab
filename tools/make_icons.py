"""Draw the placeholder app icons (a blast cell on cream) into public/.

Usage: python tools/make_icons.py   (needs Pillow)
"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public"
SS = 4  # supersampling for smooth edges


def icon(size):
    s = size * SS
    img = Image.new("RGB", (s, s), "#fdf3e3")
    d = ImageDraw.Draw(img)
    c = s / 2
    r = s * 0.34
    d.ellipse([c - r, c - r, c + r, c + r], fill="#aed0ef")  # thin blue cytoplasm
    nr = r * 0.88
    d.ellipse([c - nr - r * 0.04, c - nr, c + nr - r * 0.04, c + nr], fill="#6f3a8c")  # nucleus
    n2 = r * 0.2
    d.ellipse([c + r * 0.1 - n2, c + r * 0.3 - n2, c + r * 0.1 + n2, c + r * 0.3 + n2], fill="#8a5aa6")  # nucleolus
    return img.resize((size, size), Image.LANCZOS)


OUT.mkdir(exist_ok=True)
for name, size in [("icon-192.png", 192), ("icon-512.png", 512), ("apple-touch-icon.png", 180)]:
    icon(size).save(OUT / name)
    print("wrote", name)

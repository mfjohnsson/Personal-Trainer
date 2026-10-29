"""Generates the PNG icons. Run: python tools/make-icons.py"""
from PIL import Image, ImageDraw
import os

BG = (46, 111, 208)      # --c-vikt
FG = (255, 255, 255)
OUT = os.path.join(os.path.dirname(__file__), "..", "icons")
SS = 4  # supersampling


def draw(size, safe):
    """safe = fraction of the canvas the glyph may occupy (maskable needs ~0.6)."""
    s = size * SS
    img = Image.new("RGB", (s, s), BG)
    d = ImageDraw.Draw(img)
    u = s * safe / 10.0          # glyph grid: 10 x 10 units centred
    ox = oy = s * (1 - safe) / 2

    def R(x0, y0, x1, y1, r=0):
        d.rounded_rectangle([ox + x0 * u, oy + y0 * u, ox + x1 * u, oy + y1 * u], radius=r * u, fill=FG)

    # dumbbell
    R(3.2, 4.4, 6.8, 5.6)            # bar
    R(1.6, 2.6, 2.8, 7.4, 0.4)       # outer plates
    R(7.2, 2.6, 8.4, 7.4, 0.4)
    R(2.8, 3.3, 3.8, 6.7, 0.3)       # inner plates
    R(6.2, 3.3, 7.2, 6.7, 0.3)
    return img.resize((size, size), Image.LANCZOS)


os.makedirs(OUT, exist_ok=True)
draw(192, 0.82).save(os.path.join(OUT, "icon-192.png"))
draw(512, 0.82).save(os.path.join(OUT, "icon-512.png"))
draw(512, 0.60).save(os.path.join(OUT, "icon-maskable-512.png"))
print("ok")

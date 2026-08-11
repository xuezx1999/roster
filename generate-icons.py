from PIL import Image, ImageDraw, ImageFont
import os

# Icon design: light gray background (#EFEFEF), black "[●]"
# "[" / "]" rendered with monospace font, the dot drawn as an ellipse
# (avoids relying on the font having the U+25CF glyph).
bg_color = (239, 239, 239)  # #EFEFEF
ink_color = (26, 26, 26)    # #1A1A1A

# Try to use a monospace font, fallback to default
font_paths = [
    "/System/Library/Fonts/Menlo.ttc",
    "/System/Library/Fonts/Monaco.dfont",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
]


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                return ImageFont.truetype(fp, size)
            except Exception:
                pass
    return ImageFont.load_default()


def render(canvas_size: int, font: ImageFont.FreeTypeFont | ImageFont.ImageFont) -> Image.Image:
    img = Image.new('RGB', (canvas_size, canvas_size), bg_color)
    draw = ImageDraw.Draw(img)

    # Measure "[" (monospace: same width as "]")
    lbb = draw.textbbox((0, 0), "[", font=font)
    lw = lbb[2] - lbb[0]
    lh = lbb[3] - lbb[1]

    dot_d = int(lw * 0.95)           # solid dot diameter
    gap = max(int(lw * 0.18), 2)     # gap between bracket and dot
    total = lw + gap + dot_d + gap + lw
    x0 = (canvas_size - total) // 2
    y0 = (canvas_size - lh) // 2

    draw.text((x0, y0), "[", fill=ink_color, font=font)
    dot_left = x0 + lw + gap
    dot_top = y0 + (lh - dot_d) // 2
    draw.ellipse([dot_left, dot_top, dot_left + dot_d, dot_top + dot_d], fill=ink_color)
    draw.text((dot_left + dot_d + gap, y0), "]", fill=ink_color, font=font)
    return img


# Generate 512x512
img_512 = render(512, load_font(180))
img_512.save("public/icon-512.png")

# Generate 192x192
img_192 = render(192, load_font(68))
img_192.save("public/icon-192.png")

print("Icons generated")

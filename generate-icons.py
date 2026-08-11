from PIL import Image, ImageDraw, ImageFont
import os

# Icon design: warm white background (#F5F2ED), near-black "R" text
bg_color = (242, 242, 242)  # #F2F2F2
text_color = (26, 26, 26)   # #1A1A1A

# Try to use a monospace font, fallback to default
font_paths = [
    "/System/Library/Fonts/Menlo.ttc",
    "/System/Library/Fonts/Monaco.dfont",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
]

font = None
for fp in font_paths:
    if os.path.exists(fp):
        try:
            font = ImageFont.truetype(fp, 280)  # for 512x512
            break
        except:
            pass

if font is None:
    font = ImageFont.load_default()

# Generate 512x512
img_512 = Image.new('RGB', (512, 512), bg_color)
draw = ImageDraw.Draw(img_512)

text = "R"
# Use textbbox to center
bbox = draw.textbbox((0, 0), text, font=font)
text_w = bbox[2] - bbox[0]
text_h = bbox[3] - bbox[1]
x = (512 - text_w) // 2
y = (512 - text_h) // 2 - 20  # slight visual adjustment

draw.text((x, y), text, fill=text_color, font=font)
img_512.save("public/icon-512.png")

# Generate 192x192
if font:
    font_small = font.font_variant(size=105)
else:
    font_small = font

img_192 = Image.new('RGB', (192, 192), bg_color)
draw2 = ImageDraw.Draw(img_192)

bbox2 = draw2.textbbox((0, 0), text, font=font_small)
text_w2 = bbox2[2] - bbox2[0]
text_h2 = bbox2[3] - bbox2[1]
x2 = (192 - text_w2) // 2
y2 = (192 - text_h2) // 2 - 8

draw2.text((x2, y2), text, fill=text_color, font=font_small)
img_192.save("public/icon-192.png")

print("Icons generated")

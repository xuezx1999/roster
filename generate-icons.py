from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
import os

# Icon design: light gray background (#EFEFEF), black "[●]"
# "[" / "]" rendered with monospace font, the dot drawn as an ellipse
# (avoids relying on the font having the U+25CF glyph).
#
# v2: the subject gets a subtle top->bottom dark gradient and a soft drop
# shadow for a restrained sense of depth, while staying minimal.
bg_color = (239, 239, 239)        # #EFEFEF
ink_top = (74, 74, 74)            # gradient top (lighter)
ink_bottom = (16, 16, 16)         # gradient bottom (darker)
shadow_gray = (150, 150, 150)     # shadow tint on the light bg
shadow_strength = 0.42            # how dark the shadow reads

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


def make_gradient(size: int, top, bottom) -> Image.Image:
    g = Image.new('RGB', (size, size))
    px = g.load()
    for y in range(size):
        t = y / (size - 1)
        r = int(top[0] + (bottom[0] - top[0]) * t)
        gg = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        row = (r, gg, b)
        for x in range(size):
            px[x, y] = row
    return g


def subject_mask(canvas: int, font) -> Image.Image:
    """White-on-transparent mask of the vertically centered "[●]" subject."""
    lbb = ImageDraw.Draw(Image.new('RGBA', (canvas, canvas))).textbbox(
        (0, 0), "[", font=font, anchor="mm")
    lw = lbb[2] - lbb[0]
    dot_d = int(lw * 0.95)           # solid dot diameter
    gap = max(int(lw * 0.18), 2)     # gap between bracket and dot
    total = lw + gap + dot_d + gap + lw
    cx = canvas // 2
    cy = canvas // 2                 # shared vertical center for dot AND brackets
    x0 = (canvas - total) // 2
    left_bx = x0 + lw / 2
    dot_left = x0 + lw + gap
    right_bx = x0 + lw + gap + dot_d + gap + lw / 2

    # Brackets drawn with anchor "mm" so their ink is vertically centered on cy,
    # matching the dot's center exactly.
    subj = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
    sd = ImageDraw.Draw(subj)
    sd.text((left_bx, cy), "[", fill=(255, 255, 255, 255), font=font, anchor="mm")
    dot_top = cy - dot_d / 2
    sd.ellipse([dot_left, dot_top, dot_left + dot_d, dot_top + dot_d],
               fill=(255, 255, 255, 255))
    sd.text((right_bx, cy), "]", fill=(255, 255, 255, 255), font=font, anchor="mm")
    return subj


def render(canvas: int, font) -> Image.Image:
    subj = subject_mask(canvas, font)
    mask = subj.split()[3]

    # soft drop shadow: blur the mask, tint, offset down-right
    blur_r = max(2, int(canvas * 0.016))
    off = max(2, int(canvas * 0.012))
    sh = subj.filter(ImageFilter.GaussianBlur(blur_r))
    sh_rgba = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
    sp = sh_rgba.load()
    bp = sh.load()
    for y in range(canvas):
        for x in range(canvas):
            a = bp[x, y][3]
            if a > 0:
                sp[x, y] = (shadow_gray[0], shadow_gray[1], shadow_gray[2],
                            int(a * shadow_strength))
    sh_rgba = ImageChops.offset(sh_rgba, off, off)

    base = Image.new('RGB', (canvas, canvas), bg_color).convert('RGBA')
    base = Image.alpha_composite(base, sh_rgba)

    # gradient-filled subject on top
    grad = make_gradient(canvas, ink_top, ink_bottom)
    subj_rgb = Image.composite(grad, Image.new('RGB', (canvas, canvas), (0, 0, 0)), mask)
    subj_rgba = subj_rgb.convert('RGBA')
    subj_rgba.putalpha(mask)
    out = Image.alpha_composite(base, subj_rgba).convert('RGB')
    return out


# Generate 512x512
img_512 = render(512, load_font(180))
img_512.save("public/icon-512.png")

# Generate 192x192
img_192 = render(192, load_font(68))
img_192.save("public/icon-192.png")

print("Icons generated (v2: gradient + soft shadow)")

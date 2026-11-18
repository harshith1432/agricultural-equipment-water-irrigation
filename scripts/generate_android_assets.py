import os
import math
from PIL import Image, ImageDraw, ImageFont

# Brand Palette
COLOR_BG = (247, 244, 235, 255)       # Creamy Light Oat / Linen #F7F4EB
COLOR_FOREST = (30, 70, 42, 255)      # Forest Green #1E462A
COLOR_DARK_FOREST = (21, 51, 30, 255) # Darker Forest #15331E
COLOR_EMERALD = (16, 185, 129, 255)   # Emerald Glow #10B981
COLOR_CYAN = (6, 182, 212, 255)       # Cyan Flow #06B6D4
COLOR_AMBER = (217, 119, 6, 255)      # Amber Glow #D97706
COLOR_TEXT_SUB = (56, 102, 65, 255)   # Subtitle Green #386641
COLOR_TEXT_MUTED = (100, 116, 139, 255) # Muted Slate

def get_font(size, bold=False):
    font_paths = [
        "C:\\Windows\\Fonts\\segoeuib.ttf" if bold else "C:\\Windows\\Fonts\\segoeui.ttf",
        "C:\\Windows\\Fonts\\arialbd.ttf" if bold else "C:\\Windows\\Fonts\\arial.ttf",
    ]
    for p in font_paths:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()

def draw_agrispectra_emblem(draw, cx, cy, radius, is_foreground_only=False):
    """
    Draws the precision agriculture AgriSpectra emblem centered at (cx, cy)
    with total visual radius 'radius'.
    """
    # Outer spectral / wave rings
    if not is_foreground_only:
        r_outer = radius * 1.05
        draw.ellipse([cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer],
                     outline=(16, 185, 129, 60), width=max(2, int(radius * 0.03)))
    
    # Mid sensor wave ring
    r_mid = radius * 0.88
    draw.ellipse([cx - r_mid, cy - r_mid, cx + r_mid, cy + r_mid],
                 outline=(6, 182, 212, 90), width=max(2, int(radius * 0.025)))

    # Main Leaf & Water Droplet Silhouette
    leaf_h = radius * 1.25
    leaf_w = radius * 0.85
    top_y = cy - leaf_h * 0.52
    bottom_y = cy + leaf_h * 0.48
    
    # Generate points for leaf/droplet shape
    pts_left = []
    pts_right = []
    steps = 40
    for i in range(steps + 1):
        t = i / steps
        y = top_y + t * (bottom_y - top_y)
        w = leaf_w * math.sin(t * math.pi) * (0.8 + 0.4 * t)
        pts_left.append((cx - w, y))
        pts_right.append((cx + w, y))
        
    pts = [(cx, top_y)] + pts_left + [(cx, bottom_y)] + list(reversed(pts_right))
    
    # Draw leaf body in Forest Green
    draw.polygon(pts, fill=COLOR_FOREST)
    
    # Secondary inner Emerald gradient layer
    inner_pts = []
    for i in range(steps + 1):
        t = i / steps
        y = top_y + t * (bottom_y - top_y)
        w_inner = (leaf_w * 0.85) * math.sin(t * math.pi) * (0.8 + 0.4 * t)
        inner_pts.append((cx + w_inner * 0.8, y))
    half_pts = [(cx, top_y + leaf_h * 0.05)] + inner_pts + [(cx, bottom_y - leaf_h * 0.05)]
    draw.polygon(half_pts, fill=COLOR_EMERALD)

    # Central Vein / Hydraulic Flow Channel
    vein_width = max(3, int(radius * 0.05))
    draw.line([(cx, top_y + leaf_h * 0.08), (cx, bottom_y - leaf_h * 0.08)],
              fill=COLOR_BG if not is_foreground_only else (247, 244, 235, 230), width=vein_width)

    # Lateral Veins / Irrigation Zone Conduits (3 on left, 3 on right = 6 zones)
    branch_count = 3
    branch_w = max(2, int(radius * 0.035))
    for i in range(1, branch_count + 1):
        frac = i / (branch_count + 1)
        vy = top_y + leaf_h * (0.2 + frac * 0.6)
        bw = leaf_w * 0.55 * math.sin(frac * math.pi)
        # Right lateral vein
        draw.line([(cx, vy), (cx + bw, vy - leaf_h * 0.08)], fill=COLOR_BG, width=branch_w)
        # Left lateral vein
        draw.line([(cx, vy + leaf_h * 0.04), (cx - bw, vy - leaf_h * 0.04)], fill=COLOR_BG, width=branch_w)

    # Water droplet reflection in bottom reservoir
    drop_cy = cy + leaf_h * 0.28
    drop_cx = cx - leaf_w * 0.22
    r_drop = radius * 0.12
    draw.ellipse([drop_cx - r_drop, drop_cy - r_drop, drop_cx + r_drop, drop_cy + r_drop],
                 fill=COLOR_CYAN)

    # Optical Spectroscopy Sensor Dot (top right)
    spec_cx = cx + radius * 0.58
    spec_cy = cy - radius * 0.45
    r_spec = radius * 0.09
    draw.ellipse([spec_cx - r_spec, spec_cy - r_spec, spec_cx + r_spec, spec_cy + r_spec],
                 fill=COLOR_AMBER)
    # Tiny sensor pulse ring
    draw.ellipse([spec_cx - r_spec * 1.8, spec_cy - r_spec * 1.8, spec_cx + r_spec * 1.8, spec_cy + r_spec * 1.8],
                 outline=(217, 119, 6, 120), width=max(1, int(radius * 0.02)))

def generate_app_icon(size, is_round=False):
    scale = 4
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    margin = int(s * 0.04)
    if is_round:
        draw.ellipse([margin, margin, s - margin, s - margin], fill=COLOR_BG)
        draw.ellipse([margin, margin, s - margin, s - margin], outline=COLOR_FOREST, width=max(2, int(s * 0.015)))
    else:
        rx = int(s * 0.22)
        draw.rounded_rectangle([margin, margin, s - margin, s - margin], radius=rx, fill=COLOR_BG)
        draw.rounded_rectangle([margin, margin, s - margin, s - margin], radius=rx, outline=COLOR_FOREST, width=max(2, int(s * 0.015)))

    cx = s // 2
    cy = s // 2
    radius = int(s * 0.36)
    draw_agrispectra_emblem(draw, cx, cy, radius)

    img = img.resize((size, size), Image.Resampling.LANCZOS)
    return img

def generate_foreground_icon(size):
    scale = 4
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx = s // 2
    cy = s // 2
    radius = int(s * 0.26)
    draw_agrispectra_emblem(draw, cx, cy, radius, is_foreground_only=True)

    img = img.resize((size, size), Image.Resampling.LANCZOS)
    return img

def generate_splash_screen(width, height):
    scale = 2
    w = width * scale
    h = height * scale
    img = Image.new("RGBA", (w, h), COLOR_BG)
    draw = ImageDraw.Draw(img)

    cx = w // 2
    cy = int(h * 0.44)
    
    # Subtle background hydraulic ripple circles
    min_dim = min(w, h)
    for r_f in [0.45, 0.65, 0.85]:
        r = int(min_dim * r_f)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r],
                     outline=(30, 70, 42, 16), width=max(1, int(min_dim * 0.006)))

    # Emblem
    radius = int(min_dim * 0.16)
    draw_agrispectra_emblem(draw, cx, cy, radius)

    # Typography
    title_font_size = max(16, int(min_dim * 0.065))
    sub_font_size = max(10, int(min_dim * 0.026))
    tag_font_size = max(8, int(min_dim * 0.018))

    font_title = get_font(title_font_size, bold=True)
    font_sub = get_font(sub_font_size, bold=True)
    font_tag = get_font(tag_font_size, bold=False)

    title_text = "AgriSpectra"
    sub_text = "FLOW  &  FIELD"
    tag_text = "LEAF SPECTROSCOPY  |  PRECISION IRRIGATION"

    tb_title = draw.textbbox((0, 0), title_text, font=font_title)
    tw_title = tb_title[2] - tb_title[0]
    title_y = cy + radius + int(min_dim * 0.07)
    draw.text((cx - tw_title // 2, title_y), title_text, fill=COLOR_FOREST, font=font_title)

    tb_sub = draw.textbbox((0, 0), sub_text, font=font_sub)
    tw_sub = tb_sub[2] - tb_sub[0]
    sub_y = title_y + (tb_title[3] - tb_title[1]) + int(min_dim * 0.025)
    draw.text((cx - tw_sub // 2, sub_y), sub_text, fill=COLOR_TEXT_SUB, font=font_sub)

    tb_tag = draw.textbbox((0, 0), tag_text, font=font_tag)
    tw_tag = tb_tag[2] - tb_tag[0]
    tag_y = sub_y + (tb_sub[3] - tb_sub[1]) + int(min_dim * 0.035)
    draw.text((cx - tw_tag // 2, tag_y), tag_text, fill=COLOR_TEXT_MUTED, font=font_tag)

    footer_text = "CONNECTED TO CLOUD FIRESTORE"
    font_footer = get_font(max(7, int(min_dim * 0.016)), bold=False)
    tb_footer = draw.textbbox((0, 0), footer_text, font=font_footer)
    tw_footer = tb_footer[2] - tb_footer[0]
    draw.text((cx - tw_footer // 2, h - int(min_dim * 0.08)), footer_text, fill=(140, 150, 140, 180), font=font_footer)

    img = img.resize((width, height), Image.Resampling.LANCZOS)
    return img

def main():
    res_base = "android/app/src/main/res"
    if not os.path.exists(res_base):
        print(f"Error: {res_base} does not exist!")
        return

    # Density configurations for launcher icons
    mipmaps = {
        "mipmap-mdpi": (48, 108),
        "mipmap-hdpi": (72, 162),
        "mipmap-xhdpi": (96, 216),
        "mipmap-xxhdpi": (144, 324),
        "mipmap-xxxhdpi": (192, 432)
    }

    print("Generating Mipmap Icons...")
    for folder, (icon_sz, fg_sz) in mipmaps.items():
        dir_path = os.path.join(res_base, folder)
        os.makedirs(dir_path, exist_ok=True)
        
        # ic_launcher.png
        icon_img = generate_app_icon(icon_sz, is_round=False)
        icon_img.save(os.path.join(dir_path, "ic_launcher.png"), "PNG")

        # ic_launcher_round.png
        round_img = generate_app_icon(icon_sz, is_round=True)
        round_img.save(os.path.join(dir_path, "ic_launcher_round.png"), "PNG")

        # ic_launcher_foreground.png
        fg_img = generate_foreground_icon(fg_sz)
        fg_img.save(os.path.join(dir_path, "ic_launcher_foreground.png"), "PNG")
        print(f"  [OK] Generated {folder}: ic_launcher ({icon_sz}x{icon_sz}), foreground ({fg_sz}x{fg_sz})")

    # Splash screens
    splash_targets = {
        "drawable": (480, 320),
        "drawable-land-mdpi": (480, 320),
        "drawable-land-hdpi": (800, 480),
        "drawable-land-xhdpi": (1280, 720),
        "drawable-land-xxhdpi": (1600, 960),
        "drawable-land-xxxhdpi": (1920, 1280),
        "drawable-port-mdpi": (320, 480),
        "drawable-port-hdpi": (480, 800),
        "drawable-port-xhdpi": (720, 1280),
        "drawable-port-xxhdpi": (960, 1600),
        "drawable-port-xxxhdpi": (1280, 1920),
    }

    print("\nGenerating Native Splash Screens...")
    for folder, (w, h) in splash_targets.items():
        dir_path = os.path.join(res_base, folder)
        os.makedirs(dir_path, exist_ok=True)
        splash_img = generate_splash_screen(w, h)
        splash_img.save(os.path.join(dir_path, "splash.png"), "PNG")
        print(f"  [OK] Generated {folder}/splash.png ({w}x{h})")

    # Also update public/icons for web/PWA
    public_icons_dir = "public/icons"
    if os.path.exists(public_icons_dir):
        print("\nUpdating PWA/Web Icons in public/icons...")
        pwa_192 = generate_app_icon(192, is_round=False)
        pwa_192.save(os.path.join(public_icons_dir, "icon-192.png"), "PNG")
        pwa_192.save(os.path.join(public_icons_dir, "icon-maskable-192.png"), "PNG")

        pwa_512 = generate_app_icon(512, is_round=False)
        pwa_512.save(os.path.join(public_icons_dir, "icon-512.png"), "PNG")
        pwa_512.save(os.path.join(public_icons_dir, "icon-maskable-512.png"), "PNG")
        print("  [OK] PWA icons updated (192x192, 512x512).")

    print("\nAll assets successfully generated!")

if __name__ == "__main__":
    main()

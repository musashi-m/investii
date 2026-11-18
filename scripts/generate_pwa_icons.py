import os
import math
from PIL import Image, ImageDraw, ImageFilter

def create_base_icon(size=2048, is_maskable=False):
    # Base canvas
    img = Image.new("RGBA", (size, size), (10, 14, 23, 255))
    draw = ImageDraw.Draw(img)

    # Gradient background
    cx, cy = size // 2, size // 2
    max_radius = size * 0.75
    
    # Draw radial glow from center
    for r in range(int(max_radius), 0, -12):
        factor = r / max_radius
        # Dark navy (#0e1726) to black (#0a0e17)
        red = int(14 * (1 - factor) + 10 * factor)
        green = int(24 * (1 - factor) + 14 * factor)
        blue = int(38 * (1 - factor) + 23 * factor)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(red, green, blue, 255))

    # Inner soft ambient glow (golden / emerald aura)
    glow_radius = int(size * 0.38)
    for r in range(glow_radius, 0, -8):
        alpha = int(22 * (1 - r / glow_radius))
        draw.ellipse([cx - r, cy - r + 30, cx + r, cy + r + 30], fill=(245, 158, 11, alpha))

    # Subtle decorative circular border inside safe zone
    ring_radius = int(size * 0.38)
    ring_color = (255, 255, 255, 18)
    draw.ellipse([cx - ring_radius, cy - ring_radius, cx + ring_radius, cy + ring_radius], 
                 outline=ring_color, width=6)

    # Financial chart bars (Growth pillars)
    # 3 rounded vertical bars representing market growth
    bar_width = int(size * 0.08)
    corner_radius = bar_width // 2
    
    bars = [
        # (center_x, top_y, bottom_y, color)
        (cx - int(size * 0.18), cy + int(size * 0.06), cy + int(size * 0.24), (16, 185, 129, 160)),
        (cx - int(size * 0.03), cy - int(size * 0.06), cy + int(size * 0.24), (16, 185, 129, 200)),
        (cx + int(size * 0.12), cy - int(size * 0.17), cy + int(size * 0.24), (16, 185, 129, 230)),
    ]

    for bx, by_top, by_bot, col in bars:
        draw.rounded_rectangle([bx - bar_width//2, by_top, bx + bar_width//2, by_bot],
                               radius=corner_radius, fill=col)

    # Dynamic trending arrow line (Golden amber)
    # Points representing a market breakout to the upside
    pts = [
        (cx - int(size * 0.26), cy + int(size * 0.16)),
        (cx - int(size * 0.10), cy + int(size * 0.02)),
        (cx + int(size * 0.04), cy + int(size * 0.07)),
        (cx + int(size * 0.24), cy - int(size * 0.21))
    ]

    line_w = int(size * 0.045)
    
    # Outer glow around the line
    for w_extra, alpha in [(16, 30), (8, 60)]:
        draw.line(pts, fill=(245, 158, 11, alpha), width=line_w + w_extra, joint="round")
        
    # Main golden line
    draw.line(pts, fill=(251, 191, 36, 255), width=line_w, joint="round")

    # Arrow head at the end
    end_x, end_y = pts[-1]
    arrow_size = int(size * 0.09)
    
    # Vector direction: roughly (-1, 1) to (0, 0) - 45 degree angle up-right
    arrow_poly = [
        (end_x + int(arrow_size * 0.5), end_y - int(arrow_size * 0.5)), # tip
        (end_x - int(arrow_size * 0.7), end_y - int(arrow_size * 0.5)), # left wing
        (end_x - int(arrow_size * 0.2), end_y - int(arrow_size * 0.0)), # inner notch
        (end_x + int(arrow_size * 0.5), end_y + int(arrow_size * 0.7)), # bottom wing
    ]
    draw.polygon(arrow_poly, fill=(251, 191, 36, 255))
    
    # Star / light burst at arrow tip
    tip_x = end_x + int(arrow_size * 0.5)
    tip_y = end_y - int(arrow_size * 0.5)
    draw.ellipse([tip_x - 16, tip_y - 16, tip_x + 16, tip_y + 16], fill=(255, 255, 255, 240))

    return img

def main():
    os.makedirs("public/icons", exist_ok=True)
    
    print("Generating base 2048x2048 canvas...")
    base_img = create_base_icon(2048, is_maskable=False)
    
    # Save target sizes
    targets = [
        ("public/icons/icon-512x512.png", 512),
        ("public/icons/icon-192x192.png", 192),
        ("public/icons/icon-maskable-512x512.png", 512),
        ("public/icons/icon-maskable-192x192.png", 192),
        ("public/icons/apple-touch-icon.png", 180),
        ("public/icons/favicon-32x32.png", 32),
        ("public/icons/favicon-16x16.png", 16),
    ]
    
    for path, sz in targets:
        resized = base_img.resize((sz, sz), Image.Resampling.LANCZOS)
        resized.save(path, format="PNG", optimize=True)
        print(f"Generated {path} ({sz}x{sz})")

    # Generate multi-size favicon.ico
    ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64)]
    ico_images = [base_img.resize(s, Image.Resampling.LANCZOS) for s in ico_sizes]
    ico_images[0].save("public/favicon.ico", format="ICO", sizes=ico_sizes)
    print("Generated public/favicon.ico with multiple sizes (16, 32, 48, 64)")

if __name__ == "__main__":
    main()


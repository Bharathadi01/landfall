#!/usr/bin/env python3
"""
Documentation asset pipeline (Pillow + ffmpeg). Everything it reads is a real screenshot captured by
scripts/capture-docs-assets.mjs; it only resizes, labels, cross-fades and compresses. It never draws UI.

  python3 scripts/docs-assets.py gif   --src <dir with PNGs> --out docs/assets/landfall-preview.gif
  python3 scripts/docs-assets.py webp  --src <dir with PNGs> --out docs/assets/screenshots

Requires: Pillow (with WebP) and ffmpeg (palettegen/paletteuse/xfade). No other dependency.
"""
import argparse, os, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont

# The preview, in the order a relief response happens. (file stem, caption shown on the frame)
SEQUENCE = [
    ("landing-page", "Public site · live 3D Earth"),
    ("command-center", "Command Center · what needs a person"),
    ("sentinel-storm-atlas", "Storm Desk · official warnings"),
    ("storm-drill", "Storm Drill · rehearse on past hurricanes"),
    ("guided-response", "Guided Response · warning to payout"),
    ("paypal-financial-operations", "Payments · PayPal status in AG Grid"),
    ("ai-watch-officer", "AI Watch Officer · cited, read-only"),
    ("resident-portal", "Resident portal · plain language"),
]
GREEN = (14, 107, 80)  # Landfall's refuge green (styles/design-tokens.css)
W, H = 1000, 625
FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]

def font(size):
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def labelled(path, caption):
    """The screenshot (cropped to the top of the page) with its caption in a strip BELOW it, so no UI is ever covered."""
    bar = 40
    shot_h = H - bar
    im = Image.open(path).convert("RGB")
    im = im.crop((0, 0, im.width, int(im.width * shot_h / W))).resize((W, shot_h), Image.LANCZOS)
    canvas = Image.new("RGB", (W, H), GREEN)
    canvas.paste(im, (0, 0))
    d = ImageDraw.Draw(canvas)
    f = font(17)
    d.text((18, shot_h + (bar - 17) // 2 - 1), caption, font=f, fill=(255, 255, 255))
    return canvas

def cmd_gif(a):
    hold, fade, fps = a.hold, a.fade, a.fps
    tmp = tempfile.mkdtemp(prefix="landfall-gif-")
    frames = []
    for i, (stem, cap) in enumerate(SEQUENCE):
        src = os.path.join(a.src, stem + ".png")
        if not os.path.exists(src):
            sys.exit(f"missing source screenshot: {src}")
        p = os.path.join(tmp, f"f{i}.png")
        labelled(src, cap).save(p)
        frames.append(p)
    n = len(frames)
    inputs = []
    for p in frames:
        inputs += ["-loop", "1", "-t", f"{hold + fade}", "-i", p]
    chain, last = [], "[0:v]"
    for i in range(1, n):
        out = f"[x{i}]"
        chain.append(f"{last}[{i}:v]xfade=transition=fade:duration={fade}:offset={i * hold}{out}")
        last = out
    chain.append(f"{last}fps={fps},split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle")
    cmd = ["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(chain), "-loop", "0", a.out]
    subprocess.run(cmd, check=True)
    total = n * hold + fade
    print(f"wrote {a.out}  {os.path.getsize(a.out)/1e6:.2f} MB  ~{total:.1f}s  {fps} fps  {W}x{H}  {n} real screens")

def cmd_webp(a):
    os.makedirs(a.out, exist_ok=True)
    total = 0
    for name in sorted(os.listdir(a.src)):
        if not name.endswith(".png"):
            continue
        im = Image.open(os.path.join(a.src, name)).convert("RGB")
        dest = os.path.join(a.out, name[:-4] + ".webp")
        im.save(dest, "WEBP", quality=a.quality, method=6)
        total += os.path.getsize(dest)
        print(f"{name:42s} {os.path.getsize(os.path.join(a.src, name))/1024:7.0f} KB -> {os.path.getsize(dest)/1024:6.0f} KB  {im.width}x{im.height}")
    print(f"total {total/1e6:.2f} MB")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    g = sub.add_parser("gif"); g.add_argument("--src", required=True); g.add_argument("--out", required=True)
    g.add_argument("--hold", type=float, default=1.0); g.add_argument("--fade", type=float, default=0.35); g.add_argument("--fps", type=int, default=12)
    w = sub.add_parser("webp"); w.add_argument("--src", required=True); w.add_argument("--out", required=True); w.add_argument("--quality", type=int, default=90)
    args = ap.parse_args()
    {"gif": cmd_gif, "webp": cmd_webp}[args.cmd](args)

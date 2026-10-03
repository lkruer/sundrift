# Tile screenshots into one contact sheet, each labelled with its file name.
#   python work/sheet.py <dir> <prefix> <out.png> [cols] [width]
import sys, os
from PIL import Image, ImageDraw, ImageFont

d, prefix, out = sys.argv[1], sys.argv[2], sys.argv[3]
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 3
tw = int(sys.argv[5]) if len(sys.argv) > 5 else 640
files = sorted(f for f in os.listdir(d) if f.startswith(prefix) and f.endswith('.png'))
order = sorted(files, key=lambda f: os.path.getmtime(os.path.join(d, f)))
ims = []
for f in order:
    im = Image.open(os.path.join(d, f)).convert('RGB')
    th = round(im.height * tw / im.width)
    ims.append((f[:-4], im.resize((tw, th), Image.LANCZOS)))
if not ims:
    sys.exit('no images')
th = max(im.height for _, im in ims)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * th), (20, 20, 20))
dr = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('arial.ttf', 22)
except Exception:
    font = ImageFont.load_default()
for i, (name, im) in enumerate(ims):
    x, y = (i % cols) * tw, (i // cols) * th
    sheet.paste(im, (x, y))
    dr.rectangle([x + 6, y + th - 34, x + 14 + 12 * len(name), y + th - 6], fill=(0, 0, 0))
    dr.text((x + 10, y + th - 32), name, fill=(255, 255, 255), font=font)
sheet.save(out)
print('sheet', out, len(ims))

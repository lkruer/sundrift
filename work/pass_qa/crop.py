# crop a region of a screenshot and scale it up: python work/pass_qa/crop.py in.png x0 y0 x1 y1 out.png [scale]
import sys
from PIL import Image
a = sys.argv
im = Image.open(a[1]); x0, y0, x1, y1 = map(int, a[2:6]); s = float(a[7]) if len(a) > 7 else 2
c = im.crop((x0, y0, x1, y1)); c = c.resize((int(c.width * s), int(c.height * s)), Image.NEAREST); c.save(a[6])

"""Critic round-two measurements for the sundrift night frames.
Regions are hand-placed per frame (1280x720) from looking at the frames.
Writes crops to critic2/crops and prints a table.
"""
import glob, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
FR = os.path.join(HERE, "frames")
CR = os.path.join(HERE, "crops")
os.makedirs(CR, exist_ok=True)

def load(p):
    return np.asarray(Image.open(p).convert("RGB")).astype(float)

def luma(a):
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]

def stats(a, box):
    x0, y0, x1, y1 = box
    r = a[y0:y1, x0:x1]
    L = luma(r)
    bmr = (r[..., 2] - r[..., 0])
    return dict(L=L.mean(), Lp95=np.percentile(L, 95), Lp5=np.percentile(L, 5),
                BmR=bmr.mean(), R=r[..., 0].mean(), G=r[..., 1].mean(), B=r[..., 2].mean())

# boxes: (x0,y0,x1,y1)
REG = {
 "f0": dict(pool=(380,400,540,540), road40=(445,322,495,338), roaddark=(60,540,300,670),
            verge=(950,330,1250,372), treefar=(1000,90,1250,240), sky=(400,5,440,190)),
 "f1": dict(pool=(720,360,880,460), road40=(860,338,940,352), roaddark=(40,520,300,600),
            verge=(1060,350,1250,420), treefar=(1010,70,1180,200), sky=(300,5,340,170)),
 "f2": dict(pool=(520,335,760,500), road40=(640,325,700,338), roaddark=(200,540,420,640),
            verge=(1050,380,1250,480), treefar=(40,80,300,280), sky=(640,5,680,180)),
 "f3": dict(pool=(700,400,800,440), road40=(380,332,450,346), roaddark=(1000,560,1200,660),
            verge=(1000,440,1250,560), treefar=(800,40,1030,230), sky=(550,5,600,200)),
 "f4": dict(pool=(760,380,900,470), road40=(600,330,680,345), roaddark=(60,560,300,660),
            verge=(1130,430,1250,500), treefar=(760,130,940,270), sky=(620,5,660,200)),
 "f5": dict(pool=(760,380,840,470), road40=(770,340,850,352), roaddark=(900,540,1200,660),
            verge=(1100,380,1250,440), treefar=(130,140,460,360), sky=(640,30,680,200)),
 "f6": dict(pool=(640,340,830,470), road40=(790,334,860,346), roaddark=(60,560,320,660),
            verge=(1000,420,1250,540), treefar=(960,225,1080,300), sky=(300,5,340,110)),
 "f7": dict(pool=(420,340,560,520), road40=(570,330,640,344), roaddark=(900,540,1200,660),
            verge=(60,440,300,560), treefar=(830,120,1060,300), sky=(700,5,760,160)),
}

print("=== GAME FRAMES (luma 0-255, BmR = B minus R in sRGB units) ===")
hdr = "%-3s %-9s %-9s %-9s %-9s %-9s %-9s | ratio pool_p95/road40"
print("%-3s %8s %8s %8s %8s %8s %8s | %s" % ("fr", "poolP95", "road40", "roadDark", "verge", "treeFar", "skyTop", "ratio"))
rows = {}
for f, R in REG.items():
    a = load(os.path.join(FR, f + ".png"))
    s = {k: stats(a, v) for k, v in R.items()}
    ratio = s["pool"]["Lp95"] / max(s["road40"]["L"], 1)
    rows[f] = (s, ratio)
    print("%-3s %8.0f %8.0f %8.0f %8.0f %8.0f %8.0f | %.2f" % (
        f, s["pool"]["Lp95"], s["road40"]["L"], s["roaddark"]["L"], s["verge"]["L"], s["treefar"]["L"],
        luma(a[5:40, R["sky"][0]:R["sky"][2]]).mean(), ratio))
print()
print("%-3s %8s %8s %8s %8s %8s %8s %8s" % ("fr", "pool", "road40", "roadDrk", "verge", "treeFar", "skyTop", "skyHor"))
for f, (s, ratio) in rows.items():
    a = load(os.path.join(FR, f + ".png"))
    x0, y0, x1, y1 = REG[f]["sky"]
    top = a[y0:y0 + 35, x0:x1]; hor = a[y1 - 35:y1, x0:x1]
    print("%-3s %8.0f %8.0f %8.0f %8.0f %8.0f %8.0f %8.0f   (B-R)" % (
        f, s["pool"]["BmR"], s["road40"]["BmR"], s["roaddark"]["BmR"], s["verge"]["BmR"], s["treefar"]["BmR"],
        (top[..., 2] - top[..., 0]).mean(), (hor[..., 2] - hor[..., 0]).mean()))

print()
print("=== SKY GRADIENT (per-row median luma down a sky column, smoothed; max step between 8-row bands) ===")
for f in REG:
    a = load(os.path.join(FR, f + ".png"))
    x0, y0, x1, y1 = REG[f]["sky"]
    col = luma(a[y0:y1, x0:x1])
    med = np.median(col, axis=1)
    # 8-row band means
    n = (len(med) // 8) * 8
    bands = med[:n].reshape(-1, 8).mean(axis=1)
    steps = np.abs(np.diff(bands))
    bmr_top = (a[y0:y0 + 8, x0:x1, 2] - a[y0:y0 + 8, x0:x1, 0]).mean()
    bmr_bot = (a[y1 - 8:y1, x0:x1, 2] - a[y1 - 8:y1, x0:x1, 0]).mean()
    print("%s top %.0f -> bottom %.0f  monotone_up=%s  maxstep %.1f  nbands %d  B-R top %.0f bottom %.0f" % (
        f, bands[0], bands[-1], bool(np.all(np.diff(bands) >= -1.0)), steps.max(), len(bands), bmr_top, bmr_bot))

print()
print("=== ROW vs COLUMN texture (scanline check) in sky box: mean |dL| between adjacent rows vs adjacent cols ===")
for f in REG:
    a = load(os.path.join(FR, f + ".png"))
    x0, y0, x1, y1 = REG[f]["sky"]
    L = luma(a[y0:y1, x0:x1])
    dr = np.abs(np.diff(L, axis=0)).mean(); dc = np.abs(np.diff(L, axis=1)).mean()
    # also on the road dark box
    bx = REG[f]["roaddark"]; Lr = luma(a[bx[1]:bx[3], bx[0]:bx[2]])
    drr = np.abs(np.diff(Lr, axis=0)).mean(); dcr = np.abs(np.diff(Lr, axis=1)).mean()
    print("%s sky rows %.2f cols %.2f | road rows %.2f cols %.2f" % (f, dr, dc, drr, dcr))

print()
print("=== HERO HEIGHT: cream car body mask (L>150, chroma<70, B<R) in centre region, vertical extent / 720 ===")
for f in REG:
    a = load(os.path.join(FR, f + ".png"))
    L = luma(a); ch = a.max(axis=2) - a.min(axis=2)
    m = (L > 150) & (ch < 75) & (a[..., 2] < a[..., 0]) & (a[..., 1] > 140)
    ys, xs = np.mgrid[0:720, 0:1280]
    m &= (xs > 380) & (xs < 900) & (ys > 300) & (ys < 560)
    # take rows where the mask has >= 60 px wide run (car body, not the road sheen which is not cream enough)
    rowcount = m.sum(axis=1)
    rowsok = np.where(rowcount >= 60)[0]
    if len(rowsok):
        print("%s body rows %d..%d  height %d px = %.2f of frame" % (f, rowsok.min(), rowsok.max(), rowsok.max() - rowsok.min(), (rowsok.max() - rowsok.min()) / 720))
    else:
        print(f, "no body found")

# crops for the eye
crops = {
 "f0_lamp": ("f0", (330, 170, 450, 260), 4),
 "f0_ball_car": ("f0", (500, 230, 780, 480), 2),
 "f5_lamp_ball": ("f5", (680, 200, 880, 400), 3),
 "f6_ball": ("f6", (660, 190, 860, 380), 3),
 "f5_taillights": ("f5", (460, 370, 720, 450), 3),
 "f0_body_texture": ("f0", (560, 380, 760, 480), 4),
 "f7_road_far": ("f7", (400, 300, 700, 420), 3),
 "f2_hillside": ("f2", (860, 150, 1280, 520), 1),
 "f1_sky_band": ("f1", (0, 0, 520, 330), 1),
 "f6_right_slab": ("f6", (820, 300, 1280, 600), 1),
 "f0_road_grain": ("f0", (60, 540, 300, 670), 3),
}
for name, (f, box, z) in crops.items():
    im = Image.open(os.path.join(FR, f + ".png")).crop(box)
    im = im.resize((im.width * z, im.height * z), Image.NEAREST)
    im.save(os.path.join(CR, name + ".png"))
print("crops written:", ", ".join(crops))

print()
print("=== REFERENCE PHOTOS (rough relative boxes: near road bottom-centre, far road near the vanishing point, tree band top-left, sky top-centre) ===")
for p in sorted(glob.glob(os.path.join(HERE, "..", "refs", "night", "*.jpg"))):
    a = load(p); h, w = a.shape[:2]
    def rb(fx0, fy0, fx1, fy1): return (int(fx0 * w), int(fy0 * h), int(fx1 * w), int(fy1 * h))
    near = stats(a, rb(0.30, 0.82, 0.70, 0.97)); far = stats(a, rb(0.45, 0.60, 0.55, 0.64))
    tree = stats(a, rb(0.02, 0.15, 0.20, 0.45)); skyt = stats(a, rb(0.40, 0.02, 0.60, 0.10))
    print("%-38s near L p95 %4.0f BmR %4.0f | far L %4.0f BmR %4.0f | tree L %4.0f BmR %4.0f | sky L %4.0f BmR %4.0f | near/far %.1f" % (
        os.path.basename(p)[:38], near["Lp95"], near["BmR"], far["L"], far["BmR"], tree["L"], tree["BmR"], skyt["L"], skyt["BmR"], near["Lp95"] / max(far["L"], 1)))

import json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

FR = "C:/Users/liamk/sundrift/work/critic3/frames"
CROPS = "C:/Users/liamk/sundrift/work/critic3/crops"
OUT = "C:/Users/liamk/sundrift/work/critic3/measure3.json"

def load(p): return np.asarray(Image.open(p).convert("RGB")).astype(np.float32)
def luma(a): return 0.2126*a[...,0] + 0.7152*a[...,1] + 0.0722*a[...,2]
def chroma(a): return a.max(axis=-1) - a.min(axis=-1)

def shift_op(m, r, op):
    e = m.copy()
    for dy in range(-r, r+1):
        for dx in range(-r, r+1):
            s = np.roll(np.roll(m, dy, 0), dx, 1)
            e = (e & s) if op == "and" else (e | s)
    return e

def components(mask):
    lab, n = ndi.label(mask)
    out = []
    if n == 0: return out, lab
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        if sl is None: continue
        out.append(dict(size=int((lab[sl] == i).sum()), y0=sl[0].start, y1=sl[0].stop-1, x0=sl[1].start, x1=sl[1].stop-1, id=i))
    out.sort(key=lambda d: -d["size"])
    return out, lab

def crop_save(a, box, scale, name):
    H, W = a.shape[:2]
    y0,y1,x0,x1 = box
    y0 = max(0,y0); x0 = max(0,x0); y1 = min(H,y1); x1 = min(W,x1)
    im = Image.fromarray(a[y0:y1, x0:x1].astype(np.uint8)).resize(((x1-x0)*scale, (y1-y0)*scale), Image.NEAREST)
    im.save(f"{CROPS}/{name}.png")

def road_trap(H, W, horizon=310, top_half=90, bot_half=560, cx=640):
    yy, xx = np.mgrid[0:H, 0:W]
    t = np.clip((yy - horizon) / max(1, (H - 1 - horizon)), 0, 1)
    half = top_half + t*(bot_half - top_half)
    return (yy >= horizon) & (np.abs(xx - cx) <= half)

results = {}
for i in range(8):
    a = load(f"{FR}/f{i}.png"); H, W = a.shape[:2]
    L = luma(a); C = chroma(a)
    r = {}
    # sample pixels where the car body should be (f0 layout) for a sanity check
    r["samples"] = {f"({y},{x})": [int(v) for v in a[y, x]] for (y, x) in ((420, 640), (395, 600), (445, 640), (430, 560), (350, 640), (470, 660))}
    # beige body: bright, warm, but with enough blue to exclude the orange pool
    body = (L > 165) & (a[...,0] > 190) & (a[...,2] > 115) & (a[...,0] >= a[...,2])
    body[:250, :] = False; body[560:, :] = False; body[:, :300] = False; body[:, 1000:] = False
    e = shift_op(body, 4, "and")
    cands, lab = components(e)
    r["body_top3"] = [(d["size"], d["y0"], d["y1"], d["x0"], d["x1"]) for d in cands[:3]]
    if cands:
        k = cands[0]["id"]
        comp = shift_op(lab == k, 4, "or") & body
        ys, xs = np.nonzero(comp)
        y0, y1, x0, x1 = int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())
        # extend upward through the dark cabin / spoiler
        top = y0
        for y in range(y0-1, max(0, y0-90), -1):
            row = L[y, x0:x1+1]
            if (row < 70).mean() > 0.45: top = y
            else: break
        r["body_bbox"] = (y0, y1, x0, x1)
        r["car_top_with_cabin"] = top
        r["car_h_px"] = y1 - top + 1
        r["car_h_frac"] = round((y1 - top + 1)/H, 3)
        r["car_w_frac"] = round((x1 - x0 + 1)/W, 3)
        Lc = L[comp]
        r["body_rgb"] = [round(float(v),1) for v in a[comp].mean(0)]
        r["body_L_p5_p50_p95_max"] = (round(float(np.percentile(Lc,5)),1), round(float(np.percentile(Lc,50)),1), round(float(np.percentile(Lc,95)),1), round(float(Lc.max()),1))
        hist = np.histogram(Lc, bins=[0,170,185,200,215,230,245,256])[0] / Lc.size
        r["body_L_bins_170_185_200_215_230_245"] = [round(float(h),2) for h in hist]
        r["body_bins_over5pct"] = int((hist > 0.05).sum())
        # cabin readability: mid-tones inside the cabin block
        cab = L[top:y0, x0:x1+1]
        if cab.size:
            r["cabin_frac_L_lt_40"] = round(float((cab < 40).mean()),2)
            r["cabin_frac_40_120"] = round(float(((cab >= 40) & (cab < 120)).mean()),2)
            r["cabin_frac_gt_120"] = round(float((cab >= 120).mean()),2)
        # tail lights: real red inside the body bbox
        red = (a[...,0] > 140) & (a[...,1] < 100) & (a[...,2] < 100)
        box = np.zeros((H, W), bool); box[max(0,y0-10):y1+10, max(0,x0-10):x1+10] = True
        rc, rlab = components(red & box)
        tl = []
        yy, xx = np.mgrid[0:H, 0:W]
        for d in rc[:2]:
            sel = rlab == d["id"]
            cy = (d["y0"]+d["y1"])/2; cx = (d["x0"]+d["x1"])/2
            rad = max(d["y1"]-d["y0"], d["x1"]-d["x0"])/2
            rr = np.sqrt((yy-cy)**2 + (xx-cx)**2)
            ring = (rr > rad+1) & (rr < rad+6) & comp
            far = comp & (rr > rad+12)
            rec = dict(size=d["size"], rgb=[round(float(v),1) for v in a[sel].mean(0)], L=round(float(L[sel].mean()),1))
            if ring.any(): rec["ring_redness"] = round(float((a[ring][:,0] - (a[ring][:,1]+a[ring][:,2])/2).mean()),1)
            if far.any(): rec["body_redness"] = round(float((a[far][:,0] - (a[far][:,1]+a[far][:,2])/2).mean()),1)
            tl.append(rec)
        r["taillights"] = tl
        crop_save(a, (top-30, y1+30, x0-40, x1+40), 2, f"car_f{i}")
        crop_save(a, (top, y0+10, x0, x1), 4, f"cabin_f{i}")
    # asphalt highlight with the car zone and the markings removed
    trap = road_trap(H, W)
    hud = np.zeros((H, W), bool); hud[:100,:] = True; hud[540:,1030:] = True; hud[670:,:200] = True
    marks = (L > 140) & (C < 70)
    carzone = np.zeros((H, W), bool)
    if cands:
        carzone[max(0,top-10):y1+15, max(0,x0-15):x1+15] = True
    road = trap & ~hud & ~marks & ~carzone
    v = L[road]
    thr = np.percentile(v, 95)
    hm = road & (L >= thr)
    ys, xs = np.nonzero(hm)
    Y = ys - ys.mean(); X = xs - xs.mean()
    w, vec = np.linalg.eigh(np.cov(np.vstack([X, Y])))
    major = vec[:, 1]
    r["asphalt_top5"] = dict(thr=round(float(thr),1), mean=round(float(v[v>=thr].mean()),1), cy=round(float(ys.mean()),1), cx=round(float(xs.mean()),1), elong=round(float(np.sqrt(w[1]/max(w[0],1e-6))),2), angle=round(float(np.degrees(np.arctan2(major[1], major[0]))),1), bbox=(int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())))
    # step count of the lit asphalt (cel bands) and its luma range
    lit = road & (L > 40)
    if lit.sum() > 200:
        hcount = np.histogram(L[lit], bins=np.arange(40, 260, 8))[0]
        r["lit_bins_gt3pct"] = int((hcount / hcount.sum() > 0.03).sum())
        r["lit_frac_of_road"] = round(float(lit.sum()/road.sum()),3)
        r["lit_L_p10_p50_p90"] = (round(float(np.percentile(L[lit],10)),1), round(float(np.percentile(L[lit],50)),1), round(float(np.percentile(L[lit],90)),1))
    crop_save(a, (290, 500, 440, 820), 2, f"carzone_f{i}")
    results[f"f{i}"] = r
    print(f"==== f{i} ====")
    for k, val in r.items():
        print("  ", k, "=", val)

with open(OUT, "w") as f: json.dump(results, f, indent=1, default=str)
print("written", OUT)

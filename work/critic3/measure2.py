import os, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

FR = "C:/Users/liamk/sundrift/work/critic3/frames"
CROPS = "C:/Users/liamk/sundrift/work/critic3/crops"
OUT = "C:/Users/liamk/sundrift/work/critic3/measure2.json"

def load(p): return np.asarray(Image.open(p).convert("RGB")).astype(np.float32)
def luma(a): return 0.2126*a[...,0] + 0.7152*a[...,1] + 0.0722*a[...,2]
def chroma(a): return a.max(axis=-1) - a.min(axis=-1)

def hud_mask(H, W):
    m = np.zeros((H, W), bool)
    m[:100, :] = True; m[540:, 1030:] = True; m[670:, :200] = True
    return m

def road_trap(H, W, horizon=310, top_half=90, bot_half=560, cx=640):
    yy, xx = np.mgrid[0:H, 0:W]
    t = np.clip((yy - horizon) / max(1, (H - 1 - horizon)), 0, 1)
    half = top_half + t*(bot_half - top_half)
    return (yy >= horizon) & (np.abs(xx - cx) <= half)

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
        sz = int((lab[sl] == i).sum())
        out.append(dict(size=sz, y0=sl[0].start, y1=sl[0].stop-1, x0=sl[1].start, x1=sl[1].stop-1, id=i))
    out.sort(key=lambda d: -d["size"])
    return out, lab

def car_mask(a):
    L = luma(a); C = chroma(a); H, W = L.shape
    m = (L > 150) & (C < 110) & (a[...,0] >= a[...,2]) & ~hud_mask(H, W)
    m[:250, :] = False; m[600:, :] = False; m[:, :250] = False; m[:, 1050:] = False
    e = shift_op(m, 3, "and")
    cands, lab = components(e)
    if not cands: return None, None, []
    top = cands[:3]
    k = top[0]["id"]
    comp = shift_op(lab == k, 3, "or") & m
    ys, xs = np.nonzero(comp)
    return comp, (int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())), [(d["size"], d["y0"], d["y1"], d["x0"], d["x1"]) for d in top]

def find_lamp(a):
    L = luma(a); H, W = L.shape
    m = (L > 215) & (a[...,0] - a[...,2] > 5)
    m[:75, :] = False; m[330:, :] = False
    cands, lab = components(m)
    best = None
    for d in cands:
        if 15 <= d["size"] <= 150:
            sel = lab == d["id"]
            ys, xs = np.nonzero(sel)
            pk = float(L[sel].max())
            if best is None or pk > best[3]:
                best = (d["size"], round(float(ys.mean()),1), round(float(xs.mean()),1), round(pk,1))
    return best

def radial(a, cy, cx, rmax, step):
    L = luma(a); H, W = L.shape
    yy, xx = np.mgrid[0:H, 0:W]
    r = np.sqrt((yy-cy)**2 + (xx-cx)**2)
    prof = []
    for k in range(0, rmax, step):
        sel = (r >= k) & (r < k+step)
        prof.append(round(float(L[sel].mean()), 1) if sel.any() else 0.0)
    return prof

def halo_radius(prof, step, sky=26.0):
    r = 0
    for i, v in enumerate(prof):
        if v > 2*sky: r = i*step
    return r

def taillights(a, bbox, carm):
    if bbox is None: return None
    y0,y1,x0,x1 = bbox
    H, W = a.shape[:2]
    Y0, X0 = max(0, y0-10), max(0, x0-10)
    sub = a[Y0:min(H,y1+10), X0:min(W,x1+10)]
    m = (sub[...,0] > 150) & (sub[...,1] < 120) & (sub[...,2] < 120)
    cands, lab = components(m)
    res = []
    body = carm.copy()
    yy, xx = np.mgrid[0:H, 0:W]
    for d in cands[:2]:
        sel = lab == d["id"]
        px = sub[sel]
        cy = d["y0"] + (d["y1"]-d["y0"])/2 + Y0; cx = d["x0"] + (d["x1"]-d["x0"])/2 + X0
        rr = np.sqrt((yy-cy)**2 + (xx-cx)**2)
        rad = max(d["y1"]-d["y0"], d["x1"]-d["x0"])/2
        ring = (rr > rad+2) & (rr < rad+7) & body
        core = dict(size=d["size"], rgb=[round(float(v),1) for v in px.mean(0)], L=round(float(luma(px).mean()),1))
        if ring.any():
            rp = a[ring]
            core["ring_rgb"] = [round(float(v),1) for v in rp.mean(0)]
            core["ring_redness"] = round(float((rp[:,0] - (rp[:,1]+rp[:,2])/2).mean()),1)
        far = body & (rr > rad+12)
        if far.any():
            fp = a[far]
            core["body_rgb"] = [round(float(v),1) for v in fp.mean(0)]
            core["body_redness"] = round(float((fp[:,0] - (fp[:,1]+fp[:,2])/2).mean()),1)
        res.append(core)
    return res

def crop_save(a, box, scale, name):
    H, W = a.shape[:2]
    y0,y1,x0,x1 = box
    y0 = max(0,y0); x0 = max(0,x0); y1 = min(H,y1); x1 = min(W,x1)
    im = Image.fromarray(a[y0:y1, x0:x1].astype(np.uint8)).resize(((x1-x0)*scale, (y1-y0)*scale), Image.NEAREST)
    im.save(f"{CROPS}/{name}.png")

results = {}
for i in range(8):
    a = load(f"{FR}/f{i}.png"); H, W = a.shape[:2]
    L = luma(a); C = chroma(a); BR = a[...,2] - a[...,0]
    hud = hud_mask(H, W)
    carm, bbox, top = car_mask(a)
    if carm is None: carm = np.zeros((H, W), bool)
    r = dict(car_bbox=bbox, car_top3=top)
    if bbox:
        r["car_h_frac"] = round((bbox[1]-bbox[0]+1)/H, 3)
        r["car_w_frac"] = round((bbox[3]-bbox[2]+1)/W, 3)
        Lc = L[carm]
        r["car_n"] = int(carm.sum())
        r["car_rgb"] = [round(float(v),1) for v in a[carm].mean(0)]
        r["car_L_p5_p50_p95"] = (round(float(np.percentile(Lc,5)),1), round(float(np.percentile(Lc,50)),1), round(float(np.percentile(Lc,95)),1))
        hist = np.histogram(Lc, bins=[0,150,170,190,210,230,256])[0]
        r["car_L_hist_150_170_190_210_230"] = [round(float(h/Lc.size),2) for h in hist]
        y0,y1,x0,x1 = bbox
        box = np.zeros((H, W), bool); box[y0:y1+1, x0:x1+1] = True
        inbox = L[box]
        r["bbox_dark_frac_L_lt_40"] = round(float((inbox < 40).mean()),2)
        r["bbox_mid_frac_40_150"] = round(float(((inbox >= 40) & (inbox < 150)).mean()),2)
        crop_save(a, (y0-40, y1+40, x0-60, x1+60), 2, f"car_f{i}")
    r["taillights"] = taillights(a, bbox, carm)
    lamp = find_lamp(a)
    r["lamp"] = lamp
    if lamp:
        prof = radial(a, lamp[1], lamp[2], 124, 4)
        r["lamp_radial_step4"] = prof
        r["halo_radius_px"] = halo_radius(prof, 4)
        cy, cx = int(lamp[1]), int(lamp[2])
        crop_save(a, (cy-60, cy+60, cx-60, cx+60), 4, f"lamp_f{i}")
    trap = road_trap(H, W)
    cardil = shift_op(carm, 10, "or")
    marks = (L > 150) & (C < 40)
    road = trap & ~cardil & ~hud & ~marks
    yy, xx = np.mgrid[0:H, 0:W]
    if lamp:
        road &= ((yy-lamp[1])**2 + (xx-lamp[2])**2) > 60**2
    v = L[road]
    thr = np.percentile(v, 95)
    hm = road & (L >= thr)
    ys, xs = np.nonzero(hm)
    Y = ys - ys.mean(); X = xs - xs.mean()
    w, vec = np.linalg.eigh(np.cov(np.vstack([X, Y])))
    major = vec[:, 1]
    ang = float(np.degrees(np.arctan2(major[1], major[0])))
    r["asphalt_top5"] = dict(thr=round(float(thr),1), mean=round(float(v[v>=thr].mean()),1), cy=round(float(ys.mean()),1), cx=round(float(xs.mean()),1), elong=round(float(np.sqrt(w[1]/max(w[0],1e-6))),2), angle_deg_from_x=round(ang,1), bbox=(int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())))
    lit = road & (L > 40)
    if lit.sum() > 200:
        hcount = np.histogram(L[lit], bins=np.arange(40, 260, 8))[0]
        r["lit_asphalt_bins_gt3pct"] = int((hcount / hcount.sum() > 0.03).sum())
        r["lit_asphalt_frac_of_road"] = round(float(lit.sum()/road.sum()),3)
    crop_save(a, (int(ys.mean())-70, int(ys.mean())+70, int(xs.mean())-90, int(xs.mean())+90), 3, f"pool_f{i}")
    farlamp = np.ones((H, W), bool)
    if lamp: farlamp = ((yy-lamp[1])**2 + (xx-lamp[2])**2) > 220**2
    sur = (L >= 8) & (L < 70) & ~trap & ~cardil & ~hud & farlamp
    sky = sur & (yy < 250) & (a[...,2] > a[...,0])
    ground = sur & (yy >= 250)
    r["surround_rgb"] = [round(float(x),1) for x in a[sur].mean(0)]
    r["surround_BR"] = round(float(BR[sur].mean()),1)
    r["sky_rgb"] = [round(float(x),1) for x in a[sky].mean(0)] if sky.any() else None
    r["ground_dark_rgb"] = [round(float(x),1) for x in a[ground].mean(0)] if ground.any() else None
    r["ground_dark_BR"] = round(float(BR[ground].mean()),1) if ground.any() else None
    r["ground_dark_frac_of_frame"] = round(float(ground.sum()/(~hud).sum()),3)
    r["road_dark_rgb"] = [round(float(x),1) for x in a[trap & (L < 40) & ~cardil & ~hud].mean(0)]
    results[f"f{i}"] = r
    print(f"==== f{i} ====")
    for k, val in r.items():
        print("  ", k, "=", val)

with open(OUT, "w") as f: json.dump(results, f, indent=1, default=str)
print("written", OUT)

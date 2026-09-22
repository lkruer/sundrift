import os, glob, json
import numpy as np
from PIL import Image

FR = 'C:/Users/liamk/sundrift/work/critic3/frames'
NIGHT = 'C:/Users/liamk/sundrift/work/refs/night'
PAIRS = 'C:/Users/liamk/sundrift/work/critic3/pairs'
CROPS = 'C:/Users/liamk/sundrift/work/critic3/crops'
OUT = 'C:/Users/liamk/sundrift/work/critic3/measure.json'
os.makedirs(CROPS, exist_ok=True)

try:
    from scipy import ndimage as ndi
    def cc(mask):
        lab, n = ndi.label(mask)
        if n == 0: return lab, []
        sizes = ndi.sum(mask.astype(np.float32), lab, index=np.arange(1, n+1))
        return lab, [int(s) for s in np.asarray(sizes)]
    CCMODE = 'scipy'
except Exception:
    CCMODE = 'python'
    def cc(mask):
        H, W = mask.shape
        labels = np.zeros((H, W), dtype=np.int32)
        cur = 0; sizes = []
        ys, xs = np.nonzero(mask)
        for y0, x0 in zip(ys.tolist(), xs.tolist()):
            if labels[y0, x0]: continue
            cur += 1; labels[y0, x0] = cur; n = 0
            stack = [(y0, x0)]
            while stack:
                y, x = stack.pop(); n += 1
                for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                    yy, xx = y+dy, x+dx
                    if 0 <= yy < H and 0 <= xx < W and mask[yy, xx] and not labels[yy, xx]:
                        labels[yy, xx] = cur; stack.append((yy, xx))
            sizes.append(n)
        return labels, sizes

def load(p): return np.asarray(Image.open(p).convert('RGB')).astype(np.float32)
def luma(a): return 0.2126*a[...,0] + 0.7152*a[...,1] + 0.0722*a[...,2]
def chroma(a): return a.max(axis=-1) - a.min(axis=-1)

def hud_mask(H, W):
    m = np.zeros((H, W), bool)
    m[:100, :] = True
    m[540:, 1030:] = True
    m[670:, :200] = True
    return m

def road_trap(H, W, horizon, top_half=90, bot_half=560, cx=640):
    yy, xx = np.mgrid[0:H, 0:W]
    t = np.clip((yy - horizon) / max(1, (H - 1 - horizon)), 0, 1)
    half = top_half + t*(bot_half - top_half)
    return (yy >= horizon) & (np.abs(xx - cx) <= half)

def shift_op(m, r, op):
    e = m.copy()
    for dy in range(-r, r+1):
        for dx in range(-r, r+1):
            s = np.roll(np.roll(m, dy, 0), dx, 1)
            e = (e & s) if op == 'and' else (e | s)
    return e

def car_mask(a):
    L = luma(a); C = chroma(a); H, W = L.shape
    m = (L > 130) & (C < 45)
    m[:140, :] = False; m[640:, :] = False; m[:, :220] = False; m[:, 1060:] = False
    e = shift_op(m, 5, 'and')
    lab, sizes = cc(e)
    if not sizes: return None, None
    k = int(np.argmax(sizes)) + 1
    comp = shift_op(lab == k, 5, 'or') & m
    ys, xs = np.nonzero(comp)
    return comp, (int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max()))

def find_lamps(a):
    L = luma(a); H, W = L.shape
    m = (L > 215) & (a[...,0] - a[...,2] > 5)
    m[:75, :] = False; m[430:, :] = False
    lab, sizes = cc(m)
    out = []
    for i, s in enumerate(sizes, 1):
        if 3 <= s <= 900:
            ys, xs = np.nonzero(lab == i)
            out.append((int(s), round(float(ys.mean()),1), round(float(xs.mean()),1), round(float(L[ys, xs].max()),1)))
    out.sort(key=lambda t: -t[0])
    return out[:4]

def radial(a, cy, cx, rmax=36, step=1):
    L = luma(a); H, W = L.shape
    yy, xx = np.mgrid[0:H, 0:W]
    r = np.sqrt((yy-cy)**2 + (xx-cx)**2)
    prof = []
    for k in range(0, rmax, step):
        sel = (r >= k) & (r < k+step)
        prof.append(round(float(L[sel].mean()), 1) if sel.any() else 0.0)
    return prof

def taillight(a, bbox):
    if bbox is None: return None
    y0,y1,x0,x1 = bbox
    Y0, X0 = max(0, y0-15), max(0, x0-15)
    sub = a[Y0:y1+15, X0:x1+15]
    m = (sub[...,0] > 140) & (sub[...,1] < 120) & (sub[...,2] < 120)
    lab, sizes = cc(m)
    if not sizes: return None
    k = int(np.argmax(sizes)) + 1
    ys, xs = np.nonzero(lab == k)
    return (int(sizes[k-1]), round(float(ys.mean()+Y0),1), round(float(xs.mean()+X0),1))

def sky_profile(a):
    L = luma(a); C = chroma(a); H, W = L.shape
    blue = (a[...,2] > a[...,0] + 6) & (L > 6) & (L < 150) & (C < 90) & ~hud_mask(H, W)
    rows = []
    for y in range(0, 372, 24):
        band = blue[y:y+24]
        frac = float(band.mean())
        if frac < 0.15: rows.append((y, None)); continue
        px = a[y:y+24][band]
        Lp = luma(px)
        q = np.percentile(Lp, 70)
        sel = Lp >= q
        rows.append((y, round(float(Lp[sel].mean()),1), round(float((px[sel,2]-px[sel,0]).mean()),1), round(frac,2)))
    return rows

def stars(a):
    L = luma(a); H, W = L.shape
    m = (L > 170) & (chroma(a) < 60) & ~hud_mask(H, W)
    m[300:, :] = False
    lab, sizes = cc(m)
    return sum(1 for s in sizes if 1 <= s <= 9)

def highlight(a, road):
    L = luma(a)
    if road.sum() < 100: return None
    thr = np.percentile(L[road], 95)
    hm = road & (L >= thr)
    ys, xs = np.nonzero(hm)
    Y = ys - ys.mean(); X = xs - xs.mean()
    cov = np.cov(np.vstack([X, Y]))
    w, v = np.linalg.eigh(cov)
    major = v[:, 1]; ratio = float(np.sqrt(w[1]/max(w[0],1e-6)))
    ang = float(np.degrees(np.arctan2(major[1], major[0])))
    return dict(thr=round(float(thr),1), n=int(hm.sum()), cy=round(float(ys.mean()),1), cx=round(float(xs.mean()),1), elong=round(ratio,2), angle=round(ang,1), bbox=(int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())))

def n1(a, road, horizon):
    L = luma(a); H, W = L.shape
    v = L[road]
    p95 = np.percentile(v, 95); bright5 = float(v[v >= p95].mean())
    prof = []
    for y in range(horizon-60, min(H, horizon+220), 20):
        band = road[y:y+20]
        vv = L[y:y+20][band]
        prof.append((y, round(float(np.median(vv)),1) if vv.size else None))
    far = road.copy(); far[:horizon+20] = False; far[horizon+50:] = False
    fv = L[far]
    return dict(bright5=round(bright5,1), far_med=round(float(np.median(fv)),1) if fv.size else None,
                far_std=round(float(fv.std()),1) if fv.size else None,
                far_frac_visible=round(float((fv >= 6).mean()),2) if fv.size else None,
                ratio=round(bright5/max(float(np.median(fv)),1.0),1) if fv.size else None, prof=prof)

def n3(a, trap, road, carm, lamp):
    L = luma(a); H, W = L.shape; hud = hud_mask(H, W)
    BR = a[...,2] - a[...,0]
    thr = np.percentile(L[road], 95)
    pool = road & (L >= thr)
    sur = (~trap) & (L >= 8) & (L < 70) & ~hud & ~carm
    res = dict(pool_BR=round(float(BR[pool].mean()),1), pool_L=round(float(L[pool].mean()),1),
               sur_BR=round(float(BR[sur].mean()),1), sur_L=round(float(L[sur].mean()),1), sur_frac=round(float(sur.mean()),3))
    if lamp:
        cy, cx = lamp[1], lamp[2]
        yy, xx = np.mgrid[0:H, 0:W]
        near = ((yy-cy)**2 + (xx-cx)**2 < 160**2) & (L > 50) & (L < 215) & ~hud & ~carm & ~pool
        if near.sum() > 50:
            res['near_lamp_BR'] = round(float(BR[near].mean()),1); res['near_lamp_L'] = round(float(L[near].mean()),1); res['near_lamp_n'] = int(near.sum())
    return res

def crush(a, hud=True):
    L = luma(a); H, W = L.shape
    hm = hud_mask(H, W) if hud else np.zeros((H, W), bool)
    v = L[~hm]
    bot = L[int(H*0.66):][~hm[int(H*0.66):]]
    BR = (a[...,2]-a[...,0])
    warm_pool = (L > 60) & (BR < -30) & ~hm
    return dict(p98=round(float(np.percentile(v, 98)),1), p50=round(float(np.median(v)),1), crushed6=round(float((v < 6).mean()),3),
                dark6_40=round(float(((v >= 6) & (v < 40)).mean()),3), bright200=round(float((v > 200).mean()),4), maxL=round(float(v.max()),1),
                bottom_third_p50=round(float(np.median(bot)),1), bottom_third_p90=round(float(np.percentile(bot,90)),1),
                warm_pool_frac=round(float(warm_pool.sum()/(~hm).sum()),3))

def hf_residual(a, box):
    y0,y1,x0,x1 = box
    P = luma(a)[y0:y1, x0:x1]
    k = 5
    pad = np.pad(P, k//2, mode='edge')
    cs = np.cumsum(np.cumsum(pad, 0), 1)
    cs = np.pad(cs, ((1,0),(1,0)))
    S = cs[k:, k:] - cs[:-k, k:] - cs[k:, :-k] + cs[:-k, :-k]
    blur = S / (k*k)
    return round(float(np.abs(P - blur).mean()),2)

def periodicity(a, box):
    y0,y1,x0,x1 = box
    P = luma(a)[y0:y1, x0:x1]
    P = P - P.mean()
    F = np.abs(np.fft.fft2(P))
    h, w = F.shape
    fy = np.fft.fftfreq(h)[:,None]; fx = np.fft.fftfreq(w)[None,:]
    rad = np.sqrt(fy**2 + fx**2)
    F[rad < 0.03] = 0
    idx = np.unravel_index(np.argmax(F), F.shape)
    peak = float(F[idx]); med = float(np.median(F[F > 0])) if (F > 0).any() else 1.0
    return round(peak/max(med,1e-6),1), round(1.0/max(float(rad[idx]),1e-6),1)

def ncolors(a):
    q = (a // 16).astype(np.int32)
    key = q[...,0]*1024 + q[...,1]*32 + q[...,2]
    return int(np.unique(key).size)

def crop_save(a, box, scale, name):
    H, W = a.shape[:2]
    y0,y1,x0,x1 = box
    y0 = max(0,y0); x0 = max(0,x0); y1 = min(H,y1); x1 = min(W,x1)
    im = Image.fromarray(a[y0:y1, x0:x1].astype(np.uint8)).resize(((x1-x0)*scale, (y1-y0)*scale), Image.NEAREST)
    im.save(f'{CROPS}/{name}.png')

def match_pairs():
    frames = {}
    for i in range(8):
        im = Image.open(f'{FR}/f{i}.png').convert('RGB').resize((96, 54), Image.BILINEAR)
        frames[i] = np.asarray(im).astype(np.float32)
    res = {}
    for p in sorted(glob.glob(f'{PAIRS}/pair_*.png')):
        im = Image.open(p).convert('RGB'); W, H = im.size
        halves = {'L': im.crop((0, 0, W//2, H)), 'R': im.crop((W - W//2, 0, W, H))}
        rec = {}
        for side, h in halves.items():
            arr = np.asarray(h).astype(np.float32)
            cands = [h]
            bg = arr[0,0]
            for thr in (12, 30):
                diff = np.abs(arr - bg).sum(-1) > thr
                ys, xs = np.nonzero(diff)
                if ys.size: cands.append(h.crop((int(xs.min()), int(ys.min()), int(xs.max())+1, int(ys.max())+1)))
            best = None
            for c in cands:
                cc_ = np.asarray(c.resize((96, 54), Image.BILINEAR)).astype(np.float32)
                for i, f in frames.items():
                    mad = float(np.abs(cc_ - f).mean())
                    if best is None or mad < best[0]: best = (round(mad,1), i)
            rec[side] = best
        res[os.path.basename(p)] = dict(size=(W, H), L=rec['L'], R=rec['R'])
    return res

results = {'ccmode': CCMODE, 'frames': {}, 'refs': {}, 'pairs': match_pairs()}
print('CC mode:', CCMODE)
print('PAIR MATCH (side -> (MAD, frame)); low MAD = game side')
for k, v in results['pairs'].items():
    print(' ', k, v['size'], 'L', v['L'], 'R', v['R'])

HORIZON = 310
for i in range(8):
    p = f'{FR}/f{i}.png'
    a = load(p); H, W = a.shape[:2]
    carm, bbox = car_mask(a)
    if carm is None: carm = np.zeros((H, W), bool)
    trap = road_trap(H, W, HORIZON)
    road = trap & ~carm & ~hud_mask(H, W)
    lamps = find_lamps(a)
    lamp = lamps[0] if lamps else None
    r = {}
    r['size'] = (W, H)
    r['car_bbox'] = bbox
    r['car_h_frac'] = round((bbox[1]-bbox[0]+1)/H, 3) if bbox else None
    r['car_w_frac'] = round((bbox[3]-bbox[2]+1)/W, 3) if bbox else None
    if bbox:
        Lc = luma(a)[carm]
        r['car_L_p5_p50_p95'] = (round(float(np.percentile(Lc,5)),1), round(float(np.percentile(Lc,50)),1), round(float(np.percentile(Lc,95)),1))
        hist = np.histogram(Lc, bins=[0,60,100,130,160,190,210,230,256])[0]
        r['car_L_hist'] = [round(float(h/ Lc.size),2) for h in hist]
        r['car_BR'] = round(float((a[...,2]-a[...,0])[carm].mean()),1)
    r['lamps'] = lamps
    if lamp:
        r['lamp_radial'] = radial(a, lamp[1], lamp[2], 60, 3)
    tl = taillight(a, bbox)
    r['taillight'] = tl
    if tl:
        r['tail_radial'] = radial(a, tl[1], tl[2], 16, 1)
    r['stars'] = stars(a)
    r['sky'] = sky_profile(a)
    r['n1'] = n1(a, road, HORIZON)
    r['n3'] = n3(a, trap, road, carm, lamp)
    r['highlight'] = highlight(a, road)
    r['crush'] = crush(a)
    r['ncolors16'] = ncolors(a)
    r['hf_road'] = hf_residual(a, (560, 688, 300, 428))
    r['hf_sky'] = hf_residual(a, (110, 238, 1000, 1128))
    r['period_road'] = periodicity(a, (560, 688, 300, 428))
    r['period_sky'] = periodicity(a, (110, 238, 1000, 1128))
    results['frames'][f'f{i}'] = r
    if bbox:
        y0,y1,x0,x1 = bbox
        crop_save(a, (y0-40, y1+40, x0-60, x1+60), 2, f'car_f{i}')
    if lamp:
        cy, cx = int(lamp[1]), int(lamp[2])
        crop_save(a, (cy-50, cy+50, cx-50, cx+50), 4, f'lamp_f{i}')
    crop_save(a, (100, 260, 960, 1120), 3, f'sky_f{i}')
    crop_save(a, (540, 700, 240, 400), 3, f'road_f{i}')
    print(f'==== f{i} ====')
    for k in ('car_bbox','car_h_frac','car_w_frac','car_L_p5_p50_p95','car_L_hist','car_BR','lamps','taillight','stars','crush','ncolors16','hf_road','hf_sky','period_road','period_sky'):
        print(' ', k, '=', r.get(k))
    print('  lamp_radial(step3) =', r.get('lamp_radial'))
    print('  tail_radial =', r.get('tail_radial'))
    print('  n1 =', {k:v for k,v in r['n1'].items() if k != 'prof'})
    print('  n1 prof =', r['n1']['prof'])
    print('  n3 =', r['n3'])
    print('  highlight =', r['highlight'])
    print('  sky =', r['sky'])

print('==== NIGHT REFS ====')
for p in sorted(glob.glob(f'{NIGHT}/*.jpg')):
    a = load(p); H, W = a.shape[:2]
    L = luma(a); BR = a[...,2]-a[...,0]
    thr = np.percentile(L, 95)
    pool = L >= thr
    sur = (L >= 8) & (L < 70)
    r = crush(a, hud=False)
    r['pool_BR'] = round(float(BR[pool].mean()),1); r['sur_BR'] = round(float(BR[sur].mean()),1)
    r['size'] = (W, H)
    r['hf_road'] = hf_residual(a, (int(H*0.85), int(H*0.85)+128, int(W*0.45), int(W*0.45)+128))
    r['hf_sky'] = hf_residual(a, (int(H*0.05), int(H*0.05)+128, int(W*0.55), int(W*0.55)+128))
    r['ncolors16'] = ncolors(a)
    prof = []
    for y in range(int(H*0.02), int(H*0.40), int(H*0.04)):
        band = a[y:y+8, int(W*0.3):int(W*0.7)]
        Lb = luma(band); sel = (band[...,2] > band[...,0]) & (Lb > 6)
        if sel.mean() < 0.2: prof.append((y, None)); continue
        prof.append((y, round(float(np.percentile(Lb[sel],70)),1), round(float((band[...,2]-band[...,0])[sel].mean()),1)))
    r['sky_prof'] = prof
    results['refs'][os.path.basename(p)[:40]] = r
    print(' ', os.path.basename(p)[:40], {k:v for k,v in r.items() if k != 'sky_prof'})
    print('    sky:', prof)

with open(OUT, 'w') as f: json.dump(results, f, indent=1, default=str)
print('written', OUT)

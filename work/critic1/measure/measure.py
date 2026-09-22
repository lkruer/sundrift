# Claim measurements on game frames (f0..f7) and night refs. Resampled to 1280 wide. Bands inside the frame (HUD excluded).
import glob, os
from PIL import Image
W=1280
def load(p):
    im=Image.open(p).convert("RGB"); w,h=im.size
    return im.resize((W, round(h*W/w)), Image.BILINEAR)
def lum(px): return 0.2126*px[0]+0.7152*px[1]+0.0722*px[2]
def pix_in(im, x0,x1,y0,y1, step=2):
    w,h=im.size; P=im.load(); out=[]
    for y in range(int(y0*h), int(y1*h), step):
        for x in range(int(x0*w), int(x1*w), step):
            out.append(P[x,y])
    return out
def pct(vals,p):
    s=sorted(vals); return s[min(len(s)-1,int(p*len(s)))]
def road_all(im, far_y0, exclude_car):
    # trapezoid: x range widens from (0.40,0.60) at far_y0 to (0.10,0.90) at 0.97
    w,h=im.size; P=im.load(); out=[]
    for y in range(int(far_y0*h), int(0.97*h), 2):
        t=(y/h-far_y0)/(0.97-far_y0)
        x0=0.40-0.30*t; x1=0.60+0.30*t
        for x in range(int(x0*w), int(x1*w), 2):
            if exclude_car and 0.30*w<x<0.70*w and 0.47*h<y<0.80*h: continue
            out.append(P[x,y])
    return out
def report(path, is_game):
    im=load(path); w,h=im.size
    far=(0.44,0.475) if is_game else (0.56,0.60)
    near=pix_in(im,0.25,0.75,0.86,0.97)
    farb=pix_in(im,0.40,0.60,far[0],far[1],1)
    road=road_all(im, far[0], is_game)
    inner=pix_in(im,0.05,0.85,0.12,0.85,3)
    sky=pix_in(im,0.15,0.40,0.01,0.10)+pix_in(im,0.60,0.85,0.01,0.10)
    surround=pix_in(im,0.02,0.20,0.50,0.75)+pix_in(im,0.80,0.98,0.50,0.75)
    Lroad=[lum(p) for p in road]; Lfar=[lum(p) for p in farb]; Lnear=[lum(p) for p in near]; Linner=[lum(p) for p in inner]
    p95road=pct(Lroad,0.95); medfar=pct(Lfar,0.5); mednear=pct(Lnear,0.5)
    # pool = brightest 5% of road pixels; its B-R
    thr=p95road; pool=[p for p in road if lum(p)>=thr]
    br=lambda ps: sum(p[2]-p[0] for p in ps)/max(1,len(ps))
    dark=sum(1 for v in Linner if v<25)/len(Linner)
    # sky column profile at x=0.62 (clear of HUD), y 0.02..0.30
    P=im.load(); prof=[]
    for yy in [0.02,0.06,0.10,0.14,0.18,0.22,0.26,0.30]:
        col=[P[x,int(yy*h)] for x in range(int(0.60*w),int(0.64*w))]
        prof.append((round(pct([lum(p) for p in col],0.5)), round(br(col))))
    # star-like specks in sky region (exclude HUD centre)
    stars=0
    for y in range(int(0.02*h), int(0.25*h)):
        for x in range(int(0.15*w), int(0.85*w)):
            if 0.42*w<x<0.58*w and y<0.20*h: continue
            p=P[x,y]
            if lum(p)>150:
                nb=[lum(P[x+dx,y+dy]) for dx in (-3,3) for dy in (-3,3)]
                if max(nb)<80: stars+=1
    name=os.path.basename(path)[:34]
    print(f"{name:34s} | N1 p95road={p95road:5.1f} medFar={medfar:5.1f} ratio={p95road/max(1,medfar):4.1f} medNear={mednear:5.1f} near/far={mednear/max(1,medfar):4.1f} | dark<25={dark*100:4.1f}% p98={pct(Linner,0.98):5.1f} | N3 B-R pool={br(pool):6.1f} far={br(farb):6.1f} sky={br(sky):6.1f} surround={br(surround):6.1f} | N2 sky(luma,B-R)@y.02..30={prof} stars~{stars}")
print("GAME FRAMES (far band y .44-.475, car box excluded from road)")
for i in range(8): report(f"frames/f{i}.png", True)
print("NIGHT REFS (far band y .56-.60)")
for p in sorted(glob.glob("../refs/night/*.jpg")): report(p, False)

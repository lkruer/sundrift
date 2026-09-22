# Where the separation really is: upper-side tree bands (should be silhouettes at night), surround banks, near-road B-R.
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
def br(ps): return sum(p[2]-p[0] for p in ps)/max(1,len(ps))
def sat(ps):  # mean chroma (max-min) of pixels, a proxy for colour saturation of the surround
    return sum(max(p)-min(p) for p in ps)/max(1,len(ps))
def rep(path):
    im=load(path)
    trees=pix_in(im,0.02,0.25,0.15,0.45)+pix_in(im,0.75,0.98,0.15,0.45)   # upper sides: foliage/tree band
    banks=pix_in(im,0.02,0.20,0.50,0.75)+pix_in(im,0.80,0.98,0.50,0.75)   # lower sides: verges/banks
    near=pix_in(im,0.25,0.75,0.86,0.97)                                   # near road
    Lt=[lum(p) for p in trees]; Lb=[lum(p) for p in banks]; Ln=[lum(p) for p in near]
    name=os.path.basename(path)[:22]
    print(f"{name:22s} | trees p50={pct(Lt,.5):5.1f} p90={pct(Lt,.9):5.1f} chroma={sat(trees):5.1f} | banks p50={pct(Lb,.5):5.1f} p90={pct(Lb,.9):5.1f} chroma={sat(banks):5.1f} | near road p50={pct(Ln,.5):5.1f} B-R={br(near):6.1f}")
print("GAME"); [rep(f"frames/f{i}.png") for i in range(8)]
print("REFS"); [rep(p) for p in sorted(glob.glob("../refs/night/*.jpg"))]

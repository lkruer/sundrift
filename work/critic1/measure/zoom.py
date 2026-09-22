# 1) match each frame f0..f7 to a pair side by pixel difference (KEY.json is never opened)
# 2) zoom sheets of the details the tells rest on
from PIL import Image, ImageDraw, ImageFont
try: F=ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 20); FS=ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 22)
except Exception: F=ImageFont.load_default(); FS=F
frames=[Image.open(f"frames/f{i}.png").convert("RGB") for i in range(8)]
small=[f.resize((960,540), Image.BILINEAR) for f in frames]
def diff(a,b):
    A=a.load(); B=b.load(); s=0; n=0
    for y in range(0,540,12):
        for x in range(0,960,12):
            pa=A[x,y]; pb=B[x,y]; s+=abs(pa[0]-pb[0])+abs(pa[1]-pb[1])+abs(pa[2]-pb[2]); n+=1
    return s/n
match={}  # (pair, side) -> frame index
lines=[]
for p in range(1,9):
    im=Image.open(f"pairs/pair_{p:02d}.png").convert("RGB")
    L=im.crop((0,0,960,540)); R=im.crop((968,0,1928,540))
    best=None
    for i,s in enumerate(small):
        for side,half in (("left",L),("right",R)):
            d=diff(s,half)
            if best is None or d<best[0]: best=(d,i,side)
    match[(p,best[2])]=best[1]
    lines.append(f"pair_{p:02d}: game side = {best[2]} (frame f{best[1]}, mean abs diff {best[0]:.1f})")
open("measure/match.txt","w").write("\n".join(lines)+"\n"); print("\n".join(lines))
side_of={p:s for (p,s) in match}; frame_of={p:match[(p,s)] for (p,s) in match}

# Sheet A: hero car region, 50px grid with absolute y labels
tiles=[]
for i in range(8):
    p=[q for q in frame_of if frame_of[q]==i][0]
    c=frames[i].crop((330,250,950,620)); d=ImageDraw.Draw(c)
    for y in range(250,620,50):
        d.line((0,y-250,620,y-250), fill=(0,255,0), width=1); d.text((2,y-250), str(y), fill=(0,255,0), font=F)
    for x in range(350,950,100):
        d.line((x-330,0,x-330,370), fill=(0,255,0), width=1); d.text((x-330+2,350), str(x), fill=(0,255,0), font=F)
    d.text((300,4), f"f{i} = pair {p:02d} {side_of[p]}", fill=(255,255,0), font=FS)
    tiles.append(c)
sheet=Image.new("RGB",(1240,1480),(20,20,20))
for k,t in enumerate(tiles): sheet.paste(t,((k%2)*620,(k//2)*370))
sheet.save("zoom_A_hero.png")

# Sheet B: lamp glare, road under lamp, sphere, bokeh, road surface, sky pixels
def crop2(p,box,scale=2,label=""):
    i=frame_of[p]; c=frames[i].crop(box); c=c.resize((c.width*scale,c.height*scale), Image.NEAREST)
    c=c.crop((0,0,600,360)) if c.width>=600 else c
    d=ImageDraw.Draw(c); d.text((4,4), f"{label} (f{i}, pair {p:02d})", fill=(255,255,0), font=FS); return c
B=[
 crop2(3,(470,150,770,330),2,"lamp glare"),
 crop2(5,(380,160,680,340),2,"lamp glare"),
 crop2(7,(200,150,500,330),2,"lamp glare"),
 crop2(1,(350,150,650,330),2,"distant lamp / grid"),
 crop2(8,(520,220,820,400),2,"grey sphere on road"),
 crop2(7,(0,380,300,560),2,"foreground dots"),
 crop2(5,(300,250,600,430),2,"road under lamp"),
 crop2(3,(330,330,630,510),2,"road beside car"),
 crop2(2,(400,560,700,700),2,"near road surface"),
 crop2(6,(400,560,700,700),2,"near road surface"),
 crop2(2,(760,30,910,120),4,"sky pixels 4x"),
 crop2(6,(560,380,860,560),2,"car rear / lights"),
]
sheet=Image.new("RGB",(1800,1440),(20,20,20))
for k,t in enumerate(B): sheet.paste(t,((k%3)*600,(k//3)*360))
sheet.save("zoom_B_details.png")
print("sheets written")

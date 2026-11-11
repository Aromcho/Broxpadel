"""Vectoriza el logo de BROX desde la imagen real del IG (post DY0aIT5su3i) y la B de las destacadas."""
import sys, numpy as np, potrace
from PIL import Image, ImageFilter

RAW = sys.argv[1]  # media/raw/ig
OUT = sys.argv[2]  # media/brand

def trace(mask: np.ndarray, scale: float, ox=0, oy=0, turd=8):
    bm = potrace.Bitmap(~mask)
    plist = bm.trace(turdsize=turd, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY, alphamax=1.0, opticurve=True, opttolerance=0.2)
    d = []
    for curve in plist:
        fs = curve.start_point
        d.append(f"M{(fs.x)/scale+ox:.2f},{(fs.y)/scale+oy:.2f}")
        for seg in curve.segments:
            if seg.is_corner:
                d.append(f"L{seg.c.x/scale+ox:.2f},{seg.c.y/scale+oy:.2f}L{seg.end_point.x/scale+ox:.2f},{seg.end_point.y/scale+oy:.2f}")
            else:
                d.append(f"C{seg.c1.x/scale+ox:.2f},{seg.c1.y/scale+oy:.2f} {seg.c2.x/scale+ox:.2f},{seg.c2.y/scale+oy:.2f} {seg.end_point.x/scale+ox:.2f},{seg.end_point.y/scale+oy:.2f}")
        d.append("Z")
    return "".join(d)

S = 4
im = Image.open(f"{RAW}/posts/2026-05-26_DY0aIT5su3i/01.jpg").convert("RGB")
# BROX (blanco)
box = (250, 650, 1180, 880)
c = im.crop(box).resize(((box[2]-box[0])*S, (box[3]-box[1])*S), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.2))
a = np.asarray(c).astype(int)
white = (a.min(axis=2) > 150)
brox = trace(white, S)
# PADEL (contorno rojo)
box2 = (700, 880, 1150, 980)
c2 = im.crop(box2).resize(((box2[2]-box2[0])*S, (box2[3]-box2[1])*S), Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.6))
a2 = np.asarray(c2).astype(int)
red = (a2[:, :, 0] > 85) & (a2[:, :, 0] - a2[:, :, 1] > 38)
from scipy import ndimage
red = ndimage.binary_closing(red, structure=np.ones((5, 5)))
red = ndimage.binary_opening(red, structure=np.ones((2, 2)))
padel = trace(red, S, box2[0]-box[0], box2[1]-box[1], turd=4)
W, H = box[2]-box[0], box2[3]-box[1]

def bbox_of(mask, s, ox=0, oy=0):
    ys, xs = np.where(mask)
    return xs.min()/s+ox, ys.min()/s+oy, xs.max()/s+ox, ys.max()/s+oy
b1 = bbox_of(white, S); b2 = bbox_of(red, S, box2[0]-box[0], box2[1]-box[1])
x0, y0 = min(b1[0], b2[0]) - 4, min(b1[1], b2[1]) - 4
x1, y1 = max(b1[2], b2[2]) + 4, max(b1[3], b2[3]) + 4
vb = f"{x0:.1f} {y0:.1f} {x1-x0:.1f} {y1-y0:.1f}"
vb_brox = f"{b1[0]-3:.1f} {b1[1]-3:.1f} {b1[2]-b1[0]+6:.1f} {b1[3]-b1[1]+6:.1f}"
open(f"{OUT}/brox-logo.svg", "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}"><path fill="#fff" d="{brox}"/><path fill="#FB2324" d="{padel}"/></svg>')
open(f"{OUT}/brox-wordmark.svg", "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb_brox}"><path fill="currentColor" d="{brox}"/></svg>')
open(f"{OUT}/brox-logo-paths.json", "w").write(__import__('json').dumps({"brox": brox, "padel": padel, "viewBox": vb, "viewBoxBrox": vb_brox}))

# B (isotipo) desde la destacada (roja con B blanca)
S2 = 8
b = Image.open(f"{RAW}/highlights/remeras/cover.jpg").convert("RGB")
b = b.resize((b.width*S2, b.height*S2), Image.LANCZOS).filter(ImageFilter.GaussianBlur(2.5))
ab = np.asarray(b).astype(int)
wm = (ab.min(axis=2) > 170)
bpath = trace(wm, S2, turd=40)
bb = bbox_of(wm, S2)
vbb = f"{bb[0]-2:.1f} {bb[1]-2:.1f} {bb[2]-bb[0]+4:.1f} {bb[3]-bb[1]+4:.1f}"
open(f"{OUT}/brox-b.svg", "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vbb}"><path fill="currentColor" d="{bpath}"/></svg>')
# ícono app: B blanca sobre rojo
side = max(bb[2]-bb[0], bb[3]-bb[1]) * 1.6
cx, cy = (bb[0]+bb[2])/2, (bb[1]+bb[3])/2
open(f"{OUT}/brox-icon.svg", "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{cx-side/2:.1f} {cy-side/2:.1f} {side:.1f} {side:.1f}"><rect x="{cx-side/2:.1f}" y="{cy-side/2:.1f}" width="{side:.1f}" height="{side:.1f}" fill="#FB2324"/><path fill="#fff" d="{bpath}"/></svg>')
print("ok", vb, vbb)

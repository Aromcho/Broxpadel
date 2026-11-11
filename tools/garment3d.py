"""
Prenda 3D a partir de las fotos reales (opción B: "modelo base + estampa real").

1. Segmenta la prenda en la foto de frente y en la de espalda (u2net_cloth_seg).
2. Arma un cuerpo base con la silueta real de la prenda: sección elíptica por fila (torso) y
   tubos para mangas/piernas, inflado desde la transformada de distancia (efecto "ghost mannequin").
3. Proyecta la foto de frente en la cara delantera y la de espalda (alineada fila por fila a la
   silueta) en la trasera. Agrega un normal map con las arrugas reales de la tela.
4. Exporta GLB (después lo optimiza gltf-transform: meshopt + WebP).

Uso: python tools/garment3d.py <slug> <front.jpg> <back.jpg|-> <tee|shorts> <out.glb> [--preview out.png]
"""
import sys, json, math
from pathlib import Path
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage
from scipy.spatial import Delaunay
import trimesh

sys.path.insert(0, str(Path(__file__).parent))
from garment_seg import cloth_masks  # noqa: E402

MODEL = str(Path.home() / 'models' / 'u2net_cloth_seg.onnx')
if not Path(MODEL).exists():
    MODEL = '/home/claude/models/u2net_cloth_seg.onnx'
TEX = 1024  # cada panel (frente / espalda) en el atlas


def load_rgb(p):
    return np.array(Image.open(p).convert('RGB'))


def clean_mask(prob: np.ndarray, thr=0.5):
    m = (prob > thr).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m)
    if n <= 1:
        return m.astype(bool)
    k = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    m = (lab == k)
    m = ndimage.binary_fill_holes(m)
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((13, 13), np.uint8)).astype(bool)
    # suaviza el borde
    blur = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 3)
    return blur > 0.5


def canonical(img, mask, size=TEX, pad=0.04):
    """Recorta a la caja de la prenda y la centra en un cuadrado size×size (misma escala en X e Y)."""
    ys, xs = np.where(mask)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    w, h = x1 - x0, y1 - y0
    side = max(w, h) * (1 + pad * 2)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    M = np.array([[size / side, 0, size / 2 - cx * size / side], [0, size / side, size / 2 - cy * size / side]], np.float32)
    im2 = cv2.warpAffine(img, M, (size, size), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
    m2 = cv2.warpAffine(mask.astype(np.uint8) * 255, M, (size, size), flags=cv2.INTER_LINEAR) > 127
    return im2, m2


def bleed(img, mask, it=40):
    """Extiende los colores del borde hacia afuera (evita halos oscuros al filtrar la textura)."""
    out = img.copy()
    inpaint_mask = (~mask).astype(np.uint8) * 255
    small = cv2.resize(out, (256, 256)); sm = cv2.resize(inpaint_mask, (256, 256), interpolation=cv2.INTER_NEAREST)
    filled = cv2.inpaint(small, sm, 6, cv2.INPAINT_TELEA)
    filled = cv2.resize(filled, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_CUBIC)
    out[~mask] = filled[~mask]
    # transición suave
    edge = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 2)[..., None]
    return (out * 1.0).astype(np.uint8) if it == 0 else (img * edge + out * (1 - edge)).astype(np.uint8)


def row_spans(mask, sigma=14):
    """Bordes izquierdo/derecho por fila, suavizados (evita saltos en las axilas)."""
    H = mask.shape[0]
    L = np.full(H, np.nan); R = np.full(H, np.nan)
    for y in range(H):
        xs = np.where(mask[y])[0]
        if len(xs):
            L[y], R[y] = xs.min(), xs.max()
    ok = ~np.isnan(L)
    if ok.sum() < 2:
        return [None] * H
    idx = np.arange(H)
    L = np.interp(idx, idx[ok], L[ok]); R = np.interp(idx, idx[ok], R[ok])
    L = ndimage.gaussian_filter1d(L, sigma); R = ndimage.gaussian_filter1d(R, sigma)
    ys = np.where(ok)[0]
    return [(L[y], R[y]) if ys.min() <= y <= ys.max() else None for y in range(H)]


def align_back(back, bmask, fmask):
    """Deforma la foto de espalda fila por fila para que su silueta coincida con la del frente (espejada)."""
    H, W = fmask.shape
    back = back[:, ::-1].copy(); bmask = bmask[:, ::-1].copy()  # vista desde atrás → espejo
    fys = np.where(fmask.any(1))[0]; bys = np.where(bmask.any(1))[0]
    fy0, fy1, by0, by1 = fys.min(), fys.max(), bys.min(), bys.max()
    bspans = row_spans(bmask)
    mapx = np.zeros((H, W), np.float32); mapy = np.zeros((H, W), np.float32)
    fspans = row_spans(fmask)
    last = (0, W - 1)
    for y in range(H):
        t = (y - fy0) / max(1, fy1 - fy0)
        by = np.clip(by0 + t * (by1 - by0), 0, H - 1)
        bs = bspans[int(by)] or last
        last = bs
        fs = fspans[y] or (0, W - 1)
        xs = np.arange(W, dtype=np.float32)
        u = (xs - fs[0]) / max(1, fs[1] - fs[0])
        mapx[y] = bs[0] + u * (bs[1] - bs[0])
        mapy[y] = by
    return cv2.remap(back, mapx, mapy, cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)


def align_back_affine(back, bmask, fmask):
    """Espeja la espalda y la ajusta a la caja de la silueta del frente (escala y traslación por eje)."""
    back = back[:, ::-1].copy(); bmask = bmask[:, ::-1].copy()
    def box(m):
        ys, xs = np.where(m); return xs.min(), xs.max(), ys.min(), ys.max()
    fx0, fx1, fy0, fy1 = box(fmask); bx0, bx1, by0, by1 = box(bmask)
    sx = (fx1 - fx0) / max(1, bx1 - bx0); sy = (fy1 - fy0) / max(1, by1 - by0)
    M = np.array([[sx, 0, fx0 - bx0 * sx], [0, sy, fy0 - by0 * sy]], np.float32)
    img = cv2.warpAffine(back, M, (fmask.shape[1], fmask.shape[0]), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
    m = cv2.warpAffine(bmask.astype(np.uint8) * 255, M, (fmask.shape[1], fmask.shape[0])) > 127
    return img, m


def fabric_normal(img, strength=2.2):
    """Normal map a partir de las arrugas reales (alta frecuencia de la luminancia)."""
    g = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
    hp = g - cv2.GaussianBlur(g, (0, 0), 12)
    hp = cv2.GaussianBlur(hp, (0, 0), 1.2)
    dx = cv2.Sobel(hp, cv2.CV_32F, 1, 0, ksize=3) * strength
    dy = cv2.Sobel(hp, cv2.CV_32F, 0, 1, ksize=3) * strength
    n = np.dstack([-dx, dy, np.ones_like(dx)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return ((n * 0.5 + 0.5) * 255).astype(np.uint8)


def THREE_SMOOTH(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def crotch_notch(mask):
    """Short: abre la entrepierna (la foto de frente la tapa) para que queden dos piernas."""
    m = mask.copy()
    ys = np.where(m.any(1))[0]; xs = np.where(m.any(0))[0]
    y1, y0 = ys.max(), ys.min()
    cx = (xs.min() + xs.max()) / 2
    W = xs.max() - xs.min()
    h = (y1 - y0) * 0.30
    pts = np.array([[cx - W * 0.035, y1 + 2], [cx + W * 0.035, y1 + 2], [cx, y1 - h]], np.int32)
    cv2.fillPoly(m.view(np.uint8), [pts], 0)
    return m.astype(bool)


def depth_field(mask, garment):
    """Profundidad del cuerpo base: elipsoide de torso/cadera con ancho suavizado + tubos en mangas/piernas."""
    H, W = mask.shape
    dt = ndimage.distance_transform_edt(mask).astype(np.float32)
    ys = np.where(mask.any(1))[0]
    y0, y1 = ys.min(), ys.max()
    cols = np.where(mask.any(0))[0]
    cx = (cols.min() + cols.max()) / 2
    # ancho del cuerpo: en la remera, el de la mitad inferior (sin mangas); en el short, el de la cintura
    if garment == 'tee':
        ref = [np.where(mask[y])[0] for y in range(int(y0 + (y1 - y0) * 0.55), int(y0 + (y1 - y0) * 0.9))]
    else:
        ref = [np.where(mask[y])[0] for y in range(int(y0 + (y1 - y0) * 0.05), int(y0 + (y1 - y0) * 0.25))]
    hw = np.median([(r.max() - r.min()) / 2 for r in ref if len(r)])
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    t = np.clip((yy - y0) / max(1, y1 - y0), 0, 1)
    if garment == 'tee':
        # hombros un poco más angostos en profundidad, pecho lleno, ruedo suelto
        hwy = hw * (0.92 + 0.08 * np.sin(np.pi * np.clip(t * 1.4, 0, 1)))
        depth = hw * (0.50 + 0.10 * np.sin(np.pi * np.clip((t - 0.1) / 0.6, 0, 1)))
    else:
        hwy = hw * np.ones_like(t)
        depth = hw * 0.62 * (1 - THREE_SMOOTH(t, 0.25, 0.6))
    u = np.clip((xx - cx) / hwy, -1, 1)
    torso = np.sqrt(np.clip(1 - u ** 2, 0, 1)) * depth
    torso[np.abs((xx - cx) / hwy) > 1] = 0
    # mangas / piernas: tubos con radio = distancia al borde
    tube = np.sqrt(np.clip(dt * (2 * np.minimum(dt.max(), hw * 0.45) - dt), 0, None)) * (0.9 if garment == 'tee' else 1.15)
    z = np.maximum(torso, tube)
    # el borde de la silueta siempre baja a 0 con curva redondeada
    edge = np.sqrt(np.clip(dt / 18.0, 0, 1))
    z = z * edge
    z = cv2.GaussianBlur(z, (0, 0), 5)
    z[~mask] = 0
    return z


def contour_points(mask, step=5):
    cs, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)[:, 0, :].astype(np.float32)
    # suaviza el contorno
    k = 7
    cp = np.vstack([c[-k:], c, c[:k]])
    sm = np.stack([np.convolve(cp[:, i], np.ones(2 * k + 1) / (2 * k + 1), mode='same')[k:-k] for i in range(2)], 1)
    return sm[::step]


def build(front_img, back_img, garment, out_glb, preview=None):
    up, lo = cloth_masks(front_img, MODEL)
    fprob = up if garment == 'tee' else lo
    fmask0 = clean_mask(fprob)
    fimg, fmask = canonical(front_img, fmask0)
    if garment == 'shorts':
        fmask = crotch_notch(fmask)
    if back_img is not None:
        bu, bl = cloth_masks(back_img, MODEL)
        bmask0 = clean_mask(bu if garment == 'tee' else bl)
        bimg_c, bmask = canonical(back_img, bmask0)
        bimg, bmask_al = align_back_affine(bimg_c, bmask, fmask)
    else:
        bimg = fimg[:, ::-1].copy()  # sin foto de espalda: espejo del frente, sin estampa
        bimg = cv2.GaussianBlur(bimg, (0, 0), 18)
        bmask_al = fmask[:, ::-1].copy()
    inner = cv2.erode(fmask.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool)
    fimg_b = bleed(fimg, inner)
    binner = inner & cv2.erode(bmask_al.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool)
    bimg_b = bleed(bimg, binner)
    atlas = np.concatenate([fimg_b, bimg_b], axis=1)  # 2048×1024
    natlas = np.concatenate([fabric_normal(fimg), fabric_normal(bimg)], axis=1)

    z = depth_field(fmask, garment)
    H, W = fmask.shape
    # vértices: contorno + grilla interior
    cpts = contour_points(fmask, 6)
    gy, gx = np.mgrid[6:H:14, 6:W:14]
    grid = np.stack([gx.ravel(), gy.ravel()], 1).astype(np.float32)
    dt = ndimage.distance_transform_edt(fmask)
    inside = dt[grid[:, 1].astype(int), grid[:, 0].astype(int)] > 7
    pts = np.vstack([cpts, grid[inside]])
    tri = Delaunay(pts)
    cen = pts[tri.simplices].mean(1)
    keep = fmask[np.clip(cen[:, 1].astype(int), 0, H - 1), np.clip(cen[:, 0].astype(int), 0, W - 1)]
    # descarta triángulos largos que cruzan concavidades (axilas, entrepierna)
    e = np.max(np.linalg.norm(pts[tri.simplices] - pts[tri.simplices][:, [1, 2, 0]], axis=2), axis=1)
    keep &= e < 34
    faces = tri.simplices[keep]
    nC = len(cpts)
    is_border = np.zeros(len(pts), bool); is_border[:nC] = True
    zz = cv2.remap(z, pts[:, 0].astype(np.float32), pts[:, 1].astype(np.float32), cv2.INTER_LINEAR).ravel() if False else z[np.clip(pts[:, 1].astype(int), 0, H - 1), np.clip(pts[:, 0].astype(int), 0, W - 1)]
    zz[is_border] = 0.0
    # escala a metros: una remera mide ~0,72 m de alto; un short ~0,52 m
    ys = np.where(fmask.any(1))[0]
    real_h = 0.72 if garment == 'tee' else 0.52
    s = real_h / (ys.max() - ys.min())
    X = (pts[:, 0] - W / 2) * s
    Y = -(pts[:, 1] - (ys.min() + ys.max()) / 2) * s
    Zf = zz * s
    V_front = np.stack([X, Y, Zf], 1)
    V_back = np.stack([X, Y, -Zf * 0.92], 1)
    uv_front = np.stack([pts[:, 0] / W * 0.5, 1 - pts[:, 1] / H], 1)
    uv_back = np.stack([0.5 + pts[:, 0] / W * 0.5, 1 - pts[:, 1] / H], 1)
    V = np.vstack([V_front, V_back])
    UV = np.vstack([uv_front, uv_back])
    n = len(pts)
    F = np.vstack([faces[:, [0, 2, 1]] if np.cross(V[faces[0, 1]] - V[faces[0, 0]], V[faces[0, 2]] - V[faces[0, 0]])[2] < 0 else faces, faces[:, ::-1] + n])
    # orienta caras: frente con normal +z
    fz = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])[:, 2]
    front_mask_faces = np.arange(len(F)) < len(faces)
    flip = (front_mask_faces & (fz < 0)) | (~front_mask_faces & (fz > 0))
    F[flip] = F[flip][:, ::-1]
    # normales suaves compartidas en la costura
    mesh = trimesh.Trimesh(V, F, process=False)
    N = mesh.vertex_normals.copy()
    for i in range(nC):
        avg = N[i] + N[i + n]
        avg /= np.linalg.norm(avg) + 1e-9
        N[i] = N[i + n] = avg
    tex = Image.fromarray(atlas)
    ntex = Image.fromarray(natlas)
    mat = trimesh.visual.material.PBRMaterial(baseColorTexture=tex, normalTexture=ntex, roughnessFactor=0.86, metallicFactor=0.0, doubleSided=True, name='tela')
    mesh = trimesh.Trimesh(V, F, vertex_normals=N, visual=trimesh.visual.TextureVisuals(uv=UV, material=mat), process=False)
    scene = trimesh.Scene(mesh)
    Path(out_glb).parent.mkdir(parents=True, exist_ok=True)
    scene.export(out_glb)
    if preview:
        Image.fromarray(atlas).resize((1024, 512)).save(preview)
    return {'verts': len(V), 'faces': len(F)}


if __name__ == '__main__':
    slug, f, b, g, out = sys.argv[1:6]
    prev = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    info = build(load_rgb(f), None if b == '-' else load_rgb(b), g, out, prev)
    print(json.dumps({'slug': slug, **info}))

"""Opción C (2.5D): foto recortada + mapa de profundidad (Depth Anything V2 small, ONNX) → relieve con parallax."""
import sys
from pathlib import Path
import numpy as np, cv2, onnxruntime as ort, trimesh
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
import garment3d as g

DA = str(Path(g.MODEL).with_name('depth_anything_v2_vits.onnx'))

def depth(img):
    x = cv2.resize(img, (518, 518)).astype(np.float32) / 255
    x = ((x - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]).transpose(2, 0, 1)[None].astype(np.float32)
    s = ort.InferenceSession(DA, providers=['CPUExecutionProvider'])
    d = s.run(None, {s.get_inputs()[0].name: x})[0][0]
    d = cv2.resize(d if d.ndim == 2 else d[0], (img.shape[1], img.shape[0]))
    return d

def build(front, garment, out):
    up, lo = g.cloth_masks(front, g.MODEL)
    m0 = g.clean_mask(up if garment == 'tee' else lo)
    img, m = g.canonical(front, m0)
    d = depth(img); d = (d - d[m].min()) / (d[m].max() - d[m].min() + 1e-6); d[~m] = 0
    H, W = m.shape
    step = 8
    ys, xs = np.mgrid[0:H:step, 0:W:step]
    inside = m[ys, xs]
    idx = -np.ones(ys.shape, int); idx[inside] = np.arange(inside.sum())
    s = 0.72 / np.ptp(np.where(m.any(1))[0])
    V = np.stack([(xs[inside] - W / 2) * s, -(ys[inside] - H / 2) * s, d[ys, xs][inside] * 0.12], 1)
    UV = np.stack([xs[inside] / W, 1 - ys[inside] / H], 1)
    F = []
    for i in range(ys.shape[0] - 1):
        for j in range(ys.shape[1] - 1):
            a, b, c, e = idx[i, j], idx[i, j + 1], idx[i + 1, j], idx[i + 1, j + 1]
            if min(a, b, c, e) >= 0:
                F += [[a, c, b], [b, c, e]]
    tex = Image.fromarray(g.bleed(img, cv2.erode(m.astype(np.uint8), np.ones((9, 9))).astype(bool)))
    mat = trimesh.visual.material.PBRMaterial(baseColorTexture=tex, roughnessFactor=0.85, doubleSided=True)
    mesh = trimesh.Trimesh(V, np.array(F), visual=trimesh.visual.TextureVisuals(uv=UV, material=mat), process=False)
    trimesh.Scene(mesh).export(out)

if __name__ == '__main__':
    build(g.load_rgb(sys.argv[1]), sys.argv[2], sys.argv[3])

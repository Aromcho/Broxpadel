"""
Curaduría del material real relevado (Tiendanube + Instagram) → media/curated/
- Fotos de producto en el orden y rol definidos en tools/catalog.json
- Limpia la marca de agua ✦ de Gemini (inpainting) en las fotos que la tienen
- Descarta duplicados (hash perceptual) entre Tiendanube e Instagram
- Recorta los reels en las tomas sin textos quemados ni caras de menores (intermedio CRF 14, sin audio)
- Toma los colores reales de cada prenda (muestreo en el pecho de la foto de frente)
Uso: python tools/curate.py
"""
import json, os, re, subprocess, sys
from pathlib import Path
import numpy as np
import cv2
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'media' / 'raw'
OUT = ROOT / 'media' / 'curated'
CAT = json.loads((ROOT / 'tools' / 'catalog.json').read_text())
TN = json.loads((RAW / 'tiendanube' / 'products.json').read_text())
TN_FILES = os.listdir(RAW / 'tiendanube' / 'img')


def tn_local(url: str) -> Path:
    name = url.split('/stores/006/758/106/')[1].replace('/', '__')
    base = re.sub(r'-\d+-\d+\.webp$', '', name)
    f = next(x for x in TN_FILES if x.startswith(base))
    return RAW / 'tiendanube' / 'img' / f


def load(p: Path) -> np.ndarray:
    return cv2.cvtColor(np.array(Image.open(p).convert('RGB')), cv2.COLOR_RGB2BGR)


def remove_sparkle(img: np.ndarray):
    """Detecta la estrella ✦ (marca de Gemini) en la esquina inferior derecha y la borra."""
    h, w = img.shape[:2]
    y0, x0 = h - 120, w - 120
    reg = img[y0:h - 4, x0:w - 4]
    g = cv2.cvtColor(reg, cv2.COLOR_BGR2GRAY).astype(int)
    bg = cv2.medianBlur(cv2.cvtColor(reg, cv2.COLOR_BGR2GRAY), 41).astype(int)
    m = ((g - bg) > 8).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m)
    mask = np.zeros((h, w), np.uint8)
    found = False
    for i in range(1, n):
        x, y, ww, hh, a = stats[i]
        if 250 < a < 3500 and 0.55 < ww / max(hh, 1) < 1.7 and 22 < ww < 95:
            mask[y0:h - 4, x0:w - 4][lab == i] = 255
            found = True
    if not found:
        return img, False
    mask = cv2.dilate(mask, np.ones((9, 9), np.uint8))
    return cv2.inpaint(img, mask, 9, cv2.INPAINT_TELEA), True


def dhash(img: np.ndarray, size=12):
    g = cv2.resize(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), (size + 1, size))
    return (g[:, 1:] > g[:, :-1]).flatten()


def chest_color(img: np.ndarray):
    """Color dominante en la zona del pecho (centro, tercio superior-medio)."""
    h, w = img.shape[:2]
    reg = img[int(h * 0.30):int(h * 0.55), int(w * 0.30):int(w * 0.70)].reshape(-1, 3).astype(np.float32)
    _, labels, centers = cv2.kmeans(reg, 3, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0), 3, cv2.KMEANS_PP_CENTERS)
    counts = np.bincount(labels.flatten())
    b, g, r = centers[np.argmax(counts)]
    return '#%02x%02x%02x' % (int(r), int(g), int(b))


def hem_color(img: np.ndarray):
    h, w = img.shape[:2]
    reg = img[int(h * 0.62):int(h * 0.75), int(w * 0.35):int(w * 0.65)].reshape(-1, 3)
    b, g, r = np.median(reg, axis=0)
    return '#%02x%02x%02x' % (int(r), int(g), int(b))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {'products': [], 'reels': [], 'brand': {}}
    for p in CAT['products']:
        tn = next(x for x in TN if x['url'].strip('/').endswith(p['tn']))
        d = OUT / 'products' / p['slug']
        d.mkdir(parents=True, exist_ok=True)
        imgs, hashes = [], []
        sources = [(tn_local(tn['slides'][i - 1]['url']), role, f"Tiendanube · foto {i}") for i, role in p['pick']]
        sources += [(RAW / 'ig' / 'posts' / next(x for x in os.listdir(RAW / 'ig' / 'posts') if x.endswith(code)) / f'{n}.jpg', role, f"Instagram {code} · foto {int(n)}") for code, n, role in p.get('igPick', [])]
        for k, (src, role, origin) in enumerate(sources):
            img = load(src)
            hsh = dhash(img)
            if any((hsh != h0).sum() < 14 for h0 in hashes):
                print(f'  dup {origin} ({p["slug"]})')
                continue
            hashes.append(hsh)
            img, cleaned = remove_sparkle(img)
            name = f'{len(imgs) + 1:02d}-{role}.jpg'
            cv2.imwrite(str(d / name), img, [cv2.IMWRITE_JPEG_QUALITY, 95])
            imgs.append({'file': f'products/{p["slug"]}/{name}', 'role': role, 'origin': origin, 'cleaned': cleaned, 'w': img.shape[1], 'h': img.shape[0]})
        front = load(OUT / imgs[0]['file'])
        variants = []
        for v in tn['variants']:
            size = v['o0'] if v['o0'] and not re.match(r'^[A-Za-z]+[a-z]', v['o0'] or '') else (v['o1'] or v['o0'])
            if size in ('Azul', 'Rojo', 'Celeste'): size = v['o0'] if v['o1'] in ('Azul', 'Rojo', 'Celeste') else v['o1']
            variants.append({'size': size or 'Único', 'price': v['price'], 'stock': v['stock']})
        manifest['products'].append({**{k: v for k, v in p.items() if k not in ('pick', 'igPick')},
                                     'price': p.get('price', tn['variants'][0]['price']),
                                     'description': (tn['desc'] or '').strip(), 'seo': tn['og'],
                                     'sourceUrl': 'https://broxpadel.mitiendanube.com' + tn['url'],
                                     'colorHex': chest_color(front), 'colorHex2': hem_color(front),
                                     'variants': variants, 'images': imgs})
        print(f'✔ {p["slug"]}: {len(imgs)} fotos, {len(variants)} talles, color {manifest["products"][-1]["colorHex"]}')

    vd = OUT / 'videos'
    vd.mkdir(parents=True, exist_ok=True)
    for r in CAT['reels']:
        out = vd / f'{r["key"]}.mp4'
        if not out.exists():
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(r['start']), '-to', str(r['end']), '-i', str(RAW / 'ig' / r['src']),
                            '-an', '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', '-pix_fmt', 'yuv420p', str(out)], check=True)
        manifest['reels'].append({**r, 'file': f'videos/{r["key"]}.mp4'})
        print(f'✔ reel {r["key"]}')
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()

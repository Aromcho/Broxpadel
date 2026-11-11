"""Genera los .glb de todas las prendas (opción B) a partir de media/curated/manifest.json → media/3d/raw/"""
import json, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
m = json.loads((ROOT / 'media/curated/manifest.json').read_text())
only = sys.argv[1:]
for p in m['products']:
    if only and p['slug'] not in only: continue
    imgs = p['images']
    front = next(i for i in imgs if i['role'] == 'front')
    back = next((i for i in imgs if i['role'] == 'back'), None)
    out = ROOT / 'media/3d/raw' / f"{p['slug']}.glb"
    cmd = [sys.executable, str(ROOT / 'tools/garment3d.py'), p['slug'], str(ROOT / 'media/curated' / front['file']),
           str(ROOT / 'media/curated' / back['file']) if back else '-', 'tee' if p['garment'] == 'tee' else 'shorts', str(out)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr[-400:], flush=True)

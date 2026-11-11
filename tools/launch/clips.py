"""Recorta las tomas de los reels para el video de lanzamiento → /tmp/launch/<toma>/%05d.png (1080x1920, 24 fps).
Cortes detectados con: ffmpeg -i reel.mp4 -vf "select='gt(scene,0.08)',metadata=print:key=lavfi.scene_score" -f null -
Se usan solo tomas enteras (entre dos cortes con puntaje > 0,3), sin texto encima, sin caras de cerca y sin menores."""
import os, shutil, subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
FF = str(ROOT / 'node_modules/ffmpeg-static/ffmpeg')
IG = ROOT / 'media/raw/ig/posts'
V = IG / '2026-08-06_Dbt3oKWsgbb/01.mp4'   # reel remera violeta (1080x1920, 24 fps)
D = IG / '2026-09-17_DdZN4MXMnil/01.mp4'   # reel colección (1080x1920, 30 fps)
FILL = 'scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920'
ZOOM = lambda y: f'scale=1350:2400:flags=lanczos,crop=1080:1920:135:{y}'   # acerca al pecho y deja la cara afuera
SEGS = [  # toma, archivo, inicio, fin, velocidad (<1 = cámara lenta), encuadre
    ('s1a', V, 0.06, 1.66, 0.667, FILL),   # canchas desde el drone
    ('s2a', D, 21.34, 24.88, 0.545, FILL), # cancha de noche (va desenfocada detrás del iPhone)
    ('s3a', D, 3.10, 3.98, 1.0, ZOOM(470)),     # remera celeste
    ('s3b', D, 6.00, 6.90, 1.0, ZOOM(230)),     # remera negra
    ('s3c', D, 8.52, 9.32, 1.0, FILL),     # short gris degradé
]
for name, f, a, b, sp, crop in SEGS:
    out = Path('/tmp/launch') / name; shutil.rmtree(out, ignore_errors=True); out.mkdir(parents=True)
    subprocess.run([FF, '-y', '-loglevel', 'error', '-ss', str(a), '-to', str(b), '-i', str(f), '-vf', f'setpts=(PTS-STARTPTS)/{sp},fps=24,{crop}', '-an', str(out / '%05d.png')], check=True)
    print(name, len(os.listdir(out)), 'cuadros')

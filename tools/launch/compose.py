"""Video de lanzamiento 1080x1920, 24 fps, ~13,5 s, sin audio.
Tomas de los reels de @broxpadel (cortes detectados con ffmpeg select='gt(scene,0.08)'), la tienda grabada en un iPhone
(record.mjs) y textos en Archivo (las fuentes de la marca). Nada en el 20 % inferior (lo tapa la interfaz de Instagram).
python tools/launch/compose.py → reel/brox-lanzamiento.mp4"""
import io, math, subprocess, sys
from pathlib import Path
import cairosvg
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

ROOT = Path(__file__).resolve().parents[2]
TMP = Path('/tmp/launch')
FONTS = ROOT / 'media/fonts'
FF = str(ROOT / 'node_modules/ffmpeg-static/ffmpeg')
W, H, FPS = 1080, 1920, 24
SAFE_BOTTOM = int(H * 0.8)
WHATSAPP = sys.argv[1] if len(sys.argv) > 1 else '2255 40-9164'
RED = (251, 35, 36); BALL = (217, 238, 59); WHITE = (255, 255, 255); NIGHT = (10, 15, 26)

def font(name, size): return ImageFont.truetype(str(FONTS / f'Archivo-{name}.ttf'), size)
def frames(d): return sorted((TMP / d).glob('*.png'))
def ease_out(x): x = max(0.0, min(1.0, x)); return 1 - (1 - x) ** 3
def ease_io(x): x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)

S1, S2 = frames('s1a'), frames('s2a')
S3 = frames('s3a') + frames('s3b') + frames('s3c')
CUT3B = len(frames('s3a'))               # corte interno de la toma 3 (cambia la segunda línea)
REC = frames('rec')
N1, N2, N3, N4 = len(S1), len(S2), len(S3), 43
TOTAL = N1 + N2 + N3 + N4

# ── recursos ──
def svg(path, width):
    return Image.open(io.BytesIO(cairosvg.svg2png(url=str(path), output_width=width))).convert('RGBA')
LOGO = svg(ROOT / 'media/brand/brox-logo.svg', 760)
LOGO_S = svg(ROOT / 'media/brand/brox-logo.svg', 600)

def glow(img, color, radius, strength):
    """halo del color pedido alrededor de la capa; devuelve una imagen con margen (pad = 3 × radio) para que el desenfoque no se corte"""
    pad = radius * 3
    a = Image.new('L', (img.width + pad * 2, img.height + pad * 2), 0); a.paste(img.split()[3], (pad, pad))
    a = a.filter(ImageFilter.GaussianBlur(radius)).point(lambda v: min(255, int(v * strength)))
    g = Image.new('RGBA', a.size, color + (0,)); g.putalpha(a); return g

def speed_lines(h=22):
    """las tres líneas de velocidad del logo, inclinadas"""
    im = Image.new('RGBA', (int(h * 3.4), h * 3), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for i, w in enumerate([1.0, 0.78, 0.56]):
        y = i * h * 1.05; x0 = (1 - w) * h * 3.0
        d.polygon([(x0 + h * 0.5, y), (h * 3.4, y), (h * 3.4 - h * 0.5, y + h * 0.62), (x0, y + h * 0.62)], fill=RED + (255,))
    return im

def text_img(txt, f, fill=WHITE, shadow=True, tracking=0):
    bbox = f.getbbox(txt)
    w, h = bbox[2] - bbox[0] + 40, bbox[3] - bbox[1] + 40
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.text((20 - bbox[0], 20 - bbox[1]), txt, font=f, fill=fill)
    if shadow:
        sh = Image.new('RGBA', im.size, (0, 0, 0, 0)); sh.putalpha(im.split()[3].filter(ImageFilter.GaussianBlur(14)).point(lambda v: int(v * 0.75)))
        base = Image.new('RGBA', im.size, (0, 0, 0, 0)); base.alpha_composite(sh, (0, 6)); base.alpha_composite(im); im = base
    return im

def put(canvas, layer, cx, top, alpha=1.0, dy=0, check=True):
    """pega una capa centrada en cx, con opacidad y desplazamiento vertical (subida suave)"""
    if alpha <= 0: return
    if alpha < 1:
        layer = layer.copy(); layer.putalpha(layer.split()[3].point(lambda v: int(v * alpha)))
    x = int(cx - layer.width / 2); y = int(top + dy)
    if check: assert y - dy + layer.height <= SAFE_BOTTOM, f'capa en el 20% inferior ({y + layer.height})'
    canvas.alpha_composite(layer, (x, y))

def reveal(t, start, dur=0.45, rise=36):
    """(opacidad, desplazamiento) para un fade + subida que arranca en `start` segundos"""
    k = ease_out((t - start) / dur); return k, (1 - k) * rise

def exit_alpha(f, last, n=5):
    return max(0.0, min(1.0, (last - f) / n))

def grad_top(h1, strength=0.75):
    g = Image.new('L', (1, H))
    for y in range(H): g.putpixel((0, y), int(255 * strength * max(0, 1 - y / h1) ** 1.6))
    return g.resize((W, H))

def radial_center(cy, rx, ry, strength):
    small = Image.new('L', (W // 8, H // 8))
    for y in range(small.height):
        for x in range(small.width):
            d = math.hypot((x * 8 - W / 2) / rx, (y * 8 - cy) / ry)
            small.putpixel((x, y), int(255 * strength * max(0, 1 - d) ** 1.2))
    return small.resize((W, H), Image.BILINEAR)

def darken(img, mask):
    return Image.composite(Image.new('RGB', img.size, (5, 7, 12)), img, mask)

GLOW1 = glow(LOGO, RED, 26, 0.55)
GLOW_C = glow(LOGO_S, RED, 34, 0.75)

# ── textos pre-renderizados ──
T1_TAG = text_img('Tienda online', font('Head', 92))
T2_A = text_img('Ahora, también online', font('Display', 64))
T2_B = text_img('Mirá la tienda desde tu celular', font('Cond', 50), fill=(235, 235, 235))
T3_A1 = text_img('Remeras y shorts', font('Display', 80))
T3_A2 = text_img('de pádel', font('Display', 80))
T3_B = text_img('Elegí tu talle y comprá online', font('Cond', 56), fill=BALL)
C_HANDLE = text_img('broxpadel.online', font('Head', 58))
C_WA = text_img(f'WhatsApp {WHATSAPP}', font('Cond', 50), fill=(240, 240, 240))
C_CITY = text_img('Villa Gesell, Buenos Aires', font('Cond', 44), fill=(200, 200, 205))
SPEED = speed_lines(20)

def pill(txt):
    f = font('Head', 54); t = text_img(txt, f, shadow=False)
    w, h = t.width + 70, t.height + 18
    im = Image.new('RGBA', (w * 2, h * 2), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, w * 2 - 1, h * 2 - 1), radius=h, fill=RED + (255,))
    im = im.resize((w, h), Image.LANCZOS); im.alpha_composite(t, ((w - t.width) // 2, (h - t.height) // 2 + 2))
    g = glow(im, RED, 22, 0.7)            # margen 66 px
    out = Image.new('RGBA', g.size, (0, 0, 0, 0)); out.alpha_composite(g); out.alpha_composite(im, (66, 66)); return out
C_PILL = pill('Link en la bio')

# ── iPhone dibujado ──
SCR_W = 500; REC_W, REC_H = 780, 1594             # grabación 390x797 @2x
SB_H = round(SCR_W * 47 / 390)                     # barra de estado
SCR_H = SB_H + round(SCR_W * REC_H / REC_W)
BEZ = 16; PH_W, PH_H = SCR_W + BEZ * 2, SCR_H + BEZ * 2
PH_TOP = 400
def rounded_mask(w, h, r, ss=3):
    m = Image.new('L', (w * ss, h * ss), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, w * ss - 1, h * ss - 1), radius=r * ss, fill=255)
    return m.resize((w, h), Image.LANCZOS)
SCR_MASK = rounded_mask(SCR_W, SCR_H, 58)
def phone_body():
    ss = 3; im = Image.new('RGBA', (PH_W * ss, PH_H * ss), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, PH_W * ss - 1, PH_H * ss - 1), radius=74 * ss, fill=(22, 24, 30, 255))
    d.rounded_rectangle((3 * ss, 3 * ss, PH_W * ss - 3 * ss, PH_H * ss - 3 * ss), radius=71 * ss, outline=(92, 96, 108, 255), width=2 * ss)
    im = im.resize((PH_W, PH_H), Image.LANCZOS)
    for x, y0, y1 in [(-3, 230, 330), (-3, 360, 460), (PH_W, 300, 440)]:   # botones laterales
        ImageDraw.Draw(im).rounded_rectangle((x - 1, y0, x + 3, y1), radius=2, fill=(60, 62, 70, 255))
    return im
PHONE = phone_body()
ISLAND = rounded_mask(124, 36, 18)
def status_bar(bg):
    lum = 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2]
    fg = (10, 10, 12) if lum > 140 else (255, 255, 255)
    sb = Image.new('RGBA', (SCR_W, SB_H), bg + (255,)); d = ImageDraw.Draw(sb)
    d.text((54, SB_H / 2 + 3), '9:41', font=font('Num', 24), fill=fg, anchor='mm')
    x = SCR_W - 52
    d.rounded_rectangle((x - 16, SB_H / 2 - 6, x + 16, SB_H / 2 + 8), radius=4, outline=fg, width=2)   # batería
    d.rectangle((x - 13, SB_H / 2 - 3, x + 9, SB_H / 2 + 5), fill=fg)
    for i, hgt in enumerate([5, 8, 11, 14]):                                                      # señal
        d.rectangle((x - 70 + i * 7, SB_H / 2 + 8 - hgt, x - 66 + i * 7, SB_H / 2 + 8), fill=fg)
    return sb
def phone_with(rec_frame):
    rec = Image.open(rec_frame).convert('RGB')
    bg = rec.getpixel((REC_W // 2, 2))
    screen = Image.new('RGBA', (SCR_W, SCR_H), (0, 0, 0, 255))
    screen.paste(rec.resize((SCR_W, SCR_H - SB_H), Image.LANCZOS), (0, SB_H))
    screen.alpha_composite(status_bar(bg), (0, 0))
    isl = Image.new('RGBA', ISLAND.size, (0, 0, 0, 255)); isl.putalpha(ISLAND)
    screen.alpha_composite(isl, ((SCR_W - 124) // 2, 11))
    screen.putalpha(SCR_MASK)
    ph = PHONE.copy(); ph.alpha_composite(screen, (BEZ, BEZ)); return ph
SHADOW = Image.new('RGBA', (PH_W + 160, PH_H + 160), (0, 0, 0, 0))
ImageDraw.Draw(SHADOW).rounded_rectangle((80, 100, PH_W + 80, PH_H + 90), radius=80, fill=(0, 0, 0, 170))
SHADOW = SHADOW.filter(ImageFilter.GaussianBlur(36))

# máscaras de oscurecido
M1 = radial_center(880, 760, 520, 0.78)
M3 = grad_top(900, 0.85)

def frame(f):
    if f < N1:                                     # ── toma 1: nombre + Tienda online ──
        t = f / FPS
        bg = darken(Image.open(S1[f]).convert('RGB'), M1).convert('RGBA')
        ex = exit_alpha(f, N1 - 1)
        a, dy = reveal(t, 0.10, 0.55, 46)
        put(bg, GLOW1, W / 2, 640 - 78, a * ex, dy, check=False); put(bg, LOGO, W / 2, 640, a * ex, dy)
        a, dy = reveal(t, 0.55)
        row = Image.new('RGBA', (SPEED.width + 24 + T1_TAG.width, max(SPEED.height, T1_TAG.height)), (0, 0, 0, 0))
        row.alpha_composite(SPEED, (0, (row.height - SPEED.height) // 2 + 2)); row.alpha_composite(T1_TAG, (SPEED.width + 24, 0))
        put(bg, row, W / 2, 940, a * ex, dy)
        return bg
    f2 = f - N1
    if f2 < N2:                                    # ── toma 2: la tienda en el iPhone ──
        t = f2 / FPS
        src = Image.open(S2[f2]).convert('RGB')
        small = src.resize((W // 4, H // 4), Image.BILINEAR).filter(ImageFilter.GaussianBlur(7))
        bg = ImageEnhance.Brightness(small.resize((W, H), Image.BICUBIC)).enhance(0.42).convert('RGBA')
        ex = exit_alpha(f2, N2 - 1)
        a, dy = reveal(t, 0.12, 0.5, 40); put(bg, T2_A, W / 2, 170, a * ex, dy)
        a, dy = reveal(t, 0.42, 0.5, 30); put(bg, T2_B, W / 2, 258, a * ex, dy)
        k = ease_out(t / 0.7)
        speed = (len(REC) - 1) / max(1, (N2 - 12))
        ri = min(len(REC) - 1, max(0, int((f2 - 8) * speed)))
        ph = phone_with(REC[ri])
        y = PH_TOP + (1 - k) * 140
        sh = SHADOW.copy(); sh.putalpha(sh.split()[3].point(lambda v: int(v * k)))
        bg.alpha_composite(sh, (int(W / 2 - SHADOW.width / 2), int(y - 80)))
        put(bg, ph, W / 2, y, min(1, k * 1.4) * ex, check=False)   # entra subiendo; quieto termina en y=1514
        assert PH_TOP + PH_H <= SAFE_BOTTOM
        return bg
    f3 = f2 - N2
    if f3 < N3:                                    # ── toma 3: qué venden + compra online ──
        t = f3 / FPS
        bg = darken(Image.open(S3[f3]).convert('RGB'), M3).convert('RGBA')
        ex = exit_alpha(f3, N3 - 1)
        a, dy = reveal(t, 0.06, 0.45, 40); put(bg, T3_A1, W / 2, 210, a * ex, dy); put(bg, T3_A2, W / 2, 308, a * ex, dy)
        a, dy = reveal(t, CUT3B / FPS, 0.45, 30)
        row = Image.new('RGBA', (SPEED.width + 20 + T3_B.width, max(SPEED.height, T3_B.height)), (0, 0, 0, 0))
        row.alpha_composite(SPEED, (0, (row.height - SPEED.height) // 2 + 2)); row.alpha_composite(T3_B, (SPEED.width + 20, 0))
        put(bg, row, W / 2, 430, a * ex, dy)
        return bg
    f4 = f3 - N3                                   # ── cierre: cuadro congelado con zoom lento ──
    t = f4 / FPS
    z = 1 + 0.07 * ease_io(f4 / (N4 - 1))
    last = Image.open(S3[-1]).convert('RGB')
    zw, zh = int(W * z), int(H * z)
    img = last.resize((zw, zh), Image.LANCZOS).crop(((zw - W) // 2, (zh - H) // 2, (zw - W) // 2 + W, (zh - H) // 2 + H))
    img = ImageEnhance.Brightness(img.filter(ImageFilter.GaussianBlur(4 * ease_out(t / 0.4)))).enhance(1 - 0.62 * ease_out(t / 0.35))
    bg = img.convert('RGBA')
    a, dy = reveal(t, 0.05, 0.5, 40)
    put(bg, GLOW_C, W / 2, 480 - 102, a, dy, check=False); put(bg, LOGO_S, W / 2, 480, a, dy)
    a, dy = reveal(t, 0.28); put(bg, C_HANDLE, W / 2, 720, a, dy)
    a, dy = reveal(t, 0.45); put(bg, C_PILL, W / 2, 814, a, dy)
    a, dy = reveal(t, 0.62); put(bg, C_WA, W / 2, 1030, a, dy)
    a, dy = reveal(t, 0.72); put(bg, C_CITY, W / 2, 1105, a, dy)
    return bg

if __name__ == '__main__':
    out = ROOT / 'reel/brox-lanzamiento.mp4'; out.parent.mkdir(exist_ok=True)
    only = [int(x) for x in sys.argv[2:]] if len(sys.argv) > 2 else None
    if only:   # prueba: cuadros sueltos a /tmp/launch/test_<n>.jpg
        for f in only: frame(f).convert('RGB').save(f'/tmp/launch/test_{f}.jpg', quality=85)
        sys.exit()
    ff = subprocess.Popen([FF, '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                           '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', str(out)], stdin=subprocess.PIPE)
    for f in range(TOTAL):
        ff.stdin.write(frame(f).convert('RGB').tobytes())
        if f % 24 == 0: print(f'{f}/{TOTAL}', flush=True)
    ff.stdin.close(); ff.wait()
    print('✔', out, f'{TOTAL / FPS:.2f} s')

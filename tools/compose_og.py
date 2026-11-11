"""Pósters WebP de la cancha + imagen Open Graph (1200x630) con la escena real, el logo y la frase."""
import io
from pathlib import Path
import cairosvg
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
PUB = ROOT / 'apps/web/public'
F = ROOT / 'media/fonts'
(PUB / 'court').mkdir(exist_ok=True)

d = Image.open('/tmp/posters/d.png').convert('RGB')
m = Image.open('/tmp/posters/m.png').convert('RGB')
d.save(PUB / 'court/poster-d.webp', quality=78, method=6)
m.save(PUB / 'court/poster-m.webp', quality=78, method=6)

# OG: escena recortada, degradé a la izquierda para el texto
og = d.resize((1200, 675), Image.LANCZOS).crop((0, 30, 1200, 660))
shade = Image.new('L', og.size)
sd = ImageDraw.Draw(shade)
for x in range(og.width):
    a = max(0, 1 - x / 760) ** 1.4
    sd.line([(x, 0), (x, og.height)], fill=int(225 * a))
og = Image.composite(Image.new('RGB', og.size, (8, 11, 20)), og, shade)
logo_png = cairosvg.svg2png(url=str(ROOT / 'media/brand/brox-logo.svg'), output_width=520)
logo = Image.open(io.BytesIO(logo_png)).convert('RGBA')
glow = Image.new('RGBA', og.size, (0, 0, 0, 0))
glow.alpha_composite(logo, (70, 120))
blur = glow.filter(ImageFilter.GaussianBlur(18))
r, g, b, a = blur.split()
blur = Image.merge('RGBA', (r, g, b, a.point(lambda v: int(v * 0.35))))
og = og.convert('RGBA')
og.alpha_composite(blur)
og.alpha_composite(logo, (70, 120))
dr = ImageDraw.Draw(og)
head = ImageFont.truetype(str(F / 'Archivo-Head.ttf'), 50)
cond = ImageFont.truetype(str(F / 'Archivo-Cond.ttf'), 30)
y = 120 + logo.height + 46
dr.text((74, y), 'Ropa que rinde como vos.', font=head, fill=(255, 255, 255))
dr.text((76, y + 72), 'Remeras y shorts de pádel con envío a todo el país', font=cond, fill=(217, 238, 59))
og.convert('RGB').save(PUB / 'og.jpg', quality=88)
print('ok', logo.size)

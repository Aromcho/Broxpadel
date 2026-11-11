"""Genera un .usdz (AR en iPhone, Quick Look) por cada GLB optimizado, con el USDZExporter de three en Chromium."""
import asyncio, base64, subprocess, sys, time
from pathlib import Path
from playwright.async_api import async_playwright
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'media/3d/usdz'; OUT.mkdir(parents=True, exist_ok=True)

async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        async with async_playwright() as pw:
            b = await pw.chromium.launch()
            p = await b.new_page()
            p.on('console', lambda m: print('  ', m.text) if m.type == 'error' else None)
            await p.goto('http://127.0.0.1:8765/tools/usdz.html')
            await p.wait_for_function('window.ready')
            for glb in sorted((ROOT / 'media/3d/optimized').glob('*.glb')):
                data = await p.evaluate('(u) => window.toUsdz(u)', f'/media/3d/optimized/{glb.name}')
                out = OUT / f'{glb.stem}.usdz'
                out.write_bytes(base64.b64decode(data))
                print(f'{glb.stem}: {out.stat().st_size/1e6:.2f} MB')
            await b.close()
    finally:
        srv.terminate()

asyncio.run(main())

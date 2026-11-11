// Optimiza los .glb: meshopt + texturas WebP (≤2048) → media/3d/optimized/  (node tools/optimize-models.mjs)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, textureCompress, meshopt, resample } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { readdirSync, mkdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'media/3d/raw'), out = join(root, 'media/3d/optimized');
mkdirSync(out, { recursive: true });
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
for (const f of readdirSync(src).filter((x) => x.endsWith('.glb'))) {
  const doc = await io.read(join(src, f));
  await doc.transform(dedup(), prune(), weld(), resample(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [2048, 1024], quality: 84 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(join(out, f), doc);
  console.log(`${f}: ${(statSync(join(src, f)).size / 1e6).toFixed(2)} MB → ${(statSync(join(out, f)).size / 1e6).toFixed(2)} MB`);
}

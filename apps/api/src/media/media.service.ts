import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdirSync, existsSync, statSync, copyFileSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join, extname, basename } from 'path';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/db';
import { mediaDir } from '../config';
import type { ImageVariant, VideoSources } from '../db/schema';

const run = promisify(execFile);
export const IMAGE_WIDTHS = [320, 640, 960, 1280, 1920];

function ffmpegBin() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try { return require('ffmpeg-static') as string; } catch { return 'ffmpeg'; }
}
function ffprobeBin() {
  if (process.env.FFPROBE_PATH) return process.env.FFPROBE_PATH;
  try { return (require('ffprobe-static') as { path: string }).path; } catch { return 'ffprobe'; }
}

export type VideoOpts = {
  /** recorte en segundos para sacar placas con texto */
  start?: number; end?: number;
  /** recorte manual (px del original) para el 9:16 y el 16:9 sin textos quemados */
  vCrop?: { x: number; y: number; w: number; h: number };
  hCrop?: { x: number; y: number; w: number; h: number };
};

@Injectable()
export class MediaService {
  private log = new Logger('Media');

  private dir(sub: string) {
    const d = join(mediaDir, sub);
    mkdirSync(d, { recursive: true });
    return d;
  }
  private hash(buf: Buffer) {
    return createHash('sha1').update(buf).digest('hex').slice(0, 12);
  }

  /** WebP en varios anchos + placeholder borroso + color dominante */
  async processImage(input: Buffer | string, meta: { title?: string; alt?: string; originalName?: string; source?: string; tags?: string[] } = {}) {
    const buf = typeof input === 'string' ? readFileSync(input) : input;
    const h = this.hash(buf);
    const img = sharp(buf, { failOn: 'none' }).rotate();
    const m = await img.metadata();
    const W = m.autoOrient?.width ?? m.width ?? 0;
    const H = m.autoOrient?.height ?? m.height ?? 0;
    const out = this.dir('img');
    const widths = IMAGE_WIDTHS.filter((w) => w < W);
    if (!widths.length || widths[widths.length - 1] < W) widths.push(Math.min(W, 2400));
    const variants: ImageVariant[] = [];
    for (const w of widths) {
      const file = `${h}-${w}.webp`;
      const p = join(out, file);
      if (!existsSync(p)) await sharp(buf, { failOn: 'none' }).rotate().resize({ width: w }).webp({ quality: 80, effort: 5 }).toFile(p);
      variants.push({ w, h: Math.round((H * w) / W), url: `/media/img/${file}` });
    }
    const tiny = await sharp(buf, { failOn: 'none' }).rotate().resize({ width: 20 }).webp({ quality: 40 }).toBuffer();
    const { dominant } = await sharp(buf, { failOn: 'none' }).stats();
    const hex = '#' + [dominant.r, dominant.g, dominant.b].map((v) => v.toString(16).padStart(2, '0')).join('');
    const largest = variants[variants.length - 1];
    const [row] = await db.insert(schema.media).values({
      kind: 'image', title: meta.title ?? null, alt: meta.alt ?? null, originalName: meta.originalName ?? null,
      url: largest.url, mime: 'image/webp', size: statSync(join(mediaDir, largest.url.replace('/media/', ''))).size,
      width: W, height: H, blur: `data:image/webp;base64,${tiny.toString('base64')}`, dominant: hex, variants,
      source: meta.source ?? null, tags: meta.tags ?? [],
    }).returning();
    return row;
  }

  async probe(file: string) {
    const { stdout } = await run(ffprobeBin(), ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', file]);
    const j = JSON.parse(stdout);
    return { width: j.streams?.[0]?.width as number, height: j.streams?.[0]?.height as number, duration: Number(j.format?.duration ?? 0) };
  }

  private async ff(args: string[]) {
    await run(ffmpegBin(), ['-hide_banner', '-loglevel', 'error', '-y', ...args], { maxBuffer: 1 << 26 });
  }

  /** MP4 H.264 + WebM VP9 en 720p y 1080p, recortes 9:16 y 16:9, póster WebP, sin audio. */
  async processVideo(file: string, meta: { title?: string; alt?: string; originalName?: string; source?: string; tags?: string[] } = {}, opts: VideoOpts = {}) {
    const buf = readFileSync(file);
    const h = this.hash(Buffer.concat([buf.subarray(0, 1 << 20), Buffer.from(JSON.stringify(opts))]));
    const out = this.dir('video');
    const info = await this.probe(file);
    const trim = [...(opts.start ? ['-ss', String(opts.start)] : []), ...(opts.end ? ['-to', String(opts.end)] : [])];
    const vertical = info.height >= info.width;
    const sources: VideoSources = {};
    const mp4 = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an'];
    const webm = ['-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34', '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1', '-an'];
    const short = Math.min(info.width, info.height);
    const sizes = [720, 1080].filter((s, i) => i === 0 || short >= 1000);
    for (const s of sizes) {
      const scale = vertical ? `scale=${s}:-2` : `scale=-2:${s}`;
      const fm = `${h}-${s}.mp4`;
      const fw = `${h}-${s}.webm`;
      if (!existsSync(join(out, fm))) await this.ff([...trim, '-i', file, '-vf', `${scale},fps=30`, ...mp4, join(out, fm)]);
      if (!existsSync(join(out, fw))) await this.ff([...trim, '-i', file, '-vf', `${scale},fps=30`, ...webm, join(out, fw)]);
      (sources as Record<string, string>)[`mp4_${s}`] = `/media/video/${fm}`;
      (sources as Record<string, string>)[`webm_${s}`] = `/media/video/${fw}`;
    }
    // recortes: 9:16 (vertical) y 16:9 (horizontal), sin textos quemados si se pasa el recorte manual
    const crop = (c: VideoOpts['vCrop'], ar: number) => {
      if (c) return `crop=${c.w}:${c.h}:${c.x}:${c.y}`;
      return info.width / info.height > ar ? `crop=ih*${ar}:ih` : `crop=iw:iw/${ar}`;
    };
    const vf = `${crop(opts.vCrop, 9 / 16)},scale=720:-2,fps=30`;
    const hf = `${crop(opts.hCrop, 16 / 9)},scale=1280:-2,fps=30`;
    for (const [key, filter] of [['v', vf], ['h', hf]] as const) {
      const fm = `${h}-${key}.mp4`;
      const fw = `${h}-${key}.webm`;
      if (!existsSync(join(out, fm))) await this.ff([...trim, '-i', file, '-vf', filter, ...mp4, join(out, fm)]);
      if (!existsSync(join(out, fw))) await this.ff([...trim, '-i', file, '-vf', filter, ...webm, join(out, fw)]);
      (sources as Record<string, string>)[`${key}_mp4`] = `/media/video/${fm}`;
      (sources as Record<string, string>)[`${key}_webm`] = `/media/video/${fw}`;
    }
    // póster
    const posterPng = join(out, `${h}-poster.png`);
    const dur = (opts.end ?? info.duration) - (opts.start ?? 0);
    await this.ff([...(opts.start ? ['-ss', String(opts.start + Math.min(1, dur / 3))] : ['-ss', String(Math.min(1, dur / 3))]), '-i', file, '-frames:v', '1', posterPng]);
    const poster = await this.processImage(readFileSync(posterPng), { title: `${meta.title ?? 'video'} (póster)`, source: meta.source, tags: ['poster'] });
    unlinkSync(posterPng);
    const main = sources.mp4_1080 ?? sources.mp4_720!;
    const [row] = await db.insert(schema.media).values({
      kind: 'video', title: meta.title ?? null, alt: meta.alt ?? null, originalName: meta.originalName ?? basename(file),
      url: main, mime: 'video/mp4', size: statSync(join(mediaDir, main.replace('/media/', ''))).size,
      width: vertical ? (sizes.includes(1080) ? 1080 : 720) : Math.round((info.width / info.height) * (sizes.includes(1080) ? 1080 : 720)),
      height: vertical ? Math.round((info.height / info.width) * (sizes.includes(1080) ? 1080 : 720)) : (sizes.includes(1080) ? 1080 : 720),
      duration: dur, blur: poster.blur, dominant: poster.dominant, sources, posterId: poster.id,
      source: meta.source ?? null, tags: meta.tags ?? [],
    }).returning();
    return row;
  }

  /** Optimiza un .glb (meshopt + texturas WebP ≤2048) y lo registra. */
  async processModel(file: string, meta: { title?: string; originalName?: string; source?: string } = {}) {
    const { NodeIO } = await import('@gltf-transform/core');
    const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
    const fns = await import('@gltf-transform/functions');
    const { MeshoptEncoder, MeshoptDecoder } = await import('meshoptimizer');
    await MeshoptEncoder.ready; await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
    const doc = await io.read(file);
    await doc.transform(
      fns.dedup(), fns.prune(), fns.weld(),
      fns.textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [2048, 2048], quality: 82 }),
      fns.meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    );
    const bin = await io.writeBinary(doc);
    const h = this.hash(Buffer.from(bin));
    const name = `${h}.glb`;
    writeFileSync(join(this.dir('models'), name), bin);
    const [row] = await db.insert(schema.media).values({
      kind: 'model', title: meta.title ?? null, originalName: meta.originalName ?? basename(file), url: `/media/models/${name}`,
      mime: 'model/gltf-binary', size: bin.byteLength, source: meta.source ?? null,
    }).returning();
    return row;
  }

  /** Registra un .glb ya optimizado (seed) sin volver a procesarlo. */
  async storeModel(file: string, meta: { title?: string; source?: string } = {}) {
    const buf = readFileSync(file);
    const name = `${this.hash(buf)}.glb`;
    const dest = join(this.dir('models'), name);
    if (!existsSync(dest)) copyFileSync(file, dest);
    const [row] = await db.insert(schema.media).values({
      kind: 'model', title: meta.title ?? null, originalName: basename(file), url: `/media/models/${name}`,
      mime: 'model/gltf-binary', size: buf.length, source: meta.source ?? null,
    }).returning();
    return row;
  }

  /** Guarda un .usdz tal cual (Quick Look en iPhone). */
  async storeUsdz(file: string, meta: { title?: string; originalName?: string } = {}) {
    const buf = readFileSync(file);
    const name = `${this.hash(buf)}.usdz`;
    copyFileSync(file, join(this.dir('models'), name));
    const [row] = await db.insert(schema.media).values({
      kind: 'usdz', title: meta.title ?? null, originalName: meta.originalName ?? basename(file), url: `/media/models/${name}`,
      mime: 'model/vnd.usdz+zip', size: buf.length,
    }).returning();
    return row;
  }

  async processUpload(file: Express.Multer.File, title?: string) {
    const ext = extname(file.originalname).toLowerCase();
    const meta = { title: title || file.originalname.replace(/\.[^.]+$/, ''), originalName: file.originalname, source: 'upload' };
    try {
      if (file.mimetype.startsWith('image/')) return await this.processImage(file.path, meta);
      if (file.mimetype.startsWith('video/') || ['.mp4', '.mov', '.webm', '.m4v'].includes(ext)) return await this.processVideo(file.path, meta);
      if (ext === '.glb') return await this.processModel(file.path, meta);
      if (ext === '.usdz') return await this.storeUsdz(file.path, meta);
      throw new Error('Formato no soportado (imágenes, videos, .glb o .usdz)');
    } finally {
      try { unlinkSync(file.path); } catch { /* */ }
    }
  }

  async withPoster<T extends { posterId: number | null }>(rows: T[]) {
    return rows;
  }

  async remove(id: number) {
    await db.delete(schema.media).where(eq(schema.media.id, id));
  }
}

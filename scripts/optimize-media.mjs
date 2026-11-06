/* Optimized copies of the media, made automatically. Originals are never
   touched.

     src/assets/video/<stem>.<ext>   →  src/assets/optimized/video/<stem>.desktop.mp4  (1920 wide, ~3.5 Mbps)
                                        src/assets/optimized/video/<stem>.mobile.mp4   (720 wide, ~1.4 Mbps)
     src/assets/traffic/<name>       →  src/assets/optimized/traffic/<stem>.jpg        (360 px long edge)
     src/assets/modal/<image>        →  src/assets/optimized/modal/<stem>.jpg          (2400 px long edge)
     src/assets/modal/<video>        →  src/assets/optimized/modal/<stem>.{desktop,mobile}.mp4

   Uses only what ships with macOS: AVFoundation (a small Swift transcoder,
   compiled once into node_modules/.cache) and `sips`. Up-to-date copies are
   skipped. Run directly (`npm run optimize`), or let the dev server's media
   plugin (vite.config.js) run it on start, on new files, and before builds. */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, mkdir, readdir, rename, rm, stat, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const run = promisify(execFile);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const A = (...p) => path.join(ROOT, 'src/assets', ...p);
const BIN = path.join(ROOT, 'node_modules/.cache/also-transcode');

export const VIDEO_EXT = ['.mp4', '.mov', '.webm', '.m4v'];
export const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
const VIDEO_VARIANTS = [
  { name: 'desktop', width: 1920, bps: 3_500_000 },
  { name: 'mobile', width: 720, bps: 1_400_000 },
];
const THUMB = 360;
// The Explore modal's media is shown large: a lighter copy, not a thumbnail.
const MODAL_IMAGE = 2400;

// Each copy is written to a temporary name and moved into place, so a page
// never reads a half-written file and two runs can't trip over each other.
const tmpFor = (out) => `${out}.${process.pid}.tmp${path.extname(out)}`;

const stemOf = (f) => path.basename(f).replace(/\.[^.]+$/, '');
const mtime = (f) => stat(f).then((s) => s.mtimeMs, () => 0);
// A copy is stale if its source *or these settings* (this file) are newer —
// so changing a bitrate or size here regenerates everything.
const SELF = fileURLToPath(import.meta.url);
const sourceTime = async (file) => Math.max(await mtime(file), await mtime(SELF));

let built = null;
async function transcoder() {
  if (!built) built = (async () => {
    const src = path.join(ROOT, 'scripts/transcode.swift');
    if (await mtime(BIN) >= await mtime(src)) return BIN;
    await mkdir(path.dirname(BIN), { recursive: true });
    await run('swiftc', ['-O', src, '-o', BIN]);
    return BIN;
  })();
  return built;
}

export async function optimizeVideo(file, log = console.log, folder = 'video') {
  if (!VIDEO_EXT.includes(path.extname(file).toLowerCase())) return;
  const outDir = A('optimized', folder);
  await mkdir(outDir, { recursive: true });
  const srcTime = await sourceTime(file);
  for (const v of VIDEO_VARIANTS) {
    const out = path.join(outDir, `${stemOf(file)}.${v.name}.mp4`);
    if (await mtime(out) >= srcTime) continue;
    const bin = await transcoder();
    const t0 = Date.now();
    const tmp = tmpFor(out);
    await rm(tmp, { force: true });
    const { stdout } = await run(bin, [file, tmp, String(v.width), String(v.bps)], { maxBuffer: 1 << 20 });
    // An MP4 that's already lighter than the re-encode is used as it is.
    const [outSize, srcSize] = [(await stat(tmp)).size, (await stat(file)).size];
    const keep = path.extname(file).toLowerCase() === '.mp4' && srcSize < outSize;
    if (keep) await copyFile(file, tmp);
    await rename(tmp, out);
    const kb = Math.round(Math.min(outSize, keep ? srcSize : outSize) / 1024);
    log(`[media] ${path.basename(file)} → ${v.name} ${keep ? '(original is smaller, kept)' : stdout.trim()} ${(kb / 1024).toFixed(1)} MB (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
}

export async function optimizeImage(file, folder, log = console.log) {
  const size = folder === 'modal' ? MODAL_IMAGE : THUMB;
  const quality = folder === 'modal' ? '82' : '75';
  if (!IMAGE_EXT.includes(path.extname(file).toLowerCase())) return;
  const outDir = A('optimized', folder);
  await mkdir(outDir, { recursive: true });
  const out = path.join(outDir, `${stemOf(file)}.jpg`);
  if (await mtime(out) >= await sourceTime(file)) return;
  // Only ever smaller: sips -Z would enlarge an image already under the size.
  const { stdout } = await run('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file]);
  const long = Math.max(...[...stdout.matchAll(/pixel(?:Width|Height): (\d+)/g)].map((m) => +m[1]));
  const resize = long > size ? ['-Z', String(size)] : [];
  const tmp = tmpFor(out);
  await run('sips', [...resize, '-s', 'format', 'jpeg', '-s', 'formatOptions', quality, file, '--out', tmp]);
  await rename(tmp, out);
  log(`[media] ${path.basename(file)} → ${folder === 'modal' ? 'web copy' : 'thumbnail'}`);
}

export async function optimizeAll(log = console.log) {
  const list = (dir) => readdir(A(dir)).then((fs) => fs.filter((f) => !f.startsWith('.')).map((f) => A(dir, f)), () => []);
  for (const f of await list('traffic')) await optimizeImage(f, 'traffic', log);
  for (const f of await list('video')) await optimizeVideo(f, log);
  for (const f of await list('modal')) {
    await optimizeImage(f, 'modal', log);
    await optimizeVideo(f, log, 'modal');
  }
  await prune(log);
}

// Copies whose original is gone (deleted, or a folder no longer used) are
// removed, so nothing stale ships. Only ever touches src/assets/optimized.
export async function prune(log = console.log) {
  const names = (dir) => readdir(dir).then((fs) => fs.filter((f) => !f.startsWith('.')), () => []);
  for (const folder of await names(A('optimized'))) {
    const sources = new Set((await names(A(folder))).map(stemOf));
    for (const f of await names(A('optimized', folder))) {
      if (f.includes('.tmp')) continue;
      const stem = f.replace(/(\.(desktop|mobile))?\.[^.]+$/, '');
      if (sources.has(stem)) continue;
      await unlink(A('optimized', folder, f));
      log(`[media] removed stale copy optimized/${folder}/${f}`);
    }
  }
}

// One file from the modal folder, whichever kind it is.
export async function optimizeModal(file, log = console.log) {
  await optimizeImage(file, 'modal', log);
  await optimizeVideo(file, log, 'modal');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  optimizeAll().then(() => console.log('[media] up to date'), (e) => { console.error(e); process.exit(1); });
}

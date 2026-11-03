/* Optimized copies of the media, made automatically. Originals are never
   touched.

     src/assets/video/<stem>.<ext>   →  src/assets/optimized/video/<stem>.desktop.mp4  (1920 wide, ~3.5 Mbps)
                                        src/assets/optimized/video/<stem>.mobile.mp4   (720 wide, ~1.4 Mbps)
     src/assets/traffic/<name>       →  src/assets/optimized/traffic/<stem>.jpg        (360 px long edge)

   Uses only what ships with macOS: AVFoundation (a small Swift transcoder,
   compiled once into node_modules/.cache) and `sips`. Up-to-date copies are
   skipped. Run directly (`npm run optimize`), or let the dev server's media
   plugin (vite.config.js) run it on start, on new files, and before builds. */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readdir, stat } from 'node:fs/promises';
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

export async function optimizeVideo(file, log = console.log) {
  if (!VIDEO_EXT.includes(path.extname(file).toLowerCase())) return;
  const outDir = A('optimized/video');
  await mkdir(outDir, { recursive: true });
  const srcTime = await sourceTime(file);
  for (const v of VIDEO_VARIANTS) {
    const out = path.join(outDir, `${stemOf(file)}.${v.name}.mp4`);
    if (await mtime(out) >= srcTime) continue;
    const bin = await transcoder();
    const t0 = Date.now();
    const { stdout } = await run(bin, [file, out, String(v.width), String(v.bps)], { maxBuffer: 1 << 20 });
    const kb = Math.round((await stat(out)).size / 1024);
    log(`[media] ${path.basename(file)} → ${v.name} ${stdout.trim()} ${(kb / 1024).toFixed(1)} MB (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
}

export async function optimizeImage(file, folder, log = console.log) {
  if (!IMAGE_EXT.includes(path.extname(file).toLowerCase())) return;
  const outDir = A('optimized', folder);
  await mkdir(outDir, { recursive: true });
  const out = path.join(outDir, `${stemOf(file)}.jpg`);
  if (await mtime(out) >= await sourceTime(file)) return;
  await run('sips', ['-Z', String(THUMB), '-s', 'format', 'jpeg', '-s', 'formatOptions', '75', file, '--out', out]);
  log(`[media] ${path.basename(file)} → thumbnail`);
}

export async function optimizeAll(log = console.log) {
  const list = (dir) => readdir(A(dir)).then((fs) => fs.filter((f) => !f.startsWith('.')).map((f) => A(dir, f)), () => []);
  for (const f of await list('traffic')) await optimizeImage(f, 'traffic', log);
  for (const f of await list('video')) await optimizeVideo(f, log);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  optimizeAll().then(() => console.log('[media] up to date'), (e) => { console.error(e); process.exit(1); });
}

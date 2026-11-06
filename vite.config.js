import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { writeFile, readFile, mkdir, rename, access, rm, copyFile } from 'node:fs/promises';
import os from 'node:os';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { optimizeAll, optimizeImage, optimizeVideo, optimizeModal } from './scripts/optimize-media.mjs';

const DEFAULTS = fileURLToPath(new URL('./src/defaults.json', import.meta.url));
const BACKUP = fileURLToPath(new URL('./src/defaults.prev.json', import.meta.url));
const VIDEO_DIR = fileURLToPath(new URL('./src/assets/video/', import.meta.url));
const MODAL_DIR = fileURLToPath(new URL('./src/assets/modal/', import.meta.url));
const MODAL_OPT_DIR = fileURLToPath(new URL('./src/assets/optimized/modal/', import.meta.url));
// Uploads land here first, outside anything Vite watches, and are moved into
// place only once both files are complete.
const UPLOAD_TMP = fileURLToPath(new URL('./node_modules/.also-uploads/', import.meta.url));

/* "Save as default" in the inspector POSTs the page's current settings here,
   and they're written to src/defaults.json — the baseline every browser loads
   before its own unsaved tweaks. Dev server only: a static build has no
   endpoint, and simply bakes in whatever defaults.json held at build time.

   The previous file is kept as defaults.prev.json, so one bad save can always
   be undone by copying it back. */
function saveDefaults() {
  return {
    name: 'save-defaults',
    configureServer(server) {
      server.middlewares.use('/__save-defaults', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('expected an object');
            try { await writeFile(BACKUP, await readFile(DEFAULTS)); } catch { /* first save: nothing to back up */ }
            await writeFile(DEFAULTS, JSON.stringify(data, null, 2) + '\n');
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
          }
        });
      });
    },
  };
}

/* "Upload video…" in the Open road controls. Two requests per upload: the
   poster (a JPEG the browser made from the video's first frame), then the
   video itself. Both stream to a temp folder; when the video has arrived,
   both are moved into src/assets/video/ together. That folder is globbed by
   main.js, so Vite reloads the page and the new video is in the list — and
   in every build from then on. Dev server only, like Save as default. */
const VIDEO_EXT = ['mp4', 'mov', 'webm', 'm4v'];
const MAX_BYTES = 1024 * 1024 * 1024;

function uploadVideo() {
  return {
    name: 'upload-video',
    configureServer(server) {
      server.middlewares.use('/__upload-video', async (req, res) => {
        const fail = (code, error) => {
          res.statusCode = code;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ ok: false, error }));
        };
        if (req.method !== 'POST') return fail(405, 'POST only');
        const q = new URL(req.url, 'http://x').searchParams;
        const stem = q.get('stem') || '';
        const part = q.get('part');
        const ext = (q.get('ext') || '').toLowerCase();
        if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(stem)) return fail(400, 'bad name');
        if (part !== 'poster' && part !== 'video') return fail(400, 'bad part');
        if (part === 'video' && !VIDEO_EXT.includes(ext)) return fail(400, `use ${VIDEO_EXT.join(', ')}`);
        if (+req.headers['content-length'] > MAX_BYTES) return fail(413, 'over 1 GB');
        try {
          await mkdir(UPLOAD_TMP, { recursive: true });
          const name = part === 'poster' ? `${stem}.jpg` : `${stem}.${ext}`;
          if (part === 'video') {
            // Never overwrite a video that's already there.
            const exists = await Promise.any(VIDEO_EXT.map((e) => access(VIDEO_DIR + `${stem}.${e}`))).then(() => true, () => false);
            if (exists) { req.resume(); return fail(409, 'a video with that name already exists'); }
          }
          await pipeline(req, createWriteStream(UPLOAD_TMP + name));
          if (part === 'video') {
            await rename(UPLOAD_TMP + name, VIDEO_DIR + name);
            await rename(UPLOAD_TMP + `${stem}.jpg`, VIDEO_DIR + `${stem}.jpg`).catch(() => {});
          }
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ ok: true, stem }));
        } catch (e) {
          fail(500, String(e.message || e));
        }
      });
    },
  };
}

/* "Upload image or video…" on a slot in the Explore modal's controls. Like
   uploadVideo: one request for an image; for a video, its poster (a JPEG of
   an early frame, made in the browser) then the video. Everything lands in
   src/assets/modal/ (posters in modal/posters/), which main.js globs, so the
   page reloads with the new file in the list. Names are unique across kinds:
   `pcb.jpg` and `pcb.mp4` can't both exist, since settings refer to a file
   by its name without the extension. */
const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];

function uploadMedia() {
  return {
    name: 'upload-media',
    configureServer(server) {
      server.middlewares.use('/__upload-media', async (req, res) => {
        const fail = (code, error) => {
          res.statusCode = code;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ ok: false, error }));
        };
        if (req.method !== 'POST') return fail(405, 'POST only');
        const q = new URL(req.url, 'http://x').searchParams;
        const stem = q.get('stem') || '';
        const part = q.get('part');
        const ext = (q.get('ext') || '').toLowerCase();
        if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(stem)) return fail(400, 'bad name');
        if (part !== 'poster' && part !== 'file') return fail(400, 'bad part');
        if (part === 'file' && ![...IMAGE_EXT, ...VIDEO_EXT].includes(ext)) return fail(400, `use ${[...IMAGE_EXT, ...VIDEO_EXT].join(', ')}`);
        if (+req.headers['content-length'] > MAX_BYTES) return fail(413, 'over 1 GB');
        try {
          await mkdir(UPLOAD_TMP, { recursive: true });
          await mkdir(MODAL_DIR + 'posters/', { recursive: true });
          const tmp = UPLOAD_TMP + (part === 'poster' ? `modal-${stem}.poster.jpg` : `modal-${stem}.${ext}`);
          if (part === 'file') {
            const exists = await Promise.any([...IMAGE_EXT, ...VIDEO_EXT].map((e) => access(MODAL_DIR + `${stem}.${e}`))).then(() => true, () => false);
            if (exists) { req.resume(); return fail(409, 'a file with that name already exists'); }
          }
          await pipeline(req, createWriteStream(tmp));
          if (part === 'file') {
            // The poster first, so the reload finds it with its video.
            await rename(UPLOAD_TMP + `modal-${stem}.poster.jpg`, MODAL_DIR + `posters/${stem}.jpg`).catch(() => {});
            await rename(tmp, MODAL_DIR + `${stem}.${ext}`);
          }
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ ok: true, stem }));
        } catch (e) {
          fail(500, String(e.message || e));
        }
      });
    },
  };
}

/* "Delete" on a modal media thumbnail (inspector.js): removes the file from
   src/assets/modal with its poster and optimized copies, and clears it from
   any slot in defaults.json that uses it. On macOS the files go to the Trash,
   so a slip can be undone from Finder; elsewhere they're removed. */
function deleteMedia() {
  const trash = path.join(os.homedir(), '.Trash');
  const discard = async (file) => {
    if (process.platform !== 'darwin') return rm(file, { force: true });
    const { name, ext } = path.parse(file);
    let dest = path.join(trash, name + ext);
    for (let k = 2; await access(dest).then(() => true, () => false); k++) dest = path.join(trash, `${name} ${k}${ext}`);
    // Not rename(): the Trash can be on another volume.
    await copyFile(file, dest);
    await rm(file, { force: true });
  };
  return {
    name: 'delete-media',
    configureServer(server) {
      server.middlewares.use('/__delete-media', async (req, res) => {
        const send = (code, body) => {
          res.statusCode = code;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(body));
        };
        if (req.method !== 'POST') return send(405, { ok: false, error: 'POST only' });
        const stem = new URL(req.url, 'http://x').searchParams.get('stem') || '';
        if (!/^[a-z0-9][a-z0-9-]{0,60}$/i.test(stem)) return send(400, { ok: false, error: 'bad name' });
        try {
          const exists = (f) => access(f).then(() => f, () => null);
          // One name per extension: on macOS's case-insensitive disk this also
          // finds `.JPG`, and asking for both would find the same file twice.
          const originals = (await Promise.all([...IMAGE_EXT, ...VIDEO_EXT]
            .map((e) => exists(MODAL_DIR + `${stem}.${e}`)))).filter(Boolean);
          if (!originals.length) return send(404, { ok: false, error: 'file not found' });
          const extras = (await Promise.all([
            MODAL_DIR + `posters/${stem}.jpg`,
            MODAL_OPT_DIR + `${stem}.jpg`,
            MODAL_OPT_DIR + `${stem}.desktop.mp4`,
            MODAL_OPT_DIR + `${stem}.mobile.mp4`,
          ].map(exists))).filter(Boolean);
          for (const f of originals) await discard(f);
          for (const f of extras) await rm(f, { force: true });
          // Clear it from saved slots, so the defaults don't point at nothing.
          const saved = JSON.parse(await readFile(DEFAULTS, 'utf8').catch(() => '{}'));
          let changed = false;
          const scrub = (o) => o && Object.keys(o).forEach((k) => {
            if (k.startsWith('modalMedia_') && o[k] === stem) { o[k] = ''; changed = true; }
          });
          scrub(saved.platform);
          scrub(saved.platform?.mobile);
          if (changed) await writeFile(DEFAULTS, JSON.stringify(saved, null, 2) + '\n');
          send(200, { ok: true, stem });
        } catch (e) {
          send(500, { ok: false, error: String(e.message || e) });
        }
      });
    },
  };
}

/* Optimized media (scripts/optimize-media.mjs): brought up to date when the
   dev server starts and before every build, and for each new or changed file
   in src/assets/traffic or video while the server runs — so dropping
   an image in the traffic folder, or *Upload video…*, gets its small copy
   without anyone running anything. Work is queued one file at a time. */
function optimizedMedia() {
  const ASSETS = fileURLToPath(new URL('./src/assets/', import.meta.url));
  let queue = Promise.resolve();
  const enqueue = (job) => { queue = queue.then(job).catch((e) => console.error('[media]', e.message || e)); return queue; };
  const log = (m) => console.log(m);
  let command = 'serve';
  return {
    name: 'optimized-media',
    configResolved(c) { command = c.command; },
    async buildStart() {
      if (command !== 'build') return;     // the dev server handles its own
      // The optimizer needs macOS (sips, AVFoundation). Elsewhere — Vercel's
      // Linux builders — use the copies committed in src/assets/optimized.
      if (process.platform !== 'darwin' || process.env.SKIP_MEDIA_OPTIMIZE) return;
      await optimizeAll(log);
    },
    configureServer(server) {
      enqueue(() => optimizeAll(log));
      const onFile = (file) => {
        const rel = path.relative(ASSETS, file);
        const [dir] = rel.split(path.sep);
        if (rel.startsWith('..') || path.basename(file).startsWith('.')) return;
        if (dir === 'traffic') enqueue(() => optimizeImage(file, dir, log));
        else if (dir === 'video') enqueue(() => optimizeVideo(file, log));
        else if (dir === 'modal' && path.dirname(rel) === 'modal') enqueue(() => optimizeModal(file, log));
      };
      server.watcher.on('add', onFile);
      server.watcher.on('change', onFile);
    },
  };
}

export default defineConfig({
  // React and Tailwind are for the settings panel only (src/editor/panel):
  // the page itself is plain JavaScript and CSS.
  plugins: [react(), tailwindcss(), saveDefaults(), uploadVideo(), uploadMedia(), deleteMedia(), optimizedMedia()],
});

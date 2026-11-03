import { defineConfig } from 'vite';
import { writeFile, readFile, mkdir, rename, access } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const DEFAULTS = fileURLToPath(new URL('./src/defaults.json', import.meta.url));
const BACKUP = fileURLToPath(new URL('./src/defaults.prev.json', import.meta.url));
const VIDEO_DIR = fileURLToPath(new URL('./src/assets/video/', import.meta.url));
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

export default defineConfig({
  plugins: [saveDefaults(), uploadVideo()],
});

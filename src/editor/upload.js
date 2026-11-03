/* "Upload video…" for Open road's hero.

   1. The browser opens the file and grabs a frame for its poster. That doubles
      as the check that this browser can actually play it — a .mov in a codec
      Chrome can't decode fails here, with a message, instead of uploading and
      then showing nothing.
   2. On the dev server (`persist`), the poster and the video are sent to
      /__upload-video (vite.config.js), which saves them into
      src/assets/video/. The new video is selected *before* the upload, so the
      reload Vite does when the folder changes comes back with it showing.
      It's then part of the project, and of every build.
   3. In a static build there's nowhere to save to, so the video plays from
      the file for this visit only. */

const slug = (name) => name.replace(/\.[^.]+$/, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'video';

const extOf = (name) => (name.match(/\.([^.]+)$/)?.[1] || '').toLowerCase();

// A JPEG of the frame a tenth of a second in (the very first frame is often
// black), at most 1600px wide.
export function posterFrom(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    Object.assign(v, { muted: true, playsInline: true, preload: 'auto', src: url });
    const done = (fn, x) => { clearTimeout(timer); v.removeAttribute('src'); v.load(); URL.revokeObjectURL(url); fn(x); };
    const cant = () => done(reject, new Error('This browser can’t play that file. Export it as an H.264 .mp4 and try again.'));
    const timer = setTimeout(cant, 20000);
    v.addEventListener('error', cant, { once: true });
    v.addEventListener('loadeddata', () => { v.currentTime = Math.min(0.1, (v.duration || 0) / 2); }, { once: true });
    v.addEventListener('seeked', () => {
      if (!v.videoWidth) return cant();
      const k = Math.min(1, 1600 / v.videoWidth);
      const c = document.createElement('canvas');
      c.width = Math.round(v.videoWidth * k);
      c.height = Math.round(v.videoHeight * k);
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      c.toBlob((blob) => (blob ? done(resolve, { blob, url: c.toDataURL('image/jpeg', 0.85) }) : cant()), 'image/jpeg', 0.85);
    }, { once: true });
  });
}

async function send(stem, part, body, ext = '') {
  const res = await fetch(`/__upload-video?stem=${encodeURIComponent(stem)}&part=${part}&ext=${encodeURIComponent(ext)}`, {
    method: 'POST', body,
  });
  const out = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
  if (!out.ok) throw new Error(out.error || 'upload failed');
}

// `getConfig` / `onChange`: Open road's authored settings (desktop values +
// phone overrides), so choosing the new video never bakes phone values in.
export function videoUploader({ getConfig, onChange, saveState, persist }) {
  return async (file, onStatus = () => {}) => {
    const cfg = getConfig();
    if (!cfg) throw new Error('No Open road section');
    const ext = extOf(file.name);

    // A name that isn't taken.
    const taken = new Set((cfg.videos || []).map((v) => v.stem));
    const base = slug(file.name);
    let stem = base;
    for (let k = 2; taken.has(stem); k++) stem = `${base}-${k}`;

    onStatus('Checking the video…');
    const poster = await posterFrom(file);

    if (!persist) {
      const videos = [...(cfg.videos || []), { stem, src: URL.createObjectURL(file), poster: poster.url }];
      onChange({ ...cfg, videos, video: stem, heroMedia: 'video' });
      return { stem, saved: false };
    }

    onStatus('Uploading…');
    // Select it first: adding the file makes Vite reload the page.
    const prevSaved = { ...cfg };
    saveState('open-road', { ...cfg, video: stem, heroMedia: 'video' });
    try {
      await send(stem, 'poster', poster.blob);
      await send(stem, 'video', file, ext);
    } catch (e) {
      saveState('open-road', prevSaved);
      throw e;
    }
    onStatus('Saved. Reloading…');
    setTimeout(() => location.reload(), 300);   // in case Vite didn't already
    return { stem, saved: true };
  };
}

/* "Upload image or video…" on a slot in the Explore modal (Isometric
   platform → Modal content). Same steps as the hero's video: a video is
   checked by grabbing its poster; on the dev server the file is saved to
   src/assets/modal/ (vite.config.js → uploadMedia) and the page reloads with
   it; in a static build it shows from the file for this visit only.

   `library` is the modal's media list (main.js); a file played from memory
   is added to it. `select(stem)` puts the new file in the slot — called
   before the upload, so the reload comes back showing it. */
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];
const VIDEO_EXTS = ['mp4', 'mov', 'webm', 'm4v'];

async function sendMedia(stem, part, body, ext = '') {
  const res = await fetch(`/__upload-media?stem=${encodeURIComponent(stem)}&part=${part}&ext=${encodeURIComponent(ext)}`, {
    method: 'POST', body,
  });
  const out = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
  if (!out.ok) throw new Error(out.error || 'upload failed');
}

export function mediaUploader({ library, persist }) {
  return async (file, onStatus = () => {}, select = () => {}) => {
    const ext = extOf(file.name);
    const kind = VIDEO_EXTS.includes(ext) || file.type.startsWith('video/') ? 'video'
      : IMAGE_EXTS.includes(ext) || file.type.startsWith('image/') ? 'image' : null;
    if (!kind) throw new Error('Use an image (JPG, PNG, WebP, GIF, AVIF) or a video (MP4, MOV, WebM).');

    const taken = new Set(library.map((m) => m.stem));
    const base = slug(file.name).replace(/^video$/, kind);
    let stem = base;
    for (let k = 2; taken.has(stem); k++) stem = `${base}-${k}`;

    let poster = null;
    if (kind === 'video') {
      onStatus('Checking the video…');
      poster = await posterFrom(file);
    }

    if (!persist) {
      const src = URL.createObjectURL(file);
      library.push({ stem, kind, src, thumb: poster?.url || src, poster: poster?.url || '' });
      select(stem);
      return { stem, saved: false };
    }

    onStatus('Uploading…');
    const undo = select(stem);
    try {
      if (poster) await sendMedia(stem, 'poster', poster.blob);
      await sendMedia(stem, 'file', file, ext);
    } catch (e) {
      undo?.();
      throw e;
    }
    onStatus('Saved. Reloading…');
    setTimeout(() => location.reload(), 300);
    return { stem, saved: true };
  };
}

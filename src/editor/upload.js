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
function posterFrom(file) {
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

export function videoUploader({ director, saveState, persist }) {
  return async (file, onStatus = () => {}) => {
    const m = director.byId('open-road');
    if (!m) throw new Error('No Open road section');
    const cfg = m.def.config;
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
      const next = { ...cfg, videos, video: stem, heroMedia: 'video' };
      director.setConfig('open-road', next);
      saveState('open-road', next);
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

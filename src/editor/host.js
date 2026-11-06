/* The page's side of the settings panel.

   The panel (src/editor/panel, React + HeroUI) always runs in a document of
   its own: on a desktop the editor shell, with this page in a frame beside
   it; on a phone a sheet (a frame) over this page. Either way it reaches the
   page through this one object, `window.__editorHost`, which is everything
   the panel may know about or do to the page:

     sections()            Page, then every section in scroll order
     getConfig(id)         a section's authored settings (desktop + `mobile`)
     setConfig(id, next)   apply and autosave new authored settings
     progress(id)          a section's scroll progress, 0–1 (null for Page)
     scrollTo(id)          scroll the page to a section
     isPhone()             whether the page is using its phone settings
     images, media         the pictures and the modal's media library
     saveDefaults, uploadVideo, uploadMedia, deleteMedia, exportAll,
     importAll, reset, reload
     on(fn)                events: { type: 'refresh' } (settings changed in
                           another window), { type: 'select', id } (a section
                           was clicked), { type: 'key', key } (H, W or G
                           pressed while the page had focus)

   Loaded only in the editor; `npm run build:site` leaves it out. */

import { saveDefaults, exportAll, importAll, reset } from './store.js';
import { videoUploader, mediaUploader, mediaDeleter } from './upload.js';

export function createHost(ctx) {
  const { director, authored, extras, onChange, phoneQuery, framed } = ctx;
  const DEV = import.meta.env.DEV;
  const listeners = new Set();
  const emit = (ev) => listeners.forEach((fn) => fn(ev));

  const host = {
    sections: () => [
      ...extras.map((e) => ({ id: e.def.id, name: e.def.name, stage: false })),
      ...director.beats.map((b) => ({ id: b.def.id, name: b.def.name, stage: true })),
    ],
    getConfig: (id) => authored[id],
    setConfig: (id, next) => onChange(id, next),
    progress: (id) => director.byId(id)?.trigger?.progress ?? null,
    scrollTo: (id) => director.scrollToBeat(id),
    isPhone: () => matchMedia(phoneQuery).matches,
    images: ctx.images,
    media: ctx.media,
    // Only the dev server can write src/defaults.json or keep uploads.
    saveDefaults: DEV ? () => saveDefaults(ctx.currentSettings()) : null,
    uploadVideo: videoUploader({ getConfig: () => authored['open-road'], onChange: (next) => onChange('open-road', next), saveState: ctx.saveState, persist: DEV }),
    uploadMedia: mediaUploader({ library: ctx.media, persist: DEV }),
    deleteMedia: mediaDeleter({ library: ctx.media, persist: DEV }),
    canPersist: DEV,
    exportAll,
    importAll,
    reset,
    reload: () => location.reload(),
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    emit,
    hidePanel: () => {},
  };

  // Clicking a section selects it in the panel.
  director.beats.forEach((m) => m.stage?.addEventListener('pointerdown', () => emit({ type: 'select', id: m.def.id })));

  // The panel's shortcuts work while the page has focus too.
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test(e.target.tagName)) return;
    const key = e.key.toLowerCase();
    if ('hwg'.includes(key) && key.length === 1) emit({ type: 'key', key });
  });

  window.__editorHost = host;
  if (framed) {
    // In the editor shell: hand the shell this page's host.
    try { window.parent.__shell?.attach(host); } catch { /* not the shell */ }
  } else {
    phoneSheet(host);
  }
  return host;
}

/* On a phone the page is the top window, as it will be live, and the panel
   opens as a sheet over its lower part: a frame (`?panel`), so the panel's
   styles never touch the page. The class names are the ones the page's
   cursor rules already leave alone (style.css, verticals.js, careers.js). */
function phoneSheet(host) {
  const css = document.createElement('style');
  css.textContent = `
    .insp { position: fixed; left: 0; right: 0; bottom: 0; height: min(78dvh, 720px); width: 100%;
      border: 0; border-radius: 16px 16px 0 0; z-index: 2147483600; background: #0f0f11;
      box-shadow: 0 -8px 32px rgba(0,0,0,.35); }
    .insp[hidden] { display: none; }
    .insp__show { position: fixed; right: 12px; bottom: 12px; z-index: 2147483600; min-height: 44px;
      padding: 0 18px; border: 0; border-radius: 999px; background: #18181b; color: #fafafa;
      font: 500 14px/1 system-ui, -apple-system, sans-serif; box-shadow: 0 4px 16px rgba(0,0,0,.3); }
    .insp__show:focus-visible { outline: 2px solid #ac74fc; outline-offset: 2px; }
    .insp__show[hidden] { display: none; }`;
  document.head.appendChild(css);

  const show = document.createElement('button');
  show.type = 'button';
  show.className = 'insp__show';
  show.textContent = 'Controls';
  const sheet = document.createElement('iframe');
  sheet.className = 'insp';
  sheet.title = 'Settings panel';
  sheet.hidden = true;
  document.body.append(sheet, show);

  const setOpen = (on) => {
    if (on && !sheet.src) sheet.src = `${location.pathname}?panel`;
    sheet.hidden = !on;
    show.hidden = on;
  };
  host.hidePanel = () => setOpen(false);
  show.addEventListener('click', () => setOpen(true));
  host.on((ev) => { if (ev.type === 'key' && ev.key === 'h') setOpen(sheet.hidden); });
}

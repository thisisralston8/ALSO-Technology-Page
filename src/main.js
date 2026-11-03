/* Boot. One Lenis, one ScrollTrigger, one director, three beats.

   The beats own no scroll of their own — that was the whole point of the port.
   `image-flow` had its own Lenis and ScrollTrigger; `type-scroll` had its own
   page and capture drivers. Both are off, and everything is fed from here. */

import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Observer from 'gsap/Observer';
import Lenis from 'lenis';

import './style.css';

import { createDirector } from './director.js';
import { createOpenRoad, OPEN_ROAD_DEFAULTS, OPEN_ROAD_MOBILE } from './beats/open-road.js';
import { createTraffic, TRAFFIC_DEFAULTS, TRAFFIC_MOBILE } from './beats/traffic.js';
import { createPlatform, PLATFORM_DEFAULTS, PLATFORM_MOBILE } from './beats/platform.js';
import { createNav } from './nav.js';
import { createModal } from './modal.js';
import { createSteps } from './steps.js';
import { createInspector } from './editor/inspector.js';
import { createGrain, GRAIN_DEFAULTS } from './grain.js';
import { REVEAL_DEFAULTS, setRevealOptions } from './lineReveal.js';
import { GRID_DEFAULTS, GRID_MOBILE, setGrid, showGridOverlay } from './grid.js';
import { load as loadSaved, save as saveState, saveDefaults, loadView, watch } from './editor/store.js';
import { videoUploader, mediaUploader } from './editor/upload.js';
import savedDefaults from './defaults.json';

gsap.registerPlugin(ScrollTrigger, Observer);
// A phone's address bar showing or hiding resizes the window; don't re-measure
// every scroll range for that (the director re-lays-out on real resizes).
ScrollTrigger.config({ ignoreMobileResize: true });

/* ---------- media ----------
   Originals live in src/assets/{images,hero,traffic,video}; the optimizer
   (scripts/optimize-media.mjs, run by the dev server and before builds)
   writes small copies to src/assets/optimized/. Each picks its copy by name
   (`stem`) and falls back to the original if a copy isn't there yet. */

const fileStem = (path) => path.split('/').pop().replace(/\.[^.]+$/, '');
const byStem = (glob) => Object.fromEntries(Object.entries(glob).map(([p, src]) => [fileStem(p), src]));
// The page's phone breakpoint (see "mobile settings" below): phones and
// tablets — everything narrower than 1024 px — get the Mobile settings and
// the 4-column grid.
const PHONE = '(max-width: 1023px)';
// Narrower still: an actual phone. Only for picking the small video copy.
const SMALL_SCREEN = '(max-width: 767px)';

// Open road's picture grid: the hero folder first, then the sample pool —
// full size, since the hero fills the screen. (Nothing waits on these
// loading: they're only offered as choices.)
const urls = Object.values(
  import.meta.glob('./assets/images/*.jpg', { eager: true, query: '?url', import: 'default' }),
).sort();
const images = urls.map((src) => ({ src }));
const heroUrls = Object.values(
  import.meta.glob('./assets/hero/*.{jpg,jpeg,png,webp,gif,avif}', { eager: true, query: '?url', import: 'default' }),
).sort();
const pickable = [...heroUrls.map((src) => ({ src })), ...images];

// Traffic's images: everything in src/assets/traffic — drop images in (or
// take them out) and the page reloads with them. Each is shown at its 360 px
// thumbnail; the pieces are never bigger than that.
const trafficGlob = import.meta.glob('./assets/traffic/*.{jpg,jpeg,png,webp,gif,avif,JPG,JPEG,PNG,WEBP}', { eager: true, query: '?url', import: 'default' });
const trafficThumbs = byStem(import.meta.glob('./assets/optimized/traffic/*.jpg', { eager: true, query: '?url', import: 'default' }));
const trafficImages = Object.entries(trafficGlob).sort().map(([p, src]) => ({ src: trafficThumbs[fileStem(p)] || src }));

// Hero videos (Open road): each video in assets/video, with a same-named .jpg
// as its poster, referred to by name. "Upload video…" adds to this folder.
// Played from its optimized copy: the phone one on a phone, else the desktop
// one, else the original.
const videoUrls = import.meta.glob('./assets/video/*.{mp4,mov,webm,m4v}', { eager: true, query: '?url', import: 'default' });
const posterUrls = byStem(import.meta.glob('./assets/video/*.jpg', { eager: true, query: '?url', import: 'default' }));
const optimizedVideo = byStem(import.meta.glob('./assets/optimized/video/*.mp4', { eager: true, query: '?url', import: 'default' }));
const phoneAtLoad = matchMedia(SMALL_SCREEN).matches;
const videos = Object.entries(videoUrls).sort().map(([path, src]) => {
  const stem = fileStem(path);
  const best = (phoneAtLoad && optimizedVideo[`${stem}.mobile`]) || optimizedVideo[`${stem}.desktop`] || src;
  return { stem, src: best, poster: posterUrls[stem] || '' };
});

// The Explore modal's images and videos: everything in assets/modal, by
// name. "Upload image or video…" on a slot adds to this folder. Each is shown
// from its optimized copy (a 2400 px JPEG; the phone or desktop MP4), else
// the original. A video's poster is the same-named JPEG in modal/posters.
const modalGlob = import.meta.glob('./assets/modal/*.{jpg,jpeg,png,webp,gif,avif,JPG,JPEG,PNG,WEBP,mp4,mov,webm,m4v,MP4,MOV}', { eager: true, query: '?url', import: 'default' });
const modalPosters = byStem(import.meta.glob('./assets/modal/posters/*.jpg', { eager: true, query: '?url', import: 'default' }));
const modalOptimized = byStem(import.meta.glob('./assets/optimized/modal/*.{jpg,mp4}', { eager: true, query: '?url', import: 'default' }));
const modalMedia = Object.entries(modalGlob).sort().map(([p, src]) => {
  const stem = fileStem(p);
  const kind = /\.(mp4|mov|webm|m4v)$/i.test(p) ? 'video' : 'image';
  if (kind === 'image') { const best = modalOptimized[stem] || src; return { stem, kind, src: best, thumb: best, poster: '' }; }
  const best = (phoneAtLoad && modalOptimized[`${stem}.mobile`]) || modalOptimized[`${stem}.desktop`] || src;
  return { stem, kind, src: best, thumb: modalPosters[stem] || '', poster: modalPosters[stem] || '' };
});

/* ---------- scroll ---------- */

/* The page's one and only smoothing. Every beat is a pure function of scroll
   progress, so whatever Lenis does to the scroll is exactly what every beat
   feels — no beat adds its own lag on top. `smoothness` is that lag;
   `scrollSpeed` is how far a wheel tick or swipe travels. Both live in the
   Page tab of the inspector. */

const PAGE_DEFAULTS = {
  smoothness: 0.55,   // 0 = native scrolling, 1 = a very heavy glide
  scrollSpeed: 1,     // distance per wheel tick / swipe, × the browser's
  ...GRAIN_DEFAULTS,  // grain + warmth over the whole page (grain.js)
  ...REVEAL_DEFAULTS, // line reveal on every text (lineReveal.js)
  ...GRID_DEFAULTS,   // the layout grid the text lines up to (grid.js)
};

// Phone starting values for the page (see "mobile settings" below): a still
// grain — the same look, without repainting it every few frames — and the
// 4-column grid.
const PAGE_MOBILE = { grainSpeed: 0, ...GRID_MOBILE };

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lerpFor = (s) => Math.pow(0.02, s); // 0 → 1 (none), 1 → 0.02 (heavy)

const lenis = new Lenis({ smoothWheel: !reduced, autoRaf: false });

// Returns true if the grid changed, so the beats need laying out again.
function applyPage(page) {
  setRevealOptions(page);
  const gridChanged = setGrid(page);
  lenis.options.lerp = reduced ? 1 : lerpFor(page.smoothness);
  lenis.options.wheelMultiplier = page.scrollSpeed;
  lenis.options.touchMultiplier = page.scrollSpeed;
  return gridChanged;
}
lenis.on('scroll', ScrollTrigger.update);
createNav(document.getElementById('nav'), lenis);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

/* ---------- config ---------- */

let saved = loadSaved();

/* Three layers, lowest first:
     1. the built-in *_DEFAULTS in each beat's source
     2. src/defaults.json — the project defaults, written by "Save as default"
     3. this browser's unsaved tweaks (localStorage)
   All keyed by beat id. */

const layer = (id) => ({ ...(savedDefaults[id] || {}), ...(saved[id] || {}) });

// Images are saved by name ("img-01"), not URL: a build renames them with a
// content hash, so a dev URL in defaults.json would break in production.
const stemOf = (src) => (src || '').split('/').pop().replace(/\.[^.]+$/, '').replace(/-[\w-]{8}$/, '');
const resolveImage = (v) => {
  const fallback = (pickable[0] || { src: '' }).src;
  if (!v) return fallback;
  const stem = stemOf(v);
  return (pickable.find((im) => stemOf(im.src) === stem) || { src: fallback }).src;
};

/* ---------- mobile settings ----------
   Each section's settings are its desktop values plus `mobile`: overrides
   used below the phone breakpoint. Built-in phone starting values (the
   *_MOBILE exports) sit under any saved ones. What's authored (and edited,
   and saved) is that whole object; what a section is given is the
   *effective* config — the overrides applied on a phone. */

const phoneMQ = matchMedia(PHONE);
const withMobile = (id, base, builtIn) => ({ ...base, mobile: { ...builtIn, ...(layer(id).mobile || {}) } });
const effective = (c) => (phoneMQ.matches && c.mobile ? { ...c, ...c.mobile } : c);

// Each section's authored settings, built from the three layers. Run again
// when another window changes them (see `watch` below).
function compose(id) {
  const l = layer(id);
  if (id === 'page') return withMobile('page', { ...PAGE_DEFAULTS, ...l }, PAGE_MOBILE);
  if (id === 'traffic') return withMobile('traffic', { ...TRAFFIC_DEFAULTS, ...l, images: trafficImages }, TRAFFIC_MOBILE);
  if (id === 'platform') return withMobile('platform', { ...PLATFORM_DEFAULTS, ...l }, PLATFORM_MOBILE);
  // Open road. The hero's colour moved from Traffic to Open road: keep one saved there.
  const t = layer('traffic');
  return withMobile('open-road', {
    ...OPEN_ROAD_DEFAULTS,
    ...(t.heroColour ? { heroColour: t.heroColour } : {}),
    ...(t.heroColourAmount != null ? { heroColourAmount: t.heroColourAmount } : {}),
    ...l, image: resolveImage(l.image), videos,
  }, OPEN_ROAD_MOBILE);
}

const page = compose('page');
applyPage(effective(page));
const grain = createGrain(effective(page));

const config = { openRoad: compose('open-road'), traffic: compose('traffic'), platform: compose('platform') };
// Authored settings by id — what the inspector edits and Save as default saves.
const authored = { page, 'open-road': config.openRoad, traffic: config.traffic, platform: config.platform };

/* ---------- the sequence ----------
   Every beat hands over to the next unless it says `seam: false`. The handover
   window is the viewport-height gap between one stage unsticking and the next
   sticking — the director flies one tile across it. */

const director = createDirector({
  root: document.getElementById('page'),
  handoffLayer: document.getElementById('handoff'),
  deps: { gsap, ScrollTrigger, Observer },
  beats: [
    {
      id: 'open-road', name: 'Open road',
      length: effective(config.openRoad).length,
      create: createOpenRoad, config: effective(config.openRoad),
    },
    {
      id: 'traffic', name: 'Traffic',
      // Lead: the traffic is already flowing as Open road unsticks, so the
      // square dropping out of the headline joins something in motion. The
      // section sizes itself so the page moves 1:1 (naturalLength). No seam
      // out: the platform joins on its last frame instead.
      length: 6, lead: true, seam: false,
      create: createTraffic, config: effective(config.traffic),
    },
    {
      id: 'platform', name: 'Isometric platform',
      // Join: starts on the frame Traffic ends on — the dot in "Start small" —
      // and takes that dot into the dark.
      length: effective(config.platform).length, join: true, seam: false,
      create: createPlatform, config: effective(config.platform),
    },
  ],
});

/* ---------- explore modal ----------
   The platform's Explore buttons ask for it (platform.js); it reads the
   platform's current `modal*` settings each time it opens. */

const modal = createModal({
  gsap, lenis, media: modalMedia,
  // Reading on to another layer: the section behind moves to it, so the
  // modal closes onto the right view. Lenis is stopped while the modal is
  // open, so this moves the page's own scroll position (ScrollTrigger
  // follows it as usual); Lenis picks the new position up when it restarts.
  onLayer(n, c) {
    const m = director.byId('platform');
    const p = m?.api.stopAt?.(n);
    if (p == null || !m.trigger) return;
    const to = m.trigger.start + (m.trigger.end - m.trigger.start) * p;
    follow?.kill();
    const at = { y: window.scrollY };
    follow = gsap.to(at, {
      y: to, duration: c.modalFollow, ease: 'power2.inOut',
      onUpdate: () => window.scrollTo(0, at.y),
    });
  },
});
let follow = null;
document.addEventListener('plat:explore', (e) => modal.open({ ...e.detail, cfg: effective(authored.platform) }));

// The platform's three layers scroll in steps (steps.js).
const steps = createSteps({ gsap, lenis, director, getConfig: () => effective(authored.platform) });

/* ---------- editor ---------- */

// Page-wide settings get their own tab, ahead of the beats.
const pageEntry = { def: { id: 'page', name: 'Page', config: effective(page) } };

// Give a section its effective settings (after an edit, or when the page
// crosses the phone breakpoint).
function apply(id) {
  const eff = effective(authored[id]);
  if (id === 'page') {
    pageEntry.def.config = eff;
    const gridChanged = applyPage(eff);
    grain.setConfig(eff);
    if (gridChanged) director.relayout();
  } else {
    director.setConfig(id, eff);
    // An open modal shows edits to its content as they're made.
    if (id === 'platform') modal.setConfig(eff);
    // Traffic's hero lane hangs off where Open road leaves its square.
    if (id === 'open-road') director.byId('traffic')?.api.relayout();
  }
}
function onChange(id, next) {
  authored[id] = next;
  apply(id);
  saveState(id, next);
}
phoneMQ.addEventListener('change', () => {
  Object.keys(authored).forEach(apply);
  director.relayout();
});

// Everything as authored, in the shape defaults.json stores it.
function currentSettings() {
  const strip = ({ images: _images, videos: _videos, ...rest }) => rest;
  const out = {};
  Object.entries(authored).forEach(([id, c]) => { out[id] = strip(c); });
  out['open-road'].image = stemOf(out['open-road'].image);
  return out;
}

/* `?embed` is the page inside the panel's phone preview (inspector.js): no
   panel of its own; the grid and wireframe follow the window that has one. */
const embedded = new URLSearchParams(location.search).has('embed');

const inspector = embedded ? null : createInspector({
  director,
  images: pickable,
  extras: [pageEntry],
  // Only the dev server can write the file; a static build has no endpoint.
  onSaveDefaults: import.meta.env.DEV ? () => saveDefaults(currentSettings()) : null,
  media: modalMedia,
  onUploadMedia: mediaUploader({ library: modalMedia, persist: import.meta.env.DEV }),
  onUploadVideo: videoUploader({ getConfig: () => authored['open-road'], onChange: (next) => onChange('open-road', next), saveState, persist: import.meta.env.DEV }),
  getConfig: (id) => authored[id],
  onChange,
  phoneQuery: PHONE,
  sheetQuery: SMALL_SCREEN,
});

/* Edits made in another window — the panel driving the phone preview, or a
   second browser window — apply here as they're made. Only sections whose
   settings actually changed are re-applied. */
const sameSettings = (a, b) => {
  const strip = ({ images: _i, videos: _v, ...rest }) => rest;
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
};
function syncView() {
  const v = loadView();
  showGridOverlay(!!v.grid);
  document.documentElement.classList.toggle('is-wireframe', !!v.wireframe);
}
watch({
  onConfig() {
    saved = loadSaved();
    let changed = false;
    Object.keys(authored).forEach((id) => {
      const next = compose(id);
      if (sameSettings(next, authored[id])) return;
      authored[id] = next;
      apply(id);
      changed = true;
    });
    if (changed) inspector?.refresh();
  },
  onView: embedded ? syncView : null,
});
if (embedded) {
  document.documentElement.classList.add('is-embed');
  syncView();
}

/* ---------- ready ---------- */

document.fonts?.ready.then(() => director.relayout());
window.addEventListener('load', () => ScrollTrigger.refresh());

// Handy for scrubbing by hand while tuning: __page.director.byId('flow').api.seek(0.4)
window.__page = { director, lenis, gsap, ScrollTrigger, config, authored, page: pageEntry, modal, steps, media: modalMedia };

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
import { createOpenRoad, OPEN_ROAD_DEFAULTS } from './beats/open-road.js';
import { createImageFlow, IMAGE_FLOW_DEFAULTS } from './beats/image-flow.js';
import { createBigScroll, BIG_SCROLL_DEFAULTS, TYPE_SCROLL_CSS } from './beats/big-scroll.js';
import { createAggregate, AGGREGATE_DEFAULTS } from './beats/aggregate.js';
import { createPlatform, PLATFORM_DEFAULTS } from './beats/platform.js';
import { createInspector } from './editor/inspector.js';
import { createGrain, GRAIN_DEFAULTS } from './grain.js';
import { TRAIL_DEFAULTS } from './trail.js';
import { load as loadSaved, save as saveState, saveDefaults } from './editor/store.js';
import { videoUploader } from './editor/upload.js';
import savedDefaults from './defaults.json';

gsap.registerPlugin(ScrollTrigger, Observer);

// The effect ships its own CSS so an embed carries exactly what the editor renders.
const tsStyle = document.createElement('style');
tsStyle.textContent = TYPE_SCROLL_CSS;
document.head.appendChild(tsStyle);

/* ---------- images ---------- */

const urls = Object.values(
  import.meta.glob('./assets/images/*.jpg', { eager: true, query: '?url', import: 'default' }),
).sort();

const measure = (src) =>
  new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im.naturalWidth / im.naturalHeight || 1);
    im.onerror = () => res(1);
    im.src = src;
  });

const images = await Promise.all(urls.map(async (src) => ({ src, ar: await measure(src) })));

// Hero images for Open road live in their own folder, apart from the pool
// above: Flow's tiles and Big scroll's slots are assigned by position in that
// pool, so adding a hero there would reshuffle both.
const heroUrls = Object.values(
  import.meta.glob('./assets/hero/*.{jpg,jpeg,png,webp,gif,avif}', { eager: true, query: '?url', import: 'default' }),
).sort();
const heroImages = await Promise.all(heroUrls.map(async (src) => ({ src, ar: await measure(src) })));
// Open road can use any image: heroes first, then the pool.
const pickable = [...heroImages, ...images];

// Hero videos (Open road): each video in assets/video, with a same-named .jpg as
// its poster. Referred to by name (`stem`), like images, so builds still match.
// "Upload video…" in the Open road controls adds to this folder.
const videoUrls = import.meta.glob('./assets/video/*.{mp4,mov,webm,m4v}', { eager: true, query: '?url', import: 'default' });
const posterUrls = import.meta.glob('./assets/video/*.jpg', { eager: true, query: '?url', import: 'default' });
const fileStem = (path) => path.split('/').pop().replace(/\.[^.]+$/, '');
const videos = Object.entries(videoUrls).sort().map(([path, src]) => {
  const stem = fileStem(path);
  const poster = Object.entries(posterUrls).find(([p]) => fileStem(p) === stem)?.[1] || '';
  return { stem, src, poster };
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
};

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lerpFor = (s) => Math.pow(0.02, s); // 0 → 1 (none), 1 → 0.02 (heavy)

const lenis = new Lenis({ smoothWheel: !reduced, autoRaf: false });

function applyPage(page) {
  lenis.options.lerp = reduced ? 1 : lerpFor(page.smoothness);
  lenis.options.wheelMultiplier = page.scrollSpeed;
  lenis.options.touchMultiplier = page.scrollSpeed;
}
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

/* ---------- config ---------- */

const saved = loadSaved();

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

// Big scroll keeps its settings in nested groups (params.type, params.roll…),
// so merge each group rather than letting a saved group replace a whole one.
const mergeParams = (...ps) => {
  const out = {};
  for (const p of ps) for (const [k, v] of Object.entries(p || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...out[k], ...v } : v;
  }
  return out;
};

const page = { ...PAGE_DEFAULTS, ...layer('page') };
applyPage(page);
const grain = createGrain(page);

// Flow used to have a single `text`. In settings saved before blurbs existed:
// an edited text carries over as a one-blurb list, so nobody's copy is lost;
// an untouched one (still the built-in sentence — "Save as default" stores
// every value, edited or not) is dropped so the new default blurbs show.
function flowLayer() {
  const l = layer('flow');
  if (l.text != null && l.texts == null) {
    const untouched = l.text.trim() === IMAGE_FLOW_DEFAULTS.texts[0].trim();
    if (!untouched) l.texts = [l.text];
  }
  delete l.text;
  return l;
}

// Aggregate was redesigned (scroll-driven shapes instead of hovers). Settings
// saved for the old design mostly name things that no longer exist, and the
// few that survive by name (length, the exit's height) meant something else —
// so only the colours and the motion trail carry over.
function aggregateLayer() {
  const l = layer('aggregate');
  if (l.design === AGGREGATE_DEFAULTS.design) return l;
  const keep = ['bg', 'fg', 'fillColour', ...Object.keys(TRAIL_DEFAULTS)];
  return Object.fromEntries(Object.entries(l).filter(([k]) => keep.includes(k)));
}

const roadLayer = layer('open-road');
const bigLayer = layer('big-scroll');
const config = {
  openRoad: { ...OPEN_ROAD_DEFAULTS, ...roadLayer, image: resolveImage(roadLayer.image), videos },
  flow: { ...IMAGE_FLOW_DEFAULTS, ...flowLayer(), images },
  big: {
    ...BIG_SCROLL_DEFAULTS,
    ...bigLayer,
    images,
    params: mergeParams(BIG_SCROLL_DEFAULTS.params, savedDefaults['big-scroll']?.params, saved['big-scroll']?.params),
  },
  aggregate: { ...AGGREGATE_DEFAULTS, ...aggregateLayer(), images },
  platform: { ...PLATFORM_DEFAULTS, ...layer('platform') },
};

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
      length: config.openRoad.length,
      create: createOpenRoad, config: config.openRoad,
    },
    {
      id: 'flow', name: 'Flow',
      // Lead: the stream starts running as Beat 1 unsticks, so the tile falling
      // out of the headline drops into a river that is already moving.
      length: config.flow.length, lead: true,
      // No handoff into Beat 3: the stream fully drains off the left edge by
      // the end of this beat, and Beat 3 pushes it away rather than receiving
      // a tile from it.
      seam: false,
      create: createImageFlow, config: config.flow,
    },
    {
      id: 'big-scroll', name: 'Big scroll',
      // No lead: this section is sized so its type moves 1:1 with the page
      // (see big-scroll.js). As it slides in under Flow the frame itself
      // carries the type up at scroll speed; once it locks, the effect carries
      // on at the same speed. Leading would double the speed during the slide.
      length: 2, seam: false,
      create: createBigScroll, config: config.big,
    },
    {
      id: 'aggregate', name: 'Aggregate',
      // Join: overlaps Big scroll's last screen and starts on the exact frame
      // Big scroll ends on, carrying its three dots on rather than sliding in.
      length: config.aggregate.length, join: true, seam: false,
      create: createAggregate, config: config.aggregate,
    },
    {
      id: 'platform', name: 'Isometric platform',
      // Join: starts on the frame Aggregate ends on — its single dot — and
      // takes that dot into the dark.
      length: config.platform.length, join: true, seam: false,
      create: createPlatform, config: config.platform,
    },
  ],
});

/* ---------- editor ---------- */

// Page-wide settings get their own tab, ahead of the beats.
const pageEntry = { def: { id: 'page', name: 'Page', config: page } };

// Everything currently on screen, in the shape defaults.json stores it.
function currentSettings() {
  const strip = ({ images: _images, videos: _videos, ...rest }) => rest;
  const out = { page: strip(pageEntry.def.config) };
  director.beats.forEach((m) => { out[m.def.id] = strip(m.def.config); });
  // Derived, not a setting: Big scroll sizes its own section.
  delete out['big-scroll'].length;
  out['open-road'].image = stemOf(out['open-road'].image);
  return out;
}

createInspector({
  director,
  images: pickable,
  extras: [pageEntry],
  // Only the dev server can write the file; a static build has no endpoint.
  onSaveDefaults: import.meta.env.DEV ? () => saveDefaults(currentSettings()) : null,
  onUploadVideo: videoUploader({ director, saveState, persist: import.meta.env.DEV }),
  onChange: (id, next) => {
    if (id === 'page') {
      pageEntry.def.config = next;
      applyPage(next);
      grain.setConfig(next);
    } else {
      director.setConfig(id, next);
    }
    saveState(id, next);
  },
});

/* ---------- ready ---------- */

document.fonts?.ready.then(() => director.relayout());
window.addEventListener('load', () => ScrollTrigger.refresh());

// Handy for scrubbing by hand while tuning: __page.director.byId('flow').api.seek(0.4)
window.__page = { director, lenis, gsap, ScrollTrigger, config, page: pageEntry };

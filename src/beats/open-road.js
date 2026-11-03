/* Beat 1 — Open road.

   One image, one headline, one number.

   The headline never fades. It is always fully opaque, and always sitting flush
   against the image's left and right edges — so the image's width is what holds
   the two halves of the line apart. At the start the image is viewport-wide and
   pushes both runs clean off the screen; as it shrinks it *pulls the text in*
   from either edge, and by the time it is a strip inside the line the whole
   headline has arrived. Nothing is animated independently: move the image and
   the words follow, because they are measured off it.

   Once the line is composed the strip narrows to a square, and the text keeps
   hugging it as it does. Then the page scrolls the line up and out of centre
   while the square stays fixed on screen, until Beat 2's stream rises up to
   meet it and carries it off.

   The crop does the rest of the work. The box goes wide (hero) → wide and short
   (inline) → square (the handoff tile), and `object-fit: cover` re-crops the
   picture continuously, so only one element ever moves.

   Like every other beat: a pure function of progress, reversible by scrubbing. */

import { createTrail, TRAIL_DEFAULTS } from '../trail.js';

export function createOpenRoad(el, config, deps) {
  let cfg = config;
  let progress = 0;
  let maskedExit = false;

  el.classList.add('road');

  const art = document.createElement('div');
  art.className = 'road__art';
  const img = document.createElement('img');
  img.decoding = 'async';
  art.appendChild(img);

  /* The hero can be a video. It loops, muted, while it's on screen; the moment
     the square leaves for Flow (the director masks our exit) it pauses and the
     current frame is captured, so the tile that flies into Flow carries that
     exact frame. Scroll back and it plays on from where it stopped. Playback
     runs on time, like the grain — it's footage, not choreography. */
  const video = document.createElement('video');
  Object.assign(video, { muted: true, loop: true, playsInline: true, preload: 'auto' });
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  art.appendChild(video);
  let frozen = false;      // paused for the handoff
  let onScreen = true;
  let frozenSrc = '';      // the captured frame, as an image URL

  const line = document.createElement('h1');
  line.className = 'road__line';
  const runL = document.createElement('span');
  const runR = document.createElement('span');
  runL.className = runR.className = 'road__run';
  line.append(runL, runR);

  el.append(art, line);

  // Motion trail on the hero image (and, via the director, the handoff tile).
  // A video's echoes copy its current frame; an image's are simple clones.
  const trail = createTrail();
  let trailMode = '';
  function syncTrail() {
    const mode = usingVideo() ? 'video' : 'image';
    if (mode === trailMode) return;
    trailMode = mode;
    trail.remove(art);
    trail.add(art, mode === 'video' ? { mode: 'canvasFill', source: video } : {});
  }

  const heroVideo = () => (cfg.videos || []).find((v) => v.stem === cfg.video) || (cfg.videos || [])[0] || null;
  const usingVideo = () => cfg.heroMedia === 'video' && !!heroVideo();

  function updatePlayback() {
    if (!usingVideo()) { video.pause(); return; }
    if (frozen || !onScreen) video.pause();
    else video.play().catch(() => {});   // autoplay can be refused; the poster shows instead
  }

  // Grab the frame on screen right now. Same-origin, so the canvas stays clean.
  function captureFrame() {
    const v = heroVideo();
    frozenSrc = v ? v.poster : '';
    if (video.readyState < 2 || !video.videoWidth) return;
    const k = Math.min(1, 1280 / video.videoWidth);
    const c = document.createElement('canvas');
    c.width = Math.round(video.videoWidth * k);
    c.height = Math.round(video.videoHeight * k);
    c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
    try { frozenSrc = c.toDataURL('image/jpeg', 0.9); } catch { /* keep the poster */ }
  }

  // Only decode while the hero is actually on screen.
  const io = new IntersectionObserver((entries) => {
    onScreen = entries[entries.length - 1].isIntersecting;
    updatePlayback();
  });
  io.observe(art);

  /* ---------- build ---------- */

  function build() {
    const [before, after] = splitCopy(cfg.text);
    runL.textContent = before;
    runR.textContent = after;
  }

  // "This is an ▣ open road." — the ▣ marks where the image sits. Without one we
  // split at the midpoint word, so any copy still works.
  function splitCopy(text) {
    if (text.includes('▣')) {
      const [a, b] = text.split('▣');
      return [a.trim(), b.trim()];
    }
    const w = text.split(/\s+/);
    const mid = Math.ceil(w.length / 2);
    return [w.slice(0, mid).join(' '), w.slice(mid).join(' ')];
  }

  /* ---------- geometry ----------
     Three boxes for the image, all in stage-local pixels, plus the measured
     width of each text run. */

  const geo = { hero: null, inline: null, final: null, W: 0, H: 0, lw: 0, rw: 0, gap: 0 };

  function computeGeometry() {
    const box = el.getBoundingClientRect();
    geo.W = box.width;
    geo.H = box.height;

    const navH = parseFloat(getComputedStyle(el).getPropertyValue('--nav-h')) || 0;
    const gut = geo.W * cfg.gutter;

    geo.lw = runL.offsetWidth;
    geo.rw = runR.offsetWidth;
    geo.gap = cfg.textGap * cfg.typeSize;

    geo.hero = {
      x: gut,
      y: navH + geo.H * 0.04,
      w: geo.W - gut * 2,
      h: geo.H * cfg.heroHeight - navH,
    };

    // The composed line: runs, gaps and the image strip, centred as one unit.
    // The image box is derived rather than measured off a placeholder, because
    // the runs are positioned from it and not the other way round.
    const iw = cfg.slotW * cfg.typeSize;
    const ih = cfg.slotH * cfg.typeSize;
    const total = geo.lw + geo.gap + iw + geo.gap + geo.rw;
    geo.inline = {
      x: (geo.W - total) / 2 + geo.lw + geo.gap,
      y: (geo.H - ih) / 2,
      w: iw,
      h: ih,
    };

    // The strip closes to 1:1 *in the line*: same centre, same height, it just
    // narrows. That square is where the beat ends and what Beat 2 receives.
    geo.final = {
      x: geo.inline.x + geo.inline.w / 2 - ih / 2,
      y: geo.inline.y,
      w: ih,
      h: ih,
    };
  }

  /* ---------- render ----------
     Two continuous moves and no dead zone — scrolling always visibly does
     something:

       0 → dockEnd            hero → strip, pulling the text in from the edges
       dockEnd+hold → 1       strip → square, the text closing in with it

     The text hugs the image the whole way, at a fixed gap from each edge, so
     the line reads as one object reshaping rather than words left stranded
     around a hole. There is no drop: at p=1 the beat's stage unsticks and the
     page carries the line up and away, while the director holds the square
     where it is (see `anchor`). The image stays put and the text scrolls out
     of centre around it. */

  function render(p) {
    const D = cfg.dockEnd;
    const S = Math.min(0.99, D + cfg.hold);
    const dock = clamp01(p / D);
    const sq = clamp01((p - S) / (1 - S));

    const r = sq > 0
      ? lerpRect(geo.inline, geo.final, easeInOut(sq))
      : lerpRect(geo.hero, geo.inline, easeInOut(dock));

    art.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`;
    art.style.width = r.w + 'px';
    art.style.height = r.h + 'px';
    art.style.opacity = maskedExit ? '0' : '1';
    // Square off the corners as it becomes a stream tile.
    art.style.borderRadius = `${lerp(cfg.radius, 0, easeInOut(sq))}px`;

    const cy = r.y + r.h / 2;
    runL.style.transform = `translate3d(${r.x - geo.gap - geo.lw}px, ${cy}px, 0) translateY(-50%)`;
    runR.style.transform = `translate3d(${r.x + r.w + geo.gap}px, ${cy}px, 0) translateY(-50%)`;
  }

  /* ---------- appearance ---------- */

  function applyLook() {
    if (img.getAttribute('src') !== cfg.image) img.src = cfg.image;
    const v = usingVideo() ? heroVideo() : null;
    img.style.display = v ? 'none' : '';
    video.style.display = v ? '' : 'none';
    if (v && video.getAttribute('src') !== v.src) { video.poster = v.poster; video.src = v.src; }
    syncTrail();
    updatePlayback();
    line.style.setProperty('--type-size', `${cfg.typeSize}px`);
    el.style.setProperty('--road-bg', cfg.bg);
    el.style.setProperty('--road-fg', cfg.fg);
  }

  /* ---------- api ---------- */

  function setConfig(next) {
    const prev = cfg;
    cfg = next;
    trail.setOptions(cfg);
    applyLook();
    if (next.text !== prev.text) build();
    computeGeometry();
    render(progress);
  }

  trail.setOptions(cfg);
  applyLook();
  build();
  computeGeometry();
  render(0);
  if (document.fonts) document.fonts.ready.then(() => { computeGeometry(); render(progress); });

  return {
    seek(p) { progress = p; render(p); },
    setConfig,
    relayout() { computeGeometry(); render(progress); },
    anchor(which) {
      if (which !== 'exit') return null;
      // Reported where the square sits while the stage is stuck (top: 0), not
      // where the stage currently is. Once the beat ends its stage scrolls away
      // carrying the text, but the square is the director's from then on and
      // stays fixed on screen — that is what makes the text scroll out around
      // the image instead of the image riding off with it.
      const box = el.getBoundingClientRect();
      return {
        rect: { x: box.left + geo.final.x, y: geo.final.y, w: geo.final.w, h: geo.final.h },
        src: usingVideo() ? (frozenSrc || heroVideo().poster) : cfg.image,
      };
    },
    maskAnchor(which, on) {
      if (which !== 'exit') return;
      // Leaving for Flow: freeze on this frame and hand it to the flying tile.
      if (on && usingVideo() && !frozen) captureFrame();
      frozen = on;
      updatePlayback();
      maskedExit = on;
      render(progress);
    },
    trail,
    destroy() { io.disconnect(); video.pause(); trail.destroy(); el.classList.remove('road'); art.remove(); line.remove(); },
    get config() { return cfg; },
  };
}

/* ---------- helpers ---------- */
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
const lerpRect = (a, b, t) => ({
  x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t),
  w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t),
});

export const OPEN_ROAD_DEFAULTS = {
  ...TRAIL_DEFAULTS,
  length: 4,                 // section height in viewport heights
  text: 'This is an ▣ open road.',
  image: 'hero-traffic',     // by name; resolved by the loader (src/assets/hero/)
  heroMedia: 'video',        // 'video' | 'image' — the image is the fallback
  video: 'hero-video',       // by name (src/assets/video/); a same-named .jpg is its poster
  videos: [],                // set by the loader
  typeSize: 92,
  slotW: 3.4,                // the image strip inside the line, in em
  slotH: 1.22,
  textGap: 0.5,              // space between the image and each run, in em.
                             // With the default gutter this is also what pushes
                             // the runs clear of the viewport at the start.
  gutter: 0.03,              // hero side margin, × viewport width
  heroHeight: 0.86,          // hero bottom edge, × viewport height
  dockEnd: 0.6,              // share of the beat spent pulling the text in
  hold: 0,                   // optional pause on the composed line before it
                             // narrows to 1:1 (0 = none, no dead scroll)
  seamHold: 0.35,            // share of the handoff the square waits in place
                             // while the text scrolls away
  seamEnd: 0.6,              // how far through the gap to Beat 2 the square
                             // has fully joined the stream. Earlier means the
                             // stream it joins is still below it, so it can
                             // drop straight down into it.
  radius: 0,
  bg: '#ffffff',
  fg: '#000000',
};

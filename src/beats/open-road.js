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
import { createLineReveal } from '../lineReveal.js';

export function createOpenRoad(el, config, deps) {
  let cfg = config;
  let progress = 0;
  let maskedExit = false;

  el.classList.add('road');

  const art = document.createElement('div');
  art.className = 'road__art';
  // The picture (image or video) sits in its own layer, so it can be blurred
  // as the colour comes in without touching the wireframe filter on it.
  const media = document.createElement('div');
  media.className = 'road__media';
  art.appendChild(media);
  const img = document.createElement('img');
  img.decoding = 'async';
  media.appendChild(img);

  /* The hero can be a video. It loops, muted, while it's on screen; the moment
     the square leaves for Traffic (the director masks our exit) it pauses and the
     current frame is captured, so the tile that flies into Traffic carries that
     exact frame. Scroll back and it plays on from where it stopped. Playback
     runs on time, like the grain — it's footage, not choreography. */
  const video = document.createElement('video');
  Object.assign(video, { muted: true, loop: true, playsInline: true, preload: 'auto' });
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  media.appendChild(video);
  // The hero's colour, laid over the picture as the image becomes its 1:1
  // square. The square leaves for Traffic already in it, and Traffic's hero
  // carries it on.
  // Measures the small viewport (100svh) for centring a shaped hero.
  const svh = document.createElement('div');
  svh.className = 'road__svh';
  svh.setAttribute('aria-hidden', 'true');
  el.appendChild(svh);
  const tintEl = document.createElement('div');
  tintEl.className = 'road__tint';
  art.appendChild(tintEl);
  let tint = 0;      // current colour amount, 0–1
  let colouring = false;   // the colour has started: the video holds its frame
  let frozen = false;      // paused for the handoff
  let onScreen = true;
  let frozenSrc = '';      // the captured frame, as an image URL (made after the handoff, off the critical path)
  // The captured frame itself. The handoff tile and Traffic's hero paint from
  // this canvas directly, so the picture is there on the frame they appear —
  // no image to encode, then decode, in between.
  const still = document.createElement('canvas');
  let stillOk = false;
  let stillKey = 0;        // bumps on every capture, so painters know to repaint

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
    if (frozen || colouring || !onScreen) video.pause();
    else video.play().catch(() => {});   // autoplay can be refused; the poster shows instead
  }

  // Grab the frame on screen right now, into `still`. Synchronous and cheap:
  // one drawImage. (Encoding it to a JPEG used to happen here too, which
  // stalled the very frame the handoff began on, and the tile then had to
  // wait for the browser to decode that new image — the hero blinked out.)
  function captureFrame() {
    const v = heroVideo();
    frozenSrc = v ? v.poster : '';
    stillOk = false;
    stillKey++;
    if (video.readyState < 2 || !video.videoWidth) return;
    const k = Math.min(1, 1280 / video.videoWidth);
    still.width = Math.round(video.videoWidth * k);
    still.height = Math.round(video.videoHeight * k);
    still.getContext('2d').drawImage(video, 0, 0, still.width, still.height);
    stillOk = true;
    // An image URL of it, for anything that wants one, made when the browser
    // is idle rather than now.
    const key = stillKey;
    still.toBlob((b) => { if (b && key === stillKey) frozenSrc = URL.createObjectURL(b); }, 'image/jpeg', 0.9);
  }

  // What the square shows, as something that can be drawn right now: the
  // frozen frame, the playing video, or the (already decoded) image.
  function exitSource() {
    if (usingVideo()) {
      if (frozen && stillOk) return { source: still, key: `still${stillKey}` };
      return video.readyState >= 2 ? { source: video, key: 'video' } : null;
    }
    return img.complete && img.naturalWidth ? { source: img, key: `img:${img.src}` } : null;
  }

  // Only decode while the hero is actually on screen.
  const io = new IntersectionObserver((entries) => {
    onScreen = entries[entries.length - 1].isIntersecting;
    updatePlayback();
  });
  io.observe(art);

  /* ---------- build ---------- */

  // Line reveals on the two halves of the headline, scrubbed by this beat's
  // progress over `revealFrom` → `revealTo` (lineReveal.js).
  const reveals = [createLineReveal(runL), createLineReveal(runR)];

  function build() {
    const [before, after] = splitCopy(cfg.text);
    reveals.forEach((r) => r.unsplit());   // text set on a split element would be undone
    runL.textContent = before;
    runR.textContent = after;
    reveals.forEach((r) => r.split());
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

  const geo = { hero: null, inline: null, final: null, W: 0, H: 0, lw: 0, rw: 0, gap: 0, ts: 0 };

  function computeGeometry() {
    const box = el.getBoundingClientRect();
    geo.W = box.width;
    geo.H = box.height;

    const navH = parseFloat(getComputedStyle(el).getPropertyValue('--nav-h')) || 0;
    const gut = geo.W * cfg.gutter;

    // The line never runs off the screen: if it's wider than the space
    // between the gutters at the set size, the whole line (type, gaps and
    // image strip) scales down to fit — a narrow window or a tablet keeps the
    // desktop settings without spilling.
    // Measured at the size the runs are drawn at now, scaled to the set
    // size (text width is proportional to font size), so the type size is
    // only ever written once, and only when it actually changes — rewriting
    // it makes the line reveal re-split the text.
    const shown = parseFloat(getComputedStyle(runL).fontSize) || cfg.typeSize;
    const k = cfg.typeSize / shown;
    const lw0 = runL.offsetWidth * k, rw0 = runR.offsetWidth * k;
    // A shaped hero closes straight to the square, so its slot in the line
    // is square too: Strip width only applies to Fill.
    const slotW = SHAPES[cfg.heroShape] ? cfg.slotH : cfg.slotW;
    const natural = lw0 + rw0 + (2 * cfg.textGap + slotW) * cfg.typeSize;
    const avail = geo.W - gut * 2;
    const fit = geo.W > 0 && lw0 + rw0 > 0 ? Math.min(1, avail / Math.max(1, natural)) : 1;
    geo.ts = cfg.typeSize * fit;
    if (Math.abs(geo.ts - shown) > 0.01) line.style.setProperty('--type-size', `${geo.ts}px`);

    geo.lw = lw0 * fit;
    geo.rw = rw0 * fit;
    geo.gap = cfg.textGap * geo.ts;

    const shape = SHAPES[cfg.heroShape] || 0;
    if (shape) {
      // A set shape (phones start 9:16): `heroWidth` % of the screen's width,
      // centred in the space under the nav — but never taller than that
      // space, so a wide setting on a short screen shrinks to fit rather
      // than running under the nav. The space ends at the bottom of the
      // *small* viewport — the screen with a phone's address bar showing,
      // as it is at the top of the page — so the hero is centred in what you
      // can actually see.
      const bottom = Math.min(geo.H, svh.offsetHeight || geo.H);
      const space = Math.max(1, bottom - navH);
      const w = Math.min((geo.W * cfg.heroWidth) / 100, space * shape);
      const h = w / shape;
      geo.hero = { x: (geo.W - w) / 2, y: navH + (space - h) / 2, w, h };
    } else {
      geo.hero = {
        x: gut,
        y: navH + geo.H * 0.04,
        w: geo.W - gut * 2,
        h: geo.H * cfg.heroHeight - navH,
      };
    }

    // The composed line: runs, gaps and the image strip, centred as one unit.
    // The image box is derived rather than measured off a placeholder, because
    // the runs are positioned from it and not the other way round.
    const iw = slotW * geo.ts;
    const ih = cfg.slotH * geo.ts;
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
    placeKnot();
  }

  /* ---------- render ----------
     One continuous move — hero → strip in the line → 1:1 square — under a
     single easing, then a short rest on the square before it's released.

     It used to be two separate eased moves (hero → strip, then strip →
     square). Each started and ended at rest, so the image stopped dead at the
     strip before squaring up, and the split was fixed by a slider rather than
     by how much actually changes in each part — a small squaring given most
     of the beat crawled for screens. Now the path runs through the strip
     without stopping: each property (position, width, height) follows a
     smooth monotone curve through the three boxes, so nothing overshoots and
     nothing stops in between. Scroll is shared out by how much changes in
     each part, with `squareShare` keeping a minimum for the squaring so the
     1:1 reveal still reads.

     The text hugs the image the whole way, at a fixed gap from each edge.
     There is no drop: at p=1 the beat's stage unsticks and the page carries
     the line up and away, while the square stays where it is (see `anchor`)
     and is released into Traffic. */

  function render(p) {
    const rv = clamp01((p - cfg.revealFrom) / Math.max(1e-3, cfg.revealTo - cfg.revealFrom));
    reveals.forEach((r) => r.set(rv));
    const end = Math.min(0.98, Math.max(0.02, 1 - cfg.squareHold));
    const u = easeInOut(clamp01(p / end));
    const r = pathAt(u);

    art.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`;
    art.style.width = r.w + 'px';
    art.style.height = r.h + 'px';
    art.style.opacity = maskedExit ? '0' : '1';
    // Square off the corners as it becomes the handoff tile.
    art.style.borderRadius = `${lerp(cfg.radius, 0, smoothstep(geo.knot, 1, u))}px`;
    // Colour: comes in over the end of the move, `colourFrom` → `colourTo`
    // (shares of the move: 0 = the full-width hero, 1 = the finished square).
    const c = smoothstep(cfg.colourFrom, cfg.colourTo, u);
    tint = cfg.heroColourAmount * c;
    tintEl.style.background = cfg.heroColour;
    tintEl.style.opacity = tint > 0 ? tint.toFixed(3) : '0';
    // As the colour starts, the video holds the frame it's on (and plays on
    // if you scroll back above that point)…
    if ((c > 0) !== colouring) { colouring = c > 0; updatePlayback(); }
    // …and the held frame blurs as the colour comes in. Scaled up a touch
    // with the blur so its edges never go soft and see-through.
    const blur = cfg.colourBlur * c;
    media.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : '';
    media.style.transform = blur > 0.05 ? `scale(${(1 + (4 * blur) / Math.max(1, Math.min(r.w, r.h))).toFixed(4)})` : '';
    // Fully coloured, the picture isn't drawn at all — so no sliver of it can
    // show at the square's edges.
    media.style.visibility = tint >= 0.999 ? 'hidden' : '';

    const cy = r.y + r.h / 2;
    runL.style.transform = `translate3d(${r.x - geo.gap - geo.lw}px, ${cy}px, 0) translateY(-50%)`;
    runR.style.transform = `translate3d(${r.x + r.w + geo.gap}px, ${cy}px, 0) translateY(-50%)`;
  }

  /* The path. Each of centre-x, centre-y, width and height is a monotone
     cubic through its hero, strip and square values, with the strip at
     `geo.knot` of the way along — continuous in value and in speed, and never
     past either neighbour (Fritsch–Carlson). */
  function pathAt(u) {
    const k = geo.knot;
    const at = (key) => monotone(geo.pts.map((q) => q[key]), k, u);
    const cx = at('cx'), cy = at('cy');
    let w, h;
    if (SHAPES[cfg.heroShape]) {
      // A shaped hero (9:16 on phones) eases its shape and its size
      // separately, so it goes straight from portrait to square. Easing width
      // and height on their own would let the taller side shrink first and
      // pass through a wide box on the way.
      const size = at('s'), ratio = Math.exp(at('lr'));
      w = size * Math.sqrt(ratio);
      h = size / Math.sqrt(ratio);
    } else { w = at('w'); h = at('h'); }
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }

  // Where the strip sits along the move: its share of the total change,
  // but leaving at least `squareShare` for the squaring.
  function placeKnot() {
    const c = (r) => ({
      cx: r.x + r.w / 2, cy: r.y + r.h / 2, w: r.w, h: r.h,
      // Size and (log) shape, for a shaped hero (see pathAt).
      s: Math.sqrt(r.w * r.h), lr: Math.log(Math.max(1e-3, r.w) / Math.max(1e-3, r.h)),
    });
    geo.pts = [c(geo.hero), c(geo.inline), c(geo.final)];
    // A shaped hero's slot in the line *is* the square: one move, no strip.
    // (The knot can't be 1 — the second part of the path needs some length.)
    if (SHAPES[cfg.heroShape]) { geo.knot = 0.999; return; }
    const d = (a, b) => Math.hypot(a.cx - b.cx, a.cy - b.cy, a.w - b.w, a.h - b.h);
    const A = d(geo.pts[0], geo.pts[1]), B = d(geo.pts[1], geo.pts[2]);
    const share = A + B > 0 ? A / (A + B) : 0.5;
    geo.knot = Math.min(0.999, 1 - clamp01(cfg.squareShare), Math.max(0.05, share));
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
    line.style.setProperty('--type-size', `${geo.ts || cfg.typeSize}px`);
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
        ...exitSource(),
        // The colour the square is wearing, for whoever carries it on.
        tint: { colour: cfg.heroColour, opacity: tint },
      };
    },
    maskAnchor(which, on) {
      if (which !== 'exit') return;
      // Leaving for Traffic: freeze on this frame and hand it to the flying tile.
      if (on && usingVideo() && !frozen) captureFrame();
      frozen = on;
      updatePlayback();
      maskedExit = on;
      render(progress);
      // The square changes hands here: drop its echoes, so they don't hang
      // on as a ghost of it at the old place while the tile carries on.
      trail.reset(art);
    },
    trail,
    destroy() { reveals.forEach((r) => r.destroy()); io.disconnect(); video.pause(); trail.destroy(); el.classList.remove('road'); art.remove(); line.remove(); },
    get config() { return cfg; },
  };
}

/* ---------- helpers ---------- */
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
const smoothstep = (a, b, x) => { const v = clamp01((x - a) / (b - a || 1e-6)); return v * v * (3 - 2 * v); };

/* Monotone cubic through three values at 0, k and 1 (Fritsch–Carlson
   tangents): smooth in value and speed, never overshooting a neighbour. A
   value that doesn't change on one side (the height, strip → square) arrives
   at the middle point with zero speed instead of turning a corner. */
function monotone([v0, v1, v2], k, u) {
  const h0 = k, h1 = 1 - k;
  const d0 = (v1 - v0) / h0, d1 = (v2 - v1) / h1;
  const m1 = d0 * d1 <= 0 ? 0 : (3 * (h0 + h1)) / ((2 * h1 + h0) / d0 + (h1 + 2 * h0) / d1);
  const end = (d, m) => (Math.sign(d) !== Math.sign(m) || d === 0 ? 0 : Math.abs(m) > 3 * Math.abs(d) ? 3 * d : m);
  const m0 = end(d0, (3 * d0 - m1) / 2);
  const m2 = end(d1, (3 * d1 - m1) / 2);
  const herm = (a, b, ma, mb, t, h) => {
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * a + (t3 - 2 * t2 + t) * h * ma + (-2 * t3 + 3 * t2) * b + (t3 - t2) * h * mb;
  };
  return u <= k ? herm(v0, v1, m0, m1, u / h0, h0) : herm(v1, v2, m1, m2, (u - k) / h1, h1);
}
// Hero shapes, width ÷ height. 'fill' (0) takes the whole hero area.
const SHAPES = { fill: 0, '16:9': 16 / 9, '4:5': 4 / 5, '1:1': 1, '9:16': 9 / 16 };

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
  heroHeight: 0.86,          // hero bottom edge, × viewport height (Fill only)
  heroWidth: 50,             // with a set shape: its width at the start, % of the viewport width
  heroShape: 'fill',         // the hero's shape at the start: 'fill' | '16:9' | '4:5' | '1:1' | '9:16'
  heroColour: '#5b3df5',     // the hero's colour — it carries on through Traffic
  heroColourAmount: 1,       // how fully (0 keeps the picture)
  colourFrom: 0.75,          // the colour comes in from here…
  colourTo: 1,               // …to here, as shares of the move (1 = the finished square)
  colourBlur: 12,            // px the held frame blurs to as the colour comes in
  revealFrom: 0,             // the headline's lines rise in from here…
  revealTo: 0.25,            // …to here (shares of this section's scroll)
  squareShare: 0.08,         // at least this share of the move squares the strip to 1:1
  squareHold: 0.12,          // share of the beat the finished square rests before release
  seamHold: 0,               // share of the gap to Traffic the square waits before
                             // it starts moving (it's released as the text leaves)
  seamEnd: 0.6,              // how far through that gap Traffic draws the hero itself
                             // (the hero's path is the same either way)
  radius: 0,
  bg: '#ffffff',
  fg: '#000000',
};

/* Phone starting values (below 768 px wide), applied over the desktop ones.
   Edit them in the inspector's Mobile mode. The headline is sized so
   "This is an ▣ open road." fits across a 375–430 px screen. */
export const OPEN_ROAD_MOBILE = {
  typeSize: 30,
  textGap: 0.4,
  gutter: 0.05,
  // Starts as a 9:16 portrait, centred in the screen under the nav, and
  // closes straight to the 1:1 square (a shaped hero has no strip).
  heroShape: '9:16',
  heroWidth: 68,
  trail: 'off',
};

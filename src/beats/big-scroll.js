/* Beat 3 — Big scroll.

   A thin wrapper around the vendored `type-scroll` effect. The effect itself is
   kept verbatim from upstream apart from one added line (`drive: 'external'`),
   because it was already written to be embedded: no imports, GSAP injected, and
   its CSS travelling with it in TYPE_SCROLL_CSS. Keeping it untouched means
   upstream fixes stay a straight copy.

   On top of the effect, this wrapper adds the beat's three phases, all a pure
   function of scroll:

     arrive   the block rises from below at scroll speed, as before
     hold     it stops with its vertical centre in the middle of the screen, and
              the inline images reveal one after another (Blocks reveal)
     release  the words carry on up and off the top, rolling over the edge as
              before — but the images don't go with them: they're lifted out
              into their own layer and gather into a centred row (the "dots"),
              which is where Beat 4 picks up.

   The effect itself never knows about any of this: phases are a remap of the
   progress fed to its seek(), and the images are drawn in a separate layer
   (`.big__dots`) while the effect's own image slots are hidden. The slots
   still hold the gaps in the lines, which is all the effect needs them for. */

import { createTypeScroll, TYPE_SCROLL_CSS } from './type-scroll-effect.js';
import { parse, compile } from './type-scroll-model.js';
import { rasterizeImage, prepare, paint } from './text-blocks.js';
import { journeyRect } from '../journey.js';
import { createTrail, TRAIL_DEFAULTS } from '../trail.js';

export { TYPE_SCROLL_CSS };

export function createBigScroll(el, config, deps) {
  let cfg = config;
  let progress = 0;
  let next = null;        // a beat that joins this one and carries the dots on
  const trail = createTrail();   // the dots, once they've left the text

  el.classList.add('big');
  const frame = document.createElement('div');
  frame.className = 'big__frame';
  const dotsLayer = document.createElement('div');
  dotsLayer.className = 'big__dots';
  dotsLayer.setAttribute('aria-hidden', 'true');
  el.append(frame, dotsLayer);

  const fx = createTypeScroll(frame, buildConfig(cfg), deps);

  function buildConfig(c) {
    const doc = parse(c.text);
    // The image library is keyed by slot order: the Nth ▣ in the copy takes the
    // Nth entry in `images`, cycling if the copy asks for more than we have.
    const library = {};
    let n = 0;
    doc.gaps.forEach((g) => {
      if (g.k !== 'image') return;
      const id = 's' + n;
      g.img = id;
      library[id] = c.images.length ? c.images[n % c.images.length].src : '';
      n++;
    });
    const compiled = compile(doc, library, c.params, c.fontFamily);
    compiled.drive = 'external';
    compiled.mode = 'end';           // plays once and releases, rather than looping
    // The page has exactly one source of smoothing: the global Lenis setting.
    // The effect's own follow (`motion.inertia`) would add a second lag on top
    // of it, so this beat alone would trail the scroll — kill it. Speed is 1
    // because the section is sized so the type moves 1:1 with the page.
    compiled.motion = { ...compiled.motion, inertia: 0, speed: 1 };
    // The images are drawn by the dots layer, not the effect; its own reveal
    // (which is tied to on-screen position, and so would freeze during the hold)
    // is switched off and its slot canvases hidden in CSS.
    compiled.reveal = { ...compiled.reveal, on: false };
    return compiled;
  }

  /* ---------- pace ----------
     Everything moves 1:1 with the page, so the beat reports the section length
     that makes that true (`naturalLength`) and the director sizes the section
     to it: the arrive and release distances in the effect's own pixels, plus
     the hold, which is a set number of screens of scroll.

     The effect's travel `y` runs from the first line at the bottom edge
     (range.start = -edge) to the last line at the top edge. The block is
     centred at the exact midpoint of that range, whatever the copy: line i
     sits at i·L − y from the centre, so the middle line is centred when
     y = (n − 1)·L / 2, which is (start + end) / 2. */

  let range = { start: 0, end: 1 };

  // The effect doesn't expose its range, but seek() maps 0 and 1 straight onto
  // it, so read it back off the target. Callers re-seek straight after.
  function measure() {
    fx.seek(0); const start = fx.target;
    fx.seek(1); const end = fx.target;
    range = { start, end };
    dotsDirty = true;
  }

  function phases() {
    const edge = -range.start;
    const yStart = -cfg.firstLineAt * edge;    // where the first line sits as the beat locks in
    const yHold = (range.start + range.end) / 2;
    const A = Math.max(0, yHold - yStart);
    const H = Math.max(0, cfg.holdLength) * window.innerHeight;
    const R = Math.max(0, range.end - yHold);
    return { yStart, yHold, A, H, R, total: A + H + R };
  }

  function stateAt(p) {
    const f = phases();
    const d = Math.min(1, Math.max(0, p)) * f.total;
    if (d < f.A) return { f, d, y: f.yStart + d, phase: 'arrive', t: f.A ? d / f.A : 1 };
    if (d < f.A + f.H) return { f, d, y: f.yHold, phase: 'hold', t: f.H ? (d - f.A) / f.H : 1 };
    return { f, d, y: f.yHold + (d - f.A - f.H), phase: 'release', t: f.R ? (d - f.A - f.H) / f.R : 1 };
  }

  function naturalLength() {
    // Sticky range is (len - 1) viewports, so add one for the frame itself.
    return Math.max(2, phases().total / window.innerHeight + 1);
  }

  /* ---------- the dots ----------
     One canvas per inline image. Its rect during the hold is computed from the
     effect's layout rather than read off the screen: the line's own size and
     the slot's offset inside it are layout values, and where the line sits
     during the hold is known exactly (centred block, no roll inside the focus
     band). That keeps every frame a pure function of progress — nothing is
     captured from whatever happened to be on screen. */

  let dots = [];           // [{ el, ctx, src, img, item, hold, w, h, drawn }]
  let dotsDirty = true;

  /* Each image has two canvases, painted from the same reveal:
       - `slotEl`, inside its slot in the text. Until the release it rides with
         its line — rising, curling over the bottom edge, fading with the mask —
         because it *is* part of the line. That's what lets the reveal start
         while the block is still arriving.
       - `el`, in the overlay. From the release on, the image leaves the text:
         the overlay canvas takes over at the exact spot the slot sits during
         the hold, and gathers into the row from there. */
  function buildDots() {
    const slots = [...frame.querySelectorAll('.ts-img')];
    const same = slots.length === dots.length && dots.every((d, j) => d.src === srcFor(j));
    if (!same) {
      dotsLayer.textContent = '';
      trail.clear();
      dots = slots.map((_, j) => {
        const c = document.createElement('canvas');
        c.className = 'big__dot';
        dotsLayer.appendChild(c);
        trail.add(c, { mode: 'canvas' });
        const d = { el: c, ctx: c.getContext('2d'), src: srcFor(j), img: null, item: null, hold: null, drawn: -1, slotDrawn: -1 };
        if (d.src) {
          d.img = new Image();
          d.img.decoding = 'async';
          d.img.onload = () => { d.item = null; render(progress); };
          d.img.src = d.src;
        }
        return d;
      });
    }
    // The effect rebuilds its lines whenever the copy changes, taking anything
    // inside them along, so the slot canvases are re-attached every time.
    dots.forEach((d, j) => {
      const slot = slots[j];
      let c = slot.querySelector('.big__slotdot');
      if (!c) {
        c = document.createElement('canvas');
        c.className = 'big__slotdot';
        slot.appendChild(c);
      }
      d.slotEl = c;
      d.slotCtx = c.getContext('2d');
      d.slotDrawn = -1;
    });
    dotsDirty = true;
  }

  function srcFor(j) {
    return cfg.images.length ? cfg.images[j % cfg.images.length].src : '';
  }

  function layoutDots() {
    const W = el.clientWidth, H = el.clientHeight;
    if (!W || !H) return false;                       // parked off-screen; try later
    const lines = [...frame.querySelectorAll('.ts-line')];
    const n = Math.max(1, lines.length);
    const edge = -range.start;
    const L = n > 1 ? (range.end - range.start - 2 * edge) / (n - 1) : 0;
    const align = cfg.params.type.align;
    const ax = align === 'left' ? 0 : align === 'right' ? -1 : -0.5;
    const xBase = align === 'left' ? -W * 0.46 : align === 'right' ? W * 0.46 : 0;

    let j = 0;
    lines.forEach((line, i) => {
      const lw = line.offsetWidth, lh = line.offsetHeight;
      const left = W / 2 + xBase + ax * lw;
      const top = H / 2 + (i - (n - 1) / 2) * L - lh / 2;
      line.querySelectorAll('.ts-img').forEach((slot) => {
        const d = dots[j++];
        if (!d) return;
        d.hold = { x: left + slot.offsetLeft, y: top + slot.offsetTop, w: slot.offsetWidth, h: slot.offsetHeight };
        d.radius = parseFloat(getComputedStyle(slot).borderTopLeftRadius) || 0;
      });
    });
    if (!dots.every((d) => d.hold && d.hold.w > 0)) return false;

    // The row: centred on the screen, each dot scaled, `dotsGap` apart, laid
    // out left to right in `dotsOrder` (image numbers, e.g. "2 1 3").
    const k = cfg.dotsScale;
    const order = rowOrder(dots.length);
    const seq = order.map((n) => dots[n - 1]);
    const ws = seq.map((d) => d.hold.w * k);
    const total = ws.reduce((a, b) => a + b, 0) + cfg.dotsGap * Math.max(0, seq.length - 1);
    let x = (W - total) / 2;
    seq.forEach((d, i) => {
      const h = d.hold.h * k;
      d.row = { x, y: H / 2 - h / 2, w: ws[i], h };
      x += ws[i] + cfg.dotsGap;
    });
    dots.forEach((d) => { d.item = null; });           // raster size may have changed
    dotsDirty = false;
    return true;
  }

  // `dotsOrder` as a list of image numbers, left to right. Anything that isn't
  // a full set of 1..n (e.g. after the copy gains a fourth image) falls back
  // to reading order.
  function rowOrder(n) {
    const o = String(cfg.dotsOrder || '').trim().split(/[\s,·]+/).map(Number);
    const ok = o.length === n && [...o].sort((a, b) => a - b).every((v, i) => v === i + 1);
    return ok ? o : Array.from({ length: n }, (_, i) => i + 1);
  }

  // Each dot is rasterised at the larger of its two sizes, so it never upscales.
  function prepareDot(d) {
    if (d.item || !d.img || !d.img.complete || !d.img.naturalWidth) return d.item;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const k = Math.max(1, cfg.dotsScale);
    const raster = rasterizeImage(d.img, d.hold.w * k, d.hold.h * k, dpr);
    if (!raster) return null;
    const rv = cfg.params.reveal || {};
    d.item = prepare(raster, {
      blocks: rv.grid ?? 3, depth: rv.depth ?? 3, scatter: rv.scatter ?? 0.7,
      seed: 4021 + dots.indexOf(d) * 977,
    });
    d.el.width = d.slotEl.width = raster.canvas.width;
    d.el.height = d.slotEl.height = raster.canvas.height;
    d.drawn = d.slotDrawn = -1;
    return d.item;
  }

  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  /* The reveal window, in scroll distance through the beat. It ends where it
     always did — the end of the hold, less the pause — and starts at
     `revealStart`: 0 = the moment the block locks, 1 = as the block starts
     arriving. The images reveal one after another, in reading order, across
     it. */
  function revealAt(st, j, N) {
    const { f, d } = st;
    const from = f.A * (1 - clamp01(cfg.revealStart));
    const to = f.A + f.H * Math.max(0.05, 1 - cfg.holdPause);
    if (to <= from) return d >= to ? 1 : 0;
    return clamp01(((d - from) / (to - from)) * N - j);
  }

  function paintInto(ctx, canvas, item, r) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paint(ctx, item, r, 0, 0);
  }

  function renderDots(st) {
    if (!dots.length) return;
    if (dotsDirty && !layoutDots()) { dotsLayer.style.visibility = 'hidden'; return; }
    const N = dots.length;
    const released = st.phase === 'release';
    dotsLayer.style.visibility = released ? 'visible' : 'hidden';
    const g = released ? ease(clamp01(st.t)) : 0;
    // With a beat joined on, the release is the first part of one move that
    // carries on into that beat (journey.js) — so the dots pass through the
    // row at speed instead of easing to a stop on it.
    const onward = released ? next?.restPlan?.() : null;
    const order = onward ? rowOrder(N) : null;

    dots.forEach((d, j) => {
      const item = prepareDot(d);
      const r = released ? 1 : revealAt(st, j, N);

      // In the text: arrive and hold. Empty once released — the image has left.
      const rs = released ? 0 : r;
      if (item && Math.abs(rs - d.slotDrawn) > 1e-4) {
        d.slotDrawn = rs;
        paintInto(d.slotCtx, d.slotEl, item, rs);
      }

      if (!released) return;
      // In the overlay: from the slot's hold position into the row.
      const a = d.hold, b = d.row;
      let x, y, w, h;
      if (onward) {
        const k = order.indexOf(j + 1);               // this dot's place in the row
        ({ x, y, w, h } = journeyRect(
          { R: st.f.R, S: onward.S, hold: a, row: b, rest: onward.rest[k] }, clamp01(st.t) * st.f.R,
        ));
      } else {
        x = a.x + (b.x - a.x) * g; y = a.y + (b.y - a.y) * g;
        w = a.w + (b.w - a.w) * g; h = a.h + (b.h - a.h) * g;
      }
      Object.assign(d.el.style, {
        transform: `translate3d(${x}px, ${y}px, 0)`, width: `${w}px`, height: `${h}px`,
        borderRadius: `${(d.radius || 0) * (w / a.w)}px`,   // the slot's rounding, scaled with the dot
      });
      if (item && Math.abs(r - d.drawn) > 1e-4) {
        d.drawn = r;
        paintInto(d.ctx, d.el, item, r);
      }
    });
  }

  /* ---------- render ---------- */

  function render(p) {
    const st = stateAt(p);
    const span = range.end - range.start;
    fx.seek(span > 0 ? (st.y - range.start) / span : 0);
    renderDots(st);
    renderFade(st);
  }

  // `textFade`: the share of the release over which the words fade out while
  // the dots gather (0 = no fade). Applied to the effect's frame only — the
  // dots live in their own layer and stay fully opaque.
  function renderFade(st) {
    let o = 1;
    if (st.phase === 'release' && cfg.textFade > 0) o = 1 - clamp01(st.t / cfg.textFade);
    const v = o >= 1 ? '' : String(+o.toFixed(4));
    if (frame.style.opacity !== v) frame.style.opacity = v;
  }

  /* ---------- api ---------- */

  function setConfig(next) {
    cfg = next;
    trail.setOptions(cfg);
    applyLook();
    fx.setConfig(buildConfig(cfg));
    measure();
    buildDots();
    dots.forEach((d) => { d.item = null; });
    render(progress);
  }

  function applyLook() {
    el.style.setProperty('--big-bg', cfg.params.type.bg);
    el.style.setProperty('--big-fg', cfg.params.type.fg);
  }

  trail.setOptions(cfg);
  applyLook();
  measure();
  buildDots();
  render(0);

  return {
    seek(p) { progress = p; render(p); },
    setConfig,
    relayout() { fx.relayout(); measure(); render(progress); },
    naturalLength,
    // Where the dots end up — the gathered row, left to right — for a beat that
    // joins this one and carries them on. Rects are stage-local; `raster` is
    // the exact photo bitmap each dot is drawn from.
    exitDots() {
      if (dotsDirty && !layoutDots()) return null;
      return rowOrder(dots.length).map((n) => {
        const d = dots[n - 1];
        const item = prepareDot(d);
        return {
          rect: { ...d.row }, hold: { ...d.hold }, src: d.src, raster: item ? item.raster.canvas : null,
          radius: (d.radius || 0) * (d.row.w / Math.max(1, d.hold.w)),   // its rounding, as drawn in the row
        };
      });
    },
    // The scroll length of the release — the first leg of the dots' journey.
    releaseDistance() { return phases().R; },
    joinedBy(api) { next = api; render(progress); },
    destroy() { trail.destroy(); fx.destroy(); frame.remove(); dotsLayer.remove(); el.classList.remove('big'); },
    get effect() { return fx; },
    get config() { return cfg; },
  };
}

export const BIG_SCROLL_DEFAULTS = {
  ...TRAIL_DEFAULTS,
  // No `length`: the section is sized from the type's travel plus the hold.
  firstLineAt: 0.1,  // where the first line sits as this beat locks in:
                     // 0 = centre of the frame, 1 = its bottom edge
  holdLength: 1.5,   // screens of scroll the block holds in the middle for
  holdPause: 0.15,   // share of the hold left after the last image has revealed
  textFade: 0.5,     // share of the release over which the words fade out
                     // as the dots gather (0 = no fade)
  revealStart: 0,    // when the images start revealing: 0 = as the block
                     // locks in the middle, 1 = as soon as it starts arriving
  dotsOrder: '2 1 3',  // the row, left to right, by image number in the copy
  dotsGap: 40,       // px between the dots once they gather into a row
  dotsScale: 1,      // the dots' size in the row, × their size in the text
  text: "Build the ▣ world's\nbest ▣ small vehicles\nfor moving ▣ people\nand goods, driven\nand autonomous.",
  images: [],
  fontFamily: '"ABC Camera", system-ui, sans-serif',
  params: {
    mode: 'end',
    type: {
      size: 13, fit: true, fitWidth: 92, weight: 400, leading: 1.1, tracking: -0.035,
      align: 'center', fg: '#000000', bg: '#ffffff',
    },
    img: { size: 0.86, aspect: 1, radius: 0, gap: 0.02, offset: -0.08 },
    roll: { band: 0.34, roll: 66, fade: 12, dim: 0.62, slant: 12, vskew: 14, stagger: 0.6, mirror: false },
    motion: { speed: 1, inertia: 0, loopGap: 0 },   // fixed; see buildConfig
    reveal: {
      on: true, style: 'blocks', squares: 4, dotColor: 'image', dotFill: '#000000',
      layout: 'scatter', field: 0.45, drift: 0.5, push: 0.6,
      mode: 'scroll', start: 0.08, end: 0.42, duration: 0.9,
      grid: 3, depth: 3, scatter: 0.7, guides: false,
    },
    embed: { drive: 'external', gsap: 'inline', height: '100vh' },
  },
};

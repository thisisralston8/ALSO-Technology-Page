/* Beat 2 — Flow.

   Images stream right→left along a lens-shaped path around a body of text.
   Ported from the `image-flow` prototype. The path, geometry and render maths
   are carried over verbatim; what changed is ownership:

   - no Lenis, no ScrollTrigger, no localStorage — the director supplies `seek(p)`
   - params arrive as an argument instead of living in a module singleton
   - it reports entry/exit anchors so the director can fly a tile in and out

   The prototype's hard rule still holds: every frame is a pure function of
   (progress, tile index, seed, params). Seeded `rnd(i, k)`, never Math.random(),
   so scrubbing and reversing are exact. That purity is also what makes the
   handoff work: `place()` gives a tile's position at *any* point along the path,
   so the director can aim at a tile that is already moving. */

import { rasterize, prepare, paint } from './text-blocks.js';
import { createTrail, TRAIL_DEFAULTS } from '../trail.js';

/* Multiple blurbs. The copy can be a sequence of text blurbs that take turns
   over the beat's scroll: the scroll is split evenly between them, the first
   is already showing when the beat arrives and the last holds until the
   stream drains. At each boundary the outgoing blurb dissolves out through
   quantizing squares and the next resolves in (text-blocks.js) — and across
   that same window the stream reshapes, because the lens geometry is measured
   per blurb (its real line width and height) and blended between them. Tiles
   already in flight get carried outward or inward as the text changes shape,
   so the images cascade around whichever text is on screen. */

export function textsOf(c) {
  const list = Array.isArray(c.texts) ? c.texts.filter((t) => t && t.trim()) : [];
  return list.length ? list : [c.text || ''];
}

export function createImageFlow(el, config, deps) {
  let cfg = config;
  let tiles = [];
  let masked = { entry: false, exit: false };
  let progress = 0;
  const trail = createTrail();   // every tile leaves a trail

  el.classList.add('flow');
  const field = document.createElement('div');
  field.className = 'flow__field';
  field.setAttribute('aria-hidden', 'true');
  // One element per blurb, all stacked in the same place. The live text is
  // what reads, measures and stays accessible; the veil canvas only draws
  // during a transition.
  const copyWrap = document.createElement('div');
  copyWrap.className = 'flow__copies';
  const veil = document.createElement('canvas');
  veil.className = 'flow__veil';
  veil.setAttribute('aria-hidden', 'true');
  const vctx = veil.getContext('2d');
  el.append(field, copyWrap, veil);
  let copies = [];

  /* ---------- seeded randomness ---------- */
  function rnd(i, k) {
    let t = (Math.imul(i + 1, 374761393) + Math.imul(k + 1, 668265263) + Math.imul(cfg.seed, 2246822519)) >>> 0;
    t = Math.imul(t ^ (t >>> 13), 1274126177);
    t ^= t >>> 16;
    return (t >>> 0) / 4294967296;
  }

  /* ---------- tiles ---------- */
  function buildTiles() {
    trail.clear();
    field.textContent = '';
    tiles = [];
    if (!cfg.images.length) return;

    // Seeded shuffle of the image order so neighbours on the path differ.
    const order = cfg.images.map((_, i) => i).sort((a, b) => rnd(a, 90) - rnd(b, 90));

    // One run of `count` tiles per blurb, back to back, so the stream keeps
    // flowing for as long as there's text for it to flow around. Every run has
    // the same timing as the first, so tile i keeps the exact phase it had with
    // a single blurb — the opening, and the handoff into it, don't change.
    const runs = Math.max(1, copies.length);
    const N = cfg.count * runs;
    const S = 0.85; // how much of one run is staggered; <1 keeps the lens full mid-scroll
    for (let i = 0; i < N; i++) {
      const image = cfg.images[order[i % order.length]];
      const tile = document.createElement('div');
      tile.className = 'flow__tile';
      const im = document.createElement('img');
      im.src = image.src;
      im.decoding = 'async';
      im.draggable = false;
      tile.appendChild(im);
      field.appendChild(tile);
      trail.add(tile);

      const depth = rnd(i, 3);
      tiles.push({
        el: tile, ar: image.ar, src: image.src, index: i,
        lane: i % 2 ? 1 : -1,                    // alternate top / bottom arc
        phase: ((i + rnd(i, 2) * 0.8) / cfg.count) * S,  // when it enters on the right
        depth,
        band: rnd(i, 4) * 2 - 1,                 // position across the band
        sizeVar: 0.8 + rnd(i, 5) * 0.35,
        wobble: rnd(i, 6) * Math.PI * 2,
        w: 0, h: 0, on: false, speed: 1,
      });
      tile.style.zIndex = String(Math.round(depth * 40));
    }
    layoutTiles();
  }

  /* ---------- geometry ----------
     Shared values (base tile, band, tips) plus one lens per blurb: its centre,
     the clearance above and below it (`Ry`, from its height) and where the
     strands start closing (`flat`, from its line width). */
  const geo = { W: 0, H: 0, base: 0, Rx: 0, band: 0, lenses: [], veil: null };

  function computeGeometry() {
    const s = el.getBoundingClientRect();
    geo.W = s.width;
    geo.H = s.height;
    geo.base = geo.W * 0.078; // 112px tile on the 1440 Figma frame
    const maxS = Math.max(cfg.maxScale, cfg.minScale);
    geo.band = geo.base * 0.55;
    geo.Rx = geo.W / 2 + geo.base * cfg.minScale + 8; // tips start just off-screen

    // Measure the text itself, not its box: a Range over the text gives the
    // union of the actual line extents, so a short blurb gets a narrow lens.
    const range = document.createRange();
    geo.lenses = copies.map((c) => {
      range.selectNodeContents(c);
      const r = range.getBoundingClientRect();
      const cb = c.getBoundingClientRect();
      const w = r.width || 1, h = r.height || 1;
      return {
        cx: r.left - s.left + w / 2,
        cy: r.top - s.top + h / 2,
        Ry: h / 2 + geo.base * 0.25 + geo.band + (geo.base * maxS) / 2,
        // Where the flat run ends, as a fraction of the half-width (0 = centre, 1 = tip).
        flat: Math.min(0.92, (w / 2 / geo.Rx) * cfg.taper),
        box: { x: cb.left - s.left, y: cb.top - s.top, w: cb.width, h: cb.height },
      };
    });

    // The veil covers every blurb's box, so any pair can be painted into it.
    const bx = geo.lenses.map((l) => l.box);
    const x0 = Math.min(...bx.map((b) => b.x)), y0 = Math.min(...bx.map((b) => b.y));
    const x1 = Math.max(...bx.map((b) => b.x + b.w)), y1 = Math.max(...bx.map((b) => b.y + b.h));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    geo.veil = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, dpr };
    Object.assign(veil.style, { left: `${x0}px`, top: `${y0}px`, width: `${x1 - x0}px`, height: `${y1 - y0}px` });
    veil.width = Math.max(1, Math.ceil((x1 - x0) * dpr));
    veil.height = Math.max(1, Math.ceil((y1 - y0) * dpr));

    blocks = [];   // rasters depend on layout; rebuild lazily
    painted = '';
    layoutTiles();
  }

  // Element box sized at the largest it will be drawn so we only ever scale down.
  function layoutTiles() {
    const box = geo.base * Math.max(cfg.maxScale, cfg.minScale, 0.01) * 1.35;
    for (const t of tiles) {
      const ar = cfg.aspect === 'original' ? t.ar : 1;
      t.w = ar >= 1 ? box : box * ar;
      t.h = ar >= 1 ? box / ar : box;
      t.el.style.width = `${t.w}px`;
      t.el.style.height = `${t.h}px`;
    }
  }

  /* ---------- the text timeline ----------
     The beat's own progress (not the stream's `startAt` remap — this is about
     the scroll you see) is split into equal slots, one per blurb. Around each
     boundary is a transition window `textTransition` × a slot wide: the
     outgoing blurb hides over the first ~half of it, the incoming one reveals
     over the second, overlapping slightly in the middle so the change reads as
     one move. The lens blends across the whole window. */

  const smooth = (x) => x * x * (3 - 2 * x);
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  function textState(p) {
    const n = copies.length;
    if (n <= 1) return { a: 0, b: -1, ra: 1, rb: 0, w: 0 };
    const seg = 1 / n;
    const hw = (cfg.textTransition * seg) / 2;
    for (let k = 1; k < n; k++) {
      const b = k * seg;
      if (p > b - hw && p < b + hw) {
        const q = (p - (b - hw)) / (2 * hw);
        return {
          a: k - 1, b: k,
          ra: 1 - clamp01(q / 0.55),
          rb: clamp01((q - 0.45) / 0.55),
          w: smooth(q),
        };
      }
    }
    const a = Math.min(n - 1, Math.max(0, Math.floor(p / seg)));
    return { a, b: -1, ra: 1, rb: 0, w: 0 };
  }

  // The lens at progress p: one blurb's, or a blend of two mid-transition.
  function lensAt(p) {
    const L = geo.lenses;
    if (!L.length) return { cx: geo.W / 2, cy: geo.H / 2, Ry: geo.base, flat: 0.4 };
    const st = textState(p);
    const A = L[st.a] || L[0];
    if (st.b < 0) return A;
    const B = L[st.b], w = st.w;
    const mix = (k) => A[k] + (B[k] - A[k]) * w;
    return { cx: mix('cx'), cy: mix('cy'), Ry: mix('Ry'), flat: mix('flat') };
  }

  /* ---------- the path: pure, and callable at any point along it ---------- */

  // Per-frame constants shared by every tile. `T` is the total travel the whole
  // stream needs, so progress 1 drains the last tile off the left tip.
  function constants() {
    const P = cfg.parallax;
    const minS = Math.min(cfg.minScale, cfg.maxScale);
    const maxS = Math.max(cfg.minScale, cfg.maxScale);
    const box = geo.base * Math.max(maxS, 0.01) * 1.35;
    // Deeper tiles travel faster and draw larger; this is what makes them
    // overtake and briefly overlap their neighbours.
    let T = 0, T1 = 0;
    for (const t of tiles) {
      t.speed = 1 + P * (t.depth - 0.5) * 0.9;
      T = Math.max(T, t.phase + 1 / t.speed);
      if (t.index < cfg.count) T1 = Math.max(T1, t.phase + 1 / t.speed);
    }
    // `startAt` is measured against a single run, so the opening frame is the
    // same however many blurbs follow it.
    return { P, minS, maxS, box, T, t0: cfg.startAt * T1 };
  }

  // `startAt` offsets the beat's own progress. Beat 1 hands a tile into this
  // stream rather than starting it, so at p=0 the river should already be
  // running: the entrance of the stream is Beat 1's falling tile, not the right
  // tip. Everything stays a pure function of progress — the offset is just a
  // remap applied before any of the path maths. (With one blurb this is exactly
  // the old `(startAt + (1 - startAt) p) T`.)
  const uOf = (t, p, k) => (k.t0 + p * (k.T - k.t0) - t.phase) * t.speed;

  // Where tile `t` sits when it is `u` of the way along the path. Everything
  // about a frame comes through here, which is what lets the handoff aim at a
  // tile's live position instead of a fixed point.
  function place(t, u, k, g) {
    // Horizontal travel: mostly linear, eased a little so tiles bunch into the tips.
    const xn = (1 - 2 * u) * 0.65 + Math.cos(Math.PI * u) * 0.35; // 1 = right tip, -1 = left tip
    const x = g.cx + geo.Rx * xn;

    // Envelope: flat runs above/below the copy, then an S-curve that closes to a
    // point at each edge. Smoothstep's zero slope at the tip makes the strands
    // converge tangentially, like a stream narrowing rather than a lens corner.
    const s = Math.min(1, Math.max(0, (Math.abs(xn) - g.flat) / (1 - g.flat)));
    const e = 1 - s * s * (3 - 2 * s);
    const df = 1 + k.P * (t.depth - 0.5) * 0.7;

    const radius = g.Ry * (1 + k.P * (t.depth - 0.5) * 0.25) + t.band * geo.band;
    const y = g.cy
      + t.lane * radius * e
      + Math.sin(u * Math.PI * 3 + t.wobble) * geo.base * 0.12 * e;

    const swell = 0.85 + 0.15 * Math.sin(Math.PI * u); // slightly larger mid-run
    const size = geo.base * (k.minS + (k.maxS - k.minS) * Math.pow(e, 1.2) * swell) * t.sizeVar * df;
    const sc = size / k.box;
    return { x, y, sc, w: t.w * sc, h: t.h * sc };
  }

  /* ---------- render ---------- */

  function render(p) {
    renderText(p);
    if (!tiles.length) return;
    const k = constants();
    const g = lensAt(p);
    const hiddenEntry = masked.entry ? entryIndex() : -1;
    const hiddenExit = masked.exit ? exitIndex() : -1;

    for (const t of tiles) {
      const u = uOf(t, p, k);
      if (u <= 0 || u >= 1 || t.index === hiddenEntry || t.index === hiddenExit) {
        if (t.on) { t.el.style.visibility = 'hidden'; t.on = false; }
        continue;
      }
      const q = place(t, u, k, g);
      t.el.style.transform =
        `translate3d(${q.x - q.w / 2}px, ${q.y - q.h / 2}px, 0) scale(${q.sc})`;
      if (!t.on) { t.el.style.visibility = 'visible'; t.on = true; }
    }
  }

  /* ---------- text render ----------
     Between transitions only the live text shows. During one, both blurbs are
     hidden and the veil paints them at their reveal values. Rasters and block
     plans are built on first use and dropped whenever layout changes. */

  let blocks = [];
  let painted = '';

  function blockFor(i) {
    if (blocks[i]) return blocks[i];
    const r = rasterize(copies[i], geo.veil.dpr);
    if (!r) return null;
    blocks[i] = prepare(r, {
      blocks: cfg.textBlocks, depth: cfg.textDepth, scatter: cfg.textScatter, seed: 9173 + i * 131,
    });
    return blocks[i];
  }

  function renderText(p) {
    const st = textState(p);
    const transitioning = st.b >= 0;
    copies.forEach((c, i) => {
      const show = !transitioning && i === st.a;
      c.style.visibility = show ? 'visible' : 'hidden';
      c.setAttribute('aria-hidden', show ? 'false' : 'true');
    });

    const key = transitioning ? `${st.a}|${st.b}|${st.ra.toFixed(4)}|${st.rb.toFixed(4)}` : '';
    if (key === painted) return;
    painted = key;
    vctx.clearRect(0, 0, veil.width, veil.height);
    veil.style.visibility = transitioning ? 'visible' : 'hidden';
    if (!transitioning || !geo.veil) return;

    const v = geo.veil;
    for (const [i, r] of [[st.a, st.ra], [st.b, st.rb]]) {
      if (r <= 0) continue;
      const item = blockFor(i);
      if (!item) { painted = ''; continue; }   // no layout yet; try again next frame
      const b = geo.lenses[i].box;
      paint(vctx, item, r, Math.round((b.x - v.x) * v.dpr), Math.round((b.y - v.y) * v.dpr));
    }
  }

  /* ---------- handoff anchors ----------
     The arriving tile doesn't aim at a fixed point on the edge of the screen —
     it aims at a *real tile that is already flowing*, and takes its place. The
     tile with the lowest phase is the one furthest along the path at any given
     moment, so by the time the handoff completes it is well inside the stream
     rather than still being born at the right tip.

     Clamping u away from 0 and 1 means the target stays continuous even before
     that tile has entered: it waits at the tip it is about to appear from, then
     moves off along the path, so the thing being chased never jumps. */

  const pick = (cmp) => (tiles.length ? tiles.reduce(cmp).index : -1);
  const exitIndex = () => pick((a, b) => (b.phase > a.phase ? b : a));

  // Which tile the arriving one becomes. Chosen for where it will be when the
  // handoff *completes* — the director passes that progress in — so the target
  // is a tile sitting mid-stream near the middle of the screen, not one still
  // being born off the right edge.
  //
  // `handoffLane` picks which strand it joins. Lanes are signed against screen
  // coordinates, so -1 is the strand above the copy and 1 is the one below.
  let handoffIdx = -1;
  let handoffKey = '';

  function entryIndex() {
    if (handoffIdx >= 0) return handoffIdx;
    return pick((a, b) => (b.phase < a.phase ? b : a));
  }

  // When the director says where the tile is coming from, the target is the
  // tile in the chosen strand that will be *directly beneath it, or just to its
  // left*, at the moment the handoff lands. Every tile drifts right→left, so
  // that one can be reached by falling straight down and then moving only
  // left — never back to the right to meet it. Without a source position it
  // falls back to a fixed point along the path (`handoffU`).
  function chooseEntry(ctx) {
    const box = el.getBoundingClientRect();
    const from = ctx.from;
    const fx = from ? from.x + from.w / 2 - box.left : null;   // stage-local
    const fy = from ? from.y + from.h / 2 : null;              // viewport
    const top = ctx.stageTopAtEnd ?? 0;
    const key = [ctx.pAtEnd, Math.round(fx ?? -1), Math.round(fy ?? -1), Math.round(top),
      tiles.length, cfg.seed, cfg.startAt, cfg.handoffLane, cfg.handoffU].join('|');
    if (key === handoffKey) return;
    handoffKey = key;

    const k = constants();
    const lane = cfg.handoffLane === 'below' ? 1 : -1;
    let best = -1, bestScore = Infinity;
    for (const t of tiles) {
      if (t.lane !== lane) continue;
      const u = uOf(t, ctx.pAtEnd, k);
      if (u <= 0 || u >= 1) continue;
      let score;
      if (fx == null) {
        score = Math.abs(u - cfg.handoffU);
      } else {
        const q = place(t, u, k, lensAt(ctx.pAtEnd));
        const dx = fx - q.x;                 // >= 0 means at or left of the drop
        const dy = q.y + top - fy;           // >= 0 means below it
        // Preferred: left-or-under and below. Otherwise penalise the wrong side
        // heavily so it's only used when nothing better exists.
        score = (dx >= 0 ? dx : 10000 - dx) + (dy >= 0 ? 0 : 5000 - dy);
      }
      if (score < bestScore) { bestScore = score; best = t.index; }
    }
    handoffIdx = best;
    // Tag it in the DOM so the handoff can be inspected and followed by hand.
    tiles.forEach((t) => { delete t.el.dataset.handoff; });
    if (best >= 0) tiles[best].el.dataset.handoff = '';
  }

  function liveAnchor(side, ctx) {
    if (!tiles.length) return null;
    if (side === 'entry' && ctx && ctx.pAtEnd != null) chooseEntry(ctx);
    const idx = side === 'entry' ? entryIndex() : exitIndex();
    if (idx < 0) return null;
    const t = tiles[idx];
    const k = constants();
    const box = el.getBoundingClientRect();

    // For an incoming handoff, report where the target tile *will be* when the
    // handoff lands, not where it is now. The tile is still moving — drifting
    // left and rising with its stage as it slides in — so aiming at its live
    // position makes the arriving tile chase it: down, then back up, then right.
    // Aiming at the fixed landing point gives a flight that only ever goes down
    // and left, and it is still seamless because at that exact moment the live
    // tile is exactly there.
    if (side === 'entry' && ctx && ctx.pAtEnd != null && ctx.stageTopAtEnd != null) {
      const u = Math.min(0.999, Math.max(0.001, uOf(t, ctx.pAtEnd, k)));
      const q = place(t, u, k, lensAt(ctx.pAtEnd));
      return {
        rect: { x: box.left + q.x - q.w / 2, y: ctx.stageTopAtEnd + q.y - q.h / 2, w: q.w, h: q.h },
        src: t.src,
      };
    }

    const u = Math.min(0.999, Math.max(0.001, uOf(t, progress, k)));
    const q = place(t, u, k, lensAt(progress));
    return {
      rect: { x: box.left + q.x - q.w / 2, y: box.top + q.y - q.h / 2, w: q.w, h: q.h },
      src: t.src,
    };
  }

  /* ---------- appearance ---------- */
  function buildCopies() {
    const texts = textsOf(cfg);
    if (copies.length === texts.length && copies.every((c, i) => c.textContent === texts[i])) return false;
    copyWrap.textContent = '';
    copies = texts.map((t) => {
      const c = document.createElement('p');
      c.className = 'flow__copy';
      c.textContent = t;
      copyWrap.appendChild(c);
      return c;
    });
    return true;
  }

  function applyLook() {
    copyWrap.style.setProperty('--type-size', `${cfg.typeSize}px`);
    el.style.setProperty('--flow-bg', cfg.bg);
    el.style.setProperty('--flow-fg', cfg.fg);
  }

  /* ---------- api ---------- */
  function setConfig(next) {
    const prev = cfg;
    cfg = next;
    trail.setOptions(cfg);
    applyLook();
    buildCopies();
    // Tiles depend on how many blurbs there are, not what they say.
    const runsChanged = tiles.length !== cfg.count * Math.max(1, copies.length);
    if (runsChanged || next.count !== prev.count || next.seed !== prev.seed || next.images !== prev.images) {
      buildTiles();
      handoffKey = '';
    }
    if (next.startAt !== prev.startAt || next.handoffU !== prev.handoffU
        || next.handoffLane !== prev.handoffLane) handoffKey = '';
    computeGeometry();
    render(progress);
  }

  trail.setOptions(cfg);
  buildCopies();
  applyLook();
  buildTiles();
  computeGeometry();
  if (document.fonts) document.fonts.ready.then(() => { computeGeometry(); render(progress); });

  return {
    seek(p) { progress = p; render(p); },
    setConfig,
    relayout() { computeGeometry(); render(progress); },
    anchor: (which, ctx) => liveAnchor(which, ctx),
    maskAnchor(which, on) { masked[which] = on; render(progress); },
    destroy() { trail.destroy(); el.classList.remove('flow'); field.remove(); copyWrap.remove(); veil.remove(); },
    get config() { return cfg; },
  };
}

export const IMAGE_FLOW_DEFAULTS = {
  ...TRAIL_DEFAULTS,
  count: 40,
  length: 6,         // section height in viewport heights
  maxScale: 1,       // × base tile at the widest part of the lens
  minScale: 0.18,    // × base tile at the tips
  parallax: 0.5,
  taper: 0.8,        // × text half-width where the strands start closing
  typeSize: 60,
  bg: '#ffffff',
  fg: '#000000',
  // The blurbs, in order. These are the three lines from the Figma board.
  texts: [
    'It began at Rivian when we started looking more closely at how we move around our cities.',
    'Growing density will lead to more space-constrained roads, and short trips will become increasingly frequent.',
    'It turns out, we don’t often move very fast or very far.',
  ],
  textTransition: 0.4,  // × each blurb's share of the scroll spent changing over
  textBlocks: 10,       // blocks across a blurb (they stay square)
  textDepth: 3,         // how many times a block splits before going sharp
  textScatter: 0.7,     // how much each block's timing is randomised
  aspect: 'square',
  seed: 1,
  startAt: 0.22,     // where the beat's own progress begins — how much stream is
                     // already flowing when Beat 1's tile drops into it
  handoffU: 0.45,    // how far along the path the arriving tile merges
                     // (0 = right tip, 1 = left tip)
  handoffLane: 'above',  // which strand it joins: 'above' or 'below' the copy
  images: [],
};

/* Beat 4 — Aggregate.

   Picks up exactly where Big scroll leaves off: three photos in a centred row.
   This beat *joins* Big scroll rather than following it (`join: true` in the
   director): its section overlaps Big scroll's last screen, so at its first
   frame it draws the three photos precisely where Big scroll left them and
   then covers Big scroll as that scrolls away underneath. Nothing slides.

   One structure of image cards, low on the screen and cropped by its bottom
   edge, under a line of text that changes as you scroll — like Flow's blurbs.
   Each text has a shape (`shapes`), by default:

     1  The solution is in aggregate…   globe
     2  For traditional logistics       globe
     3  For quick commerce              ring
     4  For passengers                  path

   Scroll, as a pure function of progress:

     settle   the three photos carry on out of Big scroll's row (one move,
              journey.js) into their places on the front of the globe, while
              the rest of its cards grow in around them
     text     the first text scrolls up into place with the page, then the
              texts take turns, dissolving into each other through the Blocks
              reveal. Where the shape changes, the same cards fly from one
              shape into the next
     exit     every card converges on one point in the true centre of the
              screen, filling with a solid colour, as the last text fades —
              the beat ends on a single dot

   The shapes also move on their own, on time (the globe and ring turn, the
   path flows towards you): ambient motion laid over the scroll choreography,
   like the grain. Their layout never changes with time, only where each card
   sits in it. Built from real 3D CSS transforms, so the browser does the depth
   sorting and the perspective. */

import { rasterize, prepare, paint } from './text-blocks.js';
import { journeyRect } from '../journey.js';
import { createTrail, TRAIL_DEFAULTS } from '../trail.js';

const TAU = Math.PI * 2;
const DEG = 180 / Math.PI;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const SHAPES = ['swirl', 'globe', 'ring', 'path'];

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
const smooth = (x) => x * x * (3 - 2 * x);
const span = (p, a, b) => (b > a ? clamp01((p - a) / (b - a)) : p >= b ? 1 : 0);
const lerp = (a, b, t) => a + (b - a) * t;
const frac = (v) => v - Math.floor(v);
// Seeded per-card randomness: same card, same value, every frame.
const rnd = (i, k) => frac(Math.sin(i * 127.1 + k * 311.7) * 43758.5453);

const textsOf = (c) => (Array.isArray(c.texts) ? c.texts.filter((t) => t && t.trim()) : []);

export function createAggregate(el, config) {
  let cfg = config;
  let progress = 0;
  let prev = null;        // Big scroll's api, once the director joins us to it
  const trail = createTrail();

  el.classList.add('agg');

  // The structure: a 3D world centred on the shape's origin, inside a scene
  // that carries the perspective and the crop.
  const scene = document.createElement('div');
  scene.className = 'agg__scene';
  const world = document.createElement('div');
  world.className = 'agg__world';
  scene.appendChild(world);

  // The texts, all stacked in one place. The live text reads and stays
  // accessible; the veil only draws two of them mid-change (as in Flow).
  const textWrap = document.createElement('div');
  textWrap.className = 'agg__texts';
  const veil = document.createElement('canvas');
  veil.className = 'agg__veil';
  veil.setAttribute('aria-hidden', 'true');
  const vctx = veil.getContext('2d');
  textWrap.appendChild(veil);
  el.append(scene, textWrap);

  let copies = [];
  let cards = [];         // { el, src, fill }
  let pool = [];

  /* ---------- geometry ---------- */

  const geo = { W: 0, H: 0, ox: 0, oy: 0, from: [], hold: [], radius: [], slots: [], veil: null, boxes: [] };

  const scale = () => cfg.shapeScale;
  const count = (shape) => Math.max(1, Math.round(
    shape === 'swirl' ? cfg.swirlCount : shape === 'globe' ? cfg.sphereCount : shape === 'ring' ? cfg.ringCount : cfg.pathCount));
  const total = () => Math.max(3, ...SHAPES.map(count));

  function computeGeometry() {
    geo.W = el.clientWidth;
    geo.H = el.clientHeight;
    geo.ox = geo.W / 2;
    geo.oy = geo.H * cfg.shapeY;
    Object.assign(world.style, { left: `${geo.ox}px`, top: `${geo.oy}px` });
    scene.style.perspective = `${cfg.perspective}px`;
    setEye(geo.oy);
    el.style.setProperty('--agg-bg', cfg.bg);
    el.style.setProperty('--agg-fg', cfg.fg);
    assignSlots();
    syncFrom();
    layoutText();
  }

  // Where Big scroll left each photo, left to right.
  function syncFrom() {
    const out = prev?.exitDots?.();
    for (let j = 0; j < 3; j++) {
      const d = out && out[j];
      geo.from[j] = d ? { ...d.rect } : null;
      geo.hold[j] = d && d.hold ? { ...d.hold } : null;
      geo.radius[j] = d ? d.radius || 0 : cfg.cardRadius;
      if (d && d.src && cards[j] && cards[j].src !== d.src) setSrc(cards[j], d.src);
    }
    return !!out;
  }

  /* The three photos from Big scroll take globe places near the top of its
     front face, left / middle / right, so they land somewhere visible above
     the crop. Every other card takes the remaining places in order. */
  function assignSlots() {
    const n = count('globe');
    const ang = sphereAngle(cfg.settleEnd, 0);
    const R = cfg.sphereRadius * scale() || 1;
    const want = [[-0.36, -0.72], [0, -0.86], [0.36, -0.72]];
    const used = new Set();
    const slots = [];
    want.forEach(([wx, wy]) => {
      let best = -1, bestD = Infinity;
      for (let k = 0; k < n; k++) {
        if (used.has(k)) continue;
        const q = spherePoint(k, ang);
        if (q.z < 0) continue;
        const d = Math.hypot(q.x / R - wx, (q.y - cfg.sphereLift) / R - wy);
        if (d < bestD) { bestD = d; best = k; }
      }
      if (best < 0) best = [...Array(n).keys()].find((k) => !used.has(k)) ?? 0;
      used.add(best);
      slots.push(best);
    });
    for (let k = 0; k < n; k++) if (!used.has(k)) slots.push(k);
    geo.slots = slots;
  }

  /* ---------- shapes ----------
     Every card in every shape is a pose: { x, y, z, yaw, pitch, size, op } —
     px and degrees, relative to the shape's origin. A card a shape has no
     place for (the ring has fewer cards than the globe) shrinks into one of
     the places it does have, so changing shape reads as cards merging. */

  function sphereAngle(p, t) {
    return cfg.sphereScroll * p * TAU + t * cfg.sphereSpeed * TAU;
  }

  function spherePoint(k, ang) {
    const n = count('globe');
    const kk = k + 0.5;
    const lat = Math.asin(1 - (2 * kk) / n);
    const lon = kk * GOLDEN + ang;
    const R = cfg.sphereRadius * scale();
    const x = R * Math.cos(lat) * Math.sin(lon);
    let y = -R * Math.sin(lat);
    let z = R * Math.cos(lat) * Math.cos(lon);
    // Tip the globe towards the viewer a little.
    const tl = cfg.sphereTilt / DEG;
    const y2 = y * Math.cos(tl) - z * Math.sin(tl);
    z = y * Math.sin(tl) + z * Math.cos(tl);
    y = y2;
    // Each card faces straight out from the centre.
    const yaw = Math.atan2(x, z) * DEG;
    const pitch = Math.asin(Math.max(-1, Math.min(1, R ? -y / R : 0))) * DEG;
    return { x, y: y + cfg.sphereLift, z, yaw, pitch };
  }

  function globePose(i, p, t) {
    const n = count('globe');
    const k = geo.slots[i % n] ?? i % n;
    const q = spherePoint(k, sphereAngle(p, t));
    const size = cfg.sphereCard * scale() * (0.75 + 0.5 * rnd(k, 1));
    return i < n ? { ...q, size, op: 1 } : { ...q, size: 0, op: 0 };
  }

  function ringPose(i, p, t) {
    const n = count('ring');
    const k = i % n;
    const th = (k / n) * TAU - TAU / 4 + cfg.ringScroll * p * TAU + t * cfg.ringSpeed * TAU;
    const R = cfg.ringRadius * scale();
    const tilt = cfg.ringTilt / DEG;
    const x = R * Math.cos(th);
    const z0 = R * Math.sin(th);
    // Stand the ring up by `ringTilt` from lying flat: 90° faces you square on.
    const q = { x, y: cfg.ringLift - z0 * Math.sin(tilt), z: z0 * Math.cos(tilt), yaw: 0, pitch: 0 };
    return i < n ? { ...q, size: cfg.ringCard * scale(), op: 1 } : { ...q, size: 0, op: 0 };
  }

  /* The path: a road of cards from just in front of the screen, bottom left,
     curving away into the distance. Cards flow along it towards you — fading
     in far away and out again at the near end. */
  function pathPose(i, p, t) {
    const n = count('path');
    const k = i % n;
    const s = frac((k + 0.5) / n - (t * cfg.pathSpeed + p * cfg.pathScroll) / n);   // 0 near … 1 far
    const S = scale();
    const q = {
      // Leaves the near end heading straight back, then bends sideways.
      x: (cfg.pathX + cfg.pathSwing * (1 - Math.cos(s * Math.PI * cfg.pathCurve))) * S,
      y: cfg.pathLift - cfg.pathRise * s * S,
      z: (cfg.pathNear - cfg.pathDepth * s) * S,
      yaw: cfg.pathYaw, pitch: 0,
    };
    const op = clamp01((1 - s) / 0.12) * clamp01(cfg.pathFade > 0 ? s / cfg.pathFade : 1);
    return i < n ? { ...q, size: cfg.pathCard * S, op } : { ...q, size: 0, op: 0 };
  }

  /* The swirl: a loose vortex of cards round the middle of the screen,
     seen from a little above — the unordered field the later shapes are
     gathered out of. Every card orbits at its own radius, inner ones faster,
     each tumbled at its own angle. Big scroll's three photos join it near
     where they arrive: left, middle (in front), right. */
  function swirlPose(i, p, t) {
    const n = count('swirl');
    const k = i % n;
    const S = scale();
    const R = cfg.swirlRadius * S;
    // Each card's radius, outside the clear eye in the middle that keeps the
    // text readable.
    const eye = clamp01(cfg.swirlEye);
    let r = R * (eye + (1 - eye) * rnd(k, 11) ** 0.75);
    let h = (rnd(k, 13) - 0.5) * cfg.swirlDepth * S;
    let tumble = cfg.swirlTumble;
    const carried = i < 3 && geo.from[i];
    let end = 0;
    if (carried) {
      const f = geo.from[i];
      const dx = f.x + f.w / 2 - geo.ox;
      const mid = Math.abs(dx) < geo.W * 0.12;
      r = mid ? 0.3 * R : Math.min(R, Math.max(0.3 * R, Math.abs(dx) * 0.75));
      end = mid ? Math.PI / 2 : dx < 0 ? Math.PI : 0;     // where it is when it lands
      h = 0;
      tumble *= 0.3;
    }
    const w = Math.sqrt(R / Math.max(1, r));                 // inner cards go round faster
    const turn = (q, tt) => (tt * cfg.swirlSpeed + q * cfg.swirlScroll) * TAU * w;
    const a0 = carried ? end - turn(cfg.settleEnd, 0) : rnd(k, 12) * TAU;
    const th = a0 + turn(p, t);
    const x = r * Math.cos(th);
    const z0 = r * Math.sin(th);
    // Tip the disc towards you, as if seen from a little above: the near
    // side drops, the far side rises.
    const tl = cfg.swirlTilt / DEG;
    const y = h * Math.cos(tl) + z0 * Math.sin(tl);
    const z = -h * Math.sin(tl) + z0 * Math.cos(tl);
    const wob = Math.sin(t * 0.8 + k * 1.7) * 0.25;
    const q = {
      x, y: y + geo.H * cfg.swirlY - geo.oy, z,
      yaw: (rnd(k, 14) - 0.5 + wob) * 2 * tumble,
      pitch: (rnd(k, 15) - 0.5) * 2 * tumble,
    };
    const size = cfg.swirlCard * S * (carried ? 1 : 0.55 + 0.9 * rnd(k, 16));
    return i < n ? { ...q, size, op: 1 } : { ...q, size: 0, op: 0 };
  }

  function shapePose(shape, i, p, t) {
    if (shape === 'swirl') return swirlPose(i, p, t);
    if (shape === 'ring') return ringPose(i, p, t);
    if (shape === 'path') return pathPose(i, p, t);
    return globePose(i, p, t);
  }

  const lerpPose = (a, b, m) => ({
    x: lerp(a.x, b.x, m), y: lerp(a.y, b.y, m), z: lerp(a.z, b.z, m),
    yaw: lerp(a.yaw, b.yaw, m), pitch: lerp(a.pitch, b.pitch, m),
    size: lerp(a.size, b.size, m), op: lerp(a.op, b.op, m),
  });

  /* Perspective: a pose's centre and size on screen, and back again. The eye
     (perspective origin) sits level with whatever shape is showing — the
     swirl in the middle of the screen, the others low down — so the swirl
     isn't stretched upwards by an eye at the bottom of the screen. */
  function setEye(y) {
    geo.ey = y;
    const v = `${geo.ox}px ${y.toFixed(2)}px`;
    if (scene.style.perspectiveOrigin !== v) scene.style.perspectiveOrigin = v;
  }
  const eyeAt = (p) => lerp(geo.oy, geo.H * cfg.swirlY, swirlWeight(shapeState(p)));
  function swirlWeight(sh) {
    return (sh.a === 'swirl' ? 1 - ease(sh.m) : 0) + (sh.b === 'swirl' ? ease(sh.m) : 0);
  }
  function project(q, ey = geo.ey) {
    const k = cfg.perspective / Math.max(1, cfg.perspective - q.z);
    const s = q.size * k;
    return { x: geo.ox + q.x * k - s / 2, y: ey + (geo.oy + q.y - ey) * k - s / 2, w: s, h: s };
  }
  function unproject(r, z, ey = geo.ey) {
    const k = cfg.perspective / Math.max(1, cfg.perspective - z);
    return { x: (r.x + r.w / 2 - geo.ox) / k, y: (r.y + r.h / 2 - ey) / k + ey - geo.oy, z, size: r.w / k };
  }

  /* ---------- the timeline ---------- */

  const rangePx = () => Math.max(0, cfg.length - 1) * (geo.H || window.innerHeight);
  // Scroll px this beat spends settling: the second leg of the photos' journey.
  const settleDistance = () => cfg.settleEnd * rangePx();

  const shapeOf = (k) => {
    const list = cfg.shapes || [];
    const s = list[Math.min(k, list.length - 1)];
    return SHAPES.includes(s) ? s : 'globe';
  };

  // The texts share the scroll between `textIn` and `exitStart` equally.
  function slots() {
    const n = Math.max(1, copies.length);
    const t0 = cfg.textIn, t1 = Math.max(t0 + 0.01, cfg.exitStart);
    return { n, t0, seg: (t1 - t0) / n };
  }

  // Which text shows, or which two are changing over (as in Flow).
  function textState(p) {
    const { n, t0, seg } = slots();
    const hw = (cfg.textTransition * seg) / 2;
    for (let k = 1; k < n; k++) {
      const b = t0 + k * seg;
      if (p > b - hw && p < b + hw) {
        const q = (p - (b - hw)) / (2 * hw);
        return { a: k - 1, b: k, ra: 1 - clamp01(q / 0.55), rb: clamp01((q - 0.45) / 0.55) };
      }
    }
    const a = Math.min(n - 1, Math.max(0, Math.floor((p - t0) / seg)));
    return { a, b: -1, ra: 1, rb: 0 };
  }

  // Which shape, or which two the cards are flying between, and how far.
  function shapeState(p) {
    const { n, t0, seg } = slots();
    const hw = (cfg.morphLength * seg) / 2;
    for (let k = 1; k < n; k++) {
      if (shapeOf(k - 1) === shapeOf(k)) continue;
      const b = t0 + k * seg;
      if (p > b - hw && p < b + hw) return { a: shapeOf(k - 1), b: shapeOf(k), m: (p - (b - hw)) / (2 * hw) };
    }
    const k = Math.min(n - 1, Math.max(0, Math.floor((p - t0) / seg)));
    return { a: shapeOf(k), b: null, m: 0 };
  }

  // Each card starts its move a little later than the last, by a seeded
  // amount, so a change of shape ripples rather than snapping in unison.
  const stagger = (m, i, amt, k) => {
    const d = rnd(i, k) * clamp01(amt);
    return ease(clamp01((m - d) / Math.max(1e-3, 1 - d)));
  };

  /* ---------- render ---------- */

  let clock = 0;          // seconds of ambient motion; see `advance`

  function render(p) {
    if (!geo.W) computeGeometry();
    if (!geo.W) return;
    if (!cards.length || cards.length !== total()) buildCards();
    if (p < cfg.settleEnd || cards.slice(0, 3).some((c) => !c.src)) syncFrom();

    const t = clock;
    const sh = shapeState(p);
    setEye(eyeAt(p));
    const exit = span(p, cfg.exitStart, cfg.exitEnd);
    const grow = span(p, cfg.growStart, cfg.settleEnd);
    const settling = p < cfg.settleEnd;
    const R = prev?.releaseDistance?.();
    const fill = span(exit, cfg.fillStart, cfg.fillEnd);
    const end = { x: 0, y: geo.H * cfg.endY - geo.oy, z: 0, yaw: 0, pitch: 0, size: cfg.endSize, op: 1 };

    cards.forEach((c, i) => {
      let q = shapePose(sh.a, i, p, t);
      if (sh.b) q = lerpPose(q, shapePose(sh.b, i, p, t), stagger(sh.m, i, cfg.morphStagger, 2));
      let radius = cfg.cardRadius;

      if (i < 3 && settling && geo.from[i]) {
        // The photos from Big scroll: one move from the text, through Big
        // scroll's row, to their place on the globe (journey.js) — computed
        // with the same inputs Big scroll uses, so the two beats agree on
        // every frame. They arrive square-on and turn into the globe's
        // curve over the last half of the settle.
        const target = project(q);
        const r = geo.hold[i] && R != null
          ? journeyRect({ R, S: settleDistance(), hold: geo.hold[i], row: geo.from[i], rest: target },
            R + span(p, 0, cfg.settleEnd) * settleDistance())
          : lerpRect(geo.from[i], target, ease(span(p, 0, cfg.settleEnd)));
        const turn = smooth(span(p, cfg.settleEnd * 0.5, cfg.settleEnd));
        q = { ...unproject(r, q.z), yaw: q.yaw * turn, pitch: q.pitch * turn, op: 1 };
        radius = lerp(geo.radius[i] * (r.w / Math.max(1, geo.from[i].w)), cfg.cardRadius, turn);
      } else if (i >= 3 && grow < 1) {
        // Everything else fades in around them, growing a little as it comes.
        const g = stagger(grow, i, cfg.growStagger, 1);
        q = { ...q, size: q.size * (0.5 + 0.5 * g), op: q.op * g };
      }

      if (exit > 0) q = lerpPose(q, end, stagger(exit, i, cfg.exitStagger, 3));
      drawCard(c, q, radius, fill);
    });

    // The crop opens as the cards leave for the centre, so the final dot is
    // never cut off whatever the crop is set to.
    // The swirl floats in the middle of the screen, so it's never cropped.
    const free = swirlWeight(sh);
    const cut = lerp(cfg.cropY, 1.5, Math.max(free, ease(span(exit, 0, 0.6)))) * geo.H;
    const f = Math.max(0, cfg.cropFeather);
    const mask = cut >= geo.H * 1.5 - 0.5 ? '' : `linear-gradient(to bottom, #000 ${cut - f}px, transparent ${cut}px)`;
    if (scene.style.maskImage !== mask) { scene.style.maskImage = mask; scene.style.webkitMaskImage = mask; }

    renderText(p, exit);
  }

  const lerpRect = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) });

  function drawCard(c, q, radius, fill) {
    const s = Math.max(0, q.size);
    const o = clamp01(q.op);
    const st = c.el.style;
    if (o <= 0.002 || s < 0.5) { if (st.visibility !== 'hidden') st.visibility = 'hidden'; return; }
    // Inherit, never 'visible': the stage is hidden until this beat locks
    // (director, join), and an explicit 'visible' would show through it.
    st.visibility = '';
    st.width = st.height = `${s.toFixed(2)}px`;
    st.margin = `${(-s / 2).toFixed(2)}px 0 0 ${(-s / 2).toFixed(2)}px`;
    st.transform = `translate3d(${q.x.toFixed(2)}px, ${q.y.toFixed(2)}px, ${q.z.toFixed(2)}px) rotateY(${q.yaw.toFixed(2)}deg) rotateX(${q.pitch.toFixed(2)}deg)`;
    st.opacity = o >= 0.999 ? '' : o.toFixed(3);
    st.borderRadius = radius > 0 ? `${radius.toFixed(2)}px` : '';
    // The fill is a layer over the photo, in the card's own style so motion
    // trail echoes carry it too.
    const fk = fill > 0 ? `${cfg.fillColour}|${fill.toFixed(3)}` : '';
    if (fk !== c.fill) {
      c.fill = fk;
      c.el.style.backgroundImage = paintBg(c.src, fill);
    }
  }

  function paintBg(src, fill) {
    const img = src ? `url("${src}")` : '';
    if (!(fill > 0)) return img;
    const col = hexA(cfg.fillColour, fill);
    return `linear-gradient(${col}, ${col})${img ? `, ${img}` : ''}`;
  }

  function hexA(hex, a) {
    const h = String(hex || '#000').replace('#', '');
    const v = h.length === 3 ? h.split('').map((x) => x + x).join('') : h.padEnd(6, '0');
    const n = parseInt(v.slice(0, 6), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a.toFixed(3)})`;
  }

  /* ---------- cards ---------- */

  const poolSrc = (i) => (pool.length ? pool[i % pool.length].src : '');

  function setSrc(c, src) {
    c.src = src;
    c.fill = null;        // repaint the background on the next draw
    c.el.style.backgroundImage = paintBg(src, 0);
  }

  function buildCards() {
    cards.forEach((c) => { trail.remove(c.el); c.el.remove(); });
    cards = [];
    const n = total();
    for (let i = 0; i < n; i++) {
      const e = document.createElement('div');
      e.className = 'agg__card';
      e.style.visibility = 'hidden';
      world.appendChild(e);
      const c = { el: e, src: '', fill: null };
      // The first three are Big scroll's photos (filled in by syncFrom).
      setSrc(c, poolSrc(i < 3 ? i : i - 3 + 5));
      cards.push(c);
      trail.add(e);
    }
    syncFrom();
  }

  /* ---------- text ---------- */

  function buildCopies() {
    const list = textsOf(cfg);
    if (copies.length === list.length && copies.every((c, i) => c.textContent === list[i])) return;
    copies.forEach((c) => c.remove());
    copies = list.map((t) => {
      const c = document.createElement('p');
      c.className = 'agg__text';
      c.textContent = t;
      textWrap.insertBefore(c, veil);
      return c;
    });
    blocks = [];
  }

  function layoutText() {
    buildCopies();
    Object.assign(textWrap.style, {
      top: `${cfg.textY * 100}%`,
      fontSize: `${cfg.textSize}px`,
      lineHeight: String(cfg.textLeading),
      letterSpacing: `${cfg.textTracking}em`,
    });
    copies.forEach((c) => { c.style.maxWidth = `${cfg.textWidth * geo.W}px`; });
    // The veil covers every text's box, so any pair can be painted into it.
    const wr = textWrap.getBoundingClientRect();
    geo.boxes = copies.map((c) => {
      const b = c.getBoundingClientRect();
      return { x: b.left - wr.left, y: b.top - wr.top, w: b.width, h: b.height };
    });
    blocks = [];
    painted = '';
    if (!geo.boxes.length) { geo.veil = null; return; }
    const x0 = Math.min(...geo.boxes.map((b) => b.x)), y0 = Math.min(...geo.boxes.map((b) => b.y));
    const x1 = Math.max(...geo.boxes.map((b) => b.x + b.w)), y1 = Math.max(...geo.boxes.map((b) => b.y + b.h));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    geo.veil = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, dpr };
    Object.assign(veil.style, { left: `${x0}px`, top: `${y0}px`, width: `${x1 - x0}px`, height: `${y1 - y0}px` });
    veil.width = Math.max(1, Math.ceil((x1 - x0) * dpr));
    veil.height = Math.max(1, Math.ceil((y1 - y0) * dpr));
  }

  let blocks = [];
  let painted = '';

  function blockFor(i) {
    if (blocks[i]) return blocks[i];
    const r = rasterize(copies[i], geo.veil.dpr);
    if (!r) return null;
    blocks[i] = prepare(r, { blocks: cfg.textBlocks, depth: cfg.textDepth, scatter: cfg.textScatter, seed: 4127 + i * 131 });
    return blocks[i];
  }

  function renderText(p, exit) {
    // In: the first text scrolls up into place with the page, at exactly the
    // page's speed, arriving at `textIn`. (Or fades up, with `textEntry`.)
    let dy = 0, o = 1;
    if (cfg.textEntry === 'fade') {
      const e = ease(span(p, cfg.textIn - cfg.textFadeIn, cfg.textIn));
      dy = (1 - e) * cfg.textRise;
      o = e;
    } else {
      dy = Math.max(0, (cfg.textIn - p) * rangePx());
      // No further than just below the screen: nothing to scroll in from there.
      dy = Math.min(dy, geo.H * (1 - cfg.textY) + 4);
    }
    o *= 1 - ease(span(exit, 0, cfg.textOut));
    textWrap.style.transform = dy ? `translate3d(0, ${dy.toFixed(2)}px, 0)` : '';
    textWrap.style.opacity = o >= 1 ? '' : o.toFixed(3);
    textWrap.style.visibility = o <= 0 ? 'hidden' : '';

    const st = textState(p);
    const changing = st.b >= 0;
    const fade = cfg.textStyle === 'fade';
    copies.forEach((c, i) => {
      let v = 0;
      if (!changing) v = i === st.a ? 1 : 0;
      else if (fade) v = i === st.a ? st.ra : i === st.b ? st.rb : 0;
      c.style.visibility = v > 0 ? 'visible' : 'hidden';
      c.style.opacity = fade && v > 0 && v < 1 ? v.toFixed(3) : '';
      c.setAttribute('aria-hidden', (changing ? i === st.b : i === st.a) ? 'false' : 'true');
    });

    const veiled = changing && !fade;
    const key = veiled ? `${st.a}|${st.b}|${st.ra.toFixed(4)}|${st.rb.toFixed(4)}` : '';
    if (key === painted) return;
    painted = key;
    vctx.clearRect(0, 0, veil.width, veil.height);
    veil.style.visibility = veiled ? 'visible' : 'hidden';
    if (!veiled || !geo.veil) return;
    const v = geo.veil;
    for (const [i, r] of [[st.a, st.ra], [st.b, st.rb]]) {
      if (r <= 0) continue;
      const item = blockFor(i);
      if (!item) { painted = ''; continue; }   // no layout yet; try again next frame
      const b = geo.boxes[i];
      paint(vctx, item, r, Math.round((b.x - v.x) * v.dpr), Math.round((b.y - v.y) * v.dpr));
    }
  }

  /* ---------- the ambient clock ----------
     The shapes' own motion runs on time, but only once the photos have
     landed: before that the globe is exactly where the photos are aiming.
     Scroll back into the settle and the clock unwinds (to the nearest whole
     turn of the globe, the shortest way) instead of jumping back to 0. */

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let raf = 0, last = 0, onScreen = false;

  function advance(dt) {
    if (reduced.matches) return;
    if (progress >= cfg.settleEnd) { clock += dt; return; }
    if (!clock) return;
    // The globe repeats every turn, so it can unwind the short way; the
    // swirl never repeats, so it just unwinds.
    const period = shapeOf(0) === 'globe' && cfg.sphereSpeed > 0 ? 1 / cfg.sphereSpeed : 0;
    let c = period ? clock % period : clock;
    if (period && c > period / 2) c -= period;
    c *= Math.exp(-dt / 0.18);
    clock = Math.abs(c) < 1e-3 ? 0 : c;
  }

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    advance(dt);
    render(progress);
    raf = onScreen ? requestAnimationFrame(frame) : 0;
  }

  const io = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  });
  io.observe(el);

  /* ---------- api ---------- */

  function setConfig(next) {
    cfg = next;
    trail.setOptions(cfg);
    pool = cfg.images || [];
    if (cards.length !== total()) buildCards();
    else cards.forEach((c, i) => { if (i >= 3 || !c.src) setSrc(c, i < 3 ? c.src || poolSrc(i) : poolSrc(i - 3 + 5)); });
    computeGeometry();
    render(progress);
  }

  trail.setOptions(cfg);
  pool = cfg.images || [];
  computeGeometry();
  render(0);
  if (document.fonts) document.fonts.ready.then(() => { computeGeometry(); render(progress); });

  return {
    seek(p) { progress = p; render(p); },
    setConfig,
    relayout() { computeGeometry(); render(progress); },
    join(api) { prev = api; computeGeometry(); render(progress); },
    // For the beat we joined: where the photos end up here (their places on
    // the globe, left to right, on screen), and how much scroll the settle
    // takes — the second leg of their journey.
    restPlan() {
      if (!geo.W) computeGeometry();
      if (!geo.W) return null;
      const sh = shapeState(progress);
      return {
        S: settleDistance(),
        rest: [0, 1, 2].map((i) => project(shapePose(sh.a, i, progress, clock), eyeAt(progress))),
      };
    },
    // For a beat that joins this one: the single dot the exit ends on.
    exitDot() {
      if (!geo.W) computeGeometry();
      const e = cfg.endSize;
      return { rect: { x: geo.W / 2 - e / 2, y: geo.H * cfg.endY - e / 2, w: e, h: e }, colour: cfg.fillColour, bg: cfg.bg };
    },
    // Step the ambient clock by hand — for checking where the browser isn't
    // delivering animation frames (a hidden tab), and for debugging.
    tick(now) { frame(now); },
    get clock() { return clock; },
    destroy() {
      io.disconnect();
      trail.destroy();
      if (raf) cancelAnimationFrame(raf);
      el.classList.remove('agg');
      scene.remove();
      textWrap.remove();
    },
    get config() { return cfg; },
  };
}

export const AGGREGATE_DEFAULTS = {
  ...TRAIL_DEFAULTS,
  design: 2,               // settings saved for the old hover design are set aside (main.js)
  length: 9,               // section height in viewport heights

  // Text
  texts: [
    'The solution is in aggregate, and we’re here to build it.',
    'For traditional logistics',
    'For quick commerce',
    'For passengers',
  ],
  shapes: ['swirl', 'globe', 'ring', 'path'],   // the shape under each text
  textSize: 52,            // px
  textWidth: 0.48,         // max width, × screen width
  textY: 0.43,             // top of the text, × screen height
  textLeading: 1.0,
  textTracking: -0.035,    // em
  textEntry: 'fade',       // 'scroll' (rises with the page) | 'fade'
  textIn: 0.14,            // the first text is in place here
  textFadeIn: 0.05,        // with textEntry 'fade': over this much scroll…
  textRise: 24,            // …rising this many px
  textStyle: 'blocks',     // how one text changes into the next: 'blocks' | 'fade'
  textTransition: 0.35,    // × each text's share of the scroll spent changing over
  textBlocks: 10,
  textDepth: 3,
  textScatter: 0.7,
  textOut: 0.5,            // the last text is gone this far through the exit

  // Composition
  shapeY: 0.98,            // the shape's centre, × screen height
  shapeScale: 1,
  cropY: 1,                // the structure is cut off below here, × screen height
  cropFeather: 0,          // px of soft edge above the cut
  perspective: 1000,       // px
  cardRadius: 0,           // px

  // Settle: Big scroll's photos land on the globe as it grows in round them
  settleEnd: 0.1,          // landed by here
  growStart: 0,            // the rest of the globe starts growing in…
  growStagger: 0.6,        // …not all at once

  // Changing shape
  morphLength: 0.8,        // × a text's share of the scroll, centred on the text change
  morphStagger: 0.35,      // how much the cards' start times are spread

  // Swirl
  swirlCount: 60,
  swirlRadius: 560,        // px
  swirlCard: 36,
  swirlY: 0.44,             // its centre, × screen height
  swirlTilt: 24,           // degrees the disc is tipped towards you
  swirlEye: 0.5,          // share of the radius left clear in the middle
  swirlDepth: 140,         // px thick
  swirlTumble: 35,         // degrees each card is turned at random
  swirlSpeed: 0.035,       // revolutions per second (at the rim; inner cards faster)
  swirlScroll: 0.15,       // revolutions over the whole beat

  // Globe
  sphereCount: 72,
  sphereRadius: 300,
  sphereCard: 46,
  sphereTilt: 12,          // degrees it leans towards you
  sphereSpeed: 0.02,       // revolutions per second
  sphereScroll: 0.12,      // revolutions over the whole beat
  sphereLift: 0,           // px; negative raises it

  // Ring
  ringCount: 20,
  ringRadius: 300,
  ringCard: 50,
  ringTilt: 80,            // degrees it stands up from flat (90 = facing you)
  ringSpeed: 0.03,
  ringScroll: 0.1,
  ringLift: 0,

  // Path
  pathCount: 20,
  pathCard: 48,
  pathX: -300,             // px; where the near end starts, sideways
  pathSwing: 900,          // px it swings sideways on the way back
  pathCurve: 0.6,         // how far round its curve it goes
  pathRise: 900,           // px it climbs on the way back
  pathDepth: 2400,         // px from the near end to the far end
  pathNear: 220,           // px in front of the screen at the near end
  pathLift: 140,           // px; negative raises it
  pathYaw: 0,              // degrees each card is turned
  pathSpeed: 1,            // cards per second flowing towards you
  pathScroll: 4,           // cards over the whole beat
  pathFade: 0.04,          // share of the path at the near end the cards fade over

  // Exit: everything converges on one dot
  exitStart: 0.84,
  exitEnd: 0.97,
  exitStagger: 0.3,
  endY: 0.5,               // × screen height (0.5 = true centre)
  endSize: 24,             // px
  fillColour: '#0d0d0d',
  fillStart: 0.25,         // share of the exit
  fillEnd: 0.8,

  bg: '#ffffff',
  fg: '#000000',
  images: [],
};

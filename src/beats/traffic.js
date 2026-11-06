/* Beat 2 — Traffic.

   The hero square drops out of Open road's headline (a seam: the director
   flies it down into this beat) and joins a flow of traffic heading down the
   page. Lines of text sit in the road like obstacles: the traffic squeezes
   round them and backs up above them — congestion — while the hero slips
   through, faster than everything around it. At the end the page arrives at
   "Start small", the hero settles into the gap between the two words and
   becomes a dark dot, and the Isometric platform joins on that frame.

   Everything is a pure function of scroll (no time):

     page     the text moves with the page, exactly 1:1 — this beat is a
              stretch of page, it just happens to be pinned so the traffic can
              be drawn around it. It scrolls on past "Start small" into the
              platform's black.
     traffic  cars in lanes, each lane at its own speed, all slower than the
              page — so they drift up the screen as the hero overtakes them.
              Along the road, cars are spaced by a density that rises above
              each line of text and through it: where it's dense they bunch up
              and crawl. Across the road, lanes squeeze into the room left
              beside the text — on their own side of the road.
     hero     held in the centre of the screen (it moves with the reader).
              The road always has a clear path down it for the hero, and the
              traffic flows either side and never crosses it: the hero slips
              through the congestion without disturbing anything. */

import { createTrail, TRAIL_DEFAULTS } from '../trail.js';
import { paintCover } from '../cover.js';
import { createLineReveal, revealAtTop } from '../lineReveal.js';
import { createColorWave, letters, WAVE_DEFAULTS } from '../colorWave.js';
import { span as gridSpan, gridOptions } from '../grid.js';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
const smooth = (a, b, x) => { const v = clamp01((x - a) / (b - a || 1e-6)); return v * v * (3 - 2 * v); };
const span = (v, a, b) => (b > a ? clamp01((v - a) / (b - a)) : v >= b ? 1 : 0);
const lerp = (a, b, t) => a + (b - a) * t;
const frac = (v) => v - Math.floor(v);
const rnd = (i, k) => frac(Math.sin(i * 127.1 + k * 311.7) * 43758.5453);
const SLOT = '▣';

// Mix two hex colours (t = 0 → a, 1 → b), as an rgb() string.
// A hex colour at an opacity, as an rgba() string.
function hexA(hex, a) {
  const v = String(hex || '#000').replace('#', '').padEnd(6, '0');
  const n = parseInt(v.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function mixHex(a, b, t) {
  const rgb = (h) => { const v = String(h || '#000').replace('#', '').padEnd(6, '0'); const n = parseInt(v.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const A = rgb(a), B = rgb(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(', ')})`;
}

export function createTraffic(el, config) {
  let cfg = config;
  let progress = 0;
  let road = null;          // Open road's api: where the hero comes from, and its picture
  let masked = false;       // the director is flying the hero in
  // The hero holds the exact centre of the screen (the default), or rides its
  // own lane round the text.
  const centred = () => cfg.heroPath !== 'lane';
  const trail = createTrail();

  el.classList.add('traf');

  // The page: text and cars, moved together with the reader.
  const content = document.createElement('div');
  content.className = 'traf__content';
  // The page is clipped to the stage; the hero isn't. While the stage slides
  // in from below, the hero can be higher on screen than the stage's top edge
  // (it's flying in from Open road), and clipping it there made it vanish
  // until the stage caught up with it.
  const view = document.createElement('div');
  view.className = 'traf__view';
  view.appendChild(content);
  const carLayer = document.createElement('div');
  carLayer.className = 'traf__cars';
  const texts = document.createElement('div');
  texts.className = 'traf__texts';
  content.append(carLayer, texts);

  const blurbs = [1, 2, 3].map(() => {
    const p = document.createElement('p');
    p.className = 'traf__blurb';
    texts.appendChild(p);
    return p;
  });
  const head = document.createElement('h2');
  head.className = 'traf__start';
  texts.appendChild(head);
  // Line reveals, scrubbed by where each text is on screen (lineReveal.js).
  const blurbReveals = blurbs.map((b) => createLineReveal(b));
  const headReveal = createLineReveal(head);

  // The dark of the Isometric platform, as the next stretch of this page: it
  // starts `nightGap` below "Start small" and scrolls up with everything else.
  const night = document.createElement('div');
  night.className = 'traf__night';
  content.appendChild(night);

  // The hero lives on screen, not on the page: it travels with the reader.
  const hero = document.createElement('div');
  hero.className = 'traf__hero';
  // Painted from Open road's own picture (see cover.js): the same pixels the
  // handoff tile was showing, there on the frame the hero takes over.
  const heroPaint = document.createElement('canvas');
  heroPaint.className = 'traf__heropaint';
  hero.appendChild(heroPaint);
  let painted = '';
  // The dot colour it fills with as it docks: its own layer, so wireframe's
  // grey (a filter on the photo) never greys the dot.
  const fillEl = document.createElement('div');
  fillEl.className = 'traf__fill';
  // The dot again, in the night's colour, shown only below the dark's edge —
  // so as the dark rises past it, the dot turns from dark to light exactly
  // where it's covered.
  const nightDot = document.createElement('div');
  nightDot.className = 'traf__fill traf__nightdot';
  el.append(view, hero, fillEl, nightDot);
  trail.add(hero, { mode: 'canvasFill', source: heroPaint });

  // "Start small" colour wave (colorWave.js): plays once, on time, the
  // first time it comes on screen.
  const wave = createColorWave(head);

  /* ---------- layout ---------- */

  const geo = {
    W: 0, H: 0, boxes: [], slot: null, headY: 0, arrive: 0,
    yMin: 0, yMax: 0, step: 6, Q: null, lanes: [], cars: [], heroLane: 0, from: null,
  };

  function layoutText() {
    // Un-split before changing text or measuring; split again at the end.
    blurbReveals.forEach((r) => r.unsplit());
    headReveal.unsplit();
    const { W, H } = geo;
    el.style.setProperty('--traf-bg', cfg.bg);
    el.style.setProperty('--traf-fg', cfg.fg);
    // On the layout grid (grid.js): each line fills a run of columns and
    // wraps inside it, aligned left, centre or right within that run.
    blurbs.forEach((b, i) => {
      const n = i + 1;
      b.textContent = cfg[`blurb${n}Text`];
      const box = gridSpan(W, cfg[`blurb${n}Col`], cfg[`blurb${n}Span`]);
      Object.assign(b.style, {
        top: `${(cfg.blurbStart + i * cfg.blurbGap) * H}px`,
        left: `${box.x}px`,
        width: `${box.w}px`,
        fontSize: `${cfg.blurbSize}px`,
        lineHeight: String(cfg.blurbLeading),
        textAlign: cfg[`blurb${n}Align`],
        transform: '',
      });
    });

    // "Start ▣ small": the ▣ is the gap the hero docks in.
    // One span per letter, for the colour wave.
    head.textContent = '';
    const [a, ...rest] = String(cfg.startText).split(SLOT);
    letters(head, a);
    const slot = document.createElement('span');
    slot.className = 'traf__slot';
    if (rest.length) { head.append(slot); letters(head, rest.join(SLOT)); }
    Object.assign(head.style, {
      fontSize: `${cfg.startSize * W}px`,
      letterSpacing: `${cfg.startTracking}em`,
      top: `${(cfg.blurbStart + 2 * cfg.blurbGap + cfg.startGap) * H}px`,
    });
    slot.style.width = `${cfg.slotWidth}px`;

    // Measure everything in page coordinates (relative to the content layer).
    const c = content.getBoundingClientRect();
    const rel = (r) => ({ x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height });

    // With the hero held in the centre, "Start small" is shifted sideways so
    // its gap — not the line as a whole — is centred: the hero docks without
    // moving off centre.
    head.style.marginLeft = '0px';
    if (centred() && rest.length) {
      // Its two halves aren't the same width, so centring the gap can push
      // the longer word off screen: scale the line down just enough that the
      // longer side still fits inside the margin.
      const h0 = rel(head.getBoundingClientRect());
      let s0 = rel(slot.getBoundingClientRect());
      const mid = s0.x + s0.w / 2;
      const reach = Math.max(mid - h0.x, h0.x + h0.w - mid);
      // It's kept inside the grid's margins.
      const room = W / 2 - gridOptions().gridMargin;
      if (reach > room && reach > 0) {
        head.style.fontSize = `${(cfg.startSize * W * room) / reach}px`;
        s0 = rel(slot.getBoundingClientRect());
      }
      head.style.marginLeft = `${(W / 2 - (s0.x + s0.w / 2)).toFixed(2)}px`;
    }
    const hr = rel(head.getBoundingClientRect());
    geo.headY = hr.y + hr.h / 2;
    const sr = rest.length ? rel(slot.getBoundingClientRect()) : { x: W / 2, y: hr.y, w: 0, h: hr.h };
    const d = cfg.dotSize;
    geo.slot = {
      x: sr.x + sr.w / 2 - d / 2,
      y: hr.y + hr.h / 2 + cfg.slotLift * parseFloat(head.style.fontSize) - d / 2,
      w: d, h: d,
    };
    // Where the gap is on the page (its centre): where the traffic funnels to.
    geo.gapY = geo.slot.y + d / 2;
    // Parallax: from the moment "Start small" enters the bottom of the screen
    // to the moment it leaves the top, it falls behind the page by a steady
    // `startParallaxPx` in total — so the dark, which keeps page speed, gains
    // that much on it. (Capped below the distance it travels, so it always
    // still moves upwards.)
    const travel = hr.h + H;
    geo.plx = { enter: hr.y - H, travel, px: Math.min(cfg.startParallaxPx, travel * 0.9) };
    // The scroll at which "Start small" reaches its place on screen. Centred,
    // that's when its gap passes the middle of the screen, where the hero is —
    // allowing for the parallax. The page doesn't stop there: it carries on,
    // "Start small" scrolls up and away, and the dark follows it in.
    geo.arrive = Math.max(0, centred()
      ? solveArrive(geo.gapY - H / 2)
      : geo.headY - cfg.startY * H);
    geo.nightTop = hr.y + hr.h + cfg.nightGap;
    // Where each text's top is on the page, for its line reveal.
    geo.blurbTops = blurbs.map((b) => rel(b.getBoundingClientRect()).y);
    geo.headTop = hr.y;
    Object.assign(night.style, { top: `${geo.nightTop}px`, height: `${3 * H}px`, background: cfg.night });
    // The beat ends as the dark reaches the top of the screen.
    geo.end = Math.max(geo.arrive, geo.nightTop);
    blurbReveals.forEach((r) => r.split());
    headReveal.split();
    wave.remeasure();   // the letters were rebuilt: measure them again
    // Measured after the split, from the text as it's drawn: the line reveal
    // re-wraps it (SplitText breaks lines plainly, not balanced like the CSS
    // does), so its lines can reach further than the unsplit text's.
    geo.boxes = blurbs.filter((b) => b.textContent.trim()).map((b) => {
      // The text's own extent across, not its box: a short last line
      // shouldn't hold traffic back across the full width. Down, the block:
      // the reveal moves the lines up and down inside it.
      let l = Infinity, r = -Infinity;
      const walk = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        if (!n.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const q of range.getClientRects()) { l = Math.min(l, q.left); r = Math.max(r, q.right); }
      }
      const bb = b.getBoundingClientRect();
      if (!(r > l)) { l = bb.left; r = bb.right; }
      const pad = cfg.flowPad;
      return { left: l - c.left - pad, right: r - c.left + pad, top: bb.top - c.top - pad, bottom: bb.bottom - c.top + pad };
    });
  }

  // How far "Start small" has fallen behind the page at scroll s.
  function startLag(s) {
    const p = geo.plx;
    if (!p || !p.px) return 0;
    return clamp01((s - p.enter) / p.travel) * p.px;
  }

  // The scroll at which the gap, parallax included, is at `target` scroll
  // (where it's level with the hero). s − lag(s) only ever increases, so a
  // bisection finds it.
  function solveArrive(target) {
    let lo = target - Math.abs(geo.plx?.px || 0) - geo.H, hi = target + Math.abs(geo.plx?.px || 0) + geo.H;
    for (let i = 0; i < 48; i++) { const mid = (lo + hi) / 2; if (mid - startLag(mid) < target) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }

  /* ---------- the road ----------
     Density along the road, as a table: ρ = 1 plus a bump above and through
     each line of text. Q is its running total. A car's place along its lane
     is a position in Q, advancing steadily with scroll; turning Q back into
     a y spaces cars by 1/ρ — where ρ is high they bunch up, and since they
     cover less ground per scroll there, they crawl. */

  function density(y) {
    let r = 1;
    const L = cfg.congestLength * geo.H;
    for (const b of geo.boxes) {
      r += cfg.congestion * smooth(b.top - L, b.top, y) * (1 - smooth(b.bottom, b.bottom + L * 0.4, y));
    }
    return r;
  }

  function buildRoad() {
    const { H } = geo;
    geo.yMin = -1.5 * H;
    geo.yMax = geo.arrive + 2 * H;
    const n = Math.ceil((geo.yMax - geo.yMin) / geo.step) + 1;
    const Q = new Float32Array(n);
    for (let i = 1; i < n; i++) {
      const y = geo.yMin + (i - 0.5) * geo.step;
      Q[i] = Q[i - 1] + density(y) * geo.step;
    }
    geo.Q = Q;
    geo.Qspan = Q[n - 1];
  }

  // Q -> y, by binary search on the table.
  function yAt(q) {
    const Q = geo.Q;
    let lo = 0, hi = Q.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (Q[mid] <= q) lo = mid; else hi = mid; }
    const t = (q - Q[lo]) / ((Q[hi] - Q[lo]) || 1);
    return geo.yMin + (lo + t) * geo.step;
  }

  /* What fills each piece of traffic: one of the images in
     src/assets/traffic, or one of the `colours`. `colourShare` of the pieces
     are colours, the rest images — chosen per piece by a seeded number, so
     the mix is the same on every load and only changes when you change it.
     With no images (or no colours) everything uses the other. */
  function fillFor(id) {
    const imgs = cfg.images || [];
    const cols = (cfg.colours || []).filter((c) => /^#[0-9a-f]{6}$/i.test(c));
    const wantColour = cols.length && (!imgs.length || rnd(id, 8) < cfg.colourShare);
    if (wantColour) return { src: '', fill: cols[Math.floor(rnd(id, 9) * cols.length) % cols.length] };
    if (imgs.length) return { src: imgs[Math.floor(rnd(id, 10) * imgs.length) % imgs.length].src, fill: '' };
    return { src: '', fill: '#d9d9d9' };
  }

  /* The hero's clear path. The road always has a clear lane down it, where
     the hero travels — `corridor` either side of the hero (wider while it's
     still settling in, bigger, from Open road). The traffic lives in the two
     sides of the road either side of it and never crosses it: nothing ever
     has to be pushed out of the hero's way. */
  const clearHalf = (size) => size / 2 + (centred() ? 0 : Math.abs(cfg.heroSway)) + cfg.corridor;

  // The hero's size when it's level with page position y (it's at page
  // y = s + its screen height, so that's a scroll position).
  function heroSizeAtPage(y) {
    if (!geo.from) return cfg.heroSize;
    const H = geo.H, s0 = release();
    const s = y - (centred() ? H / 2 : cfg.heroY * H);
    return lerp(geo.from.w, cfg.heroSize, ease(span(s, s0, s0 + cfg.heroSettle * H)));
  }

  function sides(half) {
    const { W } = geo, m = cfg.laneMargin * W, c = geo.heroLane;
    return [{ a: m, b: Math.max(m + 1, c - half) }, { a: Math.min(W - m - 1, c + half), b: W - m }];
  }

  /* Where a lane is across the road at page y, for a car `w` wide: its
     place across its side, a gentle wander, then steered round any line of
     text — never into the hero's path, never into the text's clearance.

     Round a line of text, a lane first looks for room on screen beside it
     on its own side (traffic bunches and narrows round the words). Where the
     text leaves no room on screen — on a phone a line can fill its whole
     side — the side reaches past the screen edge by up to `flowOffscreen`
     screen widths, and the lane snakes out round the text's outer edge,
     off screen, and back on below it. The clearance (`flowPad`) is kept
     either way. */
  // How far (0–1) the last laneX call was going round text off screen: the
  // closing formation waits for that, so it never pulls a car back through
  // the words.
  let offK = 0;
  function laneX(lane, y, w) {
    const { W, H } = geo;
    offK = 0;
    const half = clearHalf(Math.max(cfg.heroSize, heroSizeAtPage(y)));
    const { a, b } = sides(half)[lane.side];
    // The side's outer edge, pushed past the screen: left for the left side,
    // right for the right. The inner edge is the hero's path and never moves.
    const off = Math.max(0, cfg.flowOffscreen) * W;
    const ea = lane.side === 0 ? Math.min(a, -off) : a;
    const eb = lane.side === 1 ? Math.max(b, W + off) : b;
    const u = lane.u;
    let x = a + u * (b - a);
    if (cfg.laneWander) x += cfg.laneWander * Math.sin((y / Math.max(1, cfg.laneWanderLength * H)) * Math.PI * 2 + lane.phase);
    let lo = a, hi = b;
    const soft = cfg.flowSoft * H, min = 40;
    for (const bx of geo.boxes) {
      if (bx.right <= ea || bx.left >= eb) continue;        // not on this side
      const k = smooth(bx.top - soft, bx.top, y) * (1 - smooth(bx.bottom, bx.bottom + soft, y));
      if (k <= 0) continue;
      // Room either side of the text: on screen first…
      let A = a, B = b;
      let l = Math.max(A, bx.left), r = Math.min(B, bx.right);
      if (l - A < min && B - r < min) {
        // …and if there's none, past the screen edge.
        A = ea; B = eb;
        l = Math.max(A, bx.left); r = Math.min(B, bx.right);
        if (A < a || B > b) offK = Math.max(offK, k);
      }
      const Lw = l - A, Rw = B - r;
      if (Lw < min && Rw < min) continue;                   // nowhere to go even off screen
      let m;
      if (Lw < min) m = r + u * Rw;
      else if (Rw < min) m = A + u * Lw;
      else {
        // Room both sides: lanes split at the text's middle, each going
        // wholly one way. (A lane's place across, `u`, never changes, so
        // there's no jump; blending at the split would steer the lanes right
        // there into the middle of the words.)
        const sp = clamp01(((l + r) / 2 - a) / (b - a || 1));
        m = u < sp ? A + (u / (sp || 1)) * Lw : r + ((u - sp) / ((1 - sp) || 1)) * Rw;
      }
      x = lerp(x, m, k);
      lo = Math.min(lo, A); hi = Math.max(hi, B);
    }
    // Keep the whole car inside the room it's using: its side of the road,
    // plus the off-screen reach while it's going round text.
    return hi - lo > w ? Math.min(hi - w / 2, Math.max(lo + w / 2, x)) : (lo + hi) / 2;
  }

  /* Lanes across the road, leaving the hero's lane (and its sway) clear. Each
     lane has a speed; its cars are laid end to end along Q at seeded gaps and
     repeat round the whole road. */
  function buildCars() {
    const { W } = geo;
    // Lanes share the road either side of the hero's clear path, in
    // proportion to the room on each side. Each lane belongs to one side for
    // good: it's placed as a fraction `u` across that side.
    const nL = Math.max(1, Math.round(cfg.lanes));
    const [L, R] = sides(clearHalf(cfg.heroSize));
    const Lw = Math.max(0, L.b - L.a), Rw = Math.max(0, R.b - R.a);
    geo.lanes = [];
    for (let l = 0; l < nL; l++) {
      const t = ((l + 0.5 + (rnd(l, 1) - 0.5) * 0.5) / nL) * (Lw + Rw);
      const left = t < Lw;
      geo.lanes.push({
        i: l, side: left ? 0 : 1, u: left ? t / (Lw || 1) : (t - Lw) / (Rw || 1),
        v: lerp(cfg.speedMin, cfg.speedMax, rnd(l, 2)), w: lerp(cfg.carWidthMin, cfg.carWidthMax, rnd(l, 3)),
        phase: rnd(l, 7) * Math.PI * 2,
      });
    }
    // Each lane's place in the closing formation, counted out from the hero:
    // 0 is the lane nearest it on that side.
    for (const side of [0, 1]) {
      const ls = geo.lanes.filter((ln) => ln.side === side);
      ls.forEach((ln, k) => { ln.rank = side === 0 ? ls.length - 1 - k : k; });
    }
    const cars = [];
    geo.lanes.forEach((lane, l) => {
      let q = rnd(l, 4) * cfg.carGapMax;
      let k = 0;
      while (q < geo.Qspan) {
        const len = lerp(cfg.carLenMin, cfg.carLenMax, rnd(l * 97 + k, 5));
        cars.push({ lane, q0: q, len, ...fillFor(l * 97 + k) });
        q += len + lerp(cfg.carGapMin, cfg.carGapMax, rnd(l * 97 + k, 6));
        k++;
      }
    });
    // Reuse elements where we can; the count changes with the layout.
    while (geo.cars.length > cars.length) { const c = geo.cars.pop(); trail.remove(c.el); c.el.remove(); }
    cars.forEach((c, i) => {
      let old = geo.cars[i];
      if (!old) {
        const e = document.createElement('div');
        e.className = 'traf__car';
        carLayer.appendChild(e);
        old = geo.cars[i] = { el: e };
        trail.add(e);
      }
      Object.assign(old, c, { shown: null, bgKey: '' });
      // Wireframe greys out pictures; colour fills keep their colour.
      old.el.classList.toggle('is-photo', !!c.src);
      Object.assign(old.el.style, {
        width: `${c.lane.w}px`, height: `${c.len}px`,
        borderRadius: `${cfg.carRadius}px`,
        backgroundImage: c.src ? `url("${c.src}")` : '',
        backgroundColor: c.fill || '',
        visibility: 'hidden',
      });
    });
  }

  function computeGeometry() {
    geo.W = el.clientWidth;
    geo.H = el.clientHeight;
    if (!geo.W || !geo.H) return;
    // Where the hero arrives from: Open road's square.
    const a = road?.anchor?.('exit');
    geo.from = a ? { ...a.rect } : { x: geo.W / 2 - 40, y: geo.H * 0.2, w: 80, h: 80 };
    geo.heroLane = centred() ? geo.W / 2 : geo.from.x + geo.from.w / 2 + cfg.heroShift * geo.W;
    layoutText();
    buildRoad();
    buildCars();
  }

  /* ---------- scroll ----------
     The beat leads (it starts as Open road unsticks), so its progress covers
     its slide-in too. `s` is how far the page has scrolled past the point
     where this stage locks: negative while it's sliding in. */

  const lenPx = () => naturalLength() * geo.H;
  const scrollAt = (p) => p * lenPx() - geo.H;

  // When the square is released: as Open road's stage unsticks (the start of
  // this beat's slide-in, s = -H), after Open road's `seamHold` of that gap.
  const release = () => (Math.min(1, Math.max(0, road?.config?.seamHold ?? 0)) - 1) * geo.H;

  /* The hero, on screen, at scroll s. One path from the moment it's released:
     it starts exactly as Open road's 1:1 square (same place, same size, at
     rest) and eases into its lane, its height and its size together, over
     `heroSettle` screens. The director's handoff tile follows this same path
     (a *live* anchor), so there's no separate flight to meet. (heroAt is
     below; first, its colour.) */

  // The hero's colour is Open road's: it arrives already wearing it (the
  // square takes it on as it becomes 1:1), and keeps it until docking turns
  // it to the dot colour.
  const heroColour = () => road?.config?.heroColour ?? '#5b3df5';
  function heroTint(s, dock) {
    const t = road?.anchor?.('exit')?.tint;
    const tint = t ? t.opacity : 1;
    const dockFill = smooth(0.4, 1, dock);
    return { opacity: tint + (1 - tint) * dockFill, colour: mixHex(heroColour(), cfg.dotColour, dockFill), dockFill };
  }

  function heroAt(s) {
    const { W, H, from } = geo;
    const s0 = release();
    const k = ease(span(s, s0, s0 + cfg.heroSettle * H));
    const off = Math.min(Math.max(0, s), geo.arrive);
    let yTo, xTo;
    if (centred()) {
      // Held dead centre: the page and the traffic do all the moving.
      xTo = W / 2;
      yTo = H / 2;
    } else {
      const sway = Math.sin(((s - s0) / Math.max(1, cfg.heroSwayLength * H)) * Math.PI * 2) * cfg.heroSway * k;
      yTo = cfg.heroY * H;
      // Where the hero is on the page. Not clamped at 0: while the stage slides
      // in, the page is moving under the hero just the same, and a clamp there
      // would start its weave round the first line with a jolt.
      // Its own lane, straight down the road (the clear path follows it).
      xTo = geo.heroLane + sway;
    }
    const yScreen = lerp(from.y + from.h / 2, yTo, k);
    const cx = lerp(from.x + from.w / 2, xTo, k);
    const size = lerp(from.w, cfg.heroSize, k);
    let r = { x: cx - size / 2, y: yScreen - size / 2, w: size, h: size };
    // Dock: into the gap in "Start small" as it passes.
    const d = ease(span(s, geo.arrive - cfg.dockLead * H, geo.arrive + cfg.dockTail * H));
    if (d > 0) {
      // Centred, the gap passes through the hero (it's in the middle of the
      // screen at `arrive`), so the hero only shrinks and fills where it is.
      // In a lane, it steers into the gap and stays where it met it.
      const sl = centred()
        ? { x: geo.W / 2 - geo.slot.w / 2, y: geo.H / 2 - geo.slot.h / 2, w: geo.slot.w, h: geo.slot.h }
        : { ...geo.slot, y: geo.slot.y - off };
      r = { x: lerp(r.x, sl.x, d), y: lerp(r.y, sl.y, d), w: lerp(r.w, sl.w, d), h: lerp(r.h, sl.h, d) };
    }
    return { r, dock: d };
  }

  function render(p) {
    if (!geo.W) computeGeometry();
    if (!geo.W) return;
    const { H } = geo;
    const s = scrollAt(p);
    // The page moves 1:1 the whole way, past "Start small" into the dark.
    const off = Math.max(0, s);
    // While it slides in, the stage itself is moving: its top is this far
    // down the screen. Screen = stage + stageTop.
    const stageTop = s < 0 ? -s : 0;
    content.style.transform = `translate3d(0, ${(-off).toFixed(2)}px, 0)`;
    // Parallax: "Start small" falls steadily behind the page while it crosses
    // the screen (see startLag), and the dark, at page speed, gains on it.
    const lag = startLag(s);
    head.style.translate = lag ? `0 ${lag.toFixed(2)}px` : '';
    // Line reveals: each text's lines rise in as it comes up the screen.
    blurbReveals.forEach((r, i) => r.set(revealAtTop(geo.blurbTops[i] - off + stageTop, H)));
    headReveal.set(revealAtTop(geo.headTop - off + stageTop + lag, H));
    wave.update(geo.headTop - off + stageTop + lag, H, cfg);

    const h = heroAt(s);
    const hcx = h.r.x + h.r.w / 2, hcy = h.r.y + h.r.h / 2 + s;   // page coords
    // Along the way to "Start small" (0 = this beat's top, 1 = the gap):
    // the traffic starts big and packed, shrinks to the hero's size and
    // shape, then funnels into the gap, fading as it gets there.
    const toGap = (y) => y / Math.max(1, geo.gapY);
    const carColour = cfg.carColourSource === 'custom' ? cfg.carColour : heroColour();
    const clearTop = geo.gapY - cfg.clearRamp * H;

    for (const c of geo.cars) {
      const q = c.q0 + c.lane.v * s;
      const y = yAt(((q % geo.Qspan) + geo.Qspan) % geo.Qspan);
      const sy = y - off + stageTop;                    // on screen
      // The road fades in from the top of this beat's page and clears again
      // before "Start small" — both by place on the page, so the traffic
      // emerges as the page arrives rather than switching on.
      const op = smooth(cfg.fadeInFrom * H, (cfg.fadeInFrom + cfg.fadeInRamp) * H, y)
        * (1 - smooth(clearTop, geo.gapY, y));
      const f = toGap(y);
      const shrink = smooth(cfg.shrinkFrom, cfg.shrinkTo, f);
      const cw = lerp(c.lane.w * cfg.carScaleTop, cfg.heroSize, shrink);
      const cl = lerp(c.len * cfg.carScaleTop, cfg.heroSize, shrink);
      const show = op > 0.002 && sy > -cl && sy < H + cl;
      if (!show) { if (c.shown !== false) { c.el.style.visibility = 'hidden'; c.shown = false; } continue; }
      let x = laneX(c.lane, y, cw);
      // The closing formation. Near the end the lanes gather in round the
      // hero into a tight, even band, each lane `endLaneGap` from the next
      // and in the same order, so no two pieces ever meet — and the hero's
      // path down the middle stays clear. They flow up into the gap like that,
      // fading as they get there.
      // (Not while it's still going round text off screen: it gathers in
      // once it's past.)
      const merge = smooth(cfg.mergeFrom, cfg.mergeTo, f) * (1 - offK);
      if (merge > 0) {
        const inner = clearHalf(cfg.heroSize) + cfg.endLaneGap + cw / 2;
        const endX = geo.W / 2 + (c.lane.side ? 1 : -1) * (inner + c.lane.rank * (cw + cfg.endLaneGap));
        x = lerp(x, endX, merge);
      }
      c.op = op;
      const st = c.el.style;
      const wpx = `${cw.toFixed(2)}px`, hpx = `${cl.toFixed(2)}px`;
      if (st.width !== wpx) st.width = wpx;
      if (st.height !== hpx) st.height = hpx;
      st.transform = `translate3d(${(x - cw / 2).toFixed(2)}px, ${(y - cl / 2).toFixed(2)}px, 0)`;
      st.opacity = c.op >= 0.999 ? '' : c.op.toFixed(3);
      // As the traffic becomes the hero's size and shape, it takes on a
      // colour too — the hero's, or its own — by the time it reaches the gap.
      // A colour layer over the picture, in the car's own style so motion
      // trail echoes carry it. Stepped in 2% increments to keep restyling rare.
      const tint = Math.round(cfg.carColourAmount * smooth(cfg.carColourFrom, cfg.carColourTo, f) * 50) / 50;
      const bgKey = tint > 0 ? `${carColour}|${tint}` : '';
      if (c.bgKey !== bgKey) {
        c.bgKey = bgKey;
        const img = c.src ? `url("${c.src}")` : '';
        const col = hexA(carColour, tint);
        st.backgroundImage = tint > 0 ? `linear-gradient(${col}, ${col})${img ? `, ${img}` : ''}` : img;
        // Also as a variable, so wireframe can show the colour over its grey.
        if (tint > 0) st.setProperty('--tint', col); else st.removeProperty('--tint');
      }
      if (c.shown !== true) { st.visibility = ''; c.shown = true; }
    }

    // Hero.
    const ex = road?.anchor?.('exit');
    const src = ex?.src || '';
    if (hero.dataset.src !== src) hero.dataset.src = src;
    // Repaint when the picture or the size changes (the size changes while it
    // settles; the picture when Open road freezes a new frame).
    if (ex?.source) {
      const k = `${ex.key}|${Math.round(h.r.w)}x${Math.round(h.r.h)}`;
      if (k !== painted && paintCover(heroPaint, ex.source, h.r.w, h.r.h)) painted = k;
      heroPaint.style.display = '';
    } else heroPaint.style.display = 'none';
    const ht = heroTint(s, h.dock);
    const fill = ht.opacity, fillCol = ht.colour, dockFill = ht.dockFill;
    const bg = src ? `url("${src}")` : '';
    if (hero.style.backgroundImage !== bg) hero.style.backgroundImage = bg;
    const box = {
      transform: `translate3d(${h.r.x.toFixed(2)}px, ${(h.r.y - stageTop).toFixed(2)}px, 0)`,
      width: `${h.r.w.toFixed(2)}px`, height: `${h.r.h.toFixed(2)}px`,
      borderRadius: `${lerp(cfg.heroRadius, 0, h.dock).toFixed(2)}px`,
    };
    // Once fully filled, the photo underneath is hidden: the dot is just the dot.
    // Before the release, Open road still owns the square (and the stage below
    // the fold no longer clips the hero), so don't draw a second one.
    const unreleased = s <= -H + 0.5;
    Object.assign(hero.style, box, { visibility: masked || unreleased || fill >= 1 ? 'hidden' : '' });
    Object.assign(fillEl.style, box, {
      background: fillCol, opacity: fill >= 1 ? '' : fill.toFixed(3),
      visibility: masked || unreleased || fill <= 0 ? 'hidden' : '',
    });
    // Where the dark's edge is across the dot (stage coordinates): above it,
    // the dot is dark; below, it's the night dot.
    const cut = (geo.nightTop - off) - (h.r.y - stageTop);
    const under = cut < h.r.h;
    Object.assign(nightDot.style, box, {
      background: cfg.nightDot, opacity: dockFill >= 1 ? '' : dockFill.toFixed(3),
      clipPath: cut > 0 ? `inset(${Math.min(h.r.h, cut).toFixed(2)}px 0 0 0)` : '',
      visibility: masked || unreleased || dockFill <= 0 || !under ? 'hidden' : '',
    });
  }

  // Sized so the page moves 1:1: the slide-in (one screen), the scroll past
  // "Start small" until the dark fills the screen, and an optional hold.
  function naturalLength() {
    if (!geo.H) return cfg.length || 6;
    return 1 + (geo.end + cfg.endHold * geo.H) / geo.H;
  }

  /* ---------- api ---------- */

  function setConfig(next) {
    // A changed wave setting plays the wave again (when it's next on screen).
    wave.configure(cfg, next);
    cfg = next;
    trail.setOptions(cfg);
    computeGeometry();
    render(progress);
  }

  trail.setOptions(cfg);
  computeGeometry();
  render(0);
  if (document.fonts) document.fonts.ready.then(() => { computeGeometry(); render(progress); });

  return {
    seek(p) { progress = p; render(p); },
    setConfig,
    relayout() { computeGeometry(); render(progress); },
    naturalLength,
    // The beat that hands us the hero (the director, for a seam).
    handedBy(api) { road = api; computeGeometry(); render(progress); },
    // The handoff tile *is* the hero while the director carries it: a live
    // anchor — where the hero is right now, not where a flight should end.
    anchor(which) {
      if (which !== 'entry') return null;
      if (!geo.W) computeGeometry();
      if (!geo.from || !geo.slot) return null;   // not measured yet (the director retries)
      const s = scrollAt(progress);
      const h = heroAt(s);
      const t = heroTint(s, h.dock);
      // `tint`: the colour the hero is taking on, so the tile carrying it
      // shows exactly what the hero will when it takes over.
      return { rect: h.r, src: road?.anchor?.('exit')?.src || '', live: true, tint: { colour: t.colour, opacity: t.opacity } };
    },
    maskAnchor(which, on) { if (which === 'entry') { masked = on; render(progress); } },
    // For the Isometric platform, which joins on this beat's last frame: by
    // then the dark fills the screen, so it's the light dot on the night.
    exitDot() {
      if (!geo.W) computeGeometry();
      if (!geo.slot || !geo.from) return null;     // no layout yet
      return { rect: heroAt(scrollAt(1)).r, colour: cfg.nightDot, bg: cfg.night, decor: null };
    },
    trail,
    // The element that carries the hero in this beat (for the director, so it
    // can clear its echoes when the hero changes hands).
    trailTarget: () => hero,
    destroy() { blurbReveals.forEach((r) => r.destroy()); headReveal.destroy(); wave.destroy(); trail.destroy(); el.classList.remove('traf'); view.remove(); hero.remove(); fillEl.remove(); },
    get config() { return cfg; },
  };
}

export const TRAFFIC_DEFAULTS = {
  ...TRAIL_DEFAULTS,

  // Text, laid out down the page (× screen height from the top of this beat)
  // Across, each line sits on the layout grid (grid.js): it starts at
  // column `Col` (1-based), spans `Span` columns and wraps inside them.
  blurb1Text: 'In the future, there is no traffic.',
  blurb1Col: 2, blurb1Span: 3, blurb1Align: 'left',
  blurb2Text: 'We see traffic as a problem of scale—small trips, big vehicles.',
  blurb2Col: 8, blurb2Span: 3, blurb2Align: 'left',
  blurb3Text: 'ALSO is designing the world’s best small vehicles for all the small trips.',
  blurb3Col: 5, blurb3Span: 4, blurb3Align: 'center',
  blurbSize: 28,           // px
  blurbLeading: 1.05,
  blurbStart: 1.0,         // the first line's top, × screen height down the page
  blurbGap: 1.15,          // between lines, × screen height

  // "Start small"
  startText: 'Start ▣ small',
  startSize: 0.2,          // × screen width
  startTracking: -0.045,   // em
  startGap: 1.0,           // below the last line, × screen height
  startY: 0.5,             // where it stops on screen (its middle), × screen height
  slotWidth: 70,           // px: the gap the dot docks in
  slotLift: -0.06,         // the dot's height in the gap, × type size (negative raises it)

  // "Start small" colour wave (colorWave.js)
  ...WAVE_DEFAULTS,

  // Hero
  heroPath: 'centre',      // 'centre': held dead centre all the way | 'lane': rides a lane round the text
  heroY: 0.62,             // its height on screen while in traffic, × screen height
  heroSize: 46,            // px
  heroShift: 0,            // its lane, from straight below Open road's square, × screen width
  heroSettle: 0.8,         // screens it takes to settle into traffic
  heroSway: 14,            // px it weaves
  heroSwayLength: 1.4,     // screens per weave
  heroRadius: 0,
  dockLead: 0.9,           // screens before the gap reaches the hero that it starts docking
  dockTail: 0,             // screens after
  endHold: 0,              // screens held in the dark at the end, before the platform
  nightGap: 160,           // px from the bottom of "Start small" to the dark (negative overlaps it)
  startParallaxPx: 0,      // px the dark gains on "Start small" while it crosses the screen (0 = none)
  night: '#000000',        // the dark (the platform's background)
  nightDot: '#ffffff',     // the dot, once the dark covers it
  dotSize: 24,
  dotColour: '#0d0d0d',

  // Traffic, along the way to "Start small" (0 = top of this beat, 1 = the gap)
  carScaleTop: 1.6,        // how much bigger the traffic starts (packed, congested)
  shrinkFrom: 0.45,        // it starts shrinking to the hero's size and shape here…
  shrinkTo: 0.72,          // …and has by here
  mergeFrom: 0.8,          // the lanes start gathering round the hero here…
  mergeTo: 1,              // …and are in formation by here
  endLaneGap: 12,          // px between lanes in that formation
  colours: ['#AC74FC', '#FF5A36', '#1C1C1C', '#F2C14E', '#7FB8A4'],   // colour fills mixed in with the images
  colourShare: 0.3,        // share of the traffic that's colour rather than images (0–1)
  carColourSource: 'hero', // the colour the traffic turns: 'hero' (follows the hero's) | 'custom'
  carColour: '#5b3df5',    // with 'custom'
  carColourAmount: 1,      // how fully (0 = keeps its pictures)
  carColourFrom: 0.7,      // it starts turning here…
  carColourTo: 0.9,        // …and has by here
  laneWander: 8,           // px each lane drifts from side to side, so the flow isn't ruled lines
  laneWanderLength: 0.9,   // screens per drift
  lanes: 16,
  laneMargin: 0.03,        // × screen width kept clear at each side
  corridor: 18,            // px of clear road either side of the hero, all the way down
  carWidthMin: 10, carWidthMax: 16,
  carLenMin: 16, carLenMax: 64,
  carGapMin: 120, carGapMax: 760,
  carRadius: 2,
  speedMin: 0.2,           // how fast lanes move down the page, × scroll speed —
  speedMax: 0.65,          // under 1 means the hero overtakes them
  congestion: 1.6,         // how much traffic bunches up at a line of text
  congestLength: 0.6,      // how far back the queue reaches, × screen height
  flowPad: 26,             // px kept clear round the text
  flowOffscreen: 0.25,     // where text leaves no room on screen, traffic may leave the screen by this much to go round it, × screen width
  flowSoft: 0.35,          // how gradually lanes squeeze in and out, × screen height
  fadeInFrom: 0,           // the road starts this far down the page (× screen height)…
  fadeInRamp: 0.7,         // …and fades in over this × screen height
  clearRamp: 0.7,          // the road clears before "Start small", over this × screen height

  bg: '#ffffff',
  fg: '#000000',
  images: [],
};

/* Mobile starting values (phones and tablets, below 1024 px wide), applied
   over the desktop ones. Edit them in the inspector's Mobile mode. Fewer,
   smaller lanes on a narrow road; on the 4-column grid the lines take three
   columns from the left, three to the right, and all four, centred. */
export const TRAFFIC_MOBILE = {
  blurbSize: 22,
  blurb1Col: 1, blurb1Span: 3, blurb1Align: 'left',
  blurb2Col: 2, blurb2Span: 3, blurb2Align: 'right',
  blurb3Col: 1, blurb3Span: 4, blurb3Align: 'center',
  flowPad: 14,
  flowOffscreen: 0.6,
  lanes: 7,
  laneMargin: 0.04,
  carScaleTop: 1.1,
  carWidthMin: 8, carWidthMax: 14,
  carLenMin: 14, carLenMax: 40,
  carGapMin: 80, carGapMax: 420,
  corridor: 16,
  heroSize: 20,
  endLaneGap: 8,
  trail: 'off',
};

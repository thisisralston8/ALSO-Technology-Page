/* Beat 5 — Investors and careers (placeholder content).

   The transition in is a pixel band: Section 5's top edge isn't a straight
   line but a band of square pixels in its colour, densest at the bottom and
   thinning out upward, ragged column by column — and it fills in a little
   more as it rides up the screen. The band hangs above the section's top
   edge, over the end of Platform verticals, and scrolls with the page
   (director `flow`), so there's no hold.

   It's one canvas, redrawn only when what it shows changes (its fill, or the
   layout). Every square is a pure function of (column, row, seed, settings,
   progress) — the seeded `rnd`, never Math.random — so scrubbing back and
   forth is exact.

   The dot cursor belongs to Platform verticals: over this section the normal
   cursor is back. Verticals asks where this section's band is (`floor`).

   Over the section, the cursor leaves a pixel trail (after Atelier's Pixel
   Trail): squares on a grid, stamped with a round brush along the pointer's
   path, each living `trailLifetime` and fading over its last `trailFade`.
   Solid colour, or sampled from the section's images. The squares belong to
   the section — they scroll with it. Time-based, like the cursor lens and
   the grain; it never touches layout, and its loop only runs while there
   are squares to draw. Mouse and trackpad only.

   A partner row under the cursor (or with keyboard focus) fills white,
   wiping up from its rule, and shows an arrow at its right, revealed by the
   same edge. The fills are their own layer under the trail, so the trail's
   squares over a fill are drawn in the section's colour; the names stay on
   top. The wipe runs on time (like the trail), never on scroll. A partner
   with a link makes its row a link. */

import { span as gridSpan } from '../grid.js';
import { createLineReveal, revealAtTop, revealOptions } from '../lineReveal.js';

export const CAREERS_DEFAULTS = {
  height: 1.5,             // screens; it scrolls like a page, so this is also how far it scrolls
  bg: '#AC74FC',           // the section's colour, and the pixels'
  fg: '#000000',
  // A placeholder title (off now the investor content is in)
  titleShow: 'off',
  title: 'Investors and Careers',
  titleSize: 92,
  titleCol: 2,
  titleSpan: 8,

  // Investors (Figma "Desktop - 117"): a headline, the partners as a ruled
  // list, and two contacts. On the grid; stacked from `invTop`.
  invTop: 120,             // px, from the section's top
  invHead: 'Our partners share our belief that the future of transportation is small.',
  invHeadCol: 4, invHeadSpan: 6, invHeadAlign: 'center',
  invHeadSize: 60, invHeadLeading: 56, invHeadTracking: -3,
  invGap: 120,             // px, headline to the list
  // Each a name, or { text, url } for a row that links somewhere.
  partners: ['Rivian', 'Doordash', 'Eclipse', 'Prysm', 'Greenoaks'],
  listCol: 4, listSpan: 6,
  partnerSize: 32, partnerLeading: 36, partnerTracking: -1.5,
  partnerGap: 40,          // px, between partners
  ruleGap: 20,             // px, a partner's name to its rule
  ruleColour: '#000000',
  ruleOpacity: 1,
  ruleThickness: 1,        // px
  ruleDraw: 'on',          // rules draw in from the left with the line reveal
  // Hovered row: fills from its rule up (the trail over it turns `bg`)
  rowHover: 'on',
  rowFill: '#FFFFFF',
  rowWipe: 0.3,            // s, the fill's wipe up (and back down)
  rowArrow: 'on',
  rowArrowSize: 0.8,       // × the names' size
  rowArrowInset: 16,       // px, from the row's right end
  contactGap: 40,          // px, list to the contacts
  contact1Label: 'Investor Relations', contact1Email: 'ir@ridealso.com',
  contact2Label: 'Media Relations', contact2Email: 'media@ridealso.com',
  contactCol: 4,
  contactColGap: 20,       // px, between the two contacts
  contactColour: '#0b0b0b',
  labelSize: 16, labelLeading: 24, labelTracking: -0.25,
  emailSize: 14, emailLeading: 20, emailTracking: 0,

  // The pixel band
  pixCols: 32,             // columns across the screen; a pixel's cell is screen width ÷ this
  pixRows: 10,             // how deep the band is, in cells
  pixSize: 1,              // a pixel's size within its cell (1 = edge to edge)
  pixDensity: 0.5,         // how much of the band is filled to start with
  pixGrow: 0.35,           // how much more fills in as it crosses the screen (0 = a fixed edge)
  pixGrowEnd: 0.25,        // …fully grown when the section's top is this far down the screen (× height)
  pixRandom: 0.6,          // how scattered the pixels are (0 = a clean gradient edge)
  pixOffset: 0.35,         // how ragged the columns are: each column's edge shifts by up to this × the band
  pixSoft: 0,              // pixels grow in rather than pop (0 = pop, like the reference)
  pixSeed: 1,              // a different scatter

  // Cursor trail
  trail: 'on',
  trailMode: 'color',      // 'color' | 'sample' (from the section's images)
  trailColour: '#FCF5ED',  // the trail, or the fallback when sampling misses
  trailLighten: 20,        // sampled colours brightened by this (0–255)
  trailSize: 20,           // px, each square
  trailRadius: 2,          // brush radius in grid cells (0 = one square)
  trailLifetime: 1,        // s, how long a square lives
  trailFade: 0.5,          // s, it fades out over the end of that (0 = no fade)
  trailFadeStyle: 'fade',  // 'fade' (opacity) | 'shrink' (to nothing, like the band's grow-in in reverse)
  // Scatter — the same family as the pixel band, so the two feel of a piece.
  // Density 1 and the rest 0 is Atelier's solid round brush.
  trailDensity: 0.85,      // share of the brush's squares that light (0–1)
  trailRandom: 0.35,       // how ragged the brush's edge is (0 = a clean circle)
  trailSpread: 1,          // cells: how far beyond the brush stray squares may land
  trailLifeRandom: 0.4,    // each square's lifetime varies by up to this share
  trailPixScale: 1,        // a square's size within its cell (1 = edge to edge)
  trailSeed: 1,
  trailGrid: 'off',        // show the grid
  trailGridColour: '#ffffff',
  trailGridOpacity: 0.1,
  trailGridThickness: 1,   // px
};

export const CAREERS_MOBILE = {
  pixCols: 14,
  pixRows: 8,
  titleSize: 44,
  titleCol: 1,
  titleSpan: 4,
  invTop: 80,
  invHeadCol: 1, invHeadSpan: 4,
  invHeadSize: 32, invHeadLeading: 36, invHeadTracking: -1.5,
  invGap: 64,
  listCol: 1, listSpan: 4,
  partnerSize: 24, partnerLeading: 28, partnerTracking: -1,
  partnerGap: 28,
  ruleGap: 16,
  contactCol: 1,
};

// Seeded hash → 0..1.
function rnd(i, k, seed) {
  let h = (i * 374761393 + k * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function createCareers(el, config) {
  let cfg = config;
  let progress = 0;

  el.classList.add('pix');
  const canvas = document.createElement('canvas');
  canvas.className = 'pix__band';
  canvas.setAttribute('aria-hidden', 'true');
  const title = document.createElement('h2');
  title.className = 'pix__title';
  const trailCanvas = document.createElement('canvas');
  trailCanvas.className = 'pix__trail';
  trailCanvas.setAttribute('aria-hidden', 'true');
  // Investors
  const inv = document.createElement('div');
  inv.className = 'pix__inv';
  const invHead = document.createElement('p');
  invHead.className = 'pix__head';
  const list = document.createElement('div');
  list.className = 'pix__list';
  const contacts = document.createElement('div');
  contacts.className = 'pix__contacts';
  const contactEls = [1, 2].map(() => {
    const c = document.createElement('div');
    c.className = 'pix__contact';
    const label = document.createElement('p');
    const link = document.createElement('a');
    c.append(label, link);
    contacts.appendChild(c);
    return { label, link };
  });
  inv.append(invHead, list, contacts);
  // Row fills: under the trail, scrolling with the section.
  const fillLayer = document.createElement('div');
  fillLayer.className = 'pix__fills';
  fillLayer.setAttribute('aria-hidden', 'true');
  el.append(canvas, fillLayer, trailCanvas, title, inv);
  const tctx = trailCanvas.getContext('2d');
  const ctx = canvas.getContext('2d');

  const geo = { W: 0, cell: 0, bandH: 0, dpr: 1 };
  let drawn = '';

  function layout() {
    const W = el.clientWidth || window.innerWidth;
    const H = window.innerHeight;
    const cols = Math.max(2, Math.round(cfg.pixCols));
    const cell = W / cols;
    const bandH = Math.max(1, Math.round(cfg.pixRows)) * cell;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    Object.assign(geo, { W, cell, bandH, dpr, cols, rows: Math.max(1, Math.round(cfg.pixRows)) });
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(bandH * dpr);
    Object.assign(canvas.style, { width: `${W}px`, height: `${bandH}px`, top: `${-bandH + 1}px` });
    el.style.background = cfg.bg;

    reveals.forEach((x) => x.r.unsplit());
    const t = gridSpan(W, cfg.titleCol, cfg.titleSpan);
    title.textContent = cfg.title;
    Object.assign(title.style, {
      left: `${t.x}px`, width: `${t.w}px`, top: `${0.4 * Math.min(H, el.clientHeight || H)}px`,
      fontSize: `${cfg.titleSize}px`, color: cfg.fg, display: cfg.titleShow === 'on' ? '' : 'none',
    });
    layoutInvestors(W);
    drawn = '';
    draw();
    // Measured unsplit, then split again at the current progress.
    const base = el.getBoundingClientRect().top;
    reveals.forEach((x) => { x.off = x.e.getBoundingClientRect().top - base; });
    rules.forEach((x) => { x.off = x.e.getBoundingClientRect().top - base; });
    placeFills();
    reveals.forEach((x) => x.r.split());
    applyReveals();
  }

  /* ---------- investors ---------- */

  let rows = [];             // [{ row, name, rule, arrow, fill, k, box, clip }]
  let rowsKey = '';
  const rules = [];          // [{ e, off, drawn }]
  const reveals = [];        // [{ e, r, off }]
  const fixedReveals = [invHead, ...contactEls.flatMap((c) => [c.label, c.link])]
    .map((e) => ({ e, r: createLineReveal(e), off: 0 }));

  // The partner rows are rebuilt only when the list itself changes, so
  // editing anything else doesn't replay their reveals.
  const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="miter" stroke-linecap="butt"><path d="M2.5 12h18M13 4.5l7.5 7.5-7.5 7.5"/></svg>';
  const itemOf = (x) => (typeof x === 'string' ? { text: x, url: '' } : { text: x?.text ?? '', url: (x?.url ?? '').trim() });
  function buildRows() {
    const items = (Array.isArray(cfg.partners) ? cfg.partners : []).map(itemOf);
    const key = JSON.stringify(items);
    if (key === rowsKey) return;
    rowsKey = key;
    reveals.splice(0).forEach((x) => { if (!fixedReveals.includes(x)) x.r.destroy(); });
    list.replaceChildren();
    fillLayer.replaceChildren();
    rules.length = 0;
    rows = items.map(({ text, url }) => {
      // A row with a link is the link (a new tab); otherwise a plain row.
      const row = document.createElement(url ? 'a' : 'div');
      row.className = 'pix__row';
      if (url) { row.href = url; row.target = '_blank'; row.rel = 'noopener'; }
      const name = document.createElement('p');
      name.className = 'pix__name';
      name.textContent = text;
      const arrow = document.createElement('span');
      arrow.className = 'pix__arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.innerHTML = ARROW;
      const rule = document.createElement('div');
      rule.className = 'pix__rule';
      row.append(name, arrow, rule);
      list.appendChild(row);
      const fill = document.createElement('div');
      fill.className = 'pix__fill';
      fillLayer.appendChild(fill);
      rules.push({ e: rule, off: 0, drawn: false });
      return { row, name, rule, arrow, fill, k: 0, box: null, clip: '' };
    });
    hot = -1;
    reveals.push(...fixedReveals, ...rows.map(({ name }) => ({ e: name, r: createLineReveal(name), off: 0 })));
  }

  function layoutInvestors(W) {
    const at = (col, spanN) => gridSpan(W, col, spanN);
    const h = at(cfg.invHeadCol, cfg.invHeadSpan), l = at(cfg.listCol, cfg.listSpan), c = at(cfg.contactCol, 12);
    Object.assign(inv.style, { top: `${cfg.invTop}px`, color: cfg.fg });
    invHead.textContent = cfg.invHead;
    Object.assign(invHead.style, {
      marginLeft: `${h.x}px`, width: `${h.w}px`, textAlign: cfg.invHeadAlign,
      fontSize: `${cfg.invHeadSize}px`, lineHeight: `${cfg.invHeadLeading}px`, letterSpacing: `${cfg.invHeadTracking}px`,
    });
    buildRows();
    // Each row's box runs from the rule above (or the gap above the first)
    // down to its own rule: that's what fills on hover.
    Object.assign(list.style, { marginLeft: `${l.x}px`, width: `${l.w}px`, marginTop: `${Math.max(0, cfg.invGap - cfg.partnerGap)}px`, gap: '0px' });
    const aSize = cfg.partnerSize * cfg.rowArrowSize;
    rows.forEach(({ row, name, rule, arrow }) => {
      row.style.paddingTop = `${cfg.partnerGap}px`;
      Object.assign(arrow.style, {
        width: `${aSize}px`, height: `${aSize}px`, right: `${cfg.rowArrowInset}px`,
        top: `${cfg.partnerGap + (cfg.partnerLeading - aSize) / 2}px`,
        display: cfg.rowHover === 'on' && cfg.rowArrow === 'on' ? '' : 'none',
      });
      Object.assign(name.style, {
        fontSize: `${cfg.partnerSize}px`, lineHeight: `${cfg.partnerLeading}px`, letterSpacing: `${cfg.partnerTracking}px`,
        marginBottom: `${cfg.ruleGap}px`,
      });
      Object.assign(rule.style, {
        // Takes no space, like the Figma line: it hangs below the gap.
        height: `${cfg.ruleThickness}px`, marginBottom: `${-cfg.ruleThickness}px`,
        background: cfg.ruleColour, opacity: String(cfg.ruleOpacity),
      });
    });
    Object.assign(contacts.style, { marginLeft: `${c.x}px`, marginTop: `${cfg.contactGap}px`, gap: `${cfg.contactColGap}px`, color: cfg.contactColour });
    contactEls.forEach(({ label, link }, i) => {
      const n = i + 1;
      label.textContent = cfg[`contact${n}Label`];
      link.textContent = cfg[`contact${n}Email`];
      link.href = cfg[`contact${n}Email`] ? `mailto:${cfg[`contact${n}Email`]}` : '';
      Object.assign(label.style, { fontSize: `${cfg.labelSize}px`, lineHeight: `${cfg.labelLeading}px`, letterSpacing: `${cfg.labelTracking}px` });
      Object.assign(link.style, { fontSize: `${cfg.emailSize}px`, lineHeight: `${cfg.emailLeading}px`, letterSpacing: `${cfg.emailTracking}px` });
    });
  }

  // Each text's line reveal, scrubbed from where its top is on screen (the
  // section's top is a pure function of progress); the rules draw in from
  // the left as theirs comes up — in Play once mode once, then they stay.
  function applyReveals() {
    const H = window.innerHeight, top = topOnScreen();
    reveals.forEach((x) => x.r.set(revealAtTop(top + x.off, H)));
    const o = revealOptions();
    rules.forEach((x) => {
      const q = revealAtTop(top + x.off, H);
      let k;
      if (cfg.ruleDraw !== 'on' || o.reveal !== 'on') k = 1;
      else if (o.revealMode === 'scrub') k = q;
      else {
        if (!x.drawn && q > 0) {
          x.drawn = true;
          x.e.style.transition = `transform ${o.revealDuration}s cubic-bezier(0.215, 0.61, 0.355, 1)`;
        }
        k = x.drawn ? 1 : 0;
      }
      if (o.revealMode === 'scrub' || cfg.ruleDraw !== 'on') x.e.style.transition = 'none';
      x.e.style.transform = `scaleX(${k})`;
    });
  }

  // How far the band has grown: 0 until the section's top reaches the bottom
  // of the screen, 1 once it's at `pixGrowEnd` of the way down.
  const topOnScreen = () => window.innerHeight * (1 - progress * cfg.height);
  function grown() {
    const H = window.innerHeight;
    const top = topOnScreen();
    return clamp01((H - top) / Math.max(1, H * (1 - cfg.pixGrowEnd)));
  }

  function draw() {
    const g = grown();
    const key = `${g.toFixed(4)}|${geo.W}|${geo.bandH}`;
    if (key === drawn) return;
    drawn = key;
    const { cols, rows, cell, dpr } = geo;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, geo.W, geo.bandH);
    ctx.fillStyle = cfg.bg;
    // A cell fills when its value passes the line set by density + growth.
    // Value: how far down the band it is (with its column's shift), plus
    // scatter. Near the line it grows in over `pixSoft`.
    const cover = clamp01(cfg.pixDensity + cfg.pixGrow * g);
    const line = 1 - cover;
    const soft = Math.max(1e-3, cfg.pixSoft);
    const seed = Math.round(cfg.pixSeed);
    const full = cell * cfg.pixSize;
    for (let c = 0; c < cols; c++) {
      const shift = (rnd(c, 9973, seed) - 0.5) * 2 * cfg.pixOffset;
      const x = c * cell;
      for (let r = 0; r < rows; r++) {
        const depth = (r + 0.5) / rows + shift;
        const v = depth + (rnd(c, r, seed) - 0.5) * cfg.pixRandom;
        const a = clamp01((v - line) / soft);
        if (a <= 0) continue;
        const s = full * a;
        const pad = (cell - s) / 2;
        // Full cells overlap a hair, so no seams between them.
        const e = a >= 1 && cfg.pixSize >= 1 ? 0.5 : 0;
        ctx.fillRect(x + pad, r * cell + pad, s + e, s + e);
      }
    }
  }

  /* ---------- the pixel trail ---------- */

  const canHover = matchMedia('(hover: hover) and (pointer: fine)');
  const cells = new Map();   // "col,row" (section grid) → { t: birth s, c: colour }
  const pointer = { x: 0, y: 0, known: false, over: false };
  let last = null;           // last stamped point, section coords
  let loop = 0;

  const now = () => performance.now() / 1000;
  const trailOn = () => cfg.trail === 'on' && canHover.matches;

  // Size the canvas to the screen (it's fixed; the section's squares are
  // drawn through it, offset by where the section is).
  function sizeTrail() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    trailCanvas.width = Math.round(window.innerWidth * dpr);
    trailCanvas.height = Math.round(window.innerHeight * dpr);
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Images to sample from, each drawn once to a small offscreen canvas.
  const samples = new WeakMap();
  function sampleAt(cx, cy) {
    for (const img of el.querySelectorAll('img')) {
      const r = img.getBoundingClientRect();
      if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom || !img.naturalWidth) continue;
      let s = samples.get(img);
      if (!s) {
        const c = document.createElement('canvas');
        c.width = Math.min(512, img.naturalWidth);
        c.height = Math.round(c.width * img.naturalHeight / img.naturalWidth);
        const x = c.getContext('2d', { willReadFrequently: true });
        try { x.drawImage(img, 0, 0, c.width, c.height); } catch { continue; }
        s = { c, x };
        samples.set(img, s);
      }
      const px = Math.floor(((cx - r.left) / r.width) * s.c.width);
      const py = Math.floor(((cy - r.top) / r.height) * s.c.height);
      try {
        const d = s.x.getImageData(px, py, 1, 1).data;
        const L = cfg.trailLighten;
        return `rgb(${Math.min(255, d[0] + L)},${Math.min(255, d[1] + L)},${Math.min(255, d[2] + L)})`;
      } catch { return null; }
    }
    return null;
  }

  // Stamp the brush at a point (section coords). A cell lights when its
  // distance from the brush's centre (as a share of the radius), pushed
  // about by `trailRandom`, is inside the brush — and then only `trailDensity`
  // of the time. `trailSpread` lets the scatter reach that many cells past
  // the radius. The dice are rolled per cell from the seed (the seeded hash,
  // as in the band), not per stamp: a passing brush stamps each cell many
  // times, and re-rolling would fill every hole.
  function stamp(x, y, cx, cy, t) {
    const S = Math.max(2, cfg.trailSize), R = Math.max(0, Math.round(cfg.trailRadius));
    const spread = Math.max(0, Math.round(cfg.trailSpread));
    const reach = R + spread;
    const c0 = Math.floor(x / S), r0 = Math.floor(y / S);
    const colour = (cfg.trailMode === 'sample' && sampleAt(cx, cy)) || cfg.trailColour;
    const seed = Math.round(cfg.trailSeed) * 7919;
    const edge = R + 0.5;
    // How far (as a share of the radius) randomness can push a cell, in or out.
    const push = cfg.trailRandom * (1 + spread / edge);
    const life = Math.max(0.01, cfg.trailLifetime);
    for (let dc = -reach; dc <= reach; dc++) {
      for (let dr = -reach; dr <= reach; dr++) {
        const c = c0 + dc, r = r0 + dr;
        const d = Math.hypot(dc, dr) / edge;
        const v = d + (rnd(c, r, seed) - 0.5) * 2 * push;
        if (v >= 1) continue;
        if (cfg.trailDensity < 1 && rnd(c, r, seed + 17) > cfg.trailDensity) continue;
        // Refreshed while the brush is on it; its lifetime varies by cell.
        cells.set(`${c},${r}`, { t, c: colour, life: life * (1 - cfg.trailLifeRandom * rnd(c, r, seed + 31)) });
      }
    }
  }

  function onTrailMove(e) {
    if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.known = true;
    rehit();
    if (!trailOn()) return;
    const r = el.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
      && !e.target?.closest?.('.insp, .insp__show, .phone-preview');
    if (!inside) { last = null; return; }
    const x = e.clientX - r.left, y = e.clientY - r.top, t = now();
    // Along the path, a stamp every half square, so fast moves leave no gaps.
    if (last) {
      const d = Math.hypot(x - last.x, y - last.y), step = Math.max(1, cfg.trailSize / 2);
      for (let k = step; k < d; k += step) {
        const u = k / d;
        stamp(last.x + (x - last.x) * u, last.y + (y - last.y) * u, e.clientX, e.clientY, t);
      }
    }
    stamp(x, y, e.clientX, e.clientY, t);
    last = { x, y };
    run();
  }
  function onTrailOut(e) { if (!e.relatedTarget) { last = null; pointer.known = false; rehit(); } }

  /* ---------- the hovered row ---------- */

  let hot = -1;              // the row under the cursor (or focused), -1 for none
  let focused = -1;
  let lastT = 0;
  const hoverOn = () => cfg.rowHover === 'on';
  const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

  // Rows' boxes in section coords (measured with the layout; they scroll
  // with the section, so on screen they're the section's top plus these).
  function placeFills() {
    const base = el.getBoundingClientRect();
    rows.forEach((x) => {
      const r = x.row.getBoundingClientRect();
      x.box = { l: r.left - base.left, t: r.top - base.top, w: r.width, h: r.height };
      Object.assign(x.fill.style, { left: `${x.box.l}px`, top: `${x.box.t}px`, width: `${x.box.w}px`, height: `${x.box.h}px`, background: cfg.rowFill });
      x.arrowTop = x.arrow.offsetTop;
    });
    rows.forEach(applyRow);
  }

  // Which row the cursor is over, from the boxes (so it holds while the
  // page scrolls under a still cursor, too).
  function rehit() {
    let i = -1;
    if (hoverOn() && canHover.matches && pointer.known && !document.documentElement.classList.contains('xm-open')) {
      const { top, left } = el.getBoundingClientRect();
      i = rows.findIndex(({ box }) => box && pointer.x >= left + box.l && pointer.x <= left + box.l + box.w
        && pointer.y >= top + box.t && pointer.y < top + box.t + box.h);
    }
    if (i < 0 && hoverOn()) i = focused;
    if (i !== hot) { hot = i; lastT = 0; run(); }
  }

  // A row's fill and arrow at its k: the fill scaled up from its bottom,
  // the arrow clipped to the part the fill has passed.
  function applyRow(x) {
    const e = ease(x.k);
    x.fill.style.transform = `scaleY(${e})`;
    x.fill.style.visibility = e > 0 ? 'visible' : 'hidden';
    const edge = x.box ? x.box.h * (1 - e) : 0;   // the fill's top, from the row's
    const cut = Math.min(100, Math.max(0, ((edge - x.arrowTop) / Math.max(1, x.arrow.offsetHeight || 1)) * 100));
    const clip = e <= 0 ? 'inset(100% 0 0 0)' : `inset(${cut.toFixed(2)}% 0 0 0)`;
    if (clip !== x.clip) { x.clip = clip; x.arrow.style.clipPath = clip; }
  }

  // Steps every row's k toward its target; true while any is moving.
  function stepRows(t) {
    const dt = lastT ? Math.min(0.1, t - lastT) : 1 / 60;
    lastT = t;
    const v = dt / Math.max(0.01, cfg.rowWipe);
    let moving = false;
    rows.forEach((x, i) => {
      const goal = i === hot ? 1 : 0;
      if (x.k === goal) return;
      x.k = goal > x.k ? Math.min(goal, x.k + v) : Math.max(goal, x.k - v);
      applyRow(x);
      if (x.k !== goal) moving = true;
    });
    if (!moving) lastT = 0;
    return moving;
  }

  // Keyboard: a focused row link counts as hovered.
  function onFocusIn(e) { focused = rows.findIndex(({ row }) => row.contains(e.target)); rehit(); }
  function onFocusOut() { focused = -1; rehit(); }
  list.addEventListener('focusin', onFocusIn);
  list.addEventListener('focusout', onFocusOut);

  function run() { if (!loop) loop = requestAnimationFrame(paint); }

  function paint() {
    loop = 0;
    const W = window.innerWidth, H = window.innerHeight;
    tctx.clearRect(0, 0, W, H);
    const r = el.getBoundingClientRect();
    const S = Math.max(2, cfg.trailSize);
    tctx.save();
    // Only over the section (its top edge is the pixel band's foot).
    tctx.beginPath();
    tctx.rect(r.left, Math.max(0, r.top), r.width, Math.min(H, r.bottom) - Math.max(0, r.top));
    tctx.clip();
    if (cfg.trailGrid === 'on' && trailOn()) {
      tctx.globalAlpha = cfg.trailGridOpacity;
      tctx.strokeStyle = cfg.trailGridColour;
      tctx.lineWidth = cfg.trailGridThickness;
      tctx.beginPath();
      for (let x = r.left % S; x < W; x += S) { tctx.moveTo(x, 0); tctx.lineTo(x, H); }
      for (let y = ((r.top % S) + S) % S; y < H; y += S) { tctx.moveTo(0, y); tctx.lineTo(W, y); }
      tctx.stroke();
      tctx.globalAlpha = 1;
    }
    const t = now(), life = Math.max(0.01, cfg.trailLifetime), fade = Math.max(0, cfg.trailFade);
    const shrink = cfg.trailFadeStyle === 'shrink', k0 = Math.min(1, Math.max(0.05, cfg.trailPixScale));
    const moving = stepRows(t);
    // Where the fills are on screen now: squares over them take the
    // section's colour (drawn again, clipped to them, below).
    const over = [];
    rows.forEach((x) => {
      if (!x.box || x.k <= 0) return;
      const e = ease(x.k), h = x.box.h * e;
      over.push([r.left + x.box.l, r.top + x.box.t + x.box.h - h, x.box.w, h]);
    });
    const drawn = over.length ? [] : null;
    for (const [k, v] of cells) {
      const L = v.life ?? life;
      const age = t - v.t;
      if (age >= L) { cells.delete(k); continue; }
      const a = fade > 0 ? Math.min(1, (L - age) / fade) : 1;
      const [c, rr] = k.split(',').map(Number);
      // Whole pixels, so neighbouring squares leave no seams; a smaller
      // square (pixel scale, or shrinking away) stays centred in its cell.
      const x0 = Math.round(r.left + c * S), y0 = Math.round(r.top + rr * S);
      const cw = Math.round(r.left + (c + 1) * S) - x0, ch = Math.round(r.top + (rr + 1) * S) - y0;
      if (y0 + ch < 0 || y0 > H) continue;
      const f = k0 * (shrink ? a : 1);
      const w = f >= 1 ? cw : Math.round(cw * f), h = f >= 1 ? ch : Math.round(ch * f);
      if (w < 1 || h < 1) continue;
      tctx.globalAlpha = shrink ? 1 : a;
      tctx.fillStyle = v.c;
      const sx = x0 + Math.round((cw - w) / 2), sy = y0 + Math.round((ch - h) / 2);
      tctx.fillRect(sx, sy, w, h);
      drawn?.push(sx, sy, w, h, tctx.globalAlpha);
    }
    if (drawn?.length) {
      tctx.beginPath();
      over.forEach(([x, y, w, h]) => tctx.rect(x, y, w, h));
      tctx.clip();
      tctx.fillStyle = cfg.bg;
      for (let i = 0; i < drawn.length; i += 5) {
        tctx.globalAlpha = drawn[i + 4];
        tctx.fillRect(drawn[i], drawn[i + 1], drawn[i + 2], drawn[i + 3]);
      }
    }
    tctx.restore();
    if (cells.size || moving) run();
  }

  addEventListener('pointermove', onTrailMove, { passive: true });
  document.addEventListener('pointerout', onTrailOut);
  addEventListener('resize', sizeTrail);
  sizeTrail();

  layout();

  return {
    // Scrolling moves the squares with the section (and the grid with it).
    seek(p) { progress = p; draw(); applyReveals(); rehit(); if (cells.size || cfg.trailGrid === 'on') run(); },
    setConfig(next) { cfg = next; layout(); rehit(); run(); },
    relayout() { layout(); },
    // Its section is exactly `height` screens tall.
    naturalLength() { return Math.max(1, cfg.height); },
    // Where the band's middle is on screen: the beat before uses it to hand
    // the cursor back (the dot cursor is that section's).
    floor() { const r = canvas.getBoundingClientRect(); return r.top + r.height / 2; },
    destroy() {
      removeEventListener('pointermove', onTrailMove);
      document.removeEventListener('pointerout', onTrailOut);
      removeEventListener('resize', sizeTrail);
      list.removeEventListener('focusin', onFocusIn);
      list.removeEventListener('focusout', onFocusOut);
      fillLayer.remove();
      if (loop) cancelAnimationFrame(loop);
      trailCanvas.remove();
      reveals.forEach((x) => x.r.destroy());
      inv.remove();
      el.classList.remove('pix');
      canvas.remove(); title.remove();
    },
    get config() { return cfg; },
  };
}

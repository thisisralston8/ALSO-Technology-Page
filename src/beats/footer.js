/* Beat 6 — Footer.

   The last reveal: Investors and careers scrolls away like a sheet and the
   footer is already underneath it. The footer's section scrolls normally
   (director `flow`); its content is held back by `parallax` — 0 scrolls
   with the page, 1 sits perfectly still under the lifting sheet — so it
   slides into place more slowly than the page, arriving exactly as the
   footer fills the screen. The footer's own box clips it, which is what
   puts it "underneath": only the part the sheet has uncovered shows.

   A shade over it fades away as it's uncovered, for depth.

   Content after the Figma frame "Desktop - 123" (13365:703): top left, a
   large headline and the Careers button; the ALSO. wordmark bottom left on
   the row of small links, and a back-to-top button bottom right. (Two link
   columns from an earlier frame are still there, off by default.) Text gets
   the page's line reveal; the wordmark rises from behind its own edge the
   same way.

   The back-to-top button doesn't scroll anything itself (beats never touch
   scroll): it dispatches `page:top` and main.js makes the quick cut — fade
   out, jump to the top, fade in — like the modal's layer switcher.

   The wordmark's full stop is a force field (`field*`): it's drawn as a grid
   of small squares that, at rest, make the solid dot. Hover near it and the
   cursor pushes the squares apart — gaps open between them, showing what
   it's made of, and they shift colour as they move — and when the cursor
   leaves, springs pull them home into the dot again. Time-based, like the
   cursor lens and the trails; its loop only runs while something moves.

   Pure function of progress, no smoothing of its own: the page's one
   smoothing (Lenis) is what makes it feel soft. */

import { span as gridSpan, gridOptions } from '../grid.js';
import { createLineReveal, revealAtTop, revealOptions } from '../lineReveal.js';
import { createColorWave, letters, WAVE_DEFAULTS } from '../colorWave.js';
import logoSvg from '../assets/footer/also-logo.svg?raw';
import arrowUpUrl from '../assets/footer/arrow-up.svg?url';

// The wordmark's own proportions (Figma: 1363.719 × 324.404 in a 1360 box).
const LOGO_W = 1363.719, LOGO_H = 324.404, LOGO_BOX = 1360;
// Its full stop, in the drawing's own units.
const DOT = { x: 1278.87, y: 230.842, w: 84.85, h: 87.255 };

export const FOOTER_DEFAULTS = {
  height: 1,               // screens
  bg: '#0b0b0b',
  fg: '#ffffff',

  // The reveal
  parallax: 0.7,           // 0 = the content scrolls with the page, 1 = it stays still underneath
  parallaxCurve: 'linear', // 'linear' | 'out' (settles gently) | 'in' (starts slow)
  shade: 0.6,              // how dark it starts (0 = no shade)
  shadeColour: '#000000',
  shadeClear: 0.8,         // …and the shade has cleared by this share of the reveal

  // Top left: headline and button
  padTop: 80,              // px, from the footer's top
  headline: 'Join us in building the future of transportation.',
  headCol: 1, headSpan: 7,
  headSize: 120, headLeading: 112, headTracking: -6,
  // The headline's colour wave (colorWave.js)
  ...WAVE_DEFAULTS,
  waveFrom: '#3a3a3a',
  waveTo: '#ffffff',
  waveTrigger: 0.9,
  buttonGap: 24,           // px, headline to the button
  button: 'Careers',
  buttonHref: '#',
  buttonBg: '#AC74FC',
  buttonInk: '#0b0b0b',
  buttonShadow: '#48316a',
  buttonHeight: 72,        // px (Figma: 72 tall, at least 160 wide, 32 px either side, 24/28 type)
  buttonMinWidth: 160,
  buttonPadX: 32,
  buttonSize: 24, buttonLeading: 28,

  // Link columns (not in the current Figma frame)
  columns: 'off',
  colTop: 86,              // px, from the footer's top
  col1Col: 7, col2Col: 10, colSpan: 3,
  col1Nudge: -12,          // px: Figma sets column 1 at the screen's middle, 12 px left of column 7
  col2Nudge: 0,
  col1Title: 'Section title 1',
  col1Items: ['List item', 'List item', 'List item', 'List item'],
  col2Title: 'Section title 2',
  col2Items: ['List item', 'List item', 'List item', 'List item'],
  colTitleGap: 40,         // px, title to its list
  itemGap: 8,              // px, between items
  colTitleSize: 16, colTitleLeading: 24, colTitleTracking: 0,
  itemSize: 20, itemLeading: 28, itemTracking: -0.25,

  // Bottom: the wordmark and the small links
  logo: 'on',
  logoReveal: 'on',        // rises from behind its edge, like the line reveal
  logoWidth: 322,          // px (capped at the grid's width)
  logoGap: 44,             // px, wordmark to the links below
  legal: ['Investor inquiries', 'Media inquiries', 'Terms', 'Privacy'],
  legalBottom: 24,         // px, from the footer's bottom
  legalSize: 12, legalLeading: 16, legalTracking: 0,

  // Back to top: a round button bottom right, level with the wordmark
  top: 'on',
  topSize: 72,             // px, the circle
  topIconSize: 24,         // px
  topGap: 41,              // px, the button to the links below
  topBg: '#ffffff',
  topInk: '#0b0b0b',       // the outline (the arrow is the Figma icon)
  topShadow: '#48316a',
  topCutOut: 0.3,          // s, the page fading out
  topCutIn: 0.5,           // s, the top fading in
  topCutColour: '#0b0b0b', // what it fades through

  // The full stop's force field
  field: 'on',             // per breakpoint, like every setting (Desktop / Mobile)
  fieldGrid: 10,           // squares across the dot
  fieldRadius: 140,        // px, how far the cursor's push reaches
  fieldForce: 0.4,         // how hard it pushes
  fieldDisperse: 1,        // how quickly the squares fly apart (× their response)
  fieldReturn: 1.6,        // how quickly they spring home (≈ times a second)
  fieldDamping: 0.55,      // 0 = bouncy, 1 = settles without overshoot
  fieldJitter: 0.4,        // each square pushed a little differently (0 = all alike)
  fieldGap: 0.3,           // how far squares shrink on hover, opening the grid (× their size)
  fieldHoverPad: 40,       // px around the dot that count as hovering it
  fieldEase: 0.12,         // s, the hover coming on and off
  fieldRestColour: '#ffffff',
  fieldActiveColour: '#AC74FC',
  fieldColourDist: 40,     // px a square moves to take on the active colour fully
  fieldHoverTint: 0.25,    // how much of the active colour every square takes while hovered
};

export const FOOTER_MOBILE = {
  padTop: 64,
  headCol: 1, headSpan: 4,
  headSize: 56, headLeading: 56, headTracking: -2.8,
  buttonHeight: 56, buttonMinWidth: 120, buttonPadX: 24, buttonSize: 18, buttonLeading: 24,
  logoWidth: 200,
  logoGap: 32,
  topSize: 56,
  topGap: 28,
  colTop: 260,
  col1Col: 1, col2Col: 3, colSpan: 2,
  col1Nudge: 0,
  colTitleGap: 20,
  itemSize: 16, itemLeading: 24,
  legalSize: 11,
  logoGap: 24,
  legalBottom: 20,
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const CURVES = {
  linear: (t) => t,
  out: (t) => 1 - (1 - t) * (1 - t),
  in: (t) => t * t,
};

export function createFooter(el, config) {
  let cfg = config;
  let progress = 0;

  el.classList.add('foot');
  const content = document.createElement('div');
  content.className = 'foot__content';
  const shade = document.createElement('div');
  shade.className = 'foot__shade';

  // Top left
  const intro = document.createElement('div');
  intro.className = 'foot__intro';
  const head = document.createElement('p');
  head.className = 'foot__head';
  const wave = createColorWave(head);
  const button = document.createElement('a');
  button.className = 'foot__btn';
  const buttonLabel = document.createElement('span');
  button.append(buttonLabel);
  intro.append(head, button);

  // Back to top
  const topBtn = document.createElement('button');
  topBtn.type = 'button';
  topBtn.className = 'foot__top';
  topBtn.setAttribute('aria-label', 'Back to top');
  const topIcon = Object.assign(document.createElement('img'), { src: arrowUpUrl, alt: '', width: 24, height: 24 });
  topBtn.append(topIcon);
  topBtn.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('page:top', {
      detail: { out: cfg.topCutOut, in: cfg.topCutIn, colour: cfg.topCutColour },
    }));
  });

  // Columns
  const cols = [1, 2].map(() => {
    const col = document.createElement('div');
    col.className = 'foot__col';
    const title = document.createElement('p');
    title.className = 'foot__coltitle';
    const list = document.createElement('div');
    list.className = 'foot__items';
    col.append(title, list);
    return { col, title, list, items: [], key: '' };
  });

  // Bottom
  const logoMask = document.createElement('div');
  logoMask.className = 'foot__logomask';
  // The wordmark, inline so its full stop can be swapped for the field. The
  // reveal moves `logo`; the field canvas rides inside it.
  const logo = document.createElement('div');
  logo.className = 'foot__logo';
  logo.setAttribute('role', 'img');
  logo.setAttribute('aria-label', 'ALSO.');
  logo.innerHTML = logoSvg;
  const svg = logo.querySelector('svg');
  svg.removeAttribute('width'); svg.removeAttribute('height');
  svg.setAttribute('aria-hidden', 'true');
  const dotPath = [...svg.querySelectorAll('path')].find((p) => (p.getAttribute('d') || '').startsWith('M1278.87'));
  const fieldCanvas = document.createElement('canvas');
  fieldCanvas.className = 'foot__field';
  logo.appendChild(fieldCanvas);
  logoMask.appendChild(logo);
  const legal = document.createElement('div');
  legal.className = 'foot__legal';
  let legalKey = '';
  let legalEls = [];

  content.append(intro, ...cols.map((c) => c.col), logoMask, legal, topBtn);
  el.append(content, shade);

  // Line reveals: fixed texts, plus the list items (rebuilt only when a list
  // changes, so other edits don't replay them).
  const fixed = [head, buttonLabel, ...cols.map((c) => c.title)].map((e) => ({ e, r: createLineReveal(e), off: 0 }));
  let reveals = [...fixed];
  const logoState = { off: 0, drawn: false };

  function rebuildLists() {
    let changed = false;
    cols.forEach((c, i) => {
      const items = cfg[`col${i + 1}Items`] || [];
      const key = JSON.stringify(items);
      if (key === c.key) return;
      c.key = key; changed = true;
      c.items.forEach((x) => x.r.destroy());
      c.list.replaceChildren();
      c.items = items.map((t) => {
        const a = document.createElement('a');
        a.href = '#';
        a.textContent = t;
        c.list.appendChild(a);
        return { e: a, r: createLineReveal(a), off: 0 };
      });
    });
    const lk = JSON.stringify(cfg.legal || []);
    if (lk !== legalKey) {
      legalKey = lk; changed = true;
      legalEls.forEach((x) => x.r.destroy());
      legal.replaceChildren();
      legalEls = (cfg.legal || []).map((t) => {
        const a = document.createElement('a');
        a.href = '#';
        a.textContent = t;
        legal.appendChild(a);
        return { e: a, r: createLineReveal(a), off: 0 };
      });
    }
    if (changed) reveals = [...fixed, ...cols.flatMap((c) => c.items), ...legalEls];
  }

  function layout() {
    reveals.forEach((x) => x.r.unsplit());
    rebuildLists();
    reveals.forEach((x) => x.r.unsplit());
    const W = el.clientWidth || window.innerWidth;
    const H = el.clientHeight || window.innerHeight;
    el.style.background = cfg.bg;
    content.style.color = cfg.fg;

    const h = gridSpan(W, cfg.headCol, cfg.headSpan);
    Object.assign(intro.style, { left: `${h.x}px`, width: `${h.w}px`, top: `${cfg.padTop}px`, gap: `${cfg.buttonGap}px` });
    head.textContent = '';
    letters(head, cfg.headline);
    Object.assign(head.style, { fontSize: `${cfg.headSize}px`, lineHeight: `${cfg.headLeading}px`, letterSpacing: `${cfg.headTracking}px` });
    buttonLabel.textContent = cfg.button;
    button.href = cfg.buttonHref || '#';
    Object.assign(button.style, {
      background: cfg.buttonBg, color: cfg.buttonInk, borderColor: cfg.buttonInk,
      filter: `drop-shadow(0 2px 0 ${cfg.buttonShadow})`,
      height: `${cfg.buttonHeight}px`, minWidth: `${cfg.buttonMinWidth}px`,
      padding: `0 ${cfg.buttonPadX}px`,
      fontSize: `${cfg.buttonSize}px`, lineHeight: `${cfg.buttonLeading}px`,
    });

    cols.forEach((c, i) => {
      const s = gridSpan(W, cfg[`col${i + 1}Col`], cfg.colSpan);
      Object.assign(c.col.style, { display: cfg.columns === 'on' ? '' : 'none', left: `${s.x + (cfg[`col${i + 1}Nudge`] || 0)}px`, width: `${s.w}px`, top: `${cfg.colTop}px`, gap: `${cfg.colTitleGap}px` });
      c.title.textContent = cfg[`col${i + 1}Title`];
      Object.assign(c.title.style, { fontSize: `${cfg.colTitleSize}px`, lineHeight: `${cfg.colTitleLeading}px`, letterSpacing: `${cfg.colTitleTracking}px` });
      c.list.style.gap = `${cfg.itemGap}px`;
      c.items.forEach(({ e }) => Object.assign(e.style, { fontSize: `${cfg.itemSize}px`, lineHeight: `${cfg.itemLeading}px`, letterSpacing: `${cfg.itemTracking}px` }));
    });

    // Bottom row: the small links spread across the grid, `legalBottom` up;
    // the wordmark across the grid (its drawing runs a hair past its box, as
    // in Figma), `logoGap` above them.
    const { gridMargin: m } = gridOptions();
    const gw = W - 2 * m;
    Object.assign(legal.style, { left: `${m}px`, width: `${gw}px`, bottom: `${cfg.legalBottom}px` });
    legalEls.forEach(({ e }) => Object.assign(e.style, { fontSize: `${cfg.legalSize}px`, lineHeight: `${cfg.legalLeading}px`, letterSpacing: `${cfg.legalTracking}px` }));
    const lw = Math.min(gw, cfg.logoWidth) * (LOGO_W / LOGO_BOX), lh = lw * (LOGO_H / LOGO_W);
    Object.assign(logoMask.style, {
      display: cfg.logo === 'on' ? '' : 'none',
      left: `${m}px`, width: `${lw}px`, height: `${lh}px`,
      bottom: `${cfg.legalBottom + cfg.legalLeading + cfg.logoGap}px`,
    });
    layoutField(lw / LOGO_W);
    Object.assign(topBtn.style, {
      display: cfg.top === 'on' ? '' : 'none',
      right: `${m}px`, bottom: `${cfg.legalBottom + cfg.legalLeading + cfg.topGap}px`,
      width: `${cfg.topSize}px`, height: `${cfg.topSize}px`,
      background: cfg.topBg, borderColor: cfg.topInk,
      filter: `drop-shadow(0 2px 0 ${cfg.topShadow})`,
    });
    Object.assign(topIcon.style, { width: `${cfg.topIconSize}px`, height: `${cfg.topIconSize}px` });

    shade.style.background = cfg.shadeColour;

    // Offsets for the reveals, measured unsplit and without the parallax.
    content.style.transform = 'none';
    const base = el.getBoundingClientRect().top;
    reveals.forEach((x) => { x.off = x.e.getBoundingClientRect().top - base; });
    logoState.off = logoMask.getBoundingClientRect().top - base;
    reveals.forEach((x) => x.r.split());
    wave.remeasure();
    render();
  }

  // p: 0 as the footer's top enters at the bottom of the screen, 1 when it
  // fills it (director `lead` + `flow`). The content is held back by the
  // part of the footer still covered, × parallax.
  const lagAt = () => {
    const H = el.clientHeight || window.innerHeight;
    const e = (CURVES[cfg.parallaxCurve] || CURVES.linear)(clamp01(progress));
    return -(1 - e) * cfg.parallax * H;
  };
  function render() {
    const lag = lagAt();
    content.style.transform = `translate3d(0, ${lag.toFixed(2)}px, 0)`;
    const s = cfg.shade * (1 - clamp01(progress / Math.max(0.05, cfg.shadeClear)));
    shade.style.opacity = s.toFixed(3);
    shade.style.visibility = s > 0.001 ? '' : 'hidden';
    applyReveals(lag);
  }

  // Each text's reveal from where it really is on screen: the footer's top
  // (a pure function of progress), plus its place, plus the parallax.
  // A text held up behind the section above (by the parallax) is hidden
  // until the footer's edge passes it, so it waits for that: nothing
  // reveals before it's actually uncovered.
  function applyReveals(lag) {
    const Hs = window.innerHeight;
    const edge = Hs * (1 - progress * cfg.height);
    const top = edge + lag;
    const at = (off) => (top + off >= edge ? revealAtTop(top + off, Hs) : 0);
    reveals.forEach((x) => x.r.set(at(x.off)));
    // The headline's colour wave: starts once it's uncovered and up the screen.
    const hOff = fixed[0].off;
    wave.update(top + hOff >= edge ? top + hOff : Infinity, Hs, cfg);
    // The wordmark: rises from behind its own bottom edge.
    const o = revealOptions();
    const q = at(logoState.off);
    let k;
    if (cfg.logoReveal !== 'on' || o.reveal !== 'on') { k = 1; logo.style.transition = 'none'; }
    else if (o.revealMode === 'scrub') { k = q; logo.style.transition = 'none'; }
    else {
      if (!logoState.drawn && q > 0) {
        logoState.drawn = true;
        logo.style.transition = `transform ${o.revealDuration * 1.2}s cubic-bezier(0.215, 0.61, 0.355, 1)`;
      }
      k = logoState.drawn ? 1 : 0;
    }
    logo.style.transform = `translateY(${((1 - k) * o.revealDistance).toFixed(2)}%)`;
    // Once it's fully up, the mask stops clipping, so the field's squares
    // can be pushed out past the wordmark's edge.
    if (k < 1) logoMask.classList.remove('is-open');
    else if (logo.style.transition === 'none' || o.revealMode === 'scrub' || cfg.logoReveal !== 'on') logoMask.classList.add('is-open');
  }
  logo.addEventListener('transitionend', () => { if (logoState.drawn) logoMask.classList.add('is-open'); });

  /* ---------- the full stop's force field ----------
     Squares on a grid over the dot, each with a home, a position and a
     velocity. While hovered, every square within `fieldRadius` of the
     cursor is pushed straight away from it, harder the closer it is; a
     damped spring always pulls it home. At rest, and with the hover off, it
     draws one solid square instead — no seams, and the loop stops. */

  const fctx = fieldCanvas.getContext('2d');
  const fld = { s: 1, pad: 0, dot: null, parts: [], hover: 0, raf: 0, last: 0, w: 0, h: 0 };
  const fpointer = { x: 0, y: 0, in: false };
  const fieldOn = () => cfg.field === 'on' && cfg.logo === 'on';

  function hashRnd(i) {
    let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  // The dot's rect in the wordmark's CSS px, and the canvas around it —
  // padded by the push's reach so squares have somewhere to go.
  function layoutField(scale) {
    dotPath && (dotPath.style.visibility = fieldOn() ? 'hidden' : '');
    fieldCanvas.style.display = fieldOn() ? '' : 'none';
    if (!fieldOn()) { stopField(); return; }
    fld.s = scale;
    const dot = { x: DOT.x * scale, y: DOT.y * scale, w: DOT.w * scale, h: DOT.h * scale };
    const pad = Math.ceil(cfg.fieldRadius + 20);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    fld.pad = pad; fld.dot = dot;
    fld.w = dot.w + 2 * pad; fld.h = dot.h + 2 * pad;
    fieldCanvas.width = Math.round(fld.w * dpr);
    fieldCanvas.height = Math.round(fld.h * dpr);
    Object.assign(fieldCanvas.style, { left: `${dot.x - pad}px`, top: `${dot.y - pad}px`, width: `${fld.w}px`, height: `${fld.h}px` });
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // The squares (rebuilt; they start at home).
    const n = Math.max(2, Math.round(cfg.fieldGrid));
    const rows = Math.max(2, Math.round(n * dot.h / dot.w));
    const tw = dot.w / n, th = dot.h / rows;
    fld.tile = { w: tw, h: th, n, rows };
    fld.parts = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < n; c++) {
        const hx = pad + c * tw, hy = pad + r * th;
        fld.parts.push({ hx, hy, x: hx, y: hy, vx: 0, vy: 0, j: 1 + (hashRnd(r * 997 + c) - 0.5) * 2 * cfg.fieldJitter });
      }
    }
    drawField();
  }

  // Pointer: mouse and pen hover; a touch counts while the finger is down.
  function onFieldPointer(e) {
    // Nothing to measure until the footer is on screen (and nothing to settle).
    if (!fieldOn() || (progress <= 0 && !fld.raf)) return;
    if (e.pointerType === 'touch' && e.type === 'pointermove' && !e.buttons && e.pressure === 0) return;
    fpointer.x = e.clientX; fpointer.y = e.clientY;
    fpointer.in = !(e.type === 'pointerup' || e.type === 'pointercancel') || e.pointerType !== 'touch';
    // Wake up when the cursor is anywhere near.
    const r = fieldCanvas.getBoundingClientRect();
    if (e.clientX > r.left - 40 && e.clientX < r.right + 40 && e.clientY > r.top - 40 && e.clientY < r.bottom + 40) runField();
    else if (fld.hover > 0) runField();
  }
  function onFieldOut(e) { if (!e.relatedTarget) { fpointer.in = false; runField(); } }

  function runField() {
    if (fld.raf || !fieldOn()) return;
    fld.last = performance.now();
    fld.raf = requestAnimationFrame(stepField);
  }
  function stopField() { if (fld.raf) cancelAnimationFrame(fld.raf); fld.raf = 0; }

  function stepField(now) {
    fld.raf = 0;
    const dt = Math.min(0.05, Math.max(0.001, (now - fld.last) / 1000));
    fld.last = now;
    const r = fieldCanvas.getBoundingClientRect();
    const k = r.width / fld.w || 1;              // canvas px per CSS px (1 unless scaled)
    const px = (fpointer.x - r.left) / k, py = (fpointer.y - r.top) / k;
    const d = fld.dot, hp = cfg.fieldHoverPad;
    const over = fpointer.in
      && px >= fld.pad - hp && px <= fld.pad + d.w + hp && py >= fld.pad - hp && py <= fld.pad + d.h + hp;
    // The hover itself comes and goes smoothly.
    const a = 1 - Math.exp(-dt / Math.max(0.01, cfg.fieldEase));
    fld.hover += ((over ? 1 : 0) - fld.hover) * a;
    if (Math.abs(fld.hover - (over ? 1 : 0)) < 0.001) fld.hover = over ? 1 : 0;

    const R = Math.max(1, cfg.fieldRadius);
    const w0 = 2 * Math.PI * Math.max(0.05, cfg.fieldReturn);
    const z = Math.max(0.05, cfg.fieldDamping);
    const push = 9000 * cfg.fieldForce * cfg.fieldDisperse;
    const { w: tw, h: th } = fld.tile;
    let moving = false;
    const steps = Math.ceil(dt / (1 / 240)), h = dt / steps;
    for (const p of fld.parts) {
      for (let i = 0; i < steps; i++) {
        let ax = -w0 * w0 * (p.x - p.hx) - 2 * z * w0 * p.vx;
        let ay = -w0 * w0 * (p.y - p.hy) - 2 * z * w0 * p.vy;
        if (fld.hover > 0) {
          const cx = p.x + tw / 2 - px, cy = p.y + th / 2 - py;
          const dist = Math.hypot(cx, cy) || 0.001;
          if (dist < R) {
            const f = push * p.j * fld.hover * (1 - dist / R) * (1 - dist / R);
            ax += (cx / dist) * f; ay += (cy / dist) * f;
          }
        }
        p.vx += ax * h; p.vy += ay * h;
        p.x += p.vx * h; p.y += p.vy * h;
      }
      // Keep them on the canvas.
      p.x = Math.min(fld.w - tw, Math.max(0, p.x));
      p.y = Math.min(fld.h - th, Math.max(0, p.y));
      if (Math.abs(p.x - p.hx) > 0.2 || Math.abs(p.y - p.hy) > 0.2 || Math.abs(p.vx) + Math.abs(p.vy) > 2) moving = true;
    }
    if (!moving && fld.hover === 0) {
      fld.parts.forEach((p) => { p.x = p.hx; p.y = p.hy; p.vx = p.vy = 0; });
      drawField();
      return;
    }
    drawField();
    fld.raf = requestAnimationFrame(stepField);
  }

  const hex = (c) => [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0);
  function drawField() {
    if (!fld.dot) return;
    fctx.clearRect(0, 0, fld.w, fld.h);
    const d = fld.dot, rest = cfg.fieldRestColour;
    const settled = fld.hover === 0 && fld.parts.every((p) => p.x === p.hx && p.y === p.hy);
    if (settled) {
      fctx.fillStyle = rest;
      fctx.fillRect(fld.pad, fld.pad, d.w, d.h);
      return;
    }
    const A = hex(rest), B = hex(cfg.fieldActiveColour);
    const { w: tw, h: th } = fld.tile;
    const g = 1 - cfg.fieldGap * fld.hover;
    const sw = tw * g, sh = th * g;
    for (const p of fld.parts) {
      const moved = Math.hypot(p.x - p.hx, p.y - p.hy);
      const t = Math.min(1, Math.max(cfg.fieldHoverTint * fld.hover, moved / Math.max(1, cfg.fieldColourDist)));
      fctx.fillStyle = `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
      // Full-size squares overlap a hair so the dot shows no seams.
      const e = g >= 0.999 ? 0.5 : 0;
      fctx.fillRect(p.x + (tw - sw) / 2, p.y + (th - sh) / 2, sw + e, sh + e);
    }
  }

  ['pointermove', 'pointerdown', 'pointerup', 'pointercancel'].forEach((t) => addEventListener(t, onFieldPointer, { passive: true }));
  document.addEventListener('pointerout', onFieldOut);

  layout();

  return {
    seek(p) { progress = p; render(); },
    setConfig(next) { wave.configure(cfg, next); cfg = next; layout(); },
    relayout() { layout(); },
    naturalLength() { return Math.max(0.3, cfg.height); },
    destroy() {
      stopField();
      ['pointermove', 'pointerdown', 'pointerup', 'pointercancel'].forEach((t) => removeEventListener(t, onFieldPointer));
      document.removeEventListener('pointerout', onFieldOut);
      reveals.forEach((x) => x.r.destroy());
      wave.destroy();
      el.classList.remove('foot');
      content.remove(); shade.remove();
    },
    get config() { return cfg; },
  };
}

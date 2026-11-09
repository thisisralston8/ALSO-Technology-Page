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

   Pure function of progress, no smoothing of its own: the page's one
   smoothing (Lenis) is what makes it feel soft. */

import { span as gridSpan, gridOptions } from '../grid.js';
import { createLineReveal, revealAtTop, revealOptions } from '../lineReveal.js';
import { createColorWave, letters, WAVE_DEFAULTS } from '../colorWave.js';
import logoSvg from '../assets/footer/also-logo.svg?raw';
import arrowUpUrl from '../assets/footer/arrow-up.svg?url';

// The wordmark's own proportions (Figma: 1363.719 × 324.404 in a 1360 box).
const LOGO_W = 1363.719, LOGO_H = 324.404, LOGO_BOX = 1360;

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
  // The wordmark, inline. The reveal moves `logo` inside its mask.
  const logo = document.createElement('div');
  logo.className = 'foot__logo';
  logo.setAttribute('role', 'img');
  logo.setAttribute('aria-label', 'ALSO.');
  logo.innerHTML = logoSvg;
  const svg = logo.querySelector('svg');
  svg.removeAttribute('width'); svg.removeAttribute('height');
  svg.setAttribute('aria-hidden', 'true');
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
  }

  layout();

  return {
    seek(p) { progress = p; render(); },
    setConfig(next) { wave.configure(cfg, next); cfg = next; layout(); },
    relayout() { layout(); },
    naturalLength() { return Math.max(0.3, cfg.height); },
    destroy() {
      reveals.forEach((x) => x.r.destroy());
      wave.destroy();
      el.classList.remove('foot');
      content.remove(); shade.remove();
    },
    get config() { return cfg; },
  };
}

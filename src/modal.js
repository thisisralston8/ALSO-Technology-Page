/* The platform's "Explore" modal — after pda.archi/expertises.

   The layer's text block *becomes* the card: a surface starts exactly over
   the block (in the section's own background colour, so nothing appears to
   pop) and grows into the card in the true centre of the screen, turning
   the card's colour and rounding its corners as it goes. The block's
   headline travels with it into the card's header. The page behind dims and
   blurs, and is locked; once the card has landed its content rises in.

   All three layers are cards in one scroll, stacked like GSAP's "pinned
   panels with overscroll" demo: scroll to the bottom of Hardware and it
   holds there, shrinking and fading, while Software slides up over it; then
   Software hands over to Autonomy the same way. Every card's look is a pure
   function of the scroll position, so scrolling back up reverses it exactly.
   The section behind follows to the layer being read. A close button
   floats over everything at the bottom of the screen (its look, and an
   uploaded SVG icon, are settings).

   Closing is the opening backwards (the ease mirrored in time), a little
   faster, built from wherever the card is — scrolled, mid-handover or still
   opening.

   Page chrome, like the nav: it isn't a beat. It stops and restarts Lenis
   while it's open, and asks main.js (`onLayer`) to move the page to a
   layer. The platform asks for it with a `plat:explore` event (platform.js);
   its settings are the platform's `modal*` ones (schema.js → Isometric
   platform → Explore modal).

   Content is a wireframe for now: grey blocks standing in for the image and
   copy, so the timing and motion can be set first. */

import { span as gridSpan } from './grid.js';
import { cleanSvg } from './svgIcon.js';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;

export function createModal({ gsap, lenis, onLayer = () => {} }) {
  const root = document.createElement('div');
  root.className = 'xm';
  root.hidden = true;
  root.innerHTML = `
    <div class="xm__backdrop"></div>
    <div class="xm__surface"></div>
    <div class="xm__scroll" data-lenis-prevent role="dialog" aria-modal="true" aria-label="Platform layers">
      <div class="xm__stack"></div>
      <div class="xm__end" aria-hidden="true"></div>
    </div>
    <button class="xm__x" type="button" aria-label="Close"></button>
    <h2 class="xm__ghost" aria-hidden="true"></h2>`;
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const backdrop = $('.xm__backdrop'), surface = $('.xm__surface'), scroller = $('.xm__scroll');
  const stack = $('.xm__stack'), end = $('.xm__end'), ghost = $('.xm__ghost');
  const closeBtn = $('.xm__x');

  let tl = null;
  let closing = false;
  let cfg = null;
  let layers = [];        // [{ block, heading, button }] from the platform, by layer
  let cards = [];         // [{ el, num, title, body, top, h, … }]
  let active = 0;         // index of the card being read
  let look = null;        // { k0, fg0, bg0 }: the platform text's own look, for the grow
  let metrics = null;     // { H, M }

  /* ---------- cards ---------- */

  function wireframe(n) {
    const bar = (w) => `<i class="xm__bar" style="width:${w}%"></i>`;
    const section = (k) => `
      <section class="xm__sec">
        <div class="xm__img"><span>Image ${n}.${k}</span></div>
        <div class="xm__copy">${bar(92)}${bar(86)}${bar(95)}${bar(60)}</div>
      </section>`;
    return `
      <div class="xm__lede">${bar(70)}${bar(55)}</div>
      ${section(1)}${section(2)}${section(3)}`;
  }

  function build() {
    stack.replaceChildren();
    cards = layers.map((l, i) => {
      const el = document.createElement('article');
      el.className = 'xm__card';
      el.innerHTML = `
        <header class="xm__head">
          <span class="xm__num">${String(i + 1).padStart(2, '0')}</span>
          <h2 class="xm__title"></h2>
        </header>
        <div class="xm__body">${wireframe(i + 1)}</div>`;
      const q = (s) => el.querySelector(s);
      q('.xm__title').textContent = l.heading.textContent;
      el.style.zIndex = String(i + 1);   // each card slides up over the last
      stack.appendChild(el);
      return {
        el, num: q('.xm__num'), title: q('.xm__title'), body: q('.xm__body'),
        top: 0, h: 0, t: 0,
        // Whether its headline and its body are showing (see `cascades`).
        head: true, bodyIn: true,
      };
    });
  }

  // A colour at the card's set opacity. The surface keeps that opacity the
  // whole way — starting in the section's colour, ending in the card's — so
  // a see-through card is see-through from the first frame, not just once
  // it has landed.
  const atCardOpacity = (colour, c) => {
    const hex = (colour || '#000000').replace('#', '');
    const v = parseInt(hex.length === 3 ? hex.replace(/./g, '$&$&') : hex, 16);
    const a = clamp01(c.modalBgOpacity ?? 1);
    return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${a})`;
  };
  const cardBg = (c) => atCardOpacity(c.modalBg || '#ecebe8', c);
  const rectOf = (el, pad = 0) => {
    const r = el.getBoundingClientRect();
    return { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
  };
  // The active card's visible box: where the surface ends up, or starts back from.
  const visibleCard = () => {
    const r = cards[active].el.getBoundingClientRect();
    const top = Math.max(0, r.top), bottom = Math.min(innerHeight, r.bottom);
    return { x: r.left, y: top, w: r.width, h: Math.max(0, bottom - top) };
  };

  /* ---------- the floating close button ----------
     Fixed at the bottom centre, above everything in the modal. Its icon is
     the uploaded SVG (`modalCloseIcon`, markup kept in the settings) or a
     plain ×. The icon is recoloured to `modalCloseInk`: its fills and
     strokes are switched to currentColor (see svgIcon.js). */

  const DEFAULT_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  let iconKey = null;
  function styleCloseButton() {
    const size = cfg.modalCloseSize;
    Object.assign(closeBtn.style, {
      width: `${size}px`, height: `${size}px`,
      bottom: `${cfg.modalCloseBottom}px`,
      background: cfg.modalCloseBg, color: cfg.modalCloseInk,
    });
    closeBtn.style.setProperty('--xm-icon', `${Math.round(size * cfg.modalCloseIconSize)}px`);
    const svg = cfg.modalCloseIcon || '';
    if (svg !== iconKey) {
      iconKey = svg;
      // Cleaned again here: the markup may come from a saved file, not only
      // from the upload (which cleans it too).
      closeBtn.innerHTML = cleanSvg(svg) || DEFAULT_X;
    }
  }

  function layout() {
    const H = innerHeight, M = cfg.modalMargin;
    const box = gridSpan(innerWidth, cfg.modalCol, cfg.modalSpan);
    cards.forEach((c, i) => {
      Object.assign(c.el.style, {
        marginLeft: `${box.x}px`, width: `${box.w}px`,
        // At least a screen tall (less the margins), so every handover has
        // the same shape however short a layer's content is.
        minHeight: `${Math.max(0, H - 2 * M)}px`,
        marginBottom: i < cards.length - 1 ? `${M}px` : '0px',
        borderRadius: `${cfg.modalRadius}px`, background: cardBg(cfg),
        transform: '', opacity: '', visibility: '',
      });
      c.title.style.fontSize = `${cfg.modalTitleSize}px`;
    });
    ghost.style.fontSize = `${cfg.modalTitleSize}px`;
    scroller.style.paddingTop = `${M}px`;
    end.style.height = `${M}px`;
    styleCloseButton();
    root.style.setProperty('--xm-ink', cfg.modalInk);
    backdrop.style.background = `rgba(0, 0, 0, ${cfg.modalDim})`;
    backdrop.style.backdropFilter = backdrop.style.webkitBackdropFilter =
      cfg.modalBlur > 0 ? `blur(${cfg.modalBlur}px)` : '';
    cards.forEach((c) => { c.top = c.el.offsetTop; c.h = c.el.offsetHeight; });
    metrics = { H, M };
  }

  /* ---------- the stack ----------
     Card i scrolls normally until its bottom reaches the bottom margin
     (`hold`). From there it's held in place, shrinking towards
     `modalStackScale` and fading, while card i+1 scrolls up over it; the
     handover ends when card i+1's top reaches the top margin. The last card
     just ends, with the bottom margin under it. */

  const holdAt = (c) => c.top + c.h - (metrics.H - metrics.M);

  function update() {
    if (!metrics || !cards.length) return;
    const y = scroller.scrollTop;
    const { H, M } = metrics;
    const view = H - 2 * M;
    let now = 0;
    cards.forEach((c, i) => {
      const hold = holdAt(c);
      const last = i === cards.length - 1;
      const len = last ? 1 : cards[i + 1].top - M - hold;
      const t = clamp01((y - hold) / Math.max(1, len));
      c.t = last ? 0 : t;
      if (y <= hold || last) {
        c.el.style.transform = '';
        c.el.style.opacity = '';
        c.el.style.visibility = '';
        c.el.style.clipPath = '';
      } else {
        // Scaled about the middle of the part of it that's on screen.
        c.el.style.transformOrigin = `50% ${c.h - view / 2}px`;
        {
          const s = lerp(1, cfg.modalStackScale, t);
          // As in the demo: most of the way to `modalStackFade`, then out.
          const o = t < 0.9 ? lerp(1, cfg.modalStackFade, t / 0.9) : lerp(cfg.modalStackFade, 0, (t - 0.9) / 0.1);
          c.el.style.transform = `translate3d(0, ${y - hold}px, 0) scale(${s})`;
          c.el.style.opacity = o.toFixed(3);
          c.el.style.visibility = t >= 1 ? 'hidden' : '';
          // Cut off where the next card's top edge is, so the next card
          // covers it even when cards are see-through (Card opacity < 1).
          // In the card's own (unscaled) coordinates.
          const origin = c.h - view / 2;
          const nextTop = cards[i + 1].top - y;            // on screen
          const originOnScreen = c.top - hold + origin;
          const cut = origin + (nextTop - originOnScreen) / Math.max(0.01, s);
          c.el.style.clipPath = `inset(0 0 ${Math.max(0, c.h - cut).toFixed(1)}px 0 round ${cfg.modalRadius}px)`;
        }
      }
      // The next card is the one being read once it's half way up.
      if (!last && y > hold + len / 2) now = i + 1;
    });
    if (now !== active) setActive(now);
    cascades(true);
  }

  /* ---------- content cascades between layers ----------
     As a card's handover starts (`modalSwapOut` of the way through), its
     content cascades away — bottom up, rising and fading, the headline last.
     The incoming card's headline arrives with the card; its body cascades in
     beneath it, top down, once the card is `modalSwapIn` of the way up.
     These play on time, like the open, once the scroll crosses those points;
     scrolling back crosses them the other way and plays them back.

     Each card's wanted state is a pure function of the scroll; only getting
     there is timed. Only the pieces on screen are staggered: the rest of a
     long card is set straight away, so the cascade never waits on content
     you can't see. */

  const headOf = (c) => [c.num, c.title];
  const blur = (px) => `blur(${Math.max(0, px)}px)`;
  const onScreen = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };

  // Fade `parts` in (from below) or out (upwards), after `delay`. Returns
  // when the last one finishes.
  function cascade(parts, show, delay) {
    const rise = cfg.modalContentRise;
    const vis = parts.filter(onScreen), off = parts.filter((p) => !onScreen(p));
    gsap.killTweensOf(parts);
    gsap.set(off, show ? { opacity: 1, y: 0, filter: 'none' } : { opacity: 0, y: -rise, filter: 'none' });
    if (!vis.length) return delay;
    // Pieces arriving from nothing start low and blurred.
    if (show) vis.forEach((p) => { if (+gsap.getProperty(p, 'opacity') < 0.05) gsap.set(p, { y: rise, filter: blur(cfg.modalBlurIn) }); });
    const dur = show ? cfg.modalContentFade : cfg.modalSwapFade;
    gsap.to(vis, {
      opacity: show ? 1 : 0, y: show ? 0 : -rise,
      filter: blur(show ? 0 : cfg.modalBlurOut),
      duration: dur, delay, ease: show ? 'power3.out' : 'power2.in',
      stagger: cfg.modalSwapStagger,
      // A filter left on costs a layer each; a sharp piece needs none.
      onComplete() { gsap.set(vis, { filter: 'none' }); },
    });
    return delay + dur + cfg.modalSwapStagger * (vis.length - 1);
  }

  function cascades(animate) {
    cards.forEach((c, i) => {
      const leaving = i < cards.length - 1 && c.t >= cfg.modalSwapOut;
      const arrived = i === 0 || cards[i - 1].t >= cfg.modalSwapIn;
      const head = !leaving;
      const bodyIn = head && arrived;
      if (head === c.head && bodyIn === c.bodyIn) return;
      const body = [...c.body.children];
      if (!animate) {
        gsap.killTweensOf([...body, ...headOf(c)]);
        gsap.set(body, { opacity: bodyIn ? 1 : 0, y: 0 });
        gsap.set(headOf(c), { opacity: head ? 1 : 0, y: 0 });
      } else if (!head) {
        // Leaving: the body bottom up, then the headline.
        const at = c.bodyIn ? cascade(body.reverse(), false, 0) : 0;
        cascade(headOf(c), false, c.bodyIn ? Math.max(0, at - cfg.modalSwapFade * 0.5) : 0);
      } else if (!c.head) {
        // Back again (scrolling up): the headline, then the body top down.
        const at = cascade(headOf(c), true, 0);
        if (bodyIn) cascade(body, true, Math.max(0, at - cfg.modalContentFade * 0.6));
      } else {
        cascade(bodyIn ? body : body.reverse(), bodyIn, 0);
      }
      c.head = head; c.bodyIn = bodyIn;
    });
  }

  // The card being read changes: the platform follows, and the text block
  // the modal will close back into is the new layer's.
  function setActive(i) {
    layers[active]?.block.classList.remove('xm-origin');
    active = i;
    layers[active].block.classList.add('xm-origin');
    onLayer(active + 1, cfg);
  }

  /* ---------- open / close ---------- */

  function open({ n, layers: ls, cfg: c }) {
    if (tl || !ls?.[n - 1]) return;
    cfg = c;
    layers = ls;
    active = n - 1;
    closing = false;
    build();
    root.hidden = false;
    layout();
    // Straight to this layer's card, with its top at the top margin.
    scroller.scrollTop = cards[active].top - metrics.M;
    update();
    cascades(false);   // every card straight to where the scroll says
    lenis?.stop();
    document.documentElement.classList.add('xm-open');

    const { block, heading } = layers[active];
    const card = cards[active];
    const a = rectOf(block, cfg.modalOriginPad);
    const b = visibleCard();
    const h0 = heading.getBoundingClientRect();
    const h1 = card.title.getBoundingClientRect();
    look = {
      // The headline's starting size, against the card's.
      k0: parseFloat(getComputedStyle(heading).fontSize) / Math.max(1, cfg.modalTitleSize),
      fg0: getComputedStyle(heading).color,
      bg0: atCardOpacity(cfg.night, cfg),
    };
    ghost.textContent = card.title.textContent;

    // The block hands over to the surface (a class, not a style: the
    // platform rewrites the block's inline style every frame); the cards
    // wait for the surface.
    block.classList.add('xm-origin');
    stack.style.visibility = 'hidden';
    gsap.set(surface, { x: a.x, y: a.y, width: a.w, height: a.h, borderRadius: 0, backgroundColor: look.bg0, opacity: 1 });
    gsap.set(ghost, { x: h0.left, y: h0.top, scale: look.k0, color: look.fg0, opacity: 1 });
    gsap.set(backdrop, { opacity: 0 });
    const parts = [card.num, ...card.body.children];
    gsap.set(parts, { opacity: 0, y: cfg.modalContentRise, filter: blur(cfg.modalBlurIn) });
    gsap.set(closeBtn, { opacity: 0, y: cfg.modalContentRise, xPercent: -50 });

    const D = cfg.modalDuration, ease = cfg.modalEase;
    tl = gsap.timeline({ onComplete: () => closeBtn.focus({ preventScroll: true }) });
    tl.to(backdrop, { opacity: 1, duration: D, ease: 'power2.out' }, 0)
      .to(surface, {
        x: b.x, y: b.y, width: b.w, height: b.h,
        borderRadius: cfg.modalRadius, backgroundColor: cardBg(cfg),
        duration: D, ease,
      }, 0)
      .to(ghost, { x: h1.left, y: h1.top, scale: 1, color: cfg.modalInk, duration: D, ease }, 0)
      // The cards take over from the surface and the ghost headline.
      .set(stack, { visibility: 'visible' }, D)
      .set([surface, ghost], { opacity: 0 }, D)
      .to(parts, {
        opacity: 1, y: 0, filter: blur(0),
        duration: cfg.modalContentFade, ease: 'power3.out',
        stagger: cfg.modalStagger,
        onComplete() { gsap.set(parts, { filter: 'none' }); },
      }, D + cfg.modalContentDelay)
      // The close button rises in with the content.
      .to(closeBtn, { opacity: 1, y: 0, duration: cfg.modalContentFade, ease: 'power3.out' }, D + cfg.modalContentDelay);
  }

  /* Closing is the opening in reverse — same path, same ease mirrored in
     time — but built fresh from wherever things are now: the card may have
     been scrolled or be mid-handover, or the open may not have finished.
     The content fades out quickly first, then the card shrinks back into
     the text block of the layer being read. */
  function close() {
    if (!tl || closing) return;
    closing = true;
    const { block, heading } = layers[active];
    const card = cards[active];
    const landed = stack.style.visibility !== 'hidden';
    tl.kill();
    const D = cfg.modalDuration / Math.max(0.1, cfg.modalCloseSpeed);
    const openEase = gsap.parseEase(cfg.modalEase);
    const ease = (t) => 1 - openEase(1 - t);
    const a = rectOf(block, cfg.modalOriginPad);
    const h0 = heading.getBoundingClientRect();
    const fade = landed ? Math.min(0.2, D * 0.4) : 0;
    ghost.textContent = card.title.textContent;
    // A headline that isn't wholly on screen doesn't fly back in from off
    // the edge: the platform's own headline fades and comes into focus in
    // place instead, like the content between layers, while the card still
    // shrinks into the block.
    const t1 = card.title.getBoundingClientRect();
    const inPlace = landed && (t1.top < 0 || t1.bottom > innerHeight);

    tl = gsap.timeline({ onComplete: finish });
    tl.to(closeBtn, { opacity: 0, y: cfg.modalContentRise, duration: Math.max(0.12, fade), ease: 'power1.in' }, 0);
    if (landed) {
      tl.to(stack, { opacity: 0, duration: fade, ease: 'power1.in' }, 0);
      // The surface and ghost headline take over from the card where it is.
      tl.add(() => {
        const b = visibleCard();
        const h1 = card.title.getBoundingClientRect();
        gsap.set(surface, { x: b.x, y: b.y, width: b.w, height: b.h, opacity: 1 });
        if (!inPlace) gsap.set(ghost, { x: h1.left, y: h1.top, scale: 1, opacity: 1 });
      }, 0);
    }
    tl.to(surface, {
      x: a.x, y: a.y, width: a.w, height: a.h, borderRadius: 0, backgroundColor: look.bg0,
      duration: D, ease,
    }, fade);
    if (inPlace) {
      // Shown on its own while the rest of its block stays hidden for the
      // surface (the `.xm-reveal` class beats `.xm-origin`'s visibility).
      heading.classList.add('xm-reveal');
      tl.fromTo(heading, { opacity: 0, filter: blur(cfg.modalBlurIn) }, {
        opacity: 1, filter: blur(0), duration: D, ease: 'power2.out',
      }, fade);
    } else {
      tl.to(ghost, { x: h0.left, y: h0.top, scale: look.k0, color: look.fg0, duration: D, ease }, fade);
    }
    tl.to(backdrop, { opacity: 0, duration: D, ease: 'power2.in' }, fade);
  }

  function finish() {
    root.hidden = true;
    stack.style.visibility = '';
    stack.style.opacity = '';
    const l = layers[active];
    if (l) {
      l.heading.classList.remove('xm-reveal');
      gsap.set(l.heading, { clearProps: 'opacity,filter' });
      l.block.classList.remove('xm-origin');
      l.button?.focus({ preventScroll: true });
    }
    document.documentElement.classList.remove('xm-open');
    lenis?.start();
    tl?.kill();
    tl = null; closing = false; metrics = null;
  }

  scroller.addEventListener('scroll', update, { passive: true });
  // A click outside the cards (on the dimmed page) closes it.
  scroller.addEventListener('click', (e) => { if (!e.target.closest('.xm__card')) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && tl) close(); });
  closeBtn.addEventListener('click', close);
  // Keep focus inside while open: the close button is the only control yet.
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && tl) { e.preventDefault(); closeBtn.focus(); }
  });
  addEventListener('resize', () => {
    if (!tl || closing) return;
    // Keep the same place in the same card.
    const c = cards[active], off = scroller.scrollTop - c.top;
    layout();
    scroller.scrollTop = c.top + off;
    update();
  });

  return {
    open,
    close,
    get isOpen() { return !!tl; },
  };
}

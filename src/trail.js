/* Motion trail — a time-based echo of anything that moves.

   Each section registers the elements that should leave a trail (images and
   dots, never text). Every frame the trail records how each one is drawn — its
   inline style, which is where every beat puts position, size, opacity and
   visibility — and keeps `trailCount` echoes behind it: copies showing the
   element as it was `trailStagger`, 2 × `trailStagger`, … milliseconds ago,
   each fainter and more blurred than the last. Scroll fast and the trail
   stretches; stop and it catches up and disappears.

   Like the grain, it runs on time rather than scroll: it's an effect laid over
   the choreography, not part of it. It never changes the tracked elements.

   An echo identical to the live element (nothing moved) is hidden, so blur
   never puts a halo round something at rest.

   Content: most elements are cloned once (an image tile is just a box with a
   picture). Canvases can't be cloned with their pixels, so canvas echoes copy
   the source bitmap every frame they're shown. */

import gsap from 'gsap';

export const TRAIL_DEFAULTS = {
  trail: 'off',
  trailCount: 5,         // echoes behind each element
  trailStagger: 40,      // ms between echoes
  trailOpacity: 0.6,     // opacity of the first echo
  trailFalloff: 0.3,     // each further echo keeps (1 − falloff) of the one before
  trailBlur: 6,          // px of blur on the oldest echo; nearer echoes get less
};

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const trails = new Set();
let ticking = false;

function tick() {
  const now = performance.now();
  trails.forEach((t) => t.update(now));
}

export function createTrail() {
  let opts = { ...TRAIL_DEFAULTS };
  const items = new Map();   // el -> { mode, source, ghosts: [], hist: [] }

  const active = () => opts.trail === 'on' && !reduced.matches;

  /* mode:
       'clone'       copy the element (and its children) once
       'canvas'      the element is a canvas; echoes copy its pixels
       'canvasFill'  copy the element as an empty box, with a canvas filling
                     it that copies `source`'s pixels (a box whose picture is
                     drawn by a canvas inside it) */
  function add(el, { mode = 'clone', source = null } = {}) {
    if (!el || items.has(el)) return;
    items.set(el, { el, mode, source: source || el, ghosts: [], hist: [] });
  }

  function remove(el) {
    const it = items.get(el);
    if (!it) return;
    it.ghosts.forEach((g) => g.remove());
    items.delete(el);
  }

  function clear() { [...items.keys()].forEach(remove); }

  function makeGhost(it) {
    let g;
    if (it.mode === 'clone') g = it.el.cloneNode(true);
    else if (it.mode === 'canvas') g = document.createElement('canvas');
    else {
      g = it.el.cloneNode(false);
      const c = document.createElement('canvas');
      c.className = 'trail-ghost__fill';
      g.appendChild(c);
    }
    g.setAttribute('aria-hidden', 'true');
    g.removeAttribute('id');
    return g;
  }

  function fit(it, n) {
    while (it.ghosts.length > n) it.ghosts.pop().remove();
    while (it.ghosts.length < n) {
      const g = makeGhost(it);
      // Older echoes sit further back in the stacking order.
      (it.ghosts[it.ghosts.length - 1] || it.el).before(g);
      it.ghosts.push(g);
    }
  }

  // Copy the source's current picture into an echo. Sources can be canvases or
  // videos. A 'canvasFill' echo is drawn at the size it's shown (capped, so a
  // full-HD video isn't copied at full resolution into every echo every frame)
  // and cropped like object-fit: cover, the way the element shows its picture.
  const FILL_MAX = 640;
  function copyPixels(g, it) {
    const src = it.source;
    const c = it.mode === 'canvasFill' ? g.firstChild : g;
    const sw = src.videoWidth || src.width, sh = src.videoHeight || src.height;
    if (!sw || !sh) return;
    let cw = sw, ch = sh;
    if (it.mode === 'canvasFill') {
      const bw = parseFloat(g.style.width) || sw, bh = parseFloat(g.style.height) || sh;
      const k = Math.min(1, FILL_MAX / Math.max(bw, bh));
      cw = Math.max(1, Math.round(bw * k)); ch = Math.max(1, Math.round(bh * k));
    }
    if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
    let sx = 0, sy = 0, cropW = sw, cropH = sh;
    if (sw / sh > cw / ch) { cropW = sh * (cw / ch); sx = (sw - cropW) / 2; } else { cropH = sw / (cw / ch); sy = (sh - cropH) / 2; }
    const x = c.getContext('2d');
    x.clearRect(0, 0, cw, ch);
    x.drawImage(src, sx, sy, cropW, cropH, 0, 0, cw, ch);
  }

  // A cloned echo copied its pictures when it was made. Keep them in step with
  // the element's — a tile can change its picture mid-flight (the handoff tile
  // takes Open road's frozen video frame, then dissolves to Flow's image).
  function syncPictures(g, el) {
    const live = el.getElementsByTagName('img');
    if (!live.length) return;
    const echo = g.getElementsByTagName('img');
    for (let i = 0; i < live.length && i < echo.length; i++) {
      const src = live[i].getAttribute('src');
      if (src !== echo[i].getAttribute('src')) echo[i].setAttribute('src', src || '');
      if (echo[i].style.cssText !== live[i].style.cssText) echo[i].style.cssText = live[i].style.cssText;
    }
  }

  function hide(it) { it.ghosts.forEach((g) => { g.style.display = 'none'; }); }

  // Forget an element's history and hide its echoes now. For an element that
  // has just been handed over (or taken back): echoes of where it *was* would
  // linger as a ghost at the old place for the length of the trail.
  function reset(el) {
    const it = items.get(el);
    if (!it) return;
    it.hist = [];
    hide(it);
  }

  function update(now) {
    if (!items.size) return;
    if (!active()) { items.forEach((it) => { if (it.ghosts.length) { fit(it, 0); it.hist = []; } }); return; }

    const n = Math.max(0, Math.round(opts.trailCount));
    const step = Math.max(1, opts.trailStagger);
    const keep = n * step + 120;

    items.forEach((it) => {
      if (!it.el.isConnected) { remove(it.el); return; }
      const css = it.el.style.cssText, cls = it.el.className;
      const h = it.hist;
      const last = h[h.length - 1];
      // Each entry is a state and the moment it *began*. An unchanged element
      // adds nothing, so once it stops, every echo's look-back time eventually
      // passes that moment, lands on the current state, and hides.
      if (!last || last.css !== css || last.cls !== cls) h.push({ t: now, css, cls });
      // Drop history older than the oldest echo needs (keeping one older entry).
      while (h.length > 2 && h[1].t < now - keep) h.shift();

      fit(it, n);
      let prevCss = css;
      it.ghosts.forEach((g, i) => {
        const k = i + 1;
        const want = now - k * step;
        let e = h[0];
        for (let j = h.length - 1; j >= 0; j--) if (h[j].t <= want) { e = h[j]; break; }
        // Nothing to show: identical to the element, or to the nearer echo.
        if (e.css === prevCss && e.cls === cls) { g.style.display = 'none'; return; }
        prevCss = e.css;

        g.style.cssText = e.css;
        g.className = `${e.cls} trail-ghost`;
        const base = parseFloat(g.style.opacity);
        const o = (Number.isFinite(base) ? base : 1) * opts.trailOpacity * (1 - opts.trailFalloff) ** (k - 1);
        g.style.opacity = String(o);
        const b = n ? (opts.trailBlur * k) / n : 0;
        g.style.filter = b > 0.05 ? `blur(${b.toFixed(2)}px)` : '';
        g.style.pointerEvents = 'none';
        g.style.display = '';
        if (it.mode !== 'clone') copyPixels(g, it);
        else syncPictures(g, it.el);
      });
    });
  }

  function setOptions(o) {
    opts = { ...TRAIL_DEFAULTS, ...o };
    if (!active()) items.forEach((it) => { fit(it, 0); it.hist = []; });
  }

  const self = {
    add, remove, clear, update, setOptions, hide, reset,
    destroy() { clear(); trails.delete(self); },
  };
  trails.add(self);
  if (!ticking) { gsap.ticker.add(tick); ticking = true; }
  return self;
}

/* Beat 4 — Platform verticals (placeholder).

   The Isometric platform ends on a white dot on black. This section *covers*
   it (director `cover: true`) and then scrolls away like a page (director
   `flow: true`: no sticky hold; `height` screens tall): its section is pulled up over the platform's
   last screen, so it rises from the bottom of the screen in its own colour
   while the platform holds still on the dot underneath — the same move as
   Traffic's dark rising over "Start small", in the other direction. The dot
   goes behind it.

   The moment the dot is fully covered, the dot comes alive and becomes the
   cursor: it emerges where the dot went under, at the dot's size and colour,
   and travels to the pointer — stretching along its path, swelling a little
   as it wakes, taking on `cursorColour` — then locks to the pointer exactly,
   with the system cursor hidden. It chases the pointer if it moves on the
   way. Scroll back up past that point and it simply goes, and the normal
   cursor returns — the dot is back in the platform's picture. Whether it's on is a pure function of this beat's
   progress; the flight runs on time and follows the pointer (page chrome,
   like the cursor lens). On touch screens — no cursor — the dot simply goes
   behind the section.

   The content (after the Figma frames "Desktop - 113 / 114"): a headline
   and three large categories, each with a small number inviting a hover.
   Hovering a category dims it and hides its number, and its statistic
   appears beside the cursor and follows it. Moving straight from one
   category to the next crossfades the statistics; the gap between rows is
   bridged by `statHold`, so a quick pass down the list doesn't flicker out
   and back in. Every transition is a CSS transition, so a change of mind
   mid-fade reverses from wherever it is. With `statMode: 'under'` (the
   phone setting, after the Figma "iPhone 18 Pro - 1" frame) — or on a
   screen with no hover — each statistic sits under its category instead,
   and nothing reacts to the pointer. */

import { span as gridSpan } from '../grid.js';
import { createLineReveal, revealAtTop } from '../lineReveal.js';

// The categories: name, number and statistic, flat keys so a phone override
// is one key like any other.
export const VERTICALS = [1, 2, 3];

export const VERTICALS_DEFAULTS = {
  height: 1.5,             // screens: how tall the section is. It scrolls like a page
                           // (no hold), so this is also how far it scrolls.
  bg: '#FCF5ED',           // the section's colour (Traffic's background)
  fg: '#000000',

  // Content
  headline: 'Expanding transportation across three verticals.',
  name1: 'Logistics', num1: '01', stat1: '68% global population living in cities by 2025',
  name2: 'Quick commerce', num2: '02', stat2: 'Demand for last mile delivery is expected to grow 36% by 2030.',
  name3: 'Passenger', num3: '03', stat3: '72% of vehicle trips are under 10 miles.',

  // Layout (on the grid), the whole block centred in the section less its
  // top and bottom padding
  col: 2,
  headSpan: 6,
  listSpan: 10,
  align: 'left',           // 'left' | 'center' | 'right': all the text, each block within its columns
  valign: 'center',        // 'center': centred in the section less the padding; 'top': at the top padding
  padTop: 0,               // px, kept clear above the content
  padBottom: 0,            // px, kept clear below it
  headGap: 96,             // px, headline to the list
  rowGap: 20,              // px, between categories

  // Type
  headSize: 60, headLeading: 56, headTracking: -3,
  nameSize: 120, nameLeading: 112, nameTracking: -6,
  numbers: 'on',
  numSize: 14, numLeading: 20, numTracking: 0.5, numGap: 4,
  statSize: 16, statLeading: 24, statTracking: -0.25,
  statColour: '#090909',

  // Statistics: 'hover' = beside the cursor over a category; 'under' =
  // always shown under each category
  statMode: 'hover',
  noteGap: 8,              // px, category to its statistic ('under')

  // Hover
  dimOpacity: 0.2,         // the hovered category
  dimBlend: 'multiply',
  dimIn: 0.25,             // s, to dim
  dimOut: 0.4,             // s, back to full
  hideNumber: 'on',        // the hovered category's number fades out
  statGapX: 6,             // px, from the cursor's right edge to the text
  statOffsetY: 0,          // px, down from the cursor's top edge
  statIn: 0.3,             // s, a statistic fading in
  statOut: 0.18,           // s, fading out
  statSwitch: 0.03,        // s, switching straight to another category: the new one waits this long
  statHold: 0.15,          // s, leaving a category, how long before its statistic goes (bridges the gap between rows)
  statRise: 6,             // px, it rises into place as it fades in
  statBlur: 4,             // px, and comes into focus
  statEase: 'cubic-bezier(0.22, 1, 0.36, 1)',

  // Cursor
  cursor: 'on',
  cursorSize: 20,          // px, square — the platform's dot
  cursorColour: '#AC74FC',
  // The dot coming alive: one trip from where the dot went under to the
  // pointer.
  cursorTravel: 0.55,      // s, exactly how long the trip takes
  cursorBounce: 0.25,      // overshoot at the end of the trip (0 = none)
  cursorStretch: 0.6,      // how much it stretches along its path at speed
  cursorPop: 0.35,         // how much it swells as it wakes (× its size)
};

// Phones and tablets: the 4-column grid, smaller type, statistics shown
// under their categories.
export const VERTICALS_MOBILE = {
  col: 1,
  headSpan: 4,
  listSpan: 4,
  valign: 'top',
  padTop: 69,
  headGap: 64,
  rowGap: 40,
  headSize: 32, headLeading: 36, headTracking: -1.5,
  nameSize: 44, nameLeading: 48, nameTracking: -2,
  numbers: 'off',
  numSize: 11, numLeading: 14,
  statMode: 'under',
  statSize: 16, statLeading: 24,
};

export function createVerticals(el, config, deps) {
  let cfg = config;
  let progress = 0;
  let prev = null;          // the beat this one covers (the platform)
  let active = false;

  el.classList.add('vert');
  const block = document.createElement('div');
  block.className = 'vert__block';
  const head = document.createElement('h2');
  head.className = 'vert__head';
  const list = document.createElement('ul');
  list.className = 'vert__list';
  const rows = VERTICALS.map((n) => {
    const li = document.createElement('li');
    li.className = 'vert__item';
    li.innerHTML = '<span class="vert__line"><span class="vert__name"></span><span class="vert__num"></span></span><span class="vert__note"></span>';
    list.appendChild(li);
    const [name, num] = li.firstElementChild.children;
    return { n, li, name, num, note: li.lastElementChild };
  });
  block.append(head, list);
  el.appendChild(block);

  // The statistic beside the cursor: page chrome like the cursor, one line
  // per category stacked in place, so switching is a crossfade.
  const tip = document.createElement('div');
  tip.className = 'vert-tip';
  tip.setAttribute('aria-hidden', 'true');
  const tipLines = VERTICALS.map(() => tip.appendChild(document.createElement('p')));
  document.body.appendChild(tip);

  // The cursor: page chrome, outside the stage so nothing clips it.
  const cursor = document.createElement('div');
  cursor.className = 'vert-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cursor);

  const canHover = matchMedia('(hover: hover) and (pointer: fine)');
  const pointer = { x: 0, y: 0, known: false, over: true };

  // Line reveals (lineReveal.js, the page's Line reveal settings), like every
  // other text on the page: the headline, each category's name and number,
  // and the statistics under them (phones). Each is scrubbed from where its
  // top is on screen — `off` is its offset in the section, measured at
  // layout, and the section's top is a pure function of progress (`topAt`).
  const reveals = [head, ...rows.flatMap((r) => [r.name, r.num, r.note])].map((e) => ({ e, r: createLineReveal(e), off: 0 }));
  function applyReveals() {
    const Hs = screenH(), top = topAt(progress, Hs);
    reveals.forEach((x) => x.r.set(revealAtTop(top + x.off, Hs)));
  }

  function layout() {
    reveals.forEach((x) => x.r.unsplit());
    const W = el.clientWidth || window.innerWidth;
    const H = el.clientHeight || window.innerHeight;
    el.style.background = cfg.bg;
    el.style.color = cfg.fg;
    const h = gridSpan(W, cfg.col, cfg.headSpan), l = gridSpan(W, cfg.col, cfg.listSpan);
    Object.assign(block.style, {
      left: `${h.x}px`, width: `${Math.max(h.w, l.w)}px`,
      top: cfg.valign === 'top' ? `${cfg.padTop}px` : `${cfg.padTop + (H - cfg.padTop - cfg.padBottom) / 2}px`,
      transform: cfg.valign === 'top' ? 'none' : '', gap: `${cfg.headGap}px`,
    });
    // Alignment: the headline and the list each within their own columns.
    const flex = { left: 'flex-start', center: 'center', right: 'flex-end' }[cfg.align] || 'flex-start';
    const text = { left: 'left', center: 'center', right: 'right' }[cfg.align] || 'left';
    block.style.alignItems = flex;
    list.style.alignItems = flex;
    head.style.textAlign = text;
    head.style.alignSelf = 'flex-start';
    list.style.alignSelf = 'flex-start';
    rows.forEach((r) => { r.li.style.alignItems = flex; r.li.style.width = '100%'; r.note.style.textAlign = text; });
    head.textContent = cfg.headline;
    Object.assign(head.style, {
      width: `${h.w}px`, fontSize: `${cfg.headSize}px`, lineHeight: `${cfg.headLeading}px`, letterSpacing: `${cfg.headTracking}px`,
    });
    Object.assign(list.style, { width: `${l.w}px`, gap: `${cfg.rowGap}px` });
    rows.forEach((r) => {
      r.name.textContent = cfg[`name${r.n}`];
      r.num.textContent = cfg[`num${r.n}`];
      r.note.textContent = cfg[`stat${r.n}`];
      Object.assign(r.name.style, {
        fontSize: `${cfg.nameSize}px`, lineHeight: `${cfg.nameLeading}px`, letterSpacing: `${cfg.nameTracking}px`,
        mixBlendMode: cfg.dimBlend,
      });
      Object.assign(r.num.style, {
        fontSize: `${cfg.numSize}px`, lineHeight: `${cfg.numLeading}px`, letterSpacing: `${cfg.numTracking}px`,
        marginLeft: `${cfg.numGap}px`, display: cfg.numbers === 'off' ? 'none' : '',
      });
      Object.assign(r.note.style, {
        fontSize: `${cfg.statSize}px`, lineHeight: `${cfg.statLeading}px`, letterSpacing: `${cfg.statTracking}px`, color: cfg.statColour,
        marginTop: `${cfg.noteGap}px`,
      });
    });
    tipLines.forEach((p, i) => {
      p.textContent = cfg[`stat${i + 1}`];
      Object.assign(p.style, {
        fontSize: `${cfg.statSize}px`, lineHeight: `${cfg.statLeading}px`, letterSpacing: `${cfg.statTracking}px`, color: cfg.statColour,
      });
    });
    el.classList.toggle('vert--under', under());
    if (under()) setHovered(0);
    Object.assign(cursor.style, {
      width: `${cfg.cursorSize}px`, height: `${cfg.cursorSize}px`,
      marginLeft: `${-cfg.cursorSize / 2}px`, marginTop: `${-cfg.cursorSize / 2}px`,
    });
    paintHover(true);
    placeTip();
    // Measured unsplit, then split again at the current progress.
    const base = el.getBoundingClientRect().top;
    reveals.forEach((x) => { x.off = x.e.getBoundingClientRect().top - base; });
    reveals.forEach((x) => x.r.split());
    applyReveals();
  }

  /* ---------- hover ----------
     `hovered` is the category under the pointer; `shown` is the one whose
     statistic is up (it outlives `hovered` by `statHold`, to bridge the gaps
     between rows). Each change sets the transitions it needs and the target
     state; CSS does the rest, and reverses from wherever it is. */

  let hovered = 0, shown = 0, holdTimer = 0;
  // Statistics under each category: the setting, or no hover to show them with.
  const under = () => cfg.statMode === 'under' || !canHover.matches;

  function setHovered(n) {
    if (n === hovered) return;
    hovered = n;
    clearTimeout(holdTimer);
    if (n) show(n);
    else holdTimer = setTimeout(() => show(0), cfg.statHold * 1000);
    paintHover();
  }

  function show(n) {
    if (n === shown) return;
    const switching = !!shown && !!n;
    shown = n;
    tipLines.forEach((p, i) => {
      const on = i + 1 === n;
      const d = on ? cfg.statIn : cfg.statOut;
      const delay = on && switching ? cfg.statSwitch : 0;
      p.style.transition = ['opacity', 'transform', 'filter'].map((k) => `${k} ${d}s ${cfg.statEase} ${delay}s`).join(', ');
      p.style.opacity = on ? '1' : '0';
      p.style.transform = on ? 'translateY(0)' : `translateY(${cfg.statRise}px)`;
      p.style.filter = on ? 'blur(0px)' : `blur(${cfg.statBlur}px)`;
    });
    placeTip();
  }

  function paintHover(instant = false) {
    const off = under();
    rows.forEach((r) => {
      const dim = !off && r.n === hovered;
      const d = instant ? 0 : dim ? cfg.dimIn : cfg.dimOut;
      r.name.style.transition = `opacity ${d}s ${cfg.statEase}`;
      r.num.style.transition = `opacity ${d}s ${cfg.statEase}`;
      r.name.style.opacity = dim ? String(cfg.dimOpacity) : '1';
      r.num.style.opacity = dim && cfg.hideNumber === 'on' ? '0' : '1';
    });
    if (instant) tipLines.forEach((p, i) => {
      const on = i + 1 === shown;
      p.style.transition = 'none';
      p.style.opacity = on ? '1' : '0';
      p.style.transform = on ? 'translateY(0)' : `translateY(${cfg.statRise}px)`;
      p.style.filter = on ? 'blur(0px)' : `blur(${cfg.statBlur}px)`;
    });
  }

  // Beside the cursor: its right edge + `statGapX`, level with its top. If
  // the line would run off the right of the screen, it goes on the left.
  function placeTip() {
    if (!pointer.known) return;
    const half = cfg.cursorSize / 2;
    let x = pointer.x + half + cfg.statGapX;
    const w = tipLines[(shown || 1) - 1].offsetWidth;
    if (x + w > window.innerWidth - 8) x = pointer.x - half - cfg.statGapX - w;
    tip.style.transform = `translate3d(${x}px, ${pointer.y - half + cfg.statOffsetY}px, 0)`;
    tip.style.visibility = pointer.over ? '' : 'hidden';
  }

  // Which category the pointer is over: the name itself (its line box).
  function hitTest() {
    if (under() || !pointer.known || !pointer.over || !inView()) return 0;
    const r = rows.find(({ name }) => {
      const b = name.getBoundingClientRect();
      return pointer.x >= b.left && pointer.x <= b.right && pointer.y >= b.top && pointer.y <= b.bottom;
    });
    return r ? r.n : 0;
  }
  // Only once the section has the screen (it's still rising before that).
  const screenH = () => window.innerHeight;
  const inView = () => progress > 0 && topAt(progress, screenH()) < screenH();

  // Where this section's top edge is on screen at progress p. It's `height`
  // screens tall and scrolls like a page (director `flow`); its progress
  // runs from its top entering at the bottom of the screen to its bottom
  // reaching the bottom of the screen, so the top rises one px per px
  // scrolled the whole way.
  const topAt = (p, H) => H * (1 - p * cfg.height);

  // Covered: the section's top has passed the top of the dot.
  function covered(p) {
    const H = screenH();
    const d = prev?.exitDot?.()?.rect;
    const dotTop = d ? d.y : H / 2 - cfg.cursorSize / 2;
    return topAt(p, H) <= dotTop;
  }

  /* ---------- the dot, alive ----------
     One trip of a fixed length (`cursorTravel`): from where the dot went
     under to wherever the pointer is *now*, re-aimed every frame, so it
     follows a moving pointer yet always lands at the end of the trip and
     locks. The path is eased out with a small overshoot (`cursorBounce`) for
     inertia. It stretches with the trip's own speed — not the mouse's — so
     the stretch is strongest as it leaves and has gone by the time it lands:
     rotate · scale · un-rotate, so a square at rest is never tilted. It
     swells for a moment as it wakes. Locked, every pointermove places it
     exactly.

     Only on the way in. Scrolling back up hides it at once: the dot is back
     in the platform's picture, and two dots would break the illusion. */

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fly = {
    mode: 'off',          // 'off' | 'fly' | 'locked'
    x: 0, y: 0,           // where it is now
    sx: 0, sy: 0,         // where the trip started (the dot)
    t: 0,                 // s into the trip
    raf: 0, last: 0,
  };

  // The dot, on screen: centre, size, colour. The platform's stage is stuck
  // to the top of the screen while this section covers it, so its rect is
  // already in screen coordinates.
  function dot() {
    const d = prev?.exitDot?.();
    const H = screenH(), W = el.clientWidth || window.innerWidth;
    const r = d?.rect || { x: W / 2 - 10, y: H / 2 - 10, w: 20, h: 20 };
    return { x: r.x + r.w / 2, y: r.y + r.h / 2, w: r.w, colour: d?.colour || '#ffffff' };
  }

  // The dot cursor is this section's: over the next section (below the
  // middle of its pixel band) the normal cursor is back. It wakes from the
  // dot once per arrival; coming back up from the next section it's simply
  // there again.
  let next = null, woke = false;
  const belowFloor = () => {
    const f = next?.floor?.();
    // Before the pointer has moved, the dot rests where it woke.
    return f != null && (pointer.known ? pointer.y : fly.y) >= f;
  };
  function sync() {
    const arrived = cfg.cursor === 'on' && canHover.matches && covered(progress);
    if (!arrived) woke = false;
    const on = arrived && !belowFloor();
    if (on === active) return;
    active = on;
    document.documentElement.classList.toggle('has-vert-cursor', on);
    if (!on) return hide();
    if (woke) return lock();
    woke = true;
    wake();
  }

  function wake() {
    const d = dot();
    Object.assign(fly, { mode: 'fly', x: d.x, y: d.y, sx: d.x, sy: d.y, t: 0 });
    if (reduced.matches) return lock();
    run();
  }

  function lock() {
    fly.mode = 'locked';
    stop();
    place();
  }

  function hide() {
    fly.mode = 'off';
    stop();
    cursor.style.display = 'none';
  }

  function run() {
    if (fly.raf) return;
    fly.last = performance.now();
    fly.raf = requestAnimationFrame(step);
  }
  function stop() {
    if (fly.raf) cancelAnimationFrame(fly.raf);
    fly.raf = 0;
  }

  // Ease out with an overshoot of `b` (0 = none): 0 → 1, and its slope.
  const back = (u, b) => { const v = u - 1; return 1 + (b + 1) * v * v * v + b * v * v; };
  const backSlope = (u, b) => { const v = u - 1; return 3 * (b + 1) * v * v + 2 * b * v; };

  function step(now) {
    fly.raf = 0;
    const dt = Math.min(0.05, Math.max(0, (now - fly.last) / 1000));
    fly.last = now;
    fly.t += dt;
    const T = Math.max(0.08, cfg.cursorTravel);
    const u = Math.min(1, fly.t / T);
    // Until the pointer has been seen, the dot wakes where it is.
    if (u >= 1 && pointer.known) return lock();
    draw(u);
    if (u < 1) fly.raf = requestAnimationFrame(step);
  }

  // Mix two #rrggbb colours.
  const mix = (a, b, t) => {
    const p = (c) => [1, 3, 5].map((i) => parseInt(String(c).slice(i, i + 2), 16) || 0);
    const A = p(a), B = p(b);
    return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
  };

  function draw(u) {
    const d = dot();
    const show = pointer.over;
    cursor.style.display = show ? 'block' : 'none';
    if (!show) return;
    const b = Math.max(0, cfg.cursorBounce) * 2.2;
    const tx = pointer.known ? pointer.x : fly.sx, ty = pointer.known ? pointer.y : fly.sy;
    const dx = tx - fly.sx, dy = ty - fly.sy;
    const e = back(u, b);
    fly.x = fly.sx + dx * e;
    fly.y = fly.sy + dy * e;
    // The trip's speed (px/s) at this moment, along the line it's travelling.
    const T = Math.max(0.08, cfg.cursorTravel);
    const speed = Math.abs(backSlope(u, b)) * Math.hypot(dx, dy) / T;
    // Eased in over the first moment, so it leaves the dot as a square.
    const lift = Math.min(1, u / 0.12);
    const st = 1 + Math.min(1.2, (cfg.cursorStretch * speed) / 2400) * lift * lift * (3 - 2 * lift);
    const a = Math.atan2(dy, dx);
    // Size: the dot's to the cursor's over the first part of the trip, plus
    // a swell as it wakes.
    const size = cfg.cursorSize;
    const grow = Math.min(1, u / 0.5);
    const base = d.w / size + (1 - d.w / size) * grow;
    const pop = cfg.cursorPop * Math.sin(Math.PI * Math.min(1, u / 0.8)) * (1 - u * 0.5);
    const scale = base * (1 + pop);
    cursor.style.transform = `translate3d(${fly.x}px, ${fly.y}px, 0) rotate(${a}rad) scale(${st * scale}, ${scale / st}) rotate(${-a}rad)`;
    cursor.style.background = mix(d.colour, cfg.cursorColour, Math.min(1, u / 0.6));
  }

  // Locked: exactly on the pointer.
  function place() {
    if (fly.mode !== 'locked') return;
    const show = pointer.known && pointer.over;
    cursor.style.display = show ? 'block' : 'none';
    if (!show) return;
    fly.x = pointer.x; fly.y = pointer.y;
    cursor.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
    cursor.style.background = cfg.cursorColour;
  }

  // Exact: the square sits where the pointer is, every event, no smoothing.
  // Over the editor panel it steps aside for the normal cursor.
  const isChrome = (t) => !!t?.closest?.('.insp, .insp__show, .phone-preview');
  function onMove(e) {
    if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.known = true;
    pointer.over = !isChrome(e.target);
    setHovered(hitTest());
    placeTip();
    sync();
    // A trip that ended waiting for the pointer starts now it's here.
    if (fly.mode === 'fly' && !fly.raf) { fly.t = 0; run(); }
    place();
  }
  function onOut(e) { if (!e.relatedTarget) { pointer.over = false; place(); setHovered(0); placeTip(); } }
  addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerout', onOut);
  const onHoverChange = () => { layout(); sync(); };
  canHover.addEventListener('change', onHoverChange);

  layout();

  return {
    // Scrolling moves the names under a still pointer.
    seek(p) { progress = p; sync(); applyReveals(); setHovered(hitTest()); },
    // Its section is exactly `height` screens tall (the director prefers
    // this over the configured length).
    naturalLength() { return Math.max(1, cfg.height); },
    setConfig(next) { cfg = next; layout(); sync(); place(); },
    relayout() { layout(); sync(); place(); },
    // Given the beat it covers, for where that beat's dot is.
    cover(api) { prev = api; sync(); },
    followedBy(api) { next = api; },
    destroy() {
      removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerout', onOut);
      canHover.removeEventListener('change', onHoverChange);
      stop();
      document.documentElement.classList.remove('has-vert-cursor');
      cursor.remove();
      clearTimeout(holdTimer);
      tip.remove();
      reveals.forEach((x) => x.r.destroy());
      el.classList.remove('vert');
      block.remove();
    },
    get config() { return cfg; },
  };
}

/* Beat 1 — Open road.

   One image, one headline, one number.

   The headline never fades. It is always fully opaque, and always sitting flush
   against the image's left and right edges — so the image's width is what holds
   the two halves of the line apart. At the start the image is viewport-wide and
   pushes both runs clean off the screen; as it shrinks it *pulls the text in*
   from either edge, and by the time it is a strip inside the line the whole
   headline has arrived. Nothing is animated independently: move the image and
   the words follow, because they are measured off it.

   Once the line is composed the strip narrows to a square, and the text keeps
   hugging it as it does. Then the page scrolls the line up and out of centre
   while the square stays fixed on screen, until Beat 2's stream rises up to
   meet it and carries it off.

   The crop does the rest of the work. The box goes wide (hero) → wide and short
   (inline) → square (the handoff tile), and `object-fit: cover` re-crops the
   picture continuously, so only one element ever moves.

   Over the hero at the very start: a headline ("Our story starts here."),
   which fades, blurs and settles away as the scroll begins (a pure function
   of progress, like everything else here), and a play button — the cursor
   itself, over the hero, on a mouse; a button under the headline on touch —
   that asks the page for the full film (`road:film`, film.js).

   Like every other beat: a pure function of progress, reversible by scrubbing.
   Two exceptions, both outside the scroll: the play cursor follows the
   pointer, and the scroll hint ("Scroll to begin the journey.") appears on
   time, after `hintDelay` seconds at the top for someone who hasn't scrolled
   yet, fading in like Platform verticals' statistics. */

import { createTrail, TRAIL_DEFAULTS } from '../trail.js';
import { createLineReveal } from '../lineReveal.js';
import playIcon from '../assets/ui/play.svg';
import { createColorWave, letters, WAVE_DEFAULTS } from '../colorWave.js';

export function createOpenRoad(el, config, deps) {
  let cfg = config;
  let progress = 0;
  let maskedExit = false;

  el.classList.add('road');

  const art = document.createElement('div');
  art.className = 'road__art';
  // The picture (image or video) sits in its own layer, so it can be blurred
  // as the colour comes in without touching the wireframe filter on it.
  const media = document.createElement('div');
  media.className = 'road__media';
  art.appendChild(media);
  const img = document.createElement('img');
  img.decoding = 'async';
  media.appendChild(img);

  /* The hero can be a video. It loops, muted, while it's on screen; the moment
     the square leaves for Traffic (the director masks our exit) it pauses and the
     current frame is captured, so the tile that flies into Traffic carries that
     exact frame. Scroll back and it plays on from where it stopped. Playback
     runs on time, like the grain — it's footage, not choreography. */
  const video = document.createElement('video');
  Object.assign(video, { muted: true, loop: true, playsInline: true, preload: 'auto' });
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('aria-hidden', 'true');
  media.appendChild(video);
  // The hero's colour, laid over the picture as the image becomes its 1:1
  // square. The square leaves for Traffic already in it, and Traffic's hero
  // carries it on.
  // Measures the small viewport (100svh) for centring a shaped hero.
  const svh = document.createElement('div');
  svh.className = 'road__svh';
  svh.setAttribute('aria-hidden', 'true');
  el.appendChild(svh);
  const tintEl = document.createElement('div');
  tintEl.className = 'road__tint';
  art.appendChild(tintEl);
  let tint = 0;      // current colour amount, 0–1
  let colouring = false;   // the colour has started: the video holds its frame
  let frozen = false;      // paused for the handoff
  let onScreen = true;
  let frozenSrc = '';      // the captured frame, as an image URL (made after the handoff, off the critical path)
  // The captured frame itself. The handoff tile and Traffic's hero paint from
  // this canvas directly, so the picture is there on the frame they appear —
  // no image to encode, then decode, in between.
  const still = document.createElement('canvas');
  let stillOk = false;
  let stillKey = 0;        // bumps on every capture, so painters know to repaint

  const line = document.createElement('h1');
  line.className = 'road__line';
  const runL = document.createElement('span');
  const runR = document.createElement('span');
  runL.className = runR.className = 'road__run';
  line.append(runL, runR);

  // A shade over the picture while the headline is on it, for legibility.
  const shade = document.createElement('div');
  shade.className = 'road__shade';
  art.insertBefore(shade, tintEl);

  // The headline over the hero.
  const title = document.createElement('p');
  title.className = 'road__title';

  // Play: the hero itself is the button (it's under the cursor, which becomes
  // the play icon); on touch, or from the keyboard, the icon sits as a badge
  // under the headline.
  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'road__play';
  play.setAttribute('aria-label', 'Play the film');
  // Each is a positioned wrapper around the drawn button (`.road__dot`), so
  // where it is (exactly at the pointer) and how it comes and goes (a scale
  // and a fade, `is-on`, CSS transitions) never fight.
  const badge = document.createElement('span');
  badge.className = 'road__badge';
  badge.setAttribute('aria-hidden', 'true');
  badge.innerHTML = `<span class="road__tilt"><span class="road__dot"><img src="${playIcon}" alt="" width="24" height="24"></span></span>`;
  const cursor = badge.cloneNode(true);
  cursor.className = 'road__cursor';
  document.body.appendChild(cursor);
  const tiltEl = cursor.querySelector('.road__tilt');

  // The headline's glow: a second copy of the words over them, filled with a
  // radial gradient in the button's colour centred on the button and clipped
  // to the letters (background-clip: text), so the light falls on the type
  // and nowhere else.
  const titleText = document.createElement('span');
  const glow = document.createElement('span');
  glow.className = 'road__glow';
  glow.setAttribute('aria-hidden', 'true');
  title.append(titleText, glow);
  play.addEventListener('click', () => el.dispatchEvent(new CustomEvent('road:film', { bubbles: true })));

  // The scroll hint, under the hero.
  const hint = document.createElement('p');
  hint.className = 'road__hint';
  hint.setAttribute('aria-hidden', 'true');
  // As it comes in it flashes purple and settles to its colour, letter by
  // letter — the colour wave on "Start small" (colorWave.js), started the
  // moment the hint appears rather than by the scroll.
  const hintWave = createColorWave(hint);
  let hintTextNow = null;

  el.append(art, line, title, play, badge, hint);

  // Motion trail on the hero image (and, via the director, the handoff tile).
  // A video's echoes copy its current frame; an image's are simple clones.
  const trail = createTrail();
  let trailMode = '';
  function syncTrail() {
    const mode = usingVideo() ? 'video' : 'image';
    if (mode === trailMode) return;
    trailMode = mode;
    trail.remove(art);
    trail.add(art, mode === 'video' ? { mode: 'canvasFill', source: video } : {});
  }

  const heroVideo = () => (cfg.videos || []).find((v) => v.stem === cfg.video) || (cfg.videos || [])[0] || null;
  const usingVideo = () => cfg.heroMedia === 'video' && !!heroVideo();

  function updatePlayback() {
    if (!usingVideo()) { video.pause(); return; }
    if (frozen || colouring || !onScreen) video.pause();
    else video.play().catch(() => {});   // autoplay can be refused; the poster shows instead
  }

  // Grab the frame on screen right now, into `still`. Synchronous and cheap:
  // one drawImage. (Encoding it to a JPEG used to happen here too, which
  // stalled the very frame the handoff began on, and the tile then had to
  // wait for the browser to decode that new image — the hero blinked out.)
  function captureFrame() {
    const v = heroVideo();
    frozenSrc = v ? v.poster : '';
    stillOk = false;
    stillKey++;
    if (video.readyState < 2 || !video.videoWidth) return;
    const k = Math.min(1, 1280 / video.videoWidth);
    still.width = Math.round(video.videoWidth * k);
    still.height = Math.round(video.videoHeight * k);
    still.getContext('2d').drawImage(video, 0, 0, still.width, still.height);
    stillOk = true;
    // An image URL of it, for anything that wants one, made when the browser
    // is idle rather than now.
    const key = stillKey;
    still.toBlob((b) => { if (b && key === stillKey) frozenSrc = URL.createObjectURL(b); }, 'image/jpeg', 0.9);
  }

  // What the square shows, as something that can be drawn right now: the
  // frozen frame, the playing video, or the (already decoded) image.
  function exitSource() {
    if (usingVideo()) {
      if (frozen && stillOk) return { source: still, key: `still${stillKey}` };
      return video.readyState >= 2 ? { source: video, key: 'video' } : null;
    }
    return img.complete && img.naturalWidth ? { source: img, key: `img:${img.src}` } : null;
  }

  // Only decode while the hero is actually on screen.
  const io = new IntersectionObserver((entries) => {
    onScreen = entries[entries.length - 1].isIntersecting;
    updatePlayback();
  });
  io.observe(art);

  /* ---------- build ---------- */

  // Line reveals on the two halves of the headline, scrubbed by this beat's
  // progress over `revealFrom` → `revealTo` (lineReveal.js).
  const reveals = [createLineReveal(runL), createLineReveal(runR)];

  function build() {
    const [before, after] = splitCopy(cfg.text);
    reveals.forEach((r) => r.unsplit());   // text set on a split element would be undone
    runL.textContent = before;
    runR.textContent = after;
    reveals.forEach((r) => r.split());
  }

  // "This is an ▣ open road." — the ▣ marks where the image sits. Without one we
  // split at the midpoint word, so any copy still works.
  function splitCopy(text) {
    if (text.includes('▣')) {
      const [a, b] = text.split('▣');
      return [a.trim(), b.trim()];
    }
    const w = text.split(/\s+/);
    const mid = Math.ceil(w.length / 2);
    return [w.slice(0, mid).join(' '), w.slice(mid).join(' ')];
  }

  /* ---------- geometry ----------
     Three boxes for the image, all in stage-local pixels, plus the measured
     width of each text run. */

  const geo = { hero: null, inline: null, final: null, W: 0, H: 0, lw: 0, rw: 0, gap: 0, ts: 0 };

  function computeGeometry() {
    const box = el.getBoundingClientRect();
    geo.W = box.width;
    geo.H = box.height;

    const navH = parseFloat(getComputedStyle(el).getPropertyValue('--nav-h')) || 0;
    const gut = geo.W * cfg.gutter;

    // The line never runs off the screen: if it's wider than the space
    // between the gutters at the set size, the whole line (type, gaps and
    // image strip) scales down to fit — a narrow window or a tablet keeps the
    // desktop settings without spilling.
    // Measured at the size the runs are drawn at now, scaled to the set
    // size (text width is proportional to font size), so the type size is
    // only ever written once, and only when it actually changes — rewriting
    // it makes the line reveal re-split the text.
    const shown = parseFloat(getComputedStyle(runL).fontSize) || cfg.typeSize;
    const k = cfg.typeSize / shown;
    const lw0 = runL.offsetWidth * k, rw0 = runR.offsetWidth * k;
    // A shaped hero closes straight to the square, so its slot in the line
    // is square too: Strip width only applies to Fill.
    const slotW = SHAPES[cfg.heroShape] ? cfg.slotH : cfg.slotW;
    const natural = lw0 + rw0 + (2 * cfg.textGap + slotW) * cfg.typeSize;
    const avail = geo.W - gut * 2;
    const fit = geo.W > 0 && lw0 + rw0 > 0 ? Math.min(1, avail / Math.max(1, natural)) : 1;
    geo.ts = cfg.typeSize * fit;
    if (Math.abs(geo.ts - shown) > 0.01) line.style.setProperty('--type-size', `${geo.ts}px`);

    geo.lw = lw0 * fit;
    geo.rw = rw0 * fit;
    geo.gap = cfg.textGap * geo.ts;

    const shape = SHAPES[cfg.heroShape] || 0;
    if (shape) {
      // A set shape (phones start 9:16): `heroWidth` % of the screen's width,
      // centred in the space under the nav — but never taller than that
      // space, so a wide setting on a short screen shrinks to fit rather
      // than running under the nav. The space ends at the bottom of the
      // *small* viewport — the screen with a phone's address bar showing,
      // as it is at the top of the page — so the hero is centred in what you
      // can actually see.
      const bottom = Math.min(geo.H, svh.offsetHeight || geo.H);
      const space = Math.max(1, bottom - navH);
      const w = Math.min((geo.W * cfg.heroWidth) / 100, space * shape);
      const h = w / shape;
      geo.hero = { x: (geo.W - w) / 2, y: navH + (space - h) / 2, w, h };
    } else {
      geo.hero = {
        x: gut,
        y: navH + geo.H * 0.04,
        w: geo.W - gut * 2,
        h: geo.H * cfg.heroHeight - navH,
      };
    }

    // The composed line: runs, gaps and the image strip, centred as one unit.
    // The image box is derived rather than measured off a placeholder, because
    // the runs are positioned from it and not the other way round.
    const iw = slotW * geo.ts;
    const ih = cfg.slotH * geo.ts;
    const total = geo.lw + geo.gap + iw + geo.gap + geo.rw;
    geo.inline = {
      x: (geo.W - total) / 2 + geo.lw + geo.gap,
      y: (geo.H - ih) / 2,
      w: iw,
      h: ih,
    };

    // The strip closes to 1:1 *in the line*: same centre, same height, it just
    // narrows. That square is where the beat ends and what Beat 2 receives.
    geo.final = {
      x: geo.inline.x + geo.inline.w / 2 - ih / 2,
      y: geo.inline.y,
      w: ih,
      h: ih,
    };
    placeKnot();
    placeHint();
  }

  /* ---------- render ----------
     One continuous move — hero → strip in the line → 1:1 square — under a
     single easing, then a short rest on the square before it's released.

     It used to be two separate eased moves (hero → strip, then strip →
     square). Each started and ended at rest, so the image stopped dead at the
     strip before squaring up, and the split was fixed by a slider rather than
     by how much actually changes in each part — a small squaring given most
     of the beat crawled for screens. Now the path runs through the strip
     without stopping: each property (position, width, height) follows a
     smooth monotone curve through the three boxes, so nothing overshoots and
     nothing stops in between. Scroll is shared out by how much changes in
     each part, with `squareShare` keeping a minimum for the squaring so the
     1:1 reveal still reads.

     The text hugs the image the whole way, at a fixed gap from each edge.
     There is no drop: at p=1 the beat's stage unsticks and the page carries
     the line up and away, while the square stays where it is (see `anchor`)
     and is released into Traffic. */

  function render(p) {
    const rv = clamp01((p - cfg.revealFrom) / Math.max(1e-3, cfg.revealTo - cfg.revealFrom));
    reveals.forEach((r) => r.set(rv));
    const end = Math.min(0.98, Math.max(0.02, 1 - cfg.squareHold));
    const u = easeInOut(clamp01(p / end));
    const r = pathAt(u);

    art.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`;
    art.style.width = r.w + 'px';
    art.style.height = r.h + 'px';
    art.style.opacity = maskedExit ? '0' : '1';
    // Square off the corners as it becomes the handoff tile.
    art.style.borderRadius = `${lerp(cfg.radius, 0, smoothstep(geo.knot, 1, u))}px`;
    // Colour: comes in over the end of the move, `colourFrom` → `colourTo`
    // (shares of the move: 0 = the full-width hero, 1 = the finished square).
    const c = smoothstep(cfg.colourFrom, cfg.colourTo, u);
    tint = cfg.heroColourAmount * c;
    tintEl.style.background = cfg.heroColour;
    tintEl.style.opacity = tint > 0 ? tint.toFixed(3) : '0';
    // As the colour starts, the video holds the frame it's on (and plays on
    // if you scroll back above that point)…
    if ((c > 0) !== colouring) { colouring = c > 0; updatePlayback(); }
    // …and the held frame blurs as the colour comes in. Scaled up a touch
    // with the blur so its edges never go soft and see-through.
    const blur = cfg.colourBlur * c;
    media.style.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : '';
    media.style.transform = blur > 0.05 ? `scale(${(1 + (4 * blur) / Math.max(1, Math.min(r.w, r.h))).toFixed(4)})` : '';
    // Fully coloured, the picture isn't drawn at all — so no sliver of it can
    // show at the square's edges.
    media.style.visibility = tint >= 0.999 ? 'hidden' : '';

    const cy = r.y + r.h / 2;
    runL.style.transform = `translate3d(${r.x - geo.gap - geo.lw}px, ${cy}px, 0) translateY(-50%)`;
    runR.style.transform = `translate3d(${r.x + r.w + geo.gap}px, ${cy}px, 0) translateY(-50%)`;

    // The headline over the hero: gone over titleFrom → titleTo (shares of
    // this section's scroll), fading, blurring and sinking a little, like
    // Platform verticals' statistics leaving.
    const t = cfg.title ? smoothstep(cfg.titleFrom, Math.max(cfg.titleFrom + 1e-3, cfg.titleTo), p) : 1;
    const cx = r.x + r.w / 2;
    title.style.maxWidth = `${Math.max(0, r.w - 2 * cfg.titlePad)}px`;
    title.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%) translateY(${(cfg.titleRise * t).toFixed(2)}px)`;
    title.style.opacity = (1 - t).toFixed(3);
    title.style.filter = t > 0.001 ? `blur(${(cfg.titleBlur * t).toFixed(2)}px)` : '';
    title.style.visibility = t >= 0.999 ? 'hidden' : '';
    shade.style.opacity = (cfg.titleShade * (1 - t)).toFixed(3);

    // Play, while the hero is still the hero.
    playOn = cfg.play === 'on' && p <= cfg.playUntil && !maskedExit;
    play.style.display = playOn ? '' : 'none';
    if (playOn) {
      play.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`;
      play.style.width = `${r.w}px`;
      play.style.height = `${r.h}px`;
      // The badge: under the headline (or centred, with no headline).
      const below = cfg.title ? title.offsetHeight / 2 + cfg.playGap + cfg.playSize / 2 : 0;
      badge.style.transform = `translate3d(${cx}px, ${cy + below}px, 0) translate(-50%, -50%)`;
    }
    paintPlay();
  }

  /* ---------- play cursor ----------
     On a mouse, over the hero, the cursor *is* the play button: the icon
     follows the pointer exactly (no easing of its own) and the system cursor
     is hidden there. Touch, or keyboard focus, shows the badge instead. */
  let playOn = false, focused = false;
  const pointer = { x: 0, y: 0, in: false };
  const canHover = matchMedia('(hover: hover) and (pointer: fine)');
  function paintPlay() {
    const r = playOn && pointer.in ? play.getBoundingClientRect() : null;
    const film = document.documentElement.classList.contains('film-open');
    const over = !!r && pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom
      && canHover.matches && !film;
    // The cursor keeps following the pointer while it scales and fades away,
    // so it leaves from where the pointer left.
    cursor.style.display = canHover.matches && pointer.in && !film ? 'grid' : 'none';
    cursor.style.transform = `translate3d(${pointer.x - cfg.playSize / 2}px, ${pointer.y - cfg.playSize / 2}px, 0)`;
    cursor.classList.toggle('is-on', over);
    badge.classList.toggle('is-on', playOn && (!canHover.matches || focused));
    // The glow, centred on the button, in the headline's own box.
    const lit = over && cfg.glow === 'on' && !!cfg.title;
    glow.classList.toggle('is-on', lit);
    if (lit) {
      const b = title.getBoundingClientRect();
      // The title's box is scaled by nothing but may be blurred/faded; its
      // rect is in screen pixels, like the pointer.
      glow.style.setProperty('--gx', `${(pointer.x - b.left).toFixed(1)}px`);
      glow.style.setProperty('--gy', `${(pointer.y - b.top).toFixed(1)}px`);
    }
  }
  const onMove = (e) => {
    const was = pointer.in ? { x: pointer.x, y: pointer.y } : null;
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.in = e.pointerType !== 'touch';
    paintPlay();
    alive(was);
  };

  /* ---------- the button, alive ----------
     Like Platform verticals' square cursor, it answers the pointer's motion:
     it tilts in 3D towards where it's going, sways round a little with
     sideways movement, and stretches along its path. A spring follows the
     pointer's speed, so it leans in as you move, overshoots a touch, and
     settles back flat when you stop. Its position is still exactly the
     pointer's; only the button itself moves. Runs only while there's motion
     to settle; off for reduced motion. */
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const spring = { vx: 0, vy: 0, dx: 0, dy: 0, px: 0, py: 0, last: 0, raf: 0 };
  // `from`: where the pointer was before this move, so the first frame
  // already sees the motion that woke it.
  function alive(from) {
    if (spring.raf || cfg.playAlive !== 'on' || reduced.matches) return;
    spring.px = from ? from.x : pointer.x; spring.py = from ? from.y : pointer.y;
    spring.last = performance.now();
    spring.raf = requestAnimationFrame(springStep);
  }
  function springStep(now) {
    spring.raf = 0;
    const dt = Math.min(0.05, Math.max(1e-3, (now - spring.last) / 1000));
    spring.last = now;
    // The pointer's speed this frame (px/s), as a share of the speed that
    // gives the full effect, kept to length 1 (direction is kept).
    let nx = (pointer.x - spring.px) / dt / cfg.playSpeed, ny = (pointer.y - spring.py) / dt / cfg.playSpeed;
    spring.px = pointer.x; spring.py = pointer.y;
    const n = Math.hypot(nx, ny);
    if (n > 1) { nx /= n; ny /= n; }
    // A damped spring towards it: `playResponse` is how quickly, `playWobble`
    // how much it overshoots on the way (0 = none).
    const k = cfg.playResponse * cfg.playResponse;
    const c = 2 * cfg.playResponse * (1 - Math.min(0.95, cfg.playWobble));
    spring.dx += (k * (nx - spring.vx) - c * spring.dx) * dt;
    spring.dy += (k * (ny - spring.vy) - c * spring.dy) * dt;
    spring.vx += spring.dx * dt;
    spring.vy += spring.dy * dt;
    paintTilt();
    const moving = Math.abs(spring.vx) + Math.abs(spring.vy) + Math.abs(spring.dx) + Math.abs(spring.dy) > 1e-3 || n > 1e-3;
    if (moving && cfg.playAlive === 'on') spring.raf = requestAnimationFrame(springStep);
    else { Object.assign(spring, { vx: 0, vy: 0, dx: 0, dy: 0 }); paintTilt(); }
  }
  function paintTilt() {
    const { vx, vy } = spring;
    const m = Math.min(1.5, Math.hypot(vx, vy));
    if (m < 1e-4) { tiltEl.style.transform = ''; return; }
    const a = Math.atan2(vy, vx);
    const st = 1 + cfg.playStretch * m;
    // Lean into the direction of travel: its leading edge dips away.
    tiltEl.style.transform = `perspective(${cfg.playSize * 5}px) rotateX(${(-vy * cfg.playTilt).toFixed(2)}deg) rotateY(${(vx * cfg.playTilt).toFixed(2)}deg)`
      + ` rotate(${(vx * cfg.playSpin).toFixed(2)}deg)`
      + ` rotate(${a}rad) scale(${st.toFixed(4)}, ${(1 / st).toFixed(4)}) rotate(${-a}rad)`;
  }
  const onOut = (e) => { if (!e.relatedTarget) { pointer.in = false; paintPlay(); } };
  addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerout', onOut);
  play.addEventListener('focus', () => { focused = play.matches(':focus-visible'); paintPlay(); });
  play.addEventListener('blur', () => { focused = false; paintPlay(); });
  canHover.addEventListener('change', paintPlay);

  /* ---------- scroll hint ----------
     For someone who hasn't scrolled yet: after `hintDelay` s at the top it
     fades in under the hero; the first scroll sends it away for good. */
  let scrolled = false, hintTimer = 0, hintShown = false;
  // While it's up, the wave runs again every `hintRepeat` s — out of the
  // settled colour, through the flash and back — to catch the eye.
  let hintRepeatTimer = 0;
  function repeatHint() {
    clearInterval(hintRepeatTimer);
    hintRepeatTimer = 0;
    if (!hintShown || !(cfg.hintRepeat > 0) || cfg.wave !== 'on') return;
    hintRepeatTimer = setInterval(() => hintWave.replay(cfg.waveTo), cfg.hintRepeat * 1000);
  }
  function showHint(on, instant = false) {
    hintShown = on;
    // The wave starts when the hint does (a top of 0 is always "on screen").
    hintWave.update(on ? 0 : Infinity, 1, cfg);
    repeatHint();
    const d = instant ? 0 : on ? cfg.hintIn : cfg.hintOut;
    hint.style.transition = ['opacity', 'transform', 'filter'].map((k) => `${k} ${d}s ${cfg.hintEase}`).join(', ');
    hint.style.opacity = on ? '1' : '0';
    hint.style.filter = on ? 'blur(0px)' : `blur(${cfg.hintBlur}px)`;
    hint.style.setProperty('--hint-y', on ? '0px' : `${cfg.hintRise}px`);
  }
  function syncHint() {
    if (progress > 0.0005) scrolled = true;
    const want = cfg.hint === 'on' && !scrolled;
    if (!want) { clearTimeout(hintTimer); hintTimer = 0; if (hintShown) showHint(false); return; }
    if (!hintShown && !hintTimer) hintTimer = setTimeout(() => { hintTimer = 0; if (cfg.hint === 'on' && !scrolled) showHint(true); }, cfg.hintDelay * 1000);
  }
  function placeHint() {
    const top = Math.min(geo.hero.y + geo.hero.h + cfg.hintGap, geo.H - cfg.hintLeading - 16);
    hint.style.top = `${top}px`;
  }

  /* The path. Each of centre-x, centre-y, width and height is a monotone
     cubic through its hero, strip and square values, with the strip at
     `geo.knot` of the way along — continuous in value and in speed, and never
     past either neighbour (Fritsch–Carlson). */
  function pathAt(u) {
    const k = geo.knot;
    const at = (key) => monotone(geo.pts.map((q) => q[key]), k, u);
    const cx = at('cx'), cy = at('cy');
    let w, h;
    if (SHAPES[cfg.heroShape]) {
      // A shaped hero (9:16 on phones) eases its shape and its size
      // separately, so it goes straight from portrait to square. Easing width
      // and height on their own would let the taller side shrink first and
      // pass through a wide box on the way.
      const size = at('s'), ratio = Math.exp(at('lr'));
      w = size * Math.sqrt(ratio);
      h = size / Math.sqrt(ratio);
    } else { w = at('w'); h = at('h'); }
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }

  // Where the strip sits along the move: its share of the total change,
  // but leaving at least `squareShare` for the squaring.
  function placeKnot() {
    const c = (r) => ({
      cx: r.x + r.w / 2, cy: r.y + r.h / 2, w: r.w, h: r.h,
      // Size and (log) shape, for a shaped hero (see pathAt).
      s: Math.sqrt(r.w * r.h), lr: Math.log(Math.max(1e-3, r.w) / Math.max(1e-3, r.h)),
    });
    geo.pts = [c(geo.hero), c(geo.inline), c(geo.final)];
    // A shaped hero's slot in the line *is* the square: one move, no strip.
    // (The knot can't be 1 — the second part of the path needs some length.)
    if (SHAPES[cfg.heroShape]) { geo.knot = 0.999; return; }
    const d = (a, b) => Math.hypot(a.cx - b.cx, a.cy - b.cy, a.w - b.w, a.h - b.h);
    const A = d(geo.pts[0], geo.pts[1]), B = d(geo.pts[1], geo.pts[2]);
    const share = A + B > 0 ? A / (A + B) : 0.5;
    geo.knot = Math.min(0.999, 1 - clamp01(cfg.squareShare), Math.max(0.05, share));
  }

  /* ---------- appearance ---------- */

  function applyLook() {
    if (img.getAttribute('src') !== cfg.image) img.src = cfg.image;
    const v = usingVideo() ? heroVideo() : null;
    img.style.display = v ? 'none' : '';
    video.style.display = v ? '' : 'none';
    if (v && video.getAttribute('src') !== v.src) { video.poster = v.poster; video.src = v.src; }
    syncTrail();
    updatePlayback();
    line.style.setProperty('--type-size', `${geo.ts || cfg.typeSize}px`);
    el.style.setProperty('--road-bg', cfg.bg);
    el.style.setProperty('--road-fg', cfg.fg);
    if (titleText.textContent !== cfg.title) { titleText.textContent = cfg.title; glow.textContent = cfg.title; }
    title.style.color = cfg.titleColour;
    title.style.fontSize = cfg.titleSize > 0 ? `${cfg.titleSize}px` : '';
    shade.style.background = cfg.titleShadeColour;
    [badge, cursor].forEach((b) => {
      b.style.setProperty('--play-size', `${cfg.playSize}px`);
      b.style.setProperty('--play-bg', cfg.playColour);
      b.style.setProperty('--play-shadow', cfg.playShadow);
      // Coming in: from `playScaleFrom` and `playFadeFrom` to full, over
      // `playIn`; going out the same way back, over `playOut`.
      b.style.setProperty('--play-in', `${cfg.playIn}s`);
      b.style.setProperty('--play-out', `${cfg.playOut}s`);
      b.style.setProperty('--play-ease', cfg.playEase);
      b.style.setProperty('--play-scale-from', cfg.playScaleFrom);
      b.style.setProperty('--play-fade-from', cfg.playFadeFrom);
    });
    glow.style.setProperty('--glow-colour', cfg.glowMatch === 'custom' ? cfg.glowColour : cfg.playColour);
    glow.style.setProperty('--glow-r', `${cfg.glowRadius}px`);
    glow.style.setProperty('--glow-core', `${Math.round(cfg.glowCore * 100)}%`);
    glow.style.setProperty('--glow-strength', cfg.glowStrength);
    glow.style.setProperty('--glow-in', `${cfg.playIn}s`);
    glow.style.setProperty('--glow-out', `${cfg.playOut}s`);
    glow.style.setProperty('--play-ease', cfg.playEase);
    if (hintTextNow !== cfg.hintText) {
      hintTextNow = cfg.hintText;
      hint.replaceChildren();
      letters(hint, cfg.hintText);   // one span per letter, for the wave
      hintWave.remeasure();
    }
    hint.style.fontSize = `${cfg.hintSize}px`;
    hint.style.lineHeight = `${cfg.hintLeading}px`;
  }

  /* ---------- api ---------- */

  function setConfig(next) {
    const prev = cfg;
    cfg = next;
    trail.setOptions(cfg);
    applyLook();
    if (next.text !== prev.text) build();
    computeGeometry();
    render(progress);
    // A changed wave setting plays it again (if the hint is up).
    hintWave.configure(prev, next);
    hintWave.update(hintShown ? 0 : Infinity, 1, cfg);
    if (next.hintRepeat !== prev.hintRepeat || next.wave !== prev.wave) repeatHint();
    // A new delay restarts the wait; turning it off (or a new look) applies now.
    if (next.hintDelay !== prev.hintDelay) { clearTimeout(hintTimer); hintTimer = 0; }
    if (hintShown) showHint(cfg.hint === 'on' && !scrolled, true);
    syncHint();
  }

  trail.setOptions(cfg);
  applyLook();
  build();
  computeGeometry();
  render(0);
  showHint(false, true);
  if (document.fonts) document.fonts.ready.then(() => { computeGeometry(); render(progress); });

  return {
    seek(p) { progress = p; render(p); syncHint(); },
    setConfig,
    relayout() { computeGeometry(); render(progress); },
    anchor(which) {
      if (which !== 'exit') return null;
      // Reported where the square sits while the stage is stuck (top: 0), not
      // where the stage currently is. Once the beat ends its stage scrolls away
      // carrying the text, but the square is the director's from then on and
      // stays fixed on screen — that is what makes the text scroll out around
      // the image instead of the image riding off with it.
      const box = el.getBoundingClientRect();
      return {
        rect: { x: box.left + geo.final.x, y: geo.final.y, w: geo.final.w, h: geo.final.h },
        src: usingVideo() ? (frozenSrc || heroVideo().poster) : cfg.image,
        ...exitSource(),
        // The colour the square is wearing, for whoever carries it on.
        tint: { colour: cfg.heroColour, opacity: tint },
      };
    },
    maskAnchor(which, on) {
      if (which !== 'exit') return;
      // Leaving for Traffic: freeze on this frame and hand it to the flying tile.
      if (on && usingVideo() && !frozen) captureFrame();
      frozen = on;
      updatePlayback();
      maskedExit = on;
      render(progress);
      // The square changes hands here: drop its echoes, so they don't hang
      // on as a ghost of it at the old place while the tile carries on.
      trail.reset(art);
    },
    trail,
    destroy() {
      reveals.forEach((r) => r.destroy()); io.disconnect(); video.pause(); trail.destroy();
      clearTimeout(hintTimer);
      if (spring.raf) cancelAnimationFrame(spring.raf);
      hintWave.destroy(); clearInterval(hintRepeatTimer);
      removeEventListener('pointermove', onMove); document.removeEventListener('pointerout', onOut);
      canHover.removeEventListener('change', paintPlay);
      el.classList.remove('road'); [art, line, title, play, badge, hint, cursor].forEach((n) => n.remove());
    },
    get config() { return cfg; },
  };
}

/* ---------- helpers ---------- */
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
const smoothstep = (a, b, x) => { const v = clamp01((x - a) / (b - a || 1e-6)); return v * v * (3 - 2 * v); };

/* Monotone cubic through three values at 0, k and 1 (Fritsch–Carlson
   tangents): smooth in value and speed, never overshooting a neighbour. A
   value that doesn't change on one side (the height, strip → square) arrives
   at the middle point with zero speed instead of turning a corner. */
function monotone([v0, v1, v2], k, u) {
  const h0 = k, h1 = 1 - k;
  const d0 = (v1 - v0) / h0, d1 = (v2 - v1) / h1;
  const m1 = d0 * d1 <= 0 ? 0 : (3 * (h0 + h1)) / ((2 * h1 + h0) / d0 + (h1 + 2 * h0) / d1);
  const end = (d, m) => (Math.sign(d) !== Math.sign(m) || d === 0 ? 0 : Math.abs(m) > 3 * Math.abs(d) ? 3 * d : m);
  const m0 = end(d0, (3 * d0 - m1) / 2);
  const m2 = end(d1, (3 * d1 - m1) / 2);
  const herm = (a, b, ma, mb, t, h) => {
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * a + (t3 - 2 * t2 + t) * h * ma + (-2 * t3 + 3 * t2) * b + (t3 - t2) * h * mb;
  };
  return u <= k ? herm(v0, v1, m0, m1, u / h0, h0) : herm(v1, v2, m1, m2, (u - k) / h1, h1);
}
// Hero shapes, width ÷ height. 'fill' (0) takes the whole hero area.
const SHAPES = { fill: 0, '16:9': 16 / 9, '4:5': 4 / 5, '1:1': 1, '9:16': 9 / 16 };

const lerpRect = (a, b, t) => ({
  x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t),
  w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t),
});

export const OPEN_ROAD_DEFAULTS = {
  ...TRAIL_DEFAULTS,
  length: 4,                 // section height in viewport heights
  text: 'This is an ▣ open road.',
  image: 'hero-traffic',     // by name; resolved by the loader (src/assets/hero/)
  heroMedia: 'video',        // 'video' | 'image' — the image is the fallback
  video: 'hero-video',       // by name (src/assets/video/); a same-named .jpg is its poster
  videos: [],                // set by the loader
  typeSize: 92,
  slotW: 3.4,                // the image strip inside the line, in em
  slotH: 1.22,
  textGap: 0.5,              // space between the image and each run, in em.
                             // With the default gutter this is also what pushes
                             // the runs clear of the viewport at the start.
  gutter: 0.03,              // hero side margin, × viewport width
  heroHeight: 0.86,          // hero bottom edge, × viewport height (Fill only)
  heroWidth: 50,             // with a set shape: its width at the start, % of the viewport width
  heroShape: 'fill',         // the hero's shape at the start: 'fill' | '16:9' | '4:5' | '1:1' | '9:16'
  heroColour: '#5b3df5',     // the hero's colour — it carries on through Traffic
  heroColourAmount: 1,       // how fully (0 keeps the picture)
  colourFrom: 0.75,          // the colour comes in from here…
  colourTo: 1,               // …to here, as shares of the move (1 = the finished square)
  colourBlur: 12,            // px the held frame blurs to as the colour comes in
  revealFrom: 0,             // the headline's lines rise in from here…
  revealTo: 0.25,            // …to here (shares of this section's scroll)
  squareShare: 0.08,         // at least this share of the move squares the strip to 1:1
  squareHold: 0.12,          // share of the beat the finished square rests before release
  seamHold: 0,               // share of the gap to Traffic the square waits before
                             // it starts moving (it's released as the text leaves)
  seamEnd: 0.6,              // how far through that gap Traffic draws the hero itself
                             // (the hero's path is the same either way)
  radius: 0,
  bg: '#ffffff',
  fg: '#000000',

  // Headline over the hero (the same type as the line above). It fades,
  // blurs and sinks away between titleFrom and titleTo — shares of this
  // section's scroll, so it follows the scroll both ways.
  title: 'Our story starts here.',
  titleColour: '#ffffff',
  titleSize: 0,              // px; 0 = the same size as the line (it scales with it)
  titleFrom: 0.005,          // starts to go after this much of the section…
  titleTo: 0.05,             // …and is gone by this much
  titleBlur: 6,              // px at the end
  titleRise: 12,             // px it sinks as it goes
  titlePad: 24,              // px kept clear either side inside the hero (it wraps)
  titleShade: 0.2,           // darkening over the picture while the headline is up
  titleShadeColour: '#000000',

  // Play: the cursor over the hero (a button under the headline on touch)
  play: 'on',
  playUntil: 0.05,           // share of the section it stays clickable for
  playSize: 72,              // px (Figma: Icon Button, 72)
  playColour: '#AC74FC',
  playShadow: '#4A6B3C',     // its 2px drop shadow
  playGap: 40,               // px from the headline to the badge (touch)
  // How it comes in and goes out (entering and leaving the hero; on touch,
  // appearing and going as the scroll passes playUntil)
  playIn: 0.35,              // s, scaling up and fading in
  playOut: 0.25,             // s, scaling down and fading out
  playScaleFrom: 0.4,        // its size when out, × full
  playFadeFrom: 0,           // its opacity when out
  playEase: 'cubic-bezier(0.22, 1, 0.36, 1)',
  // Alive: it tilts, sways and stretches with the pointer's motion, on a spring
  playAlive: 'on',
  playTilt: 22,              // deg it leans towards its direction of travel, at full speed
  playSpin: 14,              // deg it sways round with sideways movement, at full speed
  playStretch: 0.12,         // how much it stretches along its path, at full speed
  playSpeed: 1800,           // px/s of pointer movement that gives the full effect
  playResponse: 14,          // how quickly it answers (higher = snappier)
  playWobble: 0.45,          // how much it overshoots as it settles (0 = none)
  // The glow it casts on the headline (the letters only, never the picture)
  glow: 'on',
  glowMatch: 'button',       // 'button' = the play button's colour | 'custom'
  glowColour: '#AC74FC',
  glowRadius: 260,           // px, how far the light reaches
  glowCore: 0.1,             // share of that radius at full strength, before it falls off
  glowStrength: 0.9,         // 0–1

  // The full film (film.js): '' plays the hero video
  film: '',
  films: [],                 // set by the loader (src/assets/film/)
  filmIdle: 2,               // s the mouse is still before the close button fades away
  filmFade: 0.3,             // s the film fades in and out
  filmBg: '#000000',

  // Scroll hint, for someone who hasn't scrolled yet
  hint: 'on',
  hintText: 'Scroll to begin the journey.',
  hintDelay: 10,             // s at the top, unscrolled, before it shows
  hintGap: 33,               // px below the hero
  hintSize: 14,
  hintLeading: 20,
  hintIn: 0.3,               // s fading in (like Platform verticals' statistics)
  hintOut: 0.18,             // s fading out
  hintRise: 12,              // px it rises as it comes in
  hintBlur: 6,               // px it comes into focus from
  hintEase: 'cubic-bezier(0.22, 1, 0.36, 1)',
  // …and as it comes in, its colour wave (colorWave.js, as on "Start small"):
  // it arrives purple and settles to black, letter by letter.
  hintRepeat: 5,             // s between flashes while it's up (0 = just the once)
  ...WAVE_DEFAULTS,
  waveFrom: '#AC74FC',
  waveColour: '#AC74FC',
  waveTo: '#000000',
  waveDuration: 0.9,
  waveSpread: 0.6,
};

/* Phone starting values (below 768 px wide), applied over the desktop ones.
   Edit them in the inspector's Mobile mode. The headline is sized so
   "This is an ▣ open road." fits across a 375–430 px screen. */
export const OPEN_ROAD_MOBILE = {
  typeSize: 30,
  textGap: 0.4,
  gutter: 0.05,
  // Starts as a 9:16 portrait, centred in the screen under the nav, and
  // closes straight to the 1:1 square (a shaped hero has no strip).
  heroShape: '9:16',
  heroWidth: 68,
  trail: 'off',
  titlePad: 16,
  titleSize: 40,             // the line's 56 would wrap to four lines in the portrait hero
  playSize: 64,
  playGap: 24,
};

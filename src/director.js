/* The director — it owns all scroll, and it owns the seams between beats.
   Beats never listen to scroll themselves. Each one is a pure function of a
   single progress number, and the director is the only thing that supplies it:

     createBeat(el, config, deps) -> {
       seek(p),              // p 0..1 — pure and reversible
       setConfig(next),
       relayout(),
       destroy(),
       anchor(which),        // optional: 'entry' | 'exit' -> { rect, src } | null
       maskAnchor(which, on) // optional: hide that element so we can fly it
     }

   Pinning is `position: sticky`, not ScrollTrigger's `pin`. A beat's section is
   `length` viewport heights tall; its stage sticks for the middle of that, which
   is exactly the range `top top -> bottom bottom`. No pin-spacers means the
   overlapping handoffs below are a matter of reading two rects, not fighting
   three pinned elements for the same space. */

export function createDirector({ root, handoffLayer, beats, deps }) {
  const { gsap, ScrollTrigger } = deps;

  const mounted = [];   // [{ def, api, section, stage, trigger }]
  const seams = [];     // [{ from, to, el, img, trigger }]

  /* ---------- mount ---------- */

  beats.forEach((def) => {
    const section = document.createElement('section');
    section.className = 'beat';
    section.dataset.beat = def.id;
    section.style.setProperty('--len', def.length);
    // `join`: this section overlaps the previous one's last screen, so its stage
    // sticks the moment the previous stage would start scrolling away, and
    // covers it. The two beats meet on one frame instead of sliding past each
    // other — for when the next beat has to continue *exactly* where the last
    // one stopped. The joined beat is handed the previous beat's api (`join`).
    if (def.join) section.classList.add('beat--join');

    const stage = document.createElement('div');
    stage.className = 'beat__stage';
    section.appendChild(stage);
    root.appendChild(section);

    const api = def.create(stage, def.config, deps);
    const entry = { def, api, section, stage, trigger: null };

    // `lead` starts a beat's progress a viewport early — the moment the previous
    // stage unsticks, rather than when this one sticks. The beat then plays
    // through its own slide-in, so by the time the seam delivers a tile the beat
    // is already running and the tile joins something in motion instead of
    // starting it.
    // A joined beat's section is pulled up over the previous beat's last
    // screen, which means that until it locks it's sitting in the page flow
    // *below* the previous stage — sliding up over it, covering whatever that
    // beat is still doing, and carrying its own content in from the bottom.
    // So it stays invisible until the exact scroll position where it locks,
    // which is also the frame both beats agree on. Past its end (the bottom of
    // the page) it stays shown.
    const showJoined = (self) => {
      if (!def.join) return;
      stage.style.visibility = self.isActive || self.progress >= 1 ? '' : 'hidden';
    };
    if (def.join) stage.style.visibility = 'hidden';

    entry.trigger = ScrollTrigger.create({
      trigger: section,
      start: def.lead ? 'top bottom' : 'top top',
      end: 'bottom bottom',
      invalidateOnRefresh: true,
      onUpdate: (self) => api.seek(self.progress),
      onToggle: showJoined,
      onRefresh: showJoined,
    });

    // A beat offscreen is a beat not painting. Beat 2 can run 140 tiles and
    // Beat 3 runs a canvas per inline image, so anything well out of range is
    // parked. The margin is deliberately a whole viewport either side: during a
    // seam the outgoing beat is already past its own trigger but still visible,
    // and parking it there would make the stage it is handing over blink out.
    entry.park = ScrollTrigger.create({
      trigger: section,
      start: 'top bottom+=100%',
      end: 'bottom top-=100%',
      invalidateOnRefresh: true,
      onToggle: (self) => stage.classList.toggle('is-parked', !self.isActive),
    });

    syncLength(entry);
    api.seek(0);
    mounted.push(entry);
  });

  mounted.forEach((m, i) => {
    if (!m.def.join || i === 0) return;
    m.api.join?.(mounted[i - 1].api);
    mounted[i - 1].api.joinedBy?.(m.api);
  });

  /* ---------- seams ----------
     A seam is the gap between beat N unsticking and beat N+1 sticking. Across it
     the director hides beat N's exit element and beat N+1's entry element, and
     flies a single tile between the two rects. One object, handed over — not two
     objects crossfading in the same place. */

  for (let i = 0; i < mounted.length - 1; i++) {
    const from = mounted[i];
    const to = mounted[i + 1];
    if (from.def.seam === false) continue;

    const el = document.createElement('div');
    el.className = 'seam';
    const img = document.createElement('img');
    img.decoding = 'async';
    el.appendChild(img);
    // A second image so the tile can change picture mid-flight without a pop.
    const img2 = document.createElement('img');
    img2.decoding = 'async';
    img2.className = 'seam__to';
    el.appendChild(img2);
    handoffLayer.appendChild(el);
    // The flying tile is the outgoing beat's image, so it trails with that beat's settings.
    from.api.trail?.add(el);

    const seam = { from, to, el, img, img2, trigger: null, active: false };

    // Exactly the window between the two beats: `bottom bottom` is the scroll
    // position where the outgoing beat reaches p=1 and its stage stops sticking;
    // `bottom top` is where the incoming beat's stage starts sticking at p=0.
    // In between, the old stage slides up and out and the new one slides in —
    // and because anchors are read live from getBoundingClientRect(), the flying
    // tile rides both stages as they move. No extra scroll is invented for the
    // transition; we just paint the gap that was always there.
    seam.trigger = ScrollTrigger.create({
      trigger: from.section,
      start: 'bottom bottom',
      // `seamEnd` (0..1 of the gap) lets the handoff finish before the next
      // stage has fully arrived. The incoming beat is already running (`lead`),
      // so its tile can take over mid-slide and simply keep going.
      end: () => `bottom ${window.innerHeight * (1 - seamOpt(from, 'seamEnd', 1))}px`,
      invalidateOnRefresh: true,
      onUpdate: (self) => renderSeam(seam, self.progress),
      onToggle: (self) => setSeamActive(seam, self.isActive),
    });

    seams.push(seam);
  }

  /* What the incoming beat's own progress will be once this handoff finishes.
     A beat that is already in motion needs this to pick a sensible target: the
     thing the tile becomes should be where the flow actually is at the moment
     it merges, not where that flow happened to start. */
  function seamCtx(seam) {
    const to = seam.to.trigger;
    // ScrollTrigger.create runs one update before it returns, so the first call
    // lands here while `seam.trigger` is still unassigned. Null means "no idea
    // yet" and beats fall back to their own guess; the next update corrects it.
    if (!seam.trigger || !to) return { pAtEnd: null };
    const span = to.end - to.start;
    // Where the incoming stage's top edge will be on screen when the handoff
    // finishes. Until it sticks, a stage's viewport top is simply its section's
    // page offset minus the scroll position.
    const sectionTop = seam.to.section.getBoundingClientRect().top + window.scrollY;
    return {
      pAtEnd: span > 0 ? clamp01((seam.trigger.end - to.start) / span) : null,
      stageTopAtEnd: sectionTop - seam.trigger.end,
    };
  }

  // The context an incoming beat needs to choose its target: when the handoff
  // lands, where its stage will be, and where the tile is coming from.
  function entryCtx(seam) {
    const ctx = seamCtx(seam);
    const a = seam.from.api.anchor?.('exit', ctx);
    if (a) ctx.from = clampRect(a.rect);
    return ctx;
  }

  function setSeamActive(seam, on) {
    seam.active = on;
    seam.el.classList.toggle('is-on', on);
    // Prime the target before masking, so the beat hides the tile it actually
    // hands over rather than whichever one it would have guessed.
    if (on) seam.to.api.anchor?.('entry', entryCtx(seam));
    seam.from.api.maskAnchor?.('exit', on);
    seam.to.api.maskAnchor?.('entry', on);
    if (!on) seam.el.style.opacity = '';
    // Masking can change what the outgoing beat hands over (Open road freezes
    // its video and captures that frame), so draw the tile again now, with the
    // picture as it is from this moment — not as it was a moment ago.
    else if (seam.trigger) renderSeam(seam, seam.trigger.progress);
  }

  /* Both endpoints can sit outside the viewport: Beat 2's stream converges to a
     point just past the left edge, and Beat 3's first image slot is still below
     the fold when its stage begins sliding in. Flying between two invisible
     points means an empty screen for a whole viewport of scroll — and during a
     seam this tile is the only thing on screen, so that reads as a dead gap.

     Clamping the endpoints into view fixes it, and it is safe precisely because
     it is the identity inside the viewport: the flown tile can only disagree
     with a beat's own tile at a position where that tile is off-screen anyway.
     The tile arrives at the edge the stream left by, and leaves at the edge the
     type is about to rise through. */
  function clampRect(r) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      x: Math.min(Math.max(r.x, 0), Math.max(0, vw - r.w)),
      y: Math.min(Math.max(r.y, 0), Math.max(0, vh - r.h)),
      w: r.w, h: r.h,
    };
  }

  function renderSeam(seam, p) {
    const ctx = entryCtx(seam);
    const a = seam.from.api.anchor?.('exit', ctx);
    const b = seam.to.api.anchor?.('entry', ctx);
    if (!a || !b) { seam.el.style.opacity = '0'; return; }

    const ar = clampRect(a.rect);
    const br = clampRect(b.rect);

    // `seamHold` keeps the tile exactly where the outgoing beat left it while
    // the page scrolls the old beat away around it; only then does it move.
    const hold = seamOpt(seam.from, 'seamHold', 0);
    const q = hold >= 1 ? 0 : clamp01((p - hold) / (1 - hold));
    const ts = q < 0.5 ? 2 * q * q : 1 - 2 * (1 - q) * (1 - q);

    // The flight is one-directional on each axis: it may only go *down* and
    // only go *left*, like something dropped into water moving right to left.
    // The incoming beat reports its target's *landing* position (where it will
    // be when the handoff completes), chosen to be below and left of the start,
    // so a straight ease between two fixed points is already monotonic. The
    // clamps are a guard for any beat that reports a live position instead.
    //
    // Interpolate centres, not corners: the two ends can differ slightly in
    // size, and a straight drop has to be straight through the middle.
    const acx = ar.x + ar.w / 2, acy = ar.y + ar.h / 2;
    const bcx = br.x + br.w / 2, bcy = br.y + br.h / 2;
    const tx = ts * ts;                         // drop first, drift left late
    const cx = acx + Math.min(0, bcx - acx) * tx;
    const cy = acy + Math.max(0, bcy - acy) * ts;
    const w = ar.w + (br.w - ar.w) * ts;
    const h = ar.h + (br.h - ar.h) * ts;
    const x = cx - w / 2;
    const y = cy - h / 2;

    if (seam.img.getAttribute('src') !== a.src) seam.img.src = a.src;
    if (seam.img2.getAttribute('src') !== b.src) seam.img2.src = b.src;

    seam.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    seam.el.style.width = w + 'px';
    seam.el.style.height = h + 'px';
    seam.el.style.opacity = '1';
    // Cross-dissolve the picture only through the middle of the flight, so the
    // tile reads as one object changing its mind rather than two tiles swapping.
    seam.img2.style.opacity = String(clamp01((ts - 0.3) / 0.4));
  }

  /* A beat can size its own section by exposing `naturalLength()` — Big scroll
     does, so its type travels 1:1 with the page. Returns true if it changed. */
  function syncLength(m) {
    if (!m.api.naturalLength) return false;
    const len = m.api.naturalLength();
    if (!(len > 0) || Math.abs(len - +m.section.style.getPropertyValue('--len')) < 0.001) return false;
    m.section.style.setProperty('--len', len);
    return true;
  }

  /* ---------- api ---------- */

  const byId = (id) => mounted.find((m) => m.def.id === id);

  function relayout() {
    mounted.forEach((m) => { m.api.relayout?.(); syncLength(m); });
    seams.forEach((s) => renderSeam(s, s.trigger.progress));
    ScrollTrigger.refresh();
  }

  function setConfig(id, next) {
    const m = byId(id);
    if (!m) return;
    m.def.config = next;
    m.api.setConfig?.(next);
    let lenChanged = false;
    if (m.api.naturalLength) lenChanged = syncLength(m);
    else if (next.length != null && next.length !== +m.section.style.getPropertyValue('--len')) {
      m.section.style.setProperty('--len', next.length);
      lenChanged = true;
    }
    if (lenChanged || next.seamEnd !== m.__seamEnd) {
      m.__seamEnd = next.seamEnd;
      ScrollTrigger.refresh();
    }
  }

  function scrollToBeat(id) {
    const m = byId(id);
    if (m) window.scrollTo({ top: m.section.offsetTop + 1, behavior: 'smooth' });
  }

  function destroy() {
    seams.forEach((s) => { s.trigger.kill(); s.el.remove(); });
    mounted.forEach((m) => { m.trigger.kill(); m.park.kill(); m.api.destroy?.(); m.section.remove(); });
  }

  window.addEventListener('resize', debounce(relayout, 150));

  return { beats: mounted, relayout, setConfig, scrollToBeat, destroy, byId };
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// Seam settings live on the outgoing beat's config so they're editable in the
// inspector alongside the rest of that beat; the beat definition is a fallback.
const seamOpt = (m, key, dflt) => m.def.config?.[key] ?? m.def[key] ?? dflt;

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

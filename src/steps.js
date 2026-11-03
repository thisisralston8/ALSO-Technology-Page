/* Stepped scrolling through the platform's three layers.

   Between the Hardware stop and the Autonomy stop the page doesn't scroll
   freely: one scroll gesture — a wheel or trackpad flick, or a swipe — moves
   one layer, Hardware → Software → Autonomy, with a timed move between them,
   so the camera and the text never rest half way. Scrolling down past
   Autonomy, or up past Hardware, lets go, and the page scrolls freely again
   (into the dot at the end, or back to the intro).

   Page chrome, like the nav and the modal: the platform beat is still a pure
   function of its progress — this only decides where the page scrolls to.
   It hooks Lenis's `virtualScroll`, so while it holds a layer the gesture
   never reaches Lenis (or the browser, on touch); the moves are
   `lenis.scrollTo`. The stops are the platform's own (`api.stopAt`), read
   fresh each time, so they follow any change to its timing. */

export function createSteps({ gsap, lenis, director, getConfig }) {
  let held = false;      // holding the page at a layer
  let moving = false;    // a step's move is playing
  let armed = true;      // ready for the next gesture (see `quiet`)
  let quietTimer = 0;
  let touchSum = 0, touchUsed = false;
  let lastY = lenis.scroll;

  const cfg = () => getConfig();
  const on = () => cfg().steps === 'on' && !document.documentElement.classList.contains('xm-open');

  // The three stops, in page scroll positions.
  function stops() {
    const m = director.byId('platform');
    if (!m?.trigger || !m.api.stopAt) return null;
    const { start, end } = m.trigger;
    return [1, 2, 3].map((n) => start + (end - start) * m.api.stopAt(n));
  }
  const nearest = (ys, y) => ys.reduce((b, v, i) => (Math.abs(v - y) < Math.abs(ys[b] - y) ? i : b), 0);

  function moveTo(y) {
    const c = cfg();
    moving = true;
    armed = false;
    lenis.scrollTo(y, {
      duration: c.stepDuration,
      easing: gsap.parseEase(c.stepEase),
      force: true,
      lock: true,
      // Ready again once the wheel has rested (a flick may still be gliding).
      onComplete: () => { moving = false; quiet(); },
    });
  }

  function hold(y) { held = true; moveTo(y); }

  function step(dir) {
    const ys = stops();
    if (!ys) return;
    const i = nearest(ys, lenis.scroll);
    const j = i + dir;
    if (j < 0 || j >= ys.length) {
      // Past either end: let go. The rest of this gesture scrolls the page.
      held = false;
      armed = true;
      return;
    }
    moveTo(ys[j]);
  }

  /* A trackpad flick keeps sending wheel events (its inertia) for a second
     or more after a step starts; they mustn't count as more steps. A new
     step needs a pause in the wheel events first. */
  function quiet() {
    clearTimeout(quietTimer);
    quietTimer = setTimeout(() => { if (!moving) armed = true; }, cfg().stepQuiet * 1000);
  }

  lenis.options.virtualScroll = ({ deltaY, event }) => {
    if (!held || !on()) return true;
    if (event.cancelable) event.preventDefault();
    const isTouch = event.type.startsWith('touch');
    if (isTouch) {
      // One step per swipe.
      if (event.type === 'touchstart') { touchSum = 0; touchUsed = false; return false; }
      if (event.type === 'touchend') return false;
      touchSum += deltaY;
      if (!touchUsed && !moving && Math.abs(touchSum) > 30) {
        touchUsed = true;
        step(Math.sign(touchSum));
        if (!held) return true;
      }
      return false;
    }
    quiet();
    if (!armed || moving || !deltaY) return false;
    step(Math.sign(deltaY));
    // Let go: this event scrolls the page on as usual.
    return !held;
  };

  // Free scrolling into the layers catches at the first layer you reach:
  // Hardware coming down, Autonomy coming back up.
  lenis.on('scroll', ({ scroll }) => {
    const prev = lastY;
    lastY = scroll;
    if (!on()) return;
    const ys = stops();
    if (!ys) return;
    const [a, , c] = ys;
    // Holding, but the page has been moved off the layers some other way (a
    // jump from the panel's section picker, say): let go.
    if (held) {
      if (!moving && (scroll < a - 2 || scroll > c + 2)) { held = false; armed = true; }
      return;
    }
    if (prev < a && scroll >= a && scroll < c) hold(a);
    else if (prev > c && scroll <= c && scroll > a) hold(c);
    // Already among the layers without holding (after the modal moved the
    // page, a reload, the panel's section picker): hold at the next stop in
    // the direction you're scrolling.
    else if (prev >= a - 1 && prev <= c + 1 && scroll > a + 1 && scroll < c - 1 && !moving) {
      const down = scroll > prev;
      hold(down ? ys.find((v) => v >= scroll) : [...ys].reverse().find((v) => v <= scroll));
    }
  });

  // For checking by hand: __page.steps.state
  return { get state() { return { held, moving, armed }; } };
}

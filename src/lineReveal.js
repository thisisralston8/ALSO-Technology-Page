/* Responsive line reveal — GSAP's "responsive line splits on scroll" demo
   (demos.gsap.com/demo/responsive-line-splits-on-scroll), fitted to this page.

   Same building blocks as the demo: SplitText splits a text into lines, each
   line wrapped in a mask (`mask: "lines"`), with `autoSplit: true` so the lines
   are re-worked out whenever the text's width changes or the fonts load; and
   `onSplit` returns a `gsap.from(lines, { yPercent, stagger })` tween, which
   SplitText reverts and re-creates (keeping its place) on every re-split.

   The one difference: the demo scrubs that tween with a ScrollTrigger. Here
   the text lives in pinned sections that move it themselves (Traffic's page,
   the platform's timeline), where a ScrollTrigger would measure the wrong
   place — and beats never listen to scroll anyway (see AGENTS.md). So the
   tween is paused, and each beat scrubs it with `set(progress)` from where
   the text actually is on screen (or where it is in its own timeline). Same
   result as `scrub: true`, measured correctly.

   Two modes (Page → Line reveal → Mode). *Play* (the default): reaching the
   trigger point starts the reveal, which plays through over `revealDuration`
   and then stays — scroll back and the text is still there. That's GSAP time,
   like the grain and the trail; the trigger is still a pure function of
   scroll. *Scrub*: the reveal follows the scroll both ways, like the demo.

   One set of options for the whole page (the Page section of the inspector);
   every reveal rebuilds when they change. */

import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

export const REVEAL_DEFAULTS = {
  reveal: 'on',            // 'on' | 'off'
  revealMode: 'play',      // 'play': plays the whole reveal once it's triggered, then stays revealed
                           // 'scrub': follows the scroll, both ways
  revealDuration: 1.1,     // seconds for one line, in 'play'
  revealDistance: 120,     // % of a line's height each line rises from
  revealStagger: 0.1,      // delay between lines, × one line's reveal
  revealEase: 'power3.out',
  revealFade: 'off',       // also fade each line in: 'on' | 'off'
  revealMask: 'on',        // lines rise from behind their own edge: 'on' | 'off'
  revealStart: 1,          // scrolled text starts revealing when its top is here (× screen height; 1 = bottom edge)…
  revealEnd: 0.6,          // …and is fully revealed when its top is here
};

let opts = { ...REVEAL_DEFAULTS };
const all = new Set();

export const revealOptions = () => opts;

export function setRevealOptions(next) {
  const changed = Object.keys(REVEAL_DEFAULTS).some((k) => next[k] !== opts[k]);
  opts = { ...REVEAL_DEFAULTS, ...next };
  if (changed) all.forEach((r) => r.rebuild());
}

// Progress (0–1) for text whose top is at `top` px on a screen `H` tall:
// 0 at `revealStart`, 1 at `revealEnd`, eased by the tween itself.
export function revealAtTop(top, H) {
  const a = opts.revealStart * H, b = opts.revealEnd * H;
  if (Math.abs(a - b) < 1) return top <= b ? 1 : 0;
  return Math.min(1, Math.max(0, (a - top) / (a - b)));
}

/* One reveal on one element. The beat that owns the element calls:
     unsplit()     before it changes the element's text or measures layout
     split()       after (re-splits into lines, at the current progress)
     set(p)        every frame, 0 hidden … 1 fully revealed               */
export function createLineReveal(el) {
  let split = null;
  let anim = null;
  let p = 1;
  // Text that isn't laid out yet (its section is parked off screen) can't be
  // split into lines; it's split on the first frame it is.
  let pending = false;
  // In 'play' mode: once triggered, the reveal plays through on its own and
  // the text stays revealed from then on — scrolling back doesn't hide it.
  let played = false;
  // Where the reveal had got to when it was last unsplit, so a fresh split
  // carries on rather than starting over.
  let at = 0;
  const laidOut = () => el.isConnected && el.getClientRects().length > 0 && el.offsetWidth > 0;

  function unsplit() {
    if (anim) at = anim.progress();
    anim?.revert();
    if (split) { split.revert(); split = null; }
    anim = null;
  }

  function doSplit() {
    unsplit();
    pending = false;
    if (opts.reveal !== 'on' || !el.isConnected || !el.textContent.trim()) return;
    if (!laidOut()) { pending = true; return; }
    split = SplitText.create(el, {
      type: 'lines',
      mask: opts.revealMask === 'on' ? 'lines' : undefined,
      linesClass: 'rv-line',
      autoSplit: true,
      onSplit(self) {
        // A re-split (the width changed, or any font finished loading — the
        // nav's loads the first time the nav shows) can land mid-reveal.
        // Pick up where the old tween was and keep playing. The tween isn't
        // returned to SplitText: it would copy the old tween's time onto this
        // one after we'd set it, leaving it paused partway and the line stuck
        // half behind its mask.
        const was = anim ? anim.progress() : at;
        anim?.revert();
        anim = gsap.from(self.lines, {
          yPercent: opts.revealDistance,
          opacity: opts.revealFade === 'on' ? 0 : 1,
          stagger: opts.revealStagger,
          duration: 1,
          ease: opts.revealEase,
          paused: true,
        });
        if (opts.revealMode === 'play') {
          anim.timeScale(1 / Math.max(0.05, opts.revealDuration));
          // Triggered already: carry on from where it was (done stays done).
          if (played) anim.progress(was).play();
        } else anim.progress(p);
      },
    });
  }

  const self = {
    unsplit,
    split: doSplit,
    rebuild() { doSplit(); },
    /* Scrub: progress follows the scroll. Play: any progress above 0 is
       the trigger — the reveal plays once, then stays. */
    set(progress) {
      p = Math.min(1, Math.max(0, progress));
      if (pending && laidOut()) doSplit();
      if (opts.revealMode === 'play') {
        if (!played && p > 0) { played = true; anim?.play(); }
        return;
      }
      if (anim) anim.progress(p);
    },
    get played() { return played; },
    destroy() { unsplit(); all.delete(self); },
  };
  all.add(self);
  return self;
}

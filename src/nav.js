/* The site header's two looks (style.css "nav"), as on ridealso.com: clear at
   the top of the page; tucked away while you scroll down; back as a white
   card as soon as you scroll up. Page chrome, not a beat: it reads Lenis's
   scroll and never affects layout. */

const TOP = 40;      // px: within this of the top, the clear look
const SLACK = 6;     // px of travel before a change of direction counts

export function createNav(el, lenis) {
  if (!el) return;
  let last = 0;
  let dir = 0;   // travel since the last change of direction (signed)
  const set = (peek, hidden) => {
    el.classList.toggle('is-peek', peek);
    el.classList.toggle('is-hidden', hidden);
  };
  function update(y) {
    const dy = y - last;
    last = y;
    if (y <= TOP) return set(false, false);
    dir = Math.sign(dy) === Math.sign(dir) ? dir + dy : dy;
    if (dir > SLACK) set(el.classList.contains('is-peek'), true);
    else if (dir < -SLACK) set(true, false);
  }
  lenis.on('scroll', ({ scroll }) => update(scroll));
  update(lenis.scroll || scrollY);
  // Keyboard users tabbing into it should always see it.
  // Placeholders: the prototype has no other pages.
  el.querySelectorAll('a[href="#"]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));
  el.addEventListener('focusin', () => set(last > TOP, false));
}

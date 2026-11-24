/* The full film: Open road's play button opens it over the whole window.

   Page chrome, like the explore modal: the beat only dispatches `road:film`;
   page.js opens this. It plays the film with sound and the browser's own
   controls, stops the page's scrolling while it's open, and closes with its
   close button, Escape, or when the film ends.

   The close button (Figma: Icon Button / Close) is there while the mouse is
   moving and fades away once it has been still for `filmIdle` seconds, so it
   never sits over the picture; any movement, a tap or a key brings it back. */

import closeIcon from './assets/ui/film-close.svg';

export function createFilm({ lenis }) {
  const root = document.createElement('div');
  root.className = 'film';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Film');

  const video = document.createElement('video');
  video.className = 'film__video';
  Object.assign(video, { controls: true, playsInline: true, preload: 'auto' });
  video.setAttribute('playsinline', '');

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'film__close';
  close.setAttribute('aria-label', 'Close the film');
  close.innerHTML = `<img src="${closeIcon}" alt="" width="24" height="24">`;

  root.append(video, close);
  document.body.appendChild(root);

  let cfg = {};
  let idle = 0;
  let back = null;     // what had focus, to return it on close

  // The close button: in on activity, out after `filmIdle` s of stillness.
  function wake() {
    root.classList.add('is-awake');
    clearTimeout(idle);
    idle = setTimeout(() => {
      // Kept while it has keyboard focus, so it can't vanish under a Tab.
      if (!close.matches(':focus-visible')) root.classList.remove('is-awake');
    }, (cfg.filmIdle ?? 2) * 1000);
  }
  ['pointermove', 'pointerdown', 'touchstart', 'keydown'].forEach((t) => root.addEventListener(t, wake, { passive: true }));

  function open({ src, poster = '', config = {} }) {
    if (!src) return;
    cfg = config;
    root.style.setProperty('--film-bg', cfg.filmBg || '#000');
    root.style.setProperty('--film-fade', `${cfg.filmFade ?? 0.3}s`);
    back = document.activeElement;
    if (video.getAttribute('src') !== src) { video.src = src; video.poster = poster; }
    video.currentTime = 0;
    video.muted = false;
    root.hidden = false;
    document.documentElement.classList.add('film-open');
    lenis?.stop();
    // Shown, then faded in, so the transition has a start.
    requestAnimationFrame(() => root.classList.add('is-open'));
    video.play().catch(() => {});   // a click opened it, so sound is allowed
    wake();
    close.focus({ preventScroll: true });
  }

  function shut() {
    if (root.hidden) return;
    video.pause();
    root.classList.remove('is-open', 'is-awake');
    clearTimeout(idle);
    document.documentElement.classList.remove('film-open');
    lenis?.start();
    const done = () => { root.hidden = true; };
    const ms = (cfg.filmFade ?? 0.3) * 1000;
    if (ms > 0) setTimeout(done, ms); else done();
    back?.focus?.({ preventScroll: true });
  }

  close.addEventListener('click', shut);
  video.addEventListener('ended', shut);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !root.hidden) shut(); });
  // Focus stays inside: the controls and the close button.
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = [video, close];
    const k = items.indexOf(document.activeElement);
    e.preventDefault();
    items[(k + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
  });

  return { open, close: shut, get isOpen() { return !root.hidden; } };
}

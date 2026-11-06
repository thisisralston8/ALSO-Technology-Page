/* Colour wave: a text fades letter by letter from one colour, through a
   second, to a third — a wave through the text in reading order.

   Like the line reveal's *Play once* it's a transition on time, not scroll
   (a deliberate exception, see AGENTS.md): the scroll only decides *when* it
   starts — the first time the text's top passes `waveTrigger` on screen —
   and then it plays through once and stays. Changing a wave setting plays it
   again, so it can be dialled in.

   A beat that wants one:
     letters(el, text)        build the text as one span per letter
     const w = createColorWave(el)
     w.remeasure()            after the text is rebuilt or re-split
     w.update(top, H, cfg)    every frame: the text's top on screen (px), or
                              Infinity while it can't be seen yet
     w.configure(prev, next)  in setConfig, to replay on a changed setting
   Settings are the `wave*` keys of the beat's own config (WAVE_DEFAULTS). */

export const WAVE_DEFAULTS = {
  wave: 'on',              // 'on' | 'off'
  waveFrom: '#e6e6e6',     // each letter starts this colour…
  waveColour: '#ac74fc',   // …passes through this one…
  waveTo: '#000000',       // …and settles on this
  waveTrigger: 0.85,       // starts when the text's top is this far down the screen (× screen height; 1 = bottom edge)
  waveDelay: 0,            // s after the trigger before the first letter starts
  waveDuration: 0.9,       // s one letter takes to go from start to end colour
  waveSpread: 0.8,         // s from the first letter starting to the last
  wavePeak: 0.4,           // where in a letter's change it's fully the middle colour (0–1)
  waveRandom: 0,           // s of random extra delay per letter
  waveDirection: 'ltr',    // 'ltr' | 'rtl' | 'centre' (out from the middle) | 'edges' (in from both ends)
  waveEase: 'smooth',      // 'linear' | 'smooth' | 'soft' | 'snappy'
};
export const WAVE_KEYS = Object.keys(WAVE_DEFAULTS);

const frac = (x) => x - Math.floor(x);
const rnd = (i, k) => frac(Math.sin(i * 127.1 + k * 311.7) * 43758.5453);
const hexRgb = (h) => {
  let x = String(h || '#000').replace('#', '');
  if (x.length === 3) x = x.split('').map((c) => c + c).join('');
  const n = parseInt(x.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mixRgb = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
const EASE = {
  linear: (t) => t,
  smooth: (t) => t * t * (3 - 2 * t),
  soft: (t) => 0.5 - Math.cos(Math.PI * t) / 2,
  snappy: (t) => 1 - Math.pow(1 - t, 3),
};

// Appends `text` to `el` as one span per letter. Each word is kept in its own
// unbreakable span, so the text still only wraps between words.
export function letters(el, text) {
  for (const part of String(text).split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) { el.append(document.createTextNode(part)); continue; }
    const word = document.createElement('span');
    word.className = 'cw-word';
    for (const ch of part) {
      const sp = document.createElement('span');
      sp.className = 'cw-ch';
      sp.textContent = ch;
      word.append(sp);
    }
    el.append(word);
  }
}

export function createColorWave(el) {
  let cfg = WAVE_DEFAULTS;
  let t0 = null, raf = 0, chars = null;

  // Each letter's place along the text, 0–1, in reading order: line by line,
  // and by its actual position across each line (so gaps count as distance).
  function measure() {
    // (The line reveal's split can leave empty copies of a letter's span.)
    const els = [...el.querySelectorAll('.cw-ch')].filter((e) => e.textContent.trim());
    const rects = els.map((e) => e.getBoundingClientRect());
    const lines = [];
    rects.forEach((r, i) => {
      const last = lines[lines.length - 1];
      if (!last || r.top > last.top + r.height / 2) lines.push({ top: r.top, left: r.left, right: r.right, items: [i] });
      else { last.left = Math.min(last.left, r.left); last.right = Math.max(last.right, r.right); last.items.push(i); }
    });
    const total = lines.reduce((s, l) => s + (l.right - l.left), 0);
    const u = new Array(els.length).fill(0);
    let acc = 0;
    for (const l of lines) {
      for (const i of l.items) {
        const r = rects[i];
        u[i] = total > 0 ? (acc + r.left + r.width / 2 - l.left) / total : i / Math.max(1, els.length - 1);
      }
      acc += l.right - l.left;
    }
    chars = els.map((e, i) => ({ e, i, u: Math.min(1, Math.max(0, u[i])), last: null }));
  }

  const total = () => cfg.waveDelay + cfg.waveSpread + cfg.waveRandom + cfg.waveDuration;

  function paint(now) {
    if (!chars || (chars.length && !chars[0].e.isConnected)) measure();
    const on = cfg.wave === 'on';
    const from = hexRgb(cfg.waveFrom), mid = hexRgb(cfg.waveColour), to = hexRgb(cfg.waveTo);
    const ease = EASE[cfg.waveEase] || EASE.smooth;
    const peak = Math.min(0.95, Math.max(0.05, cfg.wavePeak));
    const t = t0 == null ? -Infinity : (now - t0) / 1000 - cfg.waveDelay;
    for (const c of chars) {
      let col = '';
      if (on) {
        const along = cfg.waveDirection === 'rtl' ? 1 - c.u
          : cfg.waveDirection === 'centre' ? Math.abs(c.u - 0.5) * 2
          : cfg.waveDirection === 'edges' ? 1 - Math.abs(c.u - 0.5) * 2
          : c.u;
        const x = (t - along * cfg.waveSpread - rnd(c.i, 21) * cfg.waveRandom) / Math.max(0.01, cfg.waveDuration);
        if (x <= 0) col = mixRgb(from, from, 0);
        else if (x >= 1) col = mixRgb(to, to, 0);
        else if (x < peak) col = mixRgb(from, mid, ease(x / peak));
        else col = mixRgb(mid, to, ease((x - peak) / (1 - peak)));
      }
      if (col !== c.last) { c.e.style.color = col; c.last = col; }
    }
  }

  function tick() {
    raf = 0;
    const now = performance.now();
    paint(now);
    if (t0 != null && (now - t0) / 1000 < total() + 0.05) raf = requestAnimationFrame(tick);
  }

  return {
    remeasure() { chars = null; },
    update(top, H, next) {
      cfg = next;
      if (cfg.wave === 'on' && t0 == null && top <= cfg.waveTrigger * H) {
        t0 = performance.now();
        if (!raf) raf = requestAnimationFrame(tick);
      }
      if (!raf) paint(performance.now());
    },
    configure(prev, next) {
      if (WAVE_KEYS.some((k) => next[k] !== prev[k])) t0 = null;
    },
    destroy() { cancelAnimationFrame(raf); },
  };
}

// Inspector rows for a beat's wave settings (see editor/schema.js).
export function waveRows(group, note) {
  const on = (c) => c.wave === 'on';
  return [
    { group, note: note || 'Letter by letter, from one colour through a second to a third. Plays once, the first time it comes on screen; changing a setting here plays it again.' },
    { p: 'wave', label: 'Colour wave', type: 'seg', options: [['on', 'On'], ['off', 'Off']] },
    { sub: 'Colours', when: on },
    { p: 'waveFrom', label: 'Start', type: 'color', when: on },
    { p: 'waveColour', label: 'Wave', type: 'color', when: on },
    { p: 'waveTo', label: 'End', type: 'color', when: on },
    { sub: 'Timing', when: on },
    { p: 'waveTrigger', label: 'Starts at', min: 0, max: 1, step: 0.01, hint: 'When the text’s top reaches this far down the screen (1 = bottom edge)', when: on },
    { p: 'waveDelay', label: 'Delay', min: 0, max: 3, step: 0.05, unit: 's', when: on },
    { p: 'waveDuration', label: 'Per letter', min: 0.05, max: 4, step: 0.05, unit: 's', hint: 'How long one letter takes from start to end colour', when: on },
    { p: 'waveSpread', label: 'Across the text', min: 0, max: 4, step: 0.05, unit: 's', hint: 'From the first letter starting to the last. 0 = all at once', when: on },
    { p: 'wavePeak', label: 'Wave colour at', min: 0.05, max: 0.95, step: 0.01, hint: 'Where in each letter’s change it is fully the wave colour', when: on },
    { p: 'waveRandom', label: 'Randomness', min: 0, max: 2, step: 0.05, unit: 's', hint: 'Random extra delay per letter', when: on },
    { sub: 'Shape', when: on },
    { p: 'waveDirection', label: 'Direction', type: 'seg', wrap: true, options: [['ltr', 'Start → end'], ['rtl', 'End → start'], ['centre', 'From centre'], ['edges', 'From edges']], when: on },
    { p: 'waveEase', label: 'Ease', type: 'seg', options: [['linear', 'Linear'], ['smooth', 'Smooth'], ['soft', 'Soft'], ['snappy', 'Snappy']], when: on },
  ];
}

/* Page grain and warmth — an analog finish over everything.

   Two fixed, full-screen layers sit above all the content (below the editor):

   - Warmth: a flat tint multiplied over the page. Whites take on the tint's
     colour, so the page reads as warm paper rather than screen white; blacks
     stay black.
   - Grain: a tile of noise drawn once, repeated across an oversized layer and
     blended over the page. Every frame (at `grainSpeed` per second) the layer
     jumps to a new random offset, so the grain shimmers like film instead of
     sitting on the page like a dirty screen. The jump is a GPU transform, so
     nothing underneath ever repaints.

   Both are separate elements straight in <body> on purpose: `mix-blend-mode`
   blends with whatever is behind an element *within its stacking context*, so
   wrapping them in a positioned container would isolate them from the page
   and the blend would do nothing.

   The grain is ambient, not choreography — it runs on time, not scroll — so
   it deliberately sits outside the beats' pure-function-of-progress rule. It
   stops moving for anyone who prefers reduced motion. */

export const GRAIN_DEFAULTS = {
  grain: 'on',
  grainAmount: 0.1,      // opacity of the grain layer
  grainSize: 1.5,        // grain size, × one screen pixel
  grainSoftness: 0.4,    // 0 = crisp pixel grain, 1 = soft, clumpy grain
  grainSpeed: 12,        // new grain frames per second (0 = static)
  grainBlend: 'overlay', // how the grain mixes with the page
  grainColour: 0.15,     // 0 = monochrome grain, 1 = full colour noise
  warmth: 0.12,          // strength of the warm tint (0 = off)
  warmthTint: '#e9c49a', // the tint multiplied over the page
};

const TILE = 256; // px; big enough that the repeat never reads as a pattern

function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* One tile of noise, centred on mid-grey so that overlay / soft-light leave
   the page's average brightness alone and only add texture. Softness blurs
   the tile (wrapping at the edges so it still repeats seamlessly). Seeded, so
   the texture is the same on every load. */
function makeTile(colour, softness) {
  const c = document.createElement('canvas');
  c.width = c.height = TILE;
  const x = c.getContext('2d');
  const img = x.createImageData(TILE, TILE);
  const r = rng(7919);
  // Two uniforms averaged: a rounder, film-like distribution than flat noise.
  const n = () => (r() + r()) / 2 - 0.5;
  for (let i = 0; i < TILE * TILE; i++) {
    const g = n();
    const k = i * 4;
    img.data[k] = 128 + 255 * (g + colour * n() * 0.6);
    img.data[k + 1] = 128 + 255 * (g + colour * n() * 0.6);
    img.data[k + 2] = 128 + 255 * (g + colour * n() * 0.6);
    img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  if (softness <= 0) return c.toDataURL();

  // Blur with wrap-around: draw the tile 3×3, blur, keep the centre.
  const big = document.createElement('canvas');
  big.width = big.height = TILE * 3;
  const bx = big.getContext('2d');
  bx.filter = `blur(${(softness * 1.4).toFixed(2)}px)`;
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) bx.drawImage(c, i * TILE, j * TILE);
  const out = document.createElement('canvas');
  out.width = out.height = TILE;
  const ox = out.getContext('2d');
  ox.drawImage(big, TILE, TILE, TILE, TILE, 0, 0, TILE, TILE);
  // Blurring pulls everything towards grey; stretch the contrast back out so
  // softer grain isn't also fainter grain.
  const d = ox.getImageData(0, 0, TILE, TILE);
  const gain = 1 + softness * 1.6;
  for (let i = 0; i < d.data.length; i += 4) {
    for (let ch = 0; ch < 3; ch++) d.data[i + ch] = 128 + (d.data[i + ch] - 128) * gain;
  }
  ox.putImageData(d, 0, 0);
  return out.toDataURL();
}

export function createGrain(config) {
  let cfg = { ...GRAIN_DEFAULTS, ...config };

  const tint = document.createElement('div');
  tint.className = 'grain-tint';
  const noise = document.createElement('div');
  noise.className = 'grain-noise';
  tint.setAttribute('aria-hidden', 'true');
  noise.setAttribute('aria-hidden', 'true');
  document.body.append(tint, noise);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let tileKey = '';
  let raf = 0;
  let last = 0;
  const jump = rng(104729);

  function apply() {
    const on = cfg.grain !== 'off';

    tint.style.display = on && cfg.warmth > 0 ? '' : 'none';
    tint.style.background = cfg.warmthTint;
    tint.style.opacity = String(cfg.warmth);

    noise.style.display = on && cfg.grainAmount > 0 ? '' : 'none';
    const key = `${cfg.grainColour}|${cfg.grainSoftness}`;
    if (key !== tileKey) {
      tileKey = key;
      noise.style.backgroundImage = `url(${makeTile(cfg.grainColour, cfg.grainSoftness)})`;
    }
    const size = TILE * cfg.grainSize;
    noise.style.setProperty('--grain-tile', `${size}px`);
    noise.style.backgroundSize = `${size}px ${size}px`;
    // Crisp grain stays crisp when scaled up; soft grain is allowed to smooth.
    noise.style.imageRendering = cfg.grainSoftness > 0 ? 'auto' : 'pixelated';
    noise.style.opacity = String(cfg.grainAmount);
    noise.style.mixBlendMode = cfg.grainBlend;

    stop();
    if (on && cfg.grainSpeed > 0 && !reduced.matches) raf = requestAnimationFrame(tick);
    else noise.style.transform = '';
  }

  // Jump to a new random offset inside one tile, `grainSpeed` times a second.
  // Whole pixels only, so the grain never gets resampled into mush.
  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (now - last < 1000 / cfg.grainSpeed) return;
    last = now;
    const size = TILE * cfg.grainSize;
    const dx = Math.round(jump() * size), dy = Math.round(jump() * size);
    noise.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  reduced.addEventListener?.('change', apply);
  apply();

  return {
    setConfig(next) { cfg = { ...GRAIN_DEFAULTS, ...next }; apply(); },
    destroy() { stop(); tint.remove(); noise.remove(); },
  };
}

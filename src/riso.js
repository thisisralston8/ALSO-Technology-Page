/* A printed (Riso-like) look for small images: four rotated halftone screens
   in custom inks, absorptive ink over a textured paper, plates a little off
   register, grain and wear.

   Ported from Pressroom (prototype-hub/apps/pressroom/render.js). Changes:
   - the four inks and the paper are colours you pick (Pressroom's are fixed
     CMYK on warm white); ink 1 prints where the image lacks red, ink 2 green,
     ink 3 blue (like cyan, magenta and yellow) and ink 4 its darks;
   - sizes are in pixels of the image being printed, not of a 1,600 px sheet,
     because these images are small;
   - `pixel` samples the image in blocks first, for a coarser, collage look.

   Deterministic: the same image and settings always print the same pixels.
   The work happens in a worker (risoWorker.js); see createPrinter below. */

const hexRgb = (hex) => {
  const v = String(hex || '#000').replace('#', '').padEnd(6, '0');
  const n = parseInt(v.slice(0, 6), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export function renderPrint(source, width, height, p) {
  const result = new Uint8ClampedArray(width * height * 4);
  const pitch = Math.max(1, p.dot);
  const block = Math.max(1, Math.round(p.pixel || 1));
  const angles = [15, 75, 0, 45].map((a) => [Math.cos(a * Math.PI / 180), Math.sin(a * Math.PI / 180)]);
  const inks = p.inks.map(hexRgb);
  const paperCol = hexRgb(p.paperColour);
  const offsets = [[0.7, -0.3], [-0.5, 0.6], [0.3, 0.2], [0, 0]];
  const noise = (x, y, s = 0) => { let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul((p.seed + s) | 0, 1274126177); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
  const smoothNoise = (x, y, s = 0) => { const ix = Math.floor(x), iy = Math.floor(y); let u = x - ix, v = y - iy; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v); return (noise(ix, iy, s) * (1 - u) + noise(ix + 1, iy, s) * u) * (1 - v) + (noise(ix, iy + 1, s) * (1 - u) + noise(ix + 1, iy + 1, s) * u) * v; };
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const sat = p.saturation / 100, con = p.contrast / 100, exp = p.exposure / 100;
  const sample = (x, y) => {
    let px = Math.max(0, Math.min(width - 1, Math.round(x))), py = Math.max(0, Math.min(height - 1, Math.round(y)));
    if (block > 1) { px = Math.min(width - 1, Math.floor(px / block) * block + (block >> 1)); py = Math.min(height - 1, Math.floor(py / block) * block + (block >> 1)); }
    const i = (py * width + px) * 4;
    const a = source[i + 3] / 255;
    const r = source[i] / 255 * a + 1 - a, g = source[i + 1] / 255 * a + 1 - a, b = source[i + 2] / 255 * a + 1 - a;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return [r, g, b].map((v) => clamp(((l + (v - l) * sat) - 0.5) * con + 0.5 + exp));
  };
  const paper = p.paper / 100, gr = p.grain / 100, wear = p.wear / 100;
  const sub = [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const fiber = smoothNoise(x * 0.42, y * 1.5, 91) - 0.5;
    const grain = noise(x, y, 17) - 0.5;
    const cloud = smoothNoise(x / 17, y / 17, 35);
    const tex = (fiber * 0.10 + grain * 0.045) * paper;
    const rgb = [0, 1, 2].map((k) => 1 + (paperCol[k] - 1) * paper + tex);
    for (let c = 0; c < 4; c++) {
      const [co, si] = angles[c];
      const xx = x - offsets[c][0] * p.registration, yy = y - offsets[c][1] * p.registration;
      const u = (xx * co + yy * si) / pitch, v = (-xx * si + yy * co) / pitch;
      const cu = Math.floor(u) + 0.5, cv = Math.floor(v) + 0.5;
      const color = sample((cu * co - cv * si) * pitch, (cu * si + cv * co) * pitch);
      const black = (1 - Math.max(...color)) * 0.78;
      let tone = c === 3 ? black : (1 - color[c] - black) / (1 - black || 1);
      tone = clamp(tone + p.gain / 100 * 0.52 * Math.sin(tone * Math.PI));
      tone = clamp(tone + grain * gr * 0.21 + (cloud - 0.5) * wear * 0.13);
      // Round dots in the lights turn into round holes in the shadows.
      let coverage = 0;
      const radius = Math.sqrt((tone <= 0.5 ? tone : 1 - tone) / Math.PI);
      const aa = 0.65 / pitch;
      for (const [dx, dy] of sub) {
        const su = u + (dx * co + dy * si) / pitch, sv = v + (-dx * si + dy * co) / pitch;
        const du = su - Math.floor(su) - 0.5, dv = sv - Math.floor(sv) - 0.5;
        const distance = tone <= 0.5 ? Math.hypot(du, dv) : Math.hypot(0.5 - Math.abs(du), 0.5 - Math.abs(dv));
        const ink = tone === 0 || tone === 1 ? 0 : clamp((radius - distance) / aa + 0.5);
        coverage += (tone <= 0.5 ? ink : 1 - ink) * 0.25;
      }
      const fleck = noise(Math.floor(x / 1.3), Math.floor(y / 1.3), 44);
      const erosion = wear * (fleck > 0.89 ? ((fleck - 0.89) / 0.11) * 0.85 : 0) + wear * Math.max(0, cloud - 0.55) * 0.5;
      coverage *= 1 - erosion;
      for (let k = 0; k < 3; k++) rgb[k] *= 1 - coverage * (1 - inks[c][k]);
    }
    const i = (y * width + x) * 4;
    for (let k = 0; k < 3; k++) result[i + k] = (rgb[k] + grain * gr * 0.075) * 255;
    result[i + 3] = 255;
  }
  return result;
}

/* The settings renderPrint takes, from a beat's `print*` params. */
export function printParams(cfg) {
  return {
    size: Math.round(cfg.printSize), dot: cfg.printDot, pixel: cfg.printPixel, gain: cfg.printGain,
    registration: cfg.printShift, grain: cfg.printGrain, wear: cfg.printWear, paper: cfg.printPaper,
    saturation: cfg.printSaturation, contrast: cfg.printContrast, exposure: cfg.printBrightness,
    inks: [cfg.printInk1, cfg.printInk2, cfg.printInk3, cfg.printInk4], paperColour: cfg.printPaperColour,
    seed: cfg.printSeed,
  };
}

/* Prints images (by URL) or flat colours (`#rrggbb`) into blob URLs, in a
   worker, one at a time. Results are cached by settings: when the settings
   change, `print` for the new ones starts afresh and `prune` frees the old. */
export function createPrinter() {
  let worker = null;
  let next = 0;
  const pending = new Map();
  const cache = new Map();   // `${key}|${what}` → Promise<url>
  const start = () => {
    if (worker) return worker;
    worker = new Worker(new URL('./risoWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const job = pending.get(data.id);
      pending.delete(data.id);
      if (!job) return;
      if (data.error) job.reject(new Error(data.error));
      else job.resolve(URL.createObjectURL(data.blob));
    };
    return worker;
  };
  return {
    print(what, params) {
      const key = `${JSON.stringify(params)}|${what}`;
      if (!cache.has(key)) {
        const id = ++next;
        const src = what.startsWith('#') ? { colour: what } : { url: new URL(what, location.href).href };
        cache.set(key, new Promise((resolve, reject) => {
          pending.set(id, { resolve, reject });
          start().postMessage({ id, ...src, params });
        }));
      }
      return cache.get(key);
    },
    // Free everything not printed with these settings.
    prune(params) {
      const keep = `${JSON.stringify(params)}|`;
      for (const [key, url] of cache) if (!key.startsWith(keep)) { cache.delete(key); url.then((u) => URL.revokeObjectURL(u), () => {}); }
    },
    destroy() { worker?.terminate(); this.prune(null); },
  };
}

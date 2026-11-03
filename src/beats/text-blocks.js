/* Blocks reveal — for text, and for images.

   The same quantizing-squares reveal Big scroll's effect uses on its inline
   images. Flow uses it on blocks of live text (`rasterize`); Big scroll's held
   "dots" use it on images (`rasterizeImage`). A blurb is split into a grid of square
   blocks; each block pops in as one flat tile, splits into four, and each child
   splits again on its own seeded clock, down to `depth` levels, then snaps to
   the sharp text. Hiding is the same thing run backwards.

   A block's tone is how much ink falls inside it, so on a white page a block
   over the middle of a word is a mid grey and one over a gap is nearly empty —
   the text pixelates the way an image does.

   The plan maths mirrors `makePlan` in the vendored type-scroll effect (which
   can't be imported from: it lives inside the effect's closure and the file is
   kept copy-compatible with upstream). Every frame is a pure function of r in
   [0, 1]: nothing at 0, fully sharp at exactly 1, so it scrubs and reverses. */

function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makePlan(cols, rows, depth, scatter, seed) {
  const rnd = rng(seed);
  const hold = () => 1 + scatter * 0.85 * (rnd() * 2 - 1);
  const grow = (d, i, j, t) => {
    const n = { d, i, j, t, split: t + hold(), kids: null, done: 0 };
    if (d < depth) {
      n.kids = [];
      for (let q = 0; q < 4; q++) n.kids.push(grow(d + 1, i * 2 + (q & 1), j * 2 + (q >> 1), n.split));
      n.done = Math.max(...n.kids.map((k) => k.done));
    } else n.done = n.split;
    return n;
  };
  const spread = scatter * (depth + 1) * 0.9;
  const roots = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) roots.push(grow(0, i, j, rnd() * spread));
  // normalise: first block lands just after 0, last pixel resolves at exactly 1
  const t0 = Math.min(...roots.map((n) => n.t));
  const t1 = Math.max(...roots.map((n) => n.done));
  const k = 0.97 / (t1 - t0 || 1);
  const norm = (n) => {
    n.t = 0.03 + (n.t - t0) * k; n.split = 0.03 + (n.split - t0) * k; n.done = 0.03 + (n.done - t0) * k;
    if (n.kids) n.kids.forEach(norm);
  };
  roots.forEach(norm);
  return roots;
}

/* Draw a laid-out text element into a canvas, pixel-matched to the page.
   Rather than re-flowing the text in canvas (which would wrap and kern a
   little differently), each character is drawn at the exact position the
   browser laid it out, read back with a Range. Returns null if the element
   has no layout yet (e.g. its stage is parked off-screen). */
export function rasterize(el, dpr) {
  const node = el.firstChild;
  const box = el.getBoundingClientRect();
  if (!node || node.nodeType !== 3 || box.width < 1 || box.height < 1) return null;

  const cs = getComputedStyle(el);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(box.width * dpr);
  canvas.height = Math.ceil(box.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  ctx.fillStyle = cs.color;
  ctx.textBaseline = 'alphabetic';
  // A character's client rect spans the font's ascent + descent, so the
  // baseline sits one ascent below its top.
  const ascent = ctx.measureText('Hg').fontBoundingBoxAscent;

  const range = document.createRange();
  const text = node.textContent;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) continue;
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    const r = range.getClientRects()[0];
    if (!r) continue;
    ctx.fillText(ch, r.left - box.left, r.top - box.top + ascent);
  }
  return { canvas, w: box.width, h: box.height, left: box.left, top: box.top };
}

/* Average colour of every block at every level, box-filtered up from the
   finest — the same pyramid the effect builds for its images. Averages are
   premultiplied, so a block half-covered by black ink on a transparent canvas
   comes out as black at 50% — for text that is exactly "ink coverage", and for
   an opaque image it is just the average colour. Stored as [r, g, b, a] in
   0..1 per block. */
export function averages(raster, cols, rows, depth) {
  let gw = cols << depth;
  let gh = rows << depth;
  const c = document.createElement('canvas');
  c.width = gw; c.height = gh;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingQuality = 'high';
  x.drawImage(raster.canvas, 0, 0, gw, gh);
  const px = x.getImageData(0, 0, gw, gh).data;
  let a = new Float32Array(gw * gh * 4);
  for (let p = 0; p < gw * gh; p++) {
    const al = px[p * 4 + 3] / 255;
    a[p * 4] = (px[p * 4] / 255) * al;
    a[p * 4 + 1] = (px[p * 4 + 1] / 255) * al;
    a[p * 4 + 2] = (px[p * 4 + 2] / 255) * al;
    a[p * 4 + 3] = al;
  }
  const levels = [];
  for (let d = depth; d >= 0; d--) {
    levels[d] = a;
    if (d === 0) break;
    const nw = gw >> 1, nh = gh >> 1, next = new Float32Array(nw * nh * 4);
    for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) for (let ch = 0; ch < 4; ch++) {
      const at = (q, r) => a[((j * 2 + r) * gw + i * 2 + q) * 4 + ch];
      next[(j * nw + i) * 4 + ch] = (at(0, 0) + at(1, 0) + at(0, 1) + at(1, 1)) / 4;
    }
    a = next; gw = nw; gh = nh;
  }
  return levels;
}

/* An image, cover-cropped into a w × h box (CSS px) at the given dpr. */
export function rasterizeImage(img, w, h, dpr) {
  if (!img || !img.naturalWidth || w < 1 || h < 1) return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  const iw = img.naturalWidth, ih = img.naturalHeight, aspect = w / h;
  let sx = 0, sy = 0, sw = iw, sh = ih;
  if (iw / ih > aspect) { sw = ih * aspect; sx = (iw - sw) / 2; } else { sh = iw / aspect; sy = (ih - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return { canvas, w, h };
}

/* Prepare everything a raster needs to be painted at any r. Blocks are square:
   `cols` across, and as many rows as keep them square for this shape. */
export function prepare(raster, { blocks, depth, scatter, seed }) {
  const cols = Math.max(1, Math.round(blocks));
  const rows = Math.max(1, Math.round((cols * raster.h) / raster.w));
  return {
    raster, cols, rows,
    plan: makePlan(cols, rows, depth, scatter, seed),
    avg: averages(raster, cols, rows, depth),
  };
}

/* Paint one prepared raster into `ctx` at device-pixel offset (ox, oy). */
export function paint(ctx, item, r, ox, oy) {
  if (!item || r <= 0) return;
  const src = item.raster.canvas;
  const W = src.width, H = src.height;
  if (r >= 1) { ctx.drawImage(src, ox, oy); return; }
  const { cols, rows, avg } = item;
  const walk = (n) => {
    if (r < n.t) return;
    const gw = cols << n.d, gh = rows << n.d;
    const x0 = Math.round((n.i / gw) * W), x1 = Math.round(((n.i + 1) / gw) * W);
    const y0 = Math.round((n.j / gh) * H), y1 = Math.round(((n.j + 1) / gh) * H);
    if (x1 <= x0 || y1 <= y0) { if (n.kids && r >= n.split) n.kids.forEach(walk); return; }
    if (r >= n.done) {
      ctx.drawImage(src, x0, y0, x1 - x0, y1 - y0, ox + x0, oy + y0, x1 - x0, y1 - y0);
    } else if (r < n.split) {
      const k = (n.j * gw + n.i) * 4, lv = avg[n.d];
      const a = lv[k + 3];
      if (a > 0.004) {
        const c = (v) => Math.round((v / a) * 255);
        ctx.fillStyle = `rgba(${c(lv[k])},${c(lv[k + 1])},${c(lv[k + 2])},${a})`;
        ctx.fillRect(ox + x0, oy + y0, x1 - x0, y1 - y0);
      }
    } else n.kids.forEach(walk);
  };
  item.plan.forEach(walk);
}

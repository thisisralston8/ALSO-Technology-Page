// Type Scroll — the effect itself. Framework-free and dependency-injected so the
// exact same source runs in the editor and inside an exported embed:
//
//   createTypeScroll(el, config, { gsap, Observer, ScrollTrigger })
//
// The whole picture is a function of one number, `y`: how far the stack has
// travelled past the centre of the frame, in layout pixels. Drivers (wheel/touch
// capture or page scroll) only ever move a *target*; `y` chases it with an
// exponential follow whose time constant is the Inertia setting.

export function createTypeScroll(el, config, deps) {
  const { gsap, Observer, ScrollTrigger } = deps;
  const clamp = (a, b, v) => Math.min(b, Math.max(a, v));
  const HALF_PI = Math.PI / 2;

  let cfg = config;
  let lines = []; // [{ el, words: [{ el, v, tau }], index }]
  let copies = 1;
  let period = 0;
  let metrics = { H: 0, W: 0, fs: 0, L: 0, band: 0, R: Infinity, edgeS: 0 };
  let y = 0, target = 0, lastY = 0, vel = 0;
  let observer = null, trigger = null, scrollHandler = null;
  let structureKey = '';
  let onFrame = null;

  // ---------- DOM ----------
  el.classList.add('ts-frame');
  const stage = document.createElement('div');
  stage.className = 'ts-stage';
  el.appendChild(stage);
  // Pixel Gather draws its pool of squares here, behind the type
  const pool = document.createElement('canvas');
  pool.className = 'ts-pool';
  el.insertBefore(pool, stage);
  const pctx = pool.getContext('2d');
  let cursor = null;
  const onMove = (e) => { const r = el.getBoundingClientRect(); cursor = { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onLeave = () => { cursor = null; };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);

  function hash(i) {
    // stable 0..1 per word so the stagger pattern never reshuffles
    const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function buildLine(tokens, index) {
    const line = document.createElement('div');
    line.className = 'ts-line';
    const words = [];
    const imgs = [];
    tokens.forEach((tok, j) => {
      if (j > 0) line.appendChild(document.createTextNode(' '));
      if (tok.t === 'w') {
        const w = document.createElement('span');
        w.className = 'ts-word';
        w.textContent = tok.text;
        line.appendChild(w);
        words.push({ el: w, v: 0, seed: hash(index * 31 + j) });
      } else {
        const b = document.createElement('span');
        b.className = 'ts-img';
        const c = document.createElement('canvas');
        b.appendChild(c);
        line.appendChild(b);
        imgs.push({ el: b, canvas: c, ctx: c.getContext('2d'), src: tok.src, seed: index * 977 + j * 131 + 7, r: 0, drawn: -1, key: '' });
      }
    });
    stage.appendChild(line);
    return { el: line, words, imgs, index };
  }

  function build() {
    stage.textContent = '';
    lines = [];
    const src = cfg.lines.length ? cfg.lines : [[{ t: 'w', text: ' ' }]];
    copies = cfg.mode === 'loop' ? copiesNeeded(src.length) : 1;
    for (let k = 0; k < copies; k++) {
      src.forEach((tokens, i) => lines.push(buildLine(tokens, k * src.length + i)));
    }
  }

  function copiesNeeded(n) {
    // enough repeats that a full frame (plus a line of slack each side) is covered
    const L = metrics.L || 80;
    const p = (n + (cfg.motion.loopGap || 0)) * L;
    const span = 2 * (metrics.edgeS || 600) + 2 * L;
    return Math.max(1, Math.ceil(span / p) + 1);
  }

  // ---------- image reveal ----------
  // Each image is a grid of blocks. A block pops in as one flat tile of its
  // average colour, then splits into four, and each child splits again on its
  // own random clock, down to `depth` levels of pixels, then snaps to the sharp
  // image. Every frame is a pure function of r in [0, 1]: nothing at 0, fully
  // resolved at exactly 1, so the reveal scrubs and reverses cleanly.
  const imgCache = new Map(); // src -> { img, ok }
  const colourCache = new Map();

  function getImage(src) {
    let e = imgCache.get(src);
    if (!e) {
      const img = new Image();
      e = { img, ok: false };
      img.onload = () => { e.ok = true; for (const l of lines) for (const im of l.imgs) if (im.src === src) im.key = ''; prepareAll(); };
      img.src = src;
      imgCache.set(src, e);
    }
    return e;
  }

  function rng(seed) {
    let a = seed >>> 0 || 1;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makePlan(cols, rows, depth, scatter, seed, flat = false) {
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
    const spread = flat ? 0 : scatter * (depth + 1) * 0.9;
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

  function coverCrop(img, aspect) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    if (iw / ih > aspect) { const sw = ih * aspect; return { sx: (iw - sw) / 2, sy: 0, sw, sh: ih }; }
    const sh = iw / aspect;
    return { sx: 0, sy: (ih - sh) / 2, sw: iw, sh };
  }

  // average colour of every block at every level, box-filtered up from the finest
  function blockColours(src, img, crop, cols, rows, depth) {
    const key = [src.length, src.slice(-48), crop.sw.toFixed(1), crop.sh.toFixed(1), cols, rows, depth].join('|');
    let out = colourCache.get(key);
    if (out) return out;
    let gw = cols << depth, gh = rows << depth;
    const c = document.createElement('canvas');
    c.width = gw; c.height = gh;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, gw, gh);
    let px = x.getImageData(0, 0, gw, gh).data;
    const levels = [];
    for (let d = depth; d >= 0; d--) {
      levels[d] = [];
      for (let p = 0; p < gw * gh; p++) levels[d].push(`rgb(${px[p * 4]},${px[p * 4 + 1]},${px[p * 4 + 2]})`);
      if (d === 0) break;
      const nw = gw >> 1, nh = gh >> 1, next = new Uint8ClampedArray(nw * nh * 4);
      for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) for (let ch = 0; ch < 4; ch++) {
        const a = (q, r) => px[((j * 2 + r) * gw + i * 2 + q) * 4 + ch];
        next[(j * nw + i) * 4 + ch] = (a(0, 0) + a(1, 0) + a(0, 1) + a(1, 1)) / 4;
      }
      px = next; gw = nw; gh = nh;
    }
    out = levels;
    colourCache.set(key, out);
    return out;
  }

  function prepareImg(im) {
    const ci = cfg.img, rv = cfg.reveal || {};
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const hC = metrics.fs * ci.size, wC = hC * ci.aspect;
    const W = Math.max(1, Math.round(wC * dpr)), H = Math.max(1, Math.round(hC * dpr));
    const e = im.src ? getImage(im.src) : null;
    const gather = rv.style === 'gather';
    const cols = clamp(1, 12, Math.round((gather ? rv.squares : rv.grid) || 3));
    const rows = Math.max(1, Math.round(cols / ci.aspect));
    const depth = clamp(0, 4, Math.round(rv.depth == null ? 3 : rv.depth));
    const key = [W, H, cols, rows, depth, rv.scatter, rv.style, e && e.ok].join('|');
    if (key === im.key) return;
    im.key = key;
    im.drawn = -1;
    if (im.canvas.width !== W) im.canvas.width = W;
    if (im.canvas.height !== H) im.canvas.height = H;
    im.entry = e;
    im.cols = cols; im.rows = rows;
    im.plan = makePlan(cols, rows, depth, rv.scatter == null ? 0.7 : rv.scatter, im.seed, gather);
    im.squares = null;
    if (gather) {
      const rnd = rng(im.seed * 7 + 3);
      im.squares = [];
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        im.squares.push({
          i, j, hx: 0, hy: 0, a: 0, cs: rnd() < 0.5 ? -1 : 1, ca: 0.12 + rnd() * 0.22,
          w1: 0.25 + rnd() * 0.35, w2: 0.2 + rnd() * 0.35, p1: rnd() * 6.28, p2: rnd() * 6.28, rk: rnd(),
          ox: 0, oy: 0, vx: 0, vy: 0, lx: NaN, ly: NaN,
        });
      }
      homesDirty = true;
    }
    if (e && e.ok) {
      im.crop = coverCrop(e.img, W / H);
      im.colours = blockColours(im.src, e.img, im.crop, cols, rows, depth);
      im.rgb0 = im.colours[0].map((c) => c.slice(4, -1).split(',').map(Number));
    }
  }

  function prepareAll() {
    for (const l of lines) for (const im of l.imgs) prepareImg(im);
    if (homesDirty) assignHomes();
  }

  // ---------- pixel gather ----------
  // A pool of squares, one per tile of every image, scattered across a field at
  // the top of the frame. Each square's path home -> tile is a pure function of
  // its image's r (so it scrubs and reverses); the cursor and the idle drift sit
  // on top as a springy offset that fades out as the square docks. Once docked,
  // the image's own canvas draws the tile, so it rolls and slants with the line.
  let homesDirty = false;
  const GATHER_SPLIT = (rv) => (rv.depth > 0 ? 0.8 : 1); // r at which every square has landed
  const flightOf = (rv) => GATHER_SPLIT(rv) * 0.5;

  function assignHomes() {
    homesDirty = false;
    const imgsAll = [];
    for (const l of lines) for (const im of l.imgs) if (im.squares) imgsAll.push(im);
    const N = imgsAll.reduce((n, im) => n + im.squares.length, 0);
    if (!N) return;
    const { W, H } = metrics;
    const rv = cfg.reveal;
    const fx0 = W * 0.06, fx1 = W * 0.94, fy0 = H * 0.07, fy1 = H * clamp(0.15, 0.95, rv.field || 0.45);
    const fw = fx1 - fx0, fh = Math.max(1, fy1 - fy0);
    const dotGrid = rv.layout === 'grid';
    let gc, gr, cw, ch, gx0 = fx0, gy0 = fy0;
    if (dotGrid) {
      // exact dot grid: pick the factor pair of N closest to the field's shape,
      // so every row is full and there are no orphans
      const target = fw / fh;
      let best = [N, 1], bestErr = Infinity;
      for (let c = 1; c <= N; c++) {
        if (N % c) continue;
        const err = Math.abs(Math.log(c / (N / c) / target));
        if (err < bestErr) { bestErr = err; best = [c, N / c]; }
      }
      [gc, gr] = best;
      // square pitch, never tighter than a dot plus a hair of gap; centred in the field
      const sample = imgsAll[0];
      const dot = Math.max((sample.w || 40) / sample.cols, (sample.h || 40) / sample.rows);
      const pitch = Math.max(Math.min(fw / gc, fh / gr), dot * 1.15);
      cw = ch = pitch;
      gx0 = fx0 + (fw - gc * pitch) / 2;
      gy0 = fy0 + (fh - gr * pitch) / 2;
    } else {
      // jittered grid: one cell per square, so the constellation never overlaps
      gc = Math.max(1, Math.round(Math.sqrt((N * fw) / fh)));
      gr = Math.ceil(N / gc);
      gc = Math.ceil(N / gr);
      cw = fw / gc; ch = fh / gr;
    }
    const rnd = rng(9173 + N);
    const cells = [];
    for (let r = 0; r < gr; r++) for (let c = 0; c < gc; c++) cells.push([c, r]);
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    let k = 0;
    const scatter = rv.scatter == null ? 0.7 : rv.scatter;
    const G = GATHER_SPLIT(rv), flight = flightOf(rv);
    for (const im of imgsAll) {
      const tw = (im.w || 40) / im.cols, th = (im.h || 40) / im.rows;
      const homes = im.squares.map(() => {
        const [c, r] = cells[k++];
        const jx = dotGrid ? 0 : Math.max(0, cw - tw) * 0.5, jy = dotGrid ? 0 : Math.max(0, ch - th) * 0.5;
        return { x: gx0 + (c + 0.5) * cw + (rnd() * 2 - 1) * jx, y: gy0 + (r + 0.5) * ch + (rnd() * 2 - 1) * jy };
      });
      // pair by x so flight paths cross as little as possible
      homes.sort((a, b) => a.x - b.x);
      const order = im.squares.slice().sort((a, b) => a.i - b.i || a.j - b.j);
      order.forEach((q, n) => { q.hx = homes[n].x; q.hy = homes[n].y; });
      // the lowest squares feel the pull first; Scatter shuffles that order
      const byY = im.squares.slice().sort((a, b) => b.hy - a.hy);
      byY.forEach((q, n) => {
        const key = (n / Math.max(1, byY.length - 1)) * (1 - scatter) + q.rk * scatter;
        q.a = key * (G - flight);
      });
    }
  }

  const smooth = (t) => t * t * (3 - 2 * t);
  const hexRGB = (h) => {
    let s = h.replace('#', '');
    if (s.length === 3) s = s.split('').map((c) => c + c).join('');
    const n = parseInt(s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const magnet = (t) => Math.pow(smooth(t), 1.4); // slow lift-off, quick snap

  function dockPos(line, im, q, out) {
    const g = line.geo, { W, H } = metrics;
    const tw = im.w / im.cols, th = im.h / im.rows;
    const dx = im.ox + (q.i + 0.5) * tw - line.lw / 2;
    const dy = im.oy + (q.j + 0.5) * th - line.lh / 2;
    out.x = W / 2 + line.lw / 2 + metrics.xBase + metrics.ax * line.lw + dx + (g.visible ? g.tk * dy : 0);
    out.y = g.visible ? H / 2 + g.sign * g.scr + g.sc * dy : g.sign > 0 ? H + 3 * th : -3 * th;
    out.sc = g.visible ? g.sc : 1;
    return out;
  }

  const tmp = { x: 0, y: 0, sc: 1 };
  let poolClear = true;
  function updatePool(dt, time) {
    const rv = cfg.reveal || {};
    const on = rv.on && rv.style === 'gather';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const { W, H } = metrics;
    if (!on) {
      if (!poolClear) { pctx.clearRect(0, 0, pool.width, pool.height); poolClear = true; }
      return;
    }
    if (pool.width !== Math.round(W * dpr) || pool.height !== Math.round(H * dpr)) {
      pool.width = Math.round(W * dpr); pool.height = Math.round(H * dpr);
    }
    pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pctx.clearRect(0, 0, W, H);
    poolClear = false;
    const flight = flightOf(rv);
    const amp = (rv.drift == null ? 0.5 : rv.drift);
    const push = rv.push == null ? 0.6 : rv.push;
    const start = rv.dotColor === 'custom' ? hexRGB(rv.dotFill || '#ffffff') : null;
    // a little under-damped for cursor nudges (tactile, one soft bounce), nearly
    // critical for long returns so a square flying home doesn't wobble
    const K = 140, C0 = 2 * Math.sqrt(K);
    const steps = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / steps;
    for (const line of lines) {
      if (!line.geo) continue;
      for (const im of line.imgs) {
        if (!im.squares || !im.colours || !im.w) continue;
        const tw = im.w / im.cols, th = im.h / im.rows;
        const R = Math.max(110, Math.max(tw, th) * 4.5);
        const cols = im.colours[0];
        const rgb0 = im.rgb0;
        for (const q of im.squares) {
          const prog = clamp(0, 1, (im.r - q.a) / flight);
          const e = magnet(prog);
          const d = dockPos(line, im, q, tmp);
          const free = 1 - e;
          // home, with a slow wander
          const hx = q.hx + Math.sin(time * q.w1 + q.p1) * tw * 0.35 * amp;
          const hy = q.hy + Math.cos(time * q.w2 + q.p2) * th * 0.35 * amp;
          // gentle arc toward the tile
          const mx = (hx + d.x) / 2, my = (hy + d.y) / 2;
          const vx = d.x - hx, vy = d.y - hy;
          const cx = mx - vy * q.ca * q.cs, cy = my + vx * q.ca * q.cs;
          const u = 1 - e;
          const ix = u * u * hx + 2 * u * e * cx + e * e * d.x;
          const iy = u * u * hy + 2 * u * e * cy + e * e * d.y;
          // a discontinuity in the path (loop wrap, reset) becomes offset, so the
          // square flies from where it was instead of teleporting
          if (!isNaN(q.lx) && Math.hypot(ix - q.lx, iy - q.ly) > H * 0.3) { q.ox += q.lx - ix; q.oy += q.ly - iy; }
          q.lx = ix; q.ly = iy;
          if (prog >= 1) { q.ox = q.oy = q.vx = q.vy = 0; continue; }
          for (let s = 0; s < steps; s++) {
            const C = C0 * (0.5 + 0.45 * Math.min(1, Math.hypot(q.ox, q.oy) / 160));
            let fx = -K * q.ox - C * q.vx, fy = -K * q.oy - C * q.vy;
            if (cursor && push > 0) {
              const px = ix + q.ox - cursor.x, py = iy + q.oy - cursor.y;
              const dist = Math.hypot(px, py) || 0.001;
              if (dist < R) {
                const f = push * 26000 * (1 - dist / R) * (1 - dist / R) * free;
                fx += (px / dist) * f; fy += (py / dist) * f;
              }
            }
            q.vx += fx * h; q.vy += fy * h;
            q.ox += q.vx * h; q.oy += q.vy * h;
          }
          const x = ix + q.ox, y = iy + q.oy;
          const hh = th * (1 + (d.sc - 1) * e);
          if (x < -tw || x > W + tw || y < -th || y > H + th) continue;
          if (start) {
            // custom starting colour, shifting to the tile's own colour in flight
            const c = rgb0[q.j * im.cols + q.i], t = smooth(prog);
            pctx.fillStyle = `rgb(${Math.round(start[0] + (c[0] - start[0]) * t)},${Math.round(start[1] + (c[1] - start[1]) * t)},${Math.round(start[2] + (c[2] - start[2]) * t)})`;
          } else pctx.fillStyle = cols[q.j * im.cols + q.i];
          pctx.fillRect(x - tw / 2, y - hh / 2, tw, hh);
        }
      }
    }
  }

  function paintGather(im) {
    const { ctx, canvas } = im;
    const W = canvas.width, H = canvas.height, r = im.r;
    const rv = cfg.reveal;
    const e = im.entry;
    if (!e || !e.ok || r <= 0 || !im.crop || !im.squares) return;
    const { sx, sy, sw, sh } = im.crop;
    if (r >= 1) { ctx.drawImage(e.img, sx, sy, sw, sh, 0, 0, W, H); return; }
    const G = GATHER_SPLIT(rv), flight = flightOf(rv);
    const rr = G < 1 ? clamp(0, 1, (r - G) / (1 - G)) : 0;
    const { cols, rows, colours } = im;
    const walk = (n, root) => {
      const gw = cols << n.d, gh = rows << n.d;
      const x0 = Math.round((n.i / gw) * W), x1 = Math.round(((n.i + 1) / gw) * W);
      const y0 = Math.round((n.j / gh) * H), y1 = Math.round(((n.j + 1) / gh) * H);
      if (!root && rr < n.t) return;
      if (rr >= n.done && rr > 0) ctx.drawImage(e.img, sx + (n.i / gw) * sw, sy + (n.j / gh) * sh, sw / gw, sh / gh, x0, y0, x1 - x0, y1 - y0);
      else if (rr < n.split || !n.kids) { ctx.fillStyle = colours[n.d][n.j * gw + n.i]; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); }
      else n.kids.forEach((k) => walk(k, false));
    };
    im.plan.forEach((n, idx) => {
      const q = im.squares[idx];
      if (r - q.a >= flight) walk(n, true); // docked
    });
  }

  function paintImg(im) {
    const { ctx, canvas } = im;
    const W = canvas.width, H = canvas.height, r = im.r;
    im.drawn = r;
    ctx.clearRect(0, 0, W, H);
    if (cfg.reveal && cfg.reveal.on && cfg.reveal.style === 'gather') return paintGather(im);
    const e = im.entry;
    if (!e || !e.ok || r <= 0 || !im.crop) return;
    const { sx, sy, sw, sh } = im.crop;
    if (r >= 1) { ctx.drawImage(e.img, sx, sy, sw, sh, 0, 0, W, H); return; }
    const { cols, rows, colours } = im;
    const walk = (n) => {
      if (r < n.t) return;
      const gw = cols << n.d, gh = rows << n.d;
      const x0 = Math.round((n.i / gw) * W), x1 = Math.round(((n.i + 1) / gw) * W);
      const y0 = Math.round((n.j / gh) * H), y1 = Math.round(((n.j + 1) / gh) * H);
      if (x1 <= x0 || y1 <= y0) { if (n.kids && r >= n.split) n.kids.forEach(walk); return; }
      if (r >= n.done) {
        ctx.drawImage(e.img, sx + (n.i / gw) * sw, sy + (n.j / gh) * sh, sw / gw, sh / gh, x0, y0, x1 - x0, y1 - y0);
      } else if (r < n.split) {
        ctx.fillStyle = colours[n.d][n.j * gw + n.i];
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      } else n.kids.forEach(walk);
    };
    im.plan.forEach(walk);
  }

  // u: where the image sits in the frame, 0 = bottom edge, 1 = top edge
  function updateReveal(line, u, visible, dt) {
    if (!line.imgs.length) return;
    const rv = cfg.reveal || {};
    for (const im of line.imgs) {
      if (!rv.on) im.r = 1;
      else if (rv.mode === 'time') {
        // a little hysteresis so an image parked on the trigger line can't flicker
        if (u >= rv.start) im.goal = 1;
        else if (u < rv.start - 0.015 || im.goal == null) im.goal = 0;
        const goal = im.goal;
        if (!visible) im.r = goal;
        else {
          const step = dt / Math.max(0.05, rv.duration);
          im.r = goal > im.r ? Math.min(1, im.r + step) : Math.max(0, im.r - step);
        }
      } else {
        const span = rv.end - rv.start;
        im.r = span <= 0.001 ? (u >= rv.start ? 1 : 0) : clamp(0, 1, (u - rv.start) / span);
      }
      if (visible && Math.abs(im.r - im.drawn) > 0.0004) paintImg(im);
    }
  }

  // ---------- geometry ----------
  // A line at layout distance s from centre is drawn at screen offset `scr`,
  // squashed to `sc`. Inside the focus band nothing happens; past it the stack
  // rolls over a drum of radius R, so lines compress and crowd toward the edge.
  function project(s) {
    const a = Math.abs(s);
    const { band, R } = metrics;
    if (a <= band || !isFinite(R)) return { scr: a, sc: 1, hidden: false };
    const th = (a - band) / R;
    if (th >= HALF_PI) return { scr: band + R, sc: 0, hidden: true };
    return { scr: band + R * Math.sin(th), sc: Math.cos(th), hidden: false };
  }

  function layout() {
    const r = el.getBoundingClientRect();
    const H = r.height || 1, W = r.width || 1;
    const t = cfg.type, ro = cfg.roll;
    let fs = (t.size / 100) * H;
    stage.style.setProperty('--fs', fs + 'px');
    applyStyle();
    if (t.fit) {
      let widest = 0;
      const n = cfg.lines.length;
      for (let i = 0; i < Math.min(n, lines.length); i++) widest = Math.max(widest, lines[i].el.offsetWidth);
      const max = W * (t.fitWidth / 100);
      if (widest > max) {
        fs *= max / widest;
        stage.style.setProperty('--fs', fs + 'px');
      }
    }
    const L = fs * t.leading;
    const half = H / 2;
    const band = clamp(0, half, ro.band * half);
    const theta = (ro.roll * Math.PI) / 180;
    const R = theta < 0.01 ? Infinity : Math.max(1, (half - band) / Math.sin(theta));
    metrics = { H, W, fs, L, band, R, half, edgeS: 0 };
    // edgeS: layout distance at which a line's near edge has left the frame
    // (or the drum has rolled it flat). Found by bisection; g(s) is monotone.
    const glyphHalf = L * 0.5;
    const g = (s) => { const p = project(s); return p.hidden ? Infinity : p.scr - p.sc * glyphHalf; };
    let lo = 0, hi = Math.max(H * 4, band + (isFinite(R) ? R * HALF_PI : H * 4));
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (g(m) >= half) hi = m; else lo = m; }
    metrics.edgeS = hi;

    const n = Math.max(1, cfg.lines.length);
    period = (n + (cfg.mode === 'loop' ? cfg.motion.loopGap : 0)) * L;
    if (cfg.mode === 'loop' && copiesNeeded(n) !== copies) { build(); applyStyle(); }
    for (const l of lines) {
      l.lw = l.el.offsetWidth; l.lh = l.el.offsetHeight;
      for (const im of l.imgs) { im.ox = im.el.offsetLeft; im.oy = im.el.offsetTop; im.w = im.el.offsetWidth; im.h = im.el.offsetHeight; }
    }
    homesDirty = true;
    prepareAll();
    clampTarget();
  }

  function range() {
    const n = Math.max(1, cfg.lines.length);
    return { start: -metrics.edgeS, end: (n - 1) * metrics.L + metrics.edgeS };
  }

  function clampTarget() {
    if (cfg.mode !== 'end') return;
    const { start, end } = range();
    target = clamp(start, end, target);
    y = clamp(start, end, y);
  }

  function applyStyle() {
    const t = cfg.type, im = cfg.img, ro = cfg.roll;
    const s = el.style;
    s.setProperty('--ts-bg', t.bg);
    s.setProperty('--ts-fg', t.fg);
    s.setProperty('--ts-font', cfg.fontFamily);
    s.setProperty('--ts-weight', t.weight);
    s.setProperty('--ts-track', t.tracking + 'em');
    s.setProperty('--ts-lead', t.leading);
    s.setProperty('--ts-align', t.align);
    s.setProperty('--ts-img-h', im.size + 'em');
    s.setProperty('--ts-img-w', im.size * im.aspect + 'em');
    s.setProperty('--ts-img-r', im.radius + 'em');
    s.setProperty('--ts-img-gap', im.gap + 'em');
    s.setProperty('--ts-img-off', im.offset + 'em');
    s.setProperty('--ts-fade', ro.fade + '%');
  }

  // ---------- render ----------
  const wrap = (v, p) => ((v % p) + p) % p;

  function render(dt) {
    const { L, band, half, edgeS } = metrics;
    const ro = cfg.roll;
    const n = Math.max(1, cfg.lines.length);
    const total = period * copies;
    const vNorm = vel / Math.max(1, L); // lines per second
    const alignX = cfg.type.align === 'left' ? 0 : cfg.type.align === 'right' ? -100 : -50;
    const xBase = cfg.type.align === 'left' ? -metrics.W * 0.46 : cfg.type.align === 'right' ? metrics.W * 0.46 : 0;
    metrics.xBase = xBase;
    metrics.ax = alignX / 100;

    for (const line of lines) {
      const k = Math.floor(line.index / n), i = line.index % n;
      let s = k * period + i * L - y;
      if (cfg.mode === 'loop') s = wrap(s + total / 2, total) - total / 2;
      const st = line.el.style;
      const sign = s < 0 ? -1 : 1;
      if (Math.abs(s) > edgeS + L) {
        if (st.visibility !== 'hidden') st.visibility = 'hidden';
        line.geo = { visible: false, sign };
        updateReveal(line, sign > 0 ? -1 : 2, false, dt);
        continue;
      }
      const p = project(s);
      if (p.hidden || p.sc < 0.02) { st.visibility = 'hidden'; line.geo = { visible: false, sign }; updateReveal(line, sign > 0 ? -1 : 2, false, dt); continue; }
      st.visibility = 'visible';
      updateReveal(line, 0.5 - (sign * p.scr) / metrics.H, true, dt);
      const e = clamp(0, 1, (p.scr - band) / Math.max(1, half - band));
      const ee = e * e * (3 - 2 * e);
      line.geo = { visible: true, sign, scr: p.scr, sc: p.sc, tk: Math.tan((-ro.slant * ee * Math.PI) / 180) };
      st.transform =
        `translate(${xBase}px, ${sign * p.scr}px) translate(${alignX}%, -50%) ` +
        `scaleY(${p.sc.toFixed(4)}) skewX(${(-ro.slant * ee).toFixed(3)}deg)`;
      st.opacity = (1 - ro.dim * Math.pow(e, 1.4)).toFixed(3);

      // per-word skew from scroll velocity, each word on its own lag
      if (ro.vskew) {
        for (const w of line.words) {
          const tau = 0.04 + ro.stagger * 0.5 * w.seed;
          const a = 1 - Math.exp(-dt / tau);
          w.v += (vNorm - w.v) * a;
          let amt = Math.tanh(w.v / 6);
          if (!ro.mirror) amt = Math.abs(amt);
          const deg = -ro.vskew * amt;
          w.el.style.transform = Math.abs(deg) < 0.05 ? '' : `skewX(${deg.toFixed(2)}deg)`;
        }
      } else if (line.words[0] && line.words[0].el.style.transform) {
        for (const w of line.words) w.el.style.transform = '';
      }
    }
    updatePool(dt, clock);
    if (onFrame) onFrame(api);
  }
  let clock = 0;

  function tick(time, deltaMs) {
    const dt = Math.min(0.1, Math.max(0.001, deltaMs / 1000));
    const tau = 0.012 + Math.pow(cfg.motion.inertia, 2) * 1.4;
    y += (target - y) * (1 - Math.exp(-dt / tau));
    if (Math.abs(target - y) < 0.01) y = target;
    const inst = (y - lastY) / dt;
    vel += (inst - vel) * (1 - Math.exp(-dt / 0.06));
    lastY = y;
    clock = time;
    render(dt);
  }

  // ---------- drivers ----------
  function nudge(dy) {
    target += dy;
    clampTarget();
  }

  function attachCapture() {
    observer = Observer.create({
      target: el,
      type: 'wheel,touch,pointer',
      preventDefault: true,
      wheelSpeed: 1,
      tolerance: 0,
      onChangeY(self) {
        const wheel = self.event && self.event.type === 'wheel';
        nudge((wheel ? 1 : -1) * self.deltaY * cfg.motion.speed);
      },
      onDragEnd(self) {
        // throw: carry release velocity forward, scaled by inertia
        nudge(-self.velocityY * cfg.motion.speed * 0.18 * (0.3 + cfg.motion.inertia));
      },
    });
    el.style.touchAction = 'none';
    el.style.cursor = 'grab';
  }

  function attachPage() {
    if (cfg.mode === 'end') {
      const { start, end } = range();
      const travel = end - start;
      trigger = ScrollTrigger.create({
        trigger: el,
        start: 'top top',
        end: () => '+=' + Math.max(1, (range().end - range().start) / cfg.motion.speed),
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate(self) {
          const r = range();
          target = r.start + self.progress * (r.end - r.start);
        },
      });
      target = y = start;
      void travel;
    } else {
      scrollHandler = () => { target = window.scrollY * cfg.motion.speed; };
      window.addEventListener('scroll', scrollHandler, { passive: true });
      scrollHandler();
      y = target;
    }
  }

  function detachDrivers() {
    if (observer) { observer.kill(); observer = null; }
    if (trigger) { trigger.kill(); trigger = null; }
    if (scrollHandler) { window.removeEventListener('scroll', scrollHandler); scrollHandler = null; }
    el.style.touchAction = '';
    el.style.cursor = '';
  }

  function attachDriver() {
    detachDrivers();
    // 'external' is the only change from the upstream type-scroll source: the
    // director owns scroll for the whole page and drives this beat via seek().
    if (cfg.drive === 'external') return;
    if (cfg.drive === 'page' && ScrollTrigger) attachPage();
    else attachCapture();
  }

  // ---------- lifecycle ----------
  const ro = new ResizeObserver(() => {
    layout();
    if (trigger) ScrollTrigger.refresh();
  });

  function keyOf(c) {
    return JSON.stringify([c.mode, c.lines, c.drive]);
  }

  function setConfig(next) {
    const prevKey = structureKey;
    const prevMode = cfg.mode, prevDrive = cfg.drive;
    cfg = next;
    structureKey = keyOf(cfg);
    if (structureKey !== prevKey) build();
    layout();
    if (structureKey !== prevKey) layout(); // copies may depend on fresh metrics
    if (cfg.mode !== prevMode || cfg.drive !== prevDrive) {
      attachDriver();
      reset();
    }
    render(1 / 60);
  }

  function reset() {
    if (cfg.mode === 'end') target = y = lastY = range().start;
    else target = y = lastY = 0;
    vel = 0;
  }

  function progress() {
    if (cfg.mode !== 'end') return null;
    const { start, end } = range();
    return (y - start) / Math.max(1, end - start);
  }

  function destroy() {
    gsap.ticker.remove(tick);
    detachDrivers();
    ro.disconnect();
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerleave', onLeave);
    pool.remove();
    stage.remove();
    el.classList.remove('ts-frame');
  }

  const api = {
    setConfig,
    reset,
    destroy,
    relayout: layout,
    progress,
    get velocity() { return vel; },
    get position() { return y; },
    get target() { return target; },
    get reveals() { return lines.flatMap((l) => l.imgs.map((im) => +im.r.toFixed(3))); },
    set onFrame(fn) { onFrame = fn; },
    seek(p) { const r = range(); target = r.start + clamp(0, 1, p) * (r.end - r.start); },
  };

  // init
  structureKey = keyOf(cfg);
  build();
  layout();
  layout();
  attachDriver();
  reset();
  ro.observe(el);
  gsap.ticker.add(tick);
  if (document.fonts) document.fonts.ready.then(() => layout());
  return api;
}

// Styles live here too so an embed carries exactly what the editor renders.
export const TYPE_SCROLL_CSS = `
.ts-frame{position:relative;overflow:hidden;background:var(--ts-bg,#05050a);color:var(--ts-fg,#fff);user-select:none;-webkit-user-select:none;contain:layout paint}
.ts-stage{position:absolute;inset:0;font-family:var(--ts-font);font-weight:var(--ts-weight,500);font-size:var(--fs,64px);letter-spacing:var(--ts-track,-0.03em);line-height:var(--ts-lead,1.12);
  -webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 var(--ts-fade,14%),#000 calc(100% - var(--ts-fade,14%)),transparent 100%);
          mask-image:linear-gradient(to bottom,transparent 0,#000 var(--ts-fade,14%),#000 calc(100% - var(--ts-fade,14%)),transparent 100%)}
.ts-line{position:absolute;left:50%;top:50%;white-space:pre;text-align:var(--ts-align,center);transform-origin:50% 50%;will-change:transform,opacity;visibility:hidden;font-kerning:normal}
.ts-word{display:inline-block;transform-origin:50% 70%}
.ts-img{display:inline-block;width:var(--ts-img-w,.82em);height:var(--ts-img-h,.82em);border-radius:var(--ts-img-r,.16em);margin:0 var(--ts-img-gap,0);vertical-align:var(--ts-img-off,-0.06em);overflow:hidden}
.ts-img canvas{display:block;width:100%;height:100%}
.ts-pool{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
`;

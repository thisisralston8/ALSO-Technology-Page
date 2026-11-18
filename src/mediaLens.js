/* The platform's cursor lens (platform.js, after Atelier UI's "Lens Media")
   as a hover effect on a single image or video: a soft circle that follows
   the cursor, pulling the picture in and splitting its colours towards its
   edge. Same shader maths and the same settings (lensSize, lensSoftness,
   lensAberration, lensDispersion, lensRefraction, lensSmoothing); sizes are
   shares of the picture's height.

   One WebGL canvas, shared: it is laid over whichever figure is hovered and
   draws that figure's <img> or <video> exactly as the page shows it (cover
   or contain, at its object-position), so with the lens faded out it is the
   same picture. It only runs while a lens is showing; the canvas leaves when
   the lens has faded away. Plain WebGL, so the modal doesn't need three.js. */

const VERT = `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`;
const FRAG = `
  precision highp float;
  #define MAX_DISPERSION 64
  varying vec2 vUv;
  uniform sampler2D uMap;
  uniform vec2 uMouse;
  uniform float uAspect;
  uniform float uSize;
  uniform float uSoftness;
  uniform float uAberration;
  uniform float uRefraction;
  uniform float uHover;
  uniform int uDispersion;
  // Where the picture sits in the figure (0–1 of the figure, y up): offset and size.
  uniform vec2 uOff;
  uniform vec2 uScale;
  vec4 pic(vec2 uv) {
    vec2 t = (uv - uOff) / uScale;
    if (t.x < 0.0 || t.x > 1.0 || t.y < 0.0 || t.y > 1.0) return vec4(0.0);
    return texture2D(uMap, vec2(t.x, 1.0 - t.y));
  }
  void main() {
    vec2 toCenter = vUv - uMouse;
    float radius = length(vec2(toCenter.x * uAspect, toCenter.y));
    float mask = (1.0 - smoothstep(uSize, uSize + uSoftness, radius)) * uHover;
    vec2 refracted = vUv - toCenter * uRefraction * mask;
    vec2 shift = toCenter * uAberration * mask;
    vec4 color = vec4(0.0);
    vec4 total = vec4(0.0);
    for (int i = 0; i < MAX_DISPERSION; i++) {
      if (i >= uDispersion) break;
      float t = (float(i) + 0.5) / float(uDispersion);
      vec3 w3 = clamp(1.0 - 2.0 * abs(t - vec3(0.0, 0.5, 1.0)), 0.0, 1.0);
      vec4 w = vec4(w3, (w3.r + w3.g + w3.b) / 3.0);
      color += pic(refracted + shift * (1.0 - 2.0 * t)) * w;
      total += w;
    }
    gl_FragColor = color / max(total, vec4(1e-4));
  }
`;

export function createMediaLens() {
  const canHover = matchMedia('(hover: hover) and (pointer: fine)');
  let canvas = null, gl = null, prog = null, tex = null, U = null, failed = false;
  let cfg = {};
  let fig = null;          // the figure the lens is on
  let leaving = null;      // a figure the lens is fading off
  const lens = { x: 0.5, y: 0.5, hover: 0 };
  const pointer = { x: 0, y: 0 };
  let raf = 0, last = 0, uploaded = null;

  function init() {
    if (gl || failed) return !!gl;
    canvas = document.createElement('canvas');
    canvas.className = 'xm__lens';
    canvas.setAttribute('aria-hidden', 'true');
    gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) { failed = true; return false; }
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { failed = true; gl = null; return false; }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    U = Object.fromEntries(['uMap', 'uMouse', 'uAspect', 'uSize', 'uSoftness', 'uAberration', 'uRefraction', 'uHover', 'uDispersion', 'uOff', 'uScale']
      .map((n) => [n, gl.getUniformLocation(prog, n)]));
    gl.uniform1i(U.uMap, 0);
    return true;
  }

  const pictureOf = (f) => f?.querySelector(':scope > img, :scope > video');
  const ready = (m) => (m.tagName === 'VIDEO' ? m.readyState >= 2 && m.videoWidth : m.complete && m.naturalWidth);

  // Where the picture is drawn inside its figure: object-fit and
  // object-position, as the browser lays it out.
  function placement(m, W, H) {
    const nw = m.videoWidth || m.naturalWidth, nh = m.videoHeight || m.naturalHeight;
    const cs = getComputedStyle(m);
    const k = cs.objectFit === 'contain' ? Math.min(W / nw, H / nh) : Math.max(W / nw, H / nh);
    const dw = nw * k, dh = nh * k;
    const [px, py] = cs.objectPosition.split(' ').map((v) => (v.endsWith('%') ? parseFloat(v) / 100 : null));
    const ox = (W - dw) * (px ?? 0.5), oy = (H - dh) * (py ?? 0.5);
    // Into 0–1 of the figure, y up.
    return { off: [ox / W, 1 - (oy + dh) / H], scale: [dw / W, dh / H] };
  }

  function draw() {
    const f = fig || leaving;
    const m = pictureOf(f);
    if (!f || !m || !ready(m)) return;
    if (canvas.parentNode !== f) f.appendChild(canvas);
    const W = f.clientWidth, H = f.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    gl.viewport(0, 0, cw, ch);
    if (m.tagName === 'VIDEO' || uploaded !== m) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, m);
      uploaded = m;
    }
    const { off, scale } = placement(m, W, H);
    gl.uniform2f(U.uOff, off[0], off[1]);
    gl.uniform2f(U.uScale, scale[0], scale[1]);
    gl.uniform2f(U.uMouse, lens.x, lens.y);
    gl.uniform1f(U.uAspect, W / H);
    gl.uniform1f(U.uSize, cfg.lensSize ?? 0.12);
    gl.uniform1f(U.uSoftness, cfg.lensSoftness ?? 0.5);
    gl.uniform1f(U.uAberration, cfg.lensAberration ?? 0.18);
    gl.uniform1f(U.uRefraction, cfg.lensRefraction ?? 0.4);
    gl.uniform1i(U.uDispersion, Math.max(1, Math.min(64, Math.round(cfg.lensDispersion ?? 35))));
    gl.uniform1f(U.uHover, lens.hover);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function tick(now) {
    raf = 0;
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    const f = fig || leaving;
    if (!f) { stop(); return; }
    const r = f.getBoundingClientRect();
    const target = fig ? 1 : 0;
    if (fig && r.width && r.height) {
      const tx = (pointer.x - r.left) / r.width, ty = 1 - (pointer.y - r.top) / r.height;
      // Jump to the cursor when the lens is out of sight, so it never sweeps in.
      const a = lens.hover < 0.001 ? 1 : 1 - Math.exp(-(cfg.lensSmoothing ?? 7) * dt);
      lens.x += (tx - lens.x) * a; lens.y += (ty - lens.y) * a;
    }
    lens.hover += (target - lens.hover) * (1 - Math.exp(-(cfg.lensSmoothing ?? 7) * dt));
    if (!fig && lens.hover < 0.002) { lens.hover = 0; stop(); return; }
    draw();
    raf = requestAnimationFrame(tick);
  }
  const run = () => { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } };
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    leaving = null;
    canvas?.remove();
    uploaded = null;
  }

  return {
    setConfig(c) { cfg = c || {}; if (cfg.modalLens === 'off') this.leave(true); },
    // The pointer is over `f` (a figure with a picture), at clientX/Y.
    enter(f, x, y) {
      pointer.x = x; pointer.y = y;
      if (cfg.modalLens === 'off' || !canHover.matches || !pictureOf(f) || !init()) return;
      if (fig === f) return;
      if (leaving === f) { fig = f; leaving = null; run(); return; }   // back before it faded
      if (fig || leaving) { stop(); lens.hover = 0; }   // a new picture starts fresh
      fig = f;
      run();
    },
    move(x, y) { pointer.x = x; pointer.y = y; },
    leave(now = false) {
      if (!fig && !leaving) return;
      if (now) { fig = null; lens.hover = 0; stop(); return; }
      if (fig) { leaving = fig; fig = null; }
      run();
    },
    destroy() { this.leave(true); gl?.getExtension('WEBGL_lose_context')?.loseContext(); gl = null; },
  };
}

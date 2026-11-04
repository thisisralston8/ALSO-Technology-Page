/* Beat 5 — Isometric platform.

   Picks up Traffic's last frame (the dark dot in "Start small") by *joining* it
   (`join: true`). Then, on scroll:

     wipe       black rises from the bottom of the screen; where it covers the
                dot, the dot is white
     reveal     the white dot is the top face of the platform, seen from
                straight above. The camera tips down and pulls back, the white
                face fades, and the three layers appear beneath it
     hero       the headline fades in, true centre, over the whole platform
     layers     the camera moves in on the top layer (Hardware), the middle
                (Software) and the base (Autonomy), each with its own text
     collapse   the camera rises back overhead and the platform closes up into
                a single white dot on black, for whatever comes next

   The visual, simplified from the iso-flow prototype. There is no modelled
   geometry: each layer is a stack of flat, soft-edged, horizontal planes, and
   seen from above their edges read as a solid block. Each plane is coloured
   along a gradient up its layer, and the planes drift slowly upwards (on
   time, like the grain — ambient, not choreography) so the stripes breathe.
   One instanced draw call per layer, no textures.

   The camera is a handful of stops (dot, hero, three layers, dot); scroll
   moves between them with one easing per leg and holds at each. */

// three.js is loaded on demand (see loadGL) so it isn't in the page's first
// download: nothing needs it until this section is near.
let THREE = null;
import { createLineReveal } from '../lineReveal.js';
import { span as gridSpan } from '../grid.js';
import { MODAL_CONTENT_DEFAULTS, MODAL_CONTENT_MOBILE } from '../modalContent.js';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
const smooth = (a, b, x) => { const v = clamp01((x - a) / (b - a || 1e-6)); return v * v * (3 - 2 * v); };
const span = (p, a, b) => (b > a ? clamp01((p - a) / (b - a)) : p >= b ? 1 : 0);
const lerp = (a, b, t) => a + (b - a) * t;
const DEG = Math.PI / 180;

// The shaders write straight to the screen, so a colour goes in as its raw
// 0–1 sRGB values: the hex you set is the hex you see.
function rgb(hex) {
  const h = String(hex || '#000').replace('#', '');
  const v = h.length === 3 ? h.split('').map((x) => x + x).join('') : h.padEnd(6, '0');
  const n = parseInt(v.slice(0, 6), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const VERT = /* glsl */`
  attribute vec4 aColor;
  varying vec2 vUv;
  varying vec4 vColor;
  void main() {
    vUv = uv;
    vColor = aColor;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;
const FRAG = /* glsl */`
  precision highp float;
  uniform float uFeather;
  uniform float uOpacity;
  uniform float uStripes;   // how much darker each plane's rim is
  varying vec2 vUv;
  varying vec4 vColor;
  void main() {
    float f = max(uFeather, 1e-4);
    float m = smoothstep(0.0, f, vUv.x) * smoothstep(0.0, f, 1.0 - vUv.x)
            * smoothstep(0.0, f, vUv.y) * smoothstep(0.0, f, 1.0 - vUv.y);
    // A darker rim on every plane: seen edge-on down the side of a block,
    // the rims are what read as its stripes.
    float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    float rim = 1.0 - uStripes * (1.0 - smoothstep(f, f + 0.06, e));
    gl_FragColor = vec4(vColor.rgb * rim, vColor.a * m * uOpacity);
  }
`;

/* The cursor lens, after Atelier UI's "Lens Media": a soft circle that
   follows the cursor over the platform, pulling the picture inwards
   (refraction) and splitting it into a spectrum towards its edge (chromatic
   aberration, `uDispersion` samples from red through green to blue). Run as
   a second pass over the drawn scene, and only while the lens is showing. */
const LENS_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const LENS_FRAG = /* glsl */`
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
  void main() {
    vec2 toCenter = vUv - uMouse;
    float radius = length(vec2(toCenter.x * uAspect, toCenter.y));
    float mask = (1.0 - smoothstep(uSize, uSize + uSoftness, radius)) * uHover;
    vec2 refracted = vUv - toCenter * uRefraction * mask;
    vec2 shift = toCenter * uAberration * mask;
    vec3 color = vec3(0.0), total = vec3(0.0);
    for (int i = 0; i < MAX_DISPERSION; i++) {
      if (i >= uDispersion) break;
      float t = (float(i) + 0.5) / float(uDispersion);
      vec3 w = clamp(1.0 - 2.0 * abs(t - vec3(0.0, 0.5, 1.0)), 0.0, 1.0);
      color += texture2D(uMap, refracted + shift * (1.0 - 2.0 * t)).rgb * w;
      total += w;
    }
    gl_FragColor = vec4(color / max(total, vec3(1e-4)), 1.0);
  }
`;

// Layer 1 is the top of the platform (Hardware), layer 3 the base (Autonomy).
const LAYERS = [1, 2, 3];
const MAX_PLANES = 160;

export function createPlatform(el, config) {
  let cfg = config;
  let progress = 0;
  let prev = null;        // Traffic's api, once the director joins us to it

  el.classList.add('plat');

  // Day: the previous beat's background, with its dark dot. Night: everything
  // else, revealed from the bottom by the wipe.
  const day = document.createElement('div');
  day.className = 'plat__day';
  const dayDot = document.createElement('div');
  dayDot.className = 'plat__dot';
  day.appendChild(dayDot);

  const night = document.createElement('div');
  night.className = 'plat__night';
  const canvas = document.createElement('canvas');
  canvas.className = 'plat__gl';
  const nightDot = document.createElement('div');
  nightDot.className = 'plat__dot';
  const copy = document.createElement('div');
  copy.className = 'plat__copy';
  night.append(canvas, nightDot, copy);
  el.append(day, night);

  const hero = document.createElement('p');
  hero.className = 'plat__hero';
  const blocks = LAYERS.map(() => {
    const b = document.createElement('div');
    b.className = 'plat__layer';
    const h = document.createElement('h3');
    const p = document.createElement('p');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'plat__btn';
    b.append(h, p, btn);
    return { b, h, p, btn };
  });
  // Explore opens the layer's modal (modal.js, set up by main.js): the beat
  // only says which block was clicked, it doesn't run the modal itself.
  // It gets every layer's block, so it can move between them and close back
  // into whichever one it ends on.
  const layerEls = blocks.map((x) => ({ block: x.b, heading: x.h, button: x.btn }));
  blocks.forEach((x, i) => x.btn.addEventListener('click', () => {
    el.dispatchEvent(new CustomEvent('plat:explore', { bubbles: true, detail: { n: i + 1, layers: layerEls } }));
  }));
  copy.append(hero, ...blocks.map((x) => x.b));
  // Line reveals on the headline and each layer's headline and body, scrubbed
  // by this beat's own text timeline (see lineReveal.js).
  const reveals = [hero, ...blocks.flatMap((x) => [x.h, x.p])].map((e) => ({ e, r: createLineReveal(e) }));
  let textKey = '';

  /* ---------- three ----------
     Set up once three.js has loaded (loadGL). Until then the day / night /
     dot layers — all plain DOM — carry the section, including the white dot
     the platform opens out of, so the join from Traffic doesn't wait on it. */

  let renderer = null, scene = null, camera = null, pivot = null, content = null, planeGeo = null;
  let stacks = null, cap = null, M = null, Q = null, Vp = null, Vs = null;
  const phone = matchMedia('(max-width: 767px)').matches;

  function initGL(T) {
    THREE = T;
    // On phones: no antialiasing and at most 1.5× pixels — the planes are soft
    // anyway, and this is most of the GPU cost.
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !phone, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(phone ? 1.5 : 2, window.devicePixelRatio || 1));
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(22, 1, 0.1, 400);

    // pivot (at the camera's focus point: scale + tilt) -> content (the stack,
    // base at y = 0). Tilting the pivot turns the platform about what you're
    // looking at instead of swinging it round its base.
    pivot = new THREE.Group();
    content = new THREE.Group();
    pivot.add(content);
    scene.add(pivot);

    planeGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);   // lying flat, facing up

    // Painted bottom to top (the camera is always above): base, middle, top, cap.
    stacks = {};
    [3, 2, 1].forEach((n, i) => { stacks[n] = makeStack(MAX_PLANES); stacks[n].mesh.renderOrder = i; });
    // The cap: a plain face on top of the top layer. It is the white dot.
    cap = makeStack(1);
    cap.mesh.renderOrder = 10;

    // The lens pass: the scene is drawn into `lens.target` (made on first
    // use, at the canvas's pixel size), then this quad draws it to the screen
    // through the lens.
    lens.scene = new THREE.Scene();
    lens.camera = new THREE.Camera();
    lens.mat = new THREE.ShaderMaterial({
      vertexShader: LENS_VERT, fragmentShader: LENS_FRAG,
      depthTest: false, depthWrite: false,
      uniforms: {
        uMap: { value: null }, uMouse: { value: new THREE.Vector2(0.5, 0.5) }, uAspect: { value: 1 },
        uSize: { value: 0.12 }, uSoftness: { value: 0.5 }, uAberration: { value: 0.18 },
        uRefraction: { value: 0.4 }, uHover: { value: 0 }, uDispersion: { value: 35 },
      },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), lens.mat);
    quad.frustumCulled = false;
    lens.scene.add(quad);

    M = new THREE.Matrix4();
    Q = new THREE.Quaternion();
    Vp = new THREE.Vector3();
    Vs = new THREE.Vector3();
    if (geo.W && geo.H) renderer.setSize(geo.W, geo.H, false);
  }

  let loading = null;
  function loadGL() {
    if (!loading) loading = import('three').then((T) => { initGL(T); render(progress); });
    return loading;
  }
  // Start the download once the page has settled, so it's ready long before
  // anyone scrolls this far — without competing with the first screen.
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
  if (document.readyState === 'complete') idle(loadGL); else addEventListener('load', () => idle(loadGL), { once: true });

  function makeStack(max) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uFeather: { value: 0 }, uOpacity: { value: 1 }, uStripes: { value: 0 } },
    });
    const mesh = new THREE.InstancedMesh(planeGeo, mat, max);
    const color = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    color.setUsage(THREE.DynamicDrawUsage);
    mesh.geometry = planeGeo.clone();
    mesh.geometry.setAttribute('aColor', color);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    content.add(mesh);
    return { mesh, mat, color };
  }

  /* ---------- geometry ---------- */

  const geo = { W: 0, H: 0, layers: {}, total: 1, dot: null };
  const L = (n, k) => cfg[`layer${n}${k}`];

  function computeGeometry() {
    geo.W = el.clientWidth;
    geo.H = el.clientHeight;
    if (renderer && geo.W && geo.H) renderer.setSize(geo.W, geo.H, false);
    // Base upwards.
    let y = 0;
    [3, 2, 1].forEach((n) => {
      const h = Math.max(0.05, L(n, 'Height'));
      geo.layers[n] = { y0: y, y1: y + h, w: Math.max(0.05, L(n, 'Width')) };
      y += h + cfg.layerGap;
    });
    geo.total = Math.max(0.1, y - cfg.layerGap);
    syncDot();
    layoutText();
  }

  // Where Traffic left its dot. Falls back to a centred dot.
  function syncDot() {
    const d = prev?.exitDot?.();
    const s = d ? d.rect.w : cfg.dotSize;
    geo.dot = d ? { ...d.rect } : { x: geo.W / 2 - s / 2, y: geo.H / 2 - s / 2, w: s, h: s };
    geo.dayBg = d?.bg || cfg.dayBg;
    geo.dayDot = d?.colour || cfg.dayDot;
    // Anything the previous beat still has on screen (Traffic's "Start
    // small"), drawn on the day layer so the dark rises over it.
    if (geo.decor !== (d?.decor || null)) { geo.decor?.remove(); geo.decor = d?.decor || null; if (geo.decor) day.prepend(geo.decor); }
  }

  /* ---------- text ---------- */

  function layoutText() {
    el.style.setProperty('--plat-night', cfg.night);
    el.style.setProperty('--plat-fg', cfg.fg);
    day.style.background = geo.dayBg;
    // This runs often while the dot opens, so only re-split when the text
    // or its type actually changed. (Setting text on a split element would be
    // undone by its revert, so un-split first.)
    // Across, the text sits on the layout grid (grid.js).
    const heroBox = gridSpan(geo.W, cfg.heroCol, cfg.heroSpan);
    const textBox = gridSpan(geo.W, cfg.textCol, cfg.textSpan);
    const key = JSON.stringify([cfg.heroText, cfg.heroSize, Math.round(heroBox.w), Math.round(textBox.w), cfg.titleSize, cfg.bodySize,
      ...[1, 2, 3].flatMap((n) => [L(n, 'Title'), L(n, 'Body')])]);
    const resplit = key !== textKey;
    if (resplit) reveals.forEach(({ r }) => r.unsplit());
    if (resplit) hero.textContent = cfg.heroText;
    Object.assign(hero.style, {
      fontSize: `${cfg.heroSize}px`, top: `${cfg.heroTextY * 100}%`,
      left: `${heroBox.x}px`, width: `${heroBox.w}px`, textAlign: cfg.heroAlign,
    });
    blocks.forEach((x, i) => {
      const n = i + 1;
      if (resplit) {
        x.h.textContent = L(n, 'Title');
        x.p.textContent = L(n, 'Body');
      }
      x.btn.textContent = L(n, 'Button');
      x.btn.style.display = L(n, 'Button') ? '' : 'none';
      Object.assign(x.b.style, {
        left: `${textBox.x}px`, width: `${textBox.w}px`, top: `${cfg.textY * 100}%`, textAlign: cfg.textAlign,
      });
      x.h.style.fontSize = `${cfg.titleSize}px`;
      x.p.style.fontSize = `${cfg.bodySize}px`;
    });
    [dayDot, nightDot].forEach((d) => Object.assign(d.style, {
      left: `${geo.dot.x}px`, top: `${geo.dot.y}px`, width: `${geo.dot.w}px`, height: `${geo.dot.h}px`,
    }));
    dayDot.style.background = geo.dayDot;
    nightDot.style.background = cfg.dotColour;
    if (resplit) { textKey = key; reveals.forEach(({ r }) => r.split()); }
  }

  /* ---------- the timeline ----------
     After the wipe, the rest of the beat is five equal legs between six
     stops: dot, hero, layer 1, 2, 3, dot. The camera holds at each middle
     stop for `hold` of a leg, and their text shows around that hold. */

  const STOPS = ['dot', 'hero', 1, 2, 3, 'dot'];

  function timeline() {
    // If the previous beat already brought the dark in (Traffic scrolls it up
    // as part of its page), there's nothing to wipe: start straight on the dot.
    const dark = String(geo.dayBg || '').toLowerCase() === String(cfg.night).toLowerCase();
    const w = dark ? 0 : clamp01(cfg.wipeEnd);
    const leg = (1 - w) / (STOPS.length - 1);
    const hw = (clamp01(cfg.hold) * leg) / 2;
    return STOPS.map((s, i) => {
      const T = w + i * leg;
      const h = s === 'dot' ? 0 : hw;
      return { s, T, a: T - h, b: T + h, leg };
    });
  }

  // px per world unit at the focus point, before scaling.
  const pxPerUnit = () => geo.H / (2 * cfg.distance * Math.tan((cfg.fov * DEG) / 2));

  // Scale at which the whole platform stands about half the screen tall —
  // or, on a screen taller than it is wide (a phone), about half its width,
  // so it isn't sized by a height it can't fit across.
  const fitScale = () => Math.min(0.5 * geo.H, 0.55 * geo.W) / (geo.total * pxPerUnit());

  function pose(stop) {
    if (stop === 'dot') {
      // Straight down onto the top face, which is exactly the dot's size and
      // place on screen.
      const top = geo.layers[1];
      return {
        focus: top.y1 / geo.total, scale: geo.dot.w / (top.w * pxPerUnit()),
        x: (geo.dot.x + geo.dot.w / 2) / geo.W - 0.5, y: (geo.dot.y + geo.dot.h / 2) / geo.H - 0.5,
        elev: 89.9, azim: cfg.heroAzim, cap: 1,
      };
    }
    const k = stop === 'hero' ? 'hero' : `view${stop}`;
    return {
      focus: cfg[`${k}Focus`], scale: fitScale() * cfg[`${k}Zoom`],
      x: cfg[`${k}X`], y: cfg[`${k}Y`], elev: cfg[`${k}Elev`], azim: cfg[`${k}Azim`], cap: 0,
    };
  }

  function stateAt(p) {
    const tl = timeline();
    const wipe = ease(span(p, 0, tl[0].T));
    let cam, cap;
    const at = tl.find((s) => p >= s.a && p <= s.b);
    if (p <= tl[0].T) { cam = pose('dot'); cap = 1; }
    else if (at) { cam = pose(at.s); cap = cam.cap; }
    else {
      // Between two stops: the leg from the last hold that ended to the next.
      let i = 0;
      for (let j = 0; j < tl.length - 1; j++) if (tl[j].b < p) i = j;
      const A = tl[i], B = tl[i + 1];
      const u = span(p, A.b, B.a);
      const e = ease(u);
      const pa = pose(A.s), pb = pose(B.s);
      cam = {
        focus: lerp(pa.focus, pb.focus, e),
        // Size changes by orders of magnitude (a dot to a platform), so it
        // moves in proportion, not in px.
        scale: Math.exp(lerp(Math.log(pa.scale), Math.log(pb.scale), e)),
        x: lerp(pa.x, pb.x, e), y: lerp(pa.y, pb.y, e),
        elev: lerp(pa.elev, pb.elev, e), azim: lerp(pa.azim, pb.azim, e),
      };
      // The white face lifts off early in the leg out of the dot, and
      // settles back late in the leg into the last one.
      const f = Math.max(1e-3, cfg.capFade);
      cap = A.s === 'dot' ? 1 - smooth(0, f, u) : B.s === 'dot' ? smooth(1 - f, 1, u) : 0;
    }
    // Text: around each stop's hold.
    const fade = (s) => {
      const d = (clamp01(cfg.textFade) * s.leg) / 2;
      return smooth(s.a - d, s.a + d, p) * (1 - smooth(s.b - d, s.b + d, p));
    };
    const text = { hero: fade(tl[1]), 1: fade(tl[2]), 2: fade(tl[3]), 3: fade(tl[4]) };
    return { wipe, cam, cap, text, gl: p >= tl[0].T };
  }

  /* ---------- render ---------- */

  let clock = 0;                                     // seconds of ambient motion
  const tilt = { x: 0, y: 0, vx: 0, vy: 0 };
  const mouse = { x: 0, y: 0 };
  // The lens: where it is on the canvas (0–1, y up), how much it's showing,
  // and where the cursor is (client px, or null when it's off the page or
  // not a mouse). Like the lean, it runs on time, never on scroll.
  const lens = { x: 0.5, y: 0.5, hover: 0, reveal: 0, scene: null, camera: null, mat: null, target: null };
  const pointer = { x: 0, y: 0, in: false };
  const canHover = matchMedia('(hover: hover) and (pointer: fine)');
  const lensOn = () => cfg.lens === 'on' && canHover.matches;

  function render(p) {
    if (!geo.W) computeGeometry();
    if (!geo.W) return;
    if (p < 0.02 || !geo.dot) { syncDot(); layoutText(); }
    const st = stateAt(p);

    // Wipe.
    night.style.clipPath = st.wipe >= 1 ? '' : `inset(${((1 - st.wipe) * 100).toFixed(3)}% 0 0 0)`;
    day.style.visibility = st.wipe >= 1 ? 'hidden' : '';
    const gl = st.gl && !!renderer;
    nightDot.style.visibility = gl ? 'hidden' : '';
    canvas.style.visibility = gl ? '' : 'hidden';

    // Text.
    const show = (e, o, rise) => {
      e.style.opacity = o >= 1 ? '' : o.toFixed(3);
      e.style.visibility = o > 0.001 ? '' : 'hidden';
      e.style.translate = rise ? `0 ${((1 - o) * cfg.textRise).toFixed(2)}px` : '';
    };
    show(hero, st.text.hero, true);
    blocks.forEach((x, i) => show(x.b, st.text[i + 1], true));
    // Lines rise in as each text comes in, and sink back as it goes.
    reveals[0].r.set(st.text.hero);
    blocks.forEach((x, i) => { reveals[1 + i * 2].r.set(st.text[i + 1]); reveals[2 + i * 2].r.set(st.text[i + 1]); });

    // The platform itself, once three.js is here (it's fetched on idle; this
    // only waits if someone gets here first). Until then the DOM dot stays.
    if (st.gl && !renderer) loadGL();
    if (st.gl && renderer) draw(st);
    drawnAt = progress;
  }

  function draw(st) {
    const reveal = 1 - st.cap;
    const c = st.cam;

    // Camera: orbit the focus point at a fixed distance; size is the scale of
    // the platform, not the camera's distance, so the perspective never changes.
    const fy = c.focus * geo.total;
    pivot.position.set(0, fy * c.scale, 0);
    pivot.scale.setScalar(c.scale);
    content.position.set(0, -fy, 0);
    // Ambient: a slow float and a little lean towards the cursor, both held
    // still while the platform is still the dot.
    const fl = Math.sin(clock * Math.PI * 2 * cfg.floatSpeed);
    const fl2 = Math.sin(clock * Math.PI * 2 * cfg.floatSpeed * 0.73 + 1.7);
    pivot.rotation.set(
      (tilt.y * cfg.tilt + fl2 * cfg.float) * DEG * reveal,
      (tilt.x * cfg.tilt + fl * cfg.float) * DEG * reveal,
      0,
    );
    const el_ = c.elev * DEG, az = c.azim * DEG, d = cfg.distance;
    camera.position.set(d * Math.cos(el_) * Math.sin(az), fy * c.scale + d * Math.sin(el_), d * Math.cos(el_) * Math.cos(az));
    camera.up.set(0, 1, 0);
    camera.lookAt(0, fy * c.scale, 0);
    camera.fov = cfg.fov;
    camera.aspect = geo.W / geo.H;
    camera.setViewOffset(geo.W, geo.H, -c.x * geo.W, -c.y * geo.H, geo.W, geo.H);
    camera.updateProjectionMatrix();

    // Layers.
    const phase = ((clock * cfg.flow) % 1 + 1) % 1;
    LAYERS.forEach((n) => {
      const s = stacks[n], g = geo.layers[n];
      const n0 = Math.max(2, Math.min(MAX_PLANES, Math.round(L(n, 'Planes'))));
      const top = rgb(L(n, 'Top')), bot = rgb(L(n, 'Bottom'));
      const h = g.y1 - g.y0;
      const step = h / (n0 - 1);
      const op = L(n, 'Opacity');
      const arr = s.color.array;
      // The body drifts up through the layer; the top face stays put.
      for (let k = 0; k < n0; k++) {
        const face = k === n0 - 1;
        const q = face ? n0 - 1 : k + phase;
        const y = g.y0 + q * step;
        const t = (y - g.y0) / (h || 1);
        let a = face ? Math.max(op, cfg.face) : op;
        if (!face) {
          if (k === 0) a *= phase;                                  // fading in at the bottom
          a *= 1 - smooth(n0 - 2, n0 - 1, q);                       // merging into the face
        }
        Vp.set(0, y, 0);
        Vs.set(g.w, 1, g.w);
        M.compose(Vp, Q, Vs);
        s.mesh.setMatrixAt(k, M);
        arr[k * 4] = lerp(bot[0], top[0], t);
        arr[k * 4 + 1] = lerp(bot[1], top[1], t);
        arr[k * 4 + 2] = lerp(bot[2], top[2], t);
        arr[k * 4 + 3] = a;
      }
      s.mesh.count = n0;
      s.mesh.instanceMatrix.needsUpdate = true;
      s.color.needsUpdate = true;
      s.mat.uniforms.uFeather.value = L(n, 'Feather');
      s.mat.uniforms.uStripes.value = L(n, 'Stripes');
      s.mat.uniforms.uOpacity.value = reveal;
      s.mat.blending = L(n, 'Blend') === 'glow' ? THREE.AdditiveBlending : THREE.NormalBlending;
      s.mesh.visible = reveal > 0.001;
    });

    // Cap: the white face, sitting on the top layer, crisp while it's the dot.
    const t1 = geo.layers[1];
    Vp.set(0, t1.y1 + 1e-3, 0);
    Vs.set(t1.w, 1, t1.w);
    M.compose(Vp, Q, Vs);
    cap.mesh.setMatrixAt(0, M);
    const cc = rgb(cfg.dotColour);
    cap.color.array.set([cc[0], cc[1], cc[2], 1]);
    cap.mesh.count = 1;
    cap.mesh.instanceMatrix.needsUpdate = true;
    cap.color.needsUpdate = true;
    cap.mat.uniforms.uOpacity.value = st.cap;
    cap.mat.uniforms.uFeather.value = L(1, 'Feather') * reveal;
    cap.mesh.visible = st.cap > 0.001;

    lens.reveal = reveal;
    if (lens.hover > 0.001 && lensOn()) drawThroughLens();
    else {
      setClear(THREE.SRGBColorSpace);
      renderer.render(scene, camera);
    }
  }

  /* The background is the Night colour exactly as written, the same as the
     page's CSS — whichever way the frame is drawn. The planes' shaders write
     raw values; only the clear colour goes through three's colour
     management, which converts it to the target's colour space: to sRGB for
     the screen, not at all for the lens's render target. So it's given in
     the space the target expects — sRGB for the screen (converted back to
     the same value), linear for the target (left alone). Given as linear
     for the screen, #050505 would come out as #252525, and the background
     would lift to grey whenever the lens faded out. */
  const clearColour = { c: null };
  function setClear(space) {
    clearColour.c ||= new THREE.Color();
    renderer.setClearColor(clearColour.c.setRGB(...rgb(cfg.night), space), 1);
  }

  function drawThroughLens() {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (!lens.target || lens.target.width !== size.x || lens.target.height !== size.y) {
      lens.target?.dispose();
      lens.target = new THREE.WebGLRenderTarget(size.x, size.y, { samples: phone ? 0 : 4 });
    }
    setClear(THREE.LinearSRGBColorSpace);
    renderer.setRenderTarget(lens.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    const u = lens.mat.uniforms;
    u.uMap.value = lens.target.texture;
    u.uMouse.value.set(lens.x, lens.y);
    u.uAspect.value = geo.W / geo.H;
    u.uSize.value = cfg.lensSize;
    u.uSoftness.value = cfg.lensSoftness;
    u.uAberration.value = cfg.lensAberration;
    u.uRefraction.value = cfg.lensRefraction;
    u.uDispersion.value = Math.max(1, Math.min(64, Math.round(cfg.lensDispersion)));
    u.uHover.value = lens.hover;
    renderer.render(lens.scene, lens.camera);
  }

  /* ---------- the ambient clock ---------- */

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let raf = 0, last = 0, onScreen = false, drawnAt = -1;

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!reduced.matches) clock += dt;
    // Spring towards the cursor.
    const k = 5, c = 3.2;
    tilt.vx += (mouse.x - tilt.x) * k * dt; tilt.vx -= tilt.vx * c * dt;
    tilt.vy += (mouse.y - tilt.y) * k * dt; tilt.vy -= tilt.vy * c * dt;
    tilt.x += tilt.vx * dt; tilt.y += tilt.vy * dt;
    // The lens follows the cursor, damped by Smoothing, and shows while the
    // cursor is over the platform's canvas — not while it's still the dot,
    // and not under the explore modal.
    let lensing = false;
    if (lensOn() && renderer) {
      const r = canvas.getBoundingClientRect();
      const over = pointer.in && r.width > 0
        && pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom
        && !document.documentElement.classList.contains('xm-open');
      const tx = over ? (pointer.x - r.left) / r.width : lens.x;
      const ty = over ? 1 - (pointer.y - r.top) / r.height : lens.y;
      const th = over ? lens.reveal : 0;
      // Jump to the cursor when the lens is out of sight, so it never sweeps
      // in from wherever it was last.
      const a = lens.hover < 0.001 ? 1 : 1 - Math.exp(-cfg.lensSmoothing * dt);
      lens.x += (tx - lens.x) * a; lens.y += (ty - lens.y) * a;
      lens.hover += (th - lens.hover) * (1 - Math.exp(-cfg.lensSmoothing * dt));
      if (th === 0 && lens.hover < 0.001) lens.hover = 0;
      lensing = lens.hover > 0 || th > 0;
    } else if (lens.hover) { lens.hover = 0; lensing = true; }
    // Draw only when something has changed: the scroll, the ambient drift or
    // float, or the lean still settling towards the cursor.
    const ambient = !reduced.matches && (cfg.flow > 0 || cfg.float > 0);
    const leaning = cfg.tilt > 0 && (Math.abs(tilt.vx) + Math.abs(tilt.vy) > 1e-4 || Math.abs(mouse.x - tilt.x) + Math.abs(mouse.y - tilt.y) > 1e-3);
    if (ambient || leaning || lensing || drawnAt !== progress) render(progress);
    raf = onScreen ? requestAnimationFrame(frame) : 0;
  }

  const onMove = (e) => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1;
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.in = e.pointerType === 'mouse' || e.pointerType === 'pen';
  };
  // Leaving the window takes the lens away.
  const onOut = (e) => { if (!e.relatedTarget) pointer.in = false; };
  addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerout', onOut);

  const io = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  });
  io.observe(el);

  /* ---------- api ---------- */

  function setConfig(next) { cfg = next; computeGeometry(); render(progress); }

  computeGeometry();
  render(0);
  if (document.fonts) document.fonts.ready.then(() => { computeGeometry(); render(progress); });

  return {
    seek(p) { progress = p; render(p); },
    setConfig,
    relayout() { computeGeometry(); render(progress); },
    join(api) { prev = api; computeGeometry(); render(progress); },
    // This beat's progress at the middle of layer n's stop (1–3): where the
    // explore modal moves the page to as you read through the layers.
    stopAt(n) { return timeline().find((t) => t.s === n)?.T ?? null; },
    // For a beat that joins this one: the white dot it ends on.
    exitDot() { return geo.dot ? { rect: { ...geo.dot }, colour: cfg.dotColour, bg: cfg.night } : null; },
    tick(now) { frame(now); },
    destroy() {
      io.disconnect();
      removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerout', onOut);
      lens.target?.dispose();
      if (raf) cancelAnimationFrame(raf);
      renderer?.dispose();
      reveals.forEach(({ r }) => r.destroy());
      el.classList.remove('plat');
      day.remove(); night.remove();
    },
    get config() { return cfg; },
  };
}

export const PLATFORM_DEFAULTS = {
  length: 10,              // section height in viewport heights

  // The three layers are steps, not a free scroll (steps.js): one gesture
  // moves one layer.
  steps: 'on',             // 'on' | 'off'
  stepDuration: 1.2,       // s for the move from one layer to the next
  stepEase: 'power2.inOut',
  stepQuiet: 0.15,         // s of no wheel events before the next gesture counts

  // Timing, as shares of this beat's scroll
  wipeEnd: 0.06,           // black has covered the screen
  hold: 0.45,              // share of each leg the camera rests at a stop
  capFade: 0.35,           // share of the first leg the white face takes to lift off
  textFade: 0.3,           // share of a leg each text takes to fade
  textRise: 12,            // px

  // Hero
  heroText: 'The in-house platform built for a ride that’s out-of-this-world.',
  heroSize: 44,
  heroCol: 4,              // on the layout grid: first column (1-based)…
  heroSpan: 6,             // …and how many it spans before wrapping
  heroAlign: 'center',
  heroTextY: 0.5,          // × screen height (centre of the text)

  // Explore modal (modal.js): the layer's text block grows into a card in
  // the centre of the screen over the dimmed, blurred section.
  modalDuration: 0.7,      // s, the block growing into the card
  modalEase: 'power4.out',
  modalContentDelay: 0.05, // s after the card lands that its content starts
  modalContentFade: 0.5,   // s each piece of content takes to rise in
  modalContentRise: 16,    // px it rises
  modalStagger: 0.06,      // s between pieces
  modalCloseSpeed: 1.4,    // closing plays the opening backwards, this much faster
  // Reading on from one layer to the next, in the modal (as GSAP's pinned
  // panels with overscroll): the card you've finished holds and shrinks
  // while the next slides up over it.
  modalStackScale: 0.7,    // what the finished card shrinks to
  modalStackFade: 0.5,     // its opacity just before it goes
  modalFollow: 1.2,        // s the section behind takes to move to the next layer
  // …and the content cascades between them (played on time once crossed).
  modalSwapOut: 0.1,       // share of a handover at which the old content cascades away
  modalSwapIn: 0.6,        // share at which the new body cascades in under its headline
  modalSwapFade: 0.35,     // s each piece takes to go (coming in uses Content rises over)
  modalSwapStagger: 0.05,  // s between pieces
  modalBlurOut: 6,         // px content blurs to as it fades away
  modalBlurIn: 6,          // px content arrives from as it fades in (also on open)

  // The close button, floating at the bottom centre of the screen.
  modalCloseSize: 56,      // px across
  modalCloseIconSize: 0.4, // × the button
  modalCloseBottom: 32,    // px up from the bottom of the screen
  modalCloseBg: '#ffffff',
  modalCloseInk: '#0b0b0b',
  modalCloseIcon: '',      // uploaded SVG markup; empty for a plain ×
  modalDim: 0.6,           // backdrop darkness, 0–1
  modalBlur: 12,           // px
  modalCol: 3,             // the card on the layout grid: first column…
  modalSpan: 8,            // …and how many it spans
  modalMargin: 96,         // px above and below the card
  modalRadius: 16,         // px
  modalOriginPad: 12,      // px the starting surface reaches round the text block
  modalTitleSize: 44,      // px
  modalBg: '#ecebe8',
  modalBgOpacity: 1,       // 0–1: below 1 the dimmed, blurred section shows through
  modalInk: '#0b0b0b',
  modalPad: 0,             // px inside the card, round its content (the Figma frames have none)
  modalMediaRadius: 16,    // px corners on the images and videos
  // What fills each image slot, its shape and its crop (modalContent.js).
  ...MODAL_CONTENT_DEFAULTS,

  // Layer text
  textCol: 2,              // on the layout grid: first column (1-based)…
  textSpan: 4,             // …and how many it spans before wrapping
  textAlign: 'left',
  textY: 0.44,             // top, × screen height
  titleSize: 34,
  bodySize: 14,
  layer1Title: 'Hardware',
  layer1Body: 'Purpose-built vehicles and components, designed in-house so every part of the ride works together.',
  layer1Button: 'Explore',
  layer2Title: 'Software',
  layer2Body: 'One operating system across the fleet, updated over the air and always getting better.',
  layer2Button: 'Explore',
  layer3Title: 'Autonomy',
  layer3Body: 'The foundation everything runs on: perception, planning and safety, built to move people.',
  layer3Button: 'Explore',

  // The platform. Layer 1 is the top (Hardware), 3 the base (Autonomy).
  // World units; the camera scales the whole thing to fit.
  layer1Width: 2, layer1Height: 4, layer1Planes: 40, layer1Top: '#4f7dff', layer1Bottom: '#1c2a9c',
  layer1Opacity: 0.55, layer1Feather: 0.03, layer1Stripes: 0.35, layer1Blend: 'normal',
  layer2Width: 3.8, layer2Height: 2.6, layer2Planes: 11, layer2Top: '#ff3a1c', layer2Bottom: '#b1180c',
  layer2Opacity: 0.9, layer2Feather: 0.015, layer2Stripes: 0.8, layer2Blend: 'normal',
  layer3Width: 6.2, layer3Height: 3.6, layer3Planes: 60, layer3Top: '#ff5ad6', layer3Bottom: '#3b2bb0',
  layer3Opacity: 0.035, layer3Feather: 0.22, layer3Stripes: 0.3, layer3Blend: 'glow',
  layerGap: 0,             // world units between layers
  face: 1,                 // opacity of each layer's top face
  flow: 0.5,               // planes per second drifting up through each layer

  // Camera stops. Focus: where on the platform it looks (0 base … 1 top).
  // Zoom: × the size at which the platform stands half the screen tall.
  // X / Y: shift on screen, × its width / height.
  heroFocus: 0.55, heroZoom: 1.35, heroX: 0, heroY: 0.04, heroElev: 50, heroAzim: 0,
  view1Focus: 0.86, view1Zoom: 2, view1X: 0.17, view1Y: 0.06, view1Elev: 48, view1Azim: 0,
  view2Focus: 0.55, view2Zoom: 2.3, view2X: 0.17, view2Y: 0.04, view2Elev: 48, view2Azim: 0,
  view3Focus: 0.2, view3Zoom: 2.1, view3X: 0.17, view3Y: 0, view3Elev: 48, view3Azim: 0,
  fov: 22,
  distance: 40,

  // Ambient
  float: 1.2,              // degrees of idle drift
  floatSpeed: 0.15,        // cycles per second
  tilt: 5,                 // degrees it leans towards the cursor
  // Cursor lens over the platform (Atelier UI's Lens Media). Sizes are shares
  // of the canvas's height.
  lens: 'on',              // 'on' | 'off'
  lensSize: 0.12,          // radius of the clear centre
  lensSoftness: 0.5,       // how far past that it fades out
  lensAberration: 0.18,    // how far the colours split apart
  lensDispersion: 35,      // colour samples across the split (1–64; fewer is cheaper, banded)
  lensRefraction: 0.4,     // how strongly it pulls the picture in towards the cursor
  lensSmoothing: 7,        // how quickly it catches up with the cursor (higher = snappier)

  // Colour
  night: '#000000',
  fg: '#ffffff',
  dotColour: '#ffffff',
  dotSize: 24,             // px, if there's no previous beat to take it from
  dayBg: '#ffffff',
  dayDot: '#0d0d0d',
};

/* Mobile starting values (phones and tablets, below 1024 px wide), applied
   over the desktop ones. Edit them in the inspector's Mobile mode. Portrait:
   each layer's text sits at the top of the screen, across the whole 4-column
   grid, and the platform centred below it. */
export const PLATFORM_MOBILE = {
  modalCol: 1, modalSpan: 4, modalMargin: 24, modalTitleSize: 44, modalCloseSize: 48, modalCloseBottom: 20,
  ...MODAL_CONTENT_MOBILE,
  heroSize: 28,
  heroCol: 1, heroSpan: 4,
  textCol: 1, textSpan: 4,
  textY: 0.11,
  titleSize: 30,
  bodySize: 14,
  heroZoom: 1,
  view1X: 0, view1Y: 0.02, view1Zoom: 1.6,
  view2X: 0, view2Y: 0.16, view2Zoom: 1.8,
  view3X: 0, view3Y: 0.16, view3Zoom: 1.7,
  tilt: 0,
  float: 0,
};

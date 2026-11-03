/* Beat 5 — Isometric platform.

   Picks up Aggregate's last frame (one dark dot, true centre) by *joining* it
   (`join: true`), the way Aggregate joins Big scroll. Then, on scroll:

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

import * as THREE from 'three';

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

// Layer 1 is the top of the platform (Hardware), layer 3 the base (Autonomy).
const LAYERS = [1, 2, 3];
const MAX_PLANES = 160;

export function createPlatform(el, config) {
  let cfg = config;
  let progress = 0;
  let prev = null;        // Aggregate's api, once the director joins us to it

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
  copy.append(hero, ...blocks.map((x) => x.b));

  /* ---------- three ---------- */

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 400);

  // pivot (at the camera's focus point: scale + tilt) -> content (the stack,
  // base at y = 0). Tilting the pivot turns the platform about what you're
  // looking at instead of swinging it round its base.
  const pivot = new THREE.Group();
  const content = new THREE.Group();
  pivot.add(content);
  scene.add(pivot);

  const planeGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);   // lying flat, facing up

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

  // Painted bottom to top (the camera is always above): base, middle, top, cap.
  const stacks = {};
  [3, 2, 1].forEach((n, i) => { stacks[n] = makeStack(MAX_PLANES); stacks[n].mesh.renderOrder = i; });
  // The cap: a plain face on top of the top layer. It is the white dot.
  const cap = makeStack(1);
  cap.mesh.renderOrder = 10;

  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const Vp = new THREE.Vector3();
  const Vs = new THREE.Vector3();

  /* ---------- geometry ---------- */

  const geo = { W: 0, H: 0, layers: {}, total: 1, dot: null };
  const L = (n, k) => cfg[`layer${n}${k}`];

  function computeGeometry() {
    geo.W = el.clientWidth;
    geo.H = el.clientHeight;
    if (geo.W && geo.H) renderer.setSize(geo.W, geo.H, false);
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

  // Where Aggregate left its dot. Falls back to a centred dot.
  function syncDot() {
    const d = prev?.exitDot?.();
    const s = d ? d.rect.w : cfg.dotSize;
    geo.dot = d ? { ...d.rect } : { x: geo.W / 2 - s / 2, y: geo.H / 2 - s / 2, w: s, h: s };
    geo.dayBg = d?.bg || cfg.dayBg;
    geo.dayDot = d?.colour || cfg.dayDot;
  }

  /* ---------- text ---------- */

  function layoutText() {
    el.style.setProperty('--plat-night', cfg.night);
    el.style.setProperty('--plat-fg', cfg.fg);
    day.style.background = geo.dayBg;
    hero.textContent = cfg.heroText;
    Object.assign(hero.style, {
      fontSize: `${cfg.heroSize}px`, maxWidth: `${cfg.heroWidth * 100}%`, top: `${cfg.heroTextY * 100}%`,
    });
    blocks.forEach((x, i) => {
      const n = i + 1;
      x.h.textContent = L(n, 'Title');
      x.p.textContent = L(n, 'Body');
      x.btn.textContent = L(n, 'Button');
      x.btn.style.display = L(n, 'Button') ? '' : 'none';
      Object.assign(x.b.style, { left: `${cfg.textX * 100}%`, top: `${cfg.textY * 100}%`, maxWidth: `${cfg.textWidth}px` });
      x.h.style.fontSize = `${cfg.titleSize}px`;
      x.p.style.fontSize = `${cfg.bodySize}px`;
    });
    [dayDot, nightDot].forEach((d) => Object.assign(d.style, {
      left: `${geo.dot.x}px`, top: `${geo.dot.y}px`, width: `${geo.dot.w}px`, height: `${geo.dot.h}px`,
    }));
    dayDot.style.background = geo.dayDot;
    nightDot.style.background = cfg.dotColour;
  }

  /* ---------- the timeline ----------
     After the wipe, the rest of the beat is five equal legs between six
     stops: dot, hero, layer 1, 2, 3, dot. The camera holds at each middle
     stop for `hold` of a leg, and their text shows around that hold. */

  const STOPS = ['dot', 'hero', 1, 2, 3, 'dot'];

  function timeline() {
    const w = clamp01(cfg.wipeEnd);
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

  // Scale at which the whole platform stands about half the screen tall.
  const fitScale = () => (0.5 * geo.H) / (geo.total * pxPerUnit());

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

  function render(p) {
    if (!geo.W) computeGeometry();
    if (!geo.W) return;
    if (p < 0.02 || !geo.dot) { syncDot(); layoutText(); }
    const st = stateAt(p);

    // Wipe.
    night.style.clipPath = st.wipe >= 1 ? '' : `inset(${((1 - st.wipe) * 100).toFixed(3)}% 0 0 0)`;
    day.style.visibility = st.wipe >= 1 ? 'hidden' : '';
    nightDot.style.visibility = st.gl ? 'hidden' : '';
    canvas.style.visibility = st.gl ? '' : 'hidden';

    // Text.
    const show = (e, o, rise) => {
      e.style.opacity = o >= 1 ? '' : o.toFixed(3);
      e.style.visibility = o > 0.001 ? '' : 'hidden';
      e.style.translate = rise ? `0 ${((1 - o) * cfg.textRise).toFixed(2)}px` : '';
    };
    show(hero, st.text.hero, true);
    blocks.forEach((x, i) => show(x.b, st.text[i + 1], true));

    if (st.gl) draw(st);
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

    renderer.setClearColor(new THREE.Color().setRGB(...rgb(cfg.night)), 1);
    renderer.render(scene, camera);
  }

  /* ---------- the ambient clock ---------- */

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let raf = 0, last = 0, onScreen = false;

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!reduced.matches) clock += dt;
    // Spring towards the cursor.
    const k = 5, c = 3.2;
    tilt.vx += (mouse.x - tilt.x) * k * dt; tilt.vx -= tilt.vx * c * dt;
    tilt.vy += (mouse.y - tilt.y) * k * dt; tilt.vy -= tilt.vy * c * dt;
    tilt.x += tilt.vx * dt; tilt.y += tilt.vy * dt;
    render(progress);
    raf = onScreen ? requestAnimationFrame(frame) : 0;
  }

  const onMove = (e) => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1; };
  addEventListener('pointermove', onMove, { passive: true });

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
    // For a beat that joins this one: the white dot it ends on.
    exitDot() { return geo.dot ? { rect: { ...geo.dot }, colour: cfg.dotColour, bg: cfg.night } : null; },
    tick(now) { frame(now); },
    destroy() {
      io.disconnect();
      removeEventListener('pointermove', onMove);
      if (raf) cancelAnimationFrame(raf);
      renderer.dispose();
      el.classList.remove('plat');
      day.remove(); night.remove();
    },
    get config() { return cfg; },
  };
}

export const PLATFORM_DEFAULTS = {
  length: 10,              // section height in viewport heights

  // Timing, as shares of this beat's scroll
  wipeEnd: 0.06,           // black has covered the screen
  hold: 0.45,              // share of each leg the camera rests at a stop
  capFade: 0.35,           // share of the first leg the white face takes to lift off
  textFade: 0.3,           // share of a leg each text takes to fade
  textRise: 12,            // px

  // Hero
  heroText: 'The in-house platform built for a ride that’s out-of-this-world.',
  heroSize: 44,
  heroWidth: 0.42,         // × screen width
  heroTextY: 0.5,          // × screen height (centre of the text)

  // Layer text
  textX: 0.07,             // left edge, × screen width
  textY: 0.44,             // top, × screen height
  textWidth: 380,          // px
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

  // Colour
  night: '#000000',
  fg: '#ffffff',
  dotColour: '#ffffff',
  dotSize: 24,             // px, if there's no Aggregate to take it from
  dayBg: '#ffffff',
  dayDot: '#0d0d0d',
};

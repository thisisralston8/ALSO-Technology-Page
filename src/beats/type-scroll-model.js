// The document model. Text is a list of words with one *gap* between each pair;
// a gap is a space, a line break, or an image slot. Everything the effect needs
// is compiled from this (`compile`), and the textarea is just a serialisation
// of it (newline = break, ▣ = image), so the two views can never disagree.

export const IMG_MARK = '▣';

export const DEFAULT_TEXT =
  'Purpose Is\nWhen ▣ Work\nFeels Like\nPlaying\nEvery ▣ Day\nWith Fun\nCreative Ideas\nThat ▣ Keep\nMoving You\nForward';

export const DEFAULT_PARAMS = {
  mode: 'loop',
  type: {
    size: 13, fit: true, fitWidth: 88, weight: 400, leading: 1.12, tracking: -0.035,
    align: 'center', fg: '#ffffff', bg: '#05050a',
  },
  img: { size: 0.86, aspect: 1, radius: 0.18, gap: 0.02, offset: -0.08 },
  roll: { band: 0.34, roll: 66, fade: 12, dim: 0.62, slant: 12, vskew: 14, stagger: 0.6, mirror: false },
  motion: { speed: 1, inertia: 0.55, loopGap: 0 },
  reveal: { on: true, style: 'blocks', squares: 4, dotColor: 'image', dotFill: '#ffffff', layout: 'scatter', field: 0.45, drift: 0.5, push: 0.6, mode: 'scroll', start: 0.08, end: 0.42, duration: 0.9, grid: 3, depth: 3, scatter: 0.7, guides: false },
  embed: { drive: 'page', gsap: 'inline', height: '100vh' },
};

let uid = 0;
export const newId = () => 'i' + Date.now().toString(36) + (uid++).toString(36);

// ---------- parse / serialise ----------
// Returns { words: string[], gaps: {k, img}[] }. Image identity is carried over
// from `prev` by matching neighbours first, then by order, so editing the text
// around an image doesn't lose its picture.
export function parse(text, prev) {
  const words = [];
  const gaps = [];
  let pending = null; // gap kind accumulated since the last word
  const re = new RegExp(`(\\n)|(${IMG_MARK})|([^\\s${IMG_MARK}]+)`, 'g');
  let m;
  while ((m = re.exec(text))) {
    if (m[1]) pending = pending === 'image' ? 'image' : 'break';
    else if (m[2]) pending = 'image';
    else {
      if (words.length) gaps.push({ k: pending || 'space', img: null });
      words.push(m[3]);
      pending = null;
    }
  }
  if (prev) adoptImages({ words, gaps }, prev);
  return { words, gaps };
}

function adoptImages(doc, prev) {
  const old = [];
  prev.gaps.forEach((g, i) => {
    if (g.k === 'image') old.push({ img: g.img, l: prev.words[i], r: prev.words[i + 1], used: false });
  });
  const fresh = [];
  doc.gaps.forEach((g, i) => {
    if (g.k !== 'image') return;
    const hit = old.find((o) => !o.used && o.l === doc.words[i] && o.r === doc.words[i + 1]);
    if (hit) { hit.used = true; g.img = hit.img; } else fresh.push(g);
  });
  const rest = old.filter((o) => !o.used);
  fresh.forEach((g, j) => { g.img = rest[j] ? rest[j].img : null; });
}

export function serialise(doc) {
  let out = '';
  doc.words.forEach((w, i) => {
    out += w;
    const g = doc.gaps[i];
    if (!g) return;
    out += g.k === 'break' ? '\n' : g.k === 'image' ? ` ${IMG_MARK} ` : ' ';
  });
  return out;
}

export function cycleGap(doc, i, library) {
  const g = doc.gaps[i];
  const order = ['space', 'break', 'image'];
  g.k = order[(order.indexOf(g.k) + 1) % order.length];
  if (g.k === 'image' && !g.img) g.img = nextFreeImage(doc, library);
  return doc;
}

export function nextFreeImage(doc, library) {
  const used = new Set(doc.gaps.filter((g) => g.k === 'image').map((g) => g.img));
  const ids = Object.keys(library);
  return ids.find((id) => !used.has(id)) || ids[0] || null;
}

// rows of tokens for display / rendering
export function toRows(doc) {
  const rows = [[]];
  doc.words.forEach((w, i) => {
    rows[rows.length - 1].push({ t: 'w', text: w, i });
    const g = doc.gaps[i];
    if (!g) return;
    if (g.k === 'image') rows[rows.length - 1].push({ t: 'i', gap: i, img: g.img });
    if (g.k === 'break') rows.push([]);
  });
  return rows.filter((r) => r.length);
}

// what the effect consumes
export function compile(doc, library, params, fontFamily) {
  const lines = toRows(doc).map((row) =>
    row.map((tok) => (tok.t === 'w' ? { t: 'w', text: tok.text } : { t: 'i', src: library[tok.img] || '' })),
  );
  return {
    mode: params.mode,
    drive: 'capture',
    lines,
    fontFamily,
    type: params.type,
    img: params.img,
    roll: params.roll,
    motion: params.motion,
    reveal: params.reveal,
  };
}

export const SYSTEM_FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';

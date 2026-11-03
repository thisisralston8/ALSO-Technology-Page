/* One continuous move across two beats.

   Big scroll's dots leave the text, gather into a row, and Aggregate then
   carries them to its resting row. Done as two eased moves, the dots slow to a
   stop at Big scroll's row and start again — and however exactly the two beats
   agree on *position* at the handover, that stop is felt as a seam.

   So it's one move. The dot's path runs hold → row → rest as a single smooth
   curve, and one easing spans the whole scroll distance of both beats: Big
   scroll's release plus Aggregate's settle. The row is a point each dot
   passes through at speed, not a place it arrives at.

   The path is one parabola through all three points (no join in it at all),
   with the row placed along it in proportion to the distance travelled to it
   — so the curve stays well-behaved even though hold → row is usually much
   longer than row → rest. The dot then moves along that path by *arc length*:
   equal steps of the easing cover equal distances on screen. Its speed over
   the whole move is therefore exactly the easing curve — one smooth rise and
   fall, with nothing to slow it at the row, the handover, or anywhere else.
   The handover needs no special treatment: both beats evaluate this same
   function, so they agree on it exactly wherever it falls.

   Both beats call this with the same inputs, so they agree on every frame:
     plan  { R, S, hold, row, rest }
           R     scroll px of Big scroll's release
           S     scroll px of Aggregate's settle
           hold  rect in the text   (where the move starts)
           row   rect in Big scroll's row (passed through at the handover)
           rest  rect in Aggregate's resting row (where the move ends)
     d     scroll px since Big scroll's release began (0 … R + S)            */

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));

const centre = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
// Size changes are motion too, so they count towards distance travelled.
const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.w - b.w);
const SAMPLES = 48;

export function journeyRect(plan, d) {
  const { R, S, hold, row, rest } = plan;
  const e = ease(clamp01(d / Math.max(1, R + S)));

  // The parabola through hold (t = 0), row (t = tr) and rest (t = 1), per
  // component: B(t) = (1-t)² P0 + 2(1-t)t C + t² P2, with C chosen so B(tr) = row.
  const c0 = { ...centre(hold), w: hold.w }, c1 = { ...centre(row), w: row.w }, c2 = { ...centre(rest), w: rest.w };
  const dA = gap(c0, c1), dB = gap(c1, c2);
  const tr = Math.min(0.9, Math.max(0.1, dA + dB > 0 ? dA / (dA + dB) : 0.5));
  const ctrl = (k) => (row[k] - (1 - tr) ** 2 * hold[k] - tr ** 2 * rest[k]) / (2 * tr * (1 - tr));
  const C = { x: ctrl('x'), y: ctrl('y'), w: ctrl('w'), h: ctrl('h') };
  const B = (t) => {
    const a = (1 - t) ** 2, b = 2 * (1 - t) * t, c = t * t;
    return {
      x: a * hold.x + b * C.x + c * rest.x, y: a * hold.y + b * C.y + c * rest.y,
      w: a * hold.w + b * C.w + c * rest.w, h: a * hold.h + b * C.h + c * rest.h,
    };
  };

  // Arc length: walk the curve, then find the t that has covered `e` of it.
  const pts = [], len = [0];
  for (let i = 0; i <= SAMPLES; i++) {
    const r = B(i / SAMPLES);
    pts.push({ ...centre(r), w: r.w });
    if (i) len.push(len[i - 1] + gap(pts[i - 1], pts[i]));
  }
  const total = len[SAMPLES];
  if (!(total > 0)) return B(e);
  const want = e * total;
  let i = 1;
  while (i < SAMPLES && len[i] < want) i++;
  const seg = len[i] - len[i - 1];
  const t = (i - 1 + (seg > 0 ? (want - len[i - 1]) / seg : 0)) / SAMPLES;
  return B(t);
}

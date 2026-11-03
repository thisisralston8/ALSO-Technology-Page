/* The layout grid — what the page's text and buttons line up to (the visuals
   don't use it). Stretch columns, like Figma's: a fixed margin either side, a
   fixed gutter between columns, and the columns share what's left.

   Desktop: 12 columns, 40 px margins, 24 px gutters. Below the phone
   breakpoint (1024 px; phones and tablets): 4 columns, 20 / 20. They're Page
   settings with phone values like any other, so main.js passes the effective
   ones in through `setGrid`.

   A beat places text with `span(W, start, count)`: the x and width (px) of a
   run of `count` columns starting at column `start` (1-based), clamped to
   the grid so a desktop setting can't fall off a 4-column one. */

export const GRID_DEFAULTS = {
  gridCols: 12,
  gridMargin: 40,     // px, either side
  gridGutter: 24,     // px, between columns
};

export const GRID_MOBILE = {
  gridCols: 4,
  gridMargin: 20,
  gridGutter: 20,
};

let grid = { ...GRID_DEFAULTS };
const KEYS = Object.keys(GRID_DEFAULTS);

export const gridOptions = () => grid;

// Returns true if the grid changed (the page then needs a relayout).
export function setGrid(next) {
  const g = Object.fromEntries(KEYS.map((k) => [k, next[k] ?? GRID_DEFAULTS[k]]));
  g.gridCols = Math.max(1, Math.round(g.gridCols));
  const changed = KEYS.some((k) => g[k] !== grid[k]);
  grid = g;
  if (changed) drawOverlay();
  return changed;
}

export function colWidth(W) {
  const { gridCols: n, gridMargin: m, gridGutter: g } = grid;
  return Math.max(0, (W - 2 * m - (n - 1) * g) / n);
}

export function span(W, start, count) {
  const { gridCols: n, gridMargin: m, gridGutter: g } = grid;
  const s = Math.min(n, Math.max(1, Math.round(start) || 1));
  const c = Math.min(n - s + 1, Math.max(1, Math.round(count) || 1));
  const cw = colWidth(W);
  return { x: m + (s - 1) * (cw + g), w: c * cw + (c - 1) * g };
}

/* ---------- overlay ----------
   Red columns over the page, like Figma's layout grid, for checking
   alignment. Shown with the inspector's Grid switch or G; drawn with CSS
   grid, so it follows the window by itself. */

let overlay = null;

function drawOverlay() {
  if (!overlay) return;
  const { gridCols: n, gridMargin: m, gridGutter: g } = grid;
  Object.assign(overlay.style, {
    gridTemplateColumns: `repeat(${n}, 1fr)`, columnGap: `${g}px`, padding: `0 ${m}px`,
  });
  overlay.replaceChildren(...Array.from({ length: n }, () => document.createElement('i')));
}

export function showGridOverlay(on) {
  if (on && !overlay) {
    overlay = document.createElement('div');
    overlay.className = 'grid-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
    drawOverlay();
  }
  if (overlay) overlay.hidden = !on;
}

/* Autosave. Params only — images are bundled assets, so there is nothing
   binary to keep and localStorage is enough. The whole page config round-trips
   as one JSON blob so a state can be handed to someone else. */

const KEY = 'also-traffic-page:config';

// Images and videos are injected at boot and would bloat (and stale-date) the save.
const STRIP = ['images', 'videos', 'films'];

const prune = (o) => {
  const out = {};
  for (const [k, v] of Object.entries(o)) if (!STRIP.includes(k)) out[k] = v;
  return out;
};

/* This browser's tweaks are made against one version of the project's
   defaults (src/defaults.json). When those change (a Save as default, a new
   deploy), tweaks made against the old ones are dropped, so the new defaults
   show: kept, they'd silently mask them. `stamp` identifies the defaults. */
const STAMP_KEY = 'also-traffic-page:defaults';
export function useDefaults(stamp) {
  try {
    if (localStorage.getItem(STAMP_KEY) === stamp) return;
    localStorage.removeItem(KEY);
    localStorage.setItem(STAMP_KEY, stamp);
  } catch { /* storage off: nothing saved anyway */ }
}

export function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function save(id, config) {
  const all = load();
  all[id] = prune(config);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function exportAll() {
  return JSON.stringify(load(), null, 2);
}

export function importAll(json) {
  const parsed = JSON.parse(json);
  localStorage.setItem(KEY, JSON.stringify(parsed));
  return parsed;
}

export function reset() {
  localStorage.removeItem(KEY);
}

/* View mode is a review setting, not part of the page config: it isn't
   exported with "Copy config" and survives "Reset all". */
const VIEW_KEY = 'also-traffic-page:view';

export function loadView() {
  try {
    return JSON.parse(localStorage.getItem(VIEW_KEY)) || {};
  } catch {
    return {};
  }
}

export function saveView(view) {
  localStorage.setItem(VIEW_KEY, JSON.stringify(view));
}

/* Promote the current settings to the project's defaults (src/defaults.json,
   via the dev server). Local overrides are cleared first — once saved they're
   identical to the new defaults, and leaving them would mask any later change
   to the defaults. Writing the file makes Vite reload the page, which can race
   the response, so the clear has to happen before the request; if the save
   fails, the overrides are put back. */
export async function saveDefaults(data) {
  const prev = localStorage.getItem(KEY);
  localStorage.removeItem(KEY);
  try {
    const res = await fetch('/__save-defaults', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    const out = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
    if (!out.ok) throw new Error(out.error || 'save failed');
  } catch (e) {
    if (prev != null) localStorage.setItem(KEY, prev);
    throw e;
  }
}

/* Another window (or the phone preview's frame) changed the settings or the
   view: localStorage fires `storage` in every other same-origin document, so
   an edit in one window shows in all of them. */
export function watch({ onConfig, onView }) {
  addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) onConfig?.();
    if (e.key === VIEW_KEY || e.key === null) onView?.();
  });
}

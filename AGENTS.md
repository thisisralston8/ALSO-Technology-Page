# Agent notes: ALSO Technology page — Traffic variation

A copy of `../ALSO Technology Page` with Flow, Big scroll and Aggregate replaced by **Traffic** (`beats/traffic.js`). Port 4860; localStorage keys `also-traffic-page:*`.

Vite + vanilla JS, no framework. GSAP and Lenis from npm. See `README.md` for how it fits together.

```
npm install
npm run dev        # http://localhost:4860
npm run dev:phone  # also on the LAN, for a real phone (trusted Wi-Fi only: it exposes the save/upload endpoints)
npm run optimize   # regenerate src/assets/optimized (also runs on dev start and before build)
npm run build
```

## Architecture rules

- **Beats never touch scroll.** A beat is a pure function of one progress number; `director.js` is the only thing that supplies it. If you find yourself adding a scroll listener, a ScrollTrigger or a Lenis instance inside `src/beats/`, the design has gone wrong.
- **There is exactly one source of smoothing: the global Lenis instance**, set from the Page settings (`smoothness`, `scrollSpeed` in `main.js`). Beats must not add their own follow, easing-toward-target or inertia on top of scroll progress — a second lag makes that one beat trail the page and is exactly what made the experience feel clunky.
- **A beat may size its own section** by exposing `naturalLength()` (viewport heights). The director prefers it over the configured `length`. Traffic uses it so its text moves 1:1 with the page.
- **The grain (`src/grain.js`), the motion trail (`src/trail.js`) and the Isometric platform's drift, float, cursor lean and cursor lens are the deliberate exceptions to the rule below**: animated on time rather than scroll; the verticals dot cursor, the careers pixel trail and the footer's full-stop force field follow the pointer. None may affect scroll layout. Traffic is otherwise scroll-only; its one exception is the colour wave (`src/colorWave.js`, on "Start small" and the footer headline), which like the line reveal's *Play once* is triggered by scroll and then plays once on time.
- **`join: true`** (director) overlaps a beat's section with the previous beat's last screen so the two meet on one frame; the joined beat gets the previous beat's api via `join(api)`. Use it when the next beat must continue exactly where the last one stopped (Traffic → Isometric platform via `exitDot()`, which also hands over a copy of the text still on screen as `decor`). A joined beat is invisible until the exact scroll position it locks at — before that its section is sliding up over the previous beat.
- **Every frame is a pure function of state.** Deterministic from (progress, index, seed, params) so scrubbing and reversing are exact. Use the seeded `rnd(i, k)`, never `Math.random()`. This rule is inherited from both upstream prototypes and is why they could be unified at all.
- **`cover: true`** (director) is the opposite of `join`: the section rises over the previous beat's last screen, visible the whole way, while that beat holds its final frame (it gets one extra screen and reaches p=1 a screen early, so its pacing is unchanged). The covering beat gets the previous api via `cover(api)`. Platform verticals uses it to slide over the platform's white dot, then turns the dot into the cursor (`.vert-cursor`, `html.has-vert-cursor`): on/off is a pure function of progress, position follows the pointer exactly.
- **`flow: true`** (director): no sticky stage — the section scrolls like a page and its stage is the whole section (Platform verticals, sized by `naturalLength()` = its `height` setting). Combine with `cover` for a section that rises over the previous one and keeps going.
- **`followedBy(api)`**: the director gives every beat the api of the beat after it. Platform verticals uses Investors and careers' `floor()` (the middle of its pixel band, on screen) to hand the cursor back.
- **The beat contract** is `seek / setConfig / relayout / destroy`, plus optional `anchor(which)` and `maskAnchor(which, on)` for seams. A new beat implements that and nothing else.
- **`handedBy(api)`**: the director gives a seam's incoming beat the outgoing beat's api at mount. Traffic uses it to draw its hero with Open road's picture, directly below where the square leaves.
- **Line reveals** (`src/lineReveal.js`) are GSAP SplitText tweens that beats drive with `set(p)` — never a ScrollTrigger inside a beat. In the default *Play once* mode the trigger is a pure function of scroll but the reveal itself plays on time and then stays (a deliberate exception, like the grain). Call `unsplit()` before changing a revealed element's text or measuring its layout, and `split()` after; never write `textContent` on a split element every frame.
- **Motion trails read the tracked element's inline style** (`style.cssText`) and nothing else. A beat that wants an element trailed must put its whole drawn state there — position, size, opacity, visibility — and register it with its `trail` (`trail.add(el, { mode })`); remove it when the element is rebuilt.
- **New params** go in the beat's `*_DEFAULTS` export *and* get a row in `editor/schema.js`. Add a control by adding a schema entry, never by writing DOM by hand. Nested paths are dotted (`params.roll.band`).
- **The schema is a hierarchy**: `{ part }` headings (a section's big divisions, roughly in the order things happen on the page), collapsible `{ group, note }` panels under them, `{ sub }` labels inside long panels, and controls. Give a control `when: (cfg) => …` if it only applies to some settings (it's hidden otherwise). Put a new control in the panel where someone would look for it, not at the end. The inspector adds search and remembers which panels are open.
- **Settings are layered**: built-in `*_DEFAULTS` → `src/defaults.json` (written by "Save as default" through the dev-server endpoint in `vite.config.js`) → localStorage. Everything is keyed by beat id (`open-road`, `traffic`, `platform`, `page`) — the loader and the autosave must use the same ids.
- **Phone settings are a layer, not a fork.** Each section's *authored* config is its desktop values plus a `mobile` object of overrides; beats only ever receive the *effective* config (`{ ...c, ...c.mobile }` below 1024 px, `c` otherwise), built in `main.js`. A beat never reads `mobile` or checks the width for layout values — add a `*_MOBILE` starting value instead. The inspector reads and writes the authored config through `getConfig(id)` / `onChange(id, next)`, never `m.def.config` (that's the effective one).
- **Text goes on the layout grid** (`src/grid.js`): place it with `span(W, col, count)` → `{ x, w }`, from `…Col` / `…Span` / `…Align` params whose schema rows use `max: 'cols'`. Not on it: the visuals, the Open road headline (built around its image) and the nav. Grid settings are Page params; `applyPage` reports a change and `main.js` relays the page out. `span` is imported as `gridSpan` in beats that already have a `span` easing helper.
- **The mobile breakpoint is 1024 px** (`PHONE` in `main.js`): phones and tablets. `SMALL_SCREEN` (768 px) is only for the small video copies; the nav and the panel's bottom sheet use 768 px in CSS.
- **Media goes through `src/assets/optimized/`** (generated by `scripts/optimize-media.mjs`, which also removes copies whose original is gone; never edit it by hand). New media loaders must prefer the optimized copy by stem. Originals are a dev-server fallback only: list them with a *lazy* `import.meta.glob` behind `DEV` (see `devOriginals` in `main.js`), never an eager one, or every original ships in the build.
- **The editor is optional.** `main.js` loads `src/editor/*` with `import()` after the page runs, and `npm run build:site` (`VITE_EDITOR=off`) leaves it out along with the localStorage layer. Nothing outside `src/editor/` may import from it statically, except `store.js`.
- **three.js comes in through `src/three.js`**, which re-exports only what the platform uses. Add a name there when platform.js uses a new `THREE.*`.
- **`contain: paint` clips.** Don't put it on a container whose children are positioned outside its box (the traffic layer is one screen tall but its pieces sit at page positions) — it hides them.
- **`setPath` returns a new config.** Beats compare old against new to decide what to rebuild, so mutating in place hides the change from them.
- The inspector keeps `data-lenis-prevent` so it scrolls on its own.
- **The phone preview is the page in an iframe (`?embed`)**, which has no inspector. The parent's edits reach it only through localStorage (`store.js` `watch`), and `main.js` recomposes and re-applies just the sections that changed. Don't drive the frame's beats directly from the inspector; scrolling to a section is the one exception.
- **The inspector picks sections from one dropdown** (Page, then every beat in scroll order, numbered), with ‹ › to step through and the last choice remembered. A new section needs no editor work beyond its schema: add the beat to the director in `main.js` and its controls to `SCHEMA` under the same id, and it appears in the dropdown.

## Seams

A seam is a shared element, not a crossfade. The outgoing beat reports where it leaves its tile, the incoming beat reports where it wants one, and the director flies a single tile between the two while both beats hide their endpoint.

- The window is fixed: `bottom bottom` → `bottom top` on the outgoing section. That is exactly the gap between one stage unsticking and the next sticking. Don't invent extra scroll for a transition.
- Anchors are read live every frame, so they track stages that are themselves moving.
- Anchor rects are clamped into the viewport. See the comment on `clampRect` for why that is safe — it matters, don't remove it.
- `anchor(which, ctx)` receives `ctx.pAtEnd`: the incoming beat's own progress at the moment the handoff finishes. A beat that is already in motion needs it to pick a target. It can be `null` on the very first call, before the seam's trigger exists — fall back, don't throw.
- **Live anchors**: an incoming beat whose own path for the tile *starts* at the outgoing anchor can return `live: true` from `anchor('entry')` with its current rect. The director then draws the tile there and nothing else — no flight, no easing of its own — so there are no two easings meeting at either end. Traffic does this.
- The incoming beat should already be moving. `lead` starts its progress a viewport early; `startAt` offsets the progress itself. A tile that *starts* the next beat reads as a cut; one that joins something already running reads as a merge.

## Visual conventions

- Editor chrome is plain and restrained: one accent colour, tabular numerals for values, no gradients and no glows.
- **The explore modal (`src/modal.js`) is page chrome, like the nav.** The platform beat only dispatches `plat:explore` with the clicked block; `main.js` opens the modal. The modal may stop and start Lenis while it's open. To follow the layer being read (`onLayer`), `main.js` tweens the window's own scroll while Lenis is stopped, rather than calling `lenis.scrollTo`: Lenis's internal position can be stale, and it resyncs on `start()`. The card stack is a pure function of the modal's own `scrollTop`. The block it grew from is hidden with the `.xm-origin` class, not inline style, because the platform rewrites the block's inline style every frame.
- **The modal's content is data (`src/modalContent.js`)**: blocks per layer, and media *slots* whose settings are flat platform keys (`modalMedia_<slot>`, `modalRatio_<slot>`, `modalFocusX_/Y_<slot>`), so a phone override is one key, like any other setting. The schema rows are generated from the same list. Add a slot there, not in `modal.js`. Slots are filled by name from `src/assets/modal/` (`main.js` → `modalMedia`), uploaded through `/__upload-media` (`vite.config.js`). The cascades animate `partsOf(card)`: the body's children, with `.xm__group` children counted one by one.
- **Layer stepping (`src/steps.js`) is page chrome too.** It decides where the page scrolls (Lenis `virtualScroll` hook + `lenis.scrollTo`), never what a beat draws. The stops come from the platform's `api.stopAt(n)`. While the modal is open (`html.xm-open`) it stands aside. `__page.steps.state` shows `{ held, moving, armed }`.
- **Back to top is page chrome too.** The footer's arrow only dispatches `page:top` (with its fade timings and colour); `main.js` fades the `.page-cut` overlay in, jumps Lenis to 0 with `immediate`, and fades it out — a quick cut like the modal's layer switcher, never a long scroll.
- The nav is global and sits above every beat in `index.html`, not inside a beat. Its show/hide (`src/nav.js`) reads Lenis's scroll: it's page chrome, so this doesn't break the beats-never-touch-scroll rule, and it must never affect layout.

## Testing

No test suite. Verify in a browser at 1440×866, which matches the Figma frames, and at 375×812 and 768×1024 (mobile settings and the 4-column grid apply below 1024 px). Screenshots in the browser pane can lag one frame behind a programmatic scroll — wait before taking one.

```js
__page.director.byId('traffic').api.seek(0.4)
__page.director.beats.map(b => ({ id: b.def.id, p: b.trigger.progress }))
```

Check the seams specifically — they are the part most likely to break — by scrubbing across a section boundary and watching that exactly one tile is on screen and it never jumps.

## Assets

`src/assets/fonts/ABCCameraPlainVariable.woff2` is a commercial Dinamo font. Don't redistribute it, and publishing to the web needs ALSO's web licence.

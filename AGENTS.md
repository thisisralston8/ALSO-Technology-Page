# Agent notes: ALSO Technology page

Vite + vanilla JS, no framework. GSAP and Lenis from npm. See `README.md` for how it fits together.

```
npm install
npm run dev      # http://localhost:4800
npm run build
```

## Architecture rules

- **Beats never touch scroll.** A beat is a pure function of one progress number; `director.js` is the only thing that supplies it. If you find yourself adding a scroll listener, a ScrollTrigger or a Lenis instance inside `src/beats/`, the design has gone wrong.
- **There is exactly one source of smoothing: the global Lenis instance**, set from the Page settings (`smoothness`, `scrollSpeed` in `main.js`). Beats must not add their own follow, easing-toward-target or inertia on top of scroll progress — a second lag makes that one beat trail the page and is exactly what made the experience feel clunky. Big scroll forces the vendored effect's `motion.inertia` to 0 for this reason.
- **A beat may size its own section** by exposing `naturalLength()` (viewport heights). The director prefers it over the configured `length`. Big scroll uses it so its type moves 1:1 with the page.
- **The grain (`src/grain.js`), the motion trail (`src/trail.js`), Aggregate's ambient shape motion and the Isometric platform's drift, float and cursor lean are the deliberate exceptions to the rule below**: animated on time rather than scroll. None may affect scroll layout. Aggregate's time only moves cards *within* the shape the scroll has chosen (the globe and ring turn, the path flows), and its clock is held at 0 — unwinding the shortest way when you scroll back — until Big scroll's photos have landed, so the landing itself stays a pure function of scroll.
- **`join: true`** (director) overlaps a beat's section with the previous beat's last screen so the two meet on one frame; the joined beat gets the previous beat's api via `join(api)`. Use it when the next beat must continue exactly where the last one stopped (Big scroll → Aggregate via `exitDots()`, Aggregate → Isometric platform via `exitDot()`). A joined beat is invisible until the exact scroll position it locks at — before that its section is sliding up over the previous beat.
- **Motion that crosses a join is one move, computed once (`src/journey.js`)** and evaluated identically by both beats. Never ease *to* a point on one side of a join and *from* it on the other: matching positions isn't enough, the stop is what reads as a seam.
- **Every frame is a pure function of state.** Deterministic from (progress, index, seed, params) so scrubbing and reversing are exact. Use the seeded `rnd(i, k)`, never `Math.random()`. This rule is inherited from both upstream prototypes and is why they could be unified at all.
- **The beat contract** is `seek / setConfig / relayout / destroy`, plus optional `anchor(which)` and `maskAnchor(which, on)` for seams. A new beat implements that and nothing else.
- **`type-scroll-effect.js` and `type-scroll-model.js` are vendored.** Keep them copy-compatible with `../CLAUDE VIBE CODE/type-scroll/src/`. The only local change is the `drive: 'external'` branch in `attachDriver`, and it is commented as such. Put adaptations in `beats/big-scroll.js` instead.
- **`beats/text-blocks.js`** is the Blocks reveal, for text (Flow's blurb transitions) and images (Big scroll's dots). Its `makePlan` mirrors the one inside the vendored type-scroll effect, which can't be imported from — keep the two in step if the reveal's look changes.
- **Big scroll draws its own images.** The effect's reveal is switched off and its slot canvases hidden; `.big__dots` draws them so they can hold, reveal on scroll during the hold, and leave the text behind. The slots still hold the gaps in the lines.
- **Motion trails read the tracked element's inline style** (`style.cssText`) and nothing else. A beat that wants an element trailed must put its whole drawn state there — position, size, opacity, visibility — and register it with its `trail` (`trail.add(el, { mode })`); remove it when the element is rebuilt.
- **New params** go in the beat's `*_DEFAULTS` export *and* get a row in `editor/schema.js`. Add a control by adding a schema entry, never by writing DOM by hand. Nested paths are dotted (`params.roll.band`).
- **Settings are layered**: built-in `*_DEFAULTS` → `src/defaults.json` (written by "Save as default" through the dev-server endpoint in `vite.config.js`) → localStorage. Everything is keyed by beat id (`open-road`, `flow`, `big-scroll`, `aggregate`, `platform`, `page`) — the loader and the autosave must use the same ids.
- **`setPath` returns a new config.** Beats compare old against new to decide what to rebuild, so mutating in place hides the change from them.
- The inspector keeps `data-lenis-prevent` so it scrolls on its own.
- **The inspector picks sections from one dropdown** (Page, then every beat in scroll order, numbered), with ‹ › to step through and the last choice remembered. A new section needs no editor work beyond its schema: add the beat to the director in `main.js` and its controls to `SCHEMA` under the same id, and it appears in the dropdown.

## Seams

A seam is a shared element, not a crossfade. The outgoing beat reports where it leaves its tile, the incoming beat reports where it wants one, and the director flies a single tile between the two while both beats hide their endpoint.

- The window is fixed: `bottom bottom` → `bottom top` on the outgoing section. That is exactly the gap between one stage unsticking and the next sticking. Don't invent extra scroll for a transition.
- Anchors are read live every frame, so they track stages that are themselves moving.
- Anchor rects are clamped into the viewport. See the comment on `clampRect` for why that is safe — it matters, don't remove it.
- `anchor(which, ctx)` receives `ctx.pAtEnd`: the incoming beat's own progress at the moment the handoff finishes. A beat that is already in motion needs it to pick a target. It can be `null` on the very first call, before the seam's trigger exists — fall back, don't throw.
- The incoming beat should already be moving. `lead` starts its progress a viewport early; `startAt` offsets the progress itself. A tile that *starts* the next beat reads as a cut; one that joins something already running reads as a merge.

## Visual conventions

- Editor chrome is plain and restrained: one accent colour, tabular numerals for values, no gradients and no glows.
- The nav is global and sits above every beat in `index.html`, not inside a beat.

## Testing

No test suite. Verify in a browser at 1440×866, which matches the Figma frames.

```js
__page.director.byId('flow').api.seek(0.4)
__page.director.beats.map(b => ({ id: b.def.id, p: b.trigger.progress }))
```

Check the seams specifically — they are the part most likely to break — by scrubbing across a section boundary and watching that exactly one tile is on screen and it never jumps.

## Assets

`src/assets/fonts/ABCCameraPlainVariable.woff2` is a commercial Dinamo font. Don't redistribute it, and publishing to the web needs ALSO's web licence.

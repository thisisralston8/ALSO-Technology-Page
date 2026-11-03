# ALSO Technology Page — intro moment

Bring three scroll-driven beats into one story-driven page, each still editable in place.

| Beat | Name | Status |
|---|---|---|
| 1 | Open road | **Does not exist yet.** Storyboarded in Figma / the walkthrough video. |
| 2 | Flow | Built — `CLAUDE VIBE CODE/image-flow` (`:4820`) |
| 3 | Big scroll | Built — `CLAUDE VIBE CODE/type-scroll` (`:4810`) |

## What the video shows

A Figma storyboard of stacked desktop frames, read top to bottom:

1. **Open road.** A full-bleed crosswalk image under the ALSO nav. As you scroll it shrinks and docks into the headline `This is an ▣ open road.` It keeps shrinking past the line, the headline fades, and the image is left as a single small tile centred on screen.
2. **Flow.** That tile becomes the stream: images run right-to-left around `It began at Rivian when we started looking more closely at how we move around our cities.`
3. **Big scroll.** Huge type rolls over a drum with inline image blocks: `Build the ▣ world's best ▣ small vehicles for moving ▣ people and goods, driven and ___ autonomous…`

Two copy blocks sit beside the board as notes, not frames: *"Growing density will lead to more space constrained roads and short trips will become increasingly frequent."* and *"It turns out, we don't often move very fast or very far."*

## The core idea: one beat contract

The lucky break is that **both existing prototypes already render as a pure function of a single progress number.** `type-scroll` exposes `seek(p)`; `image-flow`'s `render(p)` is deterministic from `(progress, tile index, seed, params)`. Both AGENTS.md files make that a hard rule. So unification is mostly plumbing, not rewriting.

Every beat becomes the same shape — the one `type-scroll/src/effect.js` already has:

```js
createBeat(el, config, { gsap, ScrollTrigger }) -> {
  seek(p),          // p 0..1 — pure, reversible, no internal scroll listening
  setConfig(next),
  relayout(),
  destroy(),
  enter(ctx) / exit(ctx),   // optional, for handoffs
}
```

The director owns all scroll. Each beat gets a pinned section; `onUpdate → beat.seek(self.progress)`. One global Lenis for the whole page, so `image-flow`'s own Lenis instance and `type-scroll`'s own page/capture drivers both get removed in favour of an `external` drive mode.

## Structure

```
ALSO Technology Page/
  index.html
  package.json              vite + gsap
  src/
    main.js                 boot: Lenis, GSAP, director, editor
    director.js             the sequence — beats, scroll lengths, handoffs
    beats/
      open-road.js          Beat 1 (new)
      image-flow.js         Beat 2 (ported from image-flow/app.js)
      type-scroll.js        Beat 3 (vendored from type-scroll/src/effect.js, kept verbatim)
    editor/
      inspector.js          click a beat → its controls
      schema.js             per-beat control schemas
      store.js              IndexedDB autosave, import/export of the whole page config
    assets/
```

`type-scroll/src/effect.js` is vendored **unchanged** — it already takes no imports and has GSAP injected, exactly so it can be embedded. Upstream fixes stay mergeable. `image-flow/app.js` splits: the pure path/geometry/render maths becomes the beat, and the panel wiring and IndexedDB move into the shared editor.

## Phases

**0 — Scaffold.** Vite project, global Lenis + ScrollTrigger, `director.js`, the beat contract, three empty pinned sections wired to `seek()`. Prove scroll handoff with placeholder beats.

**1 — Beat 2 port.** Lift `image-flow` to the contract. Strip its Lenis, ScrollTrigger and localStorage singleton; make params an argument rather than module state. Verify side-by-side parity against `:4820` at 1440×866.

**2 — Beat 3 port.** Vendor `effect.js`, add an `external` drive mode (a 4-line addition to `attachDriver`), feed `seek()` from the director. Verify parity against `:4810`.

**3 — Beat 1 build.** New. A full-bleed image that scales and translates into an inline slot in `This is an ▣ open road.`, then keeps shrinking past it while the headline fades. The same pure-function rule applies: one progress number in, one frame out. Reuses `type-scroll`'s inline-image-in-a-line layout so the headline measures the same way.

**4 — Handoffs.** The actual seam work. Each transition is a zone owned by the director that overlaps the tail of beat N and the head of beat N+1 — so the page reads as one continuous move rather than three pinned sections in a row. (See question 1 — this phase is sized by that answer.)

**5 — Editor.** Click a beat to select it; an inspector shows that beat's controls. Both prototypes already drive their panels from a schema (`SCHEMA` in `type-scroll/src/main.js`, `.ctl[data-key]` rows in `image-flow/index.html`), so both collapse into one schema format and one panel renderer. Autosave to IndexedDB, plus export/import of the whole page config as JSON.

**6 — Polish.** Perf pass (Beat 2 can run 140 tiles, Beat 3 runs per-image canvases), reduced-motion fallback, image preloading so nothing pops in on first scroll, responsive.

## Risks

- **Pinned-section handoffs are where this gets hard.** Three stacked ScrollTrigger pins with overlapping transitions is the part most likely to need iteration.
- **Perf.** Beat 2's tiles and Beat 3's canvases currently never run at the same time. During a crossfade they would.
- **Font licence.** `ABCCameraPlain` is a commercial Dinamo font. Fine locally; publishing needs ALSO's web licence.

## Decisions (2026-10-06)

1. **Transitions — true shared-element morph.** Beat 1's final tile *is* Beat 2's first tile; Beat 2's last tile seeds Beat 3's first inline image. The director owns a fixed handoff layer; beats report the rect of their endpoint tile and hide it while the director flies it across.
2. **Editing — unified inspector.** One panel, one schema format, all three beats. Autosave to IndexedDB, export/import the page config as JSON.
3. **Beat 1 opens** on a full-bleed image under the ALSO nav. Scrolling shrinks it into the headline.
4. **Desktop now (1440×866), responsive later.** No rework required to add breakpoints.

### Assumptions I'm proceeding on (flag any you'd change)

- **Beat 3 is the Figma treatment**, not the prototype's default: white background, huge black type, `end` mode (plays once and releases) rather than `loop`.
- **Copy is verbatim from the storyboard.** The two blocks beside the board — the density note and *"It turns out, we don't often move very fast or very far."* — are working notes, not frames, so they don't appear.
- **Stack is Vite + GSAP**, static output, no framework.
- **Shared image set** is the 14 Figma images already in `image-flow/assets/images/`.
- **Nav is persistent** across all three beats.
- **Pinning is `position: sticky`**, not ScrollTrigger's `pin`. ScrollTrigger only maps scroll to progress. This is what `image-flow` already does, and it makes overlapping handoffs far easier than juggling three pin-spacers.

## Status

| Phase | State |
|---|---|
| 0 — Scaffold, beat contract, director | Done |
| 1 — Beat 2 port | Done |
| 2 — Beat 3 port | Done |
| 3 — Beat 1 build | Done |
| 4 — Seams | Done |
| 5 — Inspector | Done |
| 6 — Polish | Off-screen parking done. Responsive, preloading and a reduced-motion pass still open. |

Running at `http://localhost:4800`.

### Open

- **The hero image is a placeholder.** The crosswalk shot in the storyboard isn't in the 14-image Figma set that came across with `image-flow` — it's from a different frame. Beat 1 currently defaults to the first image in that set. Drop the real one into `src/assets/images/` and pick it in the inspector.
- Image preloading, so nothing pops in on a first fast scroll.
- Responsive breakpoints.

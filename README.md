# ALSO — Technology page intro

Three scroll-driven beats as one continuous page, each still editable in place.

```
npm install
npm run dev      # http://localhost:4800
npm run build
```

Press **H** to show or hide the inspector, and **W** to toggle wireframe mode (also the **Images / Wireframe** switch at the top of the inspector). Wireframe turns every image into a flat `#d9d9d9` fill so a review stays on motion and layout; it's a CSS filter, so nothing about timing changes. Add `?wireframe=1` to a link to open it in wireframe for that visit.

| Beat | Name | Copy |
|---|---|---|
| 1 | Open road | `This is an ▣ open road.` |
| 2 | Flow | `It began at Rivian when we started looking more closely at how we move around our cities.` |
| 3 | Big scroll | `Build the ▣ world's best ▣ small vehicles…` |

## Settings and defaults

Settings come from three layers, lowest first:

1. the built-in `*_DEFAULTS` in each beat's source
2. **`src/defaults.json`** — the project defaults
3. this browser's own unsaved tweaks (localStorage, saved automatically as you edit)

**Save as default** (top of the inspector footer) writes everything currently on screen into `src/defaults.json`, so it becomes the starting point for anyone who opens the page — including a production build, which bakes the file in. It asks to confirm first, keeps the previous file as `src/defaults.prev.json` (copy it back to undo one save), clears your local tweaks (they now *are* the defaults) and reloads. It's only offered on the dev server, which is what writes the file. **Reset all** clears your local tweaks back to the saved defaults; to get back to the built-in values, set `src/defaults.json` to `{}`.

Images are saved by name (`img-01`), not URL, because a build renames them with a content hash.

## How it fits together

One Lenis, one ScrollTrigger, one director. **Beats never listen to scroll.** Each is a pure function of a single progress number and the director is the only thing that supplies it:

```js
createBeat(el, config, { gsap, ScrollTrigger }) -> {
  seek(p),              // p 0..1 — pure and reversible
  setConfig(next),
  relayout(),
  destroy(),
  anchor(which),        // 'entry' | 'exit' -> { rect, src } | null
  maskAnchor(which, on),
}
```

Pinning is `position: sticky`, not ScrollTrigger's `pin`. A beat's section is `--len` viewport heights tall and its stage sticks for the middle of that. No pin-spacers means the seams below are a matter of reading two rects rather than three pinned elements fighting over the same space.

### Seams

A beat hands over to the next through a **shared element**: one tile, flown from where the old beat leaves it to where the new beat expects it. Not a crossfade — the same object, handed over.

The tile is dropped into something already moving, not used to start it. Beat 2 carries `lead`, so its progress begins the moment Beat 1 unsticks, and `startAt`, which offsets its progress so the stream is already half full when the tile arrives — the entrance to the stream is Beat 1's falling tile, not the right tip. The director tells the incoming beat what its own progress will be when the handoff *completes* (`anchor(which, ctx)`), so Beat 2 can aim at a tile sitting mid-stream near the middle of the screen rather than one still being born off the right edge. `handoffLane` picks which strand it joins — by default the one above the copy, so within Beat 2's own frame the tile keeps descending into the flow rather than arriving under it.

The flight only ever goes down and left. The director passes the incoming beat where the tile is coming from and where its stage will be when the handoff lands; Beat 2 picks the tile that will be directly beneath the drop, or just left of it, at that moment, and reports that *landing* position rather than its live one. Aiming at a live, still-moving tile makes the arriving tile chase it right and up; aiming at the landing point gives a straight drop that hands over exactly, after which the tile only moves right to left with the stream.

Not every boundary is a handoff. Flow → Big scroll has no seam (`seam: false`): the stream fully drains off the left edge by the end of Flow, and Big scroll simply pushes it away. Big scroll carries `lead` and its own `startAt`, so its first line is already up inside its section as that section slides in, and rides into view just as Flow's copy leaves the top — no empty screen between them.

Per-seam timing lives on the outgoing beat's config: `seamHold` keeps the tile exactly where it was left while the old beat scrolls away around it, and `seamEnd` lets the handoff finish part-way through the gap, so the incoming beat's real tile takes over mid-slide and just keeps going.

The handover window is the viewport-height gap between one stage unsticking (`bottom bottom`) and the next sticking (`bottom top`). No scroll is invented for the transition; the gap was always there, and the director paints it. Because anchors are read live from `getBoundingClientRect()`, the flying tile rides both stages as they slide.

Endpoints get clamped into the viewport. Beat 2's stream converges just past the left edge and Beat 3's first image slot is still below the fold when its stage starts sliding in — so without clamping the tile flies between two invisible points across an empty screen. Clamping is safe because it is the identity inside the viewport: the flown tile can only disagree with a beat's own tile where that tile is off-screen anyway.

## Files

```
src/
  main.js                 boot: Lenis, GSAP, director, editor
  director.js             the sequence — beats, scroll ranges, seams
  beats/
    open-road.js          Beat 1
    image-flow.js         Beat 2 — ported from the image-flow prototype
    big-scroll.js         Beat 3 — wrapper around the vendored effect
    type-scroll-effect.js vendored from type-scroll, one line changed
    type-scroll-model.js  vendored from type-scroll, unchanged
  editor/
    inspector.js          click a beat → its controls
    schema.js             per-beat control schemas
    store.js              autosave + config import/export
```

## The beats

**Beat 1 — Open road.** The headline never fades. It is always fully opaque and always sits a fixed gap from the image's left and right edges, so the image's width is what holds the two halves of the line apart. At the start the image is viewport-wide and pushes both runs off screen; as it shrinks it *pulls the text in*, and as the strip then narrows to 1:1 the text keeps closing in with it. There are two continuous moves and no dead zone, so scrolling always visibly does something. The image never drops. When the beat ends, its stage unsticks and the page scrolls the line up and out of centre, while the director holds the square fixed on screen until Beat 2's stream rises to meet it.

**Beat 2 — Flow.** Images stream right→left along a lens-shaped path around the copy. Ported from `image-flow`; the path, geometry and render maths are verbatim. What changed is ownership: its own Lenis, ScrollTrigger and `localStorage` singleton are gone.

**Flow's blurbs.** Flow's copy is a list of blurbs (Flow → Text → Blurbs: add, reorder, remove). The beat's scroll is split evenly between them; the first is already up when Flow arrives and the last holds until the stream drains. At each boundary the outgoing blurb dissolves out and the next resolves in through the same quantizing-squares *Blocks* reveal Big scroll uses on its images (`beats/text-blocks.js`): the live text is rasterized character-by-character at its exact on-page positions, and each block's tone is the ink coverage inside it. The lens is measured per blurb — its real line width and height — and blended across the transition, so tiles in flight are carried outward or inward around whichever text is up. The stream runs one batch of `count` tiles per blurb, back to back, so it keeps flowing through every blurb; the first batch's timing is untouched, so the opening and the Open road handoff are the same however many blurbs follow.

**Beat 4 — Aggregate.** (`beats/aggregate.js`) Joins Big scroll rather than following it: the director's `join` overlaps its section with Big scroll's last screen (`.beat--join`, `margin-top: -100vh`), so it starts on the exact frame Big scroll ends on and covers it as Big scroll scrolls away; it reads where the photos ended from Big scroll's `exitDots()`. One structure of image cards sits low on the screen, cropped by the bottom edge (or a crop line), under a line of text that changes as you scroll. Each text has a shape (`shapes`, default *swirl, globe, ring, path*). The *swirl* is the unordered field the others are gathered out of: a vortex of tumbling cards round the middle of the screen, seen from a little above, with a clear eye so the first text stays readable; the perspective origin follows it there (and back down to the other shapes), so it isn't stretched by an eye at the bottom of the screen. On scroll: the three photos **settle** out of Big scroll's row into the first shape while the rest of it fades in round them — one move from Big scroll's text to their places in it (`src/journey.js`: a single parabola through hold → row → landing place, travelled by arc length under one easing that spans Big scroll's release plus this settle, evaluated identically by both beats, so it never stops at the handover; `restPlan()` gives Big scroll the landing places). The first **text** then fades up (or scrolls up into place with the page), and the texts take equal turns between `textIn` and the exit, changing through the Blocks reveal (as Flow's blurbs) or a fade. Where the shape changes, the **same cards** fly from one shape to the next, centred on the text change, each setting off a little later than the last; a card the next shape has no place for shrinks into one that it does. On **exit** every card converges on one dot in the true centre of the screen, filling with the dot colour, as the last text fades and the crop opens (the swirl is never cropped). Cards inherit visibility rather than setting `visible`, so nothing shows through the joined stage while it's hidden. Every card's pose is `{x, y, z, yaw, pitch, size, op}` in a `preserve-3d` world, so the browser handles depth and perspective. The shapes also move on time — the globe and ring turn, the path flows towards you — once the photos have landed (see AGENTS.md). `api.tick(now)` steps that clock by hand for debugging. Settings saved for the old hover design (no `design: 2`) are set aside on load except colours and the motion trail.

**Uploading a hero video.** Open road's *Video* control lists every video in `src/assets/video/` by its poster; picking one switches the hero to video. *Upload video…* first opens the file in the browser and grabs a frame as its poster — which is also the check that the browser can play it (a codec it can't decode is refused with a message, before anything uploads). On the dev server the poster and video then go to `/__upload-video` (`vite.config.js`), which streams both to `node_modules/.also-uploads/` and moves them into `src/assets/video/` together once the video has fully arrived, never overwriting an existing name. The new video is selected before the upload, so the reload Vite does when that folder changes comes back showing it, and it's in every build from then on. A static build has no endpoint, so there the video plays from the file for that visit only. H.264 `.mp4` plays everywhere; `.mov`, `.webm` and `.m4v` are accepted too.

**Beat 5 — Isometric platform.** (`beats/platform.js`, three.js) Joins Aggregate the way Aggregate joins Big scroll: it starts on Aggregate's last frame, reading the dot's rect, colour and background from Aggregate's `exitDot()`. Black wipes up from the bottom (the dot is drawn twice — dark on the day layer, white on the night layer — so it turns white exactly where the dark covers it). The white dot is then the top face of the platform seen from straight overhead, sized so it matches the DOM dot to the pixel, and the camera moves through six stops — dot, hero, Hardware, Software, Autonomy, dot — with one easing per leg, holding at each while its text shows. The visual is the iso-flow prototype cut down to what this look needs: each of the three layers is a stack of flat, soft-edged horizontal planes (one instanced draw call, a colour per plane, no textures), coloured along a gradient up the layer, with a darker rim on each plane that reads as stripes down the block's sides; *Glow* draws a layer additively. Dropped from iso-flow: media and video, the blur and atlas shaders, keyframes, segments, explore/orbit and its own scroll. Size is the platform's scale, never the camera's distance, so the perspective never changes; the scale moves in proportion (log), since it spans a dot to a platform. The planes drift slowly up through each layer, it floats, and it leans towards the cursor — all on time, ambient, and held still while it's the dot. It ends on a white dot on black and exposes `exitDot()` for whatever joins it next.

**Motion trail.** (`src/trail.js`) Every section has a *Motion trail* toggle with Echoes, Stagger (ms), Opacity, Falloff and Blur. It's a time-based echo, like video feedback: each section registers its moving images and dots (never text) — Open road's hero and the handoff tile, Flow's tiles, Big scroll's dots once they leave the text, Aggregate's cards — and every frame the trail records each element's inline style, then shows `trailCount` copies of it as it was `trailStagger`, 2 × `trailStagger`, … ms ago, each fainter (`× (1 − falloff)`) and more blurred than the last. Scroll fast and it stretches; stop and it catches up and disappears. An echo identical to the live element is hidden, so nothing at rest gets a halo. Canvases are echoed by copying their pixels. Off by default and for reduced motion.

**Scrolling.** The page has one smoothing setting and one speed setting, both in the inspector's **Page** settings, both applied to the single Lenis instance. Every beat is a pure function of scroll progress, so every beat feels exactly the same glide. Big scroll used to add its own lag on top (the upstream effect's `inertia`) and run at a fixed 8 screens, which left its type crawling at roughly a quarter of scroll speed and trailing the page; it now has no lag of its own and sizes its section from the type's travel (`naturalLength()`), so the type moves 1:1 with the page — through its slide-in and once it locks.

**Grain and warmth.** A page-level analog finish (`src/grain.js`), tuned in the Page settings. *Warmth* is a flat tint multiplied over the page, so whites become warm paper and blacks stay black. *Grain* is a seeded noise tile, centred on mid-grey so it adds texture without shifting brightness, repeated across a fixed layer and blended over everything; it jumps to a new random offset `grainSpeed` times a second (a GPU transform, so nothing repaints) and stops for reduced motion. Both sit above every beat and the nav, below the editor, and are separate elements in `<body>` because `mix-blend-mode` only blends within its stacking context. Controls: Grain on/off, Amount, Size, Softness, Motion (fps), Colour noise, Blend; Warmth Amount and Tint.

**Beat 3 — Big scroll.** A thin wrapper around `type-scroll`'s effect, vendored verbatim apart from one added line. It was already written to be embedded — no imports, GSAP injected, CSS travelling with it — and already had `seek(p)`, so the wrapper only translates between two nearly identical APIs.

**Big scroll's hold and dots.** The beat runs in three phases, all a remap of scroll progress inside `beats/big-scroll.js` (the vendored effect only ever sees `seek()`): **arrive** — the block rises at scroll speed; **hold** — it stops with its vertical centre in the middle of the screen (which is always the exact midpoint of the effect's travel) while the inline images reveal one after another with the Blocks reveal, then a short pause; **release** — the words carry on up and off the top, still rolling over the edge, while the images, drawn in their own `.big__dots` layer rather than by the effect, gather into a centred row. The dots stay on screen at the end of the beat, set up for Beat 4. Their hold positions are computed from the effect's layout (line size, slot offset, centred block), not read off the screen, so every frame stays a pure function of progress. Each image has two canvases painted from the same reveal: one inside its slot in the text, which rides, curls and fades with its line until the release (so the reveal can start while the block is still arriving), and one in the overlay, which takes over at the exact hold position at the release and gathers into the row. Controls: Hold length, Reveal starts (0 = as the block locks, 1 = as it starts arriving), Pause after reveal, and Dots → Row order (left to right by image number; default 2 · 1 · 3), Spacing, Final scale.

## Testing

No test suite. Verify in a browser at 1440×866, which matches the Figma frames.

```js
__page.director.byId('flow').api.seek(0.4)   // scrub one beat
__page.director.beats.map(b => b.trigger.progress)
```

## Assets

- `src/assets/images/`: the 14 images from the Figma brand campaign frame — the pool Flow's tiles and Big scroll's slots draw from, by position.
- `src/assets/video/`: hero videos for Open road. Each `.mp4` with a same-named `.jpg` as its poster (shown while it loads). `hero-video.mp4` is the default — the Filmsupply clip *couple-exploring-new-york-pov* (Parker Foster), repackaged from `.mov` to `.mp4` without re-encoding. **It's the watermarked preview:** publishing needs the licensed, clean file from Filmsupply. Open road's **Hero** switch picks Video or Image; the video loops muted while on screen and, as the square leaves for Flow, freezes on its current frame — that frame is what the flying tile carries. Scroll back and it plays on.
- `src/assets/hero/`: hero images for Open road (`hero-traffic.webp` is the default). Kept apart from the pool so adding one doesn't reshuffle Flow or Big scroll; Open road's Picture grid shows these first, then the pool. Any jpg/png/webp/gif/avif dropped in here appears in the grid.
- `src/assets/fonts/ABCCameraPlainVariable.woff2`: ABC Camera Plain, a commercial Dinamo font. Don't redistribute it, and publishing to the web needs ALSO's web licence.

## Upstream

Beats 2 and 3 came from `../CLAUDE VIBE CODE/image-flow` and `../CLAUDE VIBE CODE/type-scroll`. `type-scroll-effect.js` and `type-scroll-model.js` are straight copies, so upstream fixes stay a re-copy. Beat 2 was restructured and is no longer a straight copy — changes there have to be ported by hand.

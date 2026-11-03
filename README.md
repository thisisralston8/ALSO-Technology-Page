# ALSO — Technology page intro: Traffic variation

A variation of the ALSO technology page prototype (`../ALSO Technology Page`): Flow, Big scroll and Aggregate are replaced by one section, **Traffic**. The flow is Open road → Traffic → Isometric platform. Runs on `localhost:4860`, and keeps its own saved settings (`also-traffic-page:*` in localStorage), so it never mixes with the original.

Three scroll-driven beats as one continuous page, each still editable in place.

```
npm install
npm run dev        # http://localhost:4860
npm run dev:phone  # the same, also on your Wi-Fi — open the "Network" URL it prints on your phone
npm run optimize   # regenerate the optimized media (runs on its own on dev start and on build)
npm run build
```

`dev:phone` exposes the dev server, and its *Save as default* and upload endpoints, to everyone on the network. Use it on trusted Wi-Fi only.

Press **H** to show or hide the inspector, and **W** to toggle wireframe mode (also the **Images / Wireframe** switch at the top of the inspector). Wireframe turns every image into a flat `#d9d9d9` fill so a review stays on motion and layout; it's a CSS filter, so nothing about timing changes. Add `?wireframe=1` to a link to open it in wireframe for that visit.

| Beat | Name | Copy |
|---|---|---|
| 1 | Open road | `This is an ▣ open road.` |
| 2 | Traffic | `In the future, there is no traffic.` … `Start ▣ small` |
| 3 | Isometric platform | `The in-house platform built for a ride that's out-of-this-world.` |

## Settings and defaults

Settings come from three layers, lowest first:

1. the built-in `*_DEFAULTS` in each beat's source
2. **`src/defaults.json`** — the project defaults
3. this browser's own unsaved tweaks (localStorage, saved automatically as you edit)

**Save as default** (top of the inspector footer) writes everything currently on screen into `src/defaults.json`, so it becomes the starting point for anyone who opens the page — including a production build, which bakes the file in. It asks to confirm first, keeps the previous file as `src/defaults.prev.json` (copy it back to undo one save), clears your local tweaks (they now *are* the defaults) and reloads. It's only offered on the dev server, which is what writes the file. **Reset all** clears your local tweaks back to the saved defaults; to get back to the built-in values, set `src/defaults.json` to `{}`.

Images are saved by name (`img-01`), not URL, because a build renames them with a content hash.

### Phone settings

Every section's settings have a mobile layer, for phones and tablets. Below **1024 px** wide (`(max-width: 1023px)`) the page uses `{ ...settings, ...settings.mobile }`; at 1024 px and up it ignores `mobile`. (The small video copies, the nav's compact form and the panel's bottom sheet still go by phone width, below 768 px.) The switch is live — resize across it and the page re-lays itself out.

- **Desktop | Mobile** at the top of the inspector picks which set you're editing. It starts on Mobile on a phone-width window. In Mobile, a control that has its own phone value is marked **phone · use desktop**; click that to drop the phone value and follow desktop again. Editing a value the current width isn't showing gets a hint saying so.
- Starting phone values live next to each section's defaults (`OPEN_ROAD_MOBILE`, `TRAFFIC_MOBILE`, `PLATFORM_MOBILE`, `PAGE_MOBILE` in `main.js`): smaller type, text placed for a narrow screen, 7 lanes, the platform's text at the top with the platform centred below, grain held still, trails off. Saved phone values sit on top of them.
- *Save as default* and the local autosave store `mobile` along with everything else.
- On a phone the inspector starts hidden behind a **Controls** button and opens as a bottom sheet.

### Stepping through the layers

Between the Hardware and Autonomy stops, the platform doesn't scroll freely (`src/steps.js`):

- **One gesture, one layer:** a wheel or trackpad flick, or a swipe, moves one layer with a timed move. The camera and text never rest half way.
- **Free at the ends:** scrolling down past Autonomy, or up past Hardware, lets go into a free scroll again. Free scrolling into the layers catches at the first one you reach.
- **Settings:** in Isometric platform → Story → **Stepping through the layers**: on/off, move duration, ease, and the pause the wheel needs before the next gesture counts. The pause is what makes a trackpad flick's glide count as one step.
- **How:** it hooks Lenis's `virtualScroll` and moves with `lenis.scrollTo`. The beat itself is unchanged.

### Explore modal

The platform's **Explore** buttons open a modal (`src/modal.js`), after pda.archi/expertises:

- **Opening:** the layer's text block grows into a card in the centre of the screen. It starts in the section's own colour and turns into the card's colour, with its corners rounding as it goes. The block's headline travels into the card's header. The section dims and blurs, and the page is locked. Once the card has landed, its content rises in.
- **Long content** scrolls inside the card's own layer.
- **Reading on:** all three layers are cards in one scroll, after GSAP's "pinned panels with overscroll" demo.
  - Scroll past the end of a layer and its card holds, shrinking and fading, while the next slides up over it.
  - The outgoing card is cut at the incoming card's top edge, so see-through cards don't overlap.
  - **Content cascades:** early in a handover, the outgoing card's content cascades away bottom up, rising and fading, with the headline last.
  - The incoming card's headline arrives with the card, and its body cascades in beneath it, top down, once the card is most of the way up.
  - The cascades play on time once the scroll crosses those points (Reading on → Content between layers). Scrolling back plays them the other way.
  - Content blurs as it fades out and comes into focus as it fades in, on open too. The amounts are settings.
  - Each card is a pure function of the scroll, so scrolling back up reverses exactly.
  - The section behind moves to the layer being read.
- **Closing** is the same move backwards, a little faster. It starts from wherever the card is, so a scrolled card or one that hasn't finished opening closes cleanly. If the card's headline isn't wholly on screen, it doesn't fly back in from off the edge. The platform's own headline fades in and comes into focus in place instead, using **Blur as it arrives**.
- **The close button** floats at the bottom centre, over everything. It closes from any layer, as do Esc and a click outside the card.
  - Its size, icon size, distance from the bottom and colours are settings (Explore modal → Close button).
  - Its icon can be an uploaded SVG. The SVG is cleaned of scripts and links (`src/svgIcon.js`) and recoloured to the icon colour, and the markup is kept in the settings.
- **Settings:** Isometric platform → **Explore modal** holds the timing, ease, dim, blur, card columns, margins and colours, each with its own phone values.
- **Content:** a wireframe for now.

The beat only fires a `plat:explore` event; `main.js` opens the modal with the platform's current settings.

### Open road on phones

The hero can start in a set shape (Open road → Layout → **Hero shape**). Phones start at 9:16. The hero is centred in the screen below the nav: the space ends at the bottom of the small viewport, the screen with the address bar showing, as it is at the top of the page. **Hero height** caps how much of that space it fills. A shaped hero closes straight to the 1:1 square, with no strip in the line. Its shape and size ease separately so it never turns wide on the way. Fill, the desktop setting, keeps the original hero → strip → square move.

### Nav

The header is ridealso.com's (Figma: Brand Campaign › Main Nav), in `index.html` with its looks in `style.css` and behaviour in `src/nav.js`. At the top of the page it's clear. Scrolling down tucks it away, and scrolling up brings it back as a white card with the ink border and purple drop shadow (the Figma "Midscroll peek"), timed like the live site: 0.35 s. Below 1024 px it shows the logo, cart and menu, as the live site does. Icons are the Figma exports in `src/assets/nav/`. The type is Serial C Heavy, a commercial face: a local copy in `src/assets/fonts/` for the prototype, under the same licence caveat as ABC Camera. The links are placeholders.

### Phone preview

**Preview** (or P), next to Desktop / Mobile in the panel, shows the page at phone size in the space left of the panel, so the controls never cover it. Pick the size above it: iPhone 12–16, mini, Pro Max or iPad. It's the page itself loaded again in a frame (`?embed`), so it gets a real phone-width viewport: media queries, the 4-column grid and the mobile settings all switch on, just as they do on a phone. Turning it on switches the panel to Mobile. Edits, the grid and wireframe show in it as you make them, and picking a section scrolls it there.

Edits also sync between any open windows of the page (through localStorage's `storage` event). So a narrow browser window with its panel hidden, beside a wide one with the panel open, works too.

### Traffic round the text

Traffic steers round each line of text, keeping **Clearance** (Traffic → Congestion round the text) clear of the words as they're actually drawn. Where a line leaves room on screen beside it, the lanes squeeze into that. Where it doesn't — on a phone a line can fill its whole side of the road — the lanes snake off the edge of the screen round the line and back on below it, by up to **Off-screen reach** × the screen width (Mobile 0.6, Desktop 0.25; 0 keeps everything on screen). **Edge margin** can go below 0 to run the outer lanes partly off screen all the time. The closing formation waits for a lane to get back on screen before gathering it in.

### Layout grid

Text and buttons — Traffic's lines and the platform's intro and layer text — sit on a layout grid (`src/grid.js`); the visuals don't. Stretch columns between fixed margins, like Figma's: **12 columns, 40 px margins, 24 px gutters** on desktop, **4 / 20 / 20** below 1024 px. Both are Page settings (Page → Layout → Layout grid), with a mobile value like everything else.

Each placed text has **Starts at column**, **Spans** (it wraps inside those columns) and **Aligned** (left / centre / right within them) — separately for Desktop and Mobile. The column sliders go up to the grid's column count for the mode being edited. "Start small" stays centred over the dock and is kept inside the grid's margins.

**Grid** (next to Images / Wireframe) or **G** shows the columns over the page.

Two things adapt on their own, without phone values: Open road's headline shrinks to fit when the line would be wider than the screen (narrow windows, tablets), and the platform sizes to the screen's width as well as its height.

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

The tile is released into something already moving. Traffic carries `lead`, so its progress — and its traffic — begins the moment Open road unsticks. Its entry anchor is *live* (`live: true`): the director doesn't fly the tile between two points, it draws it wherever the hero's own path has it, so the release is one move from Open road's square into the traffic. (Non-live anchors still get the original down-and-left flight.)

Not every boundary is a handoff. Traffic → Isometric platform has no seam: the platform *joins* Traffic's last frame instead (`join: true`).

Per-seam timing lives on the outgoing beat's config: `seamHold` keeps the tile exactly where it was left while the old beat scrolls away around it, and `seamEnd` lets the handoff finish part-way through the gap, so the incoming beat's real tile takes over mid-slide and just keeps going.

The handover window is the viewport-height gap between one stage unsticking (`bottom bottom`) and the next sticking (`bottom top`). No scroll is invented for the transition; the gap was always there, and the director paints it. Because anchors are read live from `getBoundingClientRect()`, the flying tile rides both stages as they slide.

Endpoints get clamped into the viewport, so the tile can never fly between two invisible points across an empty screen. Clamping is safe because it is the identity inside the viewport: the flown tile can only disagree with a beat's own tile where that tile is off-screen anyway.

## Files

```
src/
  main.js                 boot: Lenis, GSAP, director, editor
  director.js             the sequence — beats, scroll ranges, seams
  beats/
    open-road.js          Beat 1
    traffic.js            Beat 2 — the hero slipping through traffic
    platform.js           Beat 3 — the isometric platform (three.js)
  editor/
    inspector.js          click a beat → its controls
    schema.js             per-beat control schemas
    store.js              autosave + config import/export
```

## The beats

**Beat 1 — Open road.** The headline never fades. It is always fully opaque and always sits a fixed gap from the image's left and right edges, so the image's width is what holds the two halves of the line apart. At the start the image is viewport-wide and pushes both runs off screen; as it shrinks it *pulls the text in*, and it carries on, without stopping, from the strip in the line to a 1:1 square. That is **one move under one easing**: each of position, width and height follows a smooth monotone curve through hero → strip → square (no overshoot, no stop at the strip), and scroll is shared out by how much changes in each part, with *Squaring share* keeping a minimum for the 1:1 reveal. The square then rests (*Rest on the square*) and is released into Traffic.

**Open road → Traffic.** The square is released as Open road's stage unsticks (after *Wait before release*), and the hero's path in Traffic *starts* as that square — same place, same size, at rest — easing into its lane, height and size over *Settles over*. The director's handoff tile follows that path exactly while it carries the hero (Traffic reports a **live** entry anchor), so there's no separate flight to meet: speed carries straight through. Measured at 1440×866, the largest step-to-step change in speed from the top of Open road into the traffic is about 1px per 20px of scroll. Two more things keep it to exactly one square on screen at every step: the picture is handed over as pixels, not as a new image — Open road freezes the video into a canvas, and the tile and Traffic's hero paint from that canvas (`src/cover.js`), so nothing waits on the browser decoding an image; and Traffic clips only its page (`.traf__view`) to its stage, not the hero, which can sit above the stage's top edge while the stage is still sliding in (it used to be cut off there until the stage caught up). Motion-trail echoes are cleared whenever the square changes hands, and the tile trails with Traffic's settings, since from the release it's Traffic's hero.

**Beat 2 — Traffic.** (`beats/traffic.js`) Open road's square becomes the *hero* (the beat reads Open road's square, its picture and `seamHold` through `handedBy()`, a director hook for a seam's incoming beat) and settles into its own lane, fixed in height on screen — it travels with the reader. Around it, lanes of *cars* (image tiles; flat grey in wireframe) head down the page slower than the page scrolls, so they drift up the screen as the hero overtakes them. Three lines of text sit in the road like obstacles: lanes squeeze into the gaps beside each line (the road is remapped, never crossed, so cars keep their order), and along the road cars are spaced by a density that rises above and through each line — they bunch up and crawl there. **Hero colour.** Set in Open road → *Hero colour*. The square takes on the colour as the image resolves into it — over *Comes in from* → *Fully coloured by*, shares of Open road's move (0 = the full-width hero, 1 = the finished square), as a layer over the picture (`.road__tint`) — so it leaves for Traffic already coloured. As the colour starts, the video holds its frame (and plays on if you scroll back above that point), and the held frame blurs up to *Blur* px as the colour comes in (the picture is in its own `.road__media` layer, scaled up a touch with the blur so its edges stay solid). Once fully coloured the picture isn't drawn at all, and the colour layer overlaps the square's edges by a pixel (as does the handoff tile's), so no sub-pixel sliver of the frame can show. Open road's exit anchor reports that colour (`tint`), and the handoff tile and Traffic's hero carry it on unchanged; docking then turns it to the dot colour. Traffic's *Hero's colour* option for the traffic follows the same setting. (It used to live in Traffic, applied after the release; a colour saved there is carried over.)

**What the traffic is made of.** Each piece is filled with an image from **`src/assets/traffic/`** or one of the *Colours* (Traffic → Traffic → *Fill: images & colours*). The folder is globbed by `main.js`, so adding or removing files there makes the page reload with them — any jpg, png, webp, gif or avif; the panel shows how many it found. *Colour vs images* sets the share of pieces that are colour (0 = all images, 1 = all colour); which pieces those are is seeded per piece, so the mix is stable between loads. *Colours* is an editable list (add, remove, a hex each), used in equal amounts. With no images everything is colour, and vice versa. In wireframe, images go grey and colour fills keep their colour. (The folder started as copies of the 14 samples in `src/assets/images/`, which Open road's picture grid still uses.)

**The traffic's shape.** Measured along the way to "Start small" (0 = the top of this section, 1 = the gap): the traffic starts *Size at the top* × bigger — packed and congested — shrinks to the hero's own size and shape between *Shrinks from* and *Hero-sized by*, then funnels into the gap between "Start" and "small" between *Funnels from* and *In the gap by*, fading as it arrives (*Road clears over*). Between *Starts turning at* and *Fully turned by* it also takes on a colour — the hero's own (*Hero's colour*, so changing the hero's colour changes it too) or *Its own* hex — laid over the pictures in each car's style, so trail echoes carry it; in wireframe the colour still shows over the grey. While funnelling, cars stop making room for the hero: they're flowing into its space.

**Hero path** (*Centre*, the default): once it settles, the hero is held at the exact centre of the screen all the way to the platform — the page and the traffic do all the moving. **The hero's clear path:** the road always keeps a clear lane down it for the hero (*Clear path* px either side, wider while the hero is still settling in, bigger, from Open road). Lanes live in the two sides of the road either side of it, each lane on one side for good, and never cross it — so nothing is ever pushed out of the hero's way; it simply slips through. Round a line of text, lanes squeeze into the room left *on their own side*, so the congestion still builds round the words; each lane also wanders gently (*Lane wander*) so the flow isn't ruled lines. Even in the closing formation the traffic stays either side of it. "Start ▣ small" is shifted so its *gap* is centred (and shrunk if that pushes the longer word past *Side margin*); the hero finishes docking — shrinking and filling in place — exactly as the gap passes through it, and the page carries on. *Lane* is the earlier behaviour: the hero rides its own straight lane (with its weave), and the clear path follows it.

**Into the platform.** The page never holds: "Start small" scrolls on up with everything else, and the platform's dark is simply the next stretch of Traffic's page — it starts *Space above the dark* px below "Start small" (`nightGap`; negative overlaps the text) and rises at page speed. *Parallax* (`startParallaxPx`): from the moment "Start small" enters the bottom of the screen to the moment it leaves the top, it falls steadily behind the page by that many px in total, so the dark (at page speed) gains that much on it; *Space above the dark* is the gap as it enters. The scroll at which the gap meets the hero is solved with the parallax included, so the dock stays exact. The dot is drawn twice, dark and in *Dot on the dark*, with the light one clipped to below the dark's edge, so it turns light exactly where it's covered. Traffic ends as the dark reaches the top of the screen (plus *Hold in the dark*), and the Isometric platform joins on that frame: `exitDot()` reports the light dot on the night, and the platform, seeing its own background already there, skips its wipe and starts straight on the dot.

**Uploading a hero video.** Open road's *Video* control lists every video in `src/assets/video/` by its poster; picking one switches the hero to video. *Upload video…* first opens the file in the browser and grabs a frame as its poster — which is also the check that the browser can play it (a codec it can't decode is refused with a message, before anything uploads). On the dev server the poster and video then go to `/__upload-video` (`vite.config.js`), which streams both to `node_modules/.also-uploads/` and moves them into `src/assets/video/` together once the video has fully arrived, never overwriting an existing name. The new video is selected before the upload, so the reload Vite does when that folder changes comes back showing it, and it's in every build from then on. A static build has no endpoint, so there the video plays from the file for that visit only. H.264 `.mp4` plays everywhere; `.mov`, `.webm` and `.m4v` are accepted too.

**Beat 3 — Isometric platform.** (`beats/platform.js`, three.js) Joins Traffic: it starts on Traffic's last frame, reading the dot's rect, colour, background and remaining text from Traffic's `exitDot()`. Black wipes up from the bottom (the dot is drawn twice — dark on the day layer, white on the night layer — so it turns white exactly where the dark covers it). The white dot is then the top face of the platform seen from straight overhead, sized so it matches the DOM dot to the pixel, and the camera moves through six stops — dot, hero, Hardware, Software, Autonomy, dot — with one easing per leg, holding at each while its text shows. The visual is the iso-flow prototype cut down to what this look needs: each of the three layers is a stack of flat, soft-edged horizontal planes (one instanced draw call, a colour per plane, no textures), coloured along a gradient up the layer, with a darker rim on each plane that reads as stripes down the block's sides; *Glow* draws a layer additively. Dropped from iso-flow: media and video, the blur and atlas shaders, keyframes, segments, explore/orbit and its own scroll. Size is the platform's scale, never the camera's distance, so the perspective never changes; the scale moves in proportion (log), since it spans a dot to a platform. The planes drift slowly up through each layer, it floats, and it leans towards the cursor — all on time, ambient, and held still while it's the dot. It ends on a white dot on black and exposes `exitDot()` for whatever joins it next.

**Line reveal.** (`src/lineReveal.js`) Every text — Open road's headline, Traffic's three lines and "Start small", the platform's intro and each layer's headline and body — rises in line by line, as in GSAP's *responsive line splits on scroll* demo: SplitText splits it into lines (`type: "lines"`, `mask: "lines"`, `autoSplit: true`, so it re-splits by itself when the width changes or fonts load) and `onSplit` builds a `gsap.from(lines, { yPercent, stagger, ease })` tween. On every re-split it reverts the old tween and carries on from where it was. The tween isn't handed back to SplitText, which would copy the old tween's time onto the new one after it was set and leave a line stuck half behind its mask. **Mode** — *Play once* (the default): when a text reaches its trigger point the whole reveal plays through over *Duration* (GSAP time, not scroll) and the text then stays revealed, even if you scroll back; *Follow scroll*: the reveal is tied to the scroll both ways, like the demo. The demo drives its tween with a ScrollTrigger; here it's paused and each beat drives it with `set(progress)` (any progress above 0 is the trigger in *Play once*), because these texts live in pinned sections that move them (and beats never listen to scroll): Traffic from where each text's top is on screen (*Triggers when text is at*, and *Fully revealed at* with Follow scroll), Open road over *Headline reveal* in its own scroll, the platform with its own text timeline (lines rise in and sink back out). One style for the page, in Page → Text → *Line reveal*: on/off, Rise (% of a line), Line stagger, Ease, Mask, Fade. A beat must un-split before it changes a text's content (SplitText's revert would restore the old text) and split again after; text that isn't laid out yet (a parked section) is split on its first visible frame. Screen readers get the whole text (SplitText's `aria-label`).

**Motion trail.** (`src/trail.js`) Every section has a *Motion trail* toggle with Echoes, Stagger (ms), Opacity, Falloff and Blur. It's a time-based echo, like video feedback: each section registers its moving images and dots (never text) — Open road's hero and the handoff tile, Traffic's hero and cars — and every frame the trail records each element's inline style, then shows `trailCount` copies of it as it was `trailStagger`, 2 × `trailStagger`, … ms ago, each fainter (`× (1 − falloff)`) and more blurred than the last. Scroll fast and it stretches; stop and it catches up and disappears. An echo identical to the live element is hidden, so nothing at rest gets a halo. Canvases are echoed by copying their pixels. Off by default and for reduced motion.

**Scrolling.** The page has one smoothing setting and one speed setting, both in the inspector's **Page** settings, both applied to the single Lenis instance. Every beat is a pure function of scroll progress, so every beat feels exactly the same glide.

**Grain and warmth.** A page-level analog finish (`src/grain.js`), tuned in the Page settings. *Warmth* is a flat tint multiplied over the page, so whites become warm paper and blacks stay black. *Grain* is a seeded noise tile, centred on mid-grey so it adds texture without shifting brightness, repeated across a fixed layer and blended over everything; it jumps to a new random offset `grainSpeed` times a second (a GPU transform, so nothing repaints) and stops for reduced motion. Both sit above every beat and the nav, below the editor, and are separate elements in `<body>` because `mix-blend-mode` only blends within its stacking context. Controls: Grain on/off, Amount, Size, Softness, Motion (fps), Colour noise, Blend; Warmth Amount and Tint.

## Performance

- **Media is optimized automatically, originals kept.** `scripts/optimize-media.mjs` writes into `src/assets/optimized/` (generated — don't edit it):
  - every hero video in two H.264 copies, `<name>.desktop.mp4` (1920 wide, ~3.5 Mbps) and `<name>.mobile.mp4` (720 wide, ~1.4 Mbps), through a small AVFoundation transcoder (`scripts/transcode.swift`, compiled on first use; macOS only, no ffmpeg needed);
  - every traffic image as a 360 px JPEG thumbnail (`sips`).
  It runs on dev-server start, whenever a file lands in `src/assets/video/` or `src/assets/traffic/` (so *Upload video…* and folder drops are covered), and before `vite build`. Files already up to date are skipped. The page picks the phone copy below 768 px at load, then the desktop copy, then the original.
- **three.js loads on demand**: the platform builds its page layers straight away and imports three.js when the page is idle, or the moment it's needed. The initial script is ~85 KB gzipped.
- The platform only redraws when something changes, and on phones it renders without antialiasing at ≤1.5× pixel ratio.
- Traffic pieces have no `will-change` (hundreds of GPU layers cost phones memory); each piece is layout-contained instead.
- Heights use `lvh` and the scroll ranges are measured once per width, so iOS Safari's address bar showing and hiding doesn't move anything.

## Testing

No test suite. Verify in a browser at 1440×866, which matches the Figma frames — and at 375×812 for phones (the browser's device mode, or a real phone through `npm run dev:phone`).

```js
__page.director.byId('flow').api.seek(0.4)   // scrub one beat
__page.director.beats.map(b => b.trigger.progress)
```

## Assets

- `src/assets/images/`: the 14 images from the Figma brand campaign frame — offered in Open road's picture grid.
- `src/assets/traffic/`: the traffic's images. Drop more in at any time.
- `src/assets/optimized/`: generated phone/desktop video copies and traffic thumbnails (see Performance). Safe to delete; it's rebuilt.
- `src/assets/video/`: hero videos for Open road. Each `.mp4` with a same-named `.jpg` as its poster (shown while it loads). `hero-video.mp4` is the default — the Filmsupply clip *couple-exploring-new-york-pov* (Parker Foster), repackaged from `.mov` to `.mp4` without re-encoding. **It's the watermarked preview:** publishing needs the licensed, clean file from Filmsupply. Open road's **Hero** switch picks Video or Image; the video loops muted while on screen and, as the square leaves for Traffic, freezes on its current frame — that frame is what the flying tile carries. Scroll back and it plays on.
- `src/assets/hero/`: hero images for Open road (`hero-traffic.webp` is the default). Kept apart from the pool so adding one doesn't reshuffle the traffic; Open road's Picture grid shows these first, then the pool. Any jpg/png/webp/gif/avif dropped in here appears in the grid.
- `src/assets/fonts/ABCCameraPlainVariable.woff2`: ABC Camera Plain, a commercial Dinamo font. Don't redistribute it, and publishing to the web needs ALSO's web licence.

## Upstream

Beats 2 and 3 came from `../CLAUDE VIBE CODE/image-flow` and `../CLAUDE VIBE CODE/type-scroll`. `type-scroll-effect.js` and `type-scroll-model.js` are straight copies, so upstream fixes stay a re-copy. Beat 2 was restructured and is no longer a straight copy — changes there have to be ported by hand.

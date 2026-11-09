# Handoff: ALSO Technology page → Shopify

This is the working prototype of the ALSO Technology page. Its motion, layout and every tuned value are meant to be carried into the Shopify site.

This note is for the engineers doing that. It covers:

- what to take;
- what to leave behind;
- how the pieces fit together;
- where the sharp edges are.

`README.md` describes every section in detail. `AGENTS.md` lists the architecture rules the code follows; read it before changing a beat.

## Getting the code

- **Repo:** https://github.com/thisisralston8/ALSO-Technology-Page (public, branch `main`).
- **Or without git:** the prototype's settings panel has a **Download** button (bottom row, next to Copy / Paste config). It downloads the latest push to `main` as a .zip into the browser's Downloads folder. It's whatever was last pushed, so local commits that haven't been pushed aren't in it.
- **Live prototype:** https://also-technology-page.vercel.app (with the settings panel).

## TL;DR

```
npm install
npm run dev          # the prototype, with the settings panel (http://localhost:4860)
npm run build:site   # the page as it should ship: no panel, settings baked in → dist/
```

- **What to port:** `npm run build:site` produces the real page. It has the six sections, page chrome (nav, modal, back-to-top) and the saved settings from `src/defaults.json`, with no editor code at all. That's the target.
- **Plain JavaScript:** vanilla ES modules, no framework, built with Vite. Runtime dependencies are `gsap` (3.15, with ScrollTrigger and SplitText), `lenis` (1.3) and `three` (0.169, loaded on demand for one section).
- **Settings are data:** every tuned number lives in `src/defaults.json`, keyed by section. Desktop values sit at the top level, and phone overrides sit under `mobile`. Nothing in the code needs re-tuning by hand.

## What ships and what doesn't

| Keep (the page) | Prototype only, drop it |
|---|---|
| `src/director.js` (scroll orchestration) | `src/editor/*` (settings panel in React + HeroUI, autosave, uploads) |
| `src/beats/*` (the six sections) | `vite.config.js` dev endpoints (`/__save-defaults`, `/__upload-*`, `/__delete-media`) |
| `src/modal.js`, `src/modalContent.js` (Explore modal) | `src/defaults.prev.json` (backup of the last *Save as default*) |
| `src/steps.js` (layer stepping), `src/nav.js` | `?frame` / `?embed` / `?panel` handling in `main.js` and `page.js` |
| `src/lineReveal.js`, `src/colorWave.js`, `src/grain.js`, `src/trail.js`, `src/grid.js`, `src/cover.js`, `src/svgIcon.js` | `scripts/` (macOS-only media optimizer; Shopify's CDN replaces it) |
| `src/three.js` (the trimmed three.js entry) | `localStorage` settings layer (already off in `build:site`) |
| `src/style.css`, `src/defaults.json`, `src/page.js` (boot) and `src/main.js` (entry) | `react`, `react-dom`, `@heroui/*`, `tailwindcss` and the Vite React/Tailwind plugins (panel only) |

`main.js` has a single switch, `EDITOR` (`VITE_EDITOR=off` in `build:site`), that removes the panel, the uploads and the localStorage layer. In that mode none of it is in the bundle, React and HeroUI included. Either way the page is `page.js`; `main.js` just decides whether this document is the page or the editor around it.

## How it works (one paragraph per idea)

**One scroll, one smoothing.** There is exactly one Lenis instance and one ScrollTrigger setup, both in `page.js`. `director.js` gives each section a sticky stage and a scroll range, and feeds it a single number: its progress, from 0 to 1.

**Sections are pure functions of progress.** A section (a "beat") implements `seek(p)`, `setConfig(cfg)`, `relayout()` and `destroy()`. It never reads the scroll and never adds its own easing toward a target. Randomness is seeded (`rnd(i, k)`), so scrubbing backwards is exact.

**A few things run on time instead.** These are triggered by scroll and then play out on their own, and each one's loop runs only while it's needed:

- the film grain;
- motion trails;
- the colour wave on "Start small" and the footer headline;
- the platform's drift and cursor lens;
- the verticals' dot cursor;
- the careers pixel trail;
- Traffic's cursor push.

**Traffic's cursor push.** Hovering over the traffic pushes nearby pieces aside, and they spring back (`push*` settings in `traffic.js`). It's an offset drawn on top of where scroll puts each piece, so it never changes the road. It's for hovering only:

- While the page scrolls, the cursor is ignored, and anything already pushed springs home. The cursor counts again once it moves, 150 ms after the scroll stops.
- Each frame touches only the pieces near the cursor and those still settling, never the whole road, and the loop sleeps when everything is at rest.
- The pointer handler only records the event. The stage is measured once a frame, before any writes.
- It's mouse and pen only, and it's off with reduced motion.

**Traffic round the text.** Each lane decides once per line of text which way to go round it, and keeps that decision (`route()` in `traffic.js`). It goes round on its nearer side, squeezes in if it has to, and only crosses to the far side when its own side has no room at all. Don't make that decision per frame or per y: when it was decided afresh at every point, the choice flipped partway at some widths and lanes jumped across the text.

**Hand-offs between sections.** Some sections pass an element or a picture to the next one, and the director wires these up:

- A seam flies one tile between two sections.
- `join` overlaps two sections on one frame.
- `cover` makes the next section rise over the previous one.
- `handedBy` / `followedBy` give a section the neighbouring section's API.

These are the most fragile part of the page. Test them by scrubbing slowly across every boundary.

**Settings are layered.** The layers are, lowest first:

1. Built-in `*_DEFAULTS` in each beat.
2. `src/defaults.json`.
3. In the prototype only, the browser's unsaved tweaks.

Below 1024 px wide, a section gets `{ ...settings, ...settings.mobile }`. Beats only ever see the merged result.

**Text sits on a grid.** Text is placed on a 12-column grid (4 columns on phones) from `src/grid.js`. Each placement is a column and span pair set in settings.

## Bringing it into Shopify

These are suggestions; adjust them to your theme's conventions.

1. **One section, one bundle.**
   - Build with `npm run build:site`. Put the JS and CSS in theme assets, or serve them from your own pipeline.
   - Mount them from a Shopify section (for example `sections/technology.liquid`) that renders the page's root markup from `index.html`: `<main id="page">` and `<div id="handoff">`.
   - Load the script as a module: `<script type="module" src="{{ 'technology.js' | asset_url }}"></script>`.
   - three.js is a separate chunk loaded with `import()`, so make sure chunk URLs resolve. Either set Vite's `base` to the asset URL, or build a single file and accept three.js in it.
2. **Header and footer.**
   - The prototype draws its own nav (`index.html` plus `src/nav.js`) to match ridealso.com. On Shopify, use the theme's header and drop these.
   - Keep the CSS variable `--nav-h` set to the real header's height: Open road centres its hero in the space under it.
   - The footer here is a section of the page (section 6, with the back-to-top cut). Decide with design whether it replaces the theme footer on this template or sits above it.
3. **Lenis is page-wide.**
   - It smooths the whole document, including the theme's header and footer, so it should only run on this template.
   - The modal stops and restarts it.
   - Anything in the theme that scrolls by itself (drawers, the cart) needs `data-lenis-prevent`, as the settings panel has here.
4. **Media from Shopify's CDN.**
   - The prototype lists media from folders with `import.meta.glob` and refers to each file by name (its *stem*, e.g. `field-motion-1`). Settings store those names, never URLs.
   - On Shopify, upload the files to *Files*, or use section blocks or metafields. Render a JSON map of stem → URL into the page (for example `<script type="application/json" id="tech-media">`) and build the same lists `page.js` builds: `trafficImages`, `videos` and `modalMedia`.
   - **Sizes the page expects:**
     - Traffic images are shown at most 360 px, so `image_url: width: 360` is enough.
     - Modal images are shown up to about 1200 CSS px; use a 2400 px source with `srcset`.
     - Videos: H.264 MP4, 1920 wide at about 3.5 Mbps for desktop and 720 wide at about 1.4 Mbps for phones. The page picks the phone copy below 768 px.
     - Video posters: a same-named JPEG.
   - **Which media the settings use today:**
     - The `modalMedia_*` keys under `platform` in `defaults.json`.
     - The hero image and video under `open-road` (`image`, `videos`).
     - Everything in the traffic folder.
5. **Copy.**
   - Headlines and body text are settings in `defaults.json` (and `src/modalContent.js` for the modal). If editors should change copy in the theme editor, map those keys to section settings and merge them over `defaults.json` at boot. That's the same layering the prototype already does.
   - Keep the motion values in JSON. They're tuned, not edited.
6. **Fonts.**
   - **ABC Camera Plain** (`src/assets/fonts/ABCCameraPlainVariable.woff2`) is a commercial Dinamo font, so the web needs ALSO's web licence. Don't redistribute the file.
   - **Serial C Heavy** (`SerialC-Heavy.otf`) is used for buttons and labels. Check its licence too, and ship it as WOFF2. It's an OTF here, about 62 KB, and would be roughly half that as WOFF2.
   - Both are probably on ridealso.com already. Reuse the theme's `@font-face` if they are.
7. **GSAP licence.** GSAP and all its plugins, SplitText included, have been free for commercial use since 3.13. Nothing to buy.

## Performance notes

All measured at 1440×866 in Chrome.

**Script.** Sizes in KB, minified, with the gzipped size in brackets:

| Build | Main script | Panel (loaded after the page runs) | three.js (when the platform approaches) |
|---|---|---|---|
| Prototype (`npm run build`) | 267 (99) | 716 JS (216) + 477 CSS (45) | 471 (117) |
| `build:site` | 273 (101) | none | 471 (117) |

The panel (React, HeroUI, Tailwind) is the prototype's only heavy part, and `build:site` leaves all of it out.

**Per-frame work while scrolling.** JavaScript per scroll update, by section:

| Section | Time per update |
|---|---|
| Open road, Platform verticals, Careers, Footer | under 0.01 ms |
| Platform | 0.05 ms, plus its WebGL draw, which happens only while it's on screen |
| Traffic | about 0.5 ms |

The platform's WebGL draw is the main GPU cost. On phones it runs without antialiasing and at most 1.5× pixel ratio.

**Media.**

- Only optimized copies ship. A production build used to carry the original files too (PNGs up to 15 MB, videos up to 55 MB); it no longer does, and `dist` went from 562 MB to 111 MB.
- The page itself downloads a hero video (about 7 MB on desktop, 3 MB on a phone) and 36 small JPEGs (about 1.8 MB).
- Modal media load only when the modal opens. Videos load as they come near view; images load lazily.

**Things to watch on Shopify.**

- Don't let the theme add `will-change` or `contain: paint` to the page's containers. The traffic layer positions its pieces outside its own box, and `contain: paint` clips them.
- Keep the sticky stages free of theme wrappers that set `overflow: hidden`, which breaks `position: sticky`.
- Line reveals wrap each line in a mask with `overflow: clip`. With tight negative tracking, the last letter's ink runs past its box and gets cut. Platform verticals gives its masks room sideways (`.vert .rv-line-mask` in `style.css`), and any new tightly tracked text needs the same.

## Testing checklist

- Sizes: 1440×866 (it matches the Figma frames), 768×1024 and 375×812. Then a real iPhone in Safari, portrait.
- Scrub slowly across every section boundary. Exactly one tile should be on screen, and nothing should jump:
  - Open road → Traffic (the square)
  - Traffic → Platform (the dot)
  - Platform → Verticals (the dot becomes the cursor)
  - Verticals → Careers (the cursor hands back)
  - Careers → Footer
- Platform layers: one swipe or wheel flick moves exactly one layer. Explore opens the modal from the button, the layer switcher cuts between layers, and close returns to the right layer.
- Traffic at several desktop widths (1024, 1040, 1200, 1300, 1440): no piece should jump sideways as it goes round a line of text.
- Traffic's cursor push: hovering pushes pieces aside and they spring back. Scrolling with the cursor over the traffic pushes nothing.
- Platform verticals: "Logistics", "Quick commerce" and "Passenger" show their last letter in full.
- Footer: back-to-top fades out, jumps to the top, and fades back in.
- Reduced motion: grain, trails and the colour wave settle to still frames, and Traffic's cursor push is off.
- Handy in the console:
  - `__page.director.byId('traffic').api.seek(0.4)`
  - `__page.director.beats.map(b => [b.def.id, b.trigger.progress])`

## Known rough edges

- **Traffic per-frame cost:** Traffic is the heaviest section to scroll. About 0.5 ms a frame is fine on a laptop. It's worth profiling on a mid-range Android phone.
- **Duplicate media:** `src/assets/modal` has two byte-identical 53 MB videos (`slice-squares-20261104165229` and `…-2`), and only `…-2` is used. Several traffic images have `(1)` / `(2)` copies of the same name; they aren't identical files, but check with design which are meant to be there.
- **Footer link columns:** the two link columns from an earlier frame are still in `footer.js`, hidden by default. Delete them if design confirms they're gone.
- **Pointer listeners:** the verticals' cursor, the careers trail and Traffic's cursor push listen to the pointer across the whole page. They're cheap (Traffic's returns at once unless its section is on screen and the page isn't scrolling), but on Shopify you may prefer to attach them only while their section is on screen.

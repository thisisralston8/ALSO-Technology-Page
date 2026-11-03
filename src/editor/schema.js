/* One control schema for all three beats.

   Both prototypes already generated their panels from a description rather than
   hand-written DOM — `SCHEMA` in type-scroll's main.js, `.ctl[data-key]` rows in
   image-flow's index.html. This is those two formats collapsed into one, so the
   inspector only has to know how to render a handful of control types.

   `p` is a path into the beat's config, dotted for nested values (Beat 3 keeps
   its settings under `params.*`, matching the upstream model). Add a control by
   adding an entry here — never by writing DOM by hand. */

export const SCHEMA = {
  page: [
    { group: 'Scrolling', note: 'The only smoothing on the page — every beat follows it.' },
    { p: 'smoothness', label: 'Smoothness', min: 0, max: 1, step: 0.01, hint: '0 = native, 1 = heavy glide' },
    { p: 'scrollSpeed', label: 'Scroll speed', min: 0.25, max: 3, step: 0.05, unit: '×' },

    { group: 'Grain', note: 'Film grain over the whole page, above every beat.' },
    { p: 'grain', label: 'Grain', type: 'seg', options: [['on', 'On'], ['off', 'Off']] },
    { p: 'grainAmount', label: 'Amount', min: 0, max: 0.5, step: 0.01 },
    { p: 'grainSize', label: 'Size', min: 0.5, max: 4, step: 0.05, unit: '×' },
    { p: 'grainSoftness', label: 'Softness', min: 0, max: 1, step: 0.01, hint: '0 = crisp, 1 = soft and clumpy' },
    { p: 'grainSpeed', label: 'Motion', min: 0, max: 30, step: 1, unit: ' fps', hint: 'New grain frames per second (0 = static)' },
    { p: 'grainColour', label: 'Colour noise', min: 0, max: 1, step: 0.01, hint: '0 = monochrome' },
    { p: 'grainBlend', label: 'Blend', type: 'seg', options: [['overlay', 'Overlay'], ['soft-light', 'Soft light'], ['multiply', 'Multiply'], ['screen', 'Screen']] },

    { group: 'Warmth', note: 'A tint multiplied over the page: whites warm up, blacks stay black.' },
    { p: 'warmth', label: 'Amount', min: 0, max: 0.6, step: 0.01 },
    { p: 'warmthTint', label: 'Tint', type: 'color' },
  ],

  'open-road': [
    { group: 'Timing' },
    { p: 'length', label: 'Scroll length', min: 2, max: 12, step: 0.5, unit: ' screens' },

    { group: 'Headline' },
    { p: 'text', label: 'Text', type: 'textarea', hint: '▣ marks where the image docks' },
    { p: 'typeSize', label: 'Type size', min: 32, max: 180, step: 1, unit: 'px' },
    { p: 'slotW', label: 'Slot width', min: 1, max: 8, step: 0.05, unit: 'em' },
    { p: 'slotH', label: 'Slot height', min: 0.6, max: 3, step: 0.02, unit: 'em' },

    { group: 'Image' },
    { p: 'heroMedia', label: 'Hero', type: 'seg', options: [['video', 'Video'], ['image', 'Image']], hint: 'The video freezes on its current frame as the square leaves for Flow' },
    { p: 'video', label: 'Video', type: 'video', hint: 'H.264 .mp4 plays everywhere. Uploads are saved into the project (src/assets/video).' },
    { p: 'image', label: 'Picture', type: 'image', hint: 'Used when Hero is Image' },
    { p: 'gutter', label: 'Hero margin', min: 0, max: 0.2, step: 0.005 },
    { p: 'heroHeight', label: 'Hero height', min: 0.4, max: 1, step: 0.01 },
    { p: 'radius', label: 'Corner radius', min: 0, max: 48, step: 1, unit: 'px' },

    { group: 'Motion' },
    { p: 'dockEnd', label: 'Pull-in length', min: 0.2, max: 0.9, step: 0.01 },
    { p: 'hold', label: 'Pause on line', min: 0, max: 0.4, step: 0.01 },

    { group: 'Handoff to Flow' },
    { p: 'seamHold', label: 'Wait before merging', min: 0, max: 0.9, step: 0.01 },
    { p: 'seamEnd', label: 'Merged by', min: 0.3, max: 1, step: 0.01 },

    { group: 'Motion trail', note: 'Echoes behind moving images and dots. Follows time: stop scrolling and it catches up.' },
    { p: 'trail', label: 'Trail', type: 'seg', options: [['on', 'On'], ['off', 'Off']] },
    { p: 'trailCount', label: 'Echoes', min: 1, max: 12, step: 1 },
    { p: 'trailStagger', label: 'Stagger', min: 8, max: 200, step: 1, unit: 'ms', hint: 'Time between echoes' },
    { p: 'trailOpacity', label: 'Opacity', min: 0.05, max: 1, step: 0.01, hint: 'The first echo' },
    { p: 'trailFalloff', label: 'Falloff', min: 0, max: 0.9, step: 0.01, hint: 'How quickly each further echo fades' },
    { p: 'trailBlur', label: 'Blur', min: 0, max: 30, step: 0.5, unit: 'px', hint: 'On the oldest echo; nearer echoes get less' },

    { group: 'Colour' },
    { p: 'bg', label: 'Background', type: 'color' },
    { p: 'fg', label: 'Text', type: 'color' },
  ],

  flow: [
    { group: 'Timing' },
    { p: 'length', label: 'Scroll length', min: 2, max: 16, step: 0.5, unit: ' screens' },

    { group: 'Motion' },
    { p: 'count', label: 'Images on canvas', min: 4, max: 140, step: 1 },
    { p: 'maxScale', label: 'Max scale', min: 0.2, max: 3, step: 0.05, unit: '×' },
    { p: 'minScale', label: 'Min scale', min: 0, max: 1.5, step: 0.01, unit: '×' },
    { p: 'parallax', label: 'Parallax', min: 0, max: 1, step: 0.01 },
    { p: 'taper', label: 'Taper start', min: 0, max: 1.6, step: 0.01 },
    { p: 'seed', label: 'Layout seed', min: 1, max: 999, step: 1 },
    { p: 'startAt', label: 'Already flowing', min: 0, max: 0.6, step: 0.01 },
    { p: 'handoffU', label: 'Merge point', min: 0.05, max: 0.95, step: 0.01 },
    { p: 'handoffLane', label: 'Merges', type: 'seg', options: [['above', 'Above copy'], ['below', 'Below copy']] },
    { p: 'aspect', label: 'Tile shape', type: 'seg', options: [['square', 'Square'], ['original', 'Original']] },

    { group: 'Text', note: 'Blurbs share the scroll evenly; the stream reshapes around each one.' },
    { p: 'texts', label: 'Blurbs', type: 'textlist', addLabel: 'Add blurb' },
    { p: 'typeSize', label: 'Type size', min: 16, max: 160, step: 1, unit: 'px' },

    { group: 'Text transition', note: 'Blocks reveal, as in Big scroll.' },
    { p: 'textTransition', label: 'Transition length', min: 0.1, max: 1, step: 0.01, hint: 'Share of each blurb’s scroll spent changing over' },
    { p: 'textBlocks', label: 'Blocks across', min: 2, max: 24, step: 1 },
    { p: 'textDepth', label: 'Pixel steps', min: 0, max: 4, step: 1 },
    { p: 'textScatter', label: 'Scatter', min: 0, max: 1, step: 0.01 },

    { group: 'Motion trail', note: 'Echoes behind moving images and dots. Follows time: stop scrolling and it catches up.' },
    { p: 'trail', label: 'Trail', type: 'seg', options: [['on', 'On'], ['off', 'Off']] },
    { p: 'trailCount', label: 'Echoes', min: 1, max: 12, step: 1 },
    { p: 'trailStagger', label: 'Stagger', min: 8, max: 200, step: 1, unit: 'ms', hint: 'Time between echoes' },
    { p: 'trailOpacity', label: 'Opacity', min: 0.05, max: 1, step: 0.01, hint: 'The first echo' },
    { p: 'trailFalloff', label: 'Falloff', min: 0, max: 0.9, step: 0.01, hint: 'How quickly each further echo fades' },
    { p: 'trailBlur', label: 'Blur', min: 0, max: 30, step: 0.5, unit: 'px', hint: 'On the oldest echo; nearer echoes get less' },

    { group: 'Colour' },
    { p: 'bg', label: 'Background', type: 'color' },
    { p: 'fg', label: 'Text', type: 'color' },
  ],

  'big-scroll': [
    { group: 'Timing', note: 'Moves 1:1 with the page; smoothing is set in the Page tab.' },
    { p: 'firstLineAt', label: 'First line on arrival', min: 0, max: 1, step: 0.01, hint: '0 = centre, 1 = bottom edge' },
    { p: 'holdLength', label: 'Hold length', min: 0.25, max: 5, step: 0.05, unit: ' screens', hint: 'How long the block holds in the middle while the images reveal' },
    { p: 'revealStart', label: 'Reveal starts', min: 0, max: 1, step: 0.01, hint: '0 = when the block locks, 1 = as it starts arriving' },
    { p: 'holdPause', label: 'Pause after reveal', min: 0, max: 0.6, step: 0.01, hint: 'Share of the hold left once the last image is in' },
    { p: 'textFade', label: 'Text fade', min: 0, max: 1, step: 0.01, hint: 'Share of the release the words take to fade out as the dots gather (0 = off)' },

    { group: 'Dots', note: 'As the words release, the images gather into a centred row.' },
    { p: 'dotsOrder', label: 'Row order (left → right)', type: 'seg', options: [['1 2 3', '1·2·3'], ['2 1 3', '2·1·3'], ['1 3 2', '1·3·2'], ['2 3 1', '2·3·1'], ['3 1 2', '3·1·2'], ['3 2 1', '3·2·1']] },
    { p: 'dotsGap', label: 'Spacing', min: 0, max: 400, step: 1, unit: 'px' },
    { p: 'dotsScale', label: 'Final scale', min: 0.25, max: 4, step: 0.05, unit: '×' },

    { group: 'Type' },
    { p: 'text', label: 'Text', type: 'textarea', hint: 'Enter starts a line · ▣ is an image' },
    { p: 'params.type.align', label: 'Alignment', type: 'seg', options: [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']] },
    { p: 'params.type.size', label: 'Text size', min: 3, max: 30, step: 0.5, unit: '%', hint: 'Of screen height. Shrinks only if a line would pass Max width.' },
    { p: 'params.type.fitWidth', label: 'Max width', min: 50, max: 100, step: 1, unit: '%', hint: 'Widest a line may get, as a share of the screen width.' },
    { p: 'params.type.leading', label: 'Leading', min: 0.8, max: 2, step: 0.01 },
    { p: 'params.type.tracking', label: 'Tracking', min: -0.1, max: 0.1, step: 0.005, unit: 'em' },
    { p: 'params.type.weight', label: 'Weight', min: 100, max: 900, step: 10 },

    { group: 'Roll' },
    { p: 'params.roll.band', label: 'Focus band', min: 0, max: 1, step: 0.01 },
    { p: 'params.roll.roll', label: 'Roll', min: 0, max: 100, step: 1 },
    { p: 'params.roll.fade', label: 'Edge fade', min: 0, max: 40, step: 1, unit: '%' },
    { p: 'params.roll.dim', label: 'Edge dim', min: 0, max: 1, step: 0.01 },
    { p: 'params.roll.slant', label: 'Edge slant', min: -40, max: 40, step: 1, unit: '°' },
    { p: 'params.roll.vskew', label: 'Speed skew', min: 0, max: 40, step: 1 },
    { p: 'params.roll.stagger', label: 'Skew stagger', min: 0, max: 1, step: 0.01 },

    { group: 'Images' },
    { p: 'params.img.size', label: 'Image size', min: 0.3, max: 2, step: 0.01, unit: 'em' },
    { p: 'params.img.aspect', label: 'Aspect', min: 0.4, max: 3, step: 0.01 },
    { p: 'params.img.radius', label: 'Radius', min: 0, max: 0.5, step: 0.01, unit: 'em' },
    { p: 'params.reveal.grid', label: 'Blocks across', min: 1, max: 12, step: 1 },
    { p: 'params.reveal.depth', label: 'Pixel steps', min: 0, max: 4, step: 1 },
    { p: 'params.reveal.scatter', label: 'Scatter', min: 0, max: 1, step: 0.01 },

    { group: 'Motion trail', note: 'Echoes behind moving images and dots. Follows time: stop scrolling and it catches up.' },
    { p: 'trail', label: 'Trail', type: 'seg', options: [['on', 'On'], ['off', 'Off']] },
    { p: 'trailCount', label: 'Echoes', min: 1, max: 12, step: 1 },
    { p: 'trailStagger', label: 'Stagger', min: 8, max: 200, step: 1, unit: 'ms', hint: 'Time between echoes' },
    { p: 'trailOpacity', label: 'Opacity', min: 0.05, max: 1, step: 0.01, hint: 'The first echo' },
    { p: 'trailFalloff', label: 'Falloff', min: 0, max: 0.9, step: 0.01, hint: 'How quickly each further echo fades' },
    { p: 'trailBlur', label: 'Blur', min: 0, max: 30, step: 0.5, unit: 'px', hint: 'On the oldest echo; nearer echoes get less' },

    { group: 'Colour' },
    { p: 'params.type.bg', label: 'Background', type: 'color' },
    { p: 'params.type.fg', label: 'Text', type: 'color' },
  ],

  aggregate: [
    { group: 'Timing', note: 'Positions below are shares of this beat’s scroll (0–1). The texts share the scroll between “In place at” and the exit equally.' },
    { p: 'length', label: 'Scroll length', min: 3, max: 20, step: 0.5, unit: ' screens' },

    { group: 'Text' },
    { p: 'texts', label: 'Texts', type: 'textlist', addLabel: 'Add text' },
    { p: 'textSize', label: 'Size', min: 16, max: 160, step: 1, unit: 'px' },
    { p: 'textY', label: 'Height on screen', min: 0.02, max: 0.9, step: 0.005, hint: 'Top of the text, × screen height' },
    { p: 'textWidth', label: 'Max width', min: 0.15, max: 0.95, step: 0.01, hint: '× screen width' },
    { p: 'textLeading', label: 'Leading', min: 0.8, max: 1.6, step: 0.01 },
    { p: 'textTracking', label: 'Tracking', min: -0.1, max: 0.1, step: 0.005, unit: 'em' },
    { p: 'textEntry', label: 'Comes in by', type: 'seg', options: [['scroll', 'Scrolling up'], ['fade', 'Fading up']], hint: 'Scrolling up moves it with the page, from below the screen' },
    { p: 'textIn', label: 'In place at', min: 0, max: 0.6, step: 0.005 },
    { p: 'textFadeIn', label: 'Fade-in length', min: 0.01, max: 0.3, step: 0.005, hint: 'Fading up only' },
    { p: 'textRise', label: 'Rise', min: 0, max: 120, step: 1, unit: 'px', hint: 'Fading up only' },
    { p: 'textStyle', label: 'Change', type: 'seg', options: [['blocks', 'Blocks'], ['fade', 'Fade']] },
    { p: 'textTransition', label: 'Change length', min: 0.05, max: 1, step: 0.01, hint: 'Share of each text’s scroll spent changing over' },
    { p: 'textBlocks', label: 'Blocks across', min: 2, max: 24, step: 1 },
    { p: 'textDepth', label: 'Pixel steps', min: 0, max: 4, step: 1 },
    { p: 'textScatter', label: 'Scatter', min: 0, max: 1, step: 0.01 },

    { group: 'Shapes', note: 'The shape under each text. Extra texts keep the last shape.' },
    { p: 'shapes.0', label: 'Under text 1', type: 'seg', options: [['swirl', 'Swirl'], ['globe', 'Globe'], ['ring', 'Ring'], ['path', 'Path']] },
    { p: 'shapes.1', label: 'Under text 2', type: 'seg', options: [['swirl', 'Swirl'], ['globe', 'Globe'], ['ring', 'Ring'], ['path', 'Path']] },
    { p: 'shapes.2', label: 'Under text 3', type: 'seg', options: [['swirl', 'Swirl'], ['globe', 'Globe'], ['ring', 'Ring'], ['path', 'Path']] },
    { p: 'shapes.3', label: 'Under text 4', type: 'seg', options: [['swirl', 'Swirl'], ['globe', 'Globe'], ['ring', 'Ring'], ['path', 'Path']] },
    { p: 'morphLength', label: 'Change length', min: 0.05, max: 1, step: 0.01, hint: 'Share of a text’s scroll the cards spend flying to the next shape, centred on the text change' },
    { p: 'morphStagger', label: 'Ripple', min: 0, max: 0.9, step: 0.01, hint: 'How unevenly the cards set off' },

    { group: 'Composition', note: 'Where the structure sits, and where the bottom of the screen crops it.' },
    { p: 'shapeY', label: 'Height on screen', min: 0.3, max: 1.6, step: 0.005, hint: 'The shape’s centre, × screen height' },
    { p: 'shapeScale', label: 'Scale', min: 0.3, max: 2.5, step: 0.01, unit: '×' },
    { p: 'cropY', label: 'Crop line', min: 0.3, max: 1, step: 0.005, hint: 'Cut off below here, × screen height (1 = the bottom of the screen)' },
    { p: 'cropFeather', label: 'Crop softness', min: 0, max: 300, step: 1, unit: 'px' },
    { p: 'perspective', label: 'Perspective', min: 300, max: 3000, step: 10, unit: 'px' },
    { p: 'cardRadius', label: 'Card rounding', min: 0, max: 30, step: 0.5, unit: 'px' },

    { group: 'Arrival', note: 'Big scroll’s three photos land in the first shape as the rest fades in round them.' },
    { p: 'settleEnd', label: 'Landed by', min: 0.02, max: 0.4, step: 0.005 },
    { p: 'growStart', label: 'Field fades in from', min: 0, max: 0.4, step: 0.005 },
    { p: 'growStagger', label: 'Grow spread', min: 0, max: 0.95, step: 0.01 },

    { group: 'Swirl', note: 'The loose field the photos arrive into, before it’s gathered into the shapes.' },
    { p: 'swirlCount', label: 'Count', min: 8, max: 200, step: 1 },
    { p: 'swirlRadius', label: 'Radius', min: 60, max: 1200, step: 1, unit: 'px' },
    { p: 'swirlCard', label: 'Card size', min: 8, max: 160, step: 1, unit: 'px' },
    { p: 'swirlEye', label: 'Clear middle', min: 0, max: 0.9, step: 0.01, hint: 'Share of the radius kept clear round the text' },
    { p: 'swirlY', label: 'Height on screen', min: 0.1, max: 0.9, step: 0.005, hint: 'Centre, × screen height' },
    { p: 'swirlTilt', label: 'Tilt', min: 0, max: 80, step: 1, unit: '°', hint: 'How far the disc is tipped towards you' },
    { p: 'swirlDepth', label: 'Thickness', min: 0, max: 800, step: 1, unit: 'px' },
    { p: 'swirlTumble', label: 'Tumble', min: 0, max: 90, step: 1, unit: '°' },
    { p: 'swirlSpeed', label: 'Spin', min: -0.3, max: 0.3, step: 0.005, unit: ' rev/s' },
    { p: 'swirlScroll', label: 'Scroll spin', min: -1, max: 1, step: 0.01, unit: ' rev' },

    { group: 'Globe' },
    { p: 'sphereCount', label: 'Count', min: 8, max: 200, step: 1 },
    { p: 'sphereRadius', label: 'Radius', min: 40, max: 900, step: 1, unit: 'px' },
    { p: 'sphereCard', label: 'Card size', min: 8, max: 160, step: 1, unit: 'px' },
    { p: 'sphereTilt', label: 'Tilt', min: -60, max: 60, step: 1, unit: '°' },
    { p: 'sphereSpeed', label: 'Spin', min: 0, max: 0.3, step: 0.005, unit: ' rev/s' },
    { p: 'sphereScroll', label: 'Scroll spin', min: -1, max: 1, step: 0.01, unit: ' rev', hint: 'Turns with scrolling, over the whole beat' },
    { p: 'sphereLift', label: 'Lift', min: -600, max: 600, step: 1, unit: 'px', hint: 'Negative raises it' },

    { group: 'Ring' },
    { p: 'ringCount', label: 'Count', min: 4, max: 80, step: 1 },
    { p: 'ringRadius', label: 'Radius', min: 40, max: 900, step: 1, unit: 'px' },
    { p: 'ringCard', label: 'Card size', min: 8, max: 160, step: 1, unit: 'px' },
    { p: 'ringTilt', label: 'Stand-up', min: 0, max: 90, step: 1, unit: '°', hint: '0 lies flat, 90 faces you' },
    { p: 'ringSpeed', label: 'Spin', min: -0.3, max: 0.3, step: 0.005, unit: ' rev/s' },
    { p: 'ringScroll', label: 'Scroll spin', min: -1, max: 1, step: 0.01, unit: ' rev' },
    { p: 'ringLift', label: 'Lift', min: -600, max: 600, step: 1, unit: 'px' },

    { group: 'Path' },
    { p: 'pathCount', label: 'Count', min: 4, max: 80, step: 1 },
    { p: 'pathCard', label: 'Card size', min: 8, max: 200, step: 1, unit: 'px' },
    { p: 'pathX', label: 'Near end', min: -900, max: 900, step: 1, unit: 'px', hint: 'Sideways; negative is left' },
    { p: 'pathNear', label: 'Near end depth', min: -600, max: 800, step: 1, unit: 'px', hint: 'Positive is in front of the screen' },
    { p: 'pathSwing', label: 'Swing', min: -1500, max: 1500, step: 1, unit: 'px' },
    { p: 'pathCurve', label: 'Curve', min: 0, max: 2, step: 0.01 },
    { p: 'pathRise', label: 'Rise', min: -600, max: 2000, step: 1, unit: 'px' },
    { p: 'pathDepth', label: 'Length', min: 100, max: 6000, step: 10, unit: 'px', hint: 'Into the distance' },
    { p: 'pathLift', label: 'Lift', min: -600, max: 600, step: 1, unit: 'px' },
    { p: 'pathYaw', label: 'Card turn', min: -60, max: 60, step: 1, unit: '°' },
    { p: 'pathSpeed', label: 'Flow', min: 0, max: 6, step: 0.05, unit: ' cards/s' },
    { p: 'pathScroll', label: 'Scroll flow', min: -20, max: 20, step: 0.5, unit: ' cards', hint: 'Over the whole beat' },
    { p: 'pathFade', label: 'Near fade', min: 0, max: 0.4, step: 0.005 },

    { group: 'Exit', note: 'Every card converges on one dot as the last text fades.' },
    { p: 'exitStart', label: 'Starts at', min: 0.3, max: 0.98, step: 0.005 },
    { p: 'exitEnd', label: 'One dot by', min: 0.35, max: 1, step: 0.005 },
    { p: 'exitStagger', label: 'Spread', min: 0, max: 0.9, step: 0.01, hint: 'How unevenly the cards set off' },
    { p: 'endY', label: 'Dot height', min: 0.1, max: 0.95, step: 0.005, hint: '× screen height (0.5 = centre)' },
    { p: 'endSize', label: 'Dot size', min: 4, max: 160, step: 1, unit: 'px' },
    { p: 'textOut', label: 'Text gone by', min: 0.05, max: 1, step: 0.01, hint: 'Share of the exit' },
    { p: 'fillColour', label: 'Dot colour', type: 'color' },
    { p: 'fillStart', label: 'Fills from', min: 0, max: 1, step: 0.01, hint: 'Share of the exit' },
    { p: 'fillEnd', label: 'Filled by', min: 0, max: 1, step: 0.01 },

    { group: 'Motion trail', note: 'Echoes behind moving images and dots. Follows time: stop scrolling and it catches up.' },
    { p: 'trail', label: 'Trail', type: 'seg', options: [['on', 'On'], ['off', 'Off']] },
    { p: 'trailCount', label: 'Echoes', min: 1, max: 12, step: 1 },
    { p: 'trailStagger', label: 'Stagger', min: 8, max: 200, step: 1, unit: 'ms', hint: 'Time between echoes' },
    { p: 'trailOpacity', label: 'Opacity', min: 0.05, max: 1, step: 0.01, hint: 'The first echo' },
    { p: 'trailFalloff', label: 'Falloff', min: 0, max: 0.9, step: 0.01, hint: 'How quickly each further echo fades' },
    { p: 'trailBlur', label: 'Blur', min: 0, max: 30, step: 0.5, unit: 'px', hint: 'On the oldest echo; nearer echoes get less' },

    { group: 'Colour' },
    { p: 'bg', label: 'Background', type: 'color' },
    { p: 'fg', label: 'Text', type: 'color' },
  ],
  platform: [
    { group: 'Timing', note: 'Shares of this beat’s scroll. After the wipe, the camera makes five equal moves: dot → hero → Hardware → Software → Autonomy → dot.' },
    { p: 'length', label: 'Scroll length', min: 3, max: 24, step: 0.5, unit: ' screens' },
    { p: 'wipeEnd', label: 'Black by', min: 0.01, max: 0.3, step: 0.005, hint: 'The dark rises from the bottom of the screen' },
    { p: 'hold', label: 'Hold at each stop', min: 0, max: 0.9, step: 0.01, hint: 'Share of each move the camera rests' },
    { p: 'capFade', label: 'Dot opens over', min: 0.02, max: 1, step: 0.01, hint: 'Share of the first move the white face takes to lift off' },
    { p: 'textFade', label: 'Text fade', min: 0.02, max: 1, step: 0.01, hint: 'Share of a move each text takes to fade' },
    { p: 'textRise', label: 'Text rise', min: 0, max: 60, step: 1, unit: 'px' },

    { group: 'Hero text' },
    { p: 'heroText', label: 'Text', type: 'textarea' },
    { p: 'heroSize', label: 'Size', min: 16, max: 120, step: 1, unit: 'px' },
    { p: 'heroWidth', label: 'Max width', min: 0.15, max: 0.95, step: 0.01, hint: '× screen width' },
    { p: 'heroTextY', label: 'Height on screen', min: 0.1, max: 0.9, step: 0.005, hint: 'Centre, × screen height' },

    { group: 'Layer 1 · Hardware (top)' },
    { p: 'layer1Title', label: 'Headline', type: 'textarea' },
    { p: 'layer1Body', label: 'Text', type: 'textarea' },
    { p: 'layer1Button', label: 'Button', type: 'textarea', hint: 'Leave empty for no button' },
    { p: 'layer1Top', label: 'Colour at top', type: 'color' },
    { p: 'layer1Bottom', label: 'Colour at bottom', type: 'color' },
    { p: 'layer1Blend', label: 'Blend', type: 'seg', options: [['normal', 'Normal'], ['glow', 'Glow']] },
    { p: 'layer1Width', label: 'Width', min: 0.2, max: 12, step: 0.05 },
    { p: 'layer1Height', label: 'Height', min: 0.2, max: 12, step: 0.05 },
    { p: 'layer1Planes', label: 'Planes', min: 2, max: 160, step: 1, hint: 'Fewer shows stripes' },
    { p: 'layer1Opacity', label: 'Opacity', min: 0.01, max: 1, step: 0.01, hint: 'Of each plane' },
    { p: 'layer1Feather', label: 'Softness', min: 0, max: 0.5, step: 0.005 },
    { p: 'layer1Stripes', label: 'Stripes', min: 0, max: 1, step: 0.01, hint: 'How much darker each plane’s edge is' },
    { p: 'view1Focus', label: 'Camera focus', min: 0, max: 1, step: 0.005, hint: 'Where it looks: 0 base … 1 top' },
    { p: 'view1Zoom', label: 'Camera zoom', min: 0.2, max: 6, step: 0.01, unit: '×' },
    { p: 'view1X', label: 'Platform across', min: -0.6, max: 0.6, step: 0.005, hint: '× screen width' },
    { p: 'view1Y', label: 'Platform down', min: -0.6, max: 0.6, step: 0.005, hint: '× screen height' },
    { p: 'view1Elev', label: 'Camera height', min: 0, max: 89, step: 0.5, unit: '°' },
    { p: 'view1Azim', label: 'Camera turn', min: -180, max: 180, step: 0.5, unit: '°' },

    { group: 'Layer 2 · Software (middle)' },
    { p: 'layer2Title', label: 'Headline', type: 'textarea' },
    { p: 'layer2Body', label: 'Text', type: 'textarea' },
    { p: 'layer2Button', label: 'Button', type: 'textarea', hint: 'Leave empty for no button' },
    { p: 'layer2Top', label: 'Colour at top', type: 'color' },
    { p: 'layer2Bottom', label: 'Colour at bottom', type: 'color' },
    { p: 'layer2Blend', label: 'Blend', type: 'seg', options: [['normal', 'Normal'], ['glow', 'Glow']] },
    { p: 'layer2Width', label: 'Width', min: 0.2, max: 12, step: 0.05 },
    { p: 'layer2Height', label: 'Height', min: 0.2, max: 12, step: 0.05 },
    { p: 'layer2Planes', label: 'Planes', min: 2, max: 160, step: 1, hint: 'Fewer shows stripes' },
    { p: 'layer2Opacity', label: 'Opacity', min: 0.01, max: 1, step: 0.01, hint: 'Of each plane' },
    { p: 'layer2Feather', label: 'Softness', min: 0, max: 0.5, step: 0.005 },
    { p: 'layer2Stripes', label: 'Stripes', min: 0, max: 1, step: 0.01, hint: 'How much darker each plane’s edge is' },
    { p: 'view2Focus', label: 'Camera focus', min: 0, max: 1, step: 0.005, hint: 'Where it looks: 0 base … 1 top' },
    { p: 'view2Zoom', label: 'Camera zoom', min: 0.2, max: 6, step: 0.01, unit: '×' },
    { p: 'view2X', label: 'Platform across', min: -0.6, max: 0.6, step: 0.005, hint: '× screen width' },
    { p: 'view2Y', label: 'Platform down', min: -0.6, max: 0.6, step: 0.005, hint: '× screen height' },
    { p: 'view2Elev', label: 'Camera height', min: 0, max: 89, step: 0.5, unit: '°' },
    { p: 'view2Azim', label: 'Camera turn', min: -180, max: 180, step: 0.5, unit: '°' },

    { group: 'Layer 3 · Autonomy (base)' },
    { p: 'layer3Title', label: 'Headline', type: 'textarea' },
    { p: 'layer3Body', label: 'Text', type: 'textarea' },
    { p: 'layer3Button', label: 'Button', type: 'textarea', hint: 'Leave empty for no button' },
    { p: 'layer3Top', label: 'Colour at top', type: 'color' },
    { p: 'layer3Bottom', label: 'Colour at bottom', type: 'color' },
    { p: 'layer3Blend', label: 'Blend', type: 'seg', options: [['normal', 'Normal'], ['glow', 'Glow']] },
    { p: 'layer3Width', label: 'Width', min: 0.2, max: 12, step: 0.05 },
    { p: 'layer3Height', label: 'Height', min: 0.2, max: 12, step: 0.05 },
    { p: 'layer3Planes', label: 'Planes', min: 2, max: 160, step: 1, hint: 'Fewer shows stripes' },
    { p: 'layer3Opacity', label: 'Opacity', min: 0.01, max: 1, step: 0.01, hint: 'Of each plane' },
    { p: 'layer3Feather', label: 'Softness', min: 0, max: 0.5, step: 0.005 },
    { p: 'layer3Stripes', label: 'Stripes', min: 0, max: 1, step: 0.01, hint: 'How much darker each plane’s edge is' },
    { p: 'view3Focus', label: 'Camera focus', min: 0, max: 1, step: 0.005, hint: 'Where it looks: 0 base … 1 top' },
    { p: 'view3Zoom', label: 'Camera zoom', min: 0.2, max: 6, step: 0.01, unit: '×' },
    { p: 'view3X', label: 'Platform across', min: -0.6, max: 0.6, step: 0.005, hint: '× screen width' },
    { p: 'view3Y', label: 'Platform down', min: -0.6, max: 0.6, step: 0.005, hint: '× screen height' },
    { p: 'view3Elev', label: 'Camera height', min: 0, max: 89, step: 0.5, unit: '°' },
    { p: 'view3Azim', label: 'Camera turn', min: -180, max: 180, step: 0.5, unit: '°' },

    { group: 'Hero view', note: 'The camera while the hero text shows.' },
    { p: 'heroFocus', label: 'Camera focus', min: 0, max: 1, step: 0.005, hint: '0 base … 1 top' },
    { p: 'heroZoom', label: 'Camera zoom', min: 0.2, max: 6, step: 0.01, unit: '×' },
    { p: 'heroX', label: 'Platform across', min: -0.6, max: 0.6, step: 0.005 },
    { p: 'heroY', label: 'Platform down', min: -0.6, max: 0.6, step: 0.005 },
    { p: 'heroElev', label: 'Camera height', min: 0, max: 89, step: 0.5, unit: '°' },
    { p: 'heroAzim', label: 'Camera turn', min: -180, max: 180, step: 0.5, unit: '°' },

    { group: 'Layer text placement' },
    { p: 'textX', label: 'Left edge', min: 0, max: 0.8, step: 0.005, hint: '× screen width' },
    { p: 'textY', label: 'Top', min: 0.05, max: 0.9, step: 0.005, hint: '× screen height' },
    { p: 'textWidth', label: 'Width', min: 160, max: 800, step: 1, unit: 'px' },
    { p: 'titleSize', label: 'Headline size', min: 14, max: 96, step: 1, unit: 'px' },
    { p: 'bodySize', label: 'Text size', min: 10, max: 28, step: 0.5, unit: 'px' },

    { group: 'Platform' },
    { p: 'layerGap', label: 'Gap between layers', min: 0, max: 3, step: 0.01 },
    { p: 'face', label: 'Top face', min: 0, max: 1, step: 0.01, hint: 'Opacity of each layer’s top plane' },
    { p: 'flow', label: 'Drift', min: 0, max: 4, step: 0.05, unit: ' planes/s' },
    { p: 'fov', label: 'Lens', min: 8, max: 60, step: 0.5, unit: '°', hint: 'Lower is flatter, more isometric' },
    { p: 'float', label: 'Idle float', min: 0, max: 6, step: 0.1, unit: '°' },
    { p: 'floatSpeed', label: 'Float speed', min: 0, max: 1, step: 0.01 },
    { p: 'tilt', label: 'Cursor lean', min: 0, max: 20, step: 0.5, unit: '°' },

    { group: 'Colour' },
    { p: 'night', label: 'Background', type: 'color' },
    { p: 'fg', label: 'Text', type: 'color' },
    { p: 'dotColour', label: 'Dot', type: 'color' },
  ],
};

/* ---------- dotted path access ---------- */

export const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

// Returns a new config — the beats compare old and new to decide what to rebuild,
// so mutating in place would hide the change from them.
export function setPath(obj, path, value) {
  const keys = path.split('.');
  const out = Array.isArray(obj) ? [...obj] : { ...obj };
  let node = out;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    node[k] = Array.isArray(node[k]) ? [...node[k]] : { ...node[k] };
    node = node[k];
  }
  node[keys[keys.length - 1]] = value;
  return out;
}

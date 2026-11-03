/* What's inside the Explore modal's three cards: the copy and the media
   slots, laid out after the Figma frames (Brand Campaign → Hardware /
   Software / Autonomy, desktop and mobile). The desktop frames are the
   source of truth for the words.

   A layer is a list of blocks, top to bottom:
     hero       one wide piece of media under the headline
     lede       a large centred paragraph
     rows       media beside text, one per row ('alt' alternates sides,
                'left' keeps the media on the left)
     grid       media over text, `cols` across
     statement  a big centred headline with a paragraph under it

   Every piece of media is a *slot*. What fills it — an image or a video —
   and its shape are settings (Isometric platform → Modal content), with
   separate desktop and phone values like every other setting. The keys are
   flat (`modalMedia_hw1`, `modalRatio_hw1`, …) so a phone override is one
   key, the same as any other. */

export const MODAL_LAYERS = [
  {
    id: 'hw', name: 'Hardware',
    blocks: [
      { kind: 'hero', slot: 'hwHero' },
      { kind: 'lede', text: 'Born of Rivian, ALSO applies the same design and production principles that yielded R1 and R2 to smaller form factors. The end result? A spectrum of capable vehicles, from delivery robot to microcar, designed to fit the unique needs of our most commonly taken trips—short ones.' },
      { kind: 'rows', style: 'alt', items: [
        { slot: 'hw1', title: 'Printed to perfection.', text: 'Built to the exact specifications and requirements of each vehicle, ALSO PCBs ensure a perfect harmony of form and function.' },
        { slot: 'hw2', title: 'Rides of epic propulsions.', text: 'ALSO propulsion systems, like TM-B’s DreamRide, aren’t just designed and calibrated in-house—every single motor is wound in-house.' },
        { slot: 'hw3', title: 'A shock to the systems.', text: 'Software-defined systems like brake-by-wire, drive-by-wire, and steer-by-wire simply don’t exist in vehicles smaller than cars—until now.' },
      ] },
    ],
  },
  {
    id: 'sw', name: 'Software',
    blocks: [
      { kind: 'hero', slot: 'swHero' },
      { kind: 'lede', text: 'Our vehicles are highly intelligent. Thousands of useful signals coming from vehicle which leads to better products. In house pipeline between the software and our product. There teleology that’s sending the signals to the cloud that we own. Sensors we own, cloud we own, software we own, OTA we own. Intelligent & connected.' },
      { kind: 'rows', style: 'left', items: [
        { slot: 'sw1', title: 'Built to get better.', text: 'Always improving, always impressing. With deep software integration, ALSO vehicles receive over-the-air updates (OTAs) that range from different ways to ride to security features.' },
        { slot: 'sw2', title: 'Full stack smarts.', text: 'Full stack architecture means that data and software pervade the ALSO experience. This makes for some of the world’s most intelligent and connected vehicles.' },
        { slot: 'sw3', title: 'State of the architecture.', text: 'Zonal architecture is the most modern automotive standard. Strategically placed compute modules unlock powerful functionality, and yield more cohesive OTAs.' },
      ] },
    ],
  },
  {
    id: 'au', name: 'Autonomy',
    blocks: [
      { kind: 'hero', slot: 'auHero' },
      { kind: 'lede', text: 'In partnership with Rivian, ALSO is on an accelerated path towards L4 autonomy. This self-sustaining framework will power a dynamic lineup of small autonomous vehicles.' },
      { kind: 'grid', cols: 3, items: [
        { slot: 'au1', title: 'A flywheel on wheels', text: 'With every ALSO or Rivian ride the model gets smarter. It’s a positive feedback loop that grows with each new set of wheels.' },
        { slot: 'au2', title: 'Scaled from square one.', text: 'With every ALSO or Rivian ride the model gets smarter. It’s a positive feedback loop that grows with each new set of wheels.' },
        { slot: 'au3', title: 'An intelligent head start.', text: 'ALSO is building on top of Rivian Autonomy, one of the most capable real-world driving data models in the world.' },
      ] },
      { kind: 'statement', title: 'Up and running on AV 2.0', text: 'AV2.0 is the next-generation autonomous vehicle model. Similar to LLMs, it’s an end-to-end neural network built on reasoning versus rules.' },
      { kind: 'grid', cols: 2, items: [
        { slot: 'au4', title: 'Transportation at TOPS speed.', text: 'Capable of 250 trillion operations per second (TOPS), ALSO’s on-board processor and in-vehicle inference platform combine and analyze massive data streams simultaneously.' },
        { slot: 'au5', title: 'Street smarts of a higher order.', text: 'Every ALSO and Rivian ride helps train our model to handle real-world situations, generalizable across environments. A double-parked truck is a double-parked truck whether it’s in New York or LA.' },
      ] },
    ],
  },
];

// Every slot, in reading order, with a label for the panel and the starting
// shapes from the Figma frames (desktop, phone).
const SHAPES = {
  hero: ['16:9', '4:5'],
  rows: { alt: ['16:10', '5:4'], left: ['1:1', '1:1'] },
  grid: { 3: ['9:8', '1:1'], 2: ['4:3', '1:1'] },
};
export const MODAL_SLOTS = MODAL_LAYERS.flatMap((l) => l.blocks.flatMap((b) => {
  if (b.kind === 'hero') return [{ id: b.slot, layer: l.name, label: 'Hero', shape: SHAPES.hero }];
  if (b.kind === 'rows') return b.items.map((it) => ({ id: it.slot, layer: l.name, label: it.title, shape: SHAPES.rows[b.style] }));
  if (b.kind === 'grid') return b.items.map((it) => ({ id: it.slot, layer: l.name, label: it.title, shape: SHAPES.grid[b.cols] }));
  return [];
}));

export const mediaKey = (slot) => `modalMedia_${slot}`;
export const ratioKey = (slot) => `modalRatio_${slot}`;
export const focusXKey = (slot) => `modalFocusX_${slot}`;
export const focusYKey = (slot) => `modalFocusY_${slot}`;

// Shapes offered for a slot. 'auto' is the asset's own shape.
export const RATIOS = ['auto', '21:9', '16:9', '16:10', '3:2', '4:3', '5:4', '9:8', '1:1', '4:5', '3:4', '2:3', '9:16'];

// Defaults for every slot: empty (a placeholder card), the Figma shapes,
// cropped about the centre.
export const MODAL_CONTENT_DEFAULTS = Object.fromEntries(MODAL_SLOTS.flatMap((s) => [
  [mediaKey(s.id), ''],
  [ratioKey(s.id), s.shape[0]],
  [focusXKey(s.id), 50],
  [focusYKey(s.id), 50],
]));
export const MODAL_CONTENT_MOBILE = Object.fromEntries(MODAL_SLOTS.map((s) => [ratioKey(s.id), s.shape[1]]));

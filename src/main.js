/* Entry. Decides what this document is:

   - the page itself (page.js): always, in `npm run build:site`; on a phone
     (with a Controls button that opens the settings panel as a sheet); and
     inside the editor's frames (`?frame`, `?embed`);
   - the settings panel in a sheet over the page on a phone (`?panel`);
   - the editor shell on a desktop: the settings panel docked on the right
     and the page in a frame beside it, so the page sees a real, narrower
     window (its grid, stages and fixed layers all follow the window's width).

   The panel (src/editor/panel) is React + HeroUI and never shares a document
   with the page: its styles reset the whole document they're in. */

const EDITOR = import.meta.env.VITE_EDITOR !== 'off';
const params = new URLSearchParams(location.search);
// Phones and small tablets: the page stays the top window, as it will be live.
const SHEET = '(max-width: 767px)';

if (!EDITOR) {
  import('./page.js');
} else if (params.has('panel')) {
  import('./editor/panel/sheet.jsx');
} else if (window.top === window && !params.has('embed') && !params.has('frame') && !matchMedia(SHEET).matches) {
  import('./editor/panel/shell.jsx');
} else {
  import('./page.js');
}

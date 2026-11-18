/* Prints one image (or a flat colour) with renderPrint (riso.js), off the
   main thread, and sends back a JPEG blob. The image is drawn at `size` px
   on its longer side. */

import { renderPrint } from './riso.js';

self.onmessage = async ({ data: { id, url, colour, params } }) => {
  try {
    const N = Math.max(16, params.size | 0);
    let w = N, h = N, bitmap = null;
    if (url) {
      const res = await fetch(url);
      bitmap = await createImageBitmap(await res.blob());
      const k = N / Math.max(bitmap.width, bitmap.height);
      w = Math.max(1, Math.round(bitmap.width * k));
      h = Math.max(1, Math.round(bitmap.height * k));
    }
    const canvas = new OffscreenCanvas(w, h);
    const g = canvas.getContext('2d', { willReadFrequently: true });
    g.fillStyle = colour || '#ffffff';
    g.fillRect(0, 0, w, h);
    if (bitmap) { g.drawImage(bitmap, 0, 0, w, h); bitmap.close(); }
    const pixels = renderPrint(g.getImageData(0, 0, w, h).data, w, h, params);
    g.putImageData(new ImageData(pixels, w, h), 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
    self.postMessage({ id, blob });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};

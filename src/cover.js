/* Paint a picture (canvas, video or decoded image) into a canvas, cropped
   like `object-fit: cover`, at the canvas's displayed size × devicePixelRatio.

   Used wherever one object has to keep the same picture as it passes from
   one element to another (Open road's square → the handoff tile → Traffic's
   hero). Drawing from a canvas or an already-decoded image is synchronous, so
   the new element shows the picture on the very frame it appears — unlike
   swapping an <img> src or a background-image, which the browser decodes
   later and paints a frame or more after the switch. */

export function sourceSize(src) {
  if (!src) return [0, 0];
  return [src.videoWidth || src.naturalWidth || src.width || 0, src.videoHeight || src.naturalHeight || src.height || 0];
}

export function paintCover(canvas, src, w, h) {
  const [sw, sh] = sourceSize(src);
  if (!sw || !sh || !(w > 0) || !(h > 0)) return false;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cw = Math.max(1, Math.round(w * dpr)), ch = Math.max(1, Math.round(h * dpr));
  if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
  let sx = 0, sy = 0, cropW = sw, cropH = sh;
  if (sw / sh > cw / ch) { cropW = sh * (cw / ch); sx = (sw - cropW) / 2; } else { cropH = sw / (cw / ch); sy = (sh - cropH) / 2; }
  const x = canvas.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.drawImage(src, sx, sy, cropW, cropH, 0, 0, cw, ch);
  return true;
}

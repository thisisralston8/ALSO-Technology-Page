/* Uploaded SVG icons (the explore modal's close button).

   `cleanSvg(text)` returns safe, recolourable markup, or '' if it isn't an
   SVG. Safe: no scripts, no foreignObject, no event handlers, no external or
   javascript: links — the markup is put into the page with innerHTML.
   Recolourable: every fill and stroke that isn't `none` becomes
   currentColor (attributes and inline styles alike), so the icon takes the
   button's colour setting; an SVG with no fill of its own gets
   fill="currentColor", since that's what it would draw in black. Its own
   size is dropped so CSS can size it. */

const BANNED = ['script', 'foreignObject', 'iframe', 'object', 'embed', 'style'];

export function cleanSvg(text) {
  if (!text || typeof text !== 'string') return '';
  let doc;
  try { doc = new DOMParser().parseFromString(text, 'image/svg+xml'); } catch { return ''; }
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) return '';
  svg.querySelectorAll(BANNED.join(',')).forEach((n) => n.remove());
  const paint = (v) => (v && v.trim() !== 'none' && !/^url\(/i.test(v.trim()) ? 'currentColor' : v);
  [svg, ...svg.querySelectorAll('*')].forEach((el) => {
    [...el.attributes].forEach(({ name, value }) => {
      const n = name.toLowerCase();
      if (n.startsWith('on')) el.removeAttribute(name);
      else if ((n === 'href' || n === 'xlink:href') && !value.trim().startsWith('#')) el.removeAttribute(name);
      else if (n === 'fill' || n === 'stroke') el.setAttribute(name, paint(value));
      else if (n === 'style') {
        el.setAttribute('style', value.replace(/(fill|stroke)\s*:\s*([^;]+)/gi, (m, k, v) => `${k}:${paint(v)}`));
      }
    });
  });
  if (!svg.hasAttribute('fill')) svg.setAttribute('fill', 'currentColor');
  // A viewBox keeps its shape once the fixed size is gone.
  const w = parseFloat(svg.getAttribute('width')), h = parseFloat(svg.getAttribute('height'));
  if (!svg.hasAttribute('viewBox') && w > 0 && h > 0) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  return new XMLSerializer().serializeToString(svg);
}

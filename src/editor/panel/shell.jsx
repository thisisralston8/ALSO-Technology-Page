/* The editor shell (desktop): the page in a frame on the left and the
   settings panel docked on the right. The page sees a real window the size
   of its frame, so its grid, stages and fixed layers all follow it, exactly
   as they would in a browser that size.

   The panel's Desktop | Mobile switch is also the view: Desktop gives the
   page all the space beside the panel; Mobile shows the same page at a
   phone's size (one frame, resized, so the page switches to its phone
   settings and the panel keeps driving it). Hiding the panel (H) gives the
   page the whole window. */

import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, ListBox, Select } from '@heroui/react';
import { loadView, saveView } from '../store.js';
import { Panel } from './Panel.jsx';
import { PanelRight } from './icons.jsx';
import './panel.css';

const PANEL_W = 400;
// Phone and tablet sizes for the Mobile view (all below the 1024 px breakpoint).
const SIZES = [
  ['390x844', 'iPhone 12–16'],
  ['375x812', 'iPhone mini'],
  ['430x932', 'iPhone Pro Max'],
  ['768x1024', 'iPad'],
];
const patchView = (patch) => saveView({ ...loadView(), ...patch });

// The page's own URL with one flag (and any `?wireframe` from a shared link).
function pageUrl(flag) {
  const url = new URL(location.href);
  const wf = url.searchParams.get('wireframe');
  url.search = `?${flag}${wf != null ? `&wireframe=${wf}` : ''}`;
  url.hash = '';
  return url.href;
}

// Scale that fits a w × h device into the stage, with room for its bar.
function useFit(stage, w, h, on) {
  const [k, setK] = useState(1);
  useEffect(() => {
    if (!on || !stage.current) return undefined;
    const fit = () => {
      const r = stage.current.getBoundingClientRect();
      setK(Math.min(1, (r.width - 48) / w, (r.height - 88) / h));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stage.current);
    return () => ro.disconnect();
  }, [stage, w, h, on]);
  return k;
}

function Shell() {
  const frame = useRef(null);
  // The page's host, and a count of how many pages it's been (a reloaded
  // page is a new host, and the panel starts fresh for it).
  const [conn, setConn] = useState({ host: null, n: 0 });
  const host = conn.host;
  const setHost = (h) => setConn((c) => (c.host === h ? c : { host: h, n: c.n + 1 }));
  const [panelOn, setPanelOn] = useState(true);
  const [device, setDeviceState] = useState(loadView().device === 'mobile' ? 'mobile' : 'desktop');
  const setDevice = (d) => { setDeviceState(d); patchView({ device: d }); };
  const [size, setSizeState] = useState(SIZES.some(([v]) => v === loadView().previewSize) ? loadView().previewSize : SIZES[0][0]);
  const setSize = (v) => { setSizeState(v); patchView({ previewSize: v }); };
  const mobile = device === 'mobile';
  const stage = useRef(null);
  const [w, h] = size.split('x').map(Number);
  const k = useFit(stage, w, h, mobile);

  // The page hands over its host when it boots (host.js), and again after
  // every reload of the frame.
  useEffect(() => {
    window.__shell = { attach: setHost };
    return () => { delete window.__shell; };
  }, []);
  const onFrameLoad = () => {
    try { const h = frame.current.contentWindow.__editorHost; if (h) setHost(h); } catch { /* not ready */ }
  };

  // H, from either document.
  useEffect(() => {
    const act = (k) => {
      if (k === 'h') setPanelOn((v) => !v);
    };
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea, [role="textbox"], [role="slider"]')) return;
      act(e.key.toLowerCase());
    };
    addEventListener('keydown', onKey);
    const off = host?.on((ev) => ev.type === 'key' && act(ev.key));
    return () => { removeEventListener('keydown', onKey); off?.(); };
  }, [host]);


  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <main ref={stage} className={`relative flex min-w-0 flex-1 flex-col ${mobile ? 'items-center justify-center gap-4 bg-surface-secondary' : ''}`} aria-label="Page">
        {mobile && (
          <Select aria-label="Phone size" value={size} onChange={(v) => v && setSize(String(v))} className="w-56 shrink-0">
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {SIZES.map(([v, name]) => (
                  <ListBox.Item key={v} id={v} textValue={`${name} ${v}`}>
                    {name}<span className="tabular ml-auto pl-3 text-xs text-muted">{v.replace('x', ' × ')}</span><ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        )}
        {/* One frame for both views (it's never reloaded by switching): full
            size for Desktop, a phone's size, scaled to fit, for Mobile. */}
        <div className={mobile ? 'shrink-0 overflow-hidden rounded-[28px] shadow-2xl ring-1 ring-border' : 'min-h-0 flex-1'}
          style={mobile ? { width: w * k, height: h * k } : undefined}>
          <iframe ref={frame} title="Technology page" src={pageUrl('frame')} onLoad={onFrameLoad}
            className="block border-0 bg-white"
            style={mobile
              ? { width: w, height: h, transform: `scale(${k})`, transformOrigin: '0 0' }
              : { width: '100%', height: '100%' }} />
        </div>
        {!panelOn && (
          <Button className="absolute right-3 top-3 z-20 shadow-lg" variant="secondary" size="sm"
            onPress={() => setPanelOn(true)} aria-label="Show the settings panel (H)">
            <PanelRight /> Controls
          </Button>
        )}
      </main>
      {panelOn && (
        <aside className="h-full shrink-0 border-l border-separator" style={{ width: PANEL_W }} aria-label="Settings panel">
          {host
            ? <Panel key={conn.n} host={host} onHide={() => setPanelOn(false)} device={device} onDevice={setDevice} />
            : <p className="p-4 text-sm text-muted" role="status">Loading the page…</p>}
        </aside>
      )}
    </div>
  );
}

document.documentElement.classList.add('dark');
document.documentElement.dataset.theme = 'dark';
document.body.replaceChildren();
const root = document.createElement('div');
root.id = 'editor';
root.style.height = '100%';
document.body.appendChild(root);
createRoot(root).render(<StrictMode><Shell /></StrictMode>);

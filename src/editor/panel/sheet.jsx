/* The settings panel as a sheet over the page, on a phone (`?panel`, in a
   frame the page opens: editor/host.js). The page stays the top window, as
   it will be live; the panel reaches it through the parent's host. */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Panel } from './Panel.jsx';
import './panel.css';

document.documentElement.classList.add('dark');
document.documentElement.dataset.theme = 'dark';
document.body.replaceChildren();
const root = document.createElement('div');
root.style.height = '100%';
document.body.appendChild(root);

let host = null;
try { host = window.parent !== window ? window.parent.__editorHost : null; } catch { /* another origin */ }
createRoot(root).render(
  <StrictMode>
    {host
      ? <Panel host={host} onHide={() => host.hidePanel()} />
      : <p style={{ padding: 16 }}>Open the page itself, then tap Controls.</p>}
  </StrictMode>,
);

/* The inspector. Click a beat, edit that beat.

   Controls are generated from SCHEMA, never written by hand. Editor chrome stays
   plain and restrained, as in both prototypes: one accent colour, tabular
   numerals on values, no gradients and no glows. */

import { SCHEMA, getPath, setPath } from './schema.js';
import { exportAll, importAll, reset, loadView, saveView } from './store.js';
import './inspector.css';

export function createInspector({ director, images, onChange, extras = [], onSaveDefaults = null, onUploadVideo = null }) {
  let selected = director.beats[0]?.def.id || null;

  // Tabs that aren't beats (the Page tab) have no stage and no scroll trigger.
  const find = (id) => extras.find((e) => e.def.id === id) || director.byId(id);
  const entries = () => [...extras, ...director.beats];
  let open = true;

  const root = document.createElement('aside');
  root.className = 'insp';
  root.setAttribute('data-lenis-prevent', '');

  /* The section picker: one dropdown for every section, so the panel holds
     any number of them. Page-wide settings first, then the beats in scroll
     order, numbered. ‹ › step through them. */
  const picker = document.createElement('div');
  picker.className = 'insp__picker';
  const pick = document.createElement('select');
  pick.className = 'insp__select';
  pick.setAttribute('aria-label', 'Section');
  const pickWrap = document.createElement('label');
  pickWrap.className = 'insp__selectwrap';
  pickWrap.appendChild(pick);
  const stepBtn = (text, title, d) => {
    const b = document.createElement('button');
    b.className = 'insp__step';
    b.textContent = text;
    b.title = title;
    b.setAttribute('aria-label', title);
    b.addEventListener('click', () => step(d));
    return b;
  };
  const prevBtn = stepBtn('‹', 'Previous section', -1);
  const nextBtn = stepBtn('›', 'Next section', 1);
  picker.append(pickWrap, prevBtn, nextBtn);

  const body = document.createElement('div');
  body.className = 'insp__body';

  const head = document.createElement('div');
  head.className = 'insp__head';
  head.innerHTML = '<strong>Technology page</strong>';

  const pct = document.createElement('span');
  pct.className = 'insp__pct';
  head.appendChild(pct);

  const hide = document.createElement('button');
  hide.className = 'ghost';
  hide.textContent = 'Hide';
  hide.title = 'Hide panel (H)';
  head.appendChild(hide);

  const foot = document.createElement('div');
  foot.className = 'insp__foot';

  // Page-wide view mode, above the beat tabs because it applies to all of them.
  const view = document.createElement('div');
  view.className = 'insp__view';
  const viewSeg = document.createElement('div');
  viewSeg.className = 'seg';
  [['images', 'Images'], ['wireframe', 'Wireframe']].forEach(([v, text]) => {
    const b = document.createElement('button');
    b.dataset.v = v;
    b.textContent = text;
    b.title = 'Toggle wireframe (W)';
    b.addEventListener('click', () => setWireframe(v === 'wireframe'));
    viewSeg.appendChild(b);
  });
  view.appendChild(viewSeg);

  // Title and picker stay pinned while the controls scroll.
  const top = document.createElement('div');
  top.className = 'insp__top';
  top.append(head, picker);
  root.append(top, view, body, foot);
  document.body.appendChild(root);

  const show = document.createElement('button');
  show.className = 'insp__show';
  show.textContent = 'Controls';
  document.body.appendChild(show);

  /* ---------- selection ---------- */

  const addGroup = (label, list, numbered) => {
    if (!list.length) return;
    const g = document.createElement('optgroup');
    g.label = label;
    list.forEach((m, i) => {
      const o = document.createElement('option');
      o.value = m.def.id;
      o.textContent = numbered ? `${i + 1}  ${m.def.name}` : m.def.name;
      g.appendChild(o);
    });
    pick.appendChild(g);
  };
  addGroup('Page', extras, false);
  addGroup('Sections', director.beats, true);

  // Choosing a section from the panel also scrolls the page to it.
  const go = (id) => {
    select(id);
    if (find(id)?.stage) director.scrollToBeat(id);
  };
  pick.addEventListener('change', () => go(pick.value));
  function step(d) {
    const ids = entries().map((m) => m.def.id);
    const i = ids.indexOf(selected) + d;
    if (i >= 0 && i < ids.length) go(ids[i]);
  }

  // Clicking the beat itself selects it, which is the point of the whole panel.
  director.beats.forEach((m) => m.stage?.addEventListener('pointerdown', () => select(m.def.id)));

  function select(id) {
    if (!find(id)) return;
    selected = id;
    pick.value = id;
    const ids = entries().map((m) => m.def.id);
    prevBtn.disabled = ids.indexOf(id) <= 0;
    nextBtn.disabled = ids.indexOf(id) >= ids.length - 1;
    saveView({ ...loadView(), section: id });
    renderBody();
    root.scrollTop = 0;   // a new section's controls start from the top
  }

  /* ---------- body ---------- */

  const syncers = [];

  function renderBody() {
    body.textContent = '';
    syncers.length = 0;
    const m = find(selected);
    if (!m) return;
    const schema = SCHEMA[selected] || [];

    let group = null;
    schema.forEach((row) => {
      if (row.group) {
        group = document.createElement('fieldset');
        const legend = document.createElement('legend');
        legend.textContent = row.group;
        group.appendChild(legend);
        if (row.note) {
          const n = document.createElement('p');
          n.className = 'insp__note';
          n.textContent = row.note;
          group.appendChild(n);
        }
        body.appendChild(group);
        return;
      }
      group?.appendChild(control(m, row));
    });
  }

  function control(m, row) {
    const wrap = document.createElement('div');
    wrap.className = 'ctl';

    const read = () => getPath(m.def.config, row.p);
    const write = (v) => {
      onChange(m.def.id, setPath(m.def.config, row.p, v));
      syncers.forEach((fn) => fn());
    };

    const label = document.createElement('span');
    label.className = 'ctl__label';
    label.textContent = row.label;

    if (row.type === 'textarea') {
      const ta = document.createElement('textarea');
      ta.rows = row.p === 'text' ? 4 : 2;
      ta.spellcheck = false;
      ta.value = read() ?? '';
      ta.addEventListener('input', () => write(ta.value));
      wrap.classList.add('ctl--stack');
      wrap.append(label, ta);
      if (row.hint) {
        const h = document.createElement('small');
        h.textContent = row.hint;
        wrap.appendChild(h);
      }
      syncers.push(() => { if (document.activeElement !== ta) ta.value = read() ?? ''; });
      return wrap;
    }

    if (row.type === 'textlist') {
      // An ordered list of text blocks: edit in place, reorder, remove, add.
      // Typing writes straight through without rebuilding the list (so the
      // caret never jumps); structural changes rebuild it.
      const list = document.createElement('div');
      list.className = 'tlist';
      const items = () => [...(read() || [])];

      const rebuild = () => {
        list.textContent = '';
        const arr = items();
        arr.forEach((text, i) => {
          const item = document.createElement('div');
          item.className = 'tlist__item';

          const head = document.createElement('div');
          head.className = 'tlist__head';
          const num = document.createElement('span');
          num.textContent = String(i + 1);
          head.appendChild(num);

          const act = (label, title, fn, disabled) => {
            const b = document.createElement('button');
            b.className = 'tlist__btn';
            b.textContent = label;
            b.title = title;
            b.disabled = !!disabled;
            b.addEventListener('click', fn);
            head.appendChild(b);
          };
          const move = (to) => { const a = items(); const [x] = a.splice(i, 1); a.splice(to, 0, x); write(a); rebuild(); };
          act('↑', 'Move up', () => move(i - 1), i === 0);
          act('↓', 'Move down', () => move(i + 1), i === arr.length - 1);
          act('×', 'Remove', () => { const a = items(); a.splice(i, 1); write(a); rebuild(); }, arr.length <= 1);

          const ta = document.createElement('textarea');
          ta.rows = 3;
          ta.spellcheck = false;
          ta.value = text;
          ta.addEventListener('input', () => { const a = items(); a[i] = ta.value; write(a); });

          item.append(head, ta);
          list.appendChild(item);
        });
        const add = document.createElement('button');
        add.className = 'tlist__add';
        add.textContent = `+ ${row.addLabel || 'Add'}`;
        add.addEventListener('click', () => {
          write([...items(), 'New blurb']);
          rebuild();
          list.querySelector('.tlist__item:last-of-type textarea')?.select();
        });
        list.appendChild(add);
      };
      rebuild();
      syncers.push(() => { if (!list.contains(document.activeElement)) rebuild(); });

      wrap.classList.add('ctl--stack');
      wrap.append(label, list);
      return wrap;
    }

    if (row.type === 'color') {
      const sw = document.createElement('input');
      sw.type = 'color';
      const hex = document.createElement('input');
      hex.type = 'text';
      hex.maxLength = 7;
      const sync = () => { sw.value = hex.value = read() || '#000000'; };
      sw.addEventListener('input', () => write(sw.value));
      hex.addEventListener('change', () => /^#[0-9a-f]{6}$/i.test(hex.value) && write(hex.value));
      sync();
      syncers.push(sync);
      wrap.classList.add('ctl--color');
      wrap.append(label, sw, hex);
      return wrap;
    }

    if (row.type === 'seg') {
      const seg = document.createElement('div');
      seg.className = 'seg';
      const sync = () => seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === String(read())));
      row.options.forEach(([v, text]) => {
        const b = document.createElement('button');
        b.dataset.v = v;
        b.textContent = text;
        b.addEventListener('click', () => write(v));
        seg.appendChild(b);
      });
      sync();
      syncers.push(sync);
      wrap.classList.add('ctl--stack');
      wrap.append(label, seg);
      if (row.hint) { const h = document.createElement('small'); h.textContent = row.hint; wrap.appendChild(h); }
      return wrap;
    }

    if (row.type === 'video') {
      // The videos in src/assets/video, by poster, plus an upload button.
      // Picking one also switches the hero to video.
      const grid = document.createElement('div');
      grid.className = 'thumbs';
      const sync = () => grid.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.stem === read()));
      (m.def.config.videos || []).forEach((v) => {
        const b = document.createElement('button');
        b.dataset.stem = v.stem;
        b.title = v.stem;
        if (v.poster) b.style.backgroundImage = `url(${v.poster})`;
        else b.textContent = '▶';
        b.addEventListener('click', () => onChange(m.def.id, { ...setPath(m.def.config, row.p, v.stem), heroMedia: 'video' }));
        grid.appendChild(b);
      });
      sync();
      syncers.push(sync);
      wrap.classList.add('ctl--stack');
      wrap.append(label, grid);
      if (onUploadVideo) {
        const file = Object.assign(document.createElement('input'), { type: 'file', accept: 'video/*,.mov,.mp4,.webm,.m4v', hidden: true });
        const btn = document.createElement('button');
        btn.className = 'upload';
        btn.type = 'button';
        btn.textContent = 'Upload video…';
        const status = document.createElement('small');
        btn.addEventListener('click', () => file.click());
        file.addEventListener('change', async () => {
          const f = file.files[0];
          file.value = '';
          if (!f) return;
          btn.disabled = true;
          status.classList.remove('is-error');
          try {
            const out = await onUploadVideo(f, (t) => { status.textContent = t; });
            if (!out.saved) { status.textContent = 'Playing from the file for this visit only — a static build can’t save it.'; renderBody(); }
          } catch (e) {
            status.textContent = String(e.message || e);
            status.classList.add('is-error');
          } finally {
            btn.disabled = false;
          }
        });
        wrap.append(btn, file, status);
      }
      if (row.hint) { const h = document.createElement('small'); h.textContent = row.hint; wrap.appendChild(h); }
      return wrap;
    }

    if (row.type === 'image') {
      const grid = document.createElement('div');
      grid.className = 'thumbs';
      const sync = () => grid.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.src === read()));
      images.forEach((im) => {
        const b = document.createElement('button');
        b.dataset.src = im.src;
        b.style.backgroundImage = `url(${im.src})`;
        b.addEventListener('click', () => write(im.src));
        grid.appendChild(b);
      });
      sync();
      syncers.push(sync);
      wrap.classList.add('ctl--stack');
      wrap.append(label, grid);
      if (row.hint) { const h = document.createElement('small'); h.textContent = row.hint; wrap.appendChild(h); }
      return wrap;
    }

    // default: a slider
    const out = document.createElement('output');
    const input = Object.assign(document.createElement('input'), {
      type: 'range', min: row.min, max: row.max, step: row.step,
    });
    const fmt = (v) => (row.step < 1 ? Number(v).toFixed(row.step < 0.05 ? 3 : 2) : String(v));
    const sync = () => {
      const v = read();
      input.value = v;
      out.textContent = fmt(v) + (row.unit || '');
    };
    input.addEventListener('input', () => write(+input.value));
    sync();
    syncers.push(sync);
    wrap.append(label, out, input);
    if (row.hint) {
      const h = document.createElement('small');
      h.textContent = row.hint;
      wrap.appendChild(h);
    }
    return wrap;
  }

  /* ---------- footer ---------- */

  const btn = (text, fn) => {
    const b = document.createElement('button');
    b.textContent = text;
    b.addEventListener('click', fn);
    foot.appendChild(b);
    return b;
  };

  // Save as default: the current settings become the project's defaults
  // (src/defaults.json), the starting point for every browser. Only offered
  // when there's a dev server to write the file.
  if (onSaveDefaults) {
    const save = document.createElement('button');
    save.className = 'insp__save';
    save.textContent = 'Save as default';
    save.title = 'Make the current settings the default for everyone who opens this page';
    save.addEventListener('click', async () => {
      const ok = confirm(
        'Make the current settings the default for everyone who opens this page?\n\n'
        + 'The previous defaults are kept in src/defaults.prev.json.',
      );
      if (!ok) return;
      save.disabled = true;
      save.textContent = 'Saving…';
      try {
        await onSaveDefaults();
        save.textContent = 'Saved as default';
        // Vite reloads the page when defaults.json changes; this is a fallback.
        setTimeout(() => location.reload(), 600);
      } catch (e) {
        save.disabled = false;
        save.textContent = 'Save failed — try again';
        console.error('Save as default failed:', e);
      }
    });
    foot.before(save);
  }

  btn('Copy config', async () => {
    await navigator.clipboard.writeText(exportAll());
  });
  btn('Paste config', async () => {
    try {
      importAll(await navigator.clipboard.readText());
      location.reload();
    } catch { /* not valid JSON — leave the current state alone */ }
  });
  // Clears this browser's tweaks, back to the saved defaults.
  btn('Reset all', () => { reset(); location.reload(); });

  /* ---------- panel visibility ---------- */

  const setOpen = (v) => {
    open = v;
    root.classList.toggle('is-off', !open);
    show.classList.toggle('is-on', !open);
  };
  hide.addEventListener('click', () => setOpen(false));
  show.addEventListener('click', () => setOpen(true));
  addEventListener('keydown', (e) => {
    if (/input|textarea/i.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === 'h') setOpen(!open);
    if (k === 'w') setWireframe(!wireframe);
  });
  setOpen(true);

  /* ---------- wireframe ----------
     Swaps every image on the page for a flat #d9d9d9 fill, so a review can
     focus on motion and layout instead of the pictures. It is a class on
     <html> and nothing else: the beats keep rendering exactly as they do, so
     the toggle is instant and can't change timing. `?wireframe=1` in the URL
     forces it on, for links sent to the team. */

  let wireframe = false;
  function setWireframe(on, persist = true) {
    wireframe = on;
    document.documentElement.classList.toggle('is-wireframe', on);
    viewSeg.querySelectorAll('button').forEach((b) =>
      b.classList.toggle('on', b.dataset.v === (on ? 'wireframe' : 'images')));
    if (persist) saveView({ ...loadView(), wireframe: on });
  }
  // A link only sets the mode for that visit; it never overwrites the
  // reviewer's own saved preference.
  const forced = new URLSearchParams(location.search).get('wireframe');
  setWireframe(forced != null ? forced !== '0' : !!loadView().wireframe, false);

  /* ---------- progress readout ---------- */

  const tick = () => {
    const m = find(selected);
    pct.textContent = m?.trigger ? `${Math.round(m.trigger.progress * 100)}%` : '';
    requestAnimationFrame(tick);
  };
  tick();

  // Back to the section that was open last time.
  select(find(loadView().section) ? loadView().section : selected);

  return { select, get selected() { return selected; } };
}

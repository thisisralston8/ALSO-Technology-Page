import { showGridOverlay } from '../grid.js';
/* The inspector. Click a beat, edit that beat.

   Controls are generated from SCHEMA, never written by hand. Editor chrome stays
   plain and restrained, as in both prototypes: one accent colour, tabular
   numerals on values, no gradients and no glows. */

import { SCHEMA, getPath, setPath } from './schema.js';
import { exportAll, importAll, reset, loadView, saveView } from './store.js';
import { cleanSvg } from '../svgIcon.js';
import './inspector.css';

export function createInspector({ director, images, media = [], onChange, getConfig, extras = [], onSaveDefaults = null, onUploadVideo = null, onUploadMedia = null, phoneQuery = '(max-width: 1023px)', sheetQuery = '(max-width: 767px)' }) {
  /* Desktop | Mobile. Every section's settings are its desktop values plus a
     `mobile` set of overrides (main.js applies them below the phone
     breakpoint). In Mobile mode a control shows and edits the phone value; a
     control with its own phone value is marked, and can go back to the
     desktop one. On a phone the panel always starts in Mobile. */
  const phoneMQ = matchMedia(phoneQuery);
  let device = phoneMQ.matches ? 'mobile' : (loadView().device || 'desktop');
  const isMob = () => device === 'mobile';
  const cfgOf = (id) => getConfig(id);
  // What a section looks like in the mode being edited.
  const viewCfg = (id) => { const c = cfgOf(id); return isMob() ? { ...c, ...(c.mobile || {}) } : c; };
  let selected = director.beats[0]?.def.id || null;

  // Tabs that aren't beats (the Page tab) have no stage and no scroll trigger.
  const find = (id) => extras.find((e) => e.def.id === id) || director.byId(id);
  const entries = () => [...extras, ...director.beats];
  let open = true;
  let preview = false;   // the phone preview (below) is showing

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
  // The layout grid overlay (grid.js): a toggle next to Images / Wireframe.
  const gridBtn = document.createElement('button');
  gridBtn.type = 'button';
  gridBtn.className = 'insp__gridbtn';
  gridBtn.textContent = 'Grid';
  gridBtn.title = 'Show the layout grid (G)';
  gridBtn.addEventListener('click', () => setGridShown(!gridShown));
  viewSeg.appendChild(gridBtn);
  view.appendChild(viewSeg);
  const deviceSeg = document.createElement('div');
  deviceSeg.className = 'seg';
  [['desktop', 'Desktop'], ['mobile', 'Mobile']].forEach(([v, text]) => {
    const b = document.createElement('button');
    b.dataset.v = v;
    b.textContent = text;
    b.title = 'Which values you’re editing: desktop, or the phone overrides';
    b.addEventListener('click', () => setDevice(v));
    deviceSeg.appendChild(b);
  });
  view.appendChild(deviceSeg);
  function setDevice(v) {
    device = v;
    saveView({ ...loadView(), device: v });
    deviceSeg.querySelectorAll('button[data-v]').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
    renderBody();
  }
  deviceSeg.querySelectorAll('button[data-v]').forEach((b) => b.classList.toggle('on', b.dataset.v === device));
  // The phone preview (below): the page at phone size beside the panel.
  const previewBtn = document.createElement('button');
  previewBtn.type = 'button';
  previewBtn.className = 'insp__gridbtn insp__previewbtn';
  previewBtn.textContent = 'Preview';
  previewBtn.title = 'Show the page at phone size beside the panel (P)';
  previewBtn.addEventListener('click', () => setPreview(!preview));
  deviceSeg.appendChild(previewBtn);
  phoneMQ.addEventListener('change', () => renderBody());

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
    if (find(id)?.stage) (previewPage()?.director || director).scrollToBeat(id);
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

  /* ---------- body ----------
     A section's schema is a short hierarchy:

       { part: 'Hero' }            a heading — the big divisions of a section
       { group: 'Colour', note }   a collapsible panel under it
       { sub: 'Camera' }           a small label inside a long panel
       { p: …, when: (cfg) => … }  a control, shown only while `when` holds

     A search box at the top filters every control in the section by its
     label, hint and the names of the panel and heading it sits under. Which
     panels are open is remembered per section. */

  const syncers = [];
  let entries_ = [];        // [{ kind: 'ctl' | 'sub', el, row, group }]
  let groups = [];          // [{ el, part, title, key }]
  let parts = [];           // [{ el, title, groups: [] }]
  let query = '';
  let filtering = false;

  const openState = () => loadView().groups || {};
  function saveOpen(key, open) {
    const v = loadView();
    saveView({ ...v, groups: { ...(v.groups || {}), [key]: open } });
  }

  function renderBody() {
    body.textContent = '';
    syncers.length = 0;
    entries_ = []; groups = []; parts = [];
    const m = find(selected);
    if (!m) return;
    const schema = SCHEMA[selected] || [];

    // Find + open/close all.
    const bar = document.createElement('div');
    bar.className = 'insp__bar';
    const find_ = Object.assign(document.createElement('input'), { type: 'search', placeholder: 'Find a control…', value: query });
    find_.className = 'insp__find';
    find_.setAttribute('aria-label', 'Find a control');
    find_.addEventListener('input', () => { query = find_.value.trim().toLowerCase(); applyVisibility(); });
    const all = document.createElement('button');
    all.type = 'button';
    all.className = 'insp__all';
    const syncAll = () => { all.textContent = groups.some((g) => !g.el.open) ? 'Open all' : 'Close all'; };
    all.addEventListener('click', () => {
      const open = groups.some((g) => !g.el.open);
      groups.forEach((g) => { g.el.open = open; saveOpen(g.key, open); });
      syncAll();
    });
    bar.append(find_, all);
    body.appendChild(bar);
    // Editing values this window isn't showing: say so.
    if (isMob() !== (preview ? previewFrame.isPhone() : phoneMQ.matches)) {
      const hint = document.createElement('p');
      hint.className = 'insp__devhint';
      hint.textContent = isMob()
        ? 'Editing mobile values (phones and tablets). This window shows the desktop ones — make it narrower than 1024 px, or open the page on your phone, to see them.'
        : 'Editing desktop values. This window shows the mobile ones (it’s narrower than 1024 px).';
      body.appendChild(hint);
    }

    const saved = openState();
    let part = null, group = null, first = true;
    schema.forEach((row) => {
      if (row.part) {
        const h = document.createElement('h3');
        h.className = 'insp__part';
        h.textContent = row.part;
        body.appendChild(h);
        part = { el: h, title: row.part, groups: [] };
        parts.push(part);
        return;
      }
      if (row.group) {
        const d = document.createElement('details');
        d.className = 'grp';
        const key = `${selected}:${part ? part.title + '/' : ''}${row.group}`;
        d.open = saved[key] ?? first;
        first = false;
        const sum = document.createElement('summary');
        sum.textContent = row.group;
        d.appendChild(sum);
        if (row.note) {
          const n = document.createElement('p');
          n.className = 'insp__note';
          n.textContent = row.note;
          d.appendChild(n);
        }
        d.addEventListener('toggle', () => { if (!filtering) { saveOpen(key, d.open); syncAll(); } });
        body.appendChild(d);
        group = { el: d, part, title: row.group, key };
        groups.push(group);
        part?.groups.push(group);
        return;
      }
      if (!group) return;
      if (row.info) {
        // A line of live information (e.g. how many images a folder holds).
        const n = document.createElement('p');
        n.className = 'insp__info';
        const upd = () => { n.textContent = row.info(cfgOf(m.def.id)); };
        upd();
        syncers.push(upd);
        group.el.appendChild(n);
        return;
      }
      if (row.sub) {
        const sub = document.createElement('p');
        sub.className = 'insp__sub';
        sub.textContent = row.sub;
        group.el.appendChild(sub);
        entries_.push({ kind: 'sub', el: sub, row, group });
        return;
      }
      const c = control(m, row);
      group.el.appendChild(c);
      entries_.push({ kind: 'ctl', el: c, row, group });
    });
    syncAll();
    applyVisibility();
  }

  // Show what applies (`when`) and matches the search; hide empty panels,
  // sub-labels and headings. While searching, every panel with a match opens
  // (without forgetting how you left them).
  function applyVisibility() {
    const m = find(selected);
    if (!m) return;
    const cfg = viewCfg(m.def.id);
    const hit = new Set();
    for (const e of entries_) {
      if (e.kind !== 'ctl') continue;
      const applies = !e.row.when || e.row.when(cfg);
      const text = `${e.row.label} ${e.row.hint || ''} ${e.group.title} ${e.group.part?.title || ''}`.toLowerCase();
      const show = applies && (!query || text.includes(query));
      e.el.style.display = show ? '' : 'none';
      if (show) hit.add(e.group);
    }
    // A sub-label shows if anything under it (up to the next one) does.
    entries_.forEach((e, i) => {
      if (e.kind !== 'sub') return;
      let any = false;
      for (let j = i + 1; j < entries_.length && entries_[j].kind === 'ctl' && entries_[j].group === e.group; j++) {
        if (entries_[j].el.style.display !== 'none') { any = true; break; }
      }
      e.el.style.display = any ? '' : 'none';
    });
    filtering = true;
    const saved = openState();
    groups.forEach((g) => {
      g.el.style.display = hit.has(g) ? '' : 'none';
      g.el.open = query ? hit.has(g) : (saved[g.key] ?? g === groups[0]);
    });
    filtering = false;
    parts.forEach((pt) => { pt.el.style.display = pt.groups.some((g) => hit.has(g)) ? '' : 'none'; });
  }

  function control(m, row) {
    const wrap = document.createElement('div');
    wrap.className = 'ctl';

    const id = m.def.id;
    // Does this control have its own phone value?
    const hasMob = () => { const mo = cfgOf(id).mobile; return !!mo && Object.prototype.hasOwnProperty.call(mo, row.p); };
    const read = () => (isMob() && hasMob() ? cfgOf(id).mobile[row.p] : getPath(cfgOf(id), row.p));
    // Write one or more values: into the phone overrides in Mobile mode,
    // otherwise into the desktop values.
    const writeKeys = (obj) => {
      const cfg = cfgOf(id);
      const next = isMob()
        ? { ...cfg, mobile: { ...(cfg.mobile || {}), ...obj } }
        : Object.entries(obj).reduce((c, [k, v]) => setPath(c, k, v), cfg);
      onChange(id, next);
      syncers.forEach((fn) => fn());
      // Some controls only apply while another is set a certain way.
      if (entries_.some((e) => e.row?.when)) applyVisibility();
    };
    const write = (v) => writeKeys({ [row.p]: v });

    const label = document.createElement('span');
    label.className = 'ctl__label';
    label.textContent = row.label;
    // The phone marker: in Mobile mode, "phone value" with a way back to the
    // desktop value; in Desktop mode, a quiet note that the phone differs.
    const mark = document.createElement('button');
    mark.type = 'button';
    mark.className = 'ctl__phone';
    mark.addEventListener('click', () => {
      if (!isMob() || !hasMob()) return;
      const cfg = cfgOf(id);
      const mo = { ...(cfg.mobile || {}) };
      delete mo[row.p];
      onChange(id, { ...cfg, mobile: mo });
      syncers.forEach((fn) => fn());
      if (entries_.some((e) => e.row?.when)) applyVisibility();
    });
    label.append(' ', mark);
    const syncMark = () => {
      const on = hasMob();
      mark.hidden = !on;
      mark.textContent = isMob() ? 'phone · use desktop' : 'phone differs';
      mark.title = isMob() ? 'This has its own phone value — click to use the desktop value' : 'The phone version has its own value for this';
      mark.disabled = !isMob();
      wrap.classList.toggle('is-phone', on && isMob());
    };
    syncMark();
    syncers.push(syncMark);

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

    if (row.type === 'colorlist') {
      // An editable list of colours: a swatch and hex per colour, remove any,
      // add more. Every edit writes a new array.
      const list = document.createElement('div');
      list.className = 'clist';
      const items = () => [...(read() || [])];
      const rebuild = () => {
        list.textContent = '';
        items().forEach((c, i) => {
          const r = document.createElement('div');
          r.className = 'clist__row';
          const sw = Object.assign(document.createElement('input'), { type: 'color', value: /^#[0-9a-f]{6}$/i.test(c) ? c : '#000000' });
          const hex = Object.assign(document.createElement('input'), { type: 'text', value: c, maxLength: 7 });
          hex.spellcheck = false;
          const set = (v) => { const a = items(); a[i] = v; write(a); };
          sw.addEventListener('input', () => { hex.value = sw.value; set(sw.value); });
          hex.addEventListener('change', () => {
            const v = hex.value.startsWith('#') ? hex.value : `#${hex.value}`;
            if (/^#[0-9a-f]{6}$/i.test(v)) { sw.value = v; set(v); } else hex.value = items()[i];
          });
          const del = document.createElement('button');
          del.type = 'button';
          del.className = 'clist__del';
          del.textContent = '×';
          del.title = 'Remove this colour';
          del.setAttribute('aria-label', 'Remove this colour');
          del.addEventListener('click', () => { const a = items(); a.splice(i, 1); write(a); rebuild(); });
          r.append(sw, hex, del);
          list.appendChild(r);
        });
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'upload';
        add.textContent = 'Add colour';
        add.addEventListener('click', () => { const a = items(); a.push(a[a.length - 1] || '#ac74fc'); write(a); rebuild(); });
        list.appendChild(add);
      };
      rebuild();
      syncers.push(() => { if (!list.contains(document.activeElement)) rebuild(); });
      wrap.classList.add('ctl--stack');
      wrap.append(label, list);
      if (row.hint) { const h = document.createElement('small'); h.textContent = row.hint; wrap.appendChild(h); }
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
      seg.className = row.wrap ? 'seg seg--wrap' : 'seg';
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
      (cfgOf(m.def.id).videos || []).forEach((v) => {
        const b = document.createElement('button');
        b.dataset.stem = v.stem;
        b.title = v.stem;
        if (v.poster) b.style.backgroundImage = `url(${v.poster})`;
        else b.textContent = '▶';
        b.addEventListener('click', () => writeKeys({ [row.p]: v.stem, heroMedia: 'video' }));
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

    if (row.type === 'media') {
      // An image or video for one of the Explore modal's slots: the files in
      // src/assets/modal, by thumbnail (videos by poster, marked ▶), plus an
      // upload button and a way back to the empty placeholder. Stored by name.
      const grid = document.createElement('div');
      grid.className = 'thumbs';
      const sync = () => grid.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.stem === (read() || '')));
      media.forEach((it) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.stem = it.stem;
        b.title = `${it.stem} (${it.kind})`;
        if (it.thumb) b.style.backgroundImage = `url(${it.thumb})`;
        if (it.kind === 'video') { b.classList.add('is-video'); b.textContent = '▶'; }
        b.addEventListener('click', () => write(it.stem));
        grid.appendChild(b);
      });
      const none = document.createElement('button');
      none.type = 'button';
      none.dataset.stem = '';
      none.className = 'is-none';
      none.title = 'None: an empty placeholder card';
      none.textContent = 'None';
      none.addEventListener('click', () => write(''));
      grid.appendChild(none);
      sync();
      syncers.push(sync);
      wrap.classList.add('ctl--stack');
      wrap.append(label, grid);
      if (onUploadMedia) {
        const file = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*,video/*,.mov,.mp4,.webm,.m4v', hidden: true });
        const btn = document.createElement('button');
        btn.className = 'upload';
        btn.type = 'button';
        btn.textContent = 'Upload image or video…';
        const status = document.createElement('small');
        btn.addEventListener('click', () => file.click());
        file.addEventListener('change', async () => {
          const f = file.files[0];
          file.value = '';
          if (!f) return;
          btn.disabled = true;
          status.classList.remove('is-error');
          const was = cfgOf(id);
          try {
            const out = await onUploadMedia(f, (t) => { status.textContent = t; }, (stem) => {
              write(stem);
              return () => onChange(id, was);
            });
            if (!out.saved) { status.textContent = 'Showing from the file for this visit only — a static build can’t save it.'; renderBody(); }
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

    if (row.type === 'svg') {
      // An uploaded SVG, kept as cleaned markup in the settings (svgIcon.js).
      const prev = document.createElement('span');
      prev.className = 'svgpick__prev';
      const file = Object.assign(document.createElement('input'), { type: 'file', accept: '.svg,image/svg+xml', hidden: true });
      const up = document.createElement('button');
      up.type = 'button';
      up.className = 'upload';
      up.textContent = 'Upload SVG…';
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'ghost';
      clear.textContent = 'Use ×';
      const status = document.createElement('small');
      const sync = () => {
        const svg = cleanSvg(read() || '');
        prev.innerHTML = svg || '<span>×</span>';
        clear.disabled = !svg;
      };
      up.addEventListener('click', () => file.click());
      clear.addEventListener('click', () => { write(''); status.textContent = ''; });
      file.addEventListener('change', async () => {
        const f = file.files[0];
        file.value = '';
        if (!f) return;
        const svg = cleanSvg(await f.text());
        status.classList.toggle('is-error', !svg);
        status.textContent = svg ? f.name : 'That file isn’t an SVG this can use.';
        if (svg) write(svg);
      });
      sync();
      syncers.push(sync);
      const rowEl = document.createElement('div');
      rowEl.className = 'svgpick';
      rowEl.append(prev, up, clear);
      wrap.classList.add('ctl--stack');
      wrap.append(label, rowEl, file, status);
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
    // `max: 'cols'`: up to the number of grid columns in the mode being
    // edited (12 on desktop, 4 on mobile by default).
    const max = row.max === 'cols' ? viewCfg('page').gridCols : row.max;
    const input = Object.assign(document.createElement('input'), {
      type: 'range', min: row.min, max, step: row.step,
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
    document.documentElement.classList.toggle('insp-is-off', !open);
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
    if (k === 'g') setGridShown(!gridShown);
    if (k === 'p' && !matchMedia(sheetQuery).matches) setPreview(!preview);
  });
  // On a phone the panel starts tucked away (it's a sheet over the page).
  setOpen(!matchMedia(sheetQuery).matches);

  let gridShown = false;
  function setGridShown(on) {
    gridShown = on;
    showGridOverlay(on);
    gridBtn.classList.toggle('on', on);
    saveView({ ...loadView(), grid: on });
  }
  setGridShown(!!loadView().grid);

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
    viewSeg.querySelectorAll('button[data-v]').forEach((b) =>
      b.classList.toggle('on', b.dataset.v === (on ? 'wireframe' : 'images')));
    if (persist) saveView({ ...loadView(), wireframe: on });
  }
  // A link only sets the mode for that visit; it never overwrites the
  // reviewer's own saved preference.
  const forced = new URLSearchParams(location.search).get('wireframe');
  setWireframe(forced != null ? forced !== '0' : !!loadView().wireframe, false);

  /* ---------- progress readout ---------- */

  const tick = () => {
    const m = (selected !== 'page' && previewPage()?.director.byId(selected)) || find(selected);
    pct.textContent = m?.trigger ? `${Math.round(m.trigger.progress * 100)}%` : '';
    requestAnimationFrame(tick);
  };
  tick();

  /* ---------- phone preview ----------
     The page itself, loaded again (`?embed`) in a frame the size of a phone,
     in the space left of the panel. A frame is the only way to get a real
     phone-width viewport — media queries, the 4-column grid and the mobile
     settings all switch on it — without the panel covering it. Edits reach
     it through localStorage (store.js `watch`), the same way they reach any
     other open window; the section picker scrolls it. */

  const SIZES = [
    ['390x844', 'iPhone 12–16'],
    ['375x812', 'iPhone mini'],
    ['430x932', 'iPhone Pro Max'],
    ['768x1024', 'iPad'],
  ];
  const previewFrame = (() => {
    const wrap = document.createElement('div');
    wrap.className = 'phone-preview';
    wrap.hidden = true;
    // Wheel over the backdrop mustn't scroll the page hidden behind it.
    wrap.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
    const bar = document.createElement('div');
    bar.className = 'phone-preview__bar';
    const size = document.createElement('select');
    size.setAttribute('aria-label', 'Preview size');
    SIZES.forEach(([v, text]) => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = `${text}  ${v.replace('x', ' × ')}`;
      size.appendChild(o);
    });
    size.value = SIZES.some(([v]) => v === loadView().previewSize) ? loadView().previewSize : SIZES[0][0];
    const reload = document.createElement('button');
    reload.type = 'button';
    reload.textContent = 'Reload';
    reload.title = 'Reload the preview from the top';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Close';
    close.title = 'Close the preview (P)';
    bar.append(size, reload, close);
    const device = document.createElement('div');
    device.className = 'phone-preview__device';
    const frame = document.createElement('iframe');
    frame.title = 'Phone preview';
    device.appendChild(frame);
    wrap.append(bar, device);
    document.body.appendChild(wrap);

    const dims = () => size.value.split('x').map(Number);
    function fit() {
      if (wrap.hidden) return;
      const [w, h] = dims();
      const r = wrap.getBoundingClientRect();
      const k = Math.min(1, (r.width - 48) / w, (r.height - bar.offsetHeight - 40) / h);
      Object.assign(frame.style, { width: `${w}px`, height: `${h}px`, transform: `scale(${k})` });
      Object.assign(device.style, { width: `${w * k}px`, height: `${h * k}px` });
    }
    function load() {
      const url = new URL(location.href);
      url.search = '?embed';
      url.hash = '';
      frame.src = url.href;
    }
    size.addEventListener('change', () => {
      saveView({ ...loadView(), previewSize: size.value });
      fit();
      renderBody();   // the hint depends on whether the size is a phone's
    });
    reload.addEventListener('click', load);
    close.addEventListener('click', () => setPreview(false));
    // Follows the window, and the panel being hidden or shown.
    new ResizeObserver(fit).observe(wrap);
    return {
      show(on) {
        wrap.hidden = !on;
        if (on && !frame.src) load();
        fit();
      },
      fit,
      win: () => frame.contentWindow,
      isPhone: () => dims()[0] < 1024,
    };
  })();
  function previewPage() {
    if (!preview) return null;
    try { return previewFrame.win()?.__page || null; } catch { return null; }
  }
  function setPreview(on) {
    preview = on;
    previewFrame.show(on);
    previewBtn.classList.toggle('on', on);
    document.documentElement.classList.toggle('is-previewing', on);
    if (on) setOpen(true);
    saveView({ ...loadView(), preview: on });
    // Previewing a phone means editing its values.
    if (on && previewFrame.isPhone() && !isMob()) setDevice('mobile');
    else renderBody();
  }
  if (loadView().preview && !matchMedia(sheetQuery).matches) setPreview(true);

  // Back to the section that was open last time.
  select(find(loadView().section) ? loadView().section : selected);

  return {
    select,
    get selected() { return selected; },
    // Settings changed from another window: show the new values.
    refresh: () => renderBody(),
  };
}

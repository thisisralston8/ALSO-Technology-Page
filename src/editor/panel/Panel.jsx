/* The settings panel. HeroUI v3, dark, one accent (ALSO purple).

     header    title, the section's scroll progress, hide
               section picker (Page, then every section in scroll order) with ‹ ›
               View: Images / Wireframe, Grid
               Desktop / Mobile: which values you edit, and (in the editor
               shell) which breakpoint the page is shown at
     body      search, then the section's parts as tabs, each part's groups
               as an accordion, each group's controls (controls.jsx)
     footer    Save as default, Copy / Paste config, Download project;
               Reset all (a quiet link) and the shortcuts

   Controls come from SCHEMA (editor/schema.js), never written by hand. The
   panel never touches the page directly: everything goes through `host`
   (editor/host.js), which lives in the page's own window. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion, Alert, AlertDialog, Button, Chip, Description, Header, Kbd, Label, ListBox, SearchField,
  Select, Tabs, ToggleButton, ToggleButtonGroup,
} from '@heroui/react';
import { SCHEMA, getPath, setPath } from '../schema.js';
import { loadView, saveView } from '../store.js';
import { Control } from './controls.jsx';
import { ChevronLeft, ChevronRight, Download, PanelRight } from './icons.jsx';

// The whole project as GitHub has it: the latest push to `main`, as a .zip
// (the repo is public, so no sign-in). The browser saves it to Downloads.
// Change these if the repo moves.
const REPO = 'thisisralston8/ALSO-Technology-Page';
const BRANCH = 'main';
const PROJECT_ZIP = `https://github.com/${REPO}/archive/refs/heads/${BRANCH}.zip`;
function downloadProject() {
  const a = document.createElement('a');
  a.href = PROJECT_ZIP;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const patchView = (patch) => saveView({ ...loadView(), ...patch });

/* ---------- schema → parts → groups → items ---------- */

function parse(sid, rows) {
  const parts = [];
  let part = null, group = null;
  for (const row of rows) {
    if (row.part) { part = { title: row.part, groups: [] }; parts.push(part); group = null; continue; }
    if (row.group) {
      if (!part) { part = { title: null, groups: [] }; parts.push(part); }
      group = { title: row.group, note: row.note, key: `${sid}:${part.title ? `${part.title}/` : ''}${row.group}`, part: part.title, items: [] };
      part.groups.push(group);
      continue;
    }
    if (!group) continue;
    group.items.push({ kind: row.info ? 'info' : row.sub ? 'sub' : 'ctl', row });
  }
  return parts;
}

// Which items show: `when` holds and the search matches. A sub-label shows
// if anything under it does; a group if any control in it does.
function visible(group, cfg, query) {
  const shown = group.items.map((it) => {
    if (it.kind !== 'ctl') return false;
    const applies = !it.row.when || it.row.when(cfg);
    const text = `${it.row.label} ${it.row.hint || ''} ${group.title} ${group.part || ''}`.toLowerCase();
    return applies && (!query || text.includes(query));
  });
  group.items.forEach((it, i) => {
    if (it.kind === 'sub') {
      let any = false;
      for (let j = i + 1; j < group.items.length && group.items[j].kind !== 'sub'; j++) if (shown[j]) { any = true; break; }
      shown[i] = any;
    }
    if (it.kind === 'info') shown[i] = !query;
  });
  return { shown, any: shown.some((s, i) => s && group.items[i].kind === 'ctl') };
}

/* ---------- small pieces ---------- */

// An icon-only button: its name (and shortcut) for assistive tech, and the
// same as a native tooltip. (HeroUI's Tooltip wraps its trigger in a second
// focusable element, which would put two tab stops on every icon button.)
function IconButton({ label, shortcut, children, ...props }) {
  const name = shortcut ? `${label} (${shortcut})` : label;
  return <Button isIconOnly size="sm" variant="ghost" aria-label={name} title={name} {...props}>{children}</Button>;
}

function Progress({ host, id }) {
  const [p, setP] = useState(null);
  useEffect(() => {
    let raf = 0, last = null;
    const tick = () => {
      let v = null;
      try { v = host.progress(id); } catch { /* the page is reloading */ }
      const r = v == null ? null : Math.round(v * 100);
      if (r !== last) { last = r; setP(r); }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [host, id]);
  if (p == null) return null;
  return <Chip size="sm" variant="soft" className="tabular" aria-label={`Scroll progress through this section: ${p}%`}>{p}%</Chip>;
}

function Confirm({ trigger, title, body, action, danger, onConfirm }) {
  return (
    <AlertDialog>
      {trigger}
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="max-w-sm">
            {({ close }) => (
              <>
                <AlertDialog.Header>
                  <AlertDialog.Heading>{title}</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body className="text-sm text-muted">{body}</AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button variant="tertiary" onPress={close}>Cancel</Button>
                  <Button variant={danger ? 'danger' : 'primary'} onPress={() => { close(); onConfirm(); }}>{action}</Button>
                </AlertDialog.Footer>
              </>
            )}
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}

/* ---------- the panel ---------- */

export function Panel({ host, onHide, device: shownDevice = null, onDevice = null }) {
  const sections = useMemo(() => host.sections(), [host]);
  const initial = loadView();
  const [sid, setSid] = useState(sections.some((s) => s.id === initial.section) ? initial.section : sections[0]?.id);
  // In the editor shell the shell owns Desktop | Mobile, because it also
  // sizes the page; in the phone sheet the page is a phone, so it's Mobile.
  const [ownDevice, setOwnDevice] = useState(host.isPhone() ? 'mobile' : (initial.device || 'desktop'));
  const device = shownDevice || ownDevice;
  const [query, setQuery] = useState('');
  const [, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((n) => n + 1), []);
  const [view, setView] = useState({ wireframe: !!initial.wireframe, grid: !!initial.grid });
  const [tabs, setTabs] = useState(initial.tabs || {});
  const [open, setOpen] = useState(initial.groups || {});
  const scroller = useRef(null);

  const isMobile = device === 'mobile';
  const setDevice = (d) => { if (onDevice) onDevice(d); else { setOwnDevice(d); patchView({ device: d }); } };
  const toggleView = useCallback((k) => setView((v) => { const n = { ...v, [k]: !v[k] }; patchView({ [k]: n[k] }); return n; }), []);

  const select = useCallback((id, scroll = false) => {
    setSid(id);
    patchView({ section: id });
    scroller.current?.scrollTo({ top: 0 });
    if (scroll && sections.find((s) => s.id === id)?.stage) host.scrollTo(id);
  }, [host, sections]);
  const idx = sections.findIndex((s) => s.id === sid);

  // The page's events: settings changed elsewhere, a section was clicked, a shortcut.
  useEffect(() => host.on((ev) => {
    if (ev.type === 'refresh') bump();
    if (ev.type === 'select') select(ev.id);
    if (ev.type === 'key' && (ev.key === 'w' || ev.key === 'g')) toggleView(ev.key === 'w' ? 'wireframe' : 'grid');
  }), [host, bump, select, toggleView]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea, [role="textbox"], [role="slider"]')) return;
      const k = e.key.toLowerCase();
      if (k === 'w') toggleView('wireframe');
      if (k === 'g') toggleView('grid');
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [toggleView]);

  /* What the controls read and write. */
  const authored = () => host.getConfig(sid);
  const viewCfg = (id) => { const c = host.getConfig(id); return isMobile ? { ...c, ...(c.mobile || {}) } : c; };
  const cfg = viewCfg(sid);
  const hasMobile = (p) => { const mo = authored().mobile; return !!mo && Object.prototype.hasOwnProperty.call(mo, p); };
  const writeKeys = (obj) => {
    const c = authored();
    const next = isMobile
      ? { ...c, mobile: { ...(c.mobile || {}), ...obj } }
      : Object.entries(obj).reduce((acc, [k, v]) => setPath(acc, k, v), c);
    host.setConfig(sid, next);
    bump();
  };
  const api = {
    host, isMobile, cfg: authored(), gridCols: viewCfg('page').gridCols,
    read: (p) => (isMobile && hasMobile(p) ? authored().mobile[p] : getPath(authored(), p)),
    hasMobile,
    write: (p, v) => writeKeys({ [p]: v }),
    writeKeys,
    clearMobile: (p) => { const c = authored(); const mo = { ...(c.mobile || {}) }; delete mo[p]; host.setConfig(sid, { ...c, mobile: mo }); bump(); },
    authored,
    replace: (next) => { host.setConfig(sid, next); bump(); },
    refresh: bump,
  };

  const parts = useMemo(() => parse(sid, SCHEMA[sid] || []), [sid]);
  const q = query.trim().toLowerCase();
  const shownGroups = (part) => part.groups.map((g) => ({ g, v: visible(g, cfg, q) })).filter((x) => x.v.any);
  const firstKey = (part) => part.groups[0]?.key;
  const isOpen = (g, part) => (q ? true : open[g.key] ?? g.key === firstKey(part));
  const setOpenKeys = (part, keys) => {
    if (q) return;
    const next = { ...open };
    part.groups.forEach((g) => { next[g.key] = keys.has(g.key); });
    setOpen(next);
    patchView({ groups: next });
  };
  const activeTab = tabs[sid] && parts.some((p) => p.title === tabs[sid]) ? tabs[sid] : parts[0]?.title;
  const setTab = (t) => { const n = { ...tabs, [sid]: t }; setTabs(n); patchView({ tabs: n }); scroller.current?.scrollTo({ top: 0 }); };
  const currentPart = parts.find((p) => p.title === activeTab) || parts[0];
  const allOpen = currentPart && currentPart.groups.every((g) => isOpen(g, currentPart));

  // The page re-lays itself out a moment after the view changes; follow it.
  const [showingPhone, setShowingPhone] = useState(host.isPhone());
  useEffect(() => {
    let raf = 0;
    const tick = () => { let v = showingPhone; try { v = host.isPhone(); } catch { /* reloading */ } if (v !== showingPhone) setShowingPhone(v); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [host, showingPhone]);

  const renderGroups = (part) => {
    const list = shownGroups(part);
    if (!list.length) return null;
    return (
      <Accordion allowsMultipleExpanded variant="surface" className="flex flex-col gap-2"
        expandedKeys={new Set(list.filter(({ g }) => isOpen(g, part)).map(({ g }) => g.key))}
        onExpandedChange={(keys) => setOpenKeys(part, keys)}>
        {list.map(({ g, v }) => (
          <Accordion.Item key={g.key} id={g.key}>
            <Accordion.Heading>
              <Accordion.Trigger className="text-sm font-medium">
                {g.title}
                <Accordion.Indicator />
              </Accordion.Trigger>
            </Accordion.Heading>
            <Accordion.Panel>
              <Accordion.Body className="flex flex-col gap-4 pb-4">
                {isOpen(g, part) && (
                  <>
                    {g.note && <Description className="text-xs leading-snug text-muted">{g.note}</Description>}
                    {g.items.map((it, i) => {
                      if (!v.shown[i]) return null;
                      if (it.kind === 'sub') return <p key={i} className="-mb-2 pt-1 text-xs font-medium uppercase tracking-wide text-muted">{it.row.sub}</p>;
                      if (it.kind === 'info') return <p key={i} className="text-xs text-muted">{it.row.info(authored())}</p>;
                      return <Control key={`${it.row.p}:${device}`} api={api} row={it.row} />;
                    })}
                  </>
                )}
              </Accordion.Body>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    );
  };

  /* ---------- footer actions ---------- */
  const [note, setNote] = useState('');
  const flash = (t) => { setNote(t); setTimeout(() => setNote(''), 2500); };
  const [saving, setSaving] = useState(false);
  const saveDefaults = async () => {
    setSaving(true);
    try {
      await host.saveDefaults();
      flash('Saved as default');
      setTimeout(() => { host.reload(); location.reload(); }, 600);
    } catch (e) {
      setSaving(false);
      flash(`Save failed: ${e.message || e}`);
    }
  };

  const beats = sections.filter((s) => s.stage);
  const extras = sections.filter((s) => !s.stage);

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* ---------- header ---------- */}
      <header className="flex flex-col gap-3 border-b border-separator px-4 pb-3 pt-3">
        <div className="flex items-center gap-2">
          <h1 className="mr-auto text-sm font-semibold">Technology page</h1>
          <Progress host={host} id={sid} />
          {onHide && <IconButton label="Hide panel" shortcut="H" onPress={onHide}><PanelRight /></IconButton>}
        </div>

        <div className="flex items-end gap-1">
          <Select aria-label="Section" value={sid} onChange={(k) => k && select(String(k), true)} className="min-w-0 flex-1">
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {extras.length > 0 && (
                  <ListBox.Section>
                    <Header>Page</Header>
                    {extras.map((s) => <ListBox.Item key={s.id} id={s.id} textValue={s.name}>{s.name}<ListBox.ItemIndicator /></ListBox.Item>)}
                  </ListBox.Section>
                )}
                <ListBox.Section>
                  <Header>Sections</Header>
                  {beats.map((s, i) => (
                    <ListBox.Item key={s.id} id={s.id} textValue={`${i + 1} ${s.name}`}>
                      <span className="flex items-center gap-2"><span className="tabular w-3 text-muted">{i + 1}</span>{s.name}</span><ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox.Section>
              </ListBox>
            </Select.Popover>
          </Select>
          <IconButton label="Previous section" isDisabled={idx <= 0} onPress={() => select(sections[idx - 1].id, true)}><ChevronLeft /></IconButton>
          <IconButton label="Next section" isDisabled={idx >= sections.length - 1} onPress={() => select(sections[idx + 1].id, true)}><ChevronRight /></IconButton>
        </div>

        <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
          <Label className="text-xs text-muted">View</Label>
          <div className="flex items-center gap-1">
            <ToggleButtonGroup aria-label="Pictures or wireframe" selectionMode="single" disallowEmptySelection size="sm"
              selectedKeys={new Set([view.wireframe ? 'wireframe' : 'images'])}
              onSelectionChange={(k) => { const w = [...k][0] === 'wireframe'; if (w !== view.wireframe) toggleView('wireframe'); }}>
              <ToggleButton id="images">Images</ToggleButton>
              <ToggleButton id="wireframe"><ToggleButtonGroup.Separator />Wireframe</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButton size="sm" aria-label="Layout grid (G)" isSelected={view.grid} onChange={() => toggleView('grid')}>Grid</ToggleButton>
          </div>
          <Label className="text-xs text-muted">{onDevice ? 'Breakpoint' : 'Editing'}</Label>
          <ToggleButtonGroup aria-label={onDevice ? 'Breakpoint: what the page shows and which values you edit' : 'Which values you’re editing'} selectionMode="single" disallowEmptySelection size="sm"
            selectedKeys={new Set([device])} onSelectionChange={(k) => { const d = [...k][0]; if (d) setDevice(d); }} className="w-full">
            <ToggleButton id="desktop" className="flex-1">Desktop</ToggleButton>
            <ToggleButton id="mobile" className="flex-1"><ToggleButtonGroup.Separator />Mobile</ToggleButton>
          </ToggleButtonGroup>
        </div>
      </header>

      {/* ---------- body ---------- */}
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-separator bg-background px-4 py-2">
          <SearchField aria-label="Find a control" value={query} onChange={setQuery} className="min-w-0 flex-1">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Find a control…" />
              <SearchField.ClearButton className="size-6" />
            </SearchField.Group>
          </SearchField>
          {!q && currentPart && (
            <Button size="sm" variant="ghost" className="shrink-0"
              onPress={() => setOpenKeys(currentPart, allOpen ? new Set() : new Set(currentPart.groups.map((g) => g.key)))}>
              {allOpen ? 'Close all' : 'Open all'}
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-3 px-4 pb-6 pt-3">
          {isMobile !== showingPhone && (
            <Alert status="accent" className="text-xs">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{isMobile ? 'Editing mobile values' : 'Editing desktop values'}</Alert.Title>
                <Alert.Description>
                  {isMobile
                    ? 'The page is showing desktop values. Open it on your phone to see these.'
                    : 'The page is showing mobile values: the window leaves it less than 1024 px. Widen the window, or hide the panel (H).'}
                </Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          {q ? (
            (() => {
              const hits = parts.filter((p) => shownGroups(p).length);
              if (!hits.length) return <p className="py-8 text-center text-sm text-muted" role="status">No controls match “{query}”.</p>;
              return hits.map((p) => (
                <section key={p.title || 'all'} className="flex flex-col gap-2" aria-label={p.title || undefined}>
                  {p.title && <h2 className="text-xs font-medium uppercase tracking-wide text-muted">{p.title}</h2>}
                  {renderGroups(p)}
                </section>
              ));
            })()
          ) : parts.length > 1 ? (
            <Tabs variant="secondary" selectedKey={activeTab} onSelectionChange={(k) => setTab(String(k))} className="flex flex-col gap-3">
              <Tabs.ListContainer>
                <Tabs.List aria-label={`Parts of ${sections[idx]?.name || 'this section'}`}>
                  {parts.map((p, i) => (
                    <Tabs.Tab key={p.title} id={p.title} className="whitespace-nowrap text-sm">
                      {i > 0 && <Tabs.Separator />}
                      {p.title}
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs.ListContainer>
              {parts.map((p) => (
                <Tabs.Panel key={p.title} id={p.title}>
                  {renderGroups(p) || <p className="py-6 text-center text-sm text-muted">Nothing here applies with the current settings.</p>}
                </Tabs.Panel>
              ))}
            </Tabs>
          ) : (
            parts[0] && renderGroups(parts[0])
          )}
        </div>
      </div>

      {/* ---------- footer ---------- */}
      <footer className="flex flex-col gap-2 border-t border-separator px-4 py-3">
        {host.saveDefaults && (
          <Confirm
            trigger={<Button variant="primary" fullWidth isPending={saving}>Save as default</Button>}
            title="Save as default?"
            body="The current settings become the starting point for everyone who opens this page. The previous defaults are kept in src/defaults.prev.json."
            action="Save as default" onConfirm={saveDefaults} />
        )}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" className="min-w-0 flex-1"
            onPress={async () => { await navigator.clipboard.writeText(host.exportAll()); flash('Config copied'); }}>Copy config</Button>
          <Button size="sm" variant="secondary" className="min-w-0 flex-1"
            onPress={async () => {
              try { host.importAll(await navigator.clipboard.readText()); host.reload(); flash('Config pasted'); }
              catch { flash('The clipboard doesn’t hold a config'); }
            }}>Paste config</Button>
          <Button size="sm" variant="secondary" className="min-w-0 flex-1"
            aria-label="Download project" title="Download the project: the latest version pushed to GitHub, as a .zip, saved to your Downloads folder"
            onPress={() => { downloadProject(); flash('Downloading the latest from GitHub…'); }}>
            <Download /> Download
          </Button>
        </div>
        <div className="flex min-h-6 items-center justify-between gap-2 text-xs text-muted">
          <span className="flex min-w-0 items-center gap-2">
            <Confirm
              trigger={<Button size="sm" variant="ghost" className="h-6 min-w-0 shrink-0 px-1.5 text-xs text-muted">Reset all</Button>}
              title="Reset all?"
              body="Clears this browser’s unsaved tweaks, back to the saved defaults."
              action="Reset all" danger onConfirm={() => { host.reset(); host.reload(); }} />
            <span className="truncate" role="status" aria-live="polite">{note}</span>
          </span>
          <span className="flex items-center gap-1" aria-label="Shortcuts: H panel, W wireframe, G grid">
            <Kbd><Kbd.Content>H</Kbd.Content></Kbd><Kbd><Kbd.Content>W</Kbd.Content></Kbd>
            <Kbd><Kbd.Content>G</Kbd.Content></Kbd>
          </span>
        </div>
      </footer>
    </div>
  );
}

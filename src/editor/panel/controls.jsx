/* One control per schema row (editor/schema.js), each a HeroUI component:

     slider (default)  Slider: label and value on one line, the track below
     seg               ToggleButtonGroup for up to three short choices,
                       Select for more
     color             ColorPicker: swatch + hex, with an area, a hue slider
                       and a hex field in its popover
     colorlist         a list of colour pickers you can add to and remove from
     textarea          TextField + TextArea
     textlist          an ordered list of TextAreas: reorder, remove, add
     image / video / media   thumbnail grids, with upload (and delete)
     svg               an uploaded icon, previewed, with a way back to the default

   Every control reads and writes through `api` (see Panel.jsx): in Mobile
   mode that's the phone override, otherwise the desktop value. */

import { useRef, useState } from 'react';
import {
  Button, Chip, ColorArea, ColorField, ColorPicker, ColorSlider, ColorSwatch, Description,
  ListBox, Select, Slider, TextArea, TextField, ToggleButton, ToggleButtonGroup, parseColor,
} from '@heroui/react';
import { cleanSvg } from '../../svgIcon.js';
import { ArrowDown, ArrowUp, Close, Phone, Play, Plus, Trash, Upload } from './icons.jsx';

const HEX = /^#[0-9a-f]{6}$/i;
const toColor = (v) => { try { return parseColor(HEX.test(v || '') ? v : '#000000'); } catch { return parseColor('#000000'); } };
const fmt = (row, v) => {
  const n = Number(v);
  const s = row.step < 1 ? n.toFixed(row.step < 0.05 ? 3 : 2) : String(Math.round(n * 1000) / 1000);
  return s + (row.unit || '');
};

/* ---------- shared pieces ---------- */

// "Phone" marker: this control has its own phone value. In Mobile mode it
// offers the way back to the desktop value.
function PhoneMark({ api, row }) {
  if (!api.hasMobile(row.p)) return null;
  if (!api.isMobile) {
    return (
      <Chip size="sm" variant="soft" className="shrink-0 gap-1" aria-label="The phone version has its own value">
        <Phone /> Phone
      </Chip>
    );
  }
  // Mobile mode: a compact accent chip that is the way back to desktop.
  return (
    <Button size="sm" variant="ghost" className="h-6 min-h-6 shrink-0 gap-1 rounded-full bg-accent-soft px-2 text-xs text-accent-soft-foreground"
      aria-label={`${row.label} has its own phone value. Use the desktop value instead`} onPress={() => api.clearMobile(row.p)}>
      <Phone /> Phone <Close />
    </Button>
  );
}

function Hint({ row }) {
  return row.hint ? <Description className="text-xs leading-snug text-muted">{row.hint}</Description> : null;
}

// The label row: the name, the phone mark, and (for sliders) the value. It
// sits outside the HeroUI component, never inside it: React Aria turns any
// button inside a Select or a Slider into part of that control. Each control
// carries its own accessible name instead.
function LabelRow({ api, row, value }) {
  return (
    <div className="flex min-h-6 items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium text-foreground">{row.label}</span>
        <PhoneMark api={api} row={row} />
      </div>
      {value != null && <span className="tabular shrink-0 text-sm text-muted" aria-hidden="true">{value}</span>}
    </div>
  );
}

// A stacked control: label row, the control, the hint.
function Stack({ api, row, children }) {
  return (
    <div className="flex flex-col gap-2">
      <LabelRow api={api} row={row} />
      {children}
      <Hint row={row} />
    </div>
  );
}

/* ---------- slider ---------- */

function SliderControl({ api, row }) {
  const v = Number(api.read(row.p) ?? row.min ?? 0);
  const max = row.max === 'cols' ? api.gridCols : row.max;
  return (
    <div className="flex flex-col gap-2">
      <LabelRow api={api} row={row} value={fmt(row, v)} />
      <Slider aria-label={row.label} value={v} minValue={row.min} maxValue={max} step={row.step}
        getValueLabel={() => fmt(row, v)} onChange={(n) => api.write(row.p, n)} className="w-full">
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>
      <Hint row={row} />
    </div>
  );
}

/* ---------- choices ---------- */

function SegControl({ api, row }) {
  const v = String(api.read(row.p));
  const byKey = Object.fromEntries(row.options.map(([val]) => [String(val), val]));
  const short = row.options.length <= 3 && row.options.map((o) => o[1]).join('').length <= 26;
  if (short) {
    return (
      <Stack api={api} row={row}>
        <ToggleButtonGroup aria-label={row.label} selectionMode="single" disallowEmptySelection size="sm"
          selectedKeys={new Set([v])} className="w-full"
          onSelectionChange={(keys) => { const k = [...keys][0]; if (k != null) api.write(row.p, byKey[k]); }}>
          {row.options.map(([val, text], i) => (
            <ToggleButton key={String(val)} id={String(val)} className="flex-1">
              {i > 0 && <ToggleButtonGroup.Separator />}
              {text}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <LabelRow api={api} row={row} />
      <Select aria-label={row.label} value={v} onChange={(k) => k != null && api.write(row.p, byKey[k])} className="w-full">
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {row.options.map(([val, text]) => (
              <ListBox.Item key={String(val)} id={String(val)} textValue={text}>
                {text}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <Hint row={row} />
    </div>
  );
}

/* ---------- colour ---------- */

function ColorInput({ value, onChange, label }) {
  return (
    <ColorPicker value={toColor(value)} onChange={(c) => onChange(c.toString('hex').toLowerCase())}>
      <ColorPicker.Trigger aria-label={`${label}: ${value}`} className="flex min-h-8 items-center gap-2 rounded-lg px-1">
        <ColorSwatch size="sm" />
        <span className="tabular font-mono text-xs uppercase text-muted">{value}</span>
      </ColorPicker.Trigger>
      <ColorPicker.Popover className="flex w-60 flex-col gap-3 p-3">
        <ColorArea aria-label={`${label}: saturation and brightness`} colorSpace="hsb" xChannel="saturation" yChannel="brightness">
          <ColorArea.Thumb />
        </ColorArea>
        <ColorSlider aria-label={`${label}: hue`} channel="hue" colorSpace="hsb">
          <ColorSlider.Track>
            <ColorSlider.Thumb />
          </ColorSlider.Track>
        </ColorSlider>
        <ColorField aria-label={`${label}: hex`}>
          <ColorField.Group>
            <ColorField.Input className="tabular font-mono" />
          </ColorField.Group>
        </ColorField>
      </ColorPicker.Popover>
    </ColorPicker>
  );
}

function ColorControl({ api, row }) {
  const v = api.read(row.p) || '#000000';
  return (
    <div className="flex flex-col gap-1">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <LabelRow api={api} row={row} />
        <ColorInput value={v} label={row.label} onChange={(c) => api.write(row.p, c)} />
      </div>
      <Hint row={row} />
    </div>
  );
}

function ColorListControl({ api, row }) {
  const items = [...(api.read(row.p) || [])];
  const set = (a) => api.write(row.p, a);
  return (
    <Stack api={api} row={row}>
      <ul className="flex flex-col gap-1" aria-label={row.label}>
        {items.map((c, i) => (
          <li key={i} className="flex items-center justify-between gap-2">
            <ColorInput value={c} label={`${row.label} ${i + 1}`} onChange={(v) => { const a = [...items]; a[i] = v; set(a); }} />
            <Button isIconOnly size="sm" variant="ghost" aria-label={`Remove colour ${i + 1}`}
              isDisabled={items.length <= 1} onPress={() => { const a = [...items]; a.splice(i, 1); set(a); }}>
              <Close />
            </Button>
          </li>
        ))}
      </ul>
      <Button size="sm" variant="secondary" className="self-start" onPress={() => set([...items, items[items.length - 1] || '#ac74fc'])}>
        <Plus /> Add colour
      </Button>
    </Stack>
  );
}

/* ---------- text ---------- */

function TextControl({ api, row }) {
  return (
    <Stack api={api} row={row}>
      <TextField aria-label={row.label} value={api.read(row.p) ?? ''} onChange={(t) => api.write(row.p, t)}>
        <TextArea rows={row.p === 'text' ? 4 : 2} spellCheck={false} className="min-h-0 resize-y text-sm" />
      </TextField>
    </Stack>
  );
}

function TextListControl({ api, row }) {
  const items = [...(api.read(row.p) || [])];
  const set = (a) => api.write(row.p, a);
  const move = (i, to) => { const a = [...items]; const [x] = a.splice(i, 1); a.splice(to, 0, x); set(a); };
  return (
    <Stack api={api} row={row}>
      <ol className="flex flex-col gap-3" aria-label={row.label}>
        {items.map((text, i) => (
          <li key={i} className="flex flex-col gap-1 rounded-lg bg-surface-secondary p-2">
            <div className="flex items-center gap-1">
              <span className="tabular mr-auto pl-1 text-xs text-muted">{i + 1}</span>
              <Button isIconOnly size="sm" variant="ghost" aria-label={`Move item ${i + 1} up`} isDisabled={i === 0} onPress={() => move(i, i - 1)}><ArrowUp /></Button>
              <Button isIconOnly size="sm" variant="ghost" aria-label={`Move item ${i + 1} down`} isDisabled={i === items.length - 1} onPress={() => move(i, i + 1)}><ArrowDown /></Button>
              <Button isIconOnly size="sm" variant="ghost" aria-label={`Remove item ${i + 1}`} isDisabled={items.length <= 1}
                onPress={() => { const a = [...items]; a.splice(i, 1); set(a); }}><Close /></Button>
            </div>
            <TextField aria-label={`${row.label} ${i + 1}`} value={text} onChange={(t) => { const a = [...items]; a[i] = t; set(a); }}>
              <TextArea rows={3} spellCheck={false} className="resize-y text-sm" />
            </TextField>
          </li>
        ))}
      </ol>
      <Button size="sm" variant="secondary" className="self-start" onPress={() => set([...items, 'New blurb'])}>
        <Plus /> {row.addLabel || 'Add'}
      </Button>
    </Stack>
  );
}

/* ---------- pictures, video, media ---------- */

// A square tile in a thumbnail grid: a toggle with an accessible name.
function Tile({ selected, label, image, onPress, children, className = '' }) {
  return (
    <button type="button" aria-label={label} aria-pressed={selected} title={label} onClick={onPress}
      style={image ? { backgroundImage: `url("${image}")` } : undefined}
      className={`relative grid aspect-square w-full place-items-center overflow-hidden rounded-lg bg-surface-secondary bg-cover bg-center text-xs text-muted outline-none transition-[box-shadow,opacity] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background ${selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-background' : ''} ${className}`}>
      {children}
    </button>
  );
}

function Uploader({ accept, label, onFile }) {
  const input = useRef(null);
  const [status, setStatus] = useState({ text: '', error: false, busy: false });
  return (
    <div className="flex flex-col gap-1">
      <input ref={input} type="file" accept={accept} hidden aria-hidden="true" tabIndex={-1}
        onChange={async (e) => {
          const f = e.target.files[0];
          e.target.value = '';
          if (!f) return;
          setStatus({ text: '', error: false, busy: true });
          try {
            const note = await onFile(f, (t) => setStatus((s) => ({ ...s, text: t })));
            setStatus({ text: note || '', error: false, busy: false });
          } catch (err) {
            setStatus({ text: String(err.message || err), error: true, busy: false });
          }
        }} />
      <Button size="sm" variant="secondary" className="self-start" isPending={status.busy} onPress={() => input.current.click()}>
        <Upload /> {label}
      </Button>
      {status.text && (
        <p role={status.error ? 'alert' : 'status'} className={`text-xs ${status.error ? 'text-danger' : 'text-muted'}`}>
          {status.error ? `Upload failed: ${status.text}` : status.text}
        </p>
      )}
    </div>
  );
}

const visitOnly = 'Showing from the file for this visit only: a static build can’t keep it.';

function ImageControl({ api, row }) {
  const v = api.read(row.p);
  return (
    <Stack api={api} row={row}>
      <div className="grid grid-cols-5 gap-2" role="group" aria-label={row.label}>
        {api.host.images.map((im) => (
          <Tile key={im.src} label={im.src.split('/').pop()} image={im.src} selected={im.src === v} onPress={() => api.write(row.p, im.src)} />
        ))}
      </div>
    </Stack>
  );
}

function VideoControl({ api, row }) {
  const v = api.read(row.p);
  const vids = api.cfg.videos || [];
  return (
    <Stack api={api} row={row}>
      <div className="grid grid-cols-4 gap-2" role="group" aria-label={row.label}>
        {vids.map((it) => (
          <Tile key={it.stem} label={it.stem} image={it.poster} selected={it.stem === v}
            onPress={() => api.writeKeys({ [row.p]: it.stem, heroMedia: 'video' })}>
            {!it.poster && <Play />}
          </Tile>
        ))}
      </div>
      {api.host.uploadVideo && (
        <Uploader accept="video/*,.mov,.mp4,.webm,.m4v" label="Upload video…"
          onFile={async (f, status) => { const out = await api.host.uploadVideo(f, status); api.refresh(); return out.saved ? '' : visitOnly; }} />
      )}
    </Stack>
  );
}

function MediaControl({ api, row }) {
  const v = api.read(row.p) || '';
  const { host } = api;
  const remove = async (stem) => {
    const c = api.authored();
    const uses = [];
    const scan = (o, where) => o && Object.entries(o).forEach(([k, x]) => { if (k.startsWith('modalMedia_') && x === stem) uses.push(where); });
    scan(c, 'desktop'); scan(c.mobile, 'phone');
    const note = uses.length ? `\n\nIt's used in ${uses.length} slot${uses.length > 1 ? 's' : ''}, which will be emptied.` : '';
    if (!confirm(`Delete “${stem}”?${host.canPersist ? ' It goes to the Trash.' : ''}${note}`)) return;
    try {
      const strip = (o) => o && Object.fromEntries(Object.entries(o).map(([k, x]) => [k, k.startsWith('modalMedia_') && x === stem ? '' : x]));
      await host.deleteMedia(stem);
      api.replace({ ...strip(c), ...(c.mobile ? { mobile: strip(c.mobile) } : {}) });
    } catch (e) {
      alert(`Couldn’t delete “${stem}”: ${e.message || e}`);
    }
  };
  return (
    <Stack api={api} row={row}>
      <div className="grid grid-cols-4 gap-2" role="group" aria-label={row.label}>
        {host.media.map((it) => (
          <div key={it.stem} className="group relative">
            <Tile label={`${it.stem} (${it.kind})`} image={it.thumb} selected={it.stem === v} onPress={() => api.write(row.p, it.stem)}>
              {it.kind === 'video' && <span className="grid size-6 place-items-center rounded-full bg-black/60 text-white"><Play /></span>}
            </Tile>
            {host.deleteMedia && (
              <Button isIconOnly size="sm" variant="secondary" aria-label={`Delete ${it.stem}`}
                className="absolute -right-1.5 -top-1.5 size-6 min-h-6 min-w-6 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                onPress={() => remove(it.stem)}><Trash /></Button>
            )}
          </div>
        ))}
        <Tile label="None: an empty placeholder card" selected={!v} onPress={() => api.write(row.p, '')}>None</Tile>
      </div>
      {host.uploadMedia && (
        <Uploader accept="image/*,video/*,.mov,.mp4,.webm,.m4v" label="Upload image or video…"
          onFile={async (f, status) => {
            const was = api.authored();
            const out = await host.uploadMedia(f, status, (stem) => { api.write(row.p, stem); return () => api.replace(was); });
            api.refresh();
            return out.saved ? '' : visitOnly;
          }} />
      )}
    </Stack>
  );
}

function SvgControl({ api, row }) {
  const svg = cleanSvg(api.read(row.p) || '');
  return (
    <Stack api={api} row={row}>
      <div className="flex items-center gap-2">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-secondary text-foreground [&_svg]:size-5"
          aria-label={svg ? 'Uploaded icon' : 'Default icon'} role="img"
          dangerouslySetInnerHTML={{ __html: svg || '<span aria-hidden="true">×</span>' }} />
        <Uploader accept=".svg,image/svg+xml" label="Upload SVG…"
          onFile={async (f) => {
            const s = cleanSvg(await f.text());
            if (!s) throw new Error('that file isn’t an SVG this can use');
            api.write(row.p, s);
            return f.name;
          }} />
        <Button size="sm" variant="ghost" isDisabled={!svg} onPress={() => api.write(row.p, '')}>Use default</Button>
      </div>
    </Stack>
  );
}

/* ---------- dispatch ---------- */

const BY_TYPE = {
  seg: SegControl, color: ColorControl, colorlist: ColorListControl, textarea: TextControl,
  textlist: TextListControl, image: ImageControl, video: VideoControl, media: MediaControl, svg: SvgControl,
};

export function Control({ api, row }) {
  const C = BY_TYPE[row.type] || SliderControl;
  return <C api={api} row={row} />;
}

// Small stroke icons for the panel (16 px, currentColor). Always decorative:
// the button that holds one carries the accessible name.
const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {d}
  </svg>
);

export const ChevronLeft = () => <Icon d={<path d="M10 3.5 5.5 8l4.5 4.5" />} />;
export const ChevronRight = () => <Icon d={<path d="M6 3.5 10.5 8 6 12.5" />} />;
export const ArrowUp = () => <Icon d={<path d="M8 13V3M4 7l4-4 4 4" />} />;
export const ArrowDown = () => <Icon d={<path d="M8 3v10M4 9l4 4 4-4" />} />;
export const Close = () => <Icon d={<path d="M4 4l8 8M12 4l-8 8" />} />;
export const PanelRight = () => <Icon d={<><rect x="2" y="2.5" width="12" height="11" rx="2" /><path d="M10 2.5v11" /></>} />;
export const Download = () => <Icon d={<path d="M8 2.5v8M5 7.5l3 3 3-3M3 10v2.5h10V10" />} />;
export const Upload = () => <Icon d={<path d="M8 10.5V2.5M5 5.5l3-3 3 3M3 10v2.5h10V10" />} />;
export const Trash = () => <Icon d={<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.5 8.5h6l.5-8.5" />} />;
export const Play = () => <Icon d={<path d="M5.5 3.5v9l7-4.5-7-4.5Z" fill="currentColor" stroke="none" />} />;
export const Phone = () => <Icon size={12} d={<><rect x="4.5" y="1.5" width="7" height="13" rx="1.5" /><path d="M7 12.5h2" /></>} />;
export const Reload = () => <Icon d={<path d="M13 8a5 5 0 1 1-1.5-3.5M13 2.5v3h-3" />} />;
export const Plus = () => <Icon d={<path d="M8 3v10M3 8h10" />} />;

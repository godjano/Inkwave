'use client';

import React from 'react';

/* ════════════════════════════════════════════════════════════════
   Inkweave Custom Icon Library
   Consistent stroke-based SVG icons (24×24 viewBox, outline style)
   ════════════════════════════════════════════════════════════════ */

interface IconProps {
  size?: number;
  className?: string;
}

const svgBase = (size: number, className: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className: className || undefined,
});

/* ── Quill Pen ── */
export function IconWrite({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

/* ── Grid / Tiles ── */
export function IconGrid({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  );
}

/* ── List / Hierarchy (Outline) ── */
export function IconOutline({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <line x1="8" x2="21" y1="6" y2="6" />
      <line x1="8" x2="21" y1="12" y2="12" />
      <line x1="8" x2="21" y1="18" y2="18" />
      <line x1="3" x2="3.01" y1="6" y2="6" />
      <line x1="3" x2="3.01" y1="12" y2="12" />
      <line x1="3" x2="3.01" y1="18" y2="18" />
    </svg>
  );
}

/* ── Clock / Timeline ── */
export function IconTimeline({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

/* ── Open Book (Read) ── */
export function IconRead({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

/* ── Bar Chart (Stats) ── */
export function IconStats({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <line x1="18" x2="18" y1="20" y2="10" />
      <line x1="12" x2="12" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="14" />
    </svg>
  );
}

/* ── Dice / Generators ── */
export function IconGenerators({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ── Book Stack (Chapters) ── */
export function IconChapters({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8" />
      <path d="M8 11h6" />
    </svg>
  );
}

/* ── Globe / World Bible ── */
export function IconWorldBible({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" x2="22" y1="12" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

/* ── Network Graph / Master Bible ── */
export function IconMasterBible({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <circle cx="12" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
      <circle cx="12" cy="12" r="2" />
      <line x1="12" x2="12" y1="7" y2="10" />
      <line x1="10.1" x2="6.9" y1="13.1" y2="17.9" />
      <line x1="13.9" x2="17.1" y1="13.1" y2="17.9" />
    </svg>
  );
}

/* ── Notepad / Notes ── */
export function IconNotes({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" />
      <path d="M15 3v4a2 2 0 0 0 2 2h4" />
      <line x1="8" x2="16" y1="13" y2="13" />
      <line x1="8" x2="14" y1="17" y2="17" />
    </svg>
  );
}

/* ── Sparkle / AI ── */
export function IconAI({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}

/* ── Flame / Sprint ── */
export function IconSprint({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

/* ── Target / Focus ── */
export function IconFocus({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

/* ── Download / Export ── */
export function IconExport({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

/* ── Magnifying Glass / Search ── */
export function IconSearch({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" x2="16.65" y1="21" y2="16.65" />
    </svg>
  );
}

/* ── Gear / Settings ── */
export function IconSettings({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/* ── Magic Wand / Sparkles ── */
export function IconSparkles({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}

/* ── Arrow Left / Back ── */
export function IconBack({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

/* ── Chevron Left / Collapse ── */
export function IconCollapse({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

/* ── Chevron Right / Expand ── */
export function IconExpand({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/* ── Trash Can ── */
export function IconTrash({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

/* ── Plus ── */
export function IconPlus({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

/* ── Close X ── */
export function IconX({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

/* ── Checkmark ── */
export function IconCheck({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/* ── Bookmark ── */
export function IconBookmark({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  );
}

/* ── Image Plus ── */
export function IconImagePlus({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
      <path d="M14 3h7v7" />
    </svg>
  );
}

/* ── Music Note ── */
export function IconMusic({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

/* ── Floppy Disk / Save ── */
export function IconSave({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
      <path d="M7 3v4a1 1 0 0 0 1 1h7" />
    </svg>
  );
}

/* ── Keyboard Shortcuts ── */
export function IconKeyboard({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <rect width="20" height="16" x="2" y="4" rx="2" ry="2" />
      <path d="M6 8h.001" />
      <path d="M10 8h.001" />
      <path d="M14 8h.001" />
      <path d="M18 8h.001" />
      <path d="M8 12h.001" />
      <path d="M16 12h.001" />
      <path d="M12 12h.001" />
    </svg>
  );
}

/* ── Sun ── */
export function IconSun({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

/* ── Moon ── */
export function IconMoon({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

/* ── Camera / Snapshot ── */
export function IconCamera({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

/* ── Undo / Restore ── */
export function IconRestore({ size = 20, className = '' }: IconProps) {
  return (
    <svg {...svgBase(size, className)}>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  );
}

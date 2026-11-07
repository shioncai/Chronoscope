import type { ReactNode } from 'react'

/**
 * The app's one icon set: 24-unit grid, 1.75 stroke, round caps — drawn here
 * rather than typed, because a glyph the UI depends on is not something to
 * leave to whatever fonts the OS ships (Android had no ⭱/⭳ and showed tofu; 🌐
 * came out as a full-colour emoji in an otherwise achromatic chrome).
 */
const PATHS: Record<string, ReactNode> = {
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  timeline: <><path d="M3 12h18" /><path d="M7 8v8M13 5v14M18 9v6" /></>,
  undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
  redo: <><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />,
  monitor: <><rect x="3" y="4.5" width="18" height="12" rx="2" /><path d="M8.5 20h7M12 16.5V20" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>,
  upload: <><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" /><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" /></>,
  download: <><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.5h.01" /></>,
  keyboard: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M7.5 14h9" /></>,
  folder: <path d="M3.5 18.5V6.5a1.5 1.5 0 0 1 1.5-1.5h4.2l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5v9.5A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5Z" />,
  folderPlus: <><path d="M3.5 18.5V6.5a1.5 1.5 0 0 1 1.5-1.5h4.2l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5v9.5A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5Z" /><path d="M12 11v5.5M9.25 13.75h5.5" /></>,
  tag: <><path d="M3.5 12.6V4.9A1.4 1.4 0 0 1 4.9 3.5h7.7a1.4 1.4 0 0 1 1 .4l6.6 6.6a1.4 1.4 0 0 1 0 2l-7.7 7.7a1.4 1.4 0 0 1-2 0l-6.6-6.6a1.4 1.4 0 0 1-.4-1Z" /><circle cx="8.5" cy="8.5" r="1.2" /></>,
  tagPlus: <><path d="M3.5 11.6V4.9A1.4 1.4 0 0 1 4.9 3.5h6.7a1.4 1.4 0 0 1 1 .4l6.1 6.1" /><path d="m3.9 12.6 6.6 6.6a1.4 1.4 0 0 0 2 0l.5-.5" /><circle cx="8.5" cy="8.5" r="1.2" /><path d="M18.5 14.5v6M15.5 17.5h6" /></>,
  tagMinus: <><path d="M3.5 11.6V4.9A1.4 1.4 0 0 1 4.9 3.5h6.7a1.4 1.4 0 0 1 1 .4l6.1 6.1" /><path d="m3.9 12.6 6.6 6.6a1.4 1.4 0 0 0 2 0l.5-.5" /><circle cx="8.5" cy="8.5" r="1.2" /><path d="M15.5 17.5h6" /></>,
  trash: <><path d="M4 7h16M9.5 7V4.5h5V7" /><path d="M6 7l.9 12a1.5 1.5 0 0 0 1.5 1.4h7.2a1.5 1.5 0 0 0 1.5-1.4L18 7" /><path d="M10 11v5.5M14 11v5.5" /></>,
  restore: <><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" /><path d="M3 4v4.5h4.5" /></>,
  edit: <><path d="M14.5 5.5l4 4" /><path d="M4 20l1-4.5L15.8 4.7a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L8.5 19Z" /></>,
  copy: <><rect x="8.5" y="8.5" width="12" height="12" rx="2" /><path d="M15.5 8.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5" /></>,
  locate: <><circle cx="12" cy="12" r="6.5" /><circle cx="12" cy="12" r="1.6" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" /></>,
  zoomIn: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2M11 8v6M8 11h6" /></>,
  zoomOut: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2M8 11h6" /></>,
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  now: <><path d="M12 3v18" /><path d="M8 6.5 12 3l4 3.5" /><path d="M5 21h14" /></>,
  sliders: <path d="M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4" />,
  image: <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m20.5 16-4.5-4.5L6 19.5" /></>,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  layers: <><path d="M3 8.5 12 4l9 4.5-9 4.5Z" /><path d="m3 12.5 9 4.5 9-4.5" /><path d="m3 16.5 9 4.5 9-4.5" /></>,
  logScale: <><path d="M3.5 20.5h17M3.5 20.5v-17" /><path d="M6 18c2-6 5-10 14-11.5" /></>,
  linearScale: <><path d="M3.5 20.5h17M3.5 20.5v-17" /><path d="M6 18 20 6" /></>,
  more: <path d="M5.5 12h.01M12 12h.01M18.5 12h.01" />,
  text: <path d="M5 7V5h14v2M12 5v14M9 19h6" />,
  sparkle: <path d="M12 3.5c.7 3.9 1.9 5.6 5.5 6.5-3.6.9-4.8 2.6-5.5 6.5-.7-3.9-1.9-5.6-5.5-6.5 3.6-.9 4.8-2.6 5.5-6.5ZM18.5 15.5c.3 1.6.8 2.3 2.2 2.6-1.4.4-1.9 1.1-2.2 2.7-.3-1.6-.8-2.3-2.2-2.7 1.4-.3 1.9-1 2.2-2.6Z" />,
  file: <><path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8Z" /><path d="M14 3.5V8h4.5" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  inbox: <><path d="M3.5 13.5 6 5.5A1.5 1.5 0 0 1 7.4 4.5h9.2A1.5 1.5 0 0 1 18 5.5l2.5 8" /><path d="M3.5 13.5V18A1.5 1.5 0 0 0 5 19.5h14a1.5 1.5 0 0 0 1.5-1.5v-4.5h-5l-1.5 2.5h-4l-1.5-2.5Z" /></>,
  circle: <circle cx="12" cy="12" r="7.5" />,
  hash: <path d="M9 4 7.5 20M16.5 4 15 20M4.5 9h15.5M4 15h15.5" />,
}

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}

/** The app mark, exactly as public/favicon.svg draws it — in the icon's own
 *  fixed palette (warm ink on paper), which is designed to read on light and
 *  dark chrome alike. The only colour the chrome itself ever shows. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 256 256" aria-hidden="true" focusable="false">
      <clipPath id="mark-tile"><rect width="256" height="256" rx="56" /></clipPath>
      <g clipPath="url(#mark-tile)">
        <rect width="256" height="256" fill="#e0d7c8" />
        <g fill="#6c5649">
          <rect x="-16" y="48" width="192" height="32" />
          <rect x="80" y="112" width="112" height="32" />
          <rect x="144" y="176" width="64" height="32" />
        </g>
      </g>
    </svg>
  )
}

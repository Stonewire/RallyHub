import { RhIcon, type RhIconProps } from '@/components/icons/RhIcon'

/**
 * The RallyHub icon set. Hand-drawn on a shared 24x24 grid, see RhIcon.
 *
 * Shapes are deliberately built from a small vocabulary: 3px corner radii, a
 * 4px margin from the grid edge, and circles at r=1 for dots. That is what makes
 * a nav icon and a button icon look like they belong to the same family, rather
 * than each one being individually reasonable.
 */

// ─── Navigation ───────────────────────────────────────────────────────────

/** Four panels: an overview of everything. */
export function IconDashboard(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </RhIcon>
  )
}

/** Controller: games. */
export function IconGames(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="M7.5 7h9a5 5 0 0 1 4.9 4l.6 5.2A2.6 2.6 0 0 1 17.3 18l-1.8-2.4h-7L6.7 18a2.6 2.6 0 0 1-4.7-1.8l.6-5.2A5 5 0 0 1 7.5 7Z" />
      <path d="M7 10.5v2.2M5.9 11.6h2.2" />
      <circle cx="16" cy="11" r="1" />
      <circle cx="18.2" cy="13" r="1" />
    </RhIcon>
  )
}

/** Calendar: events. */
export function IconEvents(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <circle cx="8.5" cy="14.5" r="1" />
      <circle cx="12" cy="14.5" r="1" />
    </RhIcon>
  )
}

/** Building: the organisation. */
export function IconOrganisation(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="M4 21V6a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v15" />
      <path d="M16 11h1a3 3 0 0 1 3 3v7" />
      <path d="M2.5 21h19" />
      <path d="M8 8h4M8 12h4M8 16h4" />
    </RhIcon>
  )
}

/** Card: billing. */
export function IconBilling(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <rect x="2.5" y="5" width="19" height="14" rx="3" />
      <path d="M2.5 10h19" />
      <path d="M6 14.5h3.5" />
    </RhIcon>
  )
}

/** Ring buoy: support. */
export function IconSupport(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.6" />
      <path d="M14.6 9.4 18.4 5.6M9.4 9.4 5.6 5.6M14.6 14.6l3.8 3.8M9.4 14.6l-3.8 3.8" />
    </RhIcon>
  )
}

// ─── Game types ───────────────────────────────────────────────────────────

export function IconPhoto(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <rect x="2.5" y="5.5" width="19" height="14" rx="3" />
      <circle cx="8.5" cy="10.5" r="1.6" />
      <path d="m3.5 17 4.2-4a2 2 0 0 1 2.7 0l3.4 3.2" />
      <path d="m13 14.5 2-1.8a2 2 0 0 1 2.7 0l2.8 2.6" />
    </RhIcon>
  )
}

export function IconVideo(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <rect x="2.5" y="5.5" width="13" height="13" rx="3" />
      <path d="m15.5 10.5 4.3-2.6a1 1 0 0 1 1.7.9v6.4a1 1 0 0 1-1.7.9l-4.3-2.6Z" />
    </RhIcon>
  )
}

export function IconText(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M7.5 9h9M7.5 12.5h9M7.5 16h5" />
    </RhIcon>
  )
}

export function IconQuiz(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.4 9.4a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.3-2.6 4" />
      <circle cx="12" cy="17.2" r="1" />
    </RhIcon>
  )
}

export function IconMusicBingo(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="M9 17.5V6.2l10-2v11.3" />
      <circle cx="6.6" cy="17.5" r="2.6" />
      <circle cx="16.6" cy="15.5" r="2.6" />
    </RhIcon>
  )
}

export function IconPuzzle(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="M10.2 3.5h3.6a1 1 0 0 1 1 1.3 1.9 1.9 0 0 0 2.5 2.3 1 1 0 0 1 1.2 1v3.3a1 1 0 0 1-1.3 1 1.9 1.9 0 0 0-2.3 2.5 1 1 0 0 1-1 1.2h-3.3a1 1 0 0 1-1-1.3 1.9 1.9 0 0 0-2.5-2.3 1 1 0 0 1-1.2-1V7.9a1 1 0 0 1 1.3-1 1.9 1.9 0 0 0 2.3-2.5 1 1 0 0 1 .7-.9Z" />
      <path d="M15.5 15.5v3.3a1.7 1.7 0 0 1-1.7 1.7h-3.6" />
    </RhIcon>
  )
}

// ─── Actions ──────────────────────────────────────────────────────────────

export function IconPlus(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="M12 5v14M5 12h14" />
    </RhIcon>
  )
}

export function IconEdit(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="M4 20h4.2l9.4-9.4a2.4 2.4 0 0 0-3.4-3.4L4.8 16.6V20Z" />
      <path d="M13.5 8.5 16 11" />
    </RhIcon>
  )
}

export function IconTrash(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="M4.5 6.5h15" />
      <path d="M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5" />
      <path d="M6.5 6.5 7.4 19a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9l.9-12.5" />
      <path d="M10.5 10.5v6M13.5 10.5v6" />
    </RhIcon>
  )
}

export function IconCopy(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <rect x="8.5" y="8.5" width="12" height="12" rx="3" />
      <path d="M15.5 5.5v-.5a2 2 0 0 0-2-2H5.5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2H6" />
    </RhIcon>
  )
}

export function IconDownload(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="M12 3.5v11" />
      <path d="m7.8 10.4 4.2 4.1 4.2-4.1" />
      <path d="M4 16.5v1.7a2.8 2.8 0 0 0 2.8 2.8h10.4a2.8 2.8 0 0 0 2.8-2.8v-1.7" />
    </RhIcon>
  )
}

export function IconUpload(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="M12 15.5v-11" />
      <path d="m7.8 8.6 4.2-4.1 4.2 4.1" />
      <path d="M4 16.5v1.7a2.8 2.8 0 0 0 2.8 2.8h10.4a2.8 2.8 0 0 0 2.8-2.8v-1.7" />
    </RhIcon>
  )
}

export function IconExternal(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="M13.5 4.5H19a.5.5 0 0 1 .5.5v5.5" />
      <path d="m19 5-7.5 7.5" />
      <path d="M17 14.5v3.7a2.3 2.3 0 0 1-2.3 2.3H6.3A2.3 2.3 0 0 1 4 18.2V9.8a2.3 2.3 0 0 1 2.3-2.3H10" />
    </RhIcon>
  )
}

export function IconClose(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </RhIcon>
  )
}

export function IconCheck(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </RhIcon>
  )
}

export function IconSearch(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.4 15.4 4.6 4.6" />
    </RhIcon>
  )
}

export function IconChevronDown(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="m6 9.5 6 6 6-6" />
    </RhIcon>
  )
}

export function IconChevronLeft(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="m14.5 6-6 6 6 6" />
    </RhIcon>
  )
}

export function IconEye(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3.2" />
    </RhIcon>
  )
}

export function IconLink(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="M10 13.8a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.3 1.3" />
      <path d="M14 10.2a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.3-1.3" />
    </RhIcon>
  )
}

export function IconLocation(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </RhIcon>
  )
}

export function IconQr(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <path d="M13.5 13.5h3v3h-3zM20.5 20.5h-3v-3" />
    </RhIcon>
  )
}

export function IconArchive(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <rect x="3" y="4" width="18" height="4.5" rx="2" />
      <path d="M4.8 8.5v9.7A2.8 2.8 0 0 0 7.6 21h8.8a2.8 2.8 0 0 0 2.8-2.8V8.5" />
      <path d="M10 12.5h4" />
    </RhIcon>
  )
}

export function IconRestore(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="M4 11a8 8 0 1 1 2.3 6.4" />
      <path d="M3.5 5.5V11H9" />
    </RhIcon>
  )
}

// ─── Media transport ──────────────────────────────────────────────────────

export function IconPlay(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="M8 5.6 18.5 12 8 18.4Z" />
    </RhIcon>
  )
}

export function IconPause(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="M9 5v14M15 5v14" />
    </RhIcon>
  )
}

export function IconSkipBack(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="M18.5 6.2 10 12l8.5 5.8Z" />
      <path d="M6 5.5v13" />
    </RhIcon>
  )
}

export function IconSkipForward(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="M5.5 6.2 14 12l-8.5 5.8Z" />
      <path d="M18 5.5v13" />
    </RhIcon>
  )
}

export function IconMusic(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="M9 17.5V6.2l10-2v11.3" />
      <circle cx="6.6" cy="17.5" r="2.6" />
      <circle cx="16.6" cy="15.5" r="2.6" />
    </RhIcon>
  )
}

// ─── Misc ─────────────────────────────────────────────────────────────────

export function IconUsers(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M3.5 20a6 6 0 0 1 12 0" />
      <path d="M16.5 5.2a3.5 3.5 0 0 1 0 6.6" />
      <path d="M17.5 14.6a6 6 0 0 1 3 5.4" />
    </RhIcon>
  )
}

export function IconInventory(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9Z" />
      <path d="m3.5 7.5 8.5 4.5 8.5-4.5M12 12v9" />
    </RhIcon>
  )
}

export function IconDevice(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <rect x="6" y="2.5" width="12" height="19" rx="3" />
      <path d="M10.5 18.5h3" />
    </RhIcon>
  )
}

export function IconSun(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
    </RhIcon>
  )
}

export function IconMoon(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="M20 14.2A8.4 8.4 0 0 1 9.8 4 8.5 8.5 0 1 0 20 14.2Z" />
    </RhIcon>
  )
}

export function IconHelp(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.4 9.4a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.3-2.6 4" />
      <circle cx="12" cy="17.2" r="1" />
    </RhIcon>
  )
}

export function IconGrip(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <circle cx="9.5" cy="6" r="1" />
      <circle cx="14.5" cy="6" r="1" />
      <circle cx="9.5" cy="12" r="1" />
      <circle cx="14.5" cy="12" r="1" />
      <circle cx="9.5" cy="18" r="1" />
      <circle cx="14.5" cy="18" r="1" />
    </RhIcon>
  )
}

export function IconAttachment(props: RhIconProps) {
  return (
    <RhIcon {...props}>
      <path d="M20 11.5 12.2 19.3a5 5 0 0 1-7.1-7.1l7.8-7.8a3.4 3.4 0 1 1 4.8 4.8l-7.7 7.7a1.7 1.7 0 0 1-2.4-2.4l7.1-7.1" />
    </RhIcon>
  )
}

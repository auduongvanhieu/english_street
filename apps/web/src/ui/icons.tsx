/**
 * HUD icon set: one line style for every phone button (24 × 24, 2 px round strokes, currentColor), so the
 * buttons look like one family instead of a mix of emoji and text symbols.
 */
export type IconName =
  | 'menu' | 'close' | 'more' | 'users' | 'map' | 'settings' | 'feedback' | 'exit' | 'mic' | 'micOff' | 'voice'
  | 'chat' | 'talk' | 'jump' | 'smile' | 'megaphone' | 'chair' | 'stand' | 'hand' | 'heart' | 'drop'
  | 'sun' | 'moon' | 'cloud' | 'rain' | 'storm' | 'fog' | 'target' | 'pin' | 'graphics' | 'bolt';

const P: Record<IconName, React.ReactNode> = {
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 19c.6-3.3 3-5 6-5s5.4 1.7 6 5" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.4c1.6.7 2.6 2.3 3 4.6" />
    </>
  ),
  map: (
    <>
      <path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
    </>
  ),
  feedback: (
    <>
      <path d="M4 5h16v11H9l-5 4z" />
      <path d="M12 8v3M12 13.2v.1" />
    </>
  ),
  exit: (
    <>
      <path d="M10 4H5v16h5" />
      <path d="M14 8l4 4-4 4M18 12H9" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </>
  ),
  micOff: (
    <>
      <path d="M15 9.5V6a3 3 0 0 0-5.8-1M9 9v2a3 3 0 0 0 4.6 2.5" />
      <path d="M5.5 11a6.5 6.5 0 0 0 10.6 5M18.5 11c0 .8-.1 1.5-.4 2.2M12 17.5V21M3 3l18 18" />
    </>
  ),
  voice: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M2.5 9v4M21.5 9v4" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5h16v11H10l-4.5 3.5V16H4z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </>
  ),
  talk: (
    <>
      <path d="M3.5 5h11v8H8l-3 2.5V13H3.5z" />
      <path d="M17 9h3.5v7.5H19V19l-3-2.5h-4.5V15" />
    </>
  ),
  jump: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M5 20h14" />
    </>
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8M9 9.5v.1M15 9.5v.1" />
    </>
  ),
  megaphone: (
    <>
      <path d="M4 10v4h3l8 4.5v-13L7 10z" />
      <path d="M7 14l1.5 5.5h2.5L10 15M18.5 9.5a3.5 3.5 0 0 1 0 5" />
    </>
  ),
  chair: (
    <>
      <path d="M7 3v10h10V3M5.5 13h13v3h-13zM7 16v5M17 16v5" />
    </>
  ),
  stand: (
    <>
      <circle cx="12" cy="4.5" r="2" />
      <path d="M12 7.5v7M8 10.5h8M12 14.5l-3 6.5M12 14.5l3 6.5" />
    </>
  ),
  hand: (
    <>
      <path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V10" />
      <path d="M12 9.5V3.5a1.5 1.5 0 0 1 3 0V10M15 9V5.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 7-6.5 7-2.8 0-4.4-1.6-5.6-3.7L4 13.6a1.6 1.6 0 0 1 2.7-1.6L9 14" />
    </>
  ),
  heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />,
  drop: <path d="M12 4v12M7 11l5 5 5-5M5 20h14" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
  cloud: <path d="M7 18h10.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 18z" />,
  rain: (
    <>
      <path d="M7 15h10.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 15z" />
      <path d="M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5" />
    </>
  ),
  storm: (
    <>
      <path d="M7 14h10.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 14z" />
      <path d="M12.5 14l-2.5 4h3.5l-2 4" />
    </>
  ),
  fog: <path d="M4 9h16M6 13h12M4 17h16" />,
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  graphics: (
    <>
      <path d="M12 3l2.2 5.3L20 9l-4.4 3.8L17 18.5 12 15.6 7 18.5l1.4-5.7L4 9l5.8-.7z" />
    </>
  ),
  bolt: <path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" />,
};

export function Icon({ name, size = 22, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {P[name]}
    </svg>
  );
}

import { vnHour } from '@es/shared';

/**
 * Background of the sign-in and zone screens: a picture of the street itself (public/bg, rendered from the
 * game), by day or at night with the lamps on, following the Vietnam clock like the sky in the game.
 */
export function StreetBackdrop() {
  const h = vnHour(Date.now());
  const night = h < 6 || h >= 18;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 scale-105 bg-cover bg-center blur-[1.5px]" style={{ backgroundImage: `url(/bg/street-${night ? 'night' : 'day'}.webp)` }} />
      <div className={`absolute inset-0 ${night ? 'bg-black/25' : 'bg-gradient-to-b from-sky-200/20 via-transparent to-black/25'}`} />
    </div>
  );
}

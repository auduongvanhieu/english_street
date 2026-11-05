import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { AreaContentDto, AreaId } from '@es/shared';
import { tk } from '../../../i18n';

type Activity = LazyExoticComponent<ComponentType<{ content: AreaContentDto }>>;

/**
 * The own activity of each newer area, shown as the first tab of its guide (AreaPanel). Each one is a separate
 * chunk, loaded when the tab opens.
 */
export const ACTIVITIES: Partial<Record<AreaId, { label: string; C: Activity }>> = {
  home: { label: tk('🧹 Tidy up & my day'), C: lazy(() => import('./Home')) },
  school: { label: tk('🐝 Spelling & timetable'), C: lazy(() => import('./School')) },
  clothes: { label: tk('🪞 Fitting room'), C: lazy(() => import('./Clothes')) },
  cinema: { label: tk('🎟️ Tickets & books'), C: lazy(() => import('./Cinema')) },
  station: { label: tk('🚆 Trains & tickets'), C: lazy(() => import('./Station')) },
  hospital: { label: tk('💊 Pharmacy'), C: lazy(() => import('./Hospital')) },
  hotel: { label: tk('🛎️ Front desk'), C: lazy(() => import('./Hotel')) },
  sports: { label: tk('🏃 Mini games'), C: lazy(() => import('./Sports')) },
};

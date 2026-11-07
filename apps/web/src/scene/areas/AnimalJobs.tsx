import { ENCLOSURES } from '../../world/zooLayout';
import { useAnimalJobs } from '../../store/animalJobs';
import { useUsable } from '../../world/usables';
import { useT } from '../../i18n';

/** Zoo: the feeding-time board by the zookeeper's hut, and "Feed …" at the front fence of each enclosure. */
export function ZooJobs() {
  const t = useT();
  const feed = useAnimalJobs((s) => s.feed);
  const active = !!feed && Object.keys(feed.done).length < feed.targets.length;
  useUsable({ id: 'zoo-feeding-board', x: 80.7, z: -21.6, r: 1.3, icon: '🪣', label: active ? t('Feeding time (on your list)') : t('Feeding time'), use: () => useAnimalJobs.getState().startFeeding() });
  for (const e of ENCLOSURES) {
    // the walkway in front of the fence (row A fronts at z -9.5, row B at z -19.5)
    const z = e.z1 + 0.95;
    const todo = active && feed!.targets.includes(e.item) && !(e.item in feed!.done);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useUsable(todo ? { id: `zoo-feed-${e.item}`, x: (e.x0 + e.x1) / 2, z, r: 2.4, icon: '🪣', label: `${t('Feed')}: ${e.item}`, priority: true, use: () => useAnimalJobs.getState().openEnclosure(e.item) } : null);
  }
  return null;
}

/** Farm: milk a cow at the paddock fence, collect eggs at the chicken run. */
export function FarmJobs() {
  const t = useT();
  useUsable({ id: 'farm-milk', x: 126, z: -15.7, r: 1.8, icon: '🥛', label: t('Milk the cow'), use: () => useAnimalJobs.getState().startFarm('milk') });
  useUsable({ id: 'farm-eggs', x: 151.5, z: -15.4, r: 1.8, icon: '🥚', label: t('Collect the eggs'), use: () => useAnimalJobs.getState().startFarm('eggs') });
  return null;
}

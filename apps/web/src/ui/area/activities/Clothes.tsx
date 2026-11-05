import type { AreaContentDto } from '@es/shared';
import { useT } from '../../../i18n';

/** Clothes: the area's own activity (to be built). */
export default function ClothesActivity({ content }: { content: AreaContentDto }) {
  const t = useT();
  return <div className="py-6 text-center text-sm text-gray-500">{t('Coming soon')} · {content.items.length}</div>;
}

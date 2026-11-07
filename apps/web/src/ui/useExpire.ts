import { useEffect, useState } from 'react';

/** True while a message stamped `at` is younger than `ms`; re-renders when it runs out so the message goes away. */
export function useExpire(at: number | null | undefined, ms: number): boolean {
  const [, tick] = useState(0);
  const left = at == null ? 0 : at + ms - Date.now();
  useEffect(() => {
    if (left <= 0) return;
    const id = window.setTimeout(() => tick((n) => n + 1), left + 30);
    return () => window.clearTimeout(id);
  }, [at, left > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  return left > 0;
}

import { useEffect } from 'react';

/**
 * Keeps bottom-anchored UI above the on-screen keyboard. Mobile browsers either shrink the layout
 * viewport (Android default) or only the visual viewport (iOS Safari); we read the visual viewport and
 * publish the covered height as the CSS variable --kb on <html>, used by `bottom: var(--kb)` rules.
 */
export function useKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      const covered = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      root.style.setProperty('--kb', `${covered}px`);
      root.classList.toggle('kb-open', covered > 120);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.removeProperty('--kb');
      root.classList.remove('kb-open');
    };
  }, []);
}

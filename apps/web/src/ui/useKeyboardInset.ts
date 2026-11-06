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
      // what is really visible (iOS keeps 100dvh while the keyboard covers half of it)
      root.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
      // bottom edge of what is visible, in fixed-position coordinates: the chat bar sits right on the keyboard
      root.style.setProperty('--vvbottom', `${Math.round(vv.offsetTop + vv.height)}px`);
      root.classList.toggle('kb-open', covered > 120);
      // iOS scrolls the whole page up to show the focused field, which drags the game and the HUD with it
      if (window.scrollY !== 0 || document.documentElement.scrollTop !== 0) window.scrollTo(0, 0);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.removeProperty('--kb');
      root.style.removeProperty('--vvh');
      root.style.removeProperty('--vvbottom');
      root.classList.remove('kb-open');
    };
  }, []);
}

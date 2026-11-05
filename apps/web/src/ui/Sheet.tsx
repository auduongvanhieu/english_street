import { useRef, type PointerEvent, type ReactNode } from 'react';

/**
 * Modal container: centered card on desktop, bottom sheet on phones (swipe the header down to close).
 * Height is capped with dvh so the on-screen keyboard and browser chrome never push the close button off-screen.
 */
export function Sheet({ children, onClose, wide, label }: { children: ReactNode; onClose?: () => void; wide?: boolean; label: string }) {
  const startY = useRef<number | null>(null);
  const card = useRef<HTMLDivElement>(null);

  function down(e: PointerEvent<HTMLDivElement>) {
    if (!matchMedia('(pointer: coarse)').matches) return;
    startY.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (startY.current === null || !card.current) return;
    const dy = Math.max(0, e.clientY - startY.current);
    card.current.style.transform = `translateY(${dy}px)`;
  }
  function up(e: PointerEvent<HTMLDivElement>) {
    if (startY.current === null || !card.current) return;
    const dy = e.clientY - startY.current;
    startY.current = null;
    card.current.style.transform = '';
    if (dy > 90 && onClose) onClose();
  }

  return (
    <div data-ui className="absolute inset-0 z-30 flex items-end justify-center bg-black/25 sm:items-center sm:p-3" style={{ paddingBottom: 'var(--kb, 0px)' }} role="dialog" aria-label={label}>
      <div ref={card} className={`flex max-h-[88dvh] w-full flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl sm:max-h-[92dvh] sm:rounded-2xl ${wide ? 'sm:max-w-xl' : 'sm:max-w-lg'}`}>
        <div className="flex touch-none justify-center pt-2 sm:hidden" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <div className="h-1.5 w-10 rounded-full bg-gray-300" />
        </div>
        {children}
      </div>
    </div>
  );
}

/** Header strip used inside Sheet; on phones dragging it down also closes the sheet. */
export function SheetHeader({ children }: { children: ReactNode }) {
  return <header className="flex shrink-0 items-start justify-between border-b px-4 py-3 sm:px-5">{children}</header>;
}

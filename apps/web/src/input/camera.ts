/**
 * Third-person camera orbit state, written by pointer gestures on the canvas and read by LocalPlayer.
 * yaw: rotation around the player (radians, 0 = camera behind the player looking down -Z).
 * dist: distance from the player; pitch is derived from dist so zooming in also lowers the camera.
 */
export const cameraOrbit = { yaw: 0, dist: 10, minDist: 5, maxDist: 16 };

const ROTATE_SPEED = 0.006; // radians per CSS pixel
const WHEEL_SPEED = 0.01;

/** Attach drag-to-rotate / pinch-or-wheel-to-zoom to the canvas container. Returns a cleanup function. */
export function attachCameraGestures(el: HTMLElement): () => void {
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchDist = 0;
  let dragging = false;

  const isUi = (t: EventTarget | null) => t instanceof Element && t.closest('[data-ui]') !== null;
  const spread = () => {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  function down(e: PointerEvent) {
    if (isUi(e.target)) return;
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) pinchDist = spread();
    dragging = true;
    el.setPointerCapture?.(e.pointerId);
  }
  function move(e: PointerEvent) {
    const prev = pointers.get(e.pointerId);
    if (!prev || !dragging) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (pointers.size === 1) {
      cameraOrbit.yaw -= (cur.x - prev.x) * ROTATE_SPEED;
    }
    pointers.set(e.pointerId, cur);
    if (pointers.size === 2) {
      const d = spread();
      if (pinchDist > 0) zoom((pinchDist - d) * 0.03);
      pinchDist = d;
    }
  }
  function up(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    if (pointers.size === 0) dragging = false;
  }
  function wheel(e: WheelEvent) {
    if (isUi(e.target)) return;
    zoom(e.deltaY * WHEEL_SPEED);
    e.preventDefault();
  }
  function zoom(delta: number) {
    cameraOrbit.dist = Math.min(cameraOrbit.maxDist, Math.max(cameraOrbit.minDist, cameraOrbit.dist + delta));
  }
  const noMenu = (e: Event) => {
    if (!isUi(e.target)) e.preventDefault();
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', wheel, { passive: false });
  el.addEventListener('contextmenu', noMenu);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    el.removeEventListener('wheel', wheel);
    el.removeEventListener('contextmenu', noMenu);
  };
}

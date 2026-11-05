/**
 * Click-to-move with the mouse: GroundClick sets the target, LocalPlayer walks there (running when it is far)
 * and drops the target on arrival, when blocked, or as soon as a key or the joystick is used.
 */
export const moveTarget = { active: false, x: 0, z: 0, run: false, lastDist: 0, check: 0.5, at: 0, started: false };

export function walkTo(x: number, z: number, from: { x: number; z: number }) {
  const d = Math.hypot(x - from.x, z - from.z);
  Object.assign(moveTarget, { active: true, x, z, run: d > 9, lastDist: d, check: 0.5, at: performance.now(), started: false });
}

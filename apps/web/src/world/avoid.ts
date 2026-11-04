/**
 * Where critters and cyclists are actually drawn this frame (schedule pose + avoidance offset).
 * Written by Critters.tsx / Cyclists.tsx, read by LocalPlayer for collision so you bump into what you see.
 */
export const livePos = new Map<string, { x: number; z: number }>();

export interface Point {
  x: number;
  z: number;
}

/** Radial push away from every point closer than `radius` (strength grows as they get closer), capped at `max`. */
export function pushAway(x: number, z: number, points: Point[], radius: number, max: number, fallbackX = 1, fallbackZ = 0): Point {
  let px = 0;
  let pz = 0;
  for (const p of points) {
    const dx = x - p.x;
    const dz = z - p.z;
    const d = Math.hypot(dx, dz);
    if (d >= radius) continue;
    const s = radius - d;
    if (d < 1e-3) {
      px += fallbackX * s;
      pz += fallbackZ * s;
    } else {
      px += (dx / d) * s;
      pz += (dz / d) * s;
    }
  }
  const len = Math.hypot(px, pz);
  if (len > max) {
    px = (px / len) * max;
    pz = (pz / len) * max;
  }
  return { x: px, z: pz };
}

/**
 * Side-step for something walking with heading `rot` (atan2(dx, dz)): for each point on or near its path,
 * shift perpendicular to the path so it passes at least `radius` from the point. The shift ramps in over
 * `ramp` metres before reaching the point, so the detour starts early instead of popping sideways.
 */
export function sidestep(x: number, z: number, rot: number, points: Point[], radius: number, ramp = 1.2): Point {
  const fx = Math.sin(rot);
  const fz = Math.cos(rot);
  const nx = fz; // left-hand normal of the heading
  const nz = -fx;
  let best = 0;
  for (const p of points) {
    const rx = x - p.x;
    const rz = z - p.z;
    const along = rx * fx + rz * fz;
    const lat = rx * nx + rz * nz;
    if (Math.abs(lat) >= radius) continue;
    const w = Math.min(1, Math.max(0, (radius + ramp - Math.abs(along)) / ramp));
    if (w <= 0) continue;
    const side = Math.abs(lat) < 0.05 ? 1 : Math.sign(lat);
    const need = (side * radius - lat) * w;
    if (Math.abs(need) > Math.abs(best)) best = need;
  }
  return { x: nx * best, z: nz * best };
}

import { BOAT_AREA, BOAT_FLEET, BOAT_MAX_SPEED, type BoatEvent, type BoatSend } from '@es/shared';
import type { MapSchema } from '@colyseus/schema';
import { Boat, type Player } from './schema/StreetState';

/**
 * Hired river boats: the fleet is created moored at the hire piers; a player boards as driver or passenger (must be
 * close), the driver sends the boat's pose (checked: inside the boating area, not faster than a rowing boat), and
 * an empty boat drifts back to its mooring after two idle minutes.
 */
const IDLE_HOME_MS = 120_000;

export class Boats {
  private lastMove = new Map<string, number>();
  private emptySince = new Map<string, number>();

  constructor(
    private boats: MapSchema<Boat>,
    private player: (sid: string) => Player | undefined,
  ) {
    for (const f of BOAT_FLEET) {
      const b = new Boat();
      b.kind = f.kind;
      b.x = f.home.x;
      b.z = f.home.z;
      b.rot = f.home.rot;
      boats.set(f.id, b);
    }
  }

  /** The boat a player is in (and the seat). */
  private seatOf(sid: string): [string, Boat, 'driver' | 'passenger'] | null {
    for (const [id, b] of this.boats) {
      if (b.driver === sid) return [id, b, 'driver'];
      if (b.passenger === sid) return [id, b, 'passenger'];
    }
    return null;
  }

  handle(sid: string, msg: BoatSend): BoatEvent | null {
    if (msg.op === 'board') {
      const b = this.boats.get(msg.id);
      const p = this.player(sid);
      if (!b || !p) return null;
      if (Math.hypot(p.x - b.x, p.z - b.z) > 4) return { op: 'denied', reason: 'far' };
      if (this.seatOf(sid)) this.leave(sid);
      if (msg.seat === 'driver') {
        if (b.driver) return { op: 'denied', reason: 'taken' };
        b.driver = sid;
      } else {
        if (b.passenger || !b.driver) return { op: 'denied', reason: b.passenger ? 'taken' : 'busy' };
        b.passenger = sid;
      }
      this.emptySince.delete(msg.id);
      return null;
    }
    if (msg.op === 'leave') {
      this.leave(sid);
      return null;
    }
    // move: only the driver, inside the area, at rowing speed
    const seat = this.seatOf(sid);
    if (!seat || seat[2] !== 'driver') return null;
    const [id, b] = seat;
    if (![msg.x, msg.z, msg.rot].every(Number.isFinite)) return null;
    const now = Date.now();
    const dt = Math.max(0.05, (now - (this.lastMove.get(id) ?? now - 100)) / 1000);
    this.lastMove.set(id, now);
    let x = Math.max(BOAT_AREA.minX, Math.min(BOAT_AREA.maxX, msg.x));
    let z = Math.max(BOAT_AREA.minZ, Math.min(BOAT_AREA.maxZ, msg.z));
    const d = Math.hypot(x - b.x, z - b.z);
    const max = BOAT_MAX_SPEED * dt * 1.6 + 0.3;
    if (d > max) {
      x = b.x + ((x - b.x) / d) * max;
      z = b.z + ((z - b.z) / d) * max;
    }
    b.x = x;
    b.z = z;
    b.rot = msg.rot;
    return null;
  }

  leave(sid: string) {
    for (const [id, b] of this.boats) {
      if (b.driver === sid) {
        b.driver = '';
        // the passenger cannot row on alone: they take over the oars
        if (b.passenger) {
          b.driver = b.passenger;
          b.passenger = '';
        }
      }
      if (b.passenger === sid) b.passenger = '';
      if (!b.driver && !b.passenger && !this.emptySince.has(id)) this.emptySince.set(id, Date.now());
    }
  }

  /** Once a second: empty boats left out on the water go back to their mooring. */
  tick(now: number) {
    for (const f of BOAT_FLEET) {
      const b = this.boats.get(f.id);
      if (!b || b.driver || b.passenger) continue;
      const since = this.emptySince.get(f.id);
      if (since === undefined) continue;
      if (now - since > IDLE_HOME_MS && (b.x !== f.home.x || b.z !== f.home.z)) {
        b.x = f.home.x;
        b.z = f.home.z;
        b.rot = f.home.rot;
        this.emptySince.delete(f.id);
      }
    }
  }
}

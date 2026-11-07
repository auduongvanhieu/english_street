import { MSG, myFarm, myFarmAt, type FarmEvent } from '@es/shared';

/**
 * "My farm" guard dog chases (a steal while the owner's dog is awake). The API signs a ticket (id, thief, owner,
 * dog speed); here the dog runs from its house at the thief's real position: it catches them (within reach) or
 * they get away (out through the gate / off the farm / time is up). Everyone on that farm sees the dog.
 */
const DOG_HOUSE = { x: 1, z: 9 };
const REACH = 0.9;
const START_DELAY_S = 0.9;
const MAX_S = 25;

export interface ChaseClient {
  sessionId: string;
  send: (type: string, msg: unknown) => void;
}
interface Chase {
  id: string;
  thief: string;
  thiefSession: string;
  owner: string;
  slot: number;
  speed: number;
  x: number;
  z: number;
  t: number;
  sendAcc: number;
}

export class FarmChases {
  private list: Chase[] = [];
  constructor(
    private pos: (session: string) => { x: number; z: number } | null,
    private clients: () => ChaseClient[],
    private report: (id: string, thief: string, result: 'escaped' | 'caught') => void,
  ) {}

  start(c: { id: string; thief: string; thiefSession: string; owner: string; slot: number; speed: number }) {
    if (this.list.some((x) => x.id === c.id || x.thiefSession === c.thiefSession)) return;
    const f = myFarm(c.slot);
    this.list.push({ ...c, x: f.cx + DOG_HOUSE.x, z: f.cz + DOG_HOUSE.z, t: 0, sendAcc: 1 });
  }

  awake() {
    return this.list.length > 0;
  }

  /** Clients standing on a farm slot. */
  private onSlot(slot: number) {
    return this.clients().filter((c) => {
      const p = this.pos(c.sessionId);
      return p && myFarmAt(p.x, p.z) === slot;
    });
  }

  step(dt: number) {
    for (const c of [...this.list]) {
      c.t += dt;
      const p = this.pos(c.thiefSession);
      const f = myFarm(c.slot);
      // gone, out of the gate (north of the fence) or off this farm: got away
      const away = !p || p.z > f.rect.maxZ - 0.2 || myFarmAt(p.x, p.z) !== c.slot || c.t > MAX_S;
      let caught = false;
      if (p && !away && c.t > START_DELAY_S) {
        const dx = p.x - c.x;
        const dz = p.z - c.z;
        const d = Math.hypot(dx, dz);
        if (d <= REACH) caught = true;
        else {
          const k = Math.min(1, (c.speed * dt) / d);
          c.x += dx * k;
          c.z += dz * k;
        }
      }
      c.sendAcc += dt;
      if (c.sendAcc >= 0.1 || away || caught) {
        c.sendAcc = 0;
        const msg: FarmEvent = { op: 'dog', slot: c.slot, x: c.x, z: c.z, run: !away && !caught };
        for (const cl of this.onSlot(c.slot)) cl.send(MSG.FARM, msg);
      }
      if (!away && !caught) continue;
      this.list = this.list.filter((x) => x !== c);
      const result = caught ? 'caught' : 'escaped';
      const end: FarmEvent = { op: 'chase_end', slot: c.slot, result, thief: c.thiefSession };
      for (const cl of this.clients()) if (cl.sessionId === c.thiefSession || this.onSlot(c.slot).includes(cl)) cl.send(MSG.FARM, end);
      this.report(c.id, c.thief, result);
    }
  }
}

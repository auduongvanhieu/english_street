import { FOOTBALL, type SportEvent, type Team } from '@es/shared';
import type { Ball, Match, Player } from './schema/StreetState';

/**
 * Football on the sports park pitch, simulated by the server at 30 Hz while somebody is near the pitch:
 * gravity and bounces, grass friction, the pitch boundary (with the goal mouths open), players dribbling it by
 * walking into it, kicks (validated by distance), goals, kick-offs and 4-minute matches (or first to 5).
 */
const P = FOOTBALL.pitch;
const CX = (P.minX + P.maxX) / 2;
const CZ = (P.minZ + P.maxZ) / 2;
const NEAR = 30; // metres from the pitch centre that wakes the simulation

export class Football {
  private vx = 0;
  private vy = 0;
  private vz = 0;
  private resetAt = 0;
  private lastKicker = '';
  private finalAt = 0;
  private last = new Map<string, { x: number; z: number }>();

  constructor(
    private ball: Ball,
    private match: Match,
    private players: () => Iterable<[string, Player]>,
    private emit: (ev: SportEvent) => void,
  ) {
    this.place();
  }

  private place() {
    this.ball.x = CX;
    this.ball.z = CZ;
    this.ball.y = FOOTBALL.ballR;
    this.vx = this.vy = this.vz = 0;
  }

  /** Is anyone close enough to the pitch to need the simulation? */
  awake() {
    for (const [, p] of this.players()) if (Math.hypot(p.x - CX, p.z - CZ) < NEAR) return true;
    return false;
  }

  kick(sid: string, p: Player, dir: number, power: number) {
    const b = this.ball;
    if (this.resetAt) return;
    if (Math.hypot(p.x - b.x, p.z - b.z) > FOOTBALL.kickReach || p.y > 0.6) return;
    const pw = Math.max(0, Math.min(1, power || 0));
    const speed = 6 + 11 * pw;
    this.vx = Math.sin(dir) * speed;
    this.vz = Math.cos(dir) * speed;
    this.vy = 1.2 + 4.5 * pw * pw;
    this.lastKicker = p.name || sid;
    if (!this.match.endsAt) {
      this.match.endsAt = Date.now() + FOOTBALL.matchMs;
      this.emit({ op: 'kickoff' });
    }
  }

  step(dt: number) {
    const now = Date.now();
    const b = this.ball;
    const m = this.match;
    // full time: announce, then a fresh match
    if (m.endsAt && now > m.endsAt && !this.finalAt) this.final(now);
    if (this.finalAt && now > this.finalAt) {
      this.finalAt = 0;
      m.red = m.blue = 0;
      m.endsAt = 0;
      this.place();
    }
    if (this.resetAt) {
      if (now > this.resetAt) {
        this.resetAt = 0;
        this.place();
      }
      return;
    }
    // dribbling: walking into the ball pushes it along at a bit more than walking speed
    for (const [sid, p] of this.players()) {
      const prev = this.last.get(sid);
      this.last.set(sid, { x: p.x, z: p.z });
      if (!prev || p.y > 0.5) continue;
      const dx = b.x - p.x;
      const dz = b.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.55 || d < 1e-3 || b.y > 0.6) continue;
      const pvx = (p.x - prev.x) / dt;
      const pvz = (p.z - prev.z) / dt;
      const ps = Math.hypot(pvx, pvz);
      if (ps < 0.3) continue;
      const push = Math.max(ps * 1.25, Math.hypot(this.vx, this.vz));
      this.vx = (dx / d) * push;
      this.vz = (dz / d) * push;
      b.x = p.x + (dx / d) * 0.56;
      b.z = p.z + (dz / d) * 0.56;
      this.lastKicker = p.name || sid;
    }
    // flight and rolling
    this.vy -= 9.8 * dt;
    b.y += this.vy * dt;
    if (b.y < FOOTBALL.ballR) {
      b.y = FOOTBALL.ballR;
      this.vy = Math.abs(this.vy) > 1.2 ? -this.vy * 0.45 : 0;
    }
    const onGround = b.y <= FOOTBALL.ballR + 0.01;
    const drag = onGround ? 1.3 : 0.15;
    this.vx *= Math.max(0, 1 - drag * dt);
    this.vz *= Math.max(0, 1 - drag * dt);
    if (Math.hypot(this.vx, this.vz) < 0.05) this.vx = this.vz = 0;
    let nx = b.x + this.vx * dt;
    let nz = b.z + this.vz * dt;
    // goals: crossing an end line inside the mouth, under the bar
    const inMouth = Math.abs(nz - FOOTBALL.goalZ) < FOOTBALL.goalHalf && b.y < FOOTBALL.goalH;
    if (nx < P.minX && inMouth) return this.goal('red');
    if (nx > P.maxX && inMouth) return this.goal('blue');
    // boundary: bounce off the touchlines and the end lines (nets behind the goals)
    if (nz < P.minZ + FOOTBALL.ballR || nz > P.maxZ - FOOTBALL.ballR) {
      this.vz = -this.vz * 0.6;
      nz = Math.max(P.minZ + FOOTBALL.ballR, Math.min(P.maxZ - FOOTBALL.ballR, nz));
    }
    if (nx < P.minX + FOOTBALL.ballR || nx > P.maxX - FOOTBALL.ballR) {
      this.vx = -this.vx * 0.6;
      nx = Math.max(P.minX + FOOTBALL.ballR, Math.min(P.maxX - FOOTBALL.ballR, nx));
    }
    b.x = nx;
    b.z = nz;
  }

  private goal(team: Team) {
    const m = this.match;
    if (team === 'red') m.red += 1;
    else m.blue += 1;
    this.vx = this.vy = this.vz = 0;
    this.ball.x = team === 'red' ? P.minX - 0.6 : P.maxX + 0.6;
    this.ball.z = FOOTBALL.goalZ;
    this.resetAt = Date.now() + 2500;
    this.emit({ op: 'goal', team, red: m.red, blue: m.blue, by: this.lastKicker });
    if (m.red >= FOOTBALL.winGoals || m.blue >= FOOTBALL.winGoals) this.final(Date.now());
  }

  private final(now: number) {
    this.emit({ op: 'final', red: this.match.red, blue: this.match.blue });
    this.finalAt = now + 8000;
    this.resetAt = 0;
  }

  forget(sid: string) {
    this.last.delete(sid);
  }
}

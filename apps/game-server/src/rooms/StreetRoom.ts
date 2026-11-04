import { Room, ServerError, matchMaker, type Client } from 'colyseus';
import {
  INTERACT_RADIUS,
  MSG,
  PROXIMITY_RADIUS,
  SHOUT_COOLDOWN_MS,
  SHOUT_RADIUS,
  STREET_ROOM_MAX_CLIENTS,
  TALK_DROP_RADIUS,
  MAX_JUMP_Y,
  MAIN_ZONE_NAME,
  STREET_ROOM,
  WORLD_BOUNDS,
  ZONE_CODE_RE,
  ZONE_NAME_MAX,
  ZONE_NAME_MIN,
  maskProfanity,
  parseLook,
  HOLDABLE_RE,
  GARDEN_RE,
  PROP_RE,
  type ZoneMeta,
  type InputMessage,
  type JoinOptions,
  type PairMessage,
  type RtcSignal,
  type TalkMessage,
} from '@es/shared';
import { isBetaPass, verifyToken } from '@es/shared/token';
import { Player, StreetState } from './schema/StreetState';

const SPAWN = { x: 0, y: 0, z: 4 };
const BUBBLE_TTL_MS = 5000;
const AVATAR_COOLDOWN_MS = 800;
/** Relay (voice signalling, pair quests) only works between players reasonably close to each other. */
const RELAY_RADIUS = PROXIMITY_RADIUS * 2;

const AUTH_SECRET = process.env.AUTH_SECRET ?? 'dev-secret-change-me';
const BETA_GATE = (process.env.BETA_CODES ?? '').trim().length > 0;

export class StreetRoom extends Room<{ state: StreetState }> {
  maxClients = STREET_ROOM_MAX_CLIENTS;
  /** Pending talk requests: target sessionId -> requester sessionId. */
  private talkRequests = new Map<string, string>();
  private lastShoutAt = new Map<string, number>();
  private lastAvatarAt = new Map<string, number>();
  /** Zone identity (also published as room metadata for the zone list). */
  private zone: ZoneMeta = { name: MAIN_ZONE_NAME, kind: 'main', locked: false };
  /** Private zone code (never in metadata). */
  private code = '';

  /** Closed beta: a player needs a beta pass or a signed-in token (both minted by the API with the shared AUTH_SECRET). */
  static async onAuth(_token: string, options: Partial<JoinOptions>) {
    if (!BETA_GATE) return true;
    if (isBetaPass(AUTH_SECRET, options?.betaPass) || verifyToken(AUTH_SECRET, options?.token)) return true;
    throw new Error('beta_pass_required');
  }

  async onCreate(options: Partial<JoinOptions> = {}) {
    this.setState(new StreetState());
    if (options.zoneKind === 'custom') {
      const name = sanitizeZoneName(options.zoneName);
      if (!name) throw new ServerError(4101, 'zone_name_invalid');
      const code = typeof options.zoneCode === 'string' ? options.zoneCode.trim() : '';
      if (code && !ZONE_CODE_RE.test(code)) throw new ServerError(4102, 'zone_code_invalid');
      this.code = code;
      this.zone = { name, kind: 'custom', locked: !!code };
    } else {
      // Public Main Street rooms are numbered by how many already exist (joinOrCreate spawns the next one when full).
      const mains = (await matchMaker.query({ name: STREET_ROOM })).filter((r) => r.metadata?.kind === 'main').length;
      this.zone = { name: mains === 0 ? MAIN_ZONE_NAME : `${MAIN_ZONE_NAME} ${mains + 1}`, kind: 'main', locked: false };
    }
    await this.setMetadata({ ...this.zone, zoneKind: this.zone.kind });
    console.log(`[street] zone "${this.zone.name}" created (${this.zone.kind}${this.zone.locked ? ', locked' : ''})`);
    this.setPatchRate(50); // 20 Hz state patches

    this.onMessage<InputMessage>(MSG.INPUT, (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || typeof msg !== 'object') return;
      // Server is authoritative: clamp to world bounds. Speed checks can be added later.
      p.x = clamp(Number(msg.x) || 0, WORLD_BOUNDS.minX, WORLD_BOUNDS.maxX);
      p.z = clamp(Number(msg.z) || 0, WORLD_BOUNDS.minZ, WORLD_BOUNDS.maxZ);
      p.y = clamp(Number(msg.y) || 0, 0, MAX_JUMP_Y);
      p.rot = Number(msg.rot) || 0;
      p.anim = typeof msg.anim === 'string' ? msg.anim.slice(0, 16) : 'idle';
      p.voice = msg.voice === true;
      p.shouting = msg.shouting === true;
    });

    // Shout: text heard within SHOUT_RADIUS, rate limited per player.
    this.onMessage<string>(MSG.SHOUT, (client, text) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || typeof text !== 'string') return;
      const now = Date.now();
      if (now - (this.lastShoutAt.get(client.sessionId) ?? 0) < SHOUT_COOLDOWN_MS) return;
      const clean = maskProfanity(text.trim().slice(0, 140));
      if (!clean) return;
      this.lastShoutAt.set(client.sessionId, now);
      p.bubble = `📢 ${clean}`;
      p.bubbleAt = now;
      for (const other of this.clients) {
        const q = this.state.players.get(other.sessionId);
        if (q && dist2(p, q) <= SHOUT_RADIUS * SHOUT_RADIUS) other.send(MSG.CHAT, { from: p.id, pid: p.pid, name: p.name, text: clean, shout: true });
      }
    });

    // New clothes: re-validated into a clean look so a client can only send catalogue values.
    this.onMessage<string>(MSG.AVATAR, (client, json) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || typeof json !== 'string' || json.length > 1024) return;
      const now = Date.now();
      if (now - (this.lastAvatarAt.get(client.sessionId) ?? 0) < AVATAR_COOLDOWN_MS) return;
      this.lastAvatarAt.set(client.sessionId, now);
      p.avatar = JSON.stringify(parseLook(json));
    });

    // Pick up / put down a cat or dog. Critters live on the clients' shared clock, so the server only makes sure
    // that one critter has at most one holder.
    this.onMessage<string>(MSG.HOLD, (client, id) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || typeof id !== 'string') return;
      if (id === '') {
        p.holding = '';
        return;
      }
      if (!HOLDABLE_RE.test(id)) return;
      for (const q of this.state.players.values()) if (q !== p && q.holding === id) return;
      p.holding = id;
    });

    this.onMessage<string>(MSG.PROP, (client, prop) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || typeof prop !== 'string') return;
      p.prop = prop === '' || PROP_RE.test(prop) ? prop : p.prop;
    });

    this.onMessage<string>(MSG.GARDEN, (client, garden) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || typeof garden !== 'string' || garden.length > 120) return;
      if (garden === '' || GARDEN_RE.test(garden)) p.garden = garden;
    });

    // One-to-one talk: the server is the referee (distance, busy state, who is allowed to message whom).
    this.onMessage<TalkMessage>(MSG.TALK, (client, msg) => this.onTalk(client, msg));

    this.onMessage<string>(MSG.CHAT, (client, text) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || typeof text !== 'string') return;
      const clean = maskProfanity(text.trim().slice(0, 140));
      if (!clean) return;
      p.bubble = clean;
      p.bubbleAt = Date.now();
      // Deliver to nearby players only (proximity chat).
      for (const other of this.clients) {
        const q = this.state.players.get(other.sessionId);
        if (!q) continue;
        if (dist2(p, q) <= PROXIMITY_RADIUS * PROXIMITY_RADIUS) {
          other.send(MSG.CHAT, { from: p.id, pid: p.pid, name: p.name, text: clean });
        }
      }
    });

    // WebRTC signalling: forward to one nearby peer, stamping the sender.
    this.onMessage<RtcSignal>(MSG.RTC, (client, msg) => {
      const target = this.relayTarget(client, msg?.to);
      if (!target) return;
      target.send(MSG.RTC, { ...msg, from: client.sessionId });
    });

    // Pair-quest coordination: invitations and transcript relay between two nearby players.
    this.onMessage<PairMessage>(MSG.PAIR, (client, msg) => {
      const target = this.relayTarget(client, msg?.to);
      if (!target) return;
      target.send(MSG.PAIR, { ...msg, from: client.sessionId });
    });

    this.setSimulationInterval(() => {
      this.expireBubbles();
      this.dropDistantTalks();
    }, 1000);
  }

  private onTalk(client: Client, msg: TalkMessage) {
    if (!msg || typeof msg !== 'object' || typeof msg.to !== 'string' || msg.to === client.sessionId) return;
    const me = this.state.players.get(client.sessionId);
    const other = this.state.players.get(msg.to);
    const target = this.clients.find((c) => c.sessionId === msg.to);
    if (!me || !other || !target) return;
    const near = dist2(me, other) <= (PROXIMITY_RADIUS + INTERACT_RADIUS) ** 2;
    switch (msg.type) {
      case 'request': {
        if (!near) return;
        if (me.talkWith || other.talkWith) return client.send(MSG.TALK, { to: msg.to, from: msg.to, type: 'end', reason: 'busy' });
        this.talkRequests.set(msg.to, client.sessionId);
        target.send(MSG.TALK, { to: msg.to, from: client.sessionId, type: 'request', name: me.name });
        return;
      }
      case 'accept': {
        if (this.talkRequests.get(client.sessionId) !== msg.to) return;
        this.talkRequests.delete(client.sessionId);
        if (!near || me.talkWith || other.talkWith) return client.send(MSG.TALK, { to: msg.to, from: msg.to, type: 'end', reason: 'busy' });
        me.talkWith = msg.to;
        other.talkWith = client.sessionId;
        client.send(MSG.TALK, { to: client.sessionId, from: msg.to, type: 'start', name: other.name });
        target.send(MSG.TALK, { to: msg.to, from: client.sessionId, type: 'start', name: me.name });
        console.log(`[street] talk: ${me.name} <-> ${other.name}`);
        return;
      }
      case 'decline': {
        if (this.talkRequests.get(client.sessionId) === msg.to) this.talkRequests.delete(client.sessionId);
        target.send(MSG.TALK, { to: msg.to, from: client.sessionId, type: 'decline' });
        return;
      }
      case 'msg': {
        if (me.talkWith !== msg.to || typeof msg.text !== 'string') return;
        const clean = maskProfanity(msg.text.trim().slice(0, 300));
        if (!clean) return;
        target.send(MSG.TALK, { to: msg.to, from: client.sessionId, type: 'msg', text: clean });
        return;
      }
      case 'typing': {
        if (me.talkWith === msg.to) target.send(MSG.TALK, { to: msg.to, from: client.sessionId, type: 'typing' });
        return;
      }
      case 'end': {
        if (me.talkWith === msg.to) this.endTalk(client.sessionId, 'left');
        return;
      }
    }
  }

  /** End the talk `sessionId` is in (if any) and tell both sides. */
  private endTalk(sessionId: string, reason: 'left' | 'distance' | 'busy') {
    const me = this.state.players.get(sessionId);
    const otherId = me?.talkWith;
    if (!me || !otherId) return;
    const other = this.state.players.get(otherId);
    me.talkWith = '';
    if (other) other.talkWith = '';
    for (const [a, b] of [[sessionId, otherId], [otherId, sessionId]] as const) {
      this.clients.find((c) => c.sessionId === a)?.send(MSG.TALK, { to: a, from: b, type: 'end', reason });
    }
  }

  private dropDistantTalks() {
    this.state.players.forEach((p: Player) => {
      if (!p.talkWith) return;
      const q = this.state.players.get(p.talkWith);
      if (!q || dist2(p, q) > TALK_DROP_RADIUS * TALK_DROP_RADIUS) this.endTalk(p.id, 'distance');
    });
  }

  onJoin(client: Client, options: Partial<JoinOptions>) {
    if (this.code && options?.zoneCode !== this.code) throw new ServerError(4103, 'zone_code_required');
    const p = new Player();
    p.id = client.sessionId;
    p.pid = typeof options?.playerId === 'string' ? options.playerId.slice(0, 64) : '';
    p.name = sanitizeName(options?.name) ?? `Guest-${client.sessionId.slice(0, 4)}`;
    p.avatar = JSON.stringify(parseLook(typeof options?.avatar === 'string' ? options.avatar.slice(0, 1024) : '{}'));
    p.x = SPAWN.x + (Math.random() - 0.5) * 4;
    p.y = SPAWN.y;
    p.z = SPAWN.z + (Math.random() - 0.5) * 2;
    this.state.players.set(client.sessionId, p);
    client.send(MSG.TIME, { now: Date.now() });
    client.send(MSG.ZONE, { id: this.roomId, ...this.zone });
    console.log(`[street] ${p.name} joined (${this.clients.length}/${this.maxClients})`);
  }

  onLeave(client: Client) {
    const p = this.state.players.get(client.sessionId);
    this.endTalk(client.sessionId, 'left');
    this.talkRequests.delete(client.sessionId);
    this.lastShoutAt.delete(client.sessionId);
    this.lastAvatarAt.delete(client.sessionId);
    this.state.players.delete(client.sessionId);
    console.log(`[street] ${p?.name ?? client.sessionId} left`);
  }

  /** Resolve a relay target: must exist, not be the sender, and be within RELAY_RADIUS. */
  private relayTarget(from: Client, to: unknown): Client | null {
    if (typeof to !== 'string' || to === from.sessionId) return null;
    const a = this.state.players.get(from.sessionId);
    const b = this.state.players.get(to);
    if (!a || !b || dist2(a, b) > RELAY_RADIUS * RELAY_RADIUS) return null;
    return this.clients.find((c) => c.sessionId === to) ?? null;
  }

  private expireBubbles() {
    const now = Date.now();
    this.state.players.forEach((p: Player) => {
      if (p.bubble && now - p.bubbleAt > BUBBLE_TTL_MS) p.bubble = '';
    });
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
function dist2(a: Player, b: Player) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}
function sanitizeName(n: unknown): string | undefined {
  if (typeof n !== 'string') return undefined;
  const s = maskProfanity(n.replace(/[^\w\- ]/g, '').trim().slice(0, 20));
  return s.length >= 2 ? s : undefined;
}

/** Zone names: trimmed, 3–24 chars, letters/digits/spaces/basic punctuation, no profanity. */
function sanitizeZoneName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length < ZONE_NAME_MIN || name.length > ZONE_NAME_MAX) return null;
  if (!/^[\p{L}\p{N} '\-!?.]+$/u.test(name)) return null;
  if (maskProfanity(name) !== name) return null;
  return name;
}

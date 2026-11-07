import { Room, ServerError, matchMaker, type Client } from 'colyseus';
import {
  INTERACT_RADIUS,
  MSG,
  PROXIMITY_RADIUS,
  SHOUT_COOLDOWN_MS,
  SHOUT_RADIUS,
  STREET_ROOM_MAX_CLIENTS,
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
  BUS_RE,
  PROP_RE,
  DM_MAX,
  FRIENDS_MAX,
  INTERIOR_BOUNDS,
  MY_FARM_SLOTS,
  myFarmAt,
  type FarmEvent,
  type FarmSend,
  type TeamSend,
  MAPLE_HILL,
  MAPLE_HILL_TOP,
  hotelRoomAt,
  inRect,
  isHotelRoom,
  type HotelEvent,
  type BoatSend,
  type PlayerSettings,
  type SportEvent,
  type SportSend,
  type HotelSend,
  GROUP_CHAT_MAX,
  GROUP_MAX,
  GROUP_NAME_MAX,
  type FriendEvent,
  type FriendOnline,
  type FriendSend,
  type GroupEvent,
  type GroupSend,
  type DmReceived,
  type DmSend,
  type ZoneMeta,
  type InputMessage,
  type JoinOptions,
  type PairMessage,
  type RtcSignal,
  type TalkMessage,
  CLOSE_BANNED,
  CLOSE_KICKED,
} from '@es/shared';
import { isBetaPass, isHumanPass, verifyToken } from '@es/shared/token';
import { FarmChases, type ChaseClient } from './farmChase';
import { WordRelay } from './teamGames';
import { Group, Player, StreetState } from './schema/StreetState';
import { Football } from './football';
import { Boats } from './boats';

/** Minimum gap between two private messages from one player. */
const DM_COOLDOWN_MS = 600;
import { accountStatus, addPlay, isMuted, live, mutes, reportChase, sampleHeat } from '../admin';

/** Every open room (for the admin site: online list, kicks, notices). */
export const ROOMS = new Set<StreetRoom>();
/** Heat-map sample interval. */
const HEAT_EVERY_MS = 30_000;
/** Shown to a muted player who tries to chat. */
const MUTED_TEXT = 'A moderator has muted your chat for now.';

const SPAWN = { x: 0, y: 0, z: 4 };
const BUBBLE_TTL_MS = 5000;
const AVATAR_COOLDOWN_MS = 800;
/** Relay (voice signalling, pair quests) only works between players reasonably close to each other. */
const RELAY_RADIUS = PROXIMITY_RADIUS * 2;

const AUTH_SECRET = process.env.AUTH_SECRET ?? 'dev-secret-change-me';
const BETA_GATE = (process.env.BETA_CODES ?? '').trim().length > 0;
/** Guests (not signed in) playing at the same time from one IP, over all rooms of this server (limit: live.maxGuestsPerIp). */
const guestsByIp = new Map<string, number>();

/** What onAuth hands to onJoin (client.auth). */
interface JoinAuth {
  ip: string;
  guest: boolean;
  /** Account id (signed in) or the guest's player id. */
  uid: string;
  mutedUntil: number;
}

/** Refuse banned accounts / guest ids (the API is the source of truth; fails open when it is down). */
async function checkBan(uid: string, tokenVersion?: number) {
  const s = await accountStatus(uid);
  if (s?.banned) throw new Error('account_banned');
  // signed out everywhere by an admin
  if (s && tokenVersion !== undefined && tokenVersion !== s.tokenVersion) throw new Error('signed_out');
  return s?.mutedUntil ?? 0;
}

/** How far from the player a pet may be put down (reaching over a low fence). */
const DROP_REACH = 2.5;

export class StreetRoom extends Room<{ state: StreetState }> {
  maxClients = STREET_ROOM_MAX_CLIENTS;
  /** Pending talk requests: target sessionId -> requester sessionId. */
  private talkRequests = new Map<string, { from: string; call: boolean }>();
  private lastShoutAt = new Map<string, number>();
  private lastDmAt = new Map<string, number>();
  /** Pending group invitations: invited sessionId -> group id + who invited. */
  private groupInvites = new Map<string, { group: string; from: string; at: number }>();
  private lastGroupChatAt = new Map<string, number>();
  private football: Football | null = null;
  private boatsSim: Boats | null = null;
  /** Hotel: who knocked on whose door (visitor sessionId -> room), so only invited visitors get let in. */
  private knocks = new Map<string, { room: number; at: number }>();
  /** Friend presence queries / pings per session (rate limits). */
  private lastPresenceAt = new Map<string, number>();
  private lastPingAt = new Map<string, number>();
  private lastAvatarAt = new Map<string, number>();
  /** Zone identity (also published as room metadata for the zone list). */
  private zone: ZoneMeta = { name: MAIN_ZONE_NAME, kind: 'main', locked: false };
  /** Private zone code (never in metadata). */
  private code = '';

  /**
   * Every player is a signed-in account (token) or a guest who passed a captcha (human pass); in the closed
   * beta guests also need a beta pass. All are minted by the API with the shared AUTH_SECRET.
   */
  static async onAuth(_token: string, options: Partial<JoinOptions>, context?: { ip?: string }): Promise<JoinAuth> {
    const ip = context?.ip ?? 'unknown';
    const signed = verifyToken(AUTH_SECRET, options?.token);
    if (signed && !signed.sub.includes(':') && !isBetaPass(AUTH_SECRET, options?.token) && !isHumanPass(AUTH_SECRET, options?.token)) {
      return { ip, guest: false, uid: signed.sub, mutedUntil: await checkBan(signed.sub, Number(signed.v ?? 0)) };
    }
    if (BETA_GATE && !isBetaPass(AUTH_SECRET, options?.betaPass)) throw new Error('beta_pass_required');
    if (!isHumanPass(AUTH_SECRET, options?.humanPass)) throw new Error('human_check_required');
    // refuse early (before a seat is reserved) when this network already has its share of guests
    if ((guestsByIp.get(ip) ?? 0) >= live.maxGuestsPerIp) throw new Error('too_many_guests');
    const uid = typeof options?.playerId === 'string' ? options.playerId.slice(0, 64) : '';
    return { ip, guest: true, uid, mutedUntil: await checkBan(uid) };
  }

  /** Guests counted per IP while they are in a room (released in onLeave). */
  private countedGuests = new Map<string, string>();

  /** sessionId → join info (account id, IP, join time) for the admin site. */
  private who = new Map<string, JoinAuth & { at: number }>();

  async onCreate(options: Partial<JoinOptions> = {}) {
    this.setState(new StreetState());
    ROOMS.add(this);
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
      const mx = Number(msg.x) || 0;
      const mz = Number(msg.z) || 0;
      // interiors (hotel rooms, …) live off the street map, in their own box
      const box = inRect(INTERIOR_BOUNDS, mx, mz) ? INTERIOR_BOUNDS : WORLD_BOUNDS;
      p.x = clamp(mx, box.minX, box.maxX);
      p.z = clamp(mz, box.minZ, box.maxZ);
      p.y = clamp(Number(msg.y) || 0, -0.6, MAX_JUMP_Y + (inRect(MAPLE_HILL, p.x, p.z) ? MAPLE_HILL_TOP : 0)); // below 0: sitting low in a boat; on Maple Hill the ground rises
      p.rot = Number(msg.rot) || 0;
      p.anim = typeof msg.anim === 'string' ? msg.anim.slice(0, 16) : 'idle';
      p.voice = msg.voice === true;
      p.shouting = msg.shouting === true;
    });

    // Shout: text heard within SHOUT_RADIUS, rate limited per player.
    this.onMessage<string>(MSG.SHOUT, (client, text) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || typeof text !== 'string' || this.muted(client)) return;
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
    // Put down with '' (just in front of the player) or '@x,z' (a spot within reach, e.g. over a low fence).
    this.onMessage<string>(MSG.HOLD, (client, id) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || typeof id !== 'string') return;
      if (id === '' || id.startsWith('@')) {
        if (p.holding) {
          const [x, z] = id ? id.slice(1).split(',').map(Number) : [NaN, NaN];
          const ok = Number.isFinite(x) && Number.isFinite(z) && Math.hypot(x! - p.x, z! - p.z) <= DROP_REACH;
          this.putDown(p.holding, ok ? x! : p.x + Math.sin(p.rot) * 0.75, ok ? z! : p.z + Math.cos(p.rot) * 0.75);
        }
        p.holding = '';
        return;
      }
      if (!HOLDABLE_RE.test(id)) return;
      for (const q of this.state.players.values()) if (q !== p && q.holding === id) return;
      p.holding = id;
      this.state.spots.delete(id);
    });

    this.onMessage<string>(MSG.PROP, (client, prop) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || typeof prop !== 'string') return;
      p.prop = prop === '' || PROP_RE.test(prop) ? prop : p.prop;
    });

    // team games: Word Relay
    this.onMessage<TeamSend>(MSG.TEAM, (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !msg || typeof msg !== 'object') return;
      if (msg.op === 'hello') return this.relay.hello((m) => client.send(MSG.TEAM, m));
      this.relay.onMessage(client.sessionId, p.name, msg);
    });

    // "My farm": a slot in the farm grid per farm owner, for as long as somebody is there
    this.onMessage<FarmSend>(MSG.FARM, (client, msg) => {
      if (!msg) return;
      if (msg.op === 'chase') {
        // the API's ticket: this player stole on a farm with its dog awake
        const p = this.state.players.get(client.sessionId);
        const tk = verifyToken(AUTH_SECRET, msg.ticket);
        if (!p || !tk || tk.sub !== 'chase' || tk.thief !== p.pid) return;
        const owner = String(tk.owner);
        const slot = [...this.farmSlots].find(([, r]) => r.owner === owner)?.[0];
        if (slot === undefined) return;
        this.chases.start({ id: String(tk.id), thief: p.pid, thiefSession: client.sessionId, owner, slot, speed: Math.min(8, Number(tk.speed) || 4) });
        for (const c of this.clients) if (this.state.players.get(c.sessionId)?.pid === owner && c !== client) c.send(MSG.FARM, { op: 'alarm', thief: p.name } satisfies FarmEvent);
        return;
      }
      if (msg.op !== 'slot' || typeof msg.owner !== 'string' || msg.owner.length > 64) return;
      client.send(MSG.FARM, { op: 'slot', owner: msg.owner, slot: this.farmSlot(msg.owner) } satisfies FarmEvent);
    });

    this.onMessage<string>(MSG.GARDEN, (client, garden) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || typeof garden !== 'string' || garden.length > 120) return;
      if (garden === '' || GARDEN_RE.test(garden)) p.garden = garden;
    });

    this.onMessage<string>(MSG.BUS, (client, tag) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || typeof tag !== 'string' || tag.length > 40) return;
      if (tag === '' || BUS_RE.test(tag)) p.bus = tag;
    });

    // One-to-one talk: the server is the referee (distance, busy state, who is allowed to message whom).
    this.onMessage<TalkMessage>(MSG.TALK, (client, msg) => this.onTalk(client, msg));

    // Private message at any distance (players find each other with it): rate limited, profanity masked.
    this.onMessage<DmSend>(MSG.DM, (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !msg || typeof msg.to !== 'string' || typeof msg.text !== 'string' || msg.to === client.sessionId || this.muted(client)) return;
      const target = this.clients.find((c) => c.sessionId === msg.to);
      if (!target) return;
      const now = Date.now();
      if (now - (this.lastDmAt.get(client.sessionId) ?? 0) < DM_COOLDOWN_MS) return;
      const clean = maskProfanity(msg.text.trim().slice(0, DM_MAX));
      if (!clean) return;
      this.lastDmAt.set(client.sessionId, now);
      target.send(MSG.DM, { from: client.sessionId, name: p.name, text: clean } satisfies DmReceived);
    });

    // Groups: small parties in this zone with their own chat and voice call (members = players with p.group).
    this.onMessage<GroupSend>(MSG.GROUP, (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !msg || typeof msg !== 'object') return;
      switch (msg.op) {
        case 'create': {
          if (p.group) this.leaveGroup(client.sessionId);
          const raw = typeof msg.name === 'string' ? maskProfanity(msg.name.trim().slice(0, GROUP_NAME_MAX)) : '';
          const g = new Group();
          g.id = `g${Math.random().toString(36).slice(2, 9)}`;
          g.name = raw || `${p.name}'s group`.slice(0, GROUP_NAME_MAX + 8);
          g.owner = client.sessionId;
          this.state.groups.set(g.id, g);
          p.group = g.id;
          if (typeof msg.invite === 'string') this.inviteToGroup(client, msg.invite);
          return;
        }
        case 'invite':
          this.inviteToGroup(client, msg.to);
          return;
        case 'accept':
        case 'decline': {
          const inv = this.groupInvites.get(client.sessionId);
          if (!inv || inv.group !== msg.group) return;
          this.groupInvites.delete(client.sessionId);
          const g = this.state.groups.get(inv.group);
          const inviter = this.clients.find((c) => c.sessionId === inv.from);
          if (msg.op === 'decline' || !g) {
            inviter?.send(MSG.GROUP, { op: 'declined', by: client.sessionId, byName: p.name } satisfies GroupEvent);
            return;
          }
          if (this.groupSize(g.id) >= GROUP_MAX) return client.send(MSG.GROUP, { op: 'full' } satisfies GroupEvent);
          if (p.group) this.leaveGroup(client.sessionId);
          p.group = g.id;
          this.toGroup(g.id, { op: 'joined', who: client.sessionId, name: p.name });
          return;
        }
        case 'leave':
          this.leaveGroup(client.sessionId);
          return;
        case 'chat': {
          if (!p.group || typeof msg.text !== 'string' || this.muted(client)) return;
          const now = Date.now();
          if (now - (this.lastGroupChatAt.get(client.sessionId) ?? 0) < DM_COOLDOWN_MS) return;
          const clean = maskProfanity(msg.text.trim().slice(0, GROUP_CHAT_MAX));
          if (!clean) return;
          this.lastGroupChatAt.set(client.sessionId, now);
          this.toGroup(p.group, { op: 'chat', from: client.sessionId, name: p.name, text: clean, at: now });
          return;
        }
        case 'call':
          p.groupCall = !!msg.on && !!p.group;
          return;
      }
    });

    // Sports park football: kicks (validated by distance) and teams; the ball runs at 30 Hz near the pitch.
    this.football = new Football(this.state.ball, this.state.match, () => this.state.players.entries(), (ev) => this.broadcast(MSG.SPORT, ev satisfies SportEvent));
    this.onMessage<SportSend>(MSG.SPORT, (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !msg || typeof msg !== 'object') return;
      if (msg.op === 'kick' && typeof msg.dir === 'number' && Number.isFinite(msg.dir)) this.football!.kick(client.sessionId, p, msg.dir, Number(msg.power));
      else if (msg.op === 'team') p.team = msg.team === 'red' || msg.team === 'blue' ? msg.team : '';
    });

    // River boats: board / leave / steer (the ferry runs on the shared clock, no messages).
    this.boatsSim = new Boats(this.state.boats, (sid) => this.state.players.get(sid));
    this.onMessage<BoatSend>(MSG.BOAT, (client, msg) => {
      if (!msg || typeof msg !== 'object' || typeof msg.op !== 'string') return;
      const ev = this.boatsSim!.handle(client.sessionId, msg);
      if (ev) client.send(MSG.BOAT, ev);
    });

    // Hotel doors: knock from the corridor, the guests inside the room (by position) answer.
    this.onMessage<HotelSend>(MSG.HOTEL, (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !msg || typeof msg !== 'object') return;
      const now = Date.now();
      if (msg.op === 'knock') {
        if (!isHotelRoom(msg.room)) return;
        const last = this.knocks.get(client.sessionId);
        if (last && now - last.at < 2000) return;
        this.knocks.set(client.sessionId, { room: msg.room, at: now });
        let anyone = false;
        this.state.players.forEach((q: Player, sid: string) => {
          if (sid === client.sessionId || hotelRoomAt(q.x, q.z) !== msg.room) return;
          anyone = true;
          this.clients.find((c) => c.sessionId === sid)?.send(MSG.HOTEL, { op: 'knock', from: client.sessionId, name: p.name, room: msg.room } satisfies HotelEvent);
        });
        if (!anyone) client.send(MSG.HOTEL, { op: 'empty', room: msg.room } satisfies HotelEvent);
      } else if (msg.op === 'answer') {
        if (typeof msg.to !== 'string') return;
        const room = hotelRoomAt(p.x, p.z);
        const k = this.knocks.get(msg.to);
        // only someone who is in that room can answer, and only a recent knock on it
        if (!room || !k || k.room !== room || now - k.at > 60_000) return;
        if (msg.open) this.knocks.delete(msg.to);
        this.clients.find((c) => c.sessionId === msg.to)?.send(MSG.HOTEL, { op: 'answer', room, open: !!msg.open, name: p.name } satisfies HotelEvent);
      }
    });

    // Friends (the list itself lives in the API): who is online in any zone, and live "check your requests" pings.
    this.onMessage<FriendSend>(MSG.FRIEND, (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !msg || typeof msg !== 'object') return;
      const now = Date.now();
      if (msg.op === 'presence') {
        if (!Array.isArray(msg.pids) || now - (this.lastPresenceAt.get(client.sessionId) ?? 0) < 2000) return;
        this.lastPresenceAt.set(client.sessionId, now);
        const want = new Set(msg.pids.filter((x): x is string => typeof x === 'string' && x.length >= 8).slice(0, FRIENDS_MAX));
        const online: FriendOnline[] = [];
        for (const r of ROOMS) {
          const z = r.zoneMeta();
          r.state.players.forEach((q: Player, sid: string) => {
            if (q.pid && want.has(q.pid)) online.push({ pid: q.pid, name: q.name, zoneId: r.roomId, zone: z.name, locked: z.locked, sessionId: sid });
          });
        }
        client.send(MSG.FRIEND, { op: 'presence', online } satisfies FriendEvent);
      } else if (msg.op === 'ping') {
        if (typeof msg.pid !== 'string' || (msg.kind !== 'request' && msg.kind !== 'accepted') || !p.pid) return;
        if (now - (this.lastPingAt.get(client.sessionId) ?? 0) < 1000) return;
        this.lastPingAt.set(client.sessionId, now);
        for (const r of ROOMS)
          r.state.players.forEach((q: Player, sid: string) => {
            if (q.pid === msg.pid) r.clients.find((c) => c.sessionId === sid)?.send(MSG.FRIEND, { op: 'ping', kind: msg.kind, fromPid: p.pid, name: p.name } satisfies FriendEvent);
          });
      }
    });

    this.onMessage<string>(MSG.CHAT, (client, text) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || typeof text !== 'string' || this.muted(client)) return;
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

    // 30 Hz: the football (only while somebody is near the pitch); once a second: chat bubbles and the heat map
    let lastHeat = Date.now();
    let lastSecond = Date.now();
    let lastPlay = Date.now();
    this.setSimulationInterval((dtMs) => {
      if (this.football!.awake()) this.football!.step(Math.min(0.1, dtMs / 1000));
      if (this.chases.awake()) this.chases.step(Math.min(0.1, dtMs / 1000));
      const now = Date.now();
      if (now - lastSecond < 1000) return;
      if (now - lastPlay >= 60_000) {
        lastPlay = now;
        this.tallyPlay(now);
      }
      lastSecond = now;
      this.expireBubbles();
      this.relay.tick(now);
      this.boatsSim?.tick(now);
      if (now - lastHeat >= HEAT_EVERY_MS) {
        lastHeat = now;
        this.state.players.forEach((p: Player) => sampleHeat(p.x, p.z));
      }
    }, 1000 / 30);
  }

  onDispose() {
    ROOMS.delete(this);
  }

  /** True (and tells the player) when a moderator muted them. */
  private muted(client: Client) {
    const uid = this.who.get(client.sessionId)?.uid ?? '';
    if (!uid || !isMuted(uid)) return false;
    client.send(MSG.NOTICE, { text: MUTED_TEXT, level: 'warning', code: 'muted' });
    return true;
  }

  // ---------------------------------------------------------------- admin site
  zoneName() {
    return this.zone.name;
  }
  /** Players in this room for the online list (IP shortened). */
  listPlayers() {
    return this.clients.map((c) => {
      const p = this.state.players.get(c.sessionId);
      const w = this.who.get(c.sessionId);
      return { sessionId: c.sessionId, uid: w?.uid ?? '', guest: w?.guest ?? true, name: p?.name ?? '', x: Math.round(p?.x ?? 0), z: Math.round(p?.z ?? 0), ip: shortIp(w?.ip ?? ''), since: w?.at ?? 0, room: this.roomId, zone: this.zone.name };
    });
  }
  /** Remove every client of an account / guest id. Returns how many left. */
  kick(uid: string, reason: string, banned = false) {
    let n = 0;
    for (const c of [...this.clients]) {
      if (this.who.get(c.sessionId)?.uid !== uid) continue;
      c.send(MSG.NOTICE, { text: reason, level: 'warning', code: banned ? 'banned' : 'kicked' });
      c.leave(banned ? CLOSE_BANNED : CLOSE_KICKED, reason);
      n += 1;
    }
    return n;
  }
  /** Send a message to every open game of a user (by account / guest id). */
  sendToUser(uid: string, type: string, payload: unknown) {
    let n = 0;
    for (const c of this.clients) {
      if (this.who.get(c.sessionId)?.uid !== uid) continue;
      c.send(type, payload);
      n += 1;
    }
    return n;
  }
  /** Admin changed this player's in-game settings: send them to every open game of theirs. */
  /** Play time: seconds each player has been here since the last tally (reported to the API by admin.ts). */
  private playSince = new Map<string, { pid: string; at: number; started: boolean }>();
  private tallyPlay(now: number, only?: string) {
    for (const [sid, t] of this.playSince) {
      if (only && sid !== only) continue;
      addPlay(t.pid, (now - t.at) / 1000, !t.started);
      t.at = now;
      t.started = true;
    }
  }

  /** The player renamed themselves (or an admin did): new name tag at once. */
  renameUser(uid: string, name: string) {
    const clean = sanitizeName(name);
    if (!clean) return 0;
    let n = 0;
    for (const c of this.clients) {
      if (this.who.get(c.sessionId)?.uid !== uid) continue;
      const p = this.state.players.get(c.sessionId);
      if (p) p.name = clean;
      n += 1;
    }
    return n;
  }
  pushSettings(uid: string, settings: PlayerSettings) {
    let n = 0;
    for (const c of this.clients) {
      if (this.who.get(c.sessionId)?.uid !== uid) continue;
      c.send(MSG.SETTINGS, settings);
      n += 1;
    }
    return n;
  }
  notice(text: string, level: 'info' | 'warning') {
    this.broadcast(MSG.NOTICE, { text, level, code: 'announcement' });
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
        const call = msg.call === true;
        if (!near && !call) return;
        if (me.talkWith || other.talkWith) return client.send(MSG.TALK, { to: msg.to, from: msg.to, type: 'end', reason: 'busy' });
        this.talkRequests.set(msg.to, { from: client.sessionId, call });
        target.send(MSG.TALK, { to: msg.to, from: client.sessionId, type: 'request', name: me.name, call });
        return;
      }
      case 'accept': {
        const req = this.talkRequests.get(client.sessionId);
        if (req?.from !== msg.to) return;
        this.talkRequests.delete(client.sessionId);
        if ((!near && !req.call) || me.talkWith || other.talkWith) return client.send(MSG.TALK, { to: msg.to, from: msg.to, type: 'end', reason: 'busy' });
        me.talkWith = msg.to;
        other.talkWith = client.sessionId;
        client.send(MSG.TALK, { to: client.sessionId, from: msg.to, type: 'start', name: other.name, call: req.call });
        target.send(MSG.TALK, { to: msg.to, from: client.sessionId, type: 'start', name: me.name, call: req.call });
        console.log(`[street] ${req.call ? 'call' : 'talk'}: ${me.name} <-> ${other.name}`);
        return;
      }
      case 'decline': {
        if (this.talkRequests.get(client.sessionId)?.from === msg.to) this.talkRequests.delete(client.sessionId);
        target.send(MSG.TALK, { to: msg.to, from: client.sessionId, type: 'decline' });
        return;
      }
      case 'msg': {
        if (me.talkWith !== msg.to || typeof msg.text !== 'string' || this.muted(client)) return;
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
        else if (this.talkRequests.get(msg.to)?.from === client.sessionId) {
          // the caller hung up before an answer
          this.talkRequests.delete(msg.to);
          target.send(MSG.TALK, { to: msg.to, from: client.sessionId, type: 'end', reason: 'left' });
        }
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

  onJoin(client: Client, options: Partial<JoinOptions>) {
    if (this.code && options?.zoneCode !== this.code) throw new ServerError(4103, 'zone_code_required');
    const auth = client.auth as JoinAuth | undefined;
    if (auth?.guest) {
      const n = guestsByIp.get(auth.ip) ?? 0;
      if (n >= live.maxGuestsPerIp) throw new ServerError(4104, 'too_many_guests');
      guestsByIp.set(auth.ip, n + 1);
      this.countedGuests.set(client.sessionId, auth.ip);
    }
    if (auth) {
      this.who.set(client.sessionId, { ...auth, at: Date.now() });
      if (auth.uid && auth.mutedUntil > Date.now()) mutes.set(auth.uid, auth.mutedUntil);
    }
    const p = new Player();
    p.id = client.sessionId;
    p.pid = typeof options?.playerId === 'string' ? options.playerId.slice(0, 64) : '';
    p.name = sanitizeName(options?.name) ?? `Guest-${client.sessionId.slice(0, 4)}`;
    p.avatar = JSON.stringify(parseLook(typeof options?.avatar === 'string' ? options.avatar.slice(0, 1024) : '{}'));
    p.x = SPAWN.x + (Math.random() - 0.5) * 4;
    p.y = SPAWN.y;
    p.z = SPAWN.z + (Math.random() - 0.5) * 2;
    this.state.players.set(client.sessionId, p);
    // accounts by their verified id, guests by the id their browser keeps
    const playId = auth?.uid || p.pid;
    if (playId) this.playSince.set(client.sessionId, { pid: playId, at: Date.now(), started: false });
    client.send(MSG.TIME, { now: Date.now() });
    client.send(MSG.ZONE, { id: this.roomId, ...this.zone });
    console.log(`[street] ${p.name} joined (${this.clients.length}/${this.maxClients})`);
  }

  onLeave(client: Client) {
    this.relay.onMessage(client.sessionId, '', { op: 'leave' });
    const ip = this.countedGuests.get(client.sessionId);
    if (ip !== undefined) {
      this.countedGuests.delete(client.sessionId);
      const n = (guestsByIp.get(ip) ?? 1) - 1;
      if (n > 0) guestsByIp.set(ip, n);
      else guestsByIp.delete(ip);
    }
    this.who.delete(client.sessionId);
    this.tallyPlay(Date.now(), client.sessionId);
    this.playSince.delete(client.sessionId);
    const p = this.state.players.get(client.sessionId);
    this.endTalk(client.sessionId, 'left');
    this.talkRequests.delete(client.sessionId);
    this.lastShoutAt.delete(client.sessionId);
    this.lastDmAt.delete(client.sessionId);
    this.leaveGroup(client.sessionId);
    this.groupInvites.delete(client.sessionId);
    this.lastGroupChatAt.delete(client.sessionId);
    this.lastPresenceAt.delete(client.sessionId);
    this.lastPingAt.delete(client.sessionId);
    this.knocks.delete(client.sessionId);
    this.football?.forget(client.sessionId);
    this.boatsSim?.leave(client.sessionId);
    this.lastAvatarAt.delete(client.sessionId);
    // a pet in their arms stays where they were standing
    if (p?.holding) this.putDown(p.holding, p.x + Math.sin(p.rot) * 0.75, p.z + Math.cos(p.rot) * 0.75);
    this.state.players.delete(client.sessionId);
    console.log(`[street] ${p?.name ?? client.sessionId} left`);
  }

  private putDown(id: string, x: number, z: number) {
    this.state.spots.set(id, `${x.toFixed(2)},${z.toFixed(2)},${Date.now()}`);
  }

  /** Resolve a relay target: must exist, not be the sender, and be within RELAY_RADIUS. */
  /** Zone identity for friend presence. */
  zoneMeta(): ZoneMeta {
    return this.zone;
  }

  private inviteToGroup(client: Client, to: unknown) {
    const p = this.state.players.get(client.sessionId);
    if (!p?.group || typeof to !== 'string' || to === client.sessionId) return;
    const q = this.state.players.get(to);
    const target = this.clients.find((c) => c.sessionId === to);
    if (!q || !target || q.group === p.group) return;
    if (this.groupSize(p.group) >= GROUP_MAX) return client.send(MSG.GROUP, { op: 'full' } satisfies GroupEvent);
    const g = this.state.groups.get(p.group)!;
    this.groupInvites.set(to, { group: g.id, from: client.sessionId, at: Date.now() });
    target.send(MSG.GROUP, { op: 'invite', group: g.id, name: g.name, from: client.sessionId, fromName: p.name } satisfies GroupEvent);
  }

  private groupSize(id: string) {
    let n = 0;
    this.state.players.forEach((q: Player) => void (q.group === id && n++));
    return n;
  }

  /** Send a group event to every member. */
  private toGroup(id: string, ev: GroupEvent) {
    for (const c of this.clients) if (this.state.players.get(c.sessionId)?.group === id) c.send(MSG.GROUP, ev);
  }

  /** Take a player out of their group: tell the others, hand the group on, drop it when empty. */
  private leaveGroup(sessionId: string) {
    const p = this.state.players.get(sessionId);
    if (!p?.group) return;
    const id = p.group;
    p.group = '';
    p.groupCall = false;
    const g = this.state.groups.get(id);
    if (!g) return;
    const left: string[] = [];
    this.state.players.forEach((q: Player, sid: string) => void (q.group === id && left.push(sid)));
    if (!left.length) {
      this.state.groups.delete(id);
      for (const [to, inv] of this.groupInvites) if (inv.group === id) this.groupInvites.delete(to);
      return;
    }
    if (g.owner === sessionId) g.owner = left[0]!;
    this.toGroup(id, { op: 'left', who: sessionId, name: p.name });
  }

  private relayTarget(from: Client, to: unknown): Client | null {
    if (typeof to !== 'string' || to === from.sessionId) return null;
    const a = this.state.players.get(from.sessionId);
    const b = this.state.players.get(to);
    // talk/call partners and members of the same group call stay connected however far apart they walk
    const groupCall = !!a?.group && a.group === b?.group && a.groupCall && b.groupCall;
    if (!a || !b || (a.talkWith !== to && !groupCall && dist2(a, b) > RELAY_RADIUS * RELAY_RADIUS)) return null;
    return this.clients.find((c) => c.sessionId === to) ?? null;
  }

  private expireBubbles() {
    const now = Date.now();
    this.state.players.forEach((p: Player) => {
      if (p.bubble && now - p.bubbleAt > BUBBLE_TTL_MS) p.bubble = '';
    });
  }

  /** Word Relay (rooms/teamGames.ts). */
  private relay = new WordRelay((type, msg) => this.broadcast(type, msg));
  /** Guard-dog chases on the farms (rooms/farmChase.ts). */
  private chases = new FarmChases(
    (session) => {
      const p = this.state.players.get(session);
      return p ? { x: p.x, z: p.z } : null;
    },
    () => this.clients as unknown as ChaseClient[],
    reportChase,
  );
  /** Farm owner per slot, and when the slot was last seen in use. */
  private farmSlots = new Map<number, { owner: string; seen: number }>();
  private farmSlot(owner: string): number {
    const now = Date.now();
    // keep slots that somebody is standing in
    for (const p of this.state.players.values()) {
      const s = myFarmAt(p.x, p.z);
      const row = s >= 0 ? this.farmSlots.get(s) : undefined;
      if (row) row.seen = now;
    }
    for (const [s, row] of this.farmSlots) if (row.owner === owner) return (row.seen = now), s;
    for (let s = 0; s < MY_FARM_SLOTS; s++)
      if (!this.farmSlots.has(s)) {
        this.farmSlots.set(s, { owner, seen: now });
        return s;
      }
    // all taken: reuse the one idle longest
    let best = 0;
    for (const [s, row] of this.farmSlots) if (row.seen < this.farmSlots.get(best)!.seen) best = s;
    this.farmSlots.set(best, { owner, seen: now });
    return best;
  }
}

/** "203.0.113.x" / "2001:db8:…" — enough to spot many guests from one network, not a full address. */
function shortIp(ip: string) {
  const v4 = ip.replace(/^::ffff:/, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return v4.replace(/\.\d+$/, '.x');
  return ip.split(':').slice(0, 3).join(':') + (ip.includes(':') ? ':…' : '');

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
  // letters of any language (Vietnamese "Nguyễn Thanh Sơn"), digits, dash, space; NFC so ễ is one character
  const s = maskProfanity(n.normalize('NFC').replace(/[^\p{L}\p{M}\p{N}\- ]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20));
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

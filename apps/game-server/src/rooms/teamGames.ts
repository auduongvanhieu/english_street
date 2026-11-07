import {
  DRAW_ROUND_S,
  DRAW_WORDS,
  HUNT_PLACES,
  HUNT_RADIUS,
  MSG,
  RUSH_STEPS,
  TEAM_COUNTDOWN_S,
  TEAM_GAMES,
  TEAM_GAME_IDS,
  TEAM_IDS,
  TEAM_MAX,
  WRONG_LOCK_S,
  drawPoints,
  harvestTask,
  huntPlaces,
  normGuess,
  relayQuestion,
  rng,
  rushOrder,
  sameTicket,
  type TeamEvent,
  type TeamId,
  type TeamSend,
  type TeamState,
} from '@es/shared';

/**
 * Team games for one zone (StreetRoom): the lobby (two teams, a chosen game) and the referee of the game being
 * played. Questions come from the game's seed (@es/shared teamGames.ts); answers are checked here; the hunt checks
 * where the players really are. Everybody in the zone gets the state; the draw word goes to the drawer only.
 */
const empty = (game: TeamState['game'] = 'relay'): TeamState => ({
  phase: 'lobby',
  game,
  teams: { red: [], blue: [] },
  score: { red: 0, blue: 0 },
  startsAt: 0,
  endsAt: 0,
  winner: null,
  turn: { red: '', blue: '' },
  locked: { red: 0, blue: 0 },
});
const other = (t: TeamId): TeamId => (t === 'red' ? 'blue' : 'red');
const MAX_STROKES = 400;

export class TeamGames {
  state: TeamState = empty();
  private seed = 1;
  /** question / task / order number per team, and the index of whose turn it is in the team */
  private n: Record<TeamId, number> = { red: 0, blue: 0 };
  private idx: Record<TeamId, number> = { red: 0, blue: 0 };
  private doneAt = 0;
  private word = '';
  private strokes: { pts: number[]; color: string }[] = [];
  private drawStart = 0;

  constructor(
    private broadcast: (type: string, msg: TeamEvent) => void,
    private sendTo: (session: string, msg: TeamEvent) => void,
    private pos: (session: string) => { x: number; z: number } | null,
  ) {}

  private send() {
    this.broadcast(MSG.TEAM, { op: 'state', state: this.state });
  }
  private feed(team: TeamId, by: string, ok: boolean, text: string) {
    this.broadcast(MSG.TEAM, { op: 'feed', team, by: by.slice(0, 20), ok, text });
  }
  private teamOf(id: string): TeamId | null {
    return TEAM_IDS.find((t) => this.state.teams[t].some((p) => p.id === id)) ?? null;
  }
  private nameOf(id: string) {
    for (const t of TEAM_IDS) for (const p of this.state.teams[t]) if (p.id === id) return p.name;
    return '?';
  }

  hello(session: string) {
    this.sendTo(session, { op: 'state', state: this.state });
    if (this.state.game === 'draw' && this.state.phase === 'playing') {
      this.sendTo(session, { op: 'strokes', list: this.strokes });
      if (this.state.draw?.drawer === session) this.sendTo(session, { op: 'word', word: this.word });
    }
  }

  onMessage(id: string, name: string, msg: TeamSend) {
    const s = this.state;
    switch (msg.op) {
      case 'join': {
        if (s.phase === 'countdown' || s.phase === 'playing') return;
        if (s.phase === 'done') this.reset();
        if (!TEAM_IDS.includes(msg.team)) return;
        this.remove(id);
        if (this.state.teams[msg.team].length < TEAM_MAX) this.state.teams[msg.team].push({ id, name: name.slice(0, 20) });
        return this.send();
      }
      case 'leave':
        this.remove(id);
        return this.send();
      case 'game':
        if ((s.phase !== 'lobby' && s.phase !== 'done') || !TEAM_GAME_IDS.includes(msg.game) || !this.teamOf(id)) return;
        if (s.phase === 'done') this.reset();
        this.state.game = msg.game;
        return this.send();
      case 'start':
        if (s.phase !== 'lobby' || !this.teamOf(id) || TEAM_IDS.some((t) => !s.teams[t].length)) return;
        return this.start();
      case 'relay':
        return this.relay(id, msg.n, msg.choice);
      case 'rush':
        return this.rush(id, msg);
      case 'harvest':
        return this.harvest(id, msg.n, msg.index);
      case 'guess':
        return this.guess(id, String(msg.text ?? '').slice(0, 40));
      case 'stroke':
        return this.stroke(id, msg.pts, msg.color);
      case 'clear':
        if (s.phase === 'playing' && s.game === 'draw' && s.draw?.drawer === id) {
          this.strokes = [];
          this.broadcast(MSG.TEAM, { op: 'clear' });
        }
        return;
      case 'hello':
        return;
    }
  }

  private start() {
    const s = this.state;
    this.seed = (Date.now() % 1_000_000) + 7;
    s.phase = 'countdown';
    s.startsAt = Date.now() + TEAM_COUNTDOWN_S * 1000;
    s.endsAt = s.startsAt + TEAM_GAMES[s.game].maxS * 1000;
    s.winner = null;
    for (const t of TEAM_IDS) {
      this.n[t] = 0;
      this.idx[t] = 0;
      s.score[t] = 0;
      s.locked[t] = 0;
      s.turn[t] = s.teams[t][0]!.id;
    }
    delete s.relay;
    delete s.hunt;
    delete s.rush;
    delete s.harvest;
    delete s.draw;
    this.send();
  }

  private begin() {
    const s = this.state;
    s.phase = 'playing';
    if (s.game === 'relay') s.relay = { red: null, blue: null };
    if (s.game === 'hunt') s.hunt = { red: null, blue: null };
    if (s.game === 'rush') s.rush = { red: null, blue: null };
    if (s.game === 'harvest') s.harvest = { red: null, blue: null };
    if (s.game === 'draw') return this.drawRound(0);
    for (const t of TEAM_IDS) this.next(t);
    this.send();
  }

  /** The next question / clue / order / task for a team. */
  private next(t: TeamId) {
    const s = this.state;
    const n = this.n[t]++;
    if (s.game === 'relay' && s.relay) {
      const { answer: _a, ...q } = relayQuestion(this.seed, n);
      s.relay[t] = { ...q, n };
    } else if (s.game === 'hunt' && s.hunt) {
      const place = HUNT_PLACES[huntPlaces(this.seed, t)[n]!];
      s.hunt[t] = place ? { n, clue: place.clue, last: s.hunt[t]?.last ?? '' } : null;
    } else if (s.game === 'rush' && s.rush) {
      s.rush[t] = { n, step: 'order', order: rushOrder(this.seed, n), ticket: null };
    } else if (s.game === 'harvest' && s.harvest) {
      const task = harvestTask(this.seed, n);
      s.harvest[t] = { n, text: task.text, grid: task.grid, picked: [], need: task.need };
    }
  }

  /** Pass the turn to the next member of a team. */
  private pass(t: TeamId) {
    const list = this.state.teams[t];
    if (!list.length) return;
    this.idx[t] = (this.idx[t] + 1) % list.length;
    this.state.turn[t] = list[this.idx[t]]!.id;
  }

  /** A team scores; at the target it wins. */
  private point(t: TeamId, by = 1) {
    const s = this.state;
    s.score[t] += by;
    if (s.game !== 'draw' && s.score[t] >= TEAM_GAMES[s.game].target) {
      this.finish(t);
      return true;
    }
    return false;
  }

  private canAct(id: string): TeamId | null {
    const t = this.teamOf(id);
    if (!t || this.state.phase !== 'playing' || Date.now() < this.state.locked[t]) return null;
    return t;
  }
  private wrong(t: TeamId) {
    this.state.locked[t] = Date.now() + WRONG_LOCK_S * 1000;
  }

  private relay(id: string, n: number, choice: number) {
    const s = this.state;
    const t = this.canAct(id);
    const q = t && s.relay?.[t];
    if (!t || !q || s.game !== 'relay' || s.turn[t] !== id || q.n !== n) return;
    const full = relayQuestion(this.seed, n);
    const ok = choice === full.answer;
    this.feed(t, this.nameOf(id), ok, full.kind === 'pic' ? full.prompt : full.options[full.answer]!);
    if (ok) {
      if (this.point(t)) return;
      this.pass(t);
    } else this.wrong(t);
    this.next(t);
    this.send();
  }

  private rush(id: string, msg: Extract<TeamSend, { op: 'rush' }>) {
    const s = this.state;
    const t = this.canAct(id);
    const cur = t && s.rush?.[t];
    if (!t || !cur || s.game !== 'rush' || s.turn[t] !== id || cur.n !== msg.n || cur.step !== msg.step) return;
    const o = cur.order;
    let ok = false;
    if (msg.step === 'order' || msg.step === 'cook') ok = !!msg.ticket && typeof msg.ticket === 'object' && sameTicket(msg.ticket, o.items);
    else ok = msg.table === o.table;
    const label = msg.step === 'order' ? 'took the order' : msg.step === 'cook' ? 'cooked the food' : `served table ${o.table}`;
    this.feed(t, this.nameOf(id), ok, ok ? label : msg.step === 'serve' ? `wrong table (${msg.table})` : 'wrong food');
    if (!ok) {
      this.wrong(t);
      return this.send();
    }
    this.pass(t);
    const i = RUSH_STEPS.indexOf(cur.step);
    if (i < RUSH_STEPS.length - 1) {
      cur.step = RUSH_STEPS[i + 1]!;
      cur.ticket = o.items;
    } else {
      if (this.point(t)) return;
      this.next(t);
    }
    this.send();
  }

  private harvest(id: string, n: number, index: number) {
    const s = this.state;
    const t = this.canAct(id);
    const cur = t && s.harvest?.[t];
    if (!t || !cur || s.game !== 'harvest' || cur.n !== n || cur.picked.includes(index)) return;
    const task = harvestTask(this.seed, n);
    if (!task.right.includes(index)) {
      this.feed(t, this.nameOf(id), false, 'picked the wrong thing');
      this.wrong(t);
      return this.send();
    }
    cur.picked.push(index);
    if (cur.picked.length >= task.need) {
      this.feed(t, this.nameOf(id), true, task.text.replace(/!$/, ''));
      if (this.point(t)) return;
      this.next(t);
    }
    this.send();
  }

  private drawRound(round: number) {
    const s = this.state;
    if (round >= TEAM_GAMES.draw.target) {
      const w = s.score.red === s.score.blue ? 'draw' : s.score.red > s.score.blue ? 'red' : 'blue';
      return this.finish(w);
    }
    const team: TeamId = round % 2 === 0 ? 'red' : 'blue';
    const list = s.teams[team];
    if (!list.length) return this.finish(other(team));
    const drawer = list[Math.floor(round / 2) % list.length]!.id;
    const r = rng(this.seed + round * 97);
    this.word = DRAW_WORDS[Math.floor(r() * DRAW_WORDS.length)]!;
    this.strokes = [];
    this.drawStart = Date.now();
    s.draw = { round, team, drawer, endsAt: Date.now() + DRAW_ROUND_S * 1000, guessed: '', word: '', strokes: 0 };
    this.broadcast(MSG.TEAM, { op: 'clear' });
    this.send();
    this.sendTo(drawer, { op: 'word', word: this.word });
  }

  private endDrawRound(guessedBy: string) {
    const s = this.state;
    if (!s.draw) return;
    s.draw.guessed = guessedBy;
    s.draw.word = this.word;
    s.draw.endsAt = Date.now() + 3000; // a moment to see the answer
    this.send();
  }

  private guess(id: string, text: string) {
    const s = this.state;
    const d = s.draw;
    const t = this.teamOf(id);
    if (s.phase !== 'playing' || s.game !== 'draw' || !d || d.word || !t || t !== d.team || id === d.drawer || !text.trim()) return;
    const ok = normGuess(text) === normGuess(this.word);
    this.feed(t, this.nameOf(id), ok, ok ? `guessed it: ${this.word}!` : text);
    if (!ok) return;
    this.point(t, drawPoints((Date.now() - this.drawStart) / 1000));
    this.endDrawRound(this.nameOf(id));
  }

  private stroke(id: string, pts: unknown, color: unknown) {
    const s = this.state;
    if (s.phase !== 'playing' || s.game !== 'draw' || s.draw?.drawer !== id || s.draw.word || !Array.isArray(pts) || pts.length > 160 || this.strokes.length >= MAX_STROKES) return;
    const clean = pts.map((v) => Math.max(0, Math.min(1000, Math.round(Number(v) || 0))));
    const c = typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color) ? color : '#222222';
    this.strokes.push({ pts: clean, color: c });
    s.draw.strokes = this.strokes.length;
    this.broadcast(MSG.TEAM, { op: 'stroke', pts: clean, color: c });
  }

  private finish(winner: TeamId | 'draw') {
    this.state.phase = 'done';
    this.state.winner = winner;
    this.doneAt = Date.now();
    this.send();
  }

  private reset() {
    const { teams, game } = this.state;
    this.state = empty(game);
    this.state.teams = teams;
  }

  /** A player left the team or the zone. */
  remove(id: string) {
    const s = this.state;
    for (const t of TEAM_IDS) {
      const i = s.teams[t].findIndex((p) => p.id === id);
      if (i < 0) continue;
      s.teams[t].splice(i, 1);
      if (s.phase === 'playing' || s.phase === 'countdown') {
        if (!s.teams[t].length) return this.finish(other(t));
        this.idx[t] %= s.teams[t].length;
        if (s.turn[t] === id) s.turn[t] = s.teams[t][this.idx[t]]!.id;
        if (s.draw?.drawer === id && !s.draw.word) this.drawRound(s.draw.round + 1);
      }
    }
  }

  /** Twice a second from the room's loop. */
  tick(now: number) {
    const s = this.state;
    if (s.phase === 'countdown' && now >= s.startsAt) return this.begin();
    if (s.phase === 'playing') {
      if (now >= s.endsAt) return this.finish(s.score.red === s.score.blue ? 'draw' : s.score.red > s.score.blue ? 'red' : 'blue');
      if (s.game === 'hunt' && s.hunt) this.huntCheck();
      if (s.game === 'draw' && s.draw && now >= s.draw.endsAt) {
        if (!s.draw.word) this.endDrawRound('');
        else this.drawRound(s.draw.round + 1);
      }
      return;
    }
    if (s.phase === 'done' && now - this.doneAt > 90_000) {
      this.reset();
      this.send();
    }
  }

  /** Treasure hunt: is anybody of a team at its clue's place? */
  private huntCheck() {
    const s = this.state;
    for (const t of TEAM_IDS) {
      const cur = s.hunt?.[t];
      if (!cur) continue;
      const place = HUNT_PLACES[huntPlaces(this.seed, t)[cur.n]!];
      if (!place) continue;
      const finder = s.teams[t].find((p) => {
        const q = this.pos(p.id);
        return q && place.at.some(([x, z]) => Math.hypot(q.x - x, q.z - z) <= HUNT_RADIUS);
      });
      if (!finder) continue;
      this.feed(t, finder.name, true, `found the ${place.id}`);
      if (this.point(t)) return;
      this.next(t);
      s.hunt![t]!.last = finder.name;
      this.send();
    }
  }
}

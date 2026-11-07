import { MSG, RELAY_COUNTDOWN_S, RELAY_MAX_PER_TEAM, RELAY_MAX_S, RELAY_TARGET, RELAY_TEAMS, RELAY_WRONG_LOCK_S, relayQuestion, type RelayState, type RelayTeam, type TeamEvent, type TeamSend } from '@es/shared';

/**
 * Word Relay for one zone (StreetRoom): a lobby with two teams, then a race. Each team's members answer in turn
 * (the baton passes on a right answer, a wrong one locks the team for a moment); the first to RELAY_TARGET wins.
 * The server picks the questions and checks the answers; everybody in the zone gets the state.
 */
const empty = (): RelayState => ({
  phase: 'lobby',
  teams: { red: [], blue: [] },
  progress: { red: 0, blue: 0 },
  runner: { red: '', blue: '' },
  question: { red: null, blue: null },
  lockedUntil: { red: 0, blue: 0 },
  startsAt: 0,
  endsAt: 0,
  winner: null,
});

export class WordRelay {
  state: RelayState = empty();
  private seed = 1;
  /** next question number per team, and whose turn (index into the team) */
  private n: Record<RelayTeam, number> = { red: 0, blue: 0 };
  private turn: Record<RelayTeam, number> = { red: 0, blue: 0 };
  private doneAt = 0;
  constructor(private broadcast: (type: string, msg: TeamEvent) => void) {}

  private send() {
    this.broadcast(MSG.TEAM, { op: 'state', state: this.state });
  }
  private teamOf(id: string): RelayTeam | null {
    return RELAY_TEAMS.find((t) => this.state.teams[t].some((p) => p.id === id)) ?? null;
  }

  hello(send: (m: TeamEvent) => void) {
    send({ op: 'state', state: this.state });
  }

  onMessage(id: string, name: string, msg: TeamSend) {
    const s = this.state;
    if (msg.op === 'join') {
      if (s.phase !== 'lobby' && s.phase !== 'done') return;
      if (s.phase === 'done') this.reset();
      if (!RELAY_TEAMS.includes(msg.team)) return;
      this.remove(id);
      if (this.state.teams[msg.team].length >= RELAY_MAX_PER_TEAM) return this.send();
      this.state.teams[msg.team].push({ id, name: name.slice(0, 20) });
      return this.send();
    }
    if (msg.op === 'leave') {
      this.remove(id);
      return this.send();
    }
    if (msg.op === 'start') {
      if (s.phase !== 'lobby' || !this.teamOf(id) || RELAY_TEAMS.some((t) => !s.teams[t].length)) return;
      this.seed = (Date.now() % 100000) + 7;
      s.phase = 'countdown';
      s.startsAt = Date.now() + RELAY_COUNTDOWN_S * 1000;
      s.endsAt = s.startsAt + RELAY_MAX_S * 1000;
      for (const t of RELAY_TEAMS) {
        this.n[t] = 0;
        this.turn[t] = 0;
        s.progress[t] = 0;
        s.lockedUntil[t] = 0;
        s.runner[t] = s.teams[t][0]!.id;
        s.question[t] = null;
      }
      return this.send();
    }
    if (msg.op === 'answer') {
      const team = this.teamOf(id);
      if (s.phase !== 'playing' || !team || s.runner[team] !== id || Date.now() < s.lockedUntil[team]) return;
      const q = s.question[team];
      if (!q || q.n !== msg.n) return;
      const full = relayQuestion(this.seed, q.n);
      const ok = msg.choice === full.answer;
      const word = full.kind === 'pic' ? full.prompt : full.options[full.answer]!;
      this.broadcast(MSG.TEAM, { op: 'answer', team, by: name.slice(0, 20), ok, word });
      if (ok) {
        s.progress[team] += 1;
        if (s.progress[team] >= RELAY_TARGET) return this.finish(team);
        this.turn[team] = (this.turn[team] + 1) % s.teams[team].length;
        s.runner[team] = s.teams[team][this.turn[team]]!.id;
      } else s.lockedUntil[team] = Date.now() + RELAY_WRONG_LOCK_S * 1000;
      this.next(team);
      return this.send();
    }
  }

  private next(team: RelayTeam) {
    const n = this.n[team]++;
    const { answer: _a, ...q } = relayQuestion(this.seed, n);
    this.state.question[team] = { ...q, n };
  }

  private finish(winner: RelayTeam | 'draw') {
    this.state.phase = 'done';
    this.state.winner = winner;
    this.doneAt = Date.now();
    this.send();
  }

  private reset() {
    const teams = this.state.teams;
    this.state = empty();
    this.state.teams = teams;
  }

  /** A player left the zone (or the team). */
  remove(id: string) {
    const s = this.state;
    for (const t of RELAY_TEAMS) {
      const i = s.teams[t].findIndex((p) => p.id === id);
      if (i < 0) continue;
      s.teams[t].splice(i, 1);
      if (s.phase === 'playing' || s.phase === 'countdown') {
        if (!s.teams[t].length) return this.finish(t === 'red' ? 'blue' : 'red');
        if (s.runner[t] === id) {
          this.turn[t] %= s.teams[t].length;
          s.runner[t] = s.teams[t][this.turn[t]]!.id;
        }
      }
    }
  }

  /** Once a second from the room's loop. */
  tick(now: number) {
    const s = this.state;
    if (s.phase === 'countdown' && now >= s.startsAt) {
      s.phase = 'playing';
      for (const t of RELAY_TEAMS) this.next(t);
      this.send();
    } else if (s.phase === 'playing' && now >= s.endsAt) {
      this.finish(s.progress.red === s.progress.blue ? 'draw' : s.progress.red > s.progress.blue ? 'red' : 'blue');
    } else if (s.phase === 'done' && now - this.doneAt > 60_000) {
      this.reset();
      this.send();
    }
  }
}

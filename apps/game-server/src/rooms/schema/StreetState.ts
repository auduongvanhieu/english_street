import { Schema, MapSchema, type } from '@colyseus/schema';

export class Player extends Schema {
  @type('string') id = '';
  /** API player id (quest progress, reports). */
  @type('string') pid = '';
  @type('string') name = '';
  @type('string') avatar = '{}';
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
  @type('number') rot = 0;
  @type('string') anim = 'idle';
  /** Proximity voice chat enabled. */
  @type('boolean') voice = false;
  /** Holding the shout button (voice heard within SHOUT_RADIUS). */
  @type('boolean') shouting = false;
  /** sessionId of the player this one is in a private talk with ('' = none). */
  @type('string') talkWith = '';
  /** Last chat bubble text and when it was sent (ms epoch). */
  @type('string') bubble = '';
  @type('number') bubbleAt = 0;
  /** Critter id this player is hugging ('' = none). One holder per critter. */
  @type('string') holding = '';
  /** Table prop ('dish:steak' while eating in the restaurant). */
  @type('string') prop = '';
  /** Garden summary (GARDEN_RE) so others at the farm can visit it. */
  @type('string') garden = '';
  /** Bus ride tag (BUS_RE): everyone renders the shared bus and hides the rider while inside. */
  @type('string') bus = '';
  /** Group id this player is in ('' = none; see StreetState.groups). */
  @type('string') group = '';
  /** In their group's voice call (members in the call hear each other at any distance). */
  @type('boolean') groupCall = false;
  /** Sports park football team ('' = none). */
  @type('string') team = '';
}

/** A small group of players in this zone: group chat + group voice call. Members = players with this group id. */
export class Group extends Schema {
  @type('string') id = '';
  @type('string') name = '';
  /** sessionId of the member who manages it (first member; passed on when they leave). */
  @type('string') owner = '';
}

/** The football on the sports park pitch (server physics, world coordinates). */
export class Ball extends Schema {
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
}

/** Score of the current football match; endsAt = 0 until the first kick. */
export class Match extends Schema {
  @type('number') red = 0;
  @type('number') blue = 0;
  @type('number') endsAt = 0;
}

/** A hired river boat (rowing boat or duck pedalo); driver / passenger = sessionId or ''. */
export class Boat extends Schema {
  @type('string') kind = 'row';
  @type('number') x = 0;
  @type('number') z = 0;
  @type('number') rot = 0;
  @type('string') driver = '';
  @type('string') passenger = '';
}

export class StreetState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  /** Critters put down somewhere: id → "x,z,t" (t = server ms). They stay there until someone picks them up. */
  @type({ map: 'string' }) spots = new MapSchema<string>();
  @type({ map: Group }) groups = new MapSchema<Group>();
  @type(Ball) ball = new Ball();
  @type(Match) match = new Match();
  @type({ map: Boat }) boats = new MapSchema<Boat>();
}

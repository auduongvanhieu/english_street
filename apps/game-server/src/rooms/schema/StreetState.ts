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
}

export class StreetState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}

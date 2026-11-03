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
}

export class StreetState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}

import { Schema, MapSchema, type } from '@colyseus/schema';

export class Player extends Schema {
  @type('string') id = '';
  @type('string') name = '';
  @type('string') avatar = '{}';
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
  @type('number') rot = 0;
  @type('string') anim = 'idle';
  /** Last chat bubble text and when it was sent (ms epoch). */
  @type('string') bubble = '';
  @type('number') bubbleAt = 0;
}

export class StreetState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}

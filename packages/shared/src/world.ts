import { z } from 'zod';
import { FarmConfigSchema } from './farm';
import { WeatherConfigSchema, type WeatherDto } from './weather';

const name = z.string().trim().min(1).max(20);

/**
 * World settings edited in the admin site (one document). The client fetches them (GET /world) before the
 * street is shown, the API applies the farm rules and the sold-out list.
 */
export const WorldConfigSchema = z.object({
  farm: FarmConfigSchema.default({}),
  /** Zoo enclosure item (lion, penguin…) → names of the animals living there (1–5). */
  zooNames: z.record(z.string(), z.array(name).min(1).max(5)).default({}),
  /** Street / petting-corner critter id (cat-1, dog-1, kid-1…) → its name. */
  critterNames: z.record(z.string(), name).default({}),
  /** Area id → item ids that are sold out today (restaurant dishes, supermarket products). */
  soldOut: z.record(z.string(), z.array(z.string())).default({}),
  /** Where the street's weather comes from, or a fixed weather / time of day. */
  weather: WeatherConfigSchema.default(() => WeatherConfigSchema.parse({})),
});
export type WorldConfig = z.infer<typeof WorldConfigSchema>;

/** What GET /world returns to the game. */
export interface WorldDto extends WorldConfig {
  version: number;
  /** Notices to show now (admin announcements). */
  announcements: { id: string; text: string; level: 'info' | 'warning'; endsAt: string }[];
  /** Maintenance message ('' = none): the game shows it instead of the street. */
  maintenance: string;
  /** Weather right now (null when the API could not fetch it yet). */
  now: WeatherDto | null;
}

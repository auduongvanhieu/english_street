import { areaById, areaFrame } from '../areas';
import { registerBlockers, type Aabb } from '../layout';

/**
 * Home layout in the area's local frame (world/areas.ts areaFrame): x across the yard (-28 … 28), z from the
 * front fence (0) into the yard (-23.5). LOCAL_BLOCKERS are turned into world blockers below.
 */
export const AREA = areaById('home');
export const FRAME = areaFrame(AREA);

export const LOCAL_BLOCKERS: Aabb[] = [];

registerBlockers(LOCAL_BLOCKERS.map(FRAME.rect));

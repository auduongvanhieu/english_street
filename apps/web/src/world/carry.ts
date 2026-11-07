/**
 * Things that carry the local player along (the Maple Hill cable car, the Riverside boat trip, a surfboard): while a
 * carrier is set, LocalPlayer puts the player where it says each frame (like a hired boat), and the camera rises with
 * the player when they are above the ground.
 */
export interface CarryPose {
  x: number;
  y: number;
  z: number;
  rot: number;
  anim: string;
}
let carrier: (() => CarryPose | null) | null = null;
export const setCarrier = (f: (() => CarryPose | null) | null) => {
  carrier = f;
};
export const carryStep = (): CarryPose | null => (carrier ? carrier() : null);

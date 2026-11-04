/** Virtual joystick vector (-1..1), written by the Joystick UI, read by LocalPlayer. */
export const joystick = { x: 0, y: 0, active: false };

/** Set by the touch jump button (and Space on desktop); consumed by LocalPlayer on the next frame. */
export const jumpInput = { pressed: false };
export function requestJump() {
  jumpInput.pressed = true;
}

export const isTouchDevice = () =>
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

/** Virtual joystick vector (-1..1), written by the Joystick UI, read by LocalPlayer. */
export const joystick = { x: 0, y: 0, active: false };

export const isTouchDevice = () =>
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

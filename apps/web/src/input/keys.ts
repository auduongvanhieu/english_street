/**
 * Movement keys (WASD / arrows / Shift), robust against Vietnamese input methods.
 *
 * Unikey / EVKey (Telex, VNI) intercept letter keys even outside text fields: "w" is turned into "ư" by sending
 * a Backspace plus the new character, and the original key-up never reaches the page. A plain keydown/keyup
 * tracker (drei KeyboardControls) then thinks W is still held and the player walks on by itself. So:
 *  - keys are tracked by physical code (KeyW…), which still works while an IME is on;
 *  - signs of an IME rewrite (synthetic Backspace, a non-ASCII character, composition events) release the
 *    letter keys at once;
 *  - once an IME has been seen in this session, a letter key that has been silent (no auto-repeat keydown) for
 *    LETTER_TIMEOUT_MS is treated as released (arrows are not touched by IMEs; without an IME nothing times out,
 *    so e.g. macOS press-and-hold quirks cannot stop a player who holds A);
 *  - everything is released when the window loses focus or the tab is hidden.
 */
export type Controls = 'forward' | 'back' | 'left' | 'right' | 'run';

const MAP: Record<string, Controls> = {
  ArrowUp: 'forward',
  KeyW: 'forward',
  ArrowDown: 'back',
  KeyS: 'back',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
};
const LETTER_TIMEOUT_MS = 1200;
/** code -> last time we saw it pressed (keydown or auto-repeat) */
const held = new Map<string, number>();
/** An input method has rewritten keys in this session (turns on the letter-key timeout). */
let imeSeen = false;

const editable = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};
const releaseLetters = () => {
  imeSeen = true;
  for (const code of [...held.keys()]) if (code.startsWith('Key')) held.delete(code);
};
const releaseAll = () => held.clear();

let installed = false;
export function installKeys() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('keydown', (e) => {
    if (editable(e.target)) return;
    // an IME rewriting what was typed: a Backspace nobody typed into a field, or a composed (non-ASCII) letter
    if (e.key === 'Backspace' || (e.key.length === 1 && e.key.charCodeAt(0) > 127)) {
      releaseLetters();
      return;
    }
    if (e.key === 'Process' || e.keyCode === 229) imeSeen = true;
    if (MAP[e.code]) held.set(e.code, performance.now());
  });
  window.addEventListener('keyup', (e) => {
    held.delete(e.code);
    // some layouts report an empty code on key-up: fall back to the letter
    if (!e.code && e.key.length === 1) held.delete(`Key${e.key.toUpperCase()}`);
  });
  window.addEventListener('compositionstart', releaseLetters);
  window.addEventListener('compositionend', releaseLetters);
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => document.hidden && releaseAll());
}

/** Current state of the movement controls (read every frame by LocalPlayer). */
export function getControls(): Record<Controls, boolean> {
  const now = performance.now();
  const out: Record<Controls, boolean> = { forward: false, back: false, left: false, right: false, run: false };
  for (const [code, at] of held) {
    if (imeSeen && code.startsWith('Key') && now - at > LETTER_TIMEOUT_MS) {
      held.delete(code);
      continue;
    }
    out[MAP[code]!] = true;
  }
  return out;
}

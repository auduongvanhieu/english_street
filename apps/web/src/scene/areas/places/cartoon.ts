/**
 * "The Dragon Who Couldn't Fly": a short looping cartoon drawn on a 2D canvas for the cinema screen, with
 * easy English subtitles. Everyone in the cinema sees the same moment (time comes from the server clock).
 */
export const CARTOON_W = 1024;
export const CARTOON_H = 225;
export const CARTOON_LOOP = 56;

interface Scene {
  from: number;
  to: number;
  sub: string;
}
const SCENES: Scene[] = [
  { from: 0, to: 4, sub: '' },
  { from: 4, to: 11, sub: 'This is Dino. Dino is a little green dragon.' },
  { from: 11, to: 18, sub: 'Dino looks up at the birds. He wants to fly too!' },
  { from: 18, to: 26, sub: 'He flaps his little wings… and falls down. Ouch!' },
  { from: 26, to: 34, sub: '"Don\'t give up, Dino!" says the bird. "Try again!"' },
  { from: 34, to: 43, sub: 'Dino runs, jumps and flaps his wings. He is flying!' },
  { from: 43, to: 51, sub: 'Now Dino can fly with his friends. Never give up!' },
  { from: 51, to: 56, sub: '' },
];

const W = CARTOON_W;
const H = CARTOON_H;
const GROUND = 168;

export function drawCartoon(c: CanvasRenderingContext2D, time: number) {
  const t = ((time % CARTOON_LOOP) + CARTOON_LOOP) % CARTOON_LOOP;
  const i = SCENES.findIndex((s) => t >= s.from && t < s.to);
  const s = SCENES[i]!;
  const u = t - s.from;
  c.save();
  c.clearRect(0, 0, W, H);
  switch (i) {
    case 0:
      title(c, u, "The Dragon Who Couldn't Fly", 'A Star Cinema cartoon');
      break;
    case 1: {
      day(c, t * 20);
      dragon(c, 120 + u * 45, GROUND, 1, { walk: t * 9 });
      break;
    }
    case 2: {
      day(c, 0);
      for (let k = 0; k < 3; k++) bird(c, ((u * 110 + k * 90) % (W + 200)) - 100, 50 + k * 18 + Math.sin(u * 3 + k) * 6, 1, t * 12 + k, ['#3b82f6', '#ef4444', '#f59e0b'][k]!);
      dragon(c, 430, GROUND, 1, { look: 1 });
      if (u > 2.5) heart(c, 490, 70 + Math.sin(u * 4) * 3);
      break;
    }
    case 3: {
      day(c, 0);
      // three tries: hop, flap, fall
      const k = u % 2.6;
      const hop = k < 1.4 ? Math.sin((k / 1.4) * Math.PI) * 45 : 0;
      const fallen = u > 5.2;
      dragon(c, 430, GROUND - (fallen ? 0 : hop), 1, { flap: fallen ? 0 : t * 30, dizzy: fallen ? u : 0, sad: fallen });
      if (k > 1.35 && k < 1.9) pop(c, 430, GROUND + 4, 'BUMP!');
      break;
    }
    case 4: {
      day(c, 0);
      const land = Math.min(1, u / 2);
      bird(c, 560 - (1 - land) * 160, GROUND - 28 - (1 - land) * 110, 1.3, land < 1 ? t * 12 : 0, '#3b82f6', true);
      dragon(c, 430, GROUND, 1, { sad: u < 4, look: u > 4 ? 0.3 : 0 });
      if (u > 2.2 && u < 7) bubble(c, 600, 60, u < 4.5 ? "Don't give up!" : 'Try again!');
      break;
    }
    case 5: {
      // running along, then lifting off
      const lift = Math.max(0, u - 3.5);
      day(c, t * 140);
      const y = GROUND - Math.min(110, lift * lift * 14);
      dragon(c, 300 + Math.min(150, u * 30), y, 1, { walk: lift > 0 ? 0 : t * 16, flap: t * 26, happy: lift > 0.8 });
      if (lift > 1) for (let k = 0; k < 4; k++) sparkle(c, 220 + k * 30 + Math.sin(t * 5 + k) * 8, y - 20 + Math.cos(t * 4 + k) * 12, t + k);
      break;
    }
    case 6: {
      sunset(c, t * 60);
      dragon(c, 460, 105 + Math.sin(u * 2) * 10, 1, { flap: t * 18, happy: true, fly: true });
      for (let k = 0; k < 3; k++) bird(c, 560 + k * 70, 70 + k * 22 + Math.sin(u * 2.5 + k) * 8, 1, t * 12 + k, ['#3b82f6', '#ef4444', '#f59e0b'][k]!);
      break;
    }
    default:
      title(c, u, 'THE END', 'Thanks for watching!');
  }
  if (s.sub) subtitle(c, s.sub);
  c.restore();
}

// ------------------------------------------------------------------------------------------------ backgrounds
function title(c: CanvasRenderingContext2D, u: number, big: string, small: string) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1f5f3a');
  g.addColorStop(1, '#0f2d1c');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  for (let k = 0; k < 40; k++) {
    c.fillStyle = `rgba(255,240,170,${0.3 + 0.3 * Math.sin(u * 3 + k)})`;
    c.fillRect((k * 97) % W, (k * 53) % H, 3, 3);
  }
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = '#ffe27a';
  c.font = 'bold 44px "Trebuchet MS", sans-serif';
  c.fillText(big, W / 2, H / 2 - 18);
  c.fillStyle = '#d7f5df';
  c.font = '22px "Trebuchet MS", sans-serif';
  c.fillText(small, W / 2, H / 2 + 26);
  dragon(c, 150, 150 + Math.sin(u * 3) * 6, 0.7, { flap: u * 10, happy: true });
}

function day(c: CanvasRenderingContext2D, scroll: number) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#7cc4f2');
  g.addColorStop(1, '#d6f0ff');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.fillStyle = '#ffe066';
  c.beginPath();
  c.arc(880, 45, 26, 0, Math.PI * 2);
  c.fill();
  for (let k = 0; k < 4; k++) cloud(c, mod(k * 300 - scroll * 0.2, W + 200) - 100, 35 + (k % 2) * 25, 1);
  hills(c, scroll * 0.4, 130, '#8fd27a', 30);
  hills(c, scroll, GROUND - 6, '#5fb24e', 14);
  c.fillStyle = '#4c9a3e';
  c.fillRect(0, GROUND + 8, W, H - GROUND);
  // flowers going past
  for (let k = 0; k < 14; k++) {
    const x = mod(k * 83 - scroll, W + 40) - 20;
    c.fillStyle = ['#ff7eb6', '#fff', '#ffd23f'][k % 3]!;
    c.beginPath();
    c.arc(x, GROUND + 18 + (k % 3) * 6, 4, 0, Math.PI * 2);
    c.fill();
  }
}

function sunset(c: CanvasRenderingContext2D, scroll: number) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#6a5acd');
  g.addColorStop(0.55, '#ff9a5a');
  g.addColorStop(1, '#ffd27a');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.fillStyle = '#ffdf7e';
  c.beginPath();
  c.arc(820, 150, 40, 0, Math.PI * 2);
  c.fill();
  for (let k = 0; k < 6; k++) cloud(c, mod(k * 220 - scroll, W + 200) - 100, 40 + (k % 3) * 50, 0.9, 'rgba(255,235,220,0.9)');
  hills(c, scroll * 0.3, 200, '#7a4f8a', 18);
}

function hills(c: CanvasRenderingContext2D, scroll: number, base: number, color: string, amp: number) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(0, H);
  for (let x = 0; x <= W; x += 16) c.lineTo(x, base - amp * (0.6 + 0.4 * Math.sin((x + scroll) * 0.008) * Math.sin((x + scroll) * 0.013 + 1)));
  c.lineTo(W, H);
  c.fill();
}

function cloud(c: CanvasRenderingContext2D, x: number, y: number, s: number, color = 'rgba(255,255,255,0.95)') {
  c.fillStyle = color;
  c.beginPath();
  for (const [dx, dy, r] of [[0, 0, 18], [20, -8, 22], [42, 0, 17], [20, 6, 18]] as const) {
    c.moveTo(x + dx * s + r * s, y + dy * s);
    c.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
  }
  c.fill();
}

// ------------------------------------------------------------------------------------------------ characters
interface DragonPose {
  walk?: number;
  flap?: number;
  look?: number;
  dizzy?: number;
  sad?: boolean;
  happy?: boolean;
  fly?: boolean;
}

/** Dino, facing right, feet at (x, y). */
function dragon(c: CanvasRenderingContext2D, x: number, y: number, s: number, p: DragonPose) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  const green = '#4caf50';
  const dark = '#2e7d32';
  const step = p.walk ? Math.sin(p.walk) : 0;
  const bob = p.walk ? Math.abs(Math.cos(p.walk)) * 3 : 0;
  // tail
  c.fillStyle = green;
  c.beginPath();
  c.moveTo(-26, -24 - bob);
  c.quadraticCurveTo(-60, -20 + Math.sin((p.walk ?? 0) + (p.flap ?? 0) * 0.1) * 4, -72, -38);
  c.quadraticCurveTo(-58, -12, -20, -10 - bob);
  c.fill();
  c.fillStyle = '#ffb74d';
  tri(c, -72, -38, -80, -46, -66, -46);
  // legs
  if (!p.fly) {
    c.fillStyle = dark;
    roundRect(c, -16 + step * 6, -16, 13, 16, 5);
    roundRect(c, 6 - step * 6, -16, 13, 16, 5);
  }
  // wing (behind the body, flapping about the shoulder)
  const f = p.flap ? Math.sin(p.flap) : 0;
  c.save();
  c.translate(-4, -46 - bob);
  c.rotate(-0.5 + f * 0.7);
  c.fillStyle = '#81c784';
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(-30, -26);
  c.lineTo(-22, -6);
  c.lineTo(-34, -4);
  c.closePath();
  c.fill();
  c.restore();
  // body + belly
  c.fillStyle = green;
  ellipse(c, 0, -34 - bob, 32, 24);
  c.fillStyle = '#fff3b0';
  ellipse(c, 8, -28 - bob, 18, 15);
  // back spikes
  c.fillStyle = '#ff8a65';
  for (let k = 0; k < 3; k++) tri(c, -18 + k * 12, -54 - bob + k * 1, -12 + k * 12, -64 - bob, -6 + k * 12, -54 - bob - k * 1);
  // head (tilted up when looking at the sky)
  const look = p.look ?? 0;
  c.save();
  c.translate(30, -60 - bob);
  c.rotate(-0.35 * look + (p.sad ? 0.25 : 0));
  c.fillStyle = green;
  ellipse(c, 0, 0, 20, 17);
  ellipse(c, 16, 5, 13, 10);
  c.fillStyle = '#ffb74d';
  tri(c, -8, -14, -4, -26, 0, -15);
  tri(c, 2, -15, 7, -26, 10, -14);
  // eye
  c.fillStyle = '#fff';
  ellipse(c, 4, -4, 7, 8);
  c.fillStyle = '#222';
  if (p.dizzy) {
    c.strokeStyle = '#222';
    c.lineWidth = 2;
    c.beginPath();
    for (let a = 0; a < 10; a += 0.5) c.lineTo(5 + Math.cos(a + p.dizzy * 6) * a * 0.5, -4 + Math.sin(a + p.dizzy * 6) * a * 0.5);
    c.stroke();
  } else ellipse(c, 6 - look, -5 - look * 2, 3.5, 4.5);
  // mouth
  c.strokeStyle = '#1b5e20';
  c.lineWidth = 2;
  c.beginPath();
  if (p.happy) c.arc(18, 7, 6, 0.1, Math.PI - 0.1);
  else if (p.sad) c.arc(18, 14, 5, Math.PI + 0.3, -0.3);
  else c.moveTo(14, 9), c.lineTo(24, 9);
  c.stroke();
  // cheek
  c.fillStyle = 'rgba(255,120,120,0.5)';
  ellipse(c, 6, 8, 4, 3);
  c.restore();
  if (p.dizzy) for (let k = 0; k < 3; k++) star(c, 30 + Math.cos(p.dizzy * 4 + k * 2.1) * 26, -88 - bob + Math.sin(p.dizzy * 4 + k * 2.1) * 6, 5, '#ffd23f');
  c.restore();
}

function bird(c: CanvasRenderingContext2D, x: number, y: number, s: number, flap: number, color: string, faceLeft = false) {
  c.save();
  c.translate(x, y);
  c.scale(faceLeft ? -s : s, s);
  const f = Math.sin(flap);
  c.fillStyle = color;
  ellipse(c, 0, 0, 12, 9);
  ellipse(c, 10, -6, 7, 7);
  c.fillStyle = '#ffb300';
  tri(c, 16, -7, 23, -5, 16, -3);
  c.fillStyle = '#222';
  ellipse(c, 12, -8, 1.8, 1.8);
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(-4, -4);
  c.lineTo(-10, -4 - 16 * f);
  c.lineTo(6, -4);
  c.fill();
  tri(c, -10, 0, -20, -5, -20, 5);
  c.restore();
}

// ------------------------------------------------------------------------------------------------ bits
function subtitle(c: CanvasRenderingContext2D, text: string) {
  c.font = 'bold 24px "Trebuchet MS", sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const w = c.measureText(text).width + 30;
  c.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(c, W / 2 - w / 2, H - 40, w, 32, 8);
  c.fillStyle = '#fff';
  c.fillText(text, W / 2, H - 23);
}

function bubble(c: CanvasRenderingContext2D, x: number, y: number, text: string) {
  c.font = 'bold 22px "Trebuchet MS", sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const w = c.measureText(text).width + 24;
  c.fillStyle = '#fff';
  roundRect(c, x - w / 2, y - 18, w, 36, 14);
  tri(c, x - 30, y + 16, x - 46, y + 34, x - 14, y + 16);
  c.fillStyle = '#1f2a6b';
  c.fillText(text, x, y);
}

function pop(c: CanvasRenderingContext2D, x: number, y: number, text: string) {
  star(c, x, y - 8, 30, '#ffd23f');
  c.font = 'bold 18px "Trebuchet MS", sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = '#c62828';
  c.fillText(text, x, y - 8);
}

function heart(c: CanvasRenderingContext2D, x: number, y: number) {
  c.fillStyle = '#ff5c8a';
  c.beginPath();
  c.moveTo(x, y + 8);
  c.bezierCurveTo(x - 16, y - 4, x - 6, y - 16, x, y - 6);
  c.bezierCurveTo(x + 6, y - 16, x + 16, y - 4, x, y + 8);
  c.fill();
}

function sparkle(c: CanvasRenderingContext2D, x: number, y: number, t: number) {
  star(c, x, y, 4 + Math.abs(Math.sin(t * 6)) * 4, '#fffde7');
}

function star(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = k % 2 ? r * 0.45 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.fill();
}

const mod = (a: number, n: number) => ((a % n) + n) % n;
function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}
function tri(c: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  c.beginPath();
  c.moveTo(ax, ay);
  c.lineTo(bx, by);
  c.lineTo(cx, cy);
  c.fill();
}
function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.fill();
}

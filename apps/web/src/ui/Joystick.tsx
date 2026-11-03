import { useRef, type PointerEvent } from 'react';
import { joystick } from '../input/joystick';

const SIZE = 124;
const KNOB = 52;
const RANGE = (SIZE - KNOB) / 2;

export function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const pointerId = useRef<number | null>(null);

  function update(e: PointerEvent) {
    const r = base.current!.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > RANGE) {
      dx = (dx / len) * RANGE;
      dy = (dy / len) * RANGE;
    }
    joystick.x = dx / RANGE;
    joystick.y = dy / RANGE; // screen down = toward the camera
    joystick.active = true;
    knob.current!.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function end() {
    pointerId.current = null;
    joystick.x = 0;
    joystick.y = 0;
    joystick.active = false;
    if (knob.current) knob.current.style.transform = 'translate(0,0)';
  }

  return (
    <div
      ref={base}
      data-ui
      className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-[max(1.25rem,env(safe-area-inset-left))] touch-none select-none rounded-full bg-black/25 backdrop-blur-sm"
      style={{ width: SIZE, height: SIZE }}
      onPointerDown={(e) => {
        pointerId.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => {
        if (pointerId.current === e.pointerId) update(e);
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div ref={knob} className="absolute rounded-full bg-white/80 shadow" style={{ width: KNOB, height: KNOB, left: (SIZE - KNOB) / 2, top: (SIZE - KNOB) / 2 }} />
    </div>
  );
}

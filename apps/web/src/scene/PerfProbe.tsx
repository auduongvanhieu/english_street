import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { track } from '../net/analytics';
import { useSettings } from '../store/settings';

export interface PerfSample {
  fps: number;
  calls: number;
  triangles: number;
  quality: string;
}
declare global {
  interface Window {
    __esPerf?: PerfSample;
  }
}

const SAMPLE_AFTER_S = 15;

/** Averages FPS over a window, reads renderer draw calls, reports once per session (and keeps a live copy for the e2e scripts). */
export function PerfProbe() {
  const gl = useThree((s) => s.gl);
  const frames = useRef(0);
  const elapsed = useRef(0);
  const reported = useRef(false);
  useFrame((_, dt) => {
    frames.current += 1;
    elapsed.current += dt;
    if (elapsed.current < 2) return;
    const sample: PerfSample = {
      fps: Math.round(frames.current / elapsed.current),
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      quality: useSettings.getState().quality,
    };
    window.__esPerf = sample;
    frames.current = 0;
    elapsed.current = 0;
    // One sample per session, after the scene has settled.
    if (!reported.current && performance.now() > SAMPLE_AFTER_S * 1000) {
      reported.current = true;
      track('perf', { ...sample });
    }
  });
  return null;
}

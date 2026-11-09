import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { track } from '../net/analytics';
import { post } from '../net/api';
import { getPlayerId } from '../net/player';
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
  const scene = useThree((s) => s.scene);
  if (import.meta.env.DEV) (window as unknown as { __esScene?: unknown }).__esScene = scene; // e2e scripts
  const frames = useRef(0);
  const elapsed = useRef(0);
  const reported = useRef(false);
  const since = useRef(0);
  const lastQuality = useRef('');
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
    // switched quality: measure again (the admin site shows the player's graphics and FPS)
    if (sample.quality !== lastQuality.current) {
      lastQuality.current = sample.quality;
      reported.current = false;
      since.current = performance.now();
    }
    // One sample per session / quality, after the scene has settled.
    if (!reported.current && performance.now() > SAMPLE_AFTER_S * 1000 && performance.now() - since.current > 10_000) {
      reported.current = true;
      track('perf', { ...sample });
      void post(`/me/gfx?playerId=${encodeURIComponent(getPlayerId())}`, { quality: sample.quality, fps: sample.fps, calls: sample.calls, dpr: Math.round(gl.getPixelRatio() * 100) / 100 }).catch(() => undefined);
    }
  });
  return null;
}

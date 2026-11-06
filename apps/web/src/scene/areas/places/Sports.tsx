import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { AREA, BENCHES, BLEACHERS, COURT, FRAME, HALL, PING_PONG, PITCH, SCOREBOARD, TRACK, gamesInHall } from '../../../world/places/sports';
import { useArea } from '../../../store/area';
import { BuildingShell } from '../Building';
import { useSports } from '../../../store/sports';
import { serverNow } from '../../../net/client';

const Football = lazy(() => import('./Football'));
const Minigames = lazy(() => import('./Minigames'));
import { AreaGroup, Ground, Merged, Sign, box, cyl, sphere, tree, type Part } from '../kit';

const WHITE = '#ffffff';
const openGames = (e: { stopPropagation: () => void }) => {
  e.stopPropagation();
  useArea.getState().setPanel(true, 'activity');
};

/** Rain or storm in the real weather (checked every 2 s). */
function useRainy() {
  const [rainy, setRainy] = useState(gamesInHall);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 2) return;
    acc.current = 0;
    const r = gamesInHall();
    if (r !== rainy) setRainy(r);
  });
  return rainy;
}

/** Thin white line on the ground from (x0, z0) to (x1, z1). */
function line(p: Part, x0: number, z0: number, x1: number, z1: number, y = 0.03, w = 0.1) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  p.add(box(w, 0.01, len), WHITE, { p: [(x0 + x1) / 2, y, (z0 + z1) / 2], r: [0, Math.atan2(x1 - x0, z1 - z0), 0] });
}
function rectLines(p: Part, x0: number, x1: number, z0: number, z1: number, y = 0.03) {
  line(p, x0, z0, x1, z0, y);
  line(p, x0, z1, x1, z1, y);
  line(p, x0, z0, x0, z1, y);
  line(p, x1, z0, x1, z1, y);
}

/** Football pitch with goals, basketball court with hoops, running track, bleachers, table tennis, trees. */
function Outdoor() {
  const pcx = (PITCH.x0 + PITCH.x1) / 2;
  const pcz = (PITCH.z0 + PITCH.z1) / 2;
  const ccx = (COURT.x0 + COURT.x1) / 2;
  const ccz = (COURT.z0 + COURT.z1) / 2;
  return (
    <group>
      <Ground x0={-28} x1={28} z0={-23.5} z1={0} color="#a5d27f" y={0.006} />
      <Ground x0={TRACK.x0} x1={TRACK.x1} z0={TRACK.z0} z1={TRACK.z1} color="#c8553d" y={0.012} />
      <Ground x0={PITCH.x0} x1={PITCH.x1} z0={PITCH.z0} z1={PITCH.z1} color="#5cb85c" y={0.012} />
      <Ground x0={COURT.x0} x1={COURT.x1} z0={COURT.z0} z1={COURT.z1} color="#e08a3c" y={0.012} />
      {/* path from the gate, and to the hall door */}
      <Ground x0={-2} x1={2} z0={-9} z1={0} color="#e3d2b0" y={0.009} />
      <Ground x0={HALL.doorX - 1.6} x1={HALL.doorX + 1.6} z0={HALL.z1} z1={0} color="#e3d2b0" y={0.012} />
      <Merged
        castShadow={false}
        build={(p) => {
          // pitch: mowing stripes, lines, centre circle, penalty boxes
          for (let i = 0; i < 5; i++) p.add(box(2, 0.005, PITCH.z1 - PITCH.z0), '#52a852', { p: [PITCH.x0 + 1 + i * 4, 0.018, pcz] });
          rectLines(p, PITCH.x0 + 0.5, PITCH.x1 - 0.5, PITCH.z0 + 0.5, PITCH.z1 - 0.5);
          line(p, pcx, PITCH.z0 + 0.5, pcx, PITCH.z1 - 0.5);
          for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            p.add(box(0.1, 0.01, 0.5), WHITE, { p: [pcx + Math.cos(a) * 2, 0.03, pcz + Math.sin(a) * 2], r: [0, -a, 0] });
          }
          for (const s of [1, -1]) rectLines(p, s > 0 ? PITCH.x0 + 0.5 : PITCH.x1 - 3.5, s > 0 ? PITCH.x0 + 3.5 : PITCH.x1 - 0.5, pcz - 3.5, pcz + 3.5);
          // basketball court: lines, centre circle, keys
          rectLines(p, COURT.x0 + 0.3, COURT.x1 - 0.3, COURT.z0 + 0.3, COURT.z1 - 0.3);
          line(p, ccx, COURT.z0 + 0.3, ccx, COURT.z1 - 0.3);
          for (let i = 0; i < 20; i++) {
            const a = (i / 20) * Math.PI * 2;
            p.add(box(0.1, 0.01, 0.4), WHITE, { p: [ccx + Math.cos(a) * 1.3, 0.03, ccz + Math.sin(a) * 1.3], r: [0, -a, 0] });
          }
          for (const x of [COURT.x0 + 0.3, COURT.x1 - 2.6]) p.add(box(2.3, 0.008, 2.4), '#c0602a', { p: [x + 1.15, 0.02, ccz] });
          // track lanes and the start line
          for (let i = 1; i < TRACK.lanes; i++) line(p, TRACK.x0, TRACK.z0 + ((TRACK.z1 - TRACK.z0) * i) / TRACK.lanes, TRACK.x1, TRACK.z0 + ((TRACK.z1 - TRACK.z0) * i) / TRACK.lanes);
          for (const x of [TRACK.x0 + 2, TRACK.x1 - 2]) line(p, x, TRACK.z0, x, TRACK.z1, 0.03, 0.25);
        }}
      />
      <Merged
        build={(p) => {
          // goals: posts, crossbar, net frame
          for (const [x, s] of [
            [PITCH.x0 + 0.3, -1],
            [PITCH.x1 - 0.3, 1],
          ] as const) {
            for (const dz of [-1.6, 1.6]) p.add(cyl(0.07, 0.07, 1.6, 8), WHITE, { p: [x, 0.8, pcz + dz] });
            p.add(cyl(0.07, 0.07, 3.3, 8), WHITE, { p: [x, 1.6, pcz], r: [Math.PI / 2, 0, 0] });
            p.add(box(0.03, 1.5, 3.2), '#dfe6ea', { p: [x + s * 0.9, 0.8, pcz], r: [0, 0, s * 0.55] });
            for (const dz of [-1.6, 1.6]) p.add(box(1, 1.5, 0.03), '#dfe6ea', { p: [x + s * 0.45, 0.8, pcz + dz] });
          }
          // basketball hoops: pole, backboard, ring
          for (const [x, s] of [
            [COURT.x0 - 0.05, 1],
            [COURT.x1 + 0.05, -1],
          ] as const) {
            p.add(cyl(0.09, 0.1, 3.2, 8), '#3a4a5a', { p: [x, 1.6, ccz] });
            p.add(box(0.8, 0.08, 0.08), '#3a4a5a', { p: [x + s * 0.4, 3.0, ccz] });
            p.add(box(0.06, 1.0, 1.6), WHITE, { p: [x + s * 0.8, 3.1, ccz] });
            p.add(box(0.07, 0.4, 0.5), '#e05f5f', { p: [x + s * 0.8, 2.95, ccz] });
            for (let i = 0; i < 12; i++) {
              const a = (i / 12) * Math.PI * 2;
              p.add(box(0.05, 0.04, 0.15), '#ff7a1a', { p: [x + s * 1.1 + Math.cos(a) * 0.24, 2.75, ccz + Math.sin(a) * 0.24], r: [0, -a, 0] });
            }
            p.add(cyl(0.24, 0.16, 0.35, 10, true), '#f4f4f4', { p: [x + s * 1.1, 2.55, ccz] });
          }
          p.add(sphere(0.18, 0, Math.PI, 0, Math.PI * 2, 10, 8), '#e8742c', { p: [ccx + 1, 0.18, ccz - 1.4] });
          // bleachers: three steps of benches facing the pitch
          const bx = (BLEACHERS.minX + BLEACHERS.maxX) / 2;
          const bw = BLEACHERS.maxX - BLEACHERS.minX;
          for (let i = 0; i < 3; i++) {
            const z = BLEACHERS.minZ + 0.25 + i * 0.45;
            p.add(box(bw, 0.3 + i * 0.4, 0.45), '#8c9aa6', { p: [bx, (0.3 + i * 0.4) / 2, z] });
            p.add(box(bw, 0.08, 0.4), ['#2f80ed', '#f2c94c', '#e05f5f'][i]!, { p: [bx, 0.34 + i * 0.4, z] });
          }
          // table tennis tables
          for (const t of PING_PONG) {
            p.add(box(2.6, 0.06, 1.5), '#1f5fa8', { p: [t.x, 0.76, t.z] });
            line(p, t.x - 1.3, t.z, t.x + 1.3, t.z, 0.8, 0.03);
            p.add(box(0.04, 0.16, 1.6), '#f4f4f4', { p: [t.x, 0.87, t.z] });
            for (const dx of [-1.1, 1.1]) for (const dz of [-0.6, 0.6]) p.add(box(0.06, 0.74, 0.06), '#333', { p: [t.x + dx, 0.37, t.z + dz] });
          }
          // flags along the front, trees in the corners, hedges round the sides and back
          for (const [x, c] of [
            [-25, '#e05f5f'],
            [-15, '#2f80ed'],
            [8, '#f2c94c'],
            [14, '#43a047'],
            [26, '#ff9671'],
          ] as const) {
            p.add(cyl(0.05, 0.06, 4.5, 6), '#d0d0d0', { p: [x, 2.25, -0.7] });
            p.add(box(1.1, 0.7, 0.03), c, { p: [x + 0.58, 4.05, -0.7] });
          }
          for (const [x, z] of [
            [-27, -22.6],
            [-27, -8.5],
            [10.5, -22.6],
            [10.5, -9],
            [27, -6.5],
          ] as const)
            tree(p, x, z, 1.1);
          for (const sx of [-27.7, 27.7]) p.add(box(0.6, 1, 23.2), '#4f8f3e', { p: [sx, 0.5, -11.8] });
          // tall net behind the goals (keeps balls in)
          for (const x of [PITCH.x0 - 0.3]) {
            for (let z = PITCH.z0; z <= PITCH.z1 + 0.01; z += 3.25) p.add(cyl(0.05, 0.05, 3.5, 6), '#555', { p: [x, 1.75, z] });
            p.add(box(0.02, 3.2, PITCH.z1 - PITCH.z0), '#9fb3a0', { p: [x, 1.8, pcz] });
          }
          // water fountain + bins by the path
          p.add(cyl(0.25, 0.3, 0.9, 10), '#9aa7b3', { p: [3, 0.45, -7.6] });
          p.add(cyl(0.3, 0.2, 0.1, 10), '#cfd8df', { p: [3, 0.95, -7.6] });
          p.add(cyl(0.25, 0.22, 0.8, 10), '#2f80ed', { p: [4.2, 0.4, -7.6] });
        }}
      />
      <Sign x={-6.5} z={-7.6} text="Football" sub="Pitch" color="#2f7d4f" w={2.4} />
      <Sign x={BENCHES.redLocalX} z={BENCHES.signZ} text="Red team" sub="Join here" color="#c0392b" w={2.2} y={1.2} />
      <Sign x={BENCHES.blueLocalX} z={BENCHES.signZ} text="Blue team" sub="Join here" color="#1f5fb8" w={2.2} y={1.2} />
      <Sign x={-4.2} z={-12.2} text="Basketball" sub="Court" color="#c0602a" w={2.6} />
      <Text position={[TRACK.x0 + 2, 0.04, (TRACK.z0 + TRACK.z1) / 2]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} fontSize={0.6} color={WHITE} anchorX="center" anchorY="middle">
        START
      </Text>
      <Text position={[TRACK.x1 - 2, 0.04, (TRACK.z0 + TRACK.z1) / 2]} rotation={[-Math.PI / 2, 0, -Math.PI / 2]} fontSize={0.6} color={WHITE} anchorX="center" anchorY="middle">
        FINISH
      </Text>
    </group>
  );
}

/** Scoreboard behind the pitch; its message follows the weather. Tap it to play. */
function Scoreboard({ rainy }: { rainy: boolean }) {
  const { x, z } = SCOREBOARD;
  const red = useSports((s) => s.red);
  const blue = useSports((s) => s.blue);
  const endsAt = useSports((s) => s.endsAt);
  const [clock, setClock] = useState('4:00');
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - serverNow()) / 1000));
      setClock(`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);
  return (
    <group onClick={openGames}>
      <Merged
        build={(p) => {
          for (const dx of [-2, 2]) p.add(box(0.25, 3.2, 0.25), '#555', { p: [x + dx, 1.6, z] });
          p.add(box(5.2, 2.4, 0.3), '#1d2633', { p: [x, 4.2, z] });
          p.add(box(5.4, 0.2, 0.35), '#43a047', { p: [x, 5.45, z] });
        }}
      />
      <Text position={[x, 5.0, z + 0.17]} fontSize={0.36} color="#f2c94c" anchorX="center" anchorY="middle">
        SUNNY SPORTS PARK
      </Text>
      <Text position={[x - 1.25, 4.3, z + 0.17]} fontSize={0.48} color="#ff6b5c" anchorX="center" anchorY="middle">
        {`RED ${red}`}
      </Text>
      <Text position={[x, 4.3, z + 0.17]} fontSize={0.48} color="#ffffff" anchorX="center" anchorY="middle">
        :
      </Text>
      <Text position={[x + 1.25, 4.3, z + 0.17]} fontSize={0.48} color="#5ca8ff" anchorX="center" anchorY="middle">
        {`${blue} BLUE`}
      </Text>
      <Text position={[x, 3.5, z + 0.17]} fontSize={0.26} color={endsAt ? '#f2c94c' : rainy ? '#7fd0ff' : '#9ef59e'} anchorX="center" anchorY="middle" maxWidth={4.8} textAlign="center">
        {endsAt ? `TIME ${clock}` : rainy ? 'Rain today! Games in the hall' : 'Join a team and kick off!'}
      </Text>
    </group>
  );
}

/** Sports hall: indoor court, badminton net, wall bars, mats, ceiling lights (on when it rains). */
function Hall({ rainy }: { rainy: boolean }) {
  const cx = (HALL.x0 + HALL.x1) / 2;
  const cz = (HALL.z0 + HALL.z1) / 2;
  return (
    <group>
      <Merged
        castShadow={false}
        build={(p) => {
          rectLines(p, HALL.x0 + 1, HALL.x1 - 1, HALL.z0 + 1.2, HALL.z1 - 2.2, 0.04);
          line(p, HALL.x0 + 1, cz - 0.5, HALL.x1 - 1, cz - 0.5, 0.04);
        }}
      />
      <Merged
        build={(p) => {
          // badminton net across the court
          for (const x of [HALL.x0 + 1.5, HALL.x1 - 1.5]) p.add(cyl(0.05, 0.05, 1.6, 6), '#444', { p: [x, 0.8, cz - 0.5] });
          p.add(box(HALL.x1 - HALL.x0 - 3, 0.7, 0.02), '#f4f4f4', { p: [cx, 1.2, cz - 0.5] });
          p.add(box(HALL.x1 - HALL.x0 - 3, 0.06, 0.04), WHITE, { p: [cx, 1.56, cz - 0.5] });
          // wall bars on the back wall
          for (let i = 0; i < 6; i++) p.add(box(0.08, 2.6, 0.08), '#c9a26b', { p: [HALL.x0 + 1 + i * 0.6, 1.3, HALL.z0 + 0.3] });
          for (let y = 0.3; y < 2.6; y += 0.3) p.add(cyl(0.025, 0.025, 3.1, 6), '#c9a26b', { p: [HALL.x0 + 2.5, y, HALL.z0 + 0.3], r: [0, 0, Math.PI / 2] });
          // mats, a rack of balls, a bench
          p.add(box(2, 0.12, 1.2), '#2f80ed', { p: [HALL.x1 - 2, 0.06, HALL.z0 + 1.2] });
          p.add(box(2, 0.12, 1.2), '#2f80ed', { p: [HALL.x1 - 2, 0.18, HALL.z0 + 1.3] });
          p.add(box(1.4, 0.06, 0.5), '#888', { p: [HALL.x1 - 0.6, 0.5, cz + 1], r: [0, Math.PI / 2, 0] });
          for (let i = 0; i < 4; i++) p.add(sphere(0.17, 0, Math.PI, 0, Math.PI * 2, 8, 6), ['#e8742c', WHITE, '#f2c94c', '#e05f5f'][i]!, { p: [HALL.x1 - 0.6, 0.7, cz + 0.4 + i * 0.38] });
          p.add(box(3, 0.08, 0.4), '#a0703c', { p: [cx, 0.45, HALL.z1 - 0.8] });
          // ceiling lamps
          for (const x of [cx - 4, cx, cx + 4]) for (const z of [cz - 3, cz + 2]) p.add(box(1.4, 0.1, 0.4), rainy ? '#fffbe0' : '#b8b8b0', { p: [x, 3.0, z] });
        }}
        deps={[rainy]}
      />
      {/* lights on (unlit bright panels, no real light) */}
      {rainy
        ? [cx - 4, cx, cx + 4].flatMap((x) =>
            [cz - 3, cz + 2].map((z) => (
              <mesh key={`${x}:${z}`} position={[x, 2.94, z]}>
                <boxGeometry args={[1.3, 0.02, 0.32]} />
                <meshBasicMaterial color="#fffbe0" />
              </mesh>
            )),
          )
        : null}
      <Text position={[cx, 2.5, HALL.z0 + 0.2]} fontSize={0.4} color="#2f7d4f" anchorX="center" anchorY="middle">
        SPORTS HALL
      </Text>
    </group>
  );
}

/** Sunny Sports Park: football pitch, basketball court, running track, table tennis and the indoor sports hall. */
export default function Sports() {
  const rainy = useRainy();
  return (
    <>
    <Suspense fallback={null}>
      <Football />
      <Minigames />
    </Suspense>
    <AreaGroup area={AREA}>
      <Outdoor />
      <Scoreboard rainy={rainy} />
      <BuildingShell b={HALL} name="Sports Hall" frame={FRAME}>
        <Hall rainy={rainy} />
      </BuildingShell>
      {/* by the hall door: where today's games are */}
      <group onClick={openGames}>
        <Sign x={HALL.doorX + 3.2} z={HALL.z1 + 1.4} text={rainy ? 'Games in the hall today' : 'Games outside today'} sub={rainy ? "It's raining!" : "It's a sunny day!"} color={rainy ? '#2f6b8a' : '#2f7d4f'} />
      </group>
    </AreaGroup>
    </>
  );
}

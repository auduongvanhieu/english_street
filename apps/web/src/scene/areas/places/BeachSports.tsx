import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import type * as THREE from 'three';
import { preloadLpm, useLpmParts } from '../../LpmModel';
import { Part, box, chibiMaterial } from '../../chibi/buildChibi';
import { Chibi } from '../../chibi/Chibi';
import { SHOPPER_CHIBI } from '../../npcLook';
import { COURT, SURF_RACK, VOLLEY_SPOT } from '../../../world/sunnyBay';
import { useBeachSports } from '../../../store/beachSports';
import { useUsable } from '../../../world/usables';
import { useT } from '../../../i18n';

/**
 * Sunny Bay sports (store/beachSports.ts): the volleyball court with its net (LPM beach_sports SM_BS_Net), the other
 * team and our teammate, the ball flying over the net, and the surf school rack (SM_BS_Rack) with its sign.
 */
preloadLpm('beach_sports');

/** Court lines: 16 x 8 m rope lines on the sand. */
function Lines() {
  const geo = useMemo(() => {
    const p = new Part();
    const c = '#1e6fd9';
    for (const dz of [-8, 8]) p.add(box(8, 0.02, 0.06), c, { p: [0, 0.01, dz] });
    for (const dx of [-4, 4]) p.add(box(0.06, 0.02, 16), c, { p: [dx, 0.01, 0] });
    return p.build();
  }, []);
  return <mesh geometry={geo} material={chibiMaterial()} />;
}

/** The ball: high over our half while a call is waiting, flying over the net after a hit. */
function Ball({ geo }: { geo: THREE.BufferGeometry }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const v = useBeachSports.getState().volley;
    const m = ref.current;
    if (!m) return;
    m.visible = !!v;
    if (!v) return;
    const t = Math.min(1, (Date.now() - v.ballAt) / 1100);
    const from = v.ballTo === 'us' ? COURT.z - 4 : VOLLEY_SPOT.z - 1;
    const to = v.ballTo === 'us' ? VOLLEY_SPOT.z - 1 : COURT.z - 4;
    const z = from + (to - from) * t;
    const y = 1.2 + Math.sin(Math.PI * t) * 3.2 + (t >= 1 ? 1.4 + Math.sin(clock.elapsedTime * 3) * 0.15 : 0);
    m.position.set(COURT.x + (v.ballTo === 'us' ? 0.6 : -0.4), y, z);
  });
  return <mesh ref={ref} geometry={geo} material={chibiMaterial()} />;
}

function Players() {
  const playing = useBeachSports((s) => !!s.volley);
  const call = useBeachSports((s) => !!s.volley?.call);
  return (
    <>
      <group position={[COURT.x + 2, 0, VOLLEY_SPOT.z - 1.5]} rotation-y={Math.PI}>
        <Chibi spec={SHOPPER_CHIBI[2]!} anim={call ? 'talk' : playing ? 'wave' : 'idle'} />
      </group>
      {[-2, 2].map((dx, i) => (
        <group key={dx} position={[COURT.x + dx, 0, COURT.z - 4]}>
          <Chibi spec={SHOPPER_CHIBI[i === 0 ? 0 : 3]!} anim={playing ? 'wave' : 'idle'} />
        </group>
      ))}
    </>
  );
}

function Usables() {
  const t = useT();
  const volley = useBeachSports((s) => !!s.volley);
  const surf = useBeachSports((s) => !!s.surf);
  useUsable(volley ? null : { id: 'beach-volley', x: VOLLEY_SPOT.x, z: VOLLEY_SPOT.z + 1, r: 2.2, icon: '🏐', label: t('Play beach volleyball'), use: () => useBeachSports.getState().startVolley() });
  useUsable(surf ? null : { id: 'beach-surf', x: SURF_RACK.x, z: SURF_RACK.z + 1.4, r: 1.8, icon: '🏄', label: t('Surf lesson (Jack)'), priority: true, use: () => useBeachSports.getState().openSurf() });
  return null;
}

export default function BeachSports() {
  const kit = useLpmParts('beach_sports');
  const mat = chibiMaterial();
  return (
    <group>
      <group position={[COURT.x, 0, COURT.z]}>
        <Lines />
        {kit['SM_BS_Net'] ? <mesh geometry={kit['SM_BS_Net']} material={mat} castShadow /> : null}
      </group>
      {kit['SM_BS_Ball'] ? <Ball geo={kit['SM_BS_Ball']} /> : null}
      <Players />
      <group position={[SURF_RACK.x, 0, SURF_RACK.z]}>
        {kit['SM_BS_Rack'] ? <mesh geometry={kit['SM_BS_Rack']} material={mat} castShadow /> : null}
        <Text position={[0, 2.11, -0.18]} fontSize={0.26} color="#ffffff" anchorX="center" anchorY="middle">
          SURF SCHOOL
        </Text>
      </group>
      <Usables />
    </group>
  );
}

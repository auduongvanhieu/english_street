import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CONES_LOCAL, COACH_SPOT_LOCAL, HOOP_SPOT_LOCAL, RACE_START_LOCAL, useMini, type ConeColor } from '../../../store/minigames';
import { useLpmParts } from '../../LpmModel';
import { chibiMaterial } from '../../chibi/buildChibi';
import { useUsable } from '../../../world/usables';
import { FRAME } from '../../../world/places/sports';
import { t } from '../../../i18n';

/**
 * Sports park minigames in 3D (world coordinates): where each game starts (walk up, press E / the button), the
 * three coloured cones for "Coach says", and the basketball flying to the hoop. Game logic: store/minigames.ts.
 */
const CONE_RGB: Record<ConeColor, THREE.Color> = { red: new THREE.Color('#e05a47'), blue: new THREE.Color('#2f80ed'), yellow: new THREE.Color('#f6c945') };

/** The orange cone recoloured (vertex colours) for each colour. */
function useCones() {
  const parts = useLpmParts('sports_kit');
  return useMemo(() => {
    const base = parts['SM_SP_Cone']!;
    const out = {} as Record<ConeColor, THREE.BufferGeometry>;
    for (const c of Object.keys(CONE_RGB) as ConeColor[]) {
      const g = base.clone();
      const col = g.getAttribute('color') as THREE.BufferAttribute | undefined;
      if (col) {
        // the cone's orange is its most common colour: swap it (whatever the attribute's encoding)
        const key = (i: number) => `${col.getX(i).toFixed(3)},${col.getY(i).toFixed(3)},${col.getZ(i).toFixed(3)}`;
        const count = new Map<string, number>();
        for (let i = 0; i < col.count; i++) count.set(key(i), (count.get(key(i)) ?? 0) + 1);
        const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0]![0];
        // write the new colour in the same encoding: THREE.Color holds linear values; the GLB may store sRGB
        const storedLinear = Math.abs(Number(top.split(',')[0]) - new THREE.Color('#f2994a').r) < 0.05;
        const to = CONE_RGB[c].clone();
        if (!storedLinear) to.convertLinearToSRGB();
        for (let i = 0; i < col.count; i++) if (key(i) === top) col.setXYZ(i, to.r, to.g, to.b);
        col.needsUpdate = true;
      }
      g.scale(1.6, 1.6, 1.6);
      out[c] = g;
    }
    return out;
  }, [parts]);
}

function Cones() {
  const cones = useCones();
  return (
    <group>
      {(Object.keys(CONES_LOCAL) as ConeColor[]).map((c) => {
        const [x, z] = FRAME.toWorld(CONES_LOCAL[c].x, CONES_LOCAL[c].z);
        return (
          <group key={c} position={[x, 0, z]}>
            <mesh geometry={cones[c]} material={chibiMaterial()} castShadow />
            <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
              <circleGeometry args={[0.7, 20]} />
              <meshBasicMaterial color={CONE_RGB[c]} transparent opacity={0.35} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** A start spot: a ring on the ground and the usable. */
function StartSpot({ id, local, icon, label }: { id: 'hoops' | 'race' | 'coach'; local: { x: number; z: number }; icon: string; label: string }) {
  const game = useMini((s) => s.game);
  const phase = useMini((s) => s.phase);
  const [x, z] = FRAME.toWorld(local.x, local.z);
  const playing = game === id && phase !== 'done';
  useUsable(
    game && game !== id && phase !== 'done'
      ? null
      : {
          id: `mini-${id}`,
          x,
          z,
          r: id === 'hoops' && playing ? 3 : 1.5,
          icon: playing && id === 'hoops' ? '🏀' : icon,
          label: playing ? (id === 'hoops' ? t('Throw!') : t('Stop the game')) : phase === 'done' && game === id ? t('Play again') : label,
          use: () => {
            const s = useMini.getState();
            if (s.game === id && s.phase !== 'done') {
              if (id === 'hoops') s.throwBall();
              else s.stop();
            } else s.start(id);
          },
        },
  );
  return (
    <mesh position={[x, 0.025, z]} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[0.55, 0.7, 24]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.7} depthWrite={false} />
    </mesh>
  );
}

/** The basketball of the current throw: an arc to the rim, then through the net (made) or off to the side. */
function FlyingBall() {
  const parts = useLpmParts('sports_kit');
  const geo = useMemo(() => parts['SM_SP_Basketball']!.clone().translate(0, -0.12, 0), [parts]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const shot = useMini.getState().shot;
    if (!shot) {
      m.visible = false;
      return;
    }
    m.visible = true;
    const k = Math.min(1.6, (performance.now() - shot.t0) / 700);
    const [ax, ay, az] = shot.from;
    const [bx, by, bz] = shot.to;
    if (k <= 1) {
      m.position.set(ax + (bx - ax) * k, ay + (by + 0.3 - ay) * k + 1.6 * Math.sin(Math.PI * k), az + (bz - az) * k);
    } else {
      // after the rim: drop through the net, or bounce away
      const d = k - 1;
      const away = shot.made ? 0 : d * 1.5;
      m.position.set(bx + (bx - ax) * 0.1 * away, Math.max(0.12, by + 0.3 - 9 * d * d - (shot.made ? 0.3 : 0)), bz + (bz - az) * 0.1 * away);
    }
    m.rotation.x += 0.2;
  });
  return <mesh ref={ref} geometry={geo} material={chibiMaterial()} castShadow visible={false} />;
}

export default function Minigames() {
  return (
    <group>
      <Cones />
      <StartSpot id="hoops" local={HOOP_SPOT_LOCAL} icon="🏀" label={t('Play hoops (10 throws)')} />
      <StartSpot id="race" local={{ x: RACE_START_LOCAL.x - 1, z: RACE_START_LOCAL.z }} icon="🏃" label={t('Start a race')} />
      <StartSpot id="coach" local={COACH_SPOT_LOCAL} icon="📣" label={t('Play "Coach says"')} />
      <FlyingBall />
    </group>
  );
}

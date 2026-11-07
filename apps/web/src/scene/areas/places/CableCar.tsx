import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { serverNow } from '../../../net/client';
import { preloadLpm, useLpmParts } from '../../LpmModel';
import { chibiMaterial } from '../../chibi/buildChibi';
import { CC_BOTTOM, CC_PYLON, CC_PYLON_SCALE, CC_ROT, CC_SINK, CC_TOP, cablePoint, cabinPose, ccPlatform, groundAt } from '../../../world/mapleHill';
import { useTripRides } from '../../../store/tripRides';
import { useUsable } from '../../../world/usables';
import { useT } from '../../../i18n';

/**
 * The Maple Hill cable car (world/mapleHill.ts, store/tripRides.ts): two stations, a pylon, two cables and the two
 * cabins moving on the shared clock (everyone sees the same cabins). LPM cablecar_kit.
 */
preloadLpm('cablecar_kit');
const cableMat = new THREE.MeshBasicMaterial({ color: '#2b2f33' });

/** The cables: thin boxes from station to pylon to station, either side of the line. */
function Cables() {
  const segs = useMemo(() => {
    const out: { pos: THREE.Vector3; quat: THREE.Quaternion; len: number }[] = [];
    for (const side of [1, -1])
      for (const [a, b] of [
        [0, 0.5],
        [0.5, 1],
      ] as const) {
        const p = cablePoint(a, side);
        const q = cablePoint(b, side);
        const va = new THREE.Vector3(p.x, p.y, p.z);
        const vb = new THREE.Vector3(q.x, q.y, q.z);
        const dir = vb.clone().sub(va);
        out.push({ pos: va.clone().add(vb).multiplyScalar(0.5), quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize()), len: dir.length() });
      }
    return out;
  }, []);
  return (
    <>
      {segs.map((s, i) => (
        <mesh key={i} position={s.pos} quaternion={s.quat} material={cableMat}>
          <boxGeometry args={[0.05, 0.05, s.len]} />
        </mesh>
      ))}
    </>
  );
}

function Cabin({ k, geo }: { k: number; geo: THREE.BufferGeometry }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const p = cabinPose(k, serverNow());
    ref.current?.position.set(p.x, p.y - 0.1, p.z);
  });
  return <mesh ref={ref} geometry={geo} material={chibiMaterial()} rotation-y={CC_ROT} castShadow />;
}

function Usables() {
  const t = useT();
  const busy = useTripRides((s) => !!s.cable && s.cable.stage !== 'quiz');
  const b = ccPlatform('bottom');
  const top = ccPlatform('top');
  useUsable(busy ? null : { id: 'cable-bottom', x: b.x, z: b.z, r: 2.2, icon: '🚡', label: t('Cable car to the summit'), priority: true, use: () => useTripRides.getState().openCable('bottom') });
  useUsable(busy ? null : { id: 'cable-top', x: top.x, z: top.z, r: 2.2, icon: '🚡', label: t('Cable car down to the meadow'), priority: true, use: () => useTripRides.getState().openCable('top') });
  return null;
}

export default function CableCar() {
  const kit = useLpmParts('cablecar_kit');
  const mat = chibiMaterial();
  const yB = groundAt(CC_BOTTOM.x, CC_BOTTOM.z) + CC_SINK;
  const yT = groundAt(CC_TOP.x, CC_TOP.z) + CC_SINK;
  const yP = groundAt(CC_PYLON.x, CC_PYLON.z);
  // the sign hangs on the station's front (its +Z side here, away from the line)
  const sign = (x: number, z: number, y: number, text: string, rot: number) => (
    <group position={[x, y, z]} rotation-y={rot}>
      <Text position={[0, 4.15, 2.5]} fontSize={0.34} color="#ffffff" anchorX="center" anchorY="middle">
        {text}
      </Text>
    </group>
  );
  return (
    <group>
      {kit['SM_CC_Station'] ? (
        <>
          <mesh geometry={kit['SM_CC_Station']} material={mat} position={[CC_BOTTOM.x, yB, CC_BOTTOM.z]} rotation-y={CC_ROT} castShadow receiveShadow />
          <mesh geometry={kit['SM_CC_Station']} material={mat} position={[CC_TOP.x, yT, CC_TOP.z]} rotation-y={CC_ROT + Math.PI} castShadow receiveShadow />
        </>
      ) : null}
      {sign(CC_BOTTOM.x, CC_BOTTOM.z, yB, 'CABLE CAR · TO THE SUMMIT', CC_ROT)}
      {sign(CC_TOP.x, CC_TOP.z, yT, 'CABLE CAR · TO THE MEADOW', CC_ROT + Math.PI)}
      {kit['SM_CC_Pylon'] ? <mesh geometry={kit['SM_CC_Pylon']} material={mat} position={[CC_PYLON.x, yP, CC_PYLON.z]} rotation-y={CC_ROT} scale={[1, CC_PYLON_SCALE, 1]} castShadow /> : null}
      <Cables />
      {kit['SM_CC_Gondola'] ? [0, 1].map((k) => <Cabin key={k} k={k} geo={kit['SM_CC_Gondola']!} />) : null}
      <Usables />
    </group>
  );
}

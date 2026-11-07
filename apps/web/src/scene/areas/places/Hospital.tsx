import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { clinicTick, roomName, useClinic } from '../../../store/clinic';
import { CONSULT_DOOR, PHARMACY_SPOT, RECEPTION_SPOT } from '../../../world/clinic';
import { useUsable } from '../../../world/usables';
import { useT } from '../../../i18n';
import { useArea } from '../../../store/area';
import { AMBULANCE, AREA, CHAIR_ROWS, FRAME, GARDEN_BENCHES, GARDEN_TREES, HOSPITAL, PHARMACY_COUNTER, RECEPTION, SHELF } from '../../../world/places/hospital';
import { BuildingShell } from '../Building';
import { AreaGroup, Ground, Merged, type Part, box, cyl, sphere, tree } from '../kit';

const openActivity = (e: { stopPropagation: () => void }) => {
  e.stopPropagation();
  useArea.getState().setPanel(true, 'activity');
};

const BOX_COLORS = ['#ef5350', '#42a5f5', '#66bb6a', '#ffca28', '#ab47bc', '#ff7043', '#26c6da', '#f48fb1', '#ffffff'];

/** A plus-shaped cross facing +z. */
function cross(p: Part, x: number, y: number, z: number, s: number, color: string) {
  p.add(box(s, s / 3, 0.08), color, { p: [x, y, z] });
  p.add(box(s / 3, s, 0.08), color, { p: [x, y, z] });
}

/** Reception, waiting room, ward door and the pharmacy counter. */
function Interior() {
  const pc = (PHARMACY_COUNTER.minX + PHARMACY_COUNTER.maxX) / 2;
  const pw = PHARMACY_COUNTER.maxX - PHARMACY_COUNTER.minX;
  const pz = (PHARMACY_COUNTER.minZ + PHARMACY_COUNTER.maxZ) / 2;
  const rc = (RECEPTION.minX + RECEPTION.maxX) / 2;
  const rz = (RECEPTION.minZ + RECEPTION.maxZ) / 2;
  return (
    <Merged
      build={(p) => {
        // reception desk with a computer and a bell
        p.add(box(RECEPTION.maxX - RECEPTION.minX, 1.05, 0.8), '#26a69a', { p: [rc, 0.52, rz] });
        p.add(box(RECEPTION.maxX - RECEPTION.minX + 0.1, 0.06, 0.9), '#e0f2f1', { p: [rc, 1.08, rz] });
        p.add(box(0.6, 0.4, 0.05), '#263238', { p: [rc - 1.2, 1.35, rz - 0.2] });
        p.add(box(0.06, 0.2, 0.06), '#263238', { p: [rc - 1.2, 1.15, rz - 0.22] });
        p.add(sphere(0.08, 0, Math.PI / 2, 0, Math.PI * 2, 10, 6), '#f2c94c', { p: [rc + 1.5, 1.11, rz + 0.1] });
        // waiting-room chairs (rows facing the front), a water cooler and a low table with magazines
        for (const r of CHAIR_ROWS) {
          p.add(box(r.x1 - r.x0, 0.08, 0.08), '#607d8b', { p: [(r.x0 + r.x1) / 2, 0.3, r.z] });
          for (let x = r.x0 + 0.5; x < r.x1; x += 1.0) {
            p.add(box(0.75, 0.08, 0.6), '#4db6ac', { p: [x, 0.45, r.z] });
            p.add(box(0.75, 0.6, 0.08), '#4db6ac', { p: [x, 0.78, r.z - 0.3] });
            p.add(box(0.06, 0.4, 0.06), '#607d8b', { p: [x, 0.22, r.z] });
          }
        }
        p.add(box(0.5, 1.0, 0.5), '#eceff1', { p: [-19.2, 0.5, -19.5] });
        p.add(cyl(0.2, 0.2, 0.5, 12), '#81d4fa', { p: [-19.2, 1.25, -19.5] });
        // ward door (painted) and an X-ray door on the back wall
        p.add(box(1.6, 2.3, 0.06), '#80cbc4', { p: [-12, 1.15, HOSPITAL.z0 + 0.18] });
        p.add(box(1.2, 2.2, 0.06), '#b0bec5', { p: [-4, 1.1, HOSPITAL.z0 + 0.18] });
        // pharmacy: counter, side wall, shelves full of colourful boxes, a green cross
        p.add(box(pw, 1.05, 0.8), '#ffffff', { p: [pc, 0.52, pz] });
        p.add(box(pw + 0.1, 0.06, 0.9), '#26a69a', { p: [pc, 1.08, pz] });
        p.add(box(pw, 0.2, 0.82), '#26a69a', { p: [pc, 0.85, pz] });
        p.add(box(0.3, 3.2, HOSPITAL.z0 * -1 + PHARMACY_COUNTER.maxZ), '#fbfbf8', { p: [5, 1.6, (HOSPITAL.z0 + PHARMACY_COUNTER.maxZ) / 2] });
        p.add(box(0.5, 0.3, 0.35), '#455a64', { p: [pc + 3.5, 1.26, pz] }); // till
        cross(p, pc - 2.6, 2.75, HOSPITAL.z0 + 0.2, 0.9, '#2e9e4f');
        // pills on the counter
        for (const [dx, c] of [[-2, '#ef5350'], [-1.6, '#42a5f5'], [1, '#ffca28']] as const) p.add(box(0.3, 0.2, 0.2), c, { p: [pc + dx, 1.21, pz] });
        // plants
        for (const [x, z] of [[-19, -9], [19, -9], [3.5, -9], [-3.5, -9]] as const) {
          p.add(cyl(0.28, 0.22, 0.5, 10), '#26a69a', { p: [x, 0.25, z] });
          p.add(sphere(0.42, 0, Math.PI, 0, Math.PI * 2, 10, 8), '#4f9a44', { p: [x, 0.8, z] });
        }
      }}
    />
  );
}

/** The medicine shelves: one merged mesh; tapping them opens the pharmacy game. */
function Shelves() {
  const len = SHELF.x1 - SHELF.x0;
  const cx = (SHELF.x0 + SHELF.x1) / 2;
  return (
    <Merged
      onClick={openActivity}
      build={(p) => {
        p.add(box(len, 2.4, 0.5), '#e0e0e0', { p: [cx, 1.2, SHELF.z] });
        for (const y of [0.35, 0.9, 1.45, 2.0]) {
          p.add(box(len, 0.05, 0.6), '#bdbdbd', { p: [cx, y, SHELF.z + 0.05] });
          let i = Math.round(y * 7);
          for (let x = SHELF.x0 + 0.3; x < SHELF.x1 - 0.2; x += 0.38) {
            i++;
            const tall = i % 4 === 0;
            const bottle = i % 5 === 0;
            const c = BOX_COLORS[(i * 7) % BOX_COLORS.length]!;
            if (bottle) {
              p.add(cyl(0.1, 0.1, 0.32, 8), '#8d4e2a', { p: [x, y + 0.19, SHELF.z + 0.18] });
              p.add(cyl(0.06, 0.06, 0.06, 8), '#ffffff', { p: [x, y + 0.38, SHELF.z + 0.18] });
            } else p.add(box(0.28, tall ? 0.38 : 0.24, 0.2), c, { p: [x, y + (tall ? 0.21 : 0.14), SHELF.z + 0.18] });
          }
        }
      }}
    />
  );
}

/** White ambulance with red stripes and a blue light bar, parked in the bay. */
function Ambulance() {
  const { x, z, len, w } = AMBULANCE;
  return (
    <group position={[x, 0, z]}>
      <Merged
        build={(p) => {
          p.add(box(len - 1.4, 2.3, w), '#ffffff', { p: [-0.7, 1.55, 0] });
          p.add(box(1.4, 1.5, w), '#ffffff', { p: [len / 2 - 0.7, 1.15, 0] });
          p.add(box(0.05, 0.7, w - 0.4), '#2b3a55', { p: [len / 2 + 0.01, 1.5, 0], r: [0, 0, -0.3] });
          for (const s of [-1, 1]) {
            p.add(box(len - 1.4, 0.3, 0.02), '#e53935', { p: [-0.7, 1.15, s * (w / 2 + 0.01)] });
            p.add(box(0.8, 0.6, 0.02), '#2b3a55', { p: [len / 2 - 0.7, 1.55, s * (w / 2 + 0.01)] });
            cross(p, -1.6, 2.0, s * (w / 2 + 0.03), 0.7, '#e53935');
          }
          p.add(box(0.9, 0.2, 1.2), '#1e88e5', { p: [0.4, 2.8, 0] });
          p.add(box(0.05, 1.6, 1.8), '#cfd8dc', { p: [-len / 2 + 0.01, 1.5, 0] }); // back doors
          for (const dx of [-len / 2 + 1, len / 2 - 1]) for (const s of [-1, 1]) p.add(cyl(0.38, 0.38, 0.25, 12), '#263238', { p: [dx, 0.38, s * (w / 2 - 0.1)], r: [Math.PI / 2, 0, 0] });
        }}
      />
      {[1, -1].map((s) => (
        <Text key={s} position={[0.2, 1.55, s * (w / 2 + 0.04)]} rotation-y={s > 0 ? 0 : Math.PI} fontSize={0.32} color="#e53935" anchorX="center" anchorY="middle">
          AMBULANCE
        </Text>
      ))}
    </group>
  );
}

/** Garden (benches, trees, flower beds), hedges, a sign with a green cross, the ambulance bay markings. */
function Grounds() {
  return (
    <Merged
      build={(p) => {
        for (const b of GARDEN_BENCHES) {
          p.add(box(2, 0.1, 0.5), '#8d6e63', { p: [b.x, 0.45, b.z] });
          p.add(box(2, 0.45, 0.08), '#8d6e63', { p: [b.x, 0.72, b.z - 0.25] });
          for (const dx of [-0.85, 0.85]) p.add(box(0.08, 0.45, 0.45), '#455a64', { p: [b.x + dx, 0.22, b.z] });
        }
        for (const [x, z] of GARDEN_TREES) tree(p, x, z, 1.15);
        // flower beds along the path
        for (const s of [-1, 1])
          for (let z = -1.2; z > -7.5; z -= 0.7) {
            p.add(box(0.6, 0.2, 0.6), '#6d4c41', { p: [s * 2.4, 0.1, z] });
            p.add(sphere(0.2, 0, Math.PI, 0, Math.PI * 2, 8, 6), ['#f06292', '#ffd54f', '#ba68c8', '#ffffff'][Math.round(-z * 1.5) % 4]!, { p: [s * 2.4, 0.32, z] });
          }
        // hedges on the sides
        for (const s of [-1, 1]) p.add(box(0.7, 0.8, 23), '#4f8f3a', { p: [s * 27.5, 0.4, -11.8] });
        p.add(box(55, 0.8, 0.7), '#4f8f3a', { p: [0, 0.4, -23.2] });
        // sign by the gate: green cross on a white board
        p.add(box(0.12, 2.2, 0.12), '#90a4ae', { p: [-4.2, 1.1, -1.0] });
        p.add(box(1.6, 1.6, 0.12), '#ffffff', { p: [-4.2, 2.6, -1.0] });
        cross(p, -4.2, 2.6, -0.93, 1.1, '#2e9e4f');
        // ambulance bay lines
        p.add(box(0.15, 0.02, 3.4), '#f2c94c', { p: [AMBULANCE.x - 3.4, 0.02, AMBULANCE.z] });
        p.add(box(0.15, 0.02, 3.4), '#f2c94c', { p: [AMBULANCE.x + 3.4, 0.02, AMBULANCE.z] });
        p.add(box(6.95, 0.02, 0.15), '#f2c94c', { p: [AMBULANCE.x, 0.02, AMBULANCE.z - 1.7] });
      }}
    />
  );
}

/** A visit to the doctor: check in at reception, the consulting-room door when your number is called, the pharmacy. */
function VisitUsables() {
  const t = useT();
  const stage = useClinic((s) => s.stage);
  const room = useClinic((s) => s.room);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.25) return;
    acc.current = 0;
    clinicTick();
  });
  useUsable({ id: 'hospital-reception', x: RECEPTION_SPOT[0], z: RECEPTION_SPOT[1], r: 1.8, icon: '🩺', label: t('See a doctor'), priority: true, disabled: stage && stage !== 'done' ? t('You are already checked in') : undefined, use: () => useClinic.getState().start() });
  useUsable({
    id: 'hospital-consult',
    x: CONSULT_DOOR.world[0],
    z: CONSULT_DOOR.world[1],
    r: 1.6,
    icon: '🚪',
    label: stage === 'called' ? `${t('Go in')}: ${roomName(room)}` : roomName(room),
    disabled: stage === 'called' ? undefined : stage === 'waiting' ? t('Wait for your number') : t('Check in at reception first'),
    use: () => useClinic.getState().enterRoom(),
  });
  useUsable(stage === 'pharmacy' ? { id: 'hospital-pharmacy', x: PHARMACY_SPOT[0], z: PHARMACY_SPOT[1], r: 1.8, icon: '💊', label: t('Pick up your medicine'), priority: true, use: () => useClinic.getState().openPharmacy() } : null);
  return null;
}

export default function Hospital() {
  const pc = (PHARMACY_COUNTER.minX + PHARMACY_COUNTER.maxX) / 2;
  const rc = (RECEPTION.minX + RECEPTION.maxX) / 2;
  return (
    <AreaGroup area={AREA}>
      <Ground x0={-28} x1={28} z0={-23.5} z1={0} color="#a9d98a" y={0.006} />
      <Ground x0={-1.8} x1={1.8} z0={-8} z1={0} color="#e6e1d6" y={0.012} />
      <Ground x0={8} x1={22} z0={-7.4} z1={-0.6} color="#9ea4a8" y={0.012} />
      <BuildingShell b={HOSPITAL} name="City Hospital" frame={FRAME}>
        <Interior />
        <Shelves />
        <Text position={[rc, 2.6, RECEPTION.minZ - 0.1]} rotation-y={0} fontSize={0.42} color="#00897b" anchorX="center" anchorY="middle">
          RECEPTION
        </Text>
        <Text position={[-12.5, 2.75, HOSPITAL.z0 + 0.22]} fontSize={0.32} color="#00897b" anchorX="center" anchorY="middle">
          WAITING ROOM · WARDS →
        </Text>
        <Text position={[-4, 2.45, HOSPITAL.z0 + 0.22]} fontSize={0.24} color="#455a64" anchorX="center" anchorY="middle">
          X-RAY
        </Text>
        {/* door to the consulting rooms (they are off the map: scene/areas/places/Clinic.tsx) */}
        <mesh position={[CONSULT_DOOR.local.x, 1.05, HOSPITAL.z0 + 0.2]}>
          <boxGeometry args={[1.2, 2.1, 0.08]} />
          <meshStandardMaterial color="#80cbc4" />
        </mesh>
        <Text position={[CONSULT_DOOR.local.x, 2.35, HOSPITAL.z0 + 0.25]} fontSize={0.2} color="#00897b" anchorX="center" anchorY="middle">
          CONSULTING ROOMS
        </Text>
        <VisitUsables />
        <Text position={[pc + 0.6, 2.75, HOSPITAL.z0 + 0.22]} fontSize={0.42} color="#2e9e4f" anchorX="center" anchorY="middle">
          PHARMACY
        </Text>
      </BuildingShell>
      <Grounds />
      <Ambulance />
      <Text position={[-4.2, 3.6, -0.94]} fontSize={0.3} color="#00897b" anchorX="center" anchorY="middle" outlineWidth={0.03} outlineColor="#ffffff">
        City Hospital
      </Text>
      <Text position={[-4.2, 1.6, -0.94]} fontSize={0.18} color="#37474f" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#ffffff">
        {'Reception · Pharmacy\nEmergency 24 h'}
      </Text>
    </AreaGroup>
  );
}

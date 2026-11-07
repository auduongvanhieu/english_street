import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { ANIMAL_INFO, FIELD_PLOTS, MAX_FIELDS, MY_FARM, MY_FARMS_AREA, animalStage, inRect, myFarm, myFarmAt, myPlotStage, type MyAnimal, type MyPlot } from '@es/shared';
import { localPos } from '../../LocalPlayer';
import { preloadLpm, useLpmParts } from '../../LpmModel';
import { Merged, Sign, box, fenceRect } from '../kit';
import { Animal } from '../Animal';
import { Marker, Plants } from '../Farm';
import { enclosurePath } from '../../../world/zooLayout';
import { BARN, BIN, DOG_HOUSE, GATE_W, LOG_BOARD, PENS, PLOT, SHOP, blockersFor, plotPos } from '../../../world/myFarmLayout';
import { setDynamicBlockers } from '../../../world/layout';
import { useMyFarm } from '../../../store/myFarm';
import { useUsable } from '../../../world/usables';
import { useT } from '../../../i18n';

/**
 * "My farm" (store/myFarm.ts, world/myFarmLayout.ts): the farm you are in, drawn at its slot. Your own farm is
 * interactive (plots, pens, the shipping bin, the shop board); a friend's farm is to look at. Props: farm_kit.
 */
preloadLpm('farm_kit');

function Static({ fields }: { fields: number }) {
  const kit = useLpmParts('farm_kit');
  const W = MY_FARM.w / 2;
  const D = MY_FARM.d / 2;
  return (
    <Merged
      deps={[kit, fields]}
      build={(p) => {
        // fence all round, the gate gap in the north side
        fenceRect(p, -W, W, -D, D, '#8a6a44', 1.05, [], [[-GATE_W / 2, GATE_W / 2]]);
        for (const x of [-GATE_W / 2, GATE_W / 2]) p.add(box(0.3, 2.2, 0.3), '#6e4a26', { p: [x, 1.1, D] });
        p.add(box(GATE_W + 0.6, 0.35, 0.3), '#a0703c', { p: [0, 2.3, D] });
        // paths
        p.add(box(3, 0.02, MY_FARM.d - 1), '#d9c49a', { p: [0.5, 0.012, 0] });
        p.add(box(MY_FARM.w - 2, 0.02, 2.6), '#d9c49a', { p: [0, 0.013, -0.5] });
        // pens: ground and fence (no gap: animals stay in)
        for (const pen of PENS) {
          p.add(box(pen.x1 - pen.x0, 0.02, pen.z1 - pen.z0), pen.ground, { p: [(pen.x0 + pen.x1) / 2, 0.015, (pen.z0 + pen.z1) / 2] });
          fenceRect(p, pen.x0, pen.x1, pen.z0, pen.z1, '#8a6a44', 1.0);
        }
        p.addColored(kit.SM_Coop!, { p: [8.5, 0, 12] });
        p.addColored(kit.SM_Trough!, { p: [15, 0, 13] });
        p.addColored(kit.SM_Trough!, { p: [15, 0, -14] });
        p.addColored(kit.SM_HayBale!, { p: [6, 0, -13.5], r: [0, 0.4, 0] });
        p.addColored(kit.SM_Barn!, { p: [BARN.x, 0, BARN.z] });
        // fields: soil beds (bought ones) and grass with a stake (not yet)
        for (let i = 0; i < MAX_FIELDS * FIELD_PLOTS; i++) {
          const { x, z } = plotPos(i);
          const owned = Math.floor(i / FIELD_PLOTS) < fields;
          p.add(box(PLOT, 0.12, PLOT), owned ? '#6b4a30' : '#93b867', { p: [x, 0.06, z] });
          if (owned) for (const dz of [-0.6, 0, 0.6]) p.add(box(PLOT - 0.3, 0.06, 0.25), '#4f3422', { p: [x, 0.14, z + dz] });
        }
        // shipping bin
        p.add(box(1.3, 0.8, 0.9), '#a0703c', { p: [BIN.x, 0.4, BIN.z] });
        p.add(box(1.4, 0.08, 1.0), '#6e4a26', { p: [BIN.x, 0.84, BIN.z] });
        // dog house (empty for now)
        p.add(box(1.2, 0.9, 1.2), '#c0392b', { p: [DOG_HOUSE.x, 0.45, DOG_HOUSE.z] });
        p.add(box(1.4, 0.12, 1.4), '#6e4a26', { p: [DOG_HOUSE.x, 0.96, DOG_HOUSE.z] });
      }}
    />
  );
}

function Plots({ plots, now, fields }: { plots: MyPlot[]; now: number; fields: number }) {
  return (
    <group>
      {plots.slice(0, fields * FIELD_PLOTS).map((pl, i) => {
        const { x, z } = plotPos(i);
        const st = myPlotStage(pl, now);
        return (
          <group key={i} position={[x, 0, z]}>
            {pl.crop ? <Plants crop={pl.crop} stage={st.stage} progress={st.progress} /> : null}
            {st.stage === 'seed' ? <Marker kind="water" y={0.9} /> : null}
            {st.stage === 'ready' ? <Marker kind="ready" y={pl.crop === 'corn' ? 2.3 : 1.3} /> : null}
          </group>
        );
      })}
    </group>
  );
}

function Animals({ slot, animals, now }: { slot: number; animals: MyAnimal[]; now: number }) {
  const list = useMemo(
    () =>
      animals.map((a, i) => {
        const pen = PENS.find((p) => p.kind === a.kind)!;
        const f = myFarm(slot);
        const e = { id: `myfarm-${slot}-${pen.kind}`, item: a.kind, kind: a.kind, names: [], habitat: 'grass', x0: f.cx + pen.x0, x1: f.cx + pen.x1, z0: f.cz + pen.z0, z1: f.cz + pen.z1, signSide: 'south' } as Parameters<typeof enclosurePath>[0];
        return { key: `myfarm-${slot}-${i}`, a, path: enclosurePath(e, i, 1.2) };
      }),
    [slot, animals],
  );
  const f = myFarm(slot);
  return (
    <group position={[-f.cx, 0, -f.cz]}>
      {list.map((x, i) => (
        <Animal key={x.key} id={x.key} kind={x.a.kind} name={x.a.name} word={x.a.kind} area="farm" item={x.a.kind} path={x.path} offset={i * 7.3} speed={x.a.kind === 'chicken' ? 0.9 : 0.55} pause={7} />
      ))}
      {PENS.map((pen) => {
        const mine = animals.filter((a) => a.kind === pen.kind);
        if (!mine.length) return null;
        const hungry = mine.filter((a) => animalStage(a, now).stage === 'hungry').length;
        const ready = mine.filter((a) => animalStage(a, now).stage === 'ready').length;
        const icon = ready ? `${ready} × ${ANIMAL_INFO[pen.kind].product === 'egg' ? '🥚' : ANIMAL_INFO[pen.kind].product === 'milk' ? '🥛' : ANIMAL_INFO[pen.kind].product === 'wool' ? '🧶' : '🍄'}` : hungry ? `🍽️ ${hungry}` : '😊';
        return (
          <Text key={pen.kind} position={[f.cx + (pen.x0 + pen.x1) / 2, 2.2, f.cz + (pen.kind === 'chicken' || pen.kind === 'cow' ? pen.z0 : pen.z1)]} fontSize={0.45} anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#ffffff">
            {icon}
          </Text>
        );
      })}
    </group>
  );
}

function Usables({ slot, mine }: { slot: number; mine: boolean }) {
  const t = useT();
  const s = useMyFarm.getState();
  const farm = useMyFarm((x) => x.mine);
  const f = myFarm(slot);
  const W = (x: number, z: number) => ({ x: f.cx + x, z: f.cz + z });
  const now = Date.now() + s.skew;
  useUsable({ id: 'myfarm-gate', ...W(0, MY_FARM.d / 2 - 0.9), r: 1.8, icon: '🚪', label: t('Leave the farm'), priority: true, use: () => useMyFarm.getState().leave() });
  useUsable(mine ? { id: 'myfarm-shop', ...W(SHOP.x, SHOP.z - 1.1), r: 1.6, icon: '🛒', label: t('Farm shop'), priority: true, use: () => useMyFarm.getState().setPanel('shop') } : null);
  useUsable(mine ? { id: 'myfarm-log', ...W(LOG_BOARD.x, LOG_BOARD.z - 1.1), r: 1.6, icon: '📋', label: t('Farm notice board'), priority: true, use: () => useMyFarm.getState().setPanel('settings') } : null);
  useUsable(mine ? { id: 'myfarm-bin', ...W(BIN.x + 1.3, BIN.z), r: 1.6, icon: '💰', label: t('Sell my produce'), priority: true, use: () => useMyFarm.getState().setPanel('barn') } : null);
  for (let i = 0; i < MAX_FIELDS * FIELD_PLOTS; i++) {
    const { x, z } = plotPos(i);
    const owned = i < farm.fields * FIELD_PLOTS;
    const p = farm.plots[i];
    const st = myPlotStage(p, now).stage;
    const label = !owned ? t('Buy more fields') : st === 'empty' ? t('Plant seeds') : st === 'seed' ? t('Water the plants') : st === 'ready' ? t('Harvest') : t('Growing…');
    const icon = !owned ? '🪧' : st === 'empty' ? '🌱' : st === 'seed' ? '💧' : st === 'ready' ? '🧺' : '⏳';
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useUsable(
      mine
        ? {
            id: `myfarm-plot-${i}`,
            ...W(x, z),
            r: 1.35,
            icon,
            label,
            priority: true,
            use: () => {
              const a = useMyFarm.getState();
              if (!owned) return a.setPanel('shop');
              if (st === 'empty') return a.setPanel({ plot: i });
              if (st === 'seed') return void a.act({ action: 'water', plot: i });
              if (st === 'ready') return void a.act({ action: 'harvest', plot: i });
            },
          }
        : null,
    );
  }
  for (const pen of PENS) {
    const idx = farm.animals.map((a, i) => ({ a, i })).filter((x) => x.a.kind === pen.kind);
    const ready = idx.filter((x) => animalStage(x.a, now).stage === 'ready');
    const hungry = idx.filter((x) => animalStage(x.a, now).stage === 'hungry');
    const label = !idx.length ? t('Buy animals in the farm shop') : ready.length ? t('Collect {n}', { n: ready.length }) : hungry.length ? t('Feed the animals ({n})', { n: hungry.length }) : t('The animals are happy');
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useUsable(
      mine
        ? {
            id: `myfarm-pen-${pen.kind}`,
            ...W(pen.spot.x, pen.spot.z),
            r: 2,
            icon: ANIMAL_INFO[pen.kind].icon,
            label,
            priority: true,
            use: async () => {
              const a = useMyFarm.getState();
              if (!idx.length) return a.setPanel('shop');
              for (const x of ready) await a.act({ action: 'collect', animal: x.i });
              if (!ready.length) for (const x of hungry) await a.act({ action: 'feed', animal: x.i });
            },
          }
        : null,
    );
  }
  return null;
}

export default function MyFarm() {
  const at = useMyFarm((s) => s.at);
  const mine = useMyFarm((s) => s.mine);
  const view = useMyFarm((s) => s.view);
  const skew = useMyFarm((s) => s.skew);
  const [slot, setSlot] = useState(-1);
  const [, tick] = useState(0);
  const acc = useRef(0);
  useFrame((_, dt) => {
    acc.current += dt;
    if (acc.current < 0.4) return;
    acc.current = 0;
    const s = inRect(MY_FARMS_AREA, localPos.x, localPos.z, 30) ? myFarmAt(localPos.x, localPos.z) : -1;
    if (s !== slot) setSlot(s);
  });
  useEffect(() => {
    if (slot >= 0) setDynamicBlockers(blockersFor(slot));
    else setDynamicBlockers([]);
    // in a farm without knowing whose (a reload): back to the farm area
    if (slot >= 0 && (!at || at.slot !== slot)) {
      const id = window.setTimeout(() => {
        const a = useMyFarm.getState().at;
        if (!a || a.slot !== slot) useMyFarm.getState().leave();
      }, 3000);
      return () => window.clearTimeout(id);
    }
  }, [slot, at]);
  useEffect(() => {
    if (slot < 0) return;
    const id = window.setInterval(() => tick((n) => n + 1), 2000);
    return () => window.clearInterval(id);
  }, [slot]);
  if (slot < 0 || !at || at.slot !== slot) return null;
  const own = !view;
  const fields = own ? mine.fields : view.fields;
  const plots = own ? mine.plots : view.plots;
  const animals = own ? mine.animals : view.animals;
  const now = Date.now() + skew;
  const f = myFarm(slot);
  return (
    <group>
      <group position={[f.cx, 0, f.cz]}>
        <mesh position={[0, -0.01, 0]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[MY_FARM.w + 30, MY_FARM.d + 30]} />
          <meshStandardMaterial color="#a8d27a" roughness={1} />
        </mesh>
        <Static fields={fields} />
        <Plots plots={plots} now={now} fields={fields} />
        <Sign x={0} z={MY_FARM.d / 2 + 0.6} text={`${at.name.toUpperCase()}'S FARM`} color="#7a4a2a" y={2.6} />
        {own ? (
          <>
            <Sign x={SHOP.x} z={SHOP.z} text="FARM SHOP" sub="seeds · animals · feed" color="#2f6b3a" y={1.2} rot={Math.PI} />
            <Sign x={LOG_BOARD.x} z={LOG_BOARD.z} text="NOTICE BOARD" color="#7a4a2a" y={1.2} rot={Math.PI} />
            <Sign x={BIN.x} z={BIN.z - 0.9} text="SELL" color="#c0392b" y={1.2} />
          </>
        ) : null}
      </group>
      <Animals slot={slot} animals={animals} now={now} />
      <Usables slot={slot} mine={own} />
    </group>
  );
}


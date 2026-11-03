import { useGame, type NpcInfo } from '../store/game';
import { Character } from './Character';
import { NameTag } from './NameTag';

const NPC_TINT: Record<string, string> = {
  barista: '#f08a5d',
  cashier: '#6bcb77',
  guide: '#f9d56e',
};

export function Npcs() {
  const npcs = useGame((s) => s.npcs);
  return (
    <>
      {npcs.map((n) => (
        <Npc key={n.id} npc={n} />
      ))}
    </>
  );
}

function Npc({ npc }: { npc: NpcInfo }) {
  const near = useGame((s) => s.interactTarget === npc.id);
  const talking = useGame((s) => s.panelNpc === npc.id);
  const anim = talking ? 'talk' : near ? 'wave' : 'idle';
  return (
    <group position={npc.position} rotation={[0, 0, 0]}>
      <Character anim={anim} tint={NPC_TINT[npc.id] ?? '#cccccc'} />
      <NameTag name={npc.name} sub={npc.role} />
      {near ? (
        <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.6, 0.75, 32]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>
      ) : null}
    </group>
  );
}

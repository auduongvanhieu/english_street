import { useGame, type NpcInfo } from '../store/game';
import { useVoice } from '../store/voice';
import { Chibi } from './chibi/Chibi';
import { NPC_CHIBI, NPC_CHIBI_DEFAULT } from './npcLook';
import { FarHide } from './nearInstances';
import { NameTag } from './NameTag';

export function Npcs() {
  const npcs = useGame((s) => s.npcs);
  return (
    <>
      {npcs.map((n) => (
        <FarHide key={n.id}>
          <Npc npc={n} />
        </FarHide>
      ))}
    </>
  );
}

function Npc({ npc }: { npc: NpcInfo }) {
  const near = useGame((s) => s.interactTarget === npc.id);
  const talking = useGame((s) => s.panelNpc === npc.id);
  const speaking = useVoice((s) => s.speakingNpc === npc.id);
  const anim = speaking ? 'talk' : talking ? 'idle' : near ? 'wave' : 'idle';
  return (
    <group position={npc.position} rotation={[0, npc.facing ?? 0, 0]}>
      <Chibi spec={NPC_CHIBI[npc.id] ?? NPC_CHIBI_DEFAULT} anim={anim} />
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

import { useGame, type NpcInfo } from '../store/game';
import { useVoice } from '../store/voice';
import { Character } from './Character';
import { Human, preloadHuman } from './Human';
import { NPC_LOOK } from './npcLook';
import { NameTag } from './NameTag';

/** Fallback tint for NPCs without a configured human look (robot model). */
const NPC_TINT: Record<string, string> = { barista: '#f08a5d', cashier: '#6bcb77', guide: '#f9d56e' };
for (const look of Object.values(NPC_LOOK)) preloadHuman(look.model);

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
  const speaking = useVoice((s) => s.speakingNpc === npc.id);
  const anim = speaking ? 'talk' : talking ? 'idle' : near ? 'wave' : 'idle';
  const look = NPC_LOOK[npc.id];
  return (
    <group position={npc.position} rotation={[0, 0, 0]}>
      {look ? <Human look={look} anim={anim} /> : <Character anim={anim} tint={NPC_TINT[npc.id] ?? '#cccccc'} />}
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

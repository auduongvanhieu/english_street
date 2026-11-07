import { Suspense, memo } from 'react';
import { useLpmParts } from './LpmModel';
import { chibiMaterial } from './chibi/buildChibi';
import type { AvatarLook } from '@es/shared';
import { Chibi } from './chibi/Chibi';
import { HeldCritter, PetBuddy } from './Critters';
import { Dish } from './areas/Dish';
import { Trolley } from './areas/Trolley';
import { Snack } from './areas/Snack';

/** Chair seat height: a seated character is lifted onto it. */
const SEAT_Y = 0.3;
/** Swimming: sunk to the shoulders (the pool water is at about 0.2 m). */
const SWIM_Y = -0.62;

/** A player's character: an original chibi built from their look (see chibi/buildChibi.ts), hugging a pet if any, with their dish on the table when eating out. */
export const PlayerAvatar = memo(function PlayerAvatar({ look, anim, holding = '', prop = '' }: { look: AvatarLook; anim: string; holding?: string; prop?: string }) {
  const sit = anim === 'sit' || anim === 'eat';
  const swim = anim === 'swim' || anim === 'tread';
  return (
    <>
      <group position-y={sit ? SEAT_Y : swim ? SWIM_Y : 0}>
        <Chibi spec={look} anim={anim} hug={!!holding} />
      </group>
      {holding ? <HeldCritter id={holding} /> : null}
      {look.pet && look.pet !== 'none' && !swim ? <PetBuddy kind={look.pet} anim={anim} /> : null}
      {prop.startsWith('dish:') ? <Dish item={prop.slice(5)} /> : null}
      {prop.startsWith('cart:') && !sit ? <Trolley n={Number(prop.slice(5)) || 0} /> : null}
      {prop.startsWith('snack:') ? <Snack kind={prop.slice(6)} sit={sit} /> : null}
      {prop.startsWith('ride:') ? (
        <Suspense fallback={null}>
          <RideProp kind={prop.slice(5)} />
        </Suspense>
      ) : null}
      {prop.startsWith('tool:') ? <Tool kind={prop.slice(5)} /> : null}
      {prop.startsWith('book:') ? (
        // reading in the library: an open book held up in front (others nearby can read along)
        <group position={[0, sit ? 0.86 : 0.76, 0.3]} rotation-x={-0.5}>
          {[-1, 1].map((s) => (
            <group key={s} rotation-y={s * 0.35}>
              <mesh position={[s * 0.11, 0, 0]}>
                <boxGeometry args={[0.22, 0.28, 0.02]} />
                <meshStandardMaterial color="#c0392b" />
              </mesh>
              <mesh position={[s * 0.105, 0, 0.012]}>
                <boxGeometry args={[0.2, 0.26, 0.01]} />
                <meshStandardMaterial color="#fffaf0" />
              </mesh>
            </group>
          ))}
        </group>
      ) : null}
    </>
  );
});

/**
 * What a player rides on (prop "ride:<kind>"): a surfboard under them (LPM beach_sports SM_BS_Board) or the rowing boat
 * of the Riverside boat trip (river_kit SM_RV_Rowboat, the rider on its passenger seat at z -0.85, seat top 0.24).
 */
function RideProp({ kind }: { kind: string }) {
  const parts = useLpmParts(kind === 'surf' ? 'beach_sports' : 'river_kit');
  const geo = parts[kind === 'surf' ? 'SM_BS_Board' : 'SM_RV_Rowboat'];
  if (!geo) return null;
  return kind === 'surf' ? <mesh geometry={geo} material={chibiMaterial()} position={[0, -0.04, -0.15]} /> : <mesh geometry={geo} material={chibiMaterial()} position={[0, 0.12, 0.85]} />;
}

/** Farm tools in hand (prop "tool:can" / "tool:feed"): a green watering can tipped forward, or a sack of feed. */
function Tool({ kind }: { kind: string }) {
  if (kind === 'can')
    return (
      <group position={[-0.2, 0.55, 0.36]} rotation-x={0.55}>
        <mesh>
          <cylinderGeometry args={[0.1, 0.11, 0.2, 10]} />
          <meshStandardMaterial color="#3f9e5a" />
        </mesh>
        <mesh position={[0, 0.02, 0.16]} rotation-x={1.1}>
          <cylinderGeometry args={[0.018, 0.025, 0.26, 6]} />
          <meshStandardMaterial color="#3f9e5a" />
        </mesh>
        <mesh position={[0, 0.14, -0.02]} rotation-y={Math.PI / 2}>
          <torusGeometry args={[0.07, 0.015, 6, 12, Math.PI]} />
          <meshStandardMaterial color="#2d7443" />
        </mesh>
      </group>
    );
  return (
    <group position={[0.2, 0.52, 0.26]}>
      <mesh>
        <boxGeometry args={[0.2, 0.26, 0.14]} />
        <meshStandardMaterial color="#d8c08a" />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.05, 0.09, 0.06, 8]} />
        <meshStandardMaterial color="#b89a5e" />
      </mesh>
    </group>
  );
}

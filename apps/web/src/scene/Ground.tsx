/** Large grass plane under the tiles so the horizon is never empty. */
export function Ground() {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.25, 0]} receiveShadow>
      <planeGeometry args={[400, 400]} />
      <meshStandardMaterial color="#78b85f" />
    </mesh>
  );
}

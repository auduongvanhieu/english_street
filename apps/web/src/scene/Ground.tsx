export function Ground() {
  return (
    <group>
      {/* Grass base */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#7cc46b" />
      </mesh>
      {/* Road running west–east */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[100, 8]} />
        <meshStandardMaterial color="#4b4f58" />
      </mesh>
      {/* Sidewalks */}
      {[-5.5, 5.5].map((z) => (
        <mesh key={z} rotation-x={-Math.PI / 2} position={[0, 0.02, z]} receiveShadow>
          <planeGeometry args={[100, 3]} />
          <meshStandardMaterial color="#c9c4b5" />
        </mesh>
      ))}
    </group>
  );
}

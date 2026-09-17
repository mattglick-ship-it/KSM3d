import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import footballAsset from "@/assets/tv-football.jpg.asset.json";

/**
 * Wall-mounted 55" TV on a single-arm articulating bracket.
 * Local coords: wall plate sits at z=0, arm extends along +Z away from the
 * wall, TV screen faces +Z. Caller positions/rotates the group so +Z points
 * toward the interior of the pavilion.
 */
export function TvMount({
  position = [0, 0, 0] as [number, number, number],
  rotation = 0,
}: {
  position?: [number, number, number];
  rotation?: number;
}) {
  const IN = 0.0254;
  const screenTex = useTexture(footballAsset.url);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.anisotropy = 8;

  // TV — 55" 16:9: ~49" W × 28" H × 2" D
  const tvW = 49 * IN;
  const tvH = 28 * IN;
  const tvD = 2 * IN;

  // Bracket dimensions
  const wallPlateW = 6 * IN;
  const wallPlateH = 8 * IN;
  const wallPlateD = 0.5 * IN;
  const armLen = 5 * IN;
  const armW = 1.5 * IN;
  const armH = 1.5 * IN;
  const tvPlateW = 4 * IN;
  const tvPlateH = 6 * IN;
  const tvPlateD = 0.5 * IN;

  const metalColor = "#2a2a2c";
  const bezelColor = "#0c0c0d";
  

  // z=0 is the wall (post inner face).
  // Arm starts attached to wall plate and extends +Z.
  const wallPlateZ = wallPlateD / 2;
  const armStartZ = wallPlateD;
  const armEndZ = armStartZ + armLen;
  const armCenterZ = (armStartZ + armEndZ) / 2;
  const tvPlateZ = armEndZ + tvPlateD / 2;
  const tvBackZ = tvPlateZ + tvPlateD / 2;
  const tvCenterZ = tvBackZ + tvD / 2;

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Wall plate against the post */}
      <mesh position={[0, 0, wallPlateZ]} castShadow receiveShadow>
        <boxGeometry args={[wallPlateW, wallPlateH, wallPlateD]} />
        <meshStandardMaterial color={metalColor} metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Pivot knuckle at wall */}
      <mesh position={[0, 0, armStartZ]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[armH * 0.6, armH * 0.6, armW * 1.4, 16]} />
        <meshStandardMaterial color={metalColor} metalness={0.7} roughness={0.35} />
      </mesh>

      {/* Single arm */}
      <mesh position={[0, 0, armCenterZ]} castShadow receiveShadow>
        <boxGeometry args={[armW, armH, armLen]} />
        <meshStandardMaterial color={metalColor} metalness={0.65} roughness={0.4} />
      </mesh>

      {/* Pivot knuckle at TV end */}
      <mesh position={[0, 0, armEndZ]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[armH * 0.6, armH * 0.6, armW * 1.4, 16]} />
        <meshStandardMaterial color={metalColor} metalness={0.7} roughness={0.35} />
      </mesh>

      {/* TV mount plate */}
      {/* Tilt assembly: TV plate + bezel + screen, pivot at TV-end knuckle,
       *  tilted 10° downward so the screen faces seated viewers. */}
      <group position={[0, 0, armEndZ]} rotation={[Math.PI / 9, 0, 0]}>
        <mesh position={[0, 0, tvPlateZ - armEndZ]} castShadow receiveShadow>
          <boxGeometry args={[tvPlateW, tvPlateH, tvPlateD]} />
          <meshStandardMaterial color={metalColor} metalness={0.6} roughness={0.45} />
        </mesh>

        {/* TV body (bezel) */}
        <mesh position={[0, 0, tvCenterZ - armEndZ]} castShadow receiveShadow>
          <boxGeometry args={[tvW, tvH, tvD]} />
          <meshStandardMaterial color={bezelColor} metalness={0.2} roughness={0.5} />
        </mesh>

        {/* Screen face — football broadcast filling the full 16:9 screen,
         *  lightly emissive so it reads as a lit TV panel. */}
        <mesh position={[0, 0, tvCenterZ + tvD / 2 + 0.002 - armEndZ]}>
          <planeGeometry args={[tvW - 0.6 * IN, tvH - 0.6 * IN]} />
          <meshStandardMaterial
            map={screenTex}
            emissive={"#ffffff"}
            emissiveMap={screenTex}
            emissiveIntensity={0.6}
            metalness={0}
            roughness={0.35}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}


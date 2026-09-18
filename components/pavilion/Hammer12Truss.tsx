import { configureTimberMaterial } from './timber-grain';
import { useMemo, useContext, useEffect } from "react";
import * as THREE from "three";
import { createHammerScene } from './procedural-geometry';
import { useWoodTexture, WoodFinishContext } from "./Pavilion3D";
import { useTimberSurface } from "./timber-surface";


export type Hammer12Adjust = {
  /** User scale multiplier on top of the auto-fit-to-span base scale. */
  scale: { x: number; y: number; z: number };
  /** Position offset in meters, added on top of the truss origin. */
  offset: { x: number; y: number; z: number };
  /** Rotation in radians applied to the truss group. */
  rotation: { x: number; y: number; z: number };
};

export const HAMMER12_GLB_DEFAULT_ADJUST: Hammer12Adjust = {
  scale: { x: 1, y: 1, z: 1 },
  offset: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
};

/**
 * Drop-in 12′ hammer-beam truss rebuilt from dimensional measurements using procedural solids.
 * Replaces the procedural HammerTruss when the pavilion width is 12′.
 *
 * Auto-fits the truss assembly's widest horizontal axis to the truss span so 1× scale
 * lands at the correct real-world width. Every mesh is reskinned with the
 * exact same wood texture stack the procedural posts/beams use (oak/rough/
 * hand-peeled finish from WoodFinishContext, mirrored-repeat tiling, srgb
 * colorspace, bump map at scale 0.9, roughness 0.85), tinted by the shared
 * pavilion `wood` color so it reacts to wood-choice and stain changes in
 * lockstep with the frame.
 */
export function Hammer12Truss({
  span,
  z,
  baseY,
  color,
  adjust = HAMMER12_GLB_DEFAULT_ADJUST,
}: {
  /** Truss span in meters — used to auto-fit the truss assembly to the pavilion width. */
  span: number;
  /** World Z position of the truss in meters. */
  z: number;
  /** Y position of the truss base in meters. */
  baseY: number;
  /** Hex color matching the rest of the pavilion's beams. */
  color: string;
  adjust?: Hammer12Adjust;
}) {
  // Same texture pipeline the posts use, so finish/grain choices match.
  const grainTex = useWoodTexture(Math.PI / 2, 1, 1, "hammer12glb");

  const finish = useContext(WoodFinishContext);
  const surface = useTimberSurface(grainTex, finish);
  const sharedMat = useMemo(() => {
    const m = configureTimberMaterial(new THREE.MeshStandardMaterial({
      map: grainTex,
      ...surface,
      color: new THREE.Color(color),
      metalness: 0,
    }), finish);
    return m;
  }, [grainTex, color, surface, finish]);
  useEffect(() => () => sharedMat.dispose(), [sharedMat]);

  const cloned = useMemo(() => createHammerScene(12, sharedMat), [sharedMat]);
  useEffect(() => () => cloned.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); }), [cloned]);

  const { offset, baseScale } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const longSize = Math.max(size.x, size.z) || 1;
    const s = span / longSize;
    return {
      offset: new THREE.Vector3(-center.x * s, -box.min.y * s, -center.z * s),
      baseScale: s,
    };
  }, [cloned, span]);

  return (
    <group
      position={[adjust.offset.x, baseY + adjust.offset.y, z + adjust.offset.z]}
      rotation={[adjust.rotation.x, adjust.rotation.y, adjust.rotation.z]}
    >
      <group
        position={offset}
        scale={[
          baseScale * adjust.scale.x,
          baseScale * adjust.scale.y,
          baseScale * adjust.scale.z,
        ]}
      >
        <primitive object={cloned} />
      </group>
    </group>
  );
}

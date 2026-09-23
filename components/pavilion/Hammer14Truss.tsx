import { configureTimberMaterial } from './timber-grain';
import { useMemo, useContext, useEffect } from "react";
import * as THREE from "three";
import { createHammerScene } from './procedural-geometry';
import { useWoodTexture, WoodFinishContext } from "./Pavilion3D";
import { useTimberSurface } from "./timber-surface";


export type Hammer14Adjust = {
  scale: { x: number; y: number; z: number };
  offset: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
};

export const HAMMER14_GLB_DEFAULT_ADJUST: Hammer14Adjust = {
  scale: { x: 1, y: 1, z: 1 },
  offset: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
};

/** Drop-in 14′ hammer-beam truss rebuilt from dimensional measurements using procedural solids. Mirrors the
 *  Hammer12Truss component: auto-fits to the pavilion span and reskins all
 *  timbers with the shared wood material so finish/stain stays in lockstep. */
export function Hammer14Truss({
  span,
  z,
  baseY,
  color,
  hideRafters = false,
  adjust = HAMMER14_GLB_DEFAULT_ADJUST,
}: {
  span: number;
  z: number;
  baseY: number;
  color: string;
  hideRafters?: boolean;
  adjust?: Hammer14Adjust;
}) {
  const grainTex = useWoodTexture(Math.PI / 2, 1, 1, "hammer14glb");

  const finish = useContext(WoodFinishContext);
  const surface = useTimberSurface(grainTex, finish);
  const sharedMat = useMemo(() => {
    return configureTimberMaterial(new THREE.MeshStandardMaterial({
      map: grainTex,
      ...surface,
      color: new THREE.Color(color),
      metalness: 0,
    }), finish);
  }, [grainTex, color, surface, finish]);
  useEffect(() => () => sharedMat.dispose(), [sharedMat]);

  const cloned = useMemo(() => {
    const scene = createHammerScene(14, sharedMat);
    // Keep the full drawing bounds for the established body fit.
    for (const mesh of scene.children) if (/^hammer\.rafter\./.test(mesh.name)) mesh.visible = !hideRafters;
    return scene;
  }, [sharedMat, hideRafters]);
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


import { configureTimberMaterial } from './timber-grain';
import { useMemo, useContext, useEffect } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import glbAsset from "@/assets/hammer16_truss.glb.asset.json";
import { useWoodTexture, WoodFinishContext } from "./Pavilion3D";
import { useTimberSurface } from "./timber-surface";

useGLTF.preload(glbAsset.url);

export type Hammer16GlbAdjust = {
  scale: { x: number; y: number; z: number };
  offset: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
};

export const HAMMER16_GLB_DEFAULT_ADJUST: Hammer16GlbAdjust = {
  scale: { x: 1, y: 1, z: 1 },
  offset: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
};

/** Drop-in 16′ hammer-beam truss rendered from a single GLB. Mirrors the
 *  Hammer12GlbTruss component: auto-fits to the pavilion span and reskins all
 *  meshes with the shared wood material so finish/stain stays in lockstep. */
export function Hammer16GlbTruss({
  span,
  z,
  baseY,
  color,
  adjust = HAMMER16_GLB_DEFAULT_ADJUST,
}: {
  span: number;
  z: number;
  baseY: number;
  color: string;
  adjust?: Hammer16GlbAdjust;
}) {
  const { scene } = useGLTF(glbAsset.url) as any;
  const grainTex = useWoodTexture(Math.PI / 2, 1, 1, "hammer16glb");

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
    const obj = scene.clone(true) as THREE.Object3D;
    obj.traverse((c: any) => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
        c.material = sharedMat;
      }
    });
    return obj;
  }, [scene, sharedMat]);

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


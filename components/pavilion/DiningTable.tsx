import { useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import diningAsset from "@/assets/dining_table.glb.asset.json";

useGLTF.preload(diningAsset.url);

/**
 * Outdoor dining table rendered from an uploaded GLB.
 * Auto-scales to a reasonable real-world footprint and grounds it at y=0.
 */
export function DiningTable({
  position = [0, 0, 0] as [number, number, number],
  rotation = 0,
}: {
  position?: [number, number, number];
  rotation?: number;
}) {
  const { scene } = useGLTF(diningAsset.url) as any;

  const cloned = useMemo(() => {
    const obj = scene.clone(true) as THREE.Object3D;
    obj.traverse((c: any) => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    return obj;
  }, [scene]);

  const { offset, scaleVec } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Target: 110" along the long horizontal axis, proportions locked.
    const IN = 0.0254;
    const targetLong = 110 * IN;
    const longSize = Math.max(size.x, size.z);
    const s = targetLong / (longSize || 1);

    return {
      offset: new THREE.Vector3(-center.x * s, -box.min.y * s, -center.z * s),
      scaleVec: new THREE.Vector3(s, s, s),
    };
  }, [cloned]);

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <group position={offset} scale={scaleVec}>
        <primitive object={cloned} />
      </group>
    </group>
  );
}


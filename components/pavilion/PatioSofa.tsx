import { useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import patioSofaAsset from "@/assets/patio-sofa-set.glb.asset.json";

useGLTF.preload(patioSofaAsset.url);

/**
 * Outdoor patio sofa set rendered from an uploaded GLB.
 * Auto-scales to a real-world footprint and grounds it at y=0.
 */
export function PatioSofa({
  position = [0, 0, 0] as [number, number, number],
  rotation = 0,
}: {
  position?: [number, number, number];
  rotation?: number;
}) {
  const { scene } = useGLTF(patioSofaAsset.url) as any;

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

  const { offset, scale } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Patio sofa set ~ 8 ft along the long horizontal axis.
    const FT = 0.3048;
    const targetLongSide = 8 * FT;
    const longSide = Math.max(size.x, size.z) || 1;
    const s = targetLongSide / longSide;

    return {
      offset: new THREE.Vector3(-center.x * s, -box.min.y * s, -center.z * s),
      scale: s,
    };
  }, [cloned]);

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <group position={offset} scale={scale}>
        <primitive object={cloned} />
      </group>
    </group>
  );
}


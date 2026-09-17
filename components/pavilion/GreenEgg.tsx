import { useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import grillAsset from "@/assets/kamado_grill.glb.asset.json";

useGLTF.preload(grillAsset.url);

/**
 * Kamado grill station rendered from an uploaded GLB model.
 * Auto-scales to a reasonable real-world footprint and grounds it at y=0.
 */
export function GreenEgg({
  position = [0, 0, 0] as [number, number, number],
  rotation = 0,
}: {
  position?: [number, number, number];
  rotation?: number;
}) {
  const { scene } = useGLTF(grillAsset.url) as any;

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

    // Target footprint ~ 4ft along the largest horizontal axis (kamado on cart)
    const FT = 0.3048;
    const targetLongSide = 4 * FT;
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


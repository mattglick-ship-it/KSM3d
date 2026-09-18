import {useEffect, useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {mapTimberGrain} from './timber-grain';

/** Map procedural timbers before drawing. Cache per mesh so resizing
 * one instance never modifies another instance's geometry or texture scale. */
export function TimberGrainMapping() {
  const cache = useRef(new Map<THREE.Mesh, {source:THREE.BufferGeometry; mapped:THREE.BufferGeometry; scale:THREE.Vector3}>());
  useEffect(() => {
    const entries = cache.current;
    return () => { for (const [mesh, entry] of entries) { if (mesh.geometry === entry.mapped) mesh.geometry = entry.source; entry.mapped.dispose(); } entries.clear(); };
  }, []);
  useFrame(({scene}) => {
    scene.updateMatrixWorld();
    const active = new Set<THREE.Mesh>();
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (!materials.some(m => m.userData.longitudinalTimber)) return;
      // Posts and girders previously only cast shadows, making joints look
      // disconnected and preventing the roof from shading those surfaces.
      object.receiveShadow = true;
      active.add(object);
      const scale = new THREE.Vector3().setFromMatrixScale(object.matrixWorld);
      const previous = cache.current.get(object);
      if (previous && object.geometry === previous.mapped && scale.distanceToSquared(previous.scale) < 1e-10) return;
      const source = previous && object.geometry === previous.mapped ? previous.source : object.geometry;
      const p = new THREE.Vector3().setFromMatrixPosition(object.matrixWorld);
      const mapped = mapTimberGrain(source, scale, p.x * 17.13 + p.y * 31.7 + p.z * 11.91);
      object.geometry = mapped;
      previous?.mapped.dispose();
      cache.current.set(object, {source, mapped, scale});
    });
    for (const [mesh, entry] of cache.current) if (!active.has(mesh)) {
      if (mesh.geometry === entry.mapped) mesh.geometry = entry.source;
      entry.mapped.dispose(); cache.current.delete(mesh);
    }
  });
  return null;
}

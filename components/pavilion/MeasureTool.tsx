import { useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import * as THREE from "three";

const M_TO_IN = 39.3700787;

function fmt(distMeters: number) {
  const totalIn = distMeters * M_TO_IN;
  const ft = Math.floor(totalIn / 12);
  const inches = totalIn - ft * 12;
  if (ft <= 0) return `${totalIn.toFixed(2)}"`;
  return `${ft}' ${inches.toFixed(2)}"  (${totalIn.toFixed(2)}")`;
}

/**
 * Two-point measuring tool.
 * - Single click: drop point A (or reset and drop a new A if a measurement is complete)
 * - Double click: drop point B and show the distance
 * - Orbit/pan/zoom remain enabled while measuring
 */
export function MeasureTool({ enabled }: { enabled: boolean }) {
  const { gl, camera, scene } = useThree();
  const [points, setPoints] = useState<THREE.Vector3[]>([]);
  const downRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const pointsRef = useRef<THREE.Vector3[]>([]);
  pointsRef.current = points;

  useEffect(() => {
    if (!enabled) {
      setPoints([]);
      return;
    }
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    const pick = (clientX: number, clientY: number): THREE.Vector3 | null => {
      const rect = el.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(scene.children, true).filter((h) => {
        const o = h.object as THREE.Object3D & { userData?: { __measure?: boolean } };
        if (o.userData?.__measure) return false;
        if (!(o as THREE.Mesh).isMesh) return false;
        if ((o as THREE.Mesh).visible === false) return false;
        return true;
      });
      return hits.length ? hits[0].point.clone() : null;
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      downRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const onUp = (e: PointerEvent) => {
      const d = downRef.current;
      downRef.current = null;
      if (!d) return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return; // drag = orbit
      const p = pick(e.clientX, e.clientY);
      if (!p) return;
      // Single click sets/resets point A. Point B is set by double-click.
      setPoints(prev => prev.length === 1 ? [prev[0], p] : [p]);
    };
    const onDbl = (e: MouseEvent) => {
      const p = pick(e.clientX, e.clientY);
      if (!p) return;
      const cur = pointsRef.current;
      if (cur.length >= 1) {
        setPoints([cur[0], p]);
      } else {
        setPoints([p]);
      }
      e.stopPropagation();
      e.preventDefault();
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      
    };
  }, [enabled, gl, camera, scene]);


  if (!enabled) return null;

  const a = points[0];
  const b = points[1];
  const mid = a && b ? a.clone().add(b).multiplyScalar(0.5) : null;
  const dist = a && b ? a.distanceTo(b) : null;

  return (
    <group userData={{ __measure: true }}>
      {a && (
        <mesh position={a} userData={{ __measure: true }} renderOrder={999}>
          <sphereGeometry args={[0.03, 16, 16]} />
          <meshBasicMaterial color="#22c55e" depthTest={false} />
        </mesh>
      )}
      {b && (
        <mesh position={b} userData={{ __measure: true }} renderOrder={999}>
          <sphereGeometry args={[0.03, 16, 16]} />
          <meshBasicMaterial color="#ef4444" depthTest={false} />
        </mesh>
      )}
      {a && b && (
        <Line
          points={[a, b]}
          color="#facc15"
          lineWidth={2}
          dashed={false}
          depthTest={false}
          renderOrder={999}
        />
      )}
      {mid && dist != null && (
        <Html position={mid} center distanceFactor={8} zIndexRange={[100, 0]} userData={{ __measure: true }}>
          <div
            style={{
              background: "rgba(17,24,39,0.92)",
              color: "white",
              padding: "4px 8px",
              borderRadius: 6,
              font: "600 12px/1.1 ui-sans-serif, system-ui",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
            }}
          >
            {fmt(dist)}
          </div>
        </Html>
      )}
    </group>
  );
}


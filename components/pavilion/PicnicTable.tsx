import { useLoader } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import tableAsset from "@/assets/picnic-table.obj.asset.json";

const FT = 0.3048;
const IN = 0.0254;
const TARGET_LENGTH_FT = 6;
const TARGET_WIDTH_IN = 30;
const TARGET_HEIGHT_IN = 29; // 28-30 in range, lock to 29

// Procedural wood grain texture
function makeWoodTexture(size = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Base warm wood gradient
  const base = ctx.createLinearGradient(0, 0, size, 0);
  base.addColorStop(0, "#8a5a30");
  base.addColorStop(0.5, "#a87142");
  base.addColorStop(1, "#7a4d28");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // Long grain streaks (horizontal)
  for (let i = 0; i < 220; i++) {
    const y = Math.random() * size;
    const shade = Math.random() < 0.5
      ? `rgba(60, 35, 18, ${0.05 + Math.random() * 0.18})`
      : `rgba(220, 175, 130, ${0.04 + Math.random() * 0.12})`;
    ctx.strokeStyle = shade;
    ctx.lineWidth = 0.4 + Math.random() * 1.6;
    ctx.beginPath();
    const yWobble = 6 + Math.random() * 14;
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 16) {
      ctx.lineTo(x, y + Math.sin(x * 0.03 + i) * yWobble * 0.2);
    }
    ctx.stroke();
  }

  // Knots
  for (let i = 0; i < 4; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 6 + Math.random() * 14;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(40, 22, 10, 0.85)");
    g.addColorStop(0.6, "rgba(70, 40, 20, 0.4)");
    g.addColorStop(1, "rgba(70, 40, 20, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle noise
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
    img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
    img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Roughness map: lighter = rougher
function makeWoodRoughness(size = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#c8c8c8";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? 80 : 220}, 0, 0, ${0.04 + Math.random() * 0.12})`;
    const y = Math.random() * size;
    ctx.fillRect(0, y, size, 0.5 + Math.random() * 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function PicnicTable({
  position = [0, 0, 0] as [number, number, number],
  rotation = 0,
  stain = null,
}: {
  position?: [number, number, number];
  rotation?: number;
  /** Hex color for stain (e.g. "#8b4513"). null/undefined = unfinished raw wood. */
  stain?: string | null;
}) {
  const obj = useLoader(OBJLoader, tableAsset.url);

  const woodMap = useMemo(() => makeWoodTexture(), []);
  const roughMap = useMemo(() => makeWoodRoughness(), []);

  const prepared = useMemo(() => {
    const root = obj.clone(true);

    // Assign per-mesh material variants so each plank looks slightly different
    let i = 0;
    root.traverse((child) => {
      const m = child as THREE.Mesh;
      if (!m.isMesh) return;
      i++;
      // Clone textures so each can have its own rotation/offset
      const map = woodMap.clone();
      map.needsUpdate = true;
      map.rotation = (i % 2 === 0 ? 0 : Math.PI / 2) + (Math.random() - 0.5) * 0.05;
      map.center.set(0.5, 0.5);
      map.repeat.set(1.8 + Math.random() * 0.6, 1.8 + Math.random() * 0.6);
      map.offset.set(Math.random(), Math.random());

      const rough = roughMap.clone();
      rough.needsUpdate = true;
      rough.rotation = map.rotation;
      rough.center.set(0.5, 0.5);
      rough.repeat.copy(map.repeat);
      rough.offset.copy(map.offset);

      // Slight per-piece tint variation (raw wood). When a stain is provided,
      // multiply the wood map by the stain color so the grain still reads.
      const baseTint = new THREE.Color().setHSL(
        0.07 + (Math.random() - 0.5) * 0.02,
        0.45 + (Math.random() - 0.5) * 0.1,
        0.48 + (Math.random() - 0.5) * 0.08,
      );
      const tint = stain
        ? new THREE.Color(stain).multiplyScalar(1.05)
        : baseTint;

      m.material = new THREE.MeshStandardMaterial({
        map,
        roughnessMap: rough,
        color: tint,
        roughness: stain ? 0.7 : 0.9,
        metalness: 0,
      });
      m.castShadow = true;
      m.receiveShadow = true;
    });

    // Lock dimensions. The 6 ft × 30 in spec refers to the TABLE TOP only
    // (benches overhang wider), and 29 in is the overall height from ground.
    const box = new THREE.Box3().setFromObject(root);
    const size = new THREE.Vector3();
    box.getSize(size);

    // Measure the tabletop by sampling vertices in the top ~15% of the model.
    const topCut = box.min.y + size.y * 0.85;
    const topBox = new THREE.Box3();
    topBox.makeEmpty();
    const v = new THREE.Vector3();
    root.updateMatrixWorld(true);
    root.traverse((child) => {
      const m = child as THREE.Mesh;
      if (!m.isMesh || !m.geometry) return;
      const pos = m.geometry.attributes.position as THREE.BufferAttribute | undefined;
      if (!pos) return;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        if (v.y >= topCut) topBox.expandByPoint(v);
      }
    });
    const topSize = new THREE.Vector3();
    if (!topBox.isEmpty()) topBox.getSize(topSize);
    else topSize.copy(size); // fallback

    // Length axis = longer horizontal axis of the tabletop.
    const lengthAxis: "x" | "z" = topSize.x >= topSize.z ? "x" : "z";
    const sx = lengthAxis === "x"
      ? (TARGET_LENGTH_FT * FT) / topSize.x
      : (TARGET_WIDTH_IN * IN) / topSize.x;
    const sz = lengthAxis === "z"
      ? (TARGET_LENGTH_FT * FT) / topSize.z
      : (TARGET_WIDTH_IN * IN) / topSize.z;
    const sy = (TARGET_HEIGHT_IN * IN) / size.y;
    root.scale.set(sx, sy, sz);
    void lengthAxis;

    // Center on origin, sit on ground
    const box2 = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= box2.min.y;

    return root;
  }, [obj, woodMap, roughMap, stain]);

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <primitive object={prepared} />
    </group>
  );
}


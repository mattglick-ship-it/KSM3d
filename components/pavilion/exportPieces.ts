import * as THREE from "three";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import JSZip from "jszip";

// Best-effort label for a mesh based on its geometry + ancestors.
function geomLabel(mesh: THREE.Mesh): string {
  const g = mesh.geometry as any;
  const t = (g?.type as string) || "Mesh";
  return t
    .replace(/Geometry$/, "")
    .replace(/Buffer$/, "")
    .toLowerCase();
}

function ancestorHint(mesh: THREE.Mesh, rootName: string): string {
  // Walk up; pick the nearest named ancestor that isn't the root.
  let o: THREE.Object3D | null = mesh.parent;
  while (o) {
    if (o.name && o.name !== rootName) return o.name;
    o = o.parent;
  }
  return "piece";
}

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40);
}

// True only if `obj` and every ancestor up to (and including) `stopAt` are visible.
function isVisibleChain(obj: THREE.Object3D, stopAt: THREE.Object3D): boolean {
  let o: THREE.Object3D | null = obj;
  while (o) {
    if (o.visible === false) return false;
    if (o === stopAt) return true;
    o = o.parent;
  }
  return true;
}

// Swap winding (v1 <-> v2) of every triangle in a non-indexed position buffer.
// Needed after applying a matrix with negative determinant (mirrored scale),
// otherwise computeVertexNormals produces inward-facing normals and the mesh
// looks hollow / inside-out in downstream tools.
function flipWinding(geom: THREE.BufferGeometry): void {
  const pos = geom.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!pos) return;
  const arr = pos.array as Float32Array;
  for (let i = 0; i < arr.length; i += 9) {
    // swap vertex 1 (i+3..i+5) with vertex 2 (i+6..i+8)
    for (let k = 0; k < 3; k++) {
      const a = arr[i + 3 + k];
      arr[i + 3 + k] = arr[i + 6 + k];
      arr[i + 6 + k] = a;
    }
  }
  pos.needsUpdate = true;
}

/**
 * Traverse the pavilion root group, bake world transforms into each mesh's
 * geometry, export each as an individual ASCII STL, and bundle them into a
 * single .zip download. Returns the count of pieces exported.
 */
export async function exportPiecesAsStlZip(
  root: THREE.Group,
  filename = "pavilion-pieces.zip",
): Promise<number> {
  const exporter = new STLExporter();
  const zip = new JSZip();

  // Make sure world matrices are current.
  root.updateMatrixWorld(true);
  const rootInv = new THREE.Matrix4().copy(root.matrixWorld).invert();

  // Collect meshes (skip helpers / sprites / lines).
  const meshes: THREE.Mesh[] = [];
  root.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if ((m as any).isMesh && m.geometry) meshes.push(m);
  });

  // Build a stable, sorted order so re-exports keep similar numbering.
  meshes.sort((a, b) => {
    const ha = ancestorHint(a, root.name);
    const hb = ancestorHint(b, root.name);
    if (ha !== hb) return ha.localeCompare(hb);
    return geomLabel(a).localeCompare(geomLabel(b));
  });

  const usedNames = new Map<string, number>();
  let exported = 0;

  for (let i = 0; i < meshes.length; i++) {
    const mesh = meshes[i];
    const geom = (mesh.geometry as THREE.BufferGeometry).clone();

    // Bake world transform into the geometry, but expressed in the root's
    // local frame so the parts assemble cleanly back together.
    const worldToRoot = new THREE.Matrix4()
      .multiplyMatrices(rootInv, mesh.matrixWorld);
    geom.applyMatrix4(worldToRoot);

    // Build a transient mesh so STLExporter only sees this geometry.
    const tmp = new THREE.Mesh(geom, new THREE.MeshBasicMaterial());

    const hint = safeName(ancestorHint(mesh, root.name));
    const kind = safeName(geomLabel(mesh));
    const base = `${hint}_${kind}`;
    const n = (usedNames.get(base) ?? 0) + 1;
    usedNames.set(base, n);
    const name = `${String(i + 1).padStart(3, "0")}_${base}_${n}.stl`;

    const stl = exporter.parse(tmp, { binary: false }) as unknown as string;
    zip.file(name, stl);

    // Cleanup.
    geom.dispose();
    exported++;
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  return exported;
}

/**
 * Find all hammer-truss groups under `root` and export the first one (front
 * truss) as a single STL mesh — all truss member geometries merged together,
 * with any descendant of a "hammer-plates" group skipped. World transforms
 * are baked in (expressed in the truss-local frame so the export is centered
 * on the truss).
 *
 * Returns the number of merged mesh pieces. Throws if no truss group is found
 * or it has no eligible meshes.
 */
export async function exportFirstHammerTrussAsStl(
  root: THREE.Group,
  filename = "hammer-truss.stl",
): Promise<number> {
  const { mergeGeometries:mergeBufferGeometries } = await import("three/addons/utils/BufferGeometryUtils.js");


  root.updateMatrixWorld(true);

  // Find first hammer-truss group.
  let truss: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!truss && o.name === "hammer-truss") truss = o;
  });
  if (!truss) throw new Error("No hammer-truss group found in scene");

  const trussGroup = truss as THREE.Object3D;
  const trussInv = new THREE.Matrix4().copy(trussGroup.matrixWorld).invert();

  // Ancestor check — exclude any mesh whose ancestor chain (up to the truss)
  // passes through a hammer-plates group.
  function isUnderPlates(obj: THREE.Object3D): boolean {
    let o: THREE.Object3D | null = obj;
    while (o && o !== trussGroup) {
      if (o.name === "hammer-plates") return true;
      o = o.parent;
    }
    return false;
  }

  const geoms: THREE.BufferGeometry[] = [];
  trussGroup.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (!(m as any).isMesh || !m.geometry) return;
    if (isUnderPlates(m)) return;
    if (!isVisibleChain(m, trussGroup)) return;

    // Clone, bake transform into truss-local frame, keep ONLY position so all
    // geometries share the same attribute set for the merge.
    const src = m.geometry as THREE.BufferGeometry;
    const baked = new THREE.BufferGeometry();
    const posAttr = src.getAttribute("position");
    if (!posAttr) return;
    // Resolve into a non-indexed position buffer so all merged geometries
    // share a uniform layout.
    const tmp = src.index ? src.toNonIndexed() : src.clone();
    const flatPos = tmp.getAttribute("position").clone();
    baked.setAttribute("position", flatPos);

    const worldToTruss = new THREE.Matrix4().multiplyMatrices(
      trussInv,
      m.matrixWorld,
    );
    baked.applyMatrix4(worldToTruss);
    if (worldToTruss.determinant() < 0) flipWinding(baked);
    geoms.push(baked);
    tmp.dispose();
  });

  if (!geoms.length) throw new Error("Truss had no exportable meshes");

  const merged = mergeBufferGeometries(geoms, false);
  if (!merged) throw new Error("Failed to merge truss geometries");
  merged.computeVertexNormals();

  const tmpMesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial());
  const stl = new STLExporter().parse(tmpMesh, { binary: true }) as unknown as DataView;
  const stlBuf = stl.buffer.slice(stl.byteOffset, stl.byteOffset + stl.byteLength) as ArrayBuffer;

  const blob = new Blob([stlBuf], { type: "model/stl" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  for (const g of geoms) g.dispose();
  merged.dispose();

  return geoms.length;
}

/**
 * Same selection logic as `exportFirstHammerTrussAsStl` but writes a single
 * binary GLB containing one merged mesh of every non-plate truss member.
 */
export async function exportFirstHammerTrussAsGlb(
  root: THREE.Group,
  filename = "hammer-truss.glb",
  trussName = "hammer-truss",
  platesName = "hammer-plates",
): Promise<number> {
  const { mergeGeometries: mergeBufferGeometries } = await import("three/addons/utils/BufferGeometryUtils.js");
 const {GLTFExporter}=await import("three/addons/exporters/GLTFExporter.js");

  root.updateMatrixWorld(true);

  let truss: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!truss && o.name === trussName) truss = o;
  });
  if (!truss) throw new Error(`No ${trussName} group found in scene`);

  const trussGroup = truss as THREE.Object3D;
  const trussInv = new THREE.Matrix4().copy(trussGroup.matrixWorld).invert();

  function isUnderPlates(obj: THREE.Object3D): boolean {
    let o: THREE.Object3D | null = obj;
    while (o && o !== trussGroup) {
      if (o.name === platesName) return true;
      o = o.parent;
    }
    return false;
  }

  // Bake each source mesh's texture transform (center/rotation/repeat/offset
  // live on the THREE.Texture, NOT the UV attribute) directly into the UVs
  // so a single shared material in the GLB reproduces per-piece grain.
  function bakeUv(uv: THREE.BufferAttribute, map: THREE.Texture | null): THREE.BufferAttribute {
    const out = uv.clone();
    if (!map) return out;
    const cx = map.center.x, cy = map.center.y;
    const r = map.rotation;
    const cos = Math.cos(r), sin = Math.sin(r);
    const rx = map.repeat.x, ry = map.repeat.y;
    const ox = map.offset.x, oy = map.offset.y;
    const arr = out.array as Float32Array;
    for (let i = 0; i < arr.length; i += 2) {
      const u = arr[i] - cx;
      const v = arr[i + 1] - cy;
      const ru = cos * u - sin * v;
      const rv = sin * u + cos * v;
      arr[i]     = rx * (ru + cx) + ox;
      arr[i + 1] = ry * (rv + cy) + oy;
    }
    out.needsUpdate = true;
    return out;
  }

  let sharedMap: THREE.Texture | null = null;
  const geoms: THREE.BufferGeometry[] = [];
  trussGroup.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (!(m as any).isMesh || !m.geometry) return;
    if (isUnderPlates(m)) return;
    if (!isVisibleChain(m, trussGroup)) return;

    const src = m.geometry as THREE.BufferGeometry;
    const posAttr = src.getAttribute("position");
    if (!posAttr) return;
    const tmp = src.index ? src.toNonIndexed() : src.clone();
    const baked = new THREE.BufferGeometry();
    baked.setAttribute("position", tmp.getAttribute("position").clone());

    // Find this mesh's wood texture (if any) and bake its transform into UVs.
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    const map = (mat as THREE.MeshStandardMaterial | undefined)?.map ?? null;
    if (!sharedMap && map) sharedMap = map;
    const srcUv = tmp.getAttribute("uv") as THREE.BufferAttribute | undefined;
    if (srcUv) baked.setAttribute("uv", bakeUv(srcUv, map));

    const worldToTruss = new THREE.Matrix4().multiplyMatrices(
      trussInv,
      m.matrixWorld,
    );
    baked.applyMatrix4(worldToTruss);
    if (worldToTruss.determinant() < 0) flipWinding(baked);
    geoms.push(baked);
    tmp.dispose();
  });

  if (!geoms.length) throw new Error("Truss had no exportable meshes");

  // Every merged geometry must share the same attribute set. If any piece had
  // no UVs, fill in zeros so the merge succeeds.
  for (const g of geoms) {
    if (!g.getAttribute("uv")) {
      const n = (g.getAttribute("position") as THREE.BufferAttribute).count;
      g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    }
  }

  const merged = mergeBufferGeometries(geoms, false);
  if (!merged) throw new Error("Failed to merge truss geometries");
  merged.computeVertexNormals();

  // Build a single shared wood material. Re-use the actual texture image from
  // the truss (so the grain matches the on-screen render) with identity
  // transform — the per-piece transforms are already baked into the UVs.
  let exportMap: THREE.Texture | null = null;
  if (sharedMap && (sharedMap as THREE.Texture).image) {
    exportMap = new THREE.Texture((sharedMap as THREE.Texture).image);
    exportMap.wrapS = THREE.RepeatWrapping;
    exportMap.wrapT = THREE.RepeatWrapping;
    exportMap.colorSpace = (sharedMap as THREE.Texture).colorSpace ?? THREE.SRGBColorSpace;
    exportMap.flipY = (sharedMap as THREE.Texture).flipY;
    exportMap.needsUpdate = true;
  }

  const mesh = new THREE.Mesh(
    merged,
    new THREE.MeshStandardMaterial({
      color: exportMap ? 0xffffff : 0xb08a5a,
      map: exportMap ?? null,
      roughness: 0.85,
      metalness: 0,
    }),
  );
  mesh.name = trussName;

  const exporter = new GLTFExporter();
  const arrayBuffer: ArrayBuffer = await new Promise((resolve, reject) => {
    exporter.parse(
      mesh,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(result);
        else reject(new Error("GLTFExporter did not return a binary GLB"));
      },
      (err) => reject(err),
      { binary: true, embedImages: true },
    );
  });

  const blob = new Blob([arrayBuffer], { type: "model/gltf-binary" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  for (const g of geoms) g.dispose();
  merged.dispose();
  exportMap?.dispose();

  return geoms.length;
}

/**
 * Same selection logic as `exportFirstHammerTrussAsStl` but writes a single
 * OBJ (ASCII) containing one merged mesh of every non-plate truss member.
 */
export async function exportFirstHammerTrussAsObj(
  root: THREE.Group,
  filename = "hammer-truss.obj",
): Promise<number> {
  const { mergeGeometries: mergeBufferGeometries } = await import("three/addons/utils/BufferGeometryUtils.js");
 const {OBJExporter}=await import("three/addons/exporters/OBJExporter.js");

  root.updateMatrixWorld(true);

  let truss: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (!truss && o.name === "hammer-truss") truss = o;
  });
  if (!truss) throw new Error("No hammer-truss group found in scene");

  const trussGroup = truss as THREE.Object3D;
  const trussInv = new THREE.Matrix4().copy(trussGroup.matrixWorld).invert();

  function isUnderPlates(obj: THREE.Object3D): boolean {
    let o: THREE.Object3D | null = obj;
    while (o && o !== trussGroup) {
      if (o.name === "hammer-plates") return true;
      o = o.parent;
    }
    return false;
  }

  const geoms: THREE.BufferGeometry[] = [];
  trussGroup.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (!(m as any).isMesh || !m.geometry) return;
    if (isUnderPlates(m)) return;
    if (!isVisibleChain(m, trussGroup)) return;

    const src = m.geometry as THREE.BufferGeometry;
    const posAttr = src.getAttribute("position");
    if (!posAttr) return;
    const tmp = src.index ? src.toNonIndexed() : src.clone();
    const baked = new THREE.BufferGeometry();
    baked.setAttribute("position", tmp.getAttribute("position").clone());

    const worldToTruss = new THREE.Matrix4().multiplyMatrices(
      trussInv,
      m.matrixWorld,
    );
    baked.applyMatrix4(worldToTruss);
    if (worldToTruss.determinant() < 0) flipWinding(baked);
    geoms.push(baked);
    tmp.dispose();
  });

  if (!geoms.length) throw new Error("Truss had no exportable meshes");

  const merged = mergeBufferGeometries(geoms, false);
  if (!merged) throw new Error("Failed to merge truss geometries");
  merged.computeVertexNormals();

  const mesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial());
  mesh.name = "hammer-truss";

  const objText = new OBJExporter().parse(mesh);
  const blob = new Blob([objText], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  for (const g of geoms) g.dispose();
  merged.dispose();

  return geoms.length;
}

/**
 * Arch king-post truss equivalent of `exportFirstHammerTrussAsGlb`. Same
 * selection/baking logic, but targets the "arch-truss" group and excludes
 * any descendants of "arch-plates".
 */
export async function exportFirstArchTrussAsGlb(
  root: THREE.Group,
  filename = "arch-truss.glb",
): Promise<number> {
  return exportFirstHammerTrussAsGlb(root, filename, "arch-truss", "arch-plates");
}

/**
 * King-post truss equivalent of `exportFirstHammerTrussAsGlb`. Targets the
 * "king-truss" group and excludes any descendants of "king-plates".
 */
export async function exportFirstKingTrussAsGlb(
  root: THREE.Group,
  filename = "king-truss.glb",
): Promise<number> {
  return exportFirstHammerTrussAsGlb(root, filename, "king-truss", "king-plates");
}


/**
 * Export the entire pavilion (posts, beams, trusses, plates, roof, rafters,
 * decorative pieces — everything under the `pavilion-root` group) as a single
 * binary GLB. Preserves per-mesh materials and textures; skips hidden meshes
 * and anything under the "backyard" group (grass/trees/fence/sky/etc.) so the
 * file only contains the structure itself.
 */
export async function exportFullPavilionAsGlb(
  root: THREE.Group,
  filename = "pavilion.glb",
): Promise<number> {
  const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");
  root.updateMatrixWorld(true);

  // Clone so we can prune hidden / environment nodes without mutating the live scene.
  const cloned = root.clone(true) as THREE.Group;
  cloned.updateMatrixWorld(true);

  const toRemove: THREE.Object3D[] = [];
  cloned.traverse((o) => {
    if (o === cloned) return;
    if (o.visible === false) {
      toRemove.push(o);
      return;
    }
    const n = (o.name || "").toLowerCase();
    if (n === "backyard" || n.startsWith("backyard-") || n === "environment" || n === "sky" || n === "ground") {
      toRemove.push(o);
    }
  });
  for (const o of toRemove) o.parent?.remove(o);

  let meshCount = 0;
  cloned.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshCount++;
  });
  if (!meshCount) throw new Error("Pavilion has no exportable meshes");

  const exporter = new GLTFExporter();
  const arrayBuffer: ArrayBuffer = await new Promise((resolve, reject) => {
    exporter.parse(
      cloned,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(result);
        else reject(new Error("GLTFExporter did not return a binary GLB"));
      },
      (err) => reject(err),
      { binary: true, embedImages: true },
    );
  });

  const blob = new Blob([arrayBuffer], { type: "model/gltf-binary" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  return meshCount;
}





/**
 * Export the first truss group (auto-detects hammer / arch / king) as a
 * single clean low-poly binary STL. Excludes the matching plate group,
 * welds duplicate vertices, then decimates with SimplifyModifier so the
 * resulting file is light enough for downstream CAD/printers.
 *
 * `targetRatio` = fraction of vertices to KEEP (0.05–1.0). Default 0.25.
 */
export async function exportFirstTrussAsLowPolyStl(
  root: THREE.Group,
  filename = "truss-lowpoly.stl",
  targetRatio = 0.25,
): Promise<{ pieces: number; trianglesBefore: number; trianglesAfter: number; groupName: string }> {
  const { mergeGeometries:mergeBufferGeometries } = await import("three/addons/utils/BufferGeometryUtils.js");
 const {SimplifyModifier}=await import("three/addons/modifiers/SimplifyModifier.js");
  const { mergeVertices } = await import("three/examples/jsm/utils/BufferGeometryUtils.js");

  root.updateMatrixWorld(true);

  const candidates: Array<{ truss: string; plates: string }> = [
    { truss: "hammer-truss", plates: "hammer-plates" },
    { truss: "arch-truss", plates: "arch-plates" },
    { truss: "king-truss", plates: "king-plates" },
  ];

  let trussGroup: THREE.Object3D | null = null;
  let platesName = "";
  let trussName = "";
  for (const c of candidates) {
    root.traverse((o) => {
      if (!trussGroup && o.name === c.truss) {
        trussGroup = o;
        platesName = c.plates;
        trussName = c.truss;
      }
    });
    if (trussGroup) break;
  }
  if (!trussGroup) throw new Error("No truss group (hammer/arch/king) found in scene");

  const tGroup = trussGroup as THREE.Object3D;
  const trussInv = new THREE.Matrix4().copy(tGroup.matrixWorld).invert();

  function isUnderPlates(obj: THREE.Object3D): boolean {
    let o: THREE.Object3D | null = obj;
    while (o && o !== tGroup) {
      if (o.name === platesName) return true;
      o = o.parent;
    }
    return false;
  }

  const geoms: THREE.BufferGeometry[] = [];
  tGroup.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if (!(m as any).isMesh || !m.geometry) return;
    if (isUnderPlates(m)) return;
    if (!isVisibleChain(m, tGroup)) return;

    const src = m.geometry as THREE.BufferGeometry;
    if (!src.getAttribute("position")) return;
    const tmp = src.index ? src.toNonIndexed() : src.clone();
    const baked = new THREE.BufferGeometry();
    baked.setAttribute("position", tmp.getAttribute("position").clone());
    const worldToTruss = new THREE.Matrix4().multiplyMatrices(trussInv, m.matrixWorld);
    baked.applyMatrix4(worldToTruss);
    if (worldToTruss.determinant() < 0) flipWinding(baked);
    geoms.push(baked);
    tmp.dispose();
  });

  if (!geoms.length) throw new Error("Truss had no exportable meshes");

  let merged = mergeBufferGeometries(geoms, false);
  if (!merged) throw new Error("Failed to merge truss geometries");

  // Weld coincident vertices so SimplifyModifier can collapse across seams.
  const welded = mergeVertices(merged, 1e-4);
  merged.dispose();
  merged = welded;

  const trianglesBefore = merged.index
    ? merged.index.count / 3
    : (merged.getAttribute("position") as THREE.BufferAttribute).count / 3;

  const ratio = Math.max(0.05, Math.min(1, targetRatio));
  let simplified: THREE.BufferGeometry = merged;
  if (ratio < 1) {
    try {
      const vertCount = (merged.getAttribute("position") as THREE.BufferAttribute).count;
      const toRemove = Math.max(0, Math.floor(vertCount * (1 - ratio)));
      if (toRemove > 0) {
        const mod = new SimplifyModifier();
        simplified = mod.modify(merged, toRemove);
        merged.dispose();
      }
    } catch (e) {
      console.warn("SimplifyModifier failed, exporting un-decimated mesh:", e);
    }
  }

  simplified.computeVertexNormals();

  const trianglesAfter = simplified.index
    ? simplified.index.count / 3
    : (simplified.getAttribute("position") as THREE.BufferAttribute).count / 3;

  const tmpMesh = new THREE.Mesh(simplified, new THREE.MeshBasicMaterial());
  const stl = new STLExporter().parse(tmpMesh, { binary: true }) as unknown as DataView;
  const stlBuf = stl.buffer.slice(stl.byteOffset, stl.byteOffset + stl.byteLength) as ArrayBuffer;
  const blob = new Blob([stlBuf], { type: "model/stl" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  for (const g of geoms) g.dispose();
  simplified.dispose();

  return {
    pieces: geoms.length,
    trianglesBefore: Math.round(trianglesBefore),
    trianglesAfter: Math.round(trianglesAfter),
    groupName: trussName,
  };
}



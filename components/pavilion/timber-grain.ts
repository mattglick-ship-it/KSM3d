import * as THREE from 'three';

/** Each disconnected solid is a timber, including the solids inside one GLB mesh.
 * Project every long face in the same physical length direction. Curved braces
 * are sawn from solid stock: the grain stays straight through the curved cut. */
export function mapTimberGrain(source: THREE.BufferGeometry, scale = new THREE.Vector3(1, 1, 1), memberSeed = 0) {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  const p = geometry.getAttribute('position');
  const count = p.count / 3;
  const parents = Array.from({length: count}, (_, i) => i);
  const root = (i: number): number => {
    while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; }
    return i;
  };
  const seen = new Map<string, number>();
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < p.count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(p, i).multiply(scale);
    points.push(point);
    const key = point.toArray().map(v => Math.round(v * 1e5)).join(',');
    const triangle = Math.floor(i / 3);
    const prior = seen.get(key);
    if (prior !== undefined) parents[root(triangle)] = root(prior);
    else seen.set(key, triangle);
  }
  const solids = new Map<number, number[]>();
  for (let t = 0; t < count; t++) {
    const id = root(t);
    if (!solids.has(id)) solids.set(id, []);
    solids.get(id)!.push(t);
  }
  const uv = new Float32Array(p.count * 2);
  const ends = new Float32Array(p.count);
  const endUv = new Float32Array(p.count * 2);
  const seeds = new Float32Array(p.count);
  const axes: number[][] = [];
  for (const triangles of solids.values()) {
    // Unique vertices avoid bias toward tessellated decorative edges.
    const unique = new Map<string, THREE.Vector3>();
    for (const t of triangles) for (let k = 0; k < 3; k++) {
      const point = points[t * 3 + k];
      unique.set(point.toArray().map(v => Math.round(v * 1e5)).join(','), point);
    }
    const vertices = [...unique.values()];
    const center = vertices.reduce((sum, v) => sum.add(v), new THREE.Vector3()).divideScalar(vertices.length);
    const random = Math.sin(memberSeed + center.x * 12.9898 + center.y * 78.233 + center.z * 39.425) * 43758.5453;
    const seed = random - Math.floor(random);
    const size = new THREE.Box3().setFromPoints(vertices).getSize(new THREE.Vector3());
    const axis = size.x >= size.y && size.x >= size.z ? new THREE.Vector3(1,0,0) : size.y >= size.z ? new THREE.Vector3(0,1,0) : new THREE.Vector3(0,0,1);
    const covariance = new THREE.Matrix3().set(0,0,0,0,0,0,0,0,0);
    for (const v of vertices) {
      const a = v.clone().sub(center).toArray();
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) covariance.elements[c * 3 + r] += a[r] * a[c];
    }
    for (let n = 0; n < 32; n++) axis.applyMatrix3(covariance).normalize();
    const reference = Math.abs(axis.z) < 0.8 ? new THREE.Vector3(0,0,1) : new THREE.Vector3(0,1,0);
    const cross = new THREE.Vector3().crossVectors(reference, axis).normalize();
    const depth = new THREE.Vector3().crossVectors(axis, cross).normalize();
    axes.push(axis.toArray());
    for (const t of triangles) {
      const a = points[t*3], b = points[t*3+1], c = points[t*3+2];
      const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      const end = Math.abs(normal.dot(axis)) > 0.8;
      const across = Math.abs(normal.dot(depth)) >= Math.abs(normal.dot(cross)) ? cross : depth;
      for (let k = 0; k < 3; k++) {
        const i = t * 3 + k, local = points[i].clone().sub(center);
        // Same metre scale on every member; no face-sized stretching or 90° rotations.
        uv[i*2] = local.dot(axis) / 2.4;
        uv[i*2+1] = local.dot(across) / 0.6;
        ends[i] = end ? 1 : 0;
        seeds[i] = seed;
        endUv[i*2] = local.dot(cross);
        endUv[i*2+1] = local.dot(depth);
      }
    }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setAttribute('timberEnd', new THREE.BufferAttribute(ends, 1));
  geometry.setAttribute('timberEndUv', new THREE.BufferAttribute(endUv, 2));
  geometry.setAttribute('timberSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.userData.timberAxes = axes;
  return geometry;
}

export function configureTimberMaterial(material: THREE.MeshStandardMaterial, finish = 'smooth') {
  if (!material.userData.longitudinalTimber || material.userData.timberFinish !== finish) material.needsUpdate = true;
  material.userData.longitudinalTimber = true;
  material.userData.timberFinish = finish;
  const reliefShade = finish === 'hatchet-hand-peeled' ? 0.48 : finish === 'hand-peeled' ? 0.28 : finish === 'rough-sawn' ? 0.22 : 0;
  material.customProgramCacheKey = () => `ksm-longitudinal-timber-v3-${finish}`;
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float timberEnd;\nattribute vec2 timberEndUv;\nattribute float timberSeed;\nvarying float vTimberEnd;\nvarying vec2 vTimberEndUv;\nvarying float vTimberSeed;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvTimberEnd = timberEnd;\nvTimberEndUv = timberEndUv;\nvTimberSeed = timberSeed;');
    shader.fragmentShader = 'varying float vTimberEnd;\nvarying vec2 vTimberEndUv;\nvarying float vTimberSeed;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec4 timberColor = texture2D(map, vMapUv);
        // Preserve photographic grain instead of crushing shaded knots to black.
        // Slight board-to-board variation also works on shared truss materials.
        timberColor.rgb *= mix(vec3(0.96, 0.97, 0.99), vec3(1.04, 1.02, 0.99), vTimberSeed);
        #ifdef USE_BUMPMAP
          // Gentle cavity shading keeps tool cuts legible in diffuse daylight,
          // while the bump map supplies the changing directional highlights.
          float toolHeight = texture2D(bumpMap, vBumpMapUv).r;
          timberColor.rgb *= 1.0 - ${reliefShade.toFixed(2)} * pow(max(0.0, (0.55 - toolHeight) / 0.55), 0.7);
        #endif
        if (vTimberEnd > 0.5) {
          vec2 cut = vTimberEndUv + mix(vec2(0.04, 0.02), vec2(0.17, -0.07), vTimberSeed);
          cut.y *= 1.08;
          float radius = length(cut);
          float ringPhase = radius * 1150.0 + sin(radius * 137.0) * 1.7
            + sin(atan(cut.y, cut.x) * 3.0 + vTimberSeed * 6.28) * 0.9;
          float rings = sin(ringPhase) * (1.0 - smoothstep(0.6, 3.0, fwidth(ringPhase)));
          // Pale cut fibres retain the selected stain; irregular ring spacing
          // and shifted pith avoid identical concentric targets on every end.
          timberColor.rgb = mix(timberColor.rgb, vec3(0.75, 0.57, 0.33), 0.65) * (0.94 + 0.06 * rings);
        }
        diffuseColor *= timberColor;
      #endif
    `);
  };
  return material;
}

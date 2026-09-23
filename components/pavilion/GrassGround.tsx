import {useEffect, useMemo} from 'react';
import {useLoader, useThree} from '@react-three/fiber';
import * as THREE from 'three';
import grassAsset from '@/assets/grass.png.asset.json';

function naturalGrass(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.fragmentShader = shader.fragmentShader.replace('#include <map_pars_fragment>', `
    #include <map_pars_fragment>
    vec2 grassOffset(vec2 cell) {
      return fract(sin(vec2(dot(cell, vec2(127.1, 311.7)),
        dot(cell, vec2(269.5, 183.3)))) * 43758.5453);
    }
    vec4 grassSample(vec2 uv) {
      // Blend independently offset patches across a triangular grid. The
      // fixed world scale stays crisp without a visible repeating checker.
      vec2 grid = mat2(1.0, 0.0, -0.577350269, 1.154700538) * uv * .3;
      vec2 cell = floor(grid), f = fract(grid);
      vec2 a, b, c;
      vec3 weights;
      if (f.x + f.y < 1.0) {
        a = cell; b = cell + vec2(1,0); c = cell + vec2(0,1);
        weights = vec3(1.0-f.x-f.y, f.x, f.y);
      } else {
        a = cell + vec2(1,1); b = cell + vec2(0,1); c = cell + vec2(1,0);
        weights = vec3(f.x+f.y-1.0, 1.0-f.x, 1.0-f.y);
      }
      vec2 dx = dFdx(uv), dy = dFdy(uv);
      return textureGrad(map, uv + grassOffset(a), dx, dy) * weights.x
        + textureGrad(map, uv + grassOffset(b), dx, dy) * weights.y
        + textureGrad(map, uv + grassOffset(c), dx, dy) * weights.z;
    }
  `).replace('#include <map_fragment>', 'diffuseColor *= grassSample(vMapUv);');
}

/** Real ground with a fixed texture scale, rather than a stretched panorama. */
export function GrassGround() {
  const source = useLoader(THREE.TextureLoader, grassAsset.url);
  const gl = useThree(state => state.gl);
  const texture = useMemo(() => {
    const map = source.clone();
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(2000 / 1.5, 2000 / (1.5 * 229 / 357));
    map.anisotropy = Math.min(16, gl.capabilities.getMaxAnisotropy());
    map.needsUpdate = true;
    return map;
  }, [source, gl]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh name="grass-ground" rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    <planeGeometry args={[2000, 2000]} />
    <meshStandardMaterial map={texture} roughness={1} metalness={0} onBeforeCompile={naturalGrass} />
  </mesh>;
}

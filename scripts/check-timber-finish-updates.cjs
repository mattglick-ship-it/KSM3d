// Exercise the real WoodMaterial through R3F reconciliation without a GPU.
// Only the image loader is replaced; surface generation and shader setup are real.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const THREE = require('three');
const fiber = require('@react-three/fiber');
require('./load-typescript.cjs');
const {configureTimberMaterial} = require('../components/pavilion/timber-grain.ts');
const {useTimberSurface, TIMBER_SURFACES} = require('../components/pavilion/timber-surface.ts');

const source = fs.readFileSync('components/pavilion/Pavilion3D.tsx', 'utf8');
const ast = ts.createSourceFile('Pavilion3D.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'WoodMaterial');
assert(node, 'test must load the production WoodMaterial');
const output = ts.transpileModule(node.getText(ast), {compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React,
}}).outputText;
const WoodFinishContext = React.createContext('smooth');
const dependencies = {
  React, THREE, ...React, WoodFinishContext, useTimberSurface, configureTimberMaterial,
  GrainAdjustContext: React.createContext({}),
  GrainPieceContext: React.createContext({}),
  GrainFaceContext: React.createContext({}),
  useWoodTexture: () => React.useMemo(() => new THREE.Texture(), []),
};
const WoodMaterial = new Function(...Object.keys(dependencies), output + ';return WoodMaterial;')(...Object.values(dependencies));
fiber.extend(THREE);
global.IS_REACT_ACT_ENVIRONMENT = true;
global.requestAnimationFrame = () => 0;

async function main() {
  const canvas = {};
  let state;
  const root = fiber.createRoot(canvas);
  await root.configure({
    gl: {render() {}, setPixelRatio() {}, setSize() {}, domElement: canvas},
    frameloop: 'never', size: {width: 800, height: 600}, onCreated: s => { state = s; },
  });
  const categories = ['post', 'beam', 'rafter', 'truss', 'brace', 'plank'];
  const shaders = new Map();
  try {
    for (const finish of ['smooth', 'rough-sawn', 'hand-peeled', 'hatchet-hand-peeled', 'smooth', 'hatchet-hand-peeled']) {
      await React.act(async () => {
        root.render(React.createElement(WoodFinishContext.Provider, {value: finish},
          categories.flatMap(category => [false, true].map(singleMaterial =>
            React.createElement('mesh', {key: `${category}:${singleMaterial}`, name: `${category}:${singleMaterial}`},
              React.createElement('boxGeometry', {args: [.18, 2.4, .18]}),
              React.createElement(WoodMaterial, {color: '#ffffff', category, singleMaterial}),
            ),
          )),
        ));
      });
      let count = 0;
      state.scene.traverse(object => {
        if (!object.isMesh) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        assert.equal(materials.length, object.name.endsWith('true') ? 1 : 6);
        for (const material of materials) {
          count++;
          assert.equal(material.userData.timberFinish, finish, `${object.name}: shader must follow the selected finish`);
          assert(material.userData.longitudinalTimber);
          assert(material.customProgramCacheKey().endsWith(finish));
          assert(material.bumpMap?.isDataTexture);
          assert.equal(material.roughnessMap, material.bumpMap, 'roughness must use the registered green channel');
          const texels=material.bumpMap.image.data;
          assert(texels.some((v,i)=>i%4===1 && v!==texels[i-1]), 'roughness must be independent from surface height');
          assert.equal(material.bumpScale, TIMBER_SURFACES[finish].depth);
          assert.equal(material.roughness, TIMBER_SURFACES[finish].roughness);
          const shader = {vertexShader: '#include <uv_vertex>', fragmentShader: '#include <map_fragment>'};
          material.onBeforeCompile(shader);
          assert(shader.vertexShader.includes('vTimberEnd = timberEnd'));
          assert(shader.fragmentShader.includes('float toolHeight'));
          if (shaders.has(finish)) assert.equal(shader.fragmentShader, shaders.get(finish));
          shaders.set(finish, shader.fragmentShader);
        }
      });
      assert.equal(count, categories.length * 7);
    }
    assert.equal(new Set(shaders.values()).size, 4, 'each finish must compile its own tool-mark shading');
  } finally {
    await React.act(async () => root.unmount());
  }
  console.log('Timber finish updates passed: six categories, single/six-face materials, all four shaders, repeated switches and return to smooth.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

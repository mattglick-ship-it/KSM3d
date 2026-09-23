import {GrassGround} from './GrassGround';
import {pavilionCameraPosition} from './camera-fit';
import {drawingKey,registerReviewRenderer,renderPavilionDrawings} from './review-drawings';
import {TimberGrainMapping} from './TimberGrainMapping';
import {Dimensions} from "./dimensions";
import { Canvas, useLoader, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Environment } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { PavilionConfig } from "@/lib/pavilion-config";
import { Pavilion, type GrainAdjust, type GrainPieceAdjust, type GrainFaceAdjust, type RakeTrimAdjust, type BackRakeRotation, type TrussPlateExtraOffsets, type HandPeeledRandom } from "./Pavilion3D";
import type { Hammer12Adjust } from "./Hammer12Truss";
import type { Hammer14Adjust } from "./Hammer14Truss";
import type { Hammer16Adjust } from "./Hammer16Truss";
import type { Hammer20Adjust } from "./Hammer20Truss";
import { PicnicTable } from "./PicnicTable";
import { Sectional } from "./Sectional";
import { GreenEgg } from "./GreenEgg";
import { TvMount } from "./TvMount";
import { DiningTable } from "./DiningTable";
import { PatioSofa } from "./PatioSofa";
import { MeasureTool } from "./MeasureTool";
import * as THREE from "three";
import concretePadAsset from "@/assets/concrete-pad.jpg.asset.json";


function PadMesh({ width, length, thickness, tileScale = 1 }: { width: number; length: number; thickness: number; tileScale?: number }) {
  const tex = useLoader(THREE.TextureLoader, concretePadAsset.url);
  const s = Math.max(0.05, tileScale);
  const topTex = useMemo(() => {
    const t = tex.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(Math.max(0.1, width / (1.2 * s)), Math.max(0.1, length / (1.2 * s)));
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  }, [tex, width, length, s]);
  const mats = useMemo(() => {
    const patternedTop = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.95, metalness: 0 });
    const plain = new THREE.MeshStandardMaterial({ color: "#bfbcb4", roughness: 0.95, metalness: 0 });
    // box face order: [px, nx, py(top), ny(bottom), pz, nz]
    return [plain, plain, patternedTop, plain, plain, plain];
  }, [topTex]);
  return (
    <mesh position={[0, thickness / 2, 0]} receiveShadow castShadow material={mats}>
      <boxGeometry args={[width, thickness, length]} />
    </mesh>
  );
}

export type ViewPreset = "3d" | "top" | "side" | "under";

// Fixed afternoon sun: highlights and shadows remain anchored as you orbit.
function BackSun({width,length}:{width:number;length:number}) {
  const extent = Math.max(width, length) * 0.3048 * 0.75 + 2;
  return <directionalLight position={[-12, 9, 8]} intensity={1.85} color="#fff7ec" castShadow
    shadow-mapSize-width={2048} shadow-mapSize-height={2048}
    shadow-camera-left={-extent} shadow-camera-right={extent}
    shadow-camera-top={extent} shadow-camera-bottom={-extent}
    shadow-camera-near={1} shadow-camera-far={65}
    shadow-normalBias={0.0025} shadow-bias={-0.00008} shadow-radius={2.4} />;
}

function CameraRig({ view, config, allowUnderside, measureEnabled = false }: { view: ViewPreset; config:PavilionConfig; allowUnderside: boolean; measureEnabled?: boolean }) {
  const {size,camera}=useThree();
  const controls = useRef<any>(null);
  const isCustomer = !allowUnderside;
  // Keep both orbiting and panning above the ground, including under-roof mode.
  const keepAboveGround = () => {
    const c = controls.current;
    if (!c) return;
    const minimumHeight = 0.25;
    if (c.object.position.y < minimumHeight || c.target.y < minimumHeight) {
      c.object.position.y = Math.max(minimumHeight, c.object.position.y);
      c.target.y = Math.max(minimumHeight, c.target.y);
      c.object.lookAt(c.target);
    }
  };
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    if (view === "under") {
      c.object.position.set(0.01, 0.6, 0.01);
      c.target.set(0, 4, 0);
      c.update();
      return;
    }
    c.object.position.copy(pavilionCameraPosition(config.width,config.length,config.height,view,size.width/size.height,(camera as THREE.PerspectiveCamera).fov));
    c.target.set(0, 1.5, 0);
    c.update();
  }, [view,config.width,config.length,config.height,size.width,size.height,camera]);

  // In customer view, keep orbit target pinned to the pavilion center every frame
  // so zoom and interaction never drift the orbit pivot.
  useFrame(() => {
    if (!isCustomer) return;
    const c = controls.current;
    if (!c || view === "under") return;
    if (c.target.x !== 0 || c.target.y !== 1.5 || c.target.z !== 0) {
      c.target.set(0, 1.5, 0);
      c.update();
    }
  });

  return (
    <OrbitControls
      ref={controls}
      onChange={keepAboveGround}
      enabled={true}
      enablePan={!isCustomer}
      zoomToCursor={!isCustomer}
      screenSpacePanning={!isCustomer}
      minDistance={0.1}
      maxDistance={100}
      minPolarAngle={0}
      maxPolarAngle={view === "under" ? Math.PI : Math.PI / 2}
      {...(isCustomer ? { target: [0, 1.5, 0] as [number, number, number] } : {})}
    />
  );
}

// --- Hero-shot capture (used by QuoteDialog) ----------------------------------
// Repositions the camera to a deterministic 3/4 angle framed on the pavilion's
// bounding box, renders one frame, snapshots it, then restores camera state.
const pavilionGroupRef: { current: THREE.Group | null } = { current: null };
function ReviewCaptureRegistrar({config,tableStain,deckStain,showRoof}:{config:PavilionConfig;tableStain:string|null;deckStain:string|null;showRoof:boolean}){
 const {scene}=useThree();
 const key=drawingKey({config,tableStain,deckStain});
 useEffect(()=>{
  if(!showRoof)return;
  return registerReviewRenderer(key,()=>{
   if(!pavilionGroupRef.current)throw new Error('The pavilion is still loading. Retry the drawings.');
   return renderPavilionDrawings(pavilionGroupRef.current,scene.environment);
  });
 },[key,showRoof,scene]);
 return null;
}
const captureFnRef: { current: null | (() => Promise<string | undefined>) } = {
  current: null,
};

export async function captureHeroShot(): Promise<string | undefined> {
  return captureFnRef.current ? captureFnRef.current() : undefined;
}

function HeroCaptureRegistrar() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    captureFnRef.current = async () => {
      try {
        const group = pavilionGroupRef.current;
        if (!group) return undefined;
        const box = new THREE.Box3().setFromObject(group);
        if (!isFinite(box.min.x)) return undefined;
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        box.getCenter(center);
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);

        // Save current camera state
        const prevPos = camera.position.clone();
        const prevQuat = camera.quaternion.clone();
        const persp = camera as THREE.PerspectiveCamera;
        const prevFov = persp.fov;
        const prevAspect = persp.aspect;

        // Hero framing: front-right elevated 3/4 angle, fitted to bbox
        const fov = 32;
        persp.fov = fov;
        const fitDist =
          (maxDim * 0.6) / Math.tan((fov * Math.PI) / 360) * 1.15;
        const dir = new THREE.Vector3(0.85, 0.55, 1).normalize();
        const target = new THREE.Vector3(center.x, center.y * 0.65, center.z);
        const newPos = target.clone().add(dir.multiplyScalar(fitDist));
        camera.position.copy(newPos);
        camera.lookAt(target);
        persp.updateProjectionMatrix();

        // Render the hero frame
        gl.render(scene, camera);
        const dataUrl = gl.domElement.toDataURL("image/jpeg", 0.85);

        // Restore camera state
        camera.position.copy(prevPos);
        camera.quaternion.copy(prevQuat);
        persp.fov = prevFov;
        persp.aspect = prevAspect;
        persp.updateProjectionMatrix();
        gl.render(scene, camera);

        return dataUrl;
      } catch (e) {
        console.error("captureHeroShot failed", e);
        return undefined;
      }
    };
    return () => {
      captureFnRef.current = null;
    };
  }, [gl, scene, camera]);
  return null;
}

export function Scene({
  config,
  view,
  allowUnderside = false,
  showRoof = true,
  showTrusses = true,
  showFrame = true,
  showPad = false,
  padTileScale = 1,
  showTable = true,
  showSectional = false,
  sofaOffset = { x: 0, z: 0 },
  sofaRotation = 0,
  tableOffset = { x: 0, z: 0 },
  tableRotation = 0,
  showEgg = false,
  eggOffset = { x: 0, z: 0 },
  eggRotation = 0,
  showTv = false,
  tvCorner = "fl",
  tvHeightFt = 6,
  showDining = false,
  diningOffset = { x: 0, z: 0 },
  diningRotation = 0,
  showPatio = false,
  patioOffset = { x: 0, z: 0 },
  patioRotation = 0,
  tableStain = null,
  deckStain = null,
  stainOpacity = 0.9,
  stainDarkness = 0.3,
  showRafters = true,
  grainAdjust,
  grainPieces,
  grainFaces,
  handPeeledRandom,
  scrollCapRotation,
  rakeTrimAdjust,
  metalRakeTrimAdjust,
  backRakeRotate,
  backRakeRotation,
  shingleScale,
  shingleContrast,
  shingleBrightness,
  shingleSaturate,
  shingleBumpScale,
  shingleRoughness,
  shingleCapRotation,
  shingleCapScale,
  shingleCapOffset,
  shingleCapTextureScale,
  hammerYOffset,
  hammerScale,
  hammerGroupOffset,
  hammerCorbelScale,
  hammerCorbelOffset,
  hammerCorbelRotation,
  hammerPieceOffsets,
  hammerPieceScales,
  hammerUniformProfile55,
  hammer12Glb,
  hammer14Glb,
  hammer16Glb,
  hammer20Glb,
  plateOffset,
  plateRotation,
  plateSizeScale,
  webPlateOffset,
  webPlateRotation,
  webPlateSizeScale,
  vPlateSurfaceInset,
  webPlateSurfaceInset,
  peakPlateOffset,
  peakPlateRotation,
  peakPlateSizeScale,
  peakPlateSurfaceInset,
  archPlateOffset,
  archPlateRotation,
  archPlateSizeScale,
  simplePlateOffset,
  simplePlateRotation,
  simplePlateSizeScale,
  topPlateOffset,
  topPlateRotation,
  topPlateSizeScale,
  webPlate2Offset,
  webPlate2Rotation,
  webPlate2SizeScale,
  kingPeakPlateOffset,
  kingPeakPlateRotation,
  kingPeakPlateSizeScale,
  kingHeelPlateOffset,
  kingHeelPlateRotation,
  kingHeelPlateSizeScale,
  kingWebPlateOffset,
  kingWebPlateRotation,
  kingWebPlateSizeScale,
  kingHeelPlate2Offset,
  kingHeelPlate2Rotation,
  kingHeelPlate2SizeScale,
  trussPlateExtraOffsets,
  onPavilionMount,
  grassDensity = 1,
  grassTint = "#c8cfb8",
  grassTexture = 1,
  rawBeamColor,
  rawDeckColor,
  roofOnlyLiftIn,
  onGrainPick,
  pieceAdjusts,
  cloudSpread = 1,
  cloudConcentration = 1,
  cloudHeight = 0,
  measureEnabled = false,
  showBackyard = true,
  showDimensions = false,



}: {

  config: PavilionConfig;
  view: ViewPreset;
  allowUnderside?: boolean;
  showRoof?: boolean;
  showTrusses?: boolean;
  showFrame?: boolean;
  showPad?: boolean;
  padTileScale?: number;
  showTable?: boolean;
  showSectional?: boolean;
  tableStain?: string | null;
  deckStain?: string | null;
  stainOpacity?: number;
  stainDarkness?: number;
  showRafters?: boolean;
  sofaOffset?: { x: number; z: number };
  sofaRotation?: number;
  tableOffset?: { x: number; z: number };
  tableRotation?: number;
  showEgg?: boolean;
  eggOffset?: { x: number; z: number };
  eggRotation?: number;
  showTv?: boolean;
  tvCorner?: "fl" | "fr" | "br" | "bl";
  tvHeightFt?: number;
  showDining?: boolean;
  showPatio?: boolean;
  patioOffset?: { x: number; z: number };
  patioRotation?: number;
  diningOffset?: { x: number; z: number };
  diningRotation?: number;
  grainAdjust?: GrainAdjust;
  grainPieces?: GrainPieceAdjust;
  grainFaces?: GrainFaceAdjust;
  handPeeledRandom?: HandPeeledRandom;
  scrollCapRotation?: { x: number; y: number; z: number };
  rakeTrimAdjust?: RakeTrimAdjust;
  metalRakeTrimAdjust?: RakeTrimAdjust;
  backRakeRotate?: boolean;
  backRakeRotation?: BackRakeRotation;
  shingleScale?: number;
  shingleContrast?: number;
  shingleBrightness?: number;
  shingleSaturate?: number;
  shingleBumpScale?: number;
  shingleRoughness?: number;
  shingleCapRotation?: number;
  shingleCapScale?: { x: number; y: number; z: number };
  shingleCapOffset?: { x: number; y: number; z: number };
  shingleCapTextureScale?: { x: number; y: number; z: number };
  hammerYOffset?: number;
  hammerScale?: { x: number; y: number; z: number };
  hammerGroupOffset?: { x: number; y: number; z: number };
  hammerCorbelScale?: { x: number; y: number; z: number };
  hammerCorbelOffset?: { x: number; y: number; z: number };
  hammerCorbelRotation?: { x: number; y: number; z: number };
  hammerPieceOffsets?: Record<string, { x: number; y: number; z: number }>;
  hammerPieceScales?: Record<string, { x: number; y: number; z: number }>;
  hammerUniformProfile55?: boolean;
  hammer12Glb?: Hammer12Adjust;
  hammer14Glb?: Hammer14Adjust;
  hammer16Glb?: Hammer16Adjust;
  hammer20Glb?: Hammer20Adjust;
  plateOffset?: { x: number; y: number; z: number };
  plateRotation?: { x: number; y: number; z: number };
  plateSizeScale?: number;
  webPlateOffset?: { x: number; y: number; z: number };
  webPlateRotation?: { x: number; y: number; z: number };
  webPlateSizeScale?: number;
  vPlateSurfaceInset?: number;
  webPlateSurfaceInset?: number;
  peakPlateOffset?: { x: number; y: number; z: number };
  peakPlateRotation?: { x: number; y: number; z: number };
  peakPlateSizeScale?: number;
  peakPlateSurfaceInset?: number;
  archPlateOffset?: { x: number; y: number; z: number };
  archPlateRotation?: { x: number; y: number; z: number };
  archPlateSizeScale?: { x: number; y: number; z: number };
  simplePlateOffset?: { x: number; y: number; z: number };
  simplePlateRotation?: { x: number; y: number; z: number };
  simplePlateSizeScale?: { x: number; y: number; z: number };
  trussPlateExtraOffsets?: TrussPlateExtraOffsets;
  onPavilionMount?: (g: THREE.Group | null) => void;
  topPlateOffset?: { x: number; y: number; z: number };
  topPlateRotation?: { x: number; y: number; z: number };
  topPlateSizeScale?: { x: number; y: number; z: number };
  webPlate2Offset?: { x: number; y: number; z: number };
  webPlate2Rotation?: { x: number; y: number; z: number };
  webPlate2SizeScale?: { x: number; y: number; z: number };
  kingPeakPlateOffset?: { x: number; y: number; z: number };
  kingPeakPlateRotation?: { x: number; y: number; z: number };
  kingPeakPlateSizeScale?: { x: number; y: number; z: number };
  kingHeelPlateOffset?: { x: number; y: number; z: number };
  kingHeelPlateRotation?: { x: number; y: number; z: number };
  kingHeelPlateSizeScale?: { x: number; y: number; z: number };
  kingWebPlateOffset?: { x: number; y: number; z: number };
  kingWebPlateRotation?: { x: number; y: number; z: number };
  kingWebPlateSizeScale?: { x: number; y: number; z: number };
  kingHeelPlate2Offset?: { x: number; y: number; z: number };
  kingHeelPlate2Rotation?: { x: number; y: number; z: number };
  kingHeelPlate2SizeScale?: { x: number; y: number; z: number };
  grassDensity?: number;
  grassTint?: string;
  grassTexture?: number;
  rawBeamColor?: string;
  rawDeckColor?: string;
  onGrainPick?: (key: string, label: string, object?: THREE.Object3D) => void;
  pieceAdjusts?: Record<string, import("./PieceAdjuster").PieceAdjust>;
  roofOnlyLiftIn?: number;
  cloudSpread?: number;
  cloudConcentration?: number;
  cloudHeight?: number;
  measureEnabled?: boolean;
  showBackyard?: boolean;
  showDimensions?: boolean;
}) {
  const FT = 0.3048;
  const IN = 0.0254;

  const padThickness = 8 * IN;
  const padW = (config.width + 4) * FT;
  const padL = (config.length + 4) * FT;
  const [graphicsReady,setGraphicsReady]=useState<boolean|null>(null);
  useEffect(()=>{const canvas=document.createElement('canvas');let context:WebGL2RenderingContext|null=null;try{context=canvas.getContext('webgl2');setGraphicsReady(!!context)}catch{setGraphicsReady(false)}context?.getExtension('WEBGL_lose_context')?.loseContext()},[]);
  if(graphicsReady===null)return <div className="scene-loading">Preparing 3D view…</div>;
  if(!graphicsReady)return <div className="scene-loading" role="status"><h2>3D graphics are unavailable</h2><p>Enable hardware acceleration or open this designer in a browser that supports WebGL 2.</p><p>You can still configure your pavilion and save a quote.</p></div>;
  return (
    <Canvas
      shadows={{type: THREE.PCFShadowMap}}
      dpr={[1, 2]}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
      camera={{ position: [10, 6, 12], fov: 40, far: 3000 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, localClippingEnabled: true, preserveDrawingBuffer: true }}
    >
      <Suspense fallback={null}>
        <Environment files="/models/park.hdr" background={false} environmentIntensity={0.65} />
        <color attach="background" args={[showBackyard ? "#b9d3e7" : "#e8edef"]}/>
        {showBackyard && <fog attach="fog" args={["#b9d3e7", 120, 450]} />}
        <hemisphereLight args={["#dae9f5", "#b2a28a", 0.25]} />
        <ambientLight intensity={0.06} color="#fff8ef" />
        <BackSun width={config.width} length={config.length} />
        {showBackyard ? <GrassGround /> : <mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[200,200]}/><meshStandardMaterial color="#e4e9e7" roughness={1}/></mesh>}
        {showDimensions && <Dimensions width={config.width} length={config.length} height={config.height} pad={showPad}/>}
        <ContactShadows
          position={[0, (showPad ? padThickness : 0) + 0.004, 0]}
          opacity={0.34}
          scale={Math.max(config.width, config.length) * 0.3048 + 3}
          blur={2.2}
          far={1.2}
          resolution={1024}
        />
        {showPad && (
          <PadMesh width={padW} length={padL} thickness={padThickness} tileScale={padTileScale} />
        )}
        <group position={[0, showPad ? padThickness : 0, 0]}>
          <Pavilion config={config} showRoof={showRoof} showTrusses={showTrusses} showFrame={showFrame} showRafters={showRafters} grainAdjust={grainAdjust} grainPieces={grainPieces} grainFaces={grainFaces} handPeeledRandom={handPeeledRandom} scrollCapRotation={scrollCapRotation} rakeTrimAdjust={rakeTrimAdjust} metalRakeTrimAdjust={metalRakeTrimAdjust} backRakeRotate={backRakeRotate} backRakeRotation={backRakeRotation} shingleScale={shingleScale} shingleContrast={shingleContrast} shingleBrightness={shingleBrightness} shingleSaturate={shingleSaturate} shingleBumpScale={shingleBumpScale} shingleRoughness={shingleRoughness} shingleCapRotation={shingleCapRotation} shingleCapScale={shingleCapScale} shingleCapOffset={shingleCapOffset} shingleCapTextureScale={shingleCapTextureScale} hammerYOffset={hammerYOffset} hammerScale={hammerScale} hammerGroupOffset={hammerGroupOffset} hammerCorbelScale={hammerCorbelScale} hammerCorbelOffset={hammerCorbelOffset} hammerCorbelRotation={hammerCorbelRotation} hammerPieceOffsets={hammerPieceOffsets} hammerPieceScales={hammerPieceScales} hammer12Glb={hammer12Glb} hammer14Glb={hammer14Glb} hammer16Glb={hammer16Glb} hammer20Glb={hammer20Glb} plateOffset={plateOffset} plateRotation={plateRotation} plateSizeScale={plateSizeScale} webPlateOffset={webPlateOffset} webPlateRotation={webPlateRotation} webPlateSizeScale={webPlateSizeScale} vPlateSurfaceInset={vPlateSurfaceInset} webPlateSurfaceInset={webPlateSurfaceInset} peakPlateOffset={peakPlateOffset} peakPlateRotation={peakPlateRotation} peakPlateSizeScale={peakPlateSizeScale} peakPlateSurfaceInset={peakPlateSurfaceInset} archPlateOffset={archPlateOffset} archPlateRotation={archPlateRotation} archPlateSizeScale={archPlateSizeScale} simplePlateOffset={simplePlateOffset} simplePlateRotation={simplePlateRotation} simplePlateSizeScale={simplePlateSizeScale} topPlateOffset={topPlateOffset} topPlateRotation={topPlateRotation} topPlateSizeScale={topPlateSizeScale} webPlate2Offset={webPlate2Offset} webPlate2Rotation={webPlate2Rotation} webPlate2SizeScale={webPlate2SizeScale} kingPeakPlateOffset={kingPeakPlateOffset} kingPeakPlateRotation={kingPeakPlateRotation} kingPeakPlateSizeScale={kingPeakPlateSizeScale} kingHeelPlateOffset={kingHeelPlateOffset} kingHeelPlateRotation={kingHeelPlateRotation} kingHeelPlateSizeScale={kingHeelPlateSizeScale} kingWebPlateOffset={kingWebPlateOffset} kingWebPlateRotation={kingWebPlateRotation} kingWebPlateSizeScale={kingWebPlateSizeScale} kingHeelPlate2Offset={kingHeelPlate2Offset} kingHeelPlate2Rotation={kingHeelPlate2Rotation} kingHeelPlate2SizeScale={kingHeelPlate2SizeScale} trussPlateExtraOffsets={trussPlateExtraOffsets} pavilionStain={tableStain} deckStain={deckStain} stainOpacity={stainOpacity} stainDarkness={stainDarkness} rawBeamColor={rawBeamColor} rawDeckColor={rawDeckColor} roofOnlyLiftIn={roofOnlyLiftIn} onGrainPick={onGrainPick} pieceAdjusts={pieceAdjusts} onRootMount={(g) => { pavilionGroupRef.current = g; onPavilionMount?.(g); }} />
        <HeroCaptureRegistrar />
        <ReviewCaptureRegistrar config={config} tableStain={tableStain} deckStain={deckStain} showRoof={showRoof}/>
        </group>
        
        {showTable && <PicnicTable position={[tableOffset.x, showPad ? padThickness : 0, tableOffset.z]} rotation={tableRotation} stain={tableStain} />}
        {showSectional && <Sectional position={[sofaOffset.x, showPad ? padThickness : 0, sofaOffset.z]} rotation={sofaRotation} />}
        {showEgg && <GreenEgg position={[eggOffset.x, showPad ? padThickness : 0, eggOffset.z]} rotation={eggRotation} />}
        {showDining && <DiningTable position={[diningOffset.x, showPad ? padThickness : 0, diningOffset.z]} rotation={diningRotation} />}
        {showPatio && <PatioSofa position={[patioOffset.x, showPad ? padThickness : 0, patioOffset.z]} rotation={patioRotation} />}
        {showTv && (() => {
          const FT = 0.3048;
          const IN = 0.0254;
          const POST_THICK = 7.5 * IN;
          const postOffset = 0.15;
          const w = config.width * FT + 2 * postOffset - POST_THICK;
          const l = config.length * FT + 2 * postOffset;
          // signX/signZ pick which corner post. signs match the post-center
          // sign in pavilion-space (X=width, Z=length).
          const signs: Record<"fl" | "fr" | "br" | "bl", [number, number]> = {
            fl: [-1, -1],
            fr: [ 1, -1],
            br: [ 1,  1],
            bl: [-1,  1],
          };
          const [signX, signZ] = signs[tvCorner];
          const postX = signX * (w / 2 - postOffset);
          const postZ = signZ * (l / 2 - postOffset);
          // Wall plate sits flat against the post's inner corner, oriented at
          // 45° so it bisects the post's two interior faces.
          const innerCornerX = postX - signX * (POST_THICK / 2);
          const innerCornerZ = postZ - signZ * (POST_THICK / 2);
          const tvY = (showPad ? padThickness : 0) + tvHeightFt * FT;
          // Local +Z points toward interior diagonal (-signX, -signZ).
          const rotY = Math.atan2(-signX, -signZ);
          return <TvMount position={[innerCornerX, tvY, innerCornerZ]} rotation={rotY} />;
        })()}

        <CameraRig config={config} view={view} allowUnderside={allowUnderside} measureEnabled={measureEnabled} />
        <MeasureTool enabled={measureEnabled} />
      </Suspense>
      <TimberGrainMapping/>
    </Canvas>
  );
}

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CarSpec, TrackSpec } from './data';
import { audio } from './audio';

export type EngineQuality = 'low' | 'medium' | 'high';

// ============================================================
// Types
// ============================================================
export type CameraMode = 'chase' | 'cockpit';
export type RaceState = 'countdown' | 'racing' | 'finished' | 'paused';

export interface RaceResult {
  position: number;
  totalTime: number;
  bestLap: number;
  driftScore: number;
  nitroUsed: number;
  money: number;
  topSpeed: number;
}

export interface RaceCallbacks {
  onStateChange: (s: RaceState, countdown?: number) => void;
  onHUD: (hud: HUDData) => void;
  onFinish: (r: RaceResult) => void;
  onShake: (intensity: number) => void;
}

export interface HUDData {
  speed: number;
  gear: number;
  rpm: number;
  position: number;
  totalRacers: number;
  lap: number;
  totalLaps: number;
  nitro: number; // 0..1
  damage: number; // 0..1
  driftScore: number;
  totalDriftScore: number;
  raceTime: number;
  countdown: number; // 0 if not counting
  topSpeed: number;
  isDrifting: boolean;
  isNitro: boolean;
  positions: { name: string; progress: number; isPlayer: boolean; color: number }[];
}

// ============================================================
// Input
// ============================================================
export interface InputState {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1..1
  drift: boolean;
  nitro: boolean;
  repair: boolean;
  camera: boolean; // edge-triggered
}

// ============================================================
// Car mesh builder
// ============================================================
export function buildCarMesh(spec: CarSpec, isPlayer = false): THREE.Group {
  const group = new THREE.Group();
  const bodyColor = spec.color;
  const accentColor = spec.accentColor;

  const paint = new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.35, roughness: 0.3, envMapIntensity: 1.4 });
  const darkPaint = new THREE.MeshStandardMaterial({ color: accentColor, metalness: 0.3, roughness: 0.45, envMapIntensity: 1.1 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x35506a, metalness: 0.6, roughness: 0.12, transparent: true, opacity: 0.6, envMapIntensity: 1.6 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdadada, metalness: 0.9, roughness: 0.15, envMapIntensity: 1.6 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 1.2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 0.8 });

  // Body varies by bodyStyle
  let bodyLen = 4.4, bodyW = 1.9, bodyH = 0.55, roofH = 0.55;
  if (spec.bodyStyle === 'hypercar') { bodyLen = 4.8; bodyW = 2.0; bodyH = 0.5; roofH = 0.5; }
  if (spec.bodyStyle === 'muscle') { bodyLen = 4.6; bodyW = 2.0; bodyH = 0.6; roofH = 0.55; }
  if (spec.bodyStyle === 'tuner') { bodyLen = 4.2; bodyW = 1.85; bodyH = 0.5; roofH = 0.55; }
  if (spec.bodyStyle === 'exotic') { bodyLen = 4.5; bodyW = 1.95; bodyH = 0.52; roofH = 0.5; }

  // Main body (lower)
  const body = new THREE.Mesh(new THREE.BoxGeometry(bodyLen, bodyH, bodyW), paint);
  body.position.y = 0.45;
  body.castShadow = true;
  group.add(body);

  // Hood slope (front)
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, bodyW * 0.95), paint);
  hood.position.set(bodyLen * 0.35, 0.72, 0);
  hood.castShadow = true;
  group.add(hood);

  // Trunk slope (rear)
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.15, bodyW * 0.95), paint);
  trunk.position.set(-bodyLen * 0.35, 0.72, 0);
  trunk.castShadow = true;
  group.add(trunk);

  // Cabin / roof
  const cabinLen = bodyLen * 0.45;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(cabinLen, roofH, bodyW * 0.9), paint);
  cabin.position.set(-0.1, 0.72 + roofH / 2, 0);
  cabin.castShadow = true;
  group.add(cabin);

  // Windshield
  const wsGeo = new THREE.BoxGeometry(0.1, roofH * 0.85, bodyW * 0.85);
  const ws = new THREE.Mesh(wsGeo, glass);
  ws.position.set(cabinLen * 0.5, 0.72 + roofH / 2, 0);
  ws.rotation.z = 0.5;
  group.add(ws);
  const wsR = new THREE.Mesh(wsGeo, glass);
  wsR.position.set(-cabinLen * 0.5, 0.72 + roofH / 2, 0);
  wsR.rotation.z = -0.5;
  group.add(wsR);

  // Side windows
  const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(cabinLen * 0.9, roofH * 0.7, 0.08), glass);
  sideGlass.position.set(-0.1, 0.72 + roofH * 0.6, bodyW * 0.47);
  group.add(sideGlass);
  const sideGlass2 = sideGlass.clone();
  sideGlass2.position.z = -bodyW * 0.47;
  group.add(sideGlass2);

  // Wheels — axle along Z (across the car), so the tread faces the road
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.28, 16);
  wheelGeo.rotateX(Math.PI / 2);
  const wheelPositions: [number, number, number][] = [
    [bodyLen * 0.32, 0.38, bodyW * 0.5],
    [bodyLen * 0.32, 0.38, -bodyW * 0.5],
    [-bodyLen * 0.32, 0.38, bodyW * 0.5],
    [-bodyLen * 0.32, 0.38, -bodyW * 0.5],
  ];
  const wheels: THREE.Mesh[] = [];
  for (const p of wheelPositions) {
    const w = new THREE.Mesh(wheelGeo, rubber);
    w.position.set(...p);
    w.castShadow = true;
    group.add(w);
    wheels.push(w);
    // Rim
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 8), chrome);
    rim.rotateX(Math.PI / 2);
    rim.position.set(...p);
    group.add(rim);
  }
  (group as any).wheels = wheels;

  // Headlights
  const hl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.3), lightMat);
  hl.position.set(bodyLen * 0.5, 0.55, bodyW * 0.3);
  group.add(hl);
  const hl2 = hl.clone(); hl2.position.z = -bodyW * 0.3;
  group.add(hl2);

  // Tail lights
  const tl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.25), tailMat);
  tl.position.set(-bodyLen * 0.5, 0.55, bodyW * 0.3);
  group.add(tl);
  const tl2 = tl.clone();
  tl2.material = tailMat.clone(); // independent: one light can die from damage
  tl2.position.z = -bodyW * 0.3;
  group.add(tl2);

  // Refs for brake-light glow and damage deformation
  (group as any).tailLights = [tl, tl2];
  (group as any).damageParts = {
    body, hood, trunk, cabin,
    glass: [ws, wsR, sideGlass, sideGlass2],
    paint,
    baseColor: paint.color.clone(),
  };

  // Spoiler (muscle/hypercar/tuner)
  if (spec.bodyStyle !== 'coupe') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, bodyW * 1.05), darkPaint);
    spoiler.position.set(-bodyLen * 0.45, 1.1, 0);
    group.add(spoiler);
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), darkPaint);
    strut.position.set(-bodyLen * 0.45, 0.95, bodyW * 0.35);
    group.add(strut);
    const strut2 = strut.clone(); strut2.position.z = -bodyW * 0.35;
    group.add(strut2);
  }

  // Interior for cockpit view (simple dash)
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, bodyW * 0.85), darkPaint);
  dash.position.set(cabinLen * 0.3, 0.85, 0);
  dash.visible = false;
  group.add(dash);
  (group as any).dashboard = dash;
  const steering = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 6, 16), darkPaint);
  steering.position.set(cabinLen * 0.25, 1.0, 0.25);
  steering.rotation.x = Math.PI / 2.3;
  steering.visible = false;
  group.add(steering);
  (group as any).steering = steering;

  // Headlight point light for player
  if (isPlayer) {
    const headLight = new THREE.SpotLight(0xffffee, 0, 40, Math.PI / 4, 0.5, 1);
    headLight.position.set(bodyLen * 0.5, 0.6, 0);
    headLight.target.position.set(bodyLen * 0.5 + 10, 0, 0);
    group.add(headLight);
    group.add(headLight.target);
    (group as any).headLight = headLight;
  }

  // Soft contact shadow under the car (grounds it visually)
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(5.4, 2.9),
    new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.03;
  group.add(blob);

  // Car model is built with the nose along +X, but physics/camera use +Z forward.
  // Wrap it rotated -90° so the car visually faces the direction it travels.
  group.rotation.y = -Math.PI / 2;
  const wrap = new THREE.Group();
  wrap.add(group);
  (wrap as any).spec = spec;
  (wrap as any).wheels = (group as any).wheels;
  (wrap as any).steering = (group as any).steering;
  (wrap as any).tailLights = (group as any).tailLights;
  (wrap as any).damageParts = (group as any).damageParts;
  return wrap;
}

// ============================================================
// Physics state per car
// ============================================================
interface CarState {
  mesh: THREE.Group;
  spec: CarSpec;
  isPlayer: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  heading: number; // radians, forward direction in XZ
  angularVel: number;
  speed: number; // m/s (forward)
  lateralSpeed: number;
  rpm: number;
  gear: number;
  nitro: number; // 0..1 (fraction of max)
  nitroActive: boolean;
  damage: number; // 0..1
  driftFactor: number; // 0..1 current drift amount
  isDrifting: boolean;
  onTrack: boolean;
  lap: number;
  lastCheckpoint: number;
  checkpointProgress: number; // 0..1 around the track
  progressDistance: number; // total distance travelled along path
  lapTimes: number[];
  lastLapStart: number;
  finished: boolean;
  finishTime: number;
  // AI
  aiTargetIdx: number;
  aiSkill: number; // 0..1
  aiNitroCooldown: number;
  aiMistakeTimer: number;
  aiOffset: number; // lateral offset from racing line
  // Effects
  driftScoreAccum: number;
  topSpeed: number;
  nitroUsedTotal: number;
  // Damage visual
  bodyTilt: number;
}

// ============================================================
// Track builder from spline
// ============================================================
interface TrackData {
  curve: THREE.CatmullRomCurve3;
  mesh: THREE.Group;
  checkpoints: THREE.Vector3[];
  barriers: { pos: THREE.Vector3; normal: THREE.Vector3; width: number }[];
  totalLength: number;
  scenery: THREE.Object3D[];
}

// ---------- Brighter per-environment palettes ----------
const ENV_GROUND: Record<string, number> = {
  city: 0x8a8e94, highway: 0x5b8a4a, mountain: 0x578348, desert: 0xd9b57e,
  coastal: 0x74a89a, industrial: 0x68686e, tunnel: 0x2e2e33, night: 0x181d2b,
  rain: 0x5e6873, airport: 0x8a8e94, forest: 0x48803c, circuit: 0x84888e,
};
const ENV_ROAD: Record<string, number> = {
  city: 0x26262d, highway: 0x26262c, mountain: 0x28282e, desert: 0x8a6b45,
  coastal: 0x292a30, industrial: 0x2c2c33, tunnel: 0x1f1f24, night: 0x16161e,
  rain: 0x24242b, airport: 0x303036, forest: 0x27272d, circuit: 0x26262d,
};

// ---------- Procedural building facade textures (windows, day & night) ----------
const buildingTexCache = new Map<string, THREE.CanvasTexture>();
const BUILDING_BASES_DAY = ['#b9b3a7', '#9fabb8', '#c6b69b', '#8d99a6', '#b4a696', '#98a49b'];
const BUILDING_BASES_NIGHT = ['#2b3242', '#232a3a', '#2f343e'];
function pickBuildingTexture(night: boolean): THREE.CanvasTexture {
  const bases = night ? BUILDING_BASES_NIGHT : BUILDING_BASES_DAY;
  const base = bases[Math.floor(Math.random() * bases.length)];
  const key = `${night ? 'n' : 'd'}:${base}:${Math.floor(Math.random() * 3)}`;
  const cached = buildingTexCache.get(key);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  const cols = 6, rows = 16;
  const wx = 128 / cols, wy = 256 / rows;
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      const lit = night && Math.random() < 0.38;
      g.fillStyle = lit ? '#ffd784' : night ? '#11161f' : '#2c3644';
      g.fillRect(x * wx + 3.5, y * wy + 4, wx - 7, wy - 8);
    }
  }
  // subtle shading gradient for depth
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.18)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
  grad.addColorStop(1, 'rgba(0,0,0,0.12)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  buildingTexCache.set(key, tex);
  return tex;
}

// Soft blob shadow texture (shared)
let blobTexCache: THREE.CanvasTexture | null = null;
function blobTexture(): THREE.CanvasTexture {
  if (blobTexCache) return blobTexCache;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.65, 'rgba(0,0,0,0.28)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  blobTexCache = new THREE.CanvasTexture(c);
  return blobTexCache;
}

function buildTrack(scene: THREE.Scene, spec: TrackSpec, quality: EngineQuality = 'high'): TrackData {
  const group = new THREE.Group();
  scene.add(group);

  // Build spline
  const points = spec.path.map(p => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);
  const totalLength = curve.getLength();

  // Road mesh: extrude along spline
  const segments = Math.max(200, Math.floor(totalLength / 4));
  const roadGeo = new THREE.BufferGeometry();
  const verts: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const width = spec.width;

  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();
    // If tan is vertical, right could be zero; fallback
    if (right.lengthSq() < 0.01) right.set(1, 0, 0);
    const left = p.clone().add(right.clone().multiplyScalar(-width / 2));
    const rightP = p.clone().add(right.clone().multiplyScalar(width / 2));
    // Slightly above ground
    left.y += 0.02; rightP.y += 0.02;
    verts.push(left.x, left.y, left.z, rightP.x, rightP.y, rightP.z);
    uvs.push(0, t * 40, 1, t * 40);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
    indices.push(a, c, b, b, c, d);
  }
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  roadGeo.setIndex(indices);
  roadGeo.computeVertexNormals();

  const roadMat = new THREE.MeshStandardMaterial({ color: ENV_ROAD[spec.environment] ?? spec.roadColor, roughness: 0.95, metalness: 0.0, envMapIntensity: 0.15 });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.receiveShadow = true;
  group.add(road);

  // Center line markings
  const centerGeo = new THREE.BufferGeometry();
  const cverts: number[] = [];
  const cinds: number[] = [];
  for (let i = 0; i < segments; i++) {
    const dashT0 = i / segments;
    const dashT1 = (i + 0.4) / segments;
    if (i % 2 !== 0) continue;
    const p0 = curve.getPointAt(dashT0);
    const p1 = curve.getPointAt(Math.min(dashT1, 0.9999));
    const t0 = curve.getTangentAt(dashT0).normalize();
    const t1 = curve.getTangentAt(Math.min(dashT1, 0.9999)).normalize();
    // Offset along the road's lateral axis so dashes stay perpendicular even in corners
    const r0 = new THREE.Vector3().crossVectors(t0, up).normalize();
    const r1 = new THREE.Vector3().crossVectors(t1, up).normalize();
    const hw = 0.21; // half width of the stripe
    p0.y += 0.045; p1.y += 0.045;
    const a = p0.clone().add(r0.clone().multiplyScalar(-hw));
    const b = p0.clone().add(r0.clone().multiplyScalar(hw));
    const c = p1.clone().add(r1.clone().multiplyScalar(hw));
    const d = p1.clone().add(r1.clone().multiplyScalar(-hw));
    const idx = cverts.length / 3;
    cverts.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z);
    cinds.push(idx, idx + 2, idx + 1, idx + 1, idx + 2, idx + 3);
  }
  centerGeo.setAttribute('position', new THREE.Float32BufferAttribute(cverts, 3));
  centerGeo.setIndex(cinds);
  centerGeo.computeVertexNormals();
  const centerMat = new THREE.MeshStandardMaterial({ color: 0xfffbe8, emissive: 0x99997f, emissiveIntensity: 1.0, envMapIntensity: 0.2 });
  const centerMesh = new THREE.Mesh(centerGeo, centerMat);
  group.add(centerMesh);

  // Edge lines
  for (const side of [-1, 1]) {
    const edgeVerts: number[] = [];
    const edgeInds: number[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t).normalize();
      const right = new THREE.Vector3().crossVectors(tan, up).normalize();
      if (right.lengthSq() < 0.01) right.set(1, 0, 0);
      const edge = p.clone().add(right.clone().multiplyScalar(side * (width / 2 - 0.68)));
      edge.y += 0.045;
      const edge2 = p.clone().add(right.clone().multiplyScalar(side * (width / 2 - 0.16)));
      edge2.y += 0.04;
      edgeVerts.push(edge.x, edge.y, edge.z, edge2.x, edge2.y, edge2.z);
    }
    for (let i = 0; i < segments; i++) {
      const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
      edgeInds.push(a, c, b, b, c, d);
    }
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.Float32BufferAttribute(edgeVerts, 3));
    eg.setIndex(edgeInds);
    eg.computeVertexNormals();
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: spec.environment === 'night' ? 0x667799 : 0x606060 });
    group.add(new THREE.Mesh(eg, edgeMat));
  }

  // Ground plane
  const groundSize = 3000;
  const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize, 1, 1);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshStandardMaterial({ color: ENV_GROUND[spec.environment] ?? spec.groundColor, roughness: 1, envMapIntensity: 0.15 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  ground.position.y = -0.05;
  group.add(ground);

  // Scenery based on environment
  const scenery: THREE.Object3D[] = [];
  const barrierData: { pos: THREE.Vector3; normal: THREE.Vector3; width: number }[] = [];

  // Guardrails along edges — continuous red/white rails (merged = fast)
  const railGeosWhite: THREE.BufferGeometry[] = [];
  const railGeosRed: THREE.BufferGeometry[] = [];
  const barrierCount = Math.floor(totalLength / 3.4);
  for (let i = 0; i < barrierCount; i++) {
    const t = i / barrierCount;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();
    if (right.lengthSq() < 0.01) right.set(1, 0, 0);
    for (const side of [-1, 1]) {
      const bp = p.clone().add(right.clone().multiplyScalar(side * (width / 2 + 1.0)));
      bp.y += 0.45;
      // Length along Z — after yaw it aligns WITH the road direction (not across it)
      const g = new THREE.BoxGeometry(0.35, 0.9, 3.6);
      g.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(tan.x, tan.z)));
      g.translate(bp.x, bp.y, bp.z);
      (i % 2 === 0 ? railGeosWhite : railGeosRed).push(g);
      barrierData.push({ pos: bp.clone(), normal: right.clone().multiplyScalar(-side), width: 3.6 });
    }
  }
  const railMatWhite = new THREE.MeshStandardMaterial({ color: 0xf0f2f4, roughness: 0.55, envMapIntensity: 0.3 });
  const railMatRed = new THREE.MeshStandardMaterial({ color: 0xd64545, roughness: 0.55, emissive: 0x551111, emissiveIntensity: 0.4, envMapIntensity: 0.3 });
  const railWhite = new THREE.Mesh(mergeGeometries(railGeosWhite, false)!, railMatWhite);
  const railRed = new THREE.Mesh(mergeGeometries(railGeosRed, false)!, railMatRed);
  group.add(railWhite, railRed);
  scenery.push(railWhite, railRed);

  // Environment-specific scenery
  const placeProps = (count: number, offsetMin: number, offsetMax: number, build: () => THREE.Object3D) => {
    for (let i = 0; i < count; i++) {
      const t = Math.random();
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t).normalize();
      const right = new THREE.Vector3().crossVectors(tan, up).normalize();
      if (right.lengthSq() < 0.01) right.set(1, 0, 0);
      const side = Math.random() < 0.5 ? -1 : 1;
      const offset = offsetMin + Math.random() * (offsetMax - offsetMin);
      const prop = build();
      prop.position.copy(p).add(right.clone().multiplyScalar(side * offset));
      prop.position.y = p.y;
      group.add(prop);
      scenery.push(prop);
    }
  };

  if (spec.environment === 'city' || spec.environment === 'night' || spec.environment === 'tunnel') {
    // Buildings with window facades
    placeProps(90, 25, 85, () => {
      const h = 12 + Math.random() * 42;
      const w = 9 + Math.random() * 12;
      const d = 9 + Math.random() * 12;
      const night = spec.environment === 'night';
      const tex = pickBuildingTexture(night);
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.85,
        metalness: 0.05,
        envMapIntensity: 0.35,
        ...(night ? { emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.45 } : {}),
      });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.y = h / 2;
      b.castShadow = quality !== 'low';
      return b;
    });
  } else if (spec.environment === 'desert') {
    placeProps(60, 20, 80, () => {
      const h = 2 + Math.random() * 8;
      const r = 1 + Math.random() * 3;
      return new THREE.Mesh(
        new THREE.ConeGeometry(r, h, 6),
        new THREE.MeshStandardMaterial({ color: 0xd4a060, roughness: 1 })
      );
    });
  } else if (spec.environment === 'mountain' || spec.environment === 'forest' || spec.environment === 'coastal') {
    placeProps(100, 18, 80, () => {
      const g = new THREE.Group();
      const trunkH = 2 + Math.random() * 3;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.4, trunkH, 6),
        new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.9 })
      );
      trunk.position.y = trunkH / 2;
      g.add(trunk);
      const leaves = new THREE.Mesh(
        new THREE.ConeGeometry(1.5 + Math.random(), 4 + Math.random() * 3, 6),
        new THREE.MeshStandardMaterial({ color: spec.environment === 'coastal' ? 0x4a8050 : 0x3a6a30, roughness: 0.9 })
      );
      leaves.position.y = trunkH + 1.5;
      g.add(leaves);
      return g;
    });
    if (spec.environment === 'mountain') {
      // Mountains in background
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2;
        const dist = 600 + Math.random() * 400;
        const h = 80 + Math.random() * 150;
        const m = new THREE.Mesh(
          new THREE.ConeGeometry(80 + Math.random() * 60, h, 5),
          new THREE.MeshStandardMaterial({ color: 0x5a6a7a, roughness: 1 })
        );
        m.position.set(Math.cos(angle) * dist, h / 2 - 20, Math.sin(angle) * dist);
        group.add(m);
      }
    }
  } else if (spec.environment === 'highway' || spec.environment === 'airport') {
    placeProps(40, 22, 60, () => {
      const h = 6;
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, h, 6),
        new THREE.MeshStandardMaterial({ color: 0x888888 })
      );
      post.position.y = h / 2;
      return post;
    });
  } else if (spec.environment === 'industrial') {
    placeProps(50, 20, 60, () => {
      const h = 5 + Math.random() * 15;
      const c = Math.random() < 0.5 ? 0x888888 : 0xaa6633;
      const container = new THREE.Mesh(
        new THREE.BoxGeometry(4, h * 0.3, 2),
        new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })
      );
      container.position.y = h * 0.15;
      return container;
    });
  }

  // Clouds in the sky (not for night/tunnel)
  if (spec.environment !== 'night' && spec.environment !== 'tunnel') {
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false });
    for (let i = 0; i < 12; i++) {
      const cl = new THREE.Group();
      const n = 2 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) {
        const s = 9 + Math.random() * 15;
        const puff = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), cloudMat);
        puff.position.set(k * s * 0.9, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 9);
        puff.scale.y = 0.45;
        cl.add(puff);
      }
      const ang = Math.random() * Math.PI * 2;
      const rad = 150 + Math.random() * 500;
      cl.position.set(Math.cos(ang) * rad, 100 + Math.random() * 90, Math.sin(ang) * rad);
      group.add(cl);
    }
  }

  // Checkpoints (split track into N checkpoints)
  const cpCount = 16;
  const checkpoints: THREE.Vector3[] = [];
  for (let i = 0; i < cpCount; i++) {
    checkpoints.push(curve.getPointAt(i / cpCount));
  }

  return { curve, mesh: group, checkpoints, barriers: barrierData, totalLength, scenery };
}

// ============================================================
// Engine
// ============================================================
export class GameEngine {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private container: HTMLDivElement;
  private trackData: TrackData | null = null;
  private trackSpec: TrackSpec | null = null;
  private cars: CarState[] = [];
  private player: CarState | null = null;
  private cameraMode: CameraMode = 'chase';
  private state: RaceState = 'countdown';
  private countdownTime = 3;
  private raceTime = 0;
  private lastT = 0;
  private callbacks: RaceCallbacks;
  private animationId = 0;
  private running = false;
  private input: InputState = { throttle: 0, brake: 0, steer: 0, drift: false, nitro: false, repair: false, camera: false };
  private sun: THREE.DirectionalLight | null = null;
  private repairCooldown = 0;
  private exhaustTimer = 0;
  private damageSmokeTimer = 0;
  private freeDrive = false;
  private shakeIntensity = 0;
  private smokeParticles: { mesh: THREE.Mesh; life: number; vel: THREE.Vector3 }[] = [];
  private skidMarks: THREE.Mesh[] = [];
  private skidGeo: THREE.BufferGeometry;
  private skidPositions: Float32Array;
  private skidIdx = 0;
  private skidMax = 2000;
  private totalDriftScore = 0;
  private nitroUsedTotal = 0;
  private topSpeed = 0;
  private finishedPosition = 0;
  private skyMesh: THREE.Mesh | null = null;

  private composer: EffectComposer | null = null;
  private engineQuality: EngineQuality = 'high';

  constructor(container: HTMLDivElement, callbacks: RaceCallbacks, opts?: { quality?: EngineQuality }) {
    this.container = container;
    this.callbacks = callbacks;
    this.engineQuality = opts?.quality ?? 'high';
    const q = this.engineQuality;

    this.scene = new THREE.Scene();
    // Fallback to window size if container has no layout yet (prevents 0x0 black canvas)
    const initW = container.clientWidth || window.innerWidth || 1280;
    const initH = container.clientHeight || window.innerHeight || 720;
    this.camera = new THREE.PerspectiveCamera(70, initW / initH, 0.1, 2000);
    this.camera.position.set(0, 10, 20);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    // Quality: pixel ratio is the biggest FPS lever
    this.renderer.setPixelRatio(q === 'low' ? 1 : Math.min(window.devicePixelRatio, q === 'medium' ? 1.5 : 2));
    this.renderer.setSize(initW, initH);
    this.renderer.shadowMap.enabled = q !== 'low';
    this.renderer.shadowMap.type = q === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    container.appendChild(this.renderer.domElement);

    // Studio reflections — makes car paint, glass and chrome crisp and glossy
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Cinematic bloom (high quality only) — glowing lights, sun glints
    if (q === 'high') {
      try {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        const bloom = new UnrealBloomPass(new THREE.Vector2(initW, initH), 0.32, 0.5, 0.88);
        this.composer.addPass(bloom);
        this.composer.addPass(new OutputPass());
      } catch {
        this.composer = null;
      }
    }

    // Skid mark buffer
    this.skidGeo = new THREE.BufferGeometry();
    this.skidPositions = new Float32Array(this.skidMax * 6); // 2 triangles per mark
    this.skidGeo.setAttribute('position', new THREE.BufferAttribute(this.skidPositions, 3));
    this.skidGeo.setDrawRange(0, 0);
    const skidMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.55, depthWrite: false });
    const skidMesh = new THREE.Mesh(this.skidGeo, skidMat);
    skidMesh.renderOrder = 1;
    this.scene.add(skidMesh);
    this.skidMarks.push(skidMesh);

    window.addEventListener('resize', this.onResize);
  }

  private onResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  startRace(playerCar: CarSpec, track: TrackSpec, aiSpecs: { spec: CarSpec; skill: number }[], opts?: { freeDrive?: boolean }) {
    this.cleanup();
    this.freeDrive = !!opts?.freeDrive;
    // Recalculate size now that the container is visible (safety net)
    this.onResize();
    this.trackSpec = track;
    this.totalDriftScore = 0;
    this.nitroUsedTotal = 0;
    this.topSpeed = 0;
    this.raceTime = 0;
    this.countdownTime = 3;
    this.state = 'countdown';
    this.repairCooldown = 0;
    this.finishedPosition = 0;

    // Sky / fog (lighter haze so the world stays clear)
    this.scene.fog = new THREE.FogExp2(track.fogColor, track.fogDensity * 0.55);
    this.scene.background = new THREE.Color(track.skyColor);

    // Skybox dome
    if (this.skyMesh) this.scene.remove(this.skyMesh);
    const skyGeo = new THREE.SphereGeometry(1200, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(track.skyColor) },
        bottomColor: { value: new THREE.Color(track.fogColor) },
      },
      vertexShader: `varying vec3 vWorldPosition; void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vWorldPosition = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; varying vec3 vWorldPosition; void main() { float h = normalize(vWorldPosition).y; gl_FragColor = vec4(mix(bottomColor, topColor, max(h, 0.0)), 1.0); }`,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyMesh);

    // Lights — brighter, clearer world
    const ambient = new THREE.AmbientLight(track.ambientColor, 0.95);
    this.scene.add(ambient);
    const hemi = new THREE.HemisphereLight(track.skyColor, track.groundColor, 0.7);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(track.sunColor, track.environment === 'night' ? 0.5 : 1.7);
    this.sun.position.set(100, 200, 80);
    this.sun.castShadow = true;
    const shSize = this.engineQuality === 'high' ? 1024 : 512;
    this.sun.shadow.mapSize.set(shSize, shSize);
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 600;
    this.sun.shadow.camera.left = -150;
    this.sun.shadow.camera.right = 150;
    this.sun.shadow.camera.top = 150;
    this.sun.shadow.camera.bottom = -150;
    this.sun.shadow.bias = -0.001;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // Build track
    this.trackData = buildTrack(this.scene, track, this.engineQuality);

    // Spawn cars on grid
    const startT = 0;
    const startPos = this.trackData.curve.getPointAt(startT);
    const startTan = this.trackData.curve.getTangentAt(startT).normalize();
    const right = new THREE.Vector3().crossVectors(startTan, new THREE.Vector3(0, 1, 0)).normalize();

    const allSpecs: { spec: CarSpec; skill: number; isPlayer: boolean }[] = [
      { spec: playerCar, skill: 1.0, isPlayer: true },
      ...aiSpecs.map(a => ({ spec: a.spec, skill: a.skill, isPlayer: false })),
    ];

    this.cars = [];
    allSpecs.forEach((entry, idx) => {
      const row = Math.floor(idx / 2);
      const col = idx % 2;
      const offset = (col === 0 ? -1 : 1) * 2.5;
      const pos = startPos.clone()
        .add(startTan.clone().multiplyScalar(-row * 8))
        .add(right.clone().multiplyScalar(offset));
      pos.y += 0.5;
      const mesh = buildCarMesh(entry.spec, entry.isPlayer);
      mesh.position.copy(pos);
      const heading = Math.atan2(startTan.x, startTan.z);
      mesh.rotation.y = heading;
      this.scene.add(mesh);
      const car: CarState = {
        mesh,
        spec: entry.spec,
        isPlayer: entry.isPlayer,
        position: pos.clone(),
        velocity: new THREE.Vector3(),
        heading,
        angularVel: 0,
        speed: 0,
        lateralSpeed: 0,
        rpm: 0.2,
        gear: 1,
        nitro: 1,
        nitroActive: false,
        damage: 0,
        driftFactor: 0,
        isDrifting: false,
        onTrack: true,
        lap: 0,
        lastCheckpoint: 0,
        checkpointProgress: 0,
        progressDistance: 0,
        lapTimes: [],
        lastLapStart: 0,
        finished: false,
        finishTime: 0,
        aiTargetIdx: 2,
        aiSkill: entry.skill,
        aiNitroCooldown: 5 + Math.random() * 10,
        aiMistakeTimer: 0,
        aiOffset: (Math.random() - 0.5) * 4,
        driftScoreAccum: 0,
        topSpeed: 0,
        nitroUsedTotal: 0,
        bodyTilt: 0,
      };
      this.cars.push(car);
      if (entry.isPlayer) this.player = car;
    });

    // Enable player headlights at night
    if (this.player && track.environment === 'night') {
      const hl = (this.player.mesh as any).headLight as THREE.SpotLight;
      if (hl) hl.intensity = 3;
    }

    // Start engine sound
    audio.startEngine(playerCar.enginePitch);
    if (track.environment === 'night' || track.environment === 'tunnel') audio.startMusic();

    // Position camera
    this.updateCamera(0, true);
    this.running = true;
    this.lastT = performance.now();
    this.animate();
    this.callbacks.onStateChange('countdown', 3);
    audio.playCountdown(false);
  }

  setInput(input: Partial<InputState>) {
    // Edge trigger camera
    if (input.camera !== undefined && input.camera && !this.input.camera) {
      this.toggleCamera();
    }
    Object.assign(this.input, input);
    if ('camera' in input) this.input.camera = input.camera!;
  }

  toggleCamera() {
    this.cameraMode = this.cameraMode === 'chase' ? 'cockpit' : 'chase';
    // Show/hide dash
    if (this.player) {
      const dash = (this.player.mesh as any).dashboard as THREE.Mesh;
      const steering = (this.player.mesh as any).steering as THREE.Mesh;
      if (dash) dash.visible = this.cameraMode === 'cockpit';
      if (steering) steering.visible = this.cameraMode === 'cockpit';
    }
  }

  pause() {
    if (this.state !== 'racing') return;
    this.state = 'paused';
    this.callbacks.onStateChange('paused');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'racing';
    this.lastT = performance.now();
    this.callbacks.onStateChange('racing');
  }

  cleanup() {
    this.running = false;
    cancelAnimationFrame(this.animationId);
    // Remove all non-camera objects
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }
    this.cars = [];
    this.player = null;
    this.trackData = null;
    this.trackSpec = null;
    this.skyMesh = null;
    this.smokeParticles = [];
    this.skidMarks = [];
    this.skidIdx = 0;
    this.sun = null;
    audio.stopEngine();
    audio.stopMusic();
    audio.setDrifting(false);
    audio.playNitro(false);
  }

  dispose() {
    this.cleanup();
    window.removeEventListener('resize', this.onResize);
    try { this.composer?.dispose(); } catch { /* noop */ }
    this.composer = null;
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }

  // ==============================
  // Main loop
  // ==============================
  private animate = () => {
    if (!this.running) return;
    this.animationId = requestAnimationFrame(this.animate);
    const now = performance.now();
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    dt = Math.min(dt, 0.05); // clamp

    if (this.state === 'countdown') {
      this.countdownTime -= dt;
      this.updateCamera(dt);
      if (this.countdownTime <= 0) {
        this.state = 'racing';
        this.raceTime = 0;
        this.cars.forEach(c => { c.lastLapStart = 0; });
        this.callbacks.onStateChange('racing');
        audio.playCountdown(true);
      } else {
        const sec = Math.ceil(this.countdownTime);
        const prevSec = Math.ceil(this.countdownTime + dt);
        if (sec !== prevSec && sec > 0) audio.playCountdown(false);
      }
    } else if (this.state === 'racing') {
      this.raceTime += dt;
      this.updatePhysics(dt);
      this.updateCamera(dt);
      this.updateEffects(dt);
    } else if (this.state === 'paused') {
      // nothing
    } else if (this.state === 'finished') {
      this.updateCamera(dt);
      // Coasting
      this.updatePhysics(dt, true);
    }

    // HUD
    this.emitHUD();

    // Shadow follow
    if (this.player && this.sun) {
      this.sun.target.position.copy(this.player.position);
      this.sun.position.copy(this.player.position).add(new THREE.Vector3(100, 200, 80));
    }

    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  };

  // ==============================
  // Physics
  // ==============================
  private updatePhysics(dt: number, coastOnly = false) {
    if (!this.trackData) return;

    for (const car of this.cars) {
      if (car.finished && !coastOnly) continue;

      let throttle = 0, brake = 0, steer = 0, drift = false, nitro = false;

      if (car.isPlayer && !coastOnly && this.state === 'racing') {
        throttle = this.input.throttle;
        brake = this.input.brake;
        steer = this.input.steer;
        drift = this.input.drift;
        nitro = this.input.nitro && car.nitro > 0.02;
      } else if (!car.isPlayer && !coastOnly && this.state === 'racing') {
        ({ throttle, brake, steer, drift, nitro } = this.computeAI(car, dt));
      }

      // Repair
      if (car.isPlayer && this.input.repair && car.damage > 0.05 && this.repairCooldown <= 0) {
        car.damage = 0;
        this.repairCooldown = 8;
        this.addRepairEffect(car);
      }
      if (this.repairCooldown > 0) this.repairCooldown -= dt;

      const spec = car.spec;
      // Convert km/h top speed to m/s (with gear/rpm model)
      const maxSpeedMs = spec.topSpeed / 3.6;
      const accelBase = 20 + spec.acceleration * 5.5; // m/s^2 — snappier launch
      const handlingBase = 2.2 + spec.handling * 0.22; // rad/s steering rate
      const brakePower = 30 + spec.braking * 5;
      // drift cap parameter influences lateral friction elsewhere
      const nitroCapacity = 0.6 + spec.nitroCapacity * 0.05;

      // Damage affects performance
      const dmgFactor = 1 - car.damage * 0.4;

      // Heading & direction vectors
      const forward = new THREE.Vector3(Math.sin(car.heading), 0, Math.cos(car.heading));
      const rightVec = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading));

      // Current forward speed (signed)
      const forwardSpeed = car.velocity.dot(forward);
      const lateralSpeed = car.velocity.dot(rightVec);
      car.speed = forwardSpeed;
      car.lateralSpeed = lateralSpeed;

      // Steering — quick at low speed, calm and stable at high speed
      const speedFactor = Math.min(1, Math.abs(forwardSpeed) / 14);
      const stability = 1 / (1 + Math.abs(forwardSpeed) * 0.004);
      const steerRate = handlingBase * steer * speedFactor * stability * (drift ? 1.35 : 1);
      const steerSign = forwardSpeed >= 0 ? 1 : -1;
      car.angularVel += (steerRate * steerSign - car.angularVel) * Math.min(1, dt * 11);
      car.heading += car.angularVel * dt;

      // Recompute forward after heading change
      forward.set(Math.sin(car.heading), 0, Math.cos(car.heading));
      rightVec.set(Math.cos(car.heading), 0, -Math.sin(car.heading));

      // Throttle
      let accelForce = 0;
      if (throttle > 0 && forwardSpeed < maxSpeedMs * dmgFactor) {
        accelForce = throttle * accelBase * dmgFactor;
        // Reduce accel near top speed (cubic keeps the pull strong until ~90%)
        const speedRatio = Math.abs(forwardSpeed) / (maxSpeedMs * dmgFactor);
        accelForce *= Math.max(0, 1 - speedRatio * speedRatio * speedRatio);
      }
      // Brake / reverse
      if (brake > 0) {
        if (forwardSpeed > 0.5) {
          accelForce = -brake * brakePower;
        } else {
          accelForce = -brake * accelBase * 0.4; // reverse
        }
      }
      // Nitro boost
      if (nitro && forwardSpeed > 2) {
        accelForce += 24 * dmgFactor;
        car.nitro -= dt * 0.15 / nitroCapacity;
        if (car.nitro < 0) car.nitro = 0;
        car.nitroActive = true;
        car.nitroUsedTotal += dt;
        this.nitroUsedTotal += dt * (car.isPlayer ? 1 : 0);
      } else {
        car.nitroActive = false;
        // Passive nitro regen (slow)
        car.nitro = Math.min(1, car.nitro + dt * 0.01);
      }

      // Drag / rolling resistance
      // Drag / rolling resistance (very light — car truly reaches its spec top speed)
      const drag = forwardSpeed * Math.abs(forwardSpeed) * 0.0008;
      const rolling = forwardSpeed * 0.06;
      const net = accelForce - drag - rolling;
      car.velocity.add(forward.clone().multiplyScalar(net * dt));

      // Drift: strong grip normally, slides on demand
      let lateralFriction = 11;
      if (drift && Math.abs(forwardSpeed) > 8 && Math.abs(steer) > 0.2) {
        lateralFriction = Math.max(0.9, 3.4 - spec.driftRating * 0.16);
        car.driftFactor = Math.min(1, car.driftFactor + dt * 2);
        car.isDrifting = true;
        // Regenerate nitro during drift
        car.nitro = Math.min(1, car.nitro + dt * 0.12);
        // Drift score
        const driftScore = Math.abs(lateralSpeed) * dt * 20;
        car.driftScoreAccum += driftScore;
        if (car.isPlayer) this.totalDriftScore += driftScore;
      } else {
        car.driftFactor = Math.max(0, car.driftFactor - dt * 3);
        if (car.driftFactor < 0.1) {
          if (car.isPlayer && car.isDrifting && car.driftScoreAccum > 50) {
            // Drift finished — keep score
          }
          car.isDrifting = false;
        }
      }
      // Apply lateral friction
      const latDamp = car.velocity.clone().add(rightVec.clone().multiplyScalar(-lateralSpeed));
      car.velocity.lerp(latDamp, Math.min(1, lateralFriction * dt));

      // Clamp max speed (nitro pushes beyond spec top speed)
      const clampMax = maxSpeedMs * (nitro ? 1.32 : 1.18) * dmgFactor;
      if (car.velocity.length() > clampMax) {
        car.velocity.setLength(clampMax);
      }

      // Move
      car.position.add(car.velocity.clone().multiplyScalar(dt));

      // Apply terrain height from track curve
      const trackY = this.sampleTrackY(car.position);
      car.position.y += (trackY - car.position.y) * Math.min(1, dt * 6);

      // Off-track slowdown
      const distFromTrack = this.distFromTrack(car.position);
      car.onTrack = distFromTrack < this.trackSpec!.width / 2;
      if (!car.onTrack) {
        car.velocity.multiplyScalar(Math.max(0.8, 1 - dt * 4.5));
      }

      // Barrier collision
      this.handleBarriers(car, dt);

      // Car-to-car collision — both cars take real damage + sparks
      for (const other of this.cars) {
        if (other === car) continue;
        const d = car.position.distanceTo(other.position);
        if (d < 3) {
          const push = car.position.clone().sub(other.position).normalize().multiplyScalar((3 - d) * 0.5);
          car.position.add(push);
          const relSpeed = Math.abs(car.speed - other.speed);
          if (relSpeed > 3) {
            car.damage = Math.min(1, car.damage + relSpeed * 0.015 + 0.02);
            other.damage = Math.min(1, other.damage + relSpeed * 0.01);
            // Slow both down on impact
            car.velocity.multiplyScalar(0.85);
            if (car.isPlayer || other.isPlayer) {
              this.shakeIntensity = Math.min(1.4, this.shakeIntensity + relSpeed * 0.03 + 0.15);
              audio.playCrash(Math.min(1, relSpeed / 25));
              const mid = car.position.clone().add(other.position).multiplyScalar(0.5);
              this.addSparks(mid, push.normalize());
            }
          }
        }
      }

      // RPM and gear
      const speedAbs = Math.abs(forwardSpeed);
      const speedRatio = speedAbs / maxSpeedMs;
      const gear = Math.max(1, Math.min(6, Math.floor(speedRatio * 6) + 1));
      if (gear !== car.gear) {
        car.gear = gear;
        if (car.isPlayer) audio.playShift();
      }
      const gearRange = 1 / 6;
      const gearRatio = (speedRatio - (gear - 1) * gearRange) / gearRange;
      car.rpm = Math.max(0.15, Math.min(1, 0.2 + gearRatio * 0.8 + throttle * 0.15));

      // Top speed record
      const kmh = speedAbs * 3.6;
      if (kmh > car.topSpeed) car.topSpeed = kmh;
      if (car.isPlayer && kmh > this.topSpeed) this.topSpeed = kmh;

      // Checkpoints / laps
      this.updateProgress(car, dt);

      // Apply to mesh
      car.mesh.position.copy(car.position);
      car.mesh.rotation.y = car.heading;
      // Lean in turns
      const targetRoll = -car.angularVel * 0.15;
      car.mesh.rotation.z += (targetRoll - car.mesh.rotation.z) * Math.min(1, dt * 5);
      // Pitch from accel/brake
      const pitch = (accelForce > 0 ? -0.03 : accelForce < -10 ? 0.04 : 0);
      car.mesh.rotation.x += (pitch - car.mesh.rotation.x) * Math.min(1, dt * 5);

      // Wheel spin
      const wheels = (car.mesh as any).wheels as THREE.Mesh[];
      if (wheels) {
        const rotSpeed = forwardSpeed * dt * 3;
        wheels.forEach((w, i) => {
          // Roll about the axle (Z axis across the car)
          w.rotation.z -= rotSpeed;
          // Front wheels steer
          if (i < 2) w.rotation.y = steer * 0.4;
        });
      }

      // Steering wheel in cockpit
      if (car.isPlayer) {
        const steering = (car.mesh as any).steering as THREE.Mesh;
        if (steering) steering.rotation.z = -steer * 0.8;
      }

      // Brake lights flare under braking; damaged lights die out
      const tls = (car.mesh as any).tailLights as THREE.Mesh[] | undefined;
      if (tls) {
        tls.forEach((t, i) => {
          const m = t.material as THREE.MeshStandardMaterial;
          const dead = car.damage > 0.8 || (car.damage > 0.55 && i === 1);
          m.emissiveIntensity = dead ? 0.03 : brake > 0.05 ? 3.2 : 0.9;
        });
      }

      // Visible body damage: sagging panels, cracked glass, dulled paint
      const dmgApplied = (car as any).dmgApplied ?? 0;
      if (Math.abs(car.damage - dmgApplied) > 0.01) {
        (car as any).dmgApplied = car.damage;
        const dp = (car.mesh as any).damageParts;
        if (dp) {
          const d = car.damage;
          // DRAMATIC wreck: heavy panel sag, body crumple, shattered dark glass
          dp.hood.rotation.z = -d * 0.22;
          dp.hood.position.y = 0.72 - d * 0.08;
          dp.trunk.rotation.z = d * 0.16;
          dp.cabin.rotation.z = d * 0.07;
          dp.body.scale.z = 1 - d * 0.07;
          dp.body.scale.y = 1 - d * 0.05;
          for (const g of dp.glass as THREE.Mesh[]) {
            const gm = g.material as THREE.MeshStandardMaterial;
            gm.color.setHex(d > 0.25 ? 0x11151b : 0x35506a);
            gm.opacity = Math.min(0.97, 0.6 + d * 0.37);
            gm.roughness = Math.min(0.8, 0.12 + d * 0.6);
          }
          dp.paint.color.copy(dp.baseColor).multiplyScalar(1 - d * 0.45);
        }
      }

      // Audio for player
      if (car.isPlayer) {
        audio.updateEngine(car.rpm, throttle, kmh);
        audio.setDrifting(car.isDrifting && Math.abs(forwardSpeed) > 8);
        audio.playNitro(car.nitroActive);
      }

      // Finish detection (disabled in Free Drive)
      if (!car.finished && !this.freeDrive && car.lap >= (this.trackSpec?.laps || 3)) {
        car.finished = true;
        car.finishTime = this.raceTime;
        this.finishedPosition++;
        if (car.isPlayer) {
          this.onPlayerFinish();
        }
      }
    }
  }

  private sampleTrackY(pos: THREE.Vector3): number {
    if (!this.trackData) return 0;
    // Sample N points and find closest
    let bestT = 0, bestD = Infinity;
    const samples = 100;
    for (let i = 0; i < samples; i++) {
      const t = i / samples;
      const p = this.trackData.curve.getPointAt(t);
      const d = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2;
      if (d < bestD) { bestD = d; bestT = t; }
    }
    // Refine
    for (let j = 0; j < 6; j++) {
      const step = 1 / (samples * 2 ** (j + 1));
      const candidates = [bestT - step, bestT, bestT + step];
      let nb = bestT, nbd = bestD;
      for (const t of candidates) {
        const tt = ((t % 1) + 1) % 1;
        const p = this.trackData.curve.getPointAt(tt);
        const d = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2;
        if (d < nbd) { nbd = d; nb = tt; }
      }
      bestT = nb; bestD = nbd;
    }
    return this.trackData.curve.getPointAt(bestT).y;
  }

  private distFromTrack(pos: THREE.Vector3): number {
    if (!this.trackData || !this.trackSpec) return 0;
    let bestD = Infinity;
    const samples = 80;
    for (let i = 0; i < samples; i++) {
      const t = i / samples;
      const p = this.trackData.curve.getPointAt(t);
      const d = Math.hypot(p.x - pos.x, p.z - pos.z);
      if (d < bestD) bestD = d;
    }
    return bestD;
  }

  private handleBarriers(car: CarState, _dt: number) {
    if (!this.trackData || !this.trackSpec) return;
    const halfW = this.trackSpec.width / 2 + 1;
    // Find nearest curve point
    let bestT = 0, bestD = Infinity;
    const samples = 60;
    for (let i = 0; i < samples; i++) {
      const t = i / samples;
      const p = this.trackData.curve.getPointAt(t);
      const d = (p.x - car.position.x) ** 2 + (p.z - car.position.z) ** 2;
      if (d < bestD) { bestD = d; bestT = t; }
    }
    const curvePt = this.trackData.curve.getPointAt(bestT);
    const tan = this.trackData.curve.getTangentAt(bestT).normalize();
    const right = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();
    if (right.lengthSq() < 0.01) right.set(1, 0, 0);
    const offset = car.position.clone().sub(curvePt);
    const latOffset = offset.dot(right);
    if (Math.abs(latOffset) > halfW) {
      const over = Math.abs(latOffset) - halfW;
      const sign = latOffset > 0 ? 1 : -1;
      car.position.add(right.clone().multiplyScalar(-sign * over));
      // Reflect velocity
      const normal = right.clone().multiplyScalar(-sign);
      const velDot = car.velocity.dot(normal);
      if (velDot > 0) {
        car.velocity.add(normal.clone().multiplyScalar(-velDot * 1.5));
        car.velocity.multiplyScalar(0.55);
        const impactSpeed = Math.abs(velDot);
        // Real damage: every wall hit hurts, hard hits hurt a lot
        car.damage = Math.min(1, car.damage + impactSpeed * 0.02 + 0.05);
        // Sparks fly for any car that slams the wall
        this.addSparks(car.position.clone(), normal);
        if (car.isPlayer) {
          this.shakeIntensity = Math.min(1.4, this.shakeIntensity + impactSpeed * 0.05 + 0.25);
          audio.playCrash(Math.min(1, impactSpeed / 15));
        }
      }
    }
  }

  private updateProgress(car: CarState, _dt: number) {
    if (!this.trackData) return;
    // Find closest t on curve
    let bestT = 0, bestD = Infinity;
    const samples = 60;
    for (let i = 0; i < samples; i++) {
      const t = i / samples;
      const p = this.trackData.curve.getPointAt(t);
      const d = (p.x - car.position.x) ** 2 + (p.z - car.position.z) ** 2;
      if (d < bestD) { bestD = d; bestT = t; }
    }
    const prev = car.checkpointProgress;
    car.checkpointProgress = bestT;
    // Detect lap completion (crossing from >0.9 to <0.1)
    if (prev > 0.8 && bestT < 0.2 && this.state === 'racing') {
      car.lap++;
      const lapTime = this.raceTime - car.lastLapStart;
      car.lapTimes.push(lapTime);
      car.lastLapStart = this.raceTime;
    }
    // Total progress for ranking
    car.progressDistance = car.lap + bestT;
  }

  // ==============================
  // AI
  // ==============================
  private computeAI(car: CarState, dt: number) {
    if (!this.trackData) return { throttle: 0, brake: 0, steer: 0, drift: false, nitro: false };
    const skill = car.aiSkill;

    // Look ahead on curve
    const targetT = ((car.checkpointProgress + 0.03 + skill * 0.02) % 1 + 1) % 1;
    const target = this.trackData.curve.getPointAt(targetT);
    const rightVec = new THREE.Vector3(Math.cos(car.heading), 0, -Math.sin(car.heading));
    // Apply lateral offset
    target.add(rightVec.clone().multiplyScalar(car.aiOffset));

    const toTarget = target.clone().sub(car.position);
    toTarget.y = 0;
    const desiredHeading = Math.atan2(toTarget.x, toTarget.z);
    let headingDiff = desiredHeading - car.heading;
    while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
    while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;

    let steer = Math.max(-1, Math.min(1, headingDiff * 2));

    // Throttle/brake based on upcoming curvature
    const lookAhead = 0.08;
    const aheadT = ((car.checkpointProgress + lookAhead) % 1 + 1) % 1;
    const ahead = this.trackData.curve.getPointAt(aheadT);
    const ahead2T = ((car.checkpointProgress + lookAhead * 2) % 1 + 1) % 1;
    const ahead2 = this.trackData.curve.getPointAt(ahead2T);
    const v1 = ahead.clone().sub(this.trackData.curve.getPointAt(car.checkpointProgress));
    const v2 = ahead2.clone().sub(ahead);
    v1.y = 0; v2.y = 0;
    const curvature = v1.angleTo(v2);

    const speed = car.velocity.length();
    const cornerMaxSpeed = Math.max(15, 70 - curvature * 200);
    let throttle = 1;
    let brake = 0;
    if (speed > cornerMaxSpeed) {
      throttle = 0;
      brake = Math.min(1, (speed - cornerMaxSpeed) / 30);
    }

    // Overtaking: spot slower cars ahead and pick the freer side
    {
      const fwdX = Math.sin(car.heading), fwdZ = Math.cos(car.heading);
      for (const other of this.cars) {
        if (other === car) continue;
        const dx = other.position.x - car.position.x;
        const dz = other.position.z - car.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 16) continue;
        const aheadDot = dx * fwdX + dz * fwdZ;
        if (aheadDot < 2 || aheadDot > 16) continue; // must be ahead
        const latRight = dx * fwdZ - dz * fwdX; // lateral offset (right +)
        if (Math.abs(latRight) > 3.5) continue; // not in my corridor
        const closing = car.speed - other.speed;
        if (closing > 2) {
          // Swerve to whichever side the other car is NOT blocking
          steer = Math.max(-1, Math.min(1, steer + (latRight > 0 ? -0.85 : 0.85)));
          if (closing > 10) throttle = Math.min(throttle, 0.6);
        }
      }
    }

    // Skill errors
    car.aiMistakeTimer -= dt;
    if (car.aiMistakeTimer <= 0) {
      car.aiMistakeTimer = 3 + Math.random() * 8;
      if (Math.random() > skill) {
        // Make a mistake: lift throttle briefly
        throttle *= 0.5;
      }
      car.aiOffset = (Math.random() - 0.5) * 4;
    }

    // Nitro on straights
    car.aiNitroCooldown -= dt;
    let nitro = false;
    if (car.aiNitroCooldown <= 0 && curvature < 0.1 && speed > 30 && car.nitro > 0.3 && Math.random() < skill) {
      nitro = true;
      if (car.nitro < 0.1) car.aiNitroCooldown = 8 + Math.random() * 5;
    }
    if (car.nitro < 0.1) car.aiNitroCooldown = 5;

    // Drift in sharp corners
    const drift = curvature > 0.25 && speed > 20 && Math.random() < skill * 0.4;

    // AI gets free nitro regen to keep things competitive
    car.nitro = Math.min(1, car.nitro + dt * 0.03);

    return { throttle, brake, steer, drift, nitro };
  }

  // ==============================
  // Effects
  // ==============================
  private updateEffects(dt: number) {
    // Smoke particles
    for (const car of this.cars) {
      if (car.isDrifting && Math.abs(car.speed) > 8) {
        const wheels = (car.mesh as any).wheels as THREE.Mesh[];
        if (wheels) {
          for (const w of wheels.slice(2)) {
            this.addSmoke(w.getWorldPosition(new THREE.Vector3()));
          }
        }
        // Skid marks
        const wheels2 = (car.mesh as any).wheels as THREE.Mesh[];
        if (wheels2) {
          for (const w of wheels2.slice(2)) {
            this.addSkidMark(w.getWorldPosition(new THREE.Vector3()));
          }
        }
      }
      // Nitro exhaust flames — twin pipes at the rear bumper
      if (car.nitroActive) {
        const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
        const rx = Math.cos(car.heading), rz = -Math.sin(car.heading);
        for (const s of [-0.4, 0.4]) {
          this.addFlame(car.position.clone().add(new THREE.Vector3(-fx * 2.28 + rx * s, 0.3, -fz * 2.28 + rz * s)));
        }
      }
    }

    // Exhaust smoke puffs while accelerating (player + AI cars)
    this.exhaustTimer -= dt;
    if (this.exhaustTimer <= 0) {
      this.exhaustTimer = 0.09 + Math.random() * 0.07;
      for (const car of this.cars) {
        if (car.nitroActive) continue;
        const pushing = car.isPlayer
          ? this.input.throttle > 0.05 && this.state === 'racing'
          : this.state === 'racing' && car.speed > 8;
        if (!pushing) continue;
        const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
        const rx = Math.cos(car.heading), rz = -Math.sin(car.heading);
        const side = Math.random() < 0.5 ? -0.4 : 0.4;
        const pos = car.position.clone().add(new THREE.Vector3(-fx * 2.28 + rx * side, 0.3, -fz * 2.28 + rz * side));
        const vel = new THREE.Vector3(-fx * 2.2 + (Math.random() - 0.5) * 0.5, 0.7 + Math.random() * 0.4, -fz * 2.2 + (Math.random() - 0.5) * 0.5);
        this.addExhaustPuff(pos, vel, 0xa8adb3, 0.55);
      }
    }

    // Dark smoke from the hood when the car is damaged
    this.damageSmokeTimer -= dt;
    if (this.damageSmokeTimer <= 0) {
      this.damageSmokeTimer = 0.13;
      for (const car of this.cars) {
        if (car.damage < 0.4) continue;
        const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
        const pos = car.position.clone().add(new THREE.Vector3(fx * 1.6, 0.75, fz * 1.6));
        const vel = new THREE.Vector3(fx * 1.5 + (Math.random() - 0.5) * 0.6, 1.0 + Math.random() * 0.5, fz * 1.5 + (Math.random() - 0.5) * 0.6);
        this.addExhaustPuff(pos, vel, car.damage > 0.7 ? 0x141414 : 0x3a3d42, 0.85);
      }
    }

    // Update particles
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const p = this.smokeParticles[i];
      p.life -= dt;
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
      p.vel.y += 0.5 * dt;
      p.mesh.scale.multiplyScalar(1 + dt * 1.5);
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, p.life * 0.7);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.smokeParticles.splice(i, 1);
      }
    }

    // Shake decay
    this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 2);
    if (this.shakeIntensity > 0) {
      this.callbacks.onShake(this.shakeIntensity);
    }
  }

  private addSmoke(pos: THREE.Vector3) {
    if (this.smokeParticles.length > 60) return;
    const size = 0.5 + Math.random() * 0.5;
    const geo = new THREE.SphereGeometry(size, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.5, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    this.scene.add(m);
    this.smokeParticles.push({ mesh: m, life: 0.8, vel: new THREE.Vector3((Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 2) });
  }

  private addExhaustPuff(pos: THREE.Vector3, vel: THREE.Vector3, color = 0xa8adb3, life = 0.55) {
    if (this.smokeParticles.length > 60) return;
    const size = 0.2 + Math.random() * 0.25;
    const geo = new THREE.SphereGeometry(size, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    this.scene.add(m);
    this.smokeParticles.push({ mesh: m, life, vel });
  }

  private addFlame(pos: THREE.Vector3) {
    if (this.smokeParticles.length > 60) return;
    const size = 0.4 + Math.random() * 0.45;
    const geo = new THREE.SphereGeometry(size, 5, 5);
    const mat = new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0x00aaff : 0xffaa00, transparent: true, opacity: 0.95, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    this.scene.add(m);
    this.smokeParticles.push({ mesh: m, life: 0.28, vel: new THREE.Vector3((Math.random() - 0.5), 0, (Math.random() - 0.5)) });
  }

  private addSparks(pos: THREE.Vector3, _normal: THREE.Vector3) {
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.SphereGeometry(0.08, 4, 4);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(pos);
      this.scene.add(m);
      this.smokeParticles.push({
        mesh: m, life: 0.5,
        vel: new THREE.Vector3((Math.random() - 0.5) * 10, Math.random() * 5, (Math.random() - 0.5) * 10),
      });
    }
  }

  private addSkidMark(pos: THREE.Vector3) {
    if (this.skidIdx >= this.skidMax) return;
    const size = 0.25;
    const i = this.skidIdx * 6;
    this.skidPositions[i] = pos.x - size; this.skidPositions[i + 1] = pos.y + 0.02; this.skidPositions[i + 2] = pos.z - size;
    this.skidPositions[i + 3] = pos.x + size; this.skidPositions[i + 4] = pos.y + 0.02; this.skidPositions[i + 5] = pos.z + size;
    this.skidIdx++;
    (this.skidGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.skidGeo.setDrawRange(0, this.skidIdx * 2);
  }

  private addRepairEffect(car: CarState) {
    for (let i = 0; i < 20; i++) {
      const geo = new THREE.SphereGeometry(0.15, 5, 5);
      const mat = new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 1 });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(car.position).add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 2));
      this.scene.add(m);
      this.smokeParticles.push({ mesh: m, life: 1.0, vel: new THREE.Vector3(0, 3, 0) });
    }
  }

  // ==============================
  // Camera
  // ==============================
  private updateCamera(dt: number, instant = false) {
    if (!this.player) return;
    const p = this.player;
    const forward = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));

    // Cinematic orbit around the car during the countdown
    if (this.state === 'countdown') {
      const total = Math.max(0, 3 - this.countdownTime);
      const ang = p.heading - 0.85 + total * 0.5;
      const radius = 10.5 - total * 1.3;
      const side = p.position.clone().add(new THREE.Vector3(Math.sin(ang) * radius, 2.6 + total * 0.25, Math.cos(ang) * radius));
      if (instant) this.camera.position.copy(side);
      else this.camera.position.lerp(side, Math.min(1, dt * 4));
      const lookAt = p.position.clone().add(forward.clone().multiplyScalar(3)).add(new THREE.Vector3(0, 0.9, 0));
      this.camera.lookAt(lookAt);
      this.camera.fov += (56 - this.camera.fov) * Math.min(1, dt * 3);
      this.camera.updateProjectionMatrix();
      return;
    }

    if (this.cameraMode === 'chase') {
      const speed = Math.abs(p.speed);
      const desiredDist = 9 + speed * 0.01;
      const desiredHeight = 3.8 + speed * 0.005;
      const target = p.position.clone().sub(forward.clone().multiplyScalar(desiredDist)).add(new THREE.Vector3(0, desiredHeight, 0));
      // Look-ahead
      const lookAt = p.position.clone().add(forward.clone().multiplyScalar(6 + speed * 0.02)).add(new THREE.Vector3(0, 1.2, 0));

      if (instant) {
        this.camera.position.copy(target);
      } else {
        const lerpFactor = Math.min(1, dt * 6);
        this.camera.position.lerp(target, lerpFactor);
      }
      // Camera shake
      if (this.shakeIntensity > 0) {
        this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity * 0.4;
        this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity * 0.3;
        this.camera.position.z += (Math.random() - 0.5) * this.shakeIntensity * 0.4;
      }
      this.camera.lookAt(lookAt);
      // FOV by speed
      const baseFov = 70;
      const speedFov = Math.min(25, speed * 0.08);
      const nitroFov = p.nitroActive ? 8 : 0;
      const targetFov = baseFov + speedFov + nitroFov;
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 3);
      this.camera.updateProjectionMatrix();
    } else {
      // Cockpit
      const eye = p.position.clone().add(forward.clone().multiplyScalar(0.3)).add(new THREE.Vector3(0, 1.35, 0));
      if (instant) this.camera.position.copy(eye);
      else this.camera.position.lerp(eye, Math.min(1, dt * 20));
      // Shake
      if (this.shakeIntensity > 0) {
        this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity * 0.15;
        this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity * 0.1;
      }
      const lookAt = p.position.clone().add(forward.clone().multiplyScalar(20)).add(new THREE.Vector3(0, 1.3, 0));
      this.camera.lookAt(lookAt);
      const baseFov = 78;
      const speedFov = Math.min(20, Math.abs(p.speed) * 0.06);
      const nitroFov = p.nitroActive ? 6 : 0;
      const targetFov = baseFov + speedFov + nitroFov;
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 3);
      this.camera.updateProjectionMatrix();
    }
  }

  // ==============================
  // HUD & finish
  // ==============================
  private emitHUD() {
    if (!this.player) return;
    const p = this.player;
    // Rank cars by progressDistance (desc), then by finishTime if finished
    const ranked = [...this.cars].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progressDistance - a.progressDistance;
    });
    const position = ranked.indexOf(p) + 1;
    const hud: HUDData = {
      speed: Math.abs(p.speed) * 3.6,
      gear: p.gear,
      rpm: p.rpm,
      position,
      totalRacers: this.cars.length,
      lap: Math.min((this.trackSpec?.laps || 3), p.lap + 1),
      totalLaps: this.freeDrive ? 0 : this.trackSpec?.laps || 3,
      nitro: p.nitro,
      damage: p.damage,
      driftScore: p.driftScoreAccum,
      totalDriftScore: this.totalDriftScore,
      raceTime: this.raceTime,
      countdown: this.state === 'countdown' ? Math.ceil(this.countdownTime) : 0,
      topSpeed: this.topSpeed,
      isDrifting: p.isDrifting,
      isNitro: p.nitroActive,
      positions: ranked.map((c, i) => ({
        name: c.isPlayer ? 'YOU' : `CPU ${i + 1}`,
        progress: c.progressDistance,
        isPlayer: c.isPlayer,
        color: c.spec.color,
      })),
    };
    this.callbacks.onHUD(hud);
  }

  private onPlayerFinish() {
    const p = this.player!;
    const ranked = [...this.cars].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progressDistance - a.progressDistance;
    });
    const position = ranked.indexOf(p) + 1;
    this.finishedPosition = position;
    const bestLap = p.lapTimes.length > 0 ? Math.min(...p.lapTimes) : this.raceTime;
    const result: RaceResult = {
      position,
      totalTime: p.finishTime,
      bestLap,
      driftScore: Math.floor(this.totalDriftScore),
      nitroUsed: Math.floor(this.nitroUsedTotal),
      money: 0,
      topSpeed: Math.floor(this.topSpeed),
    };
    this.state = 'finished';
    this.callbacks.onStateChange('finished');
    setTimeout(() => this.callbacks.onFinish(result), 1500);
  }

  // ==============================
  // Public getters for minimap
  getTrackCurve() { return this.trackData?.curve || null; }
  getCarPositions() { return this.cars.map(c => ({ pos: c.position.clone(), isPlayer: c.isPlayer, color: c.spec.color, heading: c.heading })); }
  getCameraMode() { return this.cameraMode; }
  getState() { return this.state; }
}

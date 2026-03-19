"use client";

import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { computeGeometry } from "@/lib/simulation/simple-outdoor/geometry";
import { DEFAULT_CONFIG } from "@/lib/simulation/simple-outdoor/types";

/* ═══════════════════════ PALETTE ═══════════════════════ */
const PAL = {
  waterBottom: new THREE.Color(0x5a9a4a),
  gold: 0xf9b501,
  goldPale: 0xf9d46b,
  pulse: 0xd49a00,
};

/* ═══════════════════════ GEOMETRY CONSTANTS ═══════════════════════ */
const POND_L = 3.2;
const POND_W = 1.3;
const WATER_H = 0.22; // total visual water height (divided among layers)
const GAP_H = 0.07; // visual gap between layers
const SPHERE_R = 0.15;

const R_A = POND_W / 2;
const HL = POND_L / 2 - R_A;
const SUN_X = -(HL + R_A + 0.7);

const ANCHOR_Y = WATER_H; // top of first water layer, always fixed
const VIS_MAX_LAYERS = 10;
const MAX_STACK = WATER_H + (VIS_MAX_LAYERS - 1) * GAP_H;
const SPHERE_Y = MAX_STACK + 0.35;

const NUM_WAVES = 5;
const CYCLE_PERIOD = 4.0;
const END_PAD = 0.3;

/* ═══════════════════════ STANDARD HELPERS ═══════════════════════ */

function stadiumShape(length: number, width: number) {
  const r = width / 2, hl = length / 2 - r, n = 48;
  const s = new THREE.Shape();
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / n;
    i === 0 ? s.moveTo(hl + r * Math.cos(a), r * Math.sin(a)) : s.lineTo(hl + r * Math.cos(a), r * Math.sin(a));
  }
  for (let i = 0; i <= n; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / n;
    s.lineTo(-hl + r * Math.cos(a), r * Math.sin(a));
  }
  s.closePath();
  return s;
}

function stadiumOutlinePts(length: number, width: number, n: number) {
  const r = width / 2, hl = length / 2 - r, pts: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / n;
    pts.push(new THREE.Vector3(hl + r * Math.cos(a), 0, r * Math.sin(a)));
  }
  for (let i = 0; i <= n; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / n;
    pts.push(new THREE.Vector3(-hl + r * Math.cos(a), 0, r * Math.sin(a)));
  }
  pts.push(pts[0].clone());
  return pts;
}

function isInsideStadium(x: number, z: number) {
  if (Math.abs(x) <= HL) return Math.abs(z) <= R_A;
  if (x > HL) {
    const dx = x - HL;
    return dx * dx + z * z <= R_A * R_A;
  }
  const dx = x + HL;
  return dx * dx + z * z <= R_A * R_A;
}

function extrudeY(shape: THREE.Shape, height: number, yOff: number) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 48 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, yOff, 0);
  return g;
}

function extrudeYWithGradient(shape: THREE.Shape, height: number, yOff: number, colorTop: THREE.Color, colorBottom: THREE.Color) {
  const g = extrudeY(shape, height, yOff);
  g.computeVertexNormals();
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const count = pos.count;
  const colors = new Float32Array(count * 3);
  const yMin = yOff, yMax = yOff + height, range = yMax - yMin;

  for (let i = 0; i < count; i++) {
    let c: THREE.Color;
    const ny = nor.getY(i);
    if (ny > 0.5) {
      // Top face — dark algae green (close to bottom color)
      c = colorBottom.clone().lerp(colorTop, 0.15);
    } else if (ny < -0.5) {
      // Bottom face — solid dark green
      c = colorBottom.clone();
    } else {
      // Side wall — gold-to-green gradient by Y
      const y = pos.getY(i);
      const t = range > 0.001 ? Math.max(0, Math.min(1, (y - yMin) / range)) : 0.5;
      c = colorBottom.clone().lerp(colorTop, t);
    }
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

function disposeGroup(g: THREE.Group) {
  while (g.children.length) {
    const c = g.children[0] as THREE.Mesh;
    if (c.children && c.children.length) disposeGroup(c as unknown as THREE.Group);
    if (c.geometry) c.geometry.dispose();
    if (c.material) {
      if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
      else c.material.dispose();
    }
    g.remove(c);
  }
}

function makeTextSprite(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "bold 36px 'JetBrains Mono', 'Fira Code', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#F9B501";
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.6, 0.15, 1);
  return sprite;
}

function pulseLineMat() {
  return new THREE.LineBasicMaterial({ color: PAL.pulse, transparent: true, opacity: 0.9, depthWrite: false });
}

function makeStadiumRing(l: number, w: number) {
  const pts = stadiumOutlinePts(l, w, 48);
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), pulseLineMat());
}

/* ═══════════════════════ BUILD POND ═══════════════════════ */

function buildPond(group: THREE.Group, layers: number) {
  disposeGroup(group);
  const waterPerLayer = WATER_H / layers;
  const baseOffset = ANCHOR_Y - waterPerLayer;

  const t = (layers - 1) / (VIS_MAX_LAYERS - 1);
  const slabColor = new THREE.Color(PAL.gold).lerp(new THREE.Color(PAL.goldPale), t);

  let cursor = baseOffset;
  for (let i = 0; i < layers; i++) {
    const waterGeo = extrudeYWithGradient(stadiumShape(POND_L, POND_W), waterPerLayer, cursor, slabColor.clone(), PAL.waterBottom);
    group.add(new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.05 })));
    cursor += waterPerLayer;
    if (i < layers - 1) cursor += GAP_H;
  }

  // Sun sphere — match DepthDiagram style
  const sphereMat = new THREE.MeshStandardMaterial({ color: 0xfcd34d, roughness: 0.85, metalness: 0.0, emissive: 0xf59e0b, emissiveIntensity: 0.4 });
  const sp = new THREE.Mesh(new THREE.SphereGeometry(SPHERE_R, 32, 32), sphereMat);
  sp.position.set(SUN_X, SPHERE_Y, 0);
  group.add(sp);
}

/* ═══════════════════════ BUILD RAYS ═══════════════════════ */

interface RayData {
  mesh: THREE.Line;
  startPt: THREE.Vector3;
  landPt: THREE.Vector3;
  pathLen: number;
  segLen: number;
  cycleDur: number;
  phase: number;
  peakOpacity: number;
}

function buildRays(rayGroup: THREE.Group, layers: number, rayState: React.MutableRefObject<RayData[]>) {
  disposeGroup(rayGroup);
  rayState.current = [];

  // Compute topmost water surface Y
  const waterPerLayer = WATER_H / layers;
  const baseOffset = ANCHOR_Y - waterPerLayer;
  const topSurfaceY = baseOffset + layers * waterPerLayer + (layers - 1) * GAP_H;

  const sunCenter = new THREE.Vector3(SUN_X, SPHERE_Y, 0);

  // Jittered grid of landing points across stadium
  const nx = 11, nz = 9;
  for (let ix = 0; ix < nx; ix++) {
    for (let iz = 0; iz < nz; iz++) {
      const bx = -POND_L / 2 + (ix + 0.2 + Math.random() * 0.6) * (POND_L / nx);
      const bz = -POND_W / 2 + (iz + 0.2 + Math.random() * 0.6) * (POND_W / nz);
      if (!isInsideStadium(bx, bz)) continue;

      const landPt = new THREE.Vector3(bx, topSurfaceY, bz);
      const dir = landPt.clone().sub(sunCenter).normalize();
      const startPt = sunCenter.clone().add(dir.clone().multiplyScalar(SPHERE_R));
      const pathLen = startPt.distanceTo(landPt);

      const positions = new Float32Array(6);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.LineBasicMaterial({
        color: 0xf9b501,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      rayGroup.add(line);

      rayState.current.push({
        mesh: line,
        startPt,
        landPt,
        pathLen,
        segLen: 0.15 + Math.random() * 0.25,
        cycleDur: 1.8 + Math.random() * 2.0,
        phase: Math.random(),
        peakOpacity: 0.2 + Math.random() * 0.25,
      });
    }
  }
}

/* ═══════════════════════ BUILD WATER PULSES ═══════════════════════ */

interface LayerPulseData {
  vMesh: THREE.Line;
  waterYTop: number;
  waterYBottom: number;
  startTime: number;
  duration: number;
}

interface WavePulseData {
  offset: number;
  layers: LayerPulseData[];
}

function buildPulses(pulseGroup: THREE.Group, layers: number, pulseState: React.MutableRefObject<WavePulseData[]>) {
  disposeGroup(pulseGroup);
  pulseState.current = [];

  const waterPerLayer = WATER_H / layers;
  const baseOffset = ANCHOR_Y - waterPerLayer;

  // Layer positions
  const layerInfo: { waterY: number; waterH: number }[] = [];
  let cursor = baseOffset;
  for (let i = 0; i < layers; i++) {
    const waterY = cursor;
    cursor += waterPerLayer;
    if (i < layers - 1) cursor += GAP_H;
    layerInfo.push({ waterY, waterH: waterPerLayer });
  }

  // Build NUM_WAVES staggered copies
  for (let w = 0; w < NUM_WAVES; w++) {
    const wave: WavePulseData = { offset: (w / NUM_WAVES) * CYCLE_PERIOD, layers: [] };

    for (let li = 0; li < layers; li++) {
      const vRing = makeStadiumRing(POND_L + 0.02, POND_W + 0.02);
      pulseGroup.add(vRing);

      // Each layer's pulse starts staggered within the cycle
      const layerDelay = (li / Math.max(1, layers)) * 0.6;

      wave.layers.push({
        vMesh: vRing,
        waterYTop: layerInfo[li].waterY + layerInfo[li].waterH,
        waterYBottom: layerInfo[li].waterY,
        startTime: layerDelay,
        duration: CYCLE_PERIOD - END_PAD - layerDelay,
      });
    }

    pulseState.current.push(wave);
  }
}

/* ═══════════════════════ UPDATE ANIMATIONS ═══════════════════════ */

function updateRays(rayState: React.MutableRefObject<RayData[]>, time: number) {
  for (const r of rayState.current) {
    const t = ((time / r.cycleDur + r.phase) % 1 + 1) % 1;
    const headT = -r.segLen + t * (1 + r.segLen * 2);
    const tailT = headT - r.segLen;
    const visHead = Math.max(0, Math.min(1, headT));
    const visTail = Math.max(0, Math.min(1, tailT));

    if (visHead <= visTail + 0.001) {
      r.mesh.visible = false;
      continue;
    }
    r.mesh.visible = true;

    const posArr = (r.mesh.geometry.attributes.position as THREE.Float32BufferAttribute).array as Float32Array;
    // Tail vertex
    posArr[0] = r.startPt.x + (r.landPt.x - r.startPt.x) * visTail;
    posArr[1] = r.startPt.y + (r.landPt.y - r.startPt.y) * visTail;
    posArr[2] = r.startPt.z + (r.landPt.z - r.startPt.z) * visTail;
    // Head vertex
    posArr[3] = r.startPt.x + (r.landPt.x - r.startPt.x) * visHead;
    posArr[4] = r.startPt.y + (r.landPt.y - r.startPt.y) * visHead;
    posArr[5] = r.startPt.z + (r.landPt.z - r.startPt.z) * visHead;
    r.mesh.geometry.attributes.position.needsUpdate = true;

    // Fade: full brightness mid-path, fade in/out at ends
    const midT = (visHead + visTail) / 2;
    let op = r.peakOpacity;
    if (midT < 0.15) op *= midT / 0.15;
    else if (midT > 0.85) op *= (1 - midT) / 0.15;
    (r.mesh.material as THREE.LineBasicMaterial).opacity = op;
  }
}

function updatePulses(pulseState: React.MutableRefObject<WavePulseData[]>, time: number) {
  for (const wave of pulseState.current) {
    const cycleTime = ((time + wave.offset) % CYCLE_PERIOD + CYCLE_PERIOD) % CYCLE_PERIOD;

    for (const L of wave.layers) {
      if (cycleTime >= L.startTime && cycleTime <= L.startTime + L.duration && L.duration > 0) {
        const vFrac = (cycleTime - L.startTime) / L.duration;
        const y = L.waterYTop + (L.waterYBottom - L.waterYTop) * vFrac;
        L.vMesh.position.set(0, y, 0);
        let op = Math.max(0.1, 1 - vFrac * 0.85);
        if (vFrac < 0.08) op *= vFrac / 0.08;
        if (vFrac > 0.92) op *= (1 - vFrac) / 0.08;
        (L.vMesh.material as THREE.LineBasicMaterial).opacity = op;
        L.vMesh.visible = true;
      } else {
        L.vMesh.visible = false;
      }
    }
  }
}

/* ═══════════════════════ COMPONENT ═══════════════════════ */

export default function LayeredDiagram({ layers }: { layers: number }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const frameId = useRef<number>(0);
  const pondGroup = useRef<THREE.Group | null>(null);
  const rayGroup = useRef<THREE.Group | null>(null);
  const rayState = useRef<RayData[]>([]);
  const pulseGroup = useRef<THREE.Group | null>(null);
  const pulseState = useRef<WavePulseData[]>([]);
  const rendRef = useRef<THREE.WebGLRenderer | null>(null);
  const clockRef = useRef(new THREE.Clock());

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const scene = new THREE.Scene();
    scene.background = null;

    const cam = new THREE.PerspectiveCamera(34, el.clientWidth / el.clientHeight, 0.1, 100);

    const rend = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    rend.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rend.setSize(el.clientWidth, el.clientHeight);
    rend.toneMapping = THREE.ACESFilmicToneMapping;
    rend.toneMappingExposure = 1.1;
    el.appendChild(rend.domElement);
    rendRef.current = rend;

    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    scene.add(new THREE.HemisphereLight(0xfff8ee, 0x334455, 0.35));
    const key = new THREE.DirectionalLight(0xfff6e8, 0.95);
    key.position.set(5, 7, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xe8eeff, 0.4);
    fill.position.set(-4, 4, -2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.3);
    rim.position.set(-2, 3, -6);
    scene.add(rim);
    const bottom = new THREE.DirectionalLight(0xddeeff, 0.15);
    bottom.position.set(0, -2, 3);
    scene.add(bottom);

    const pg = new THREE.Group();
    scene.add(pg);
    pondGroup.current = pg;

    const rg = new THREE.Group();
    scene.add(rg);
    rayGroup.current = rg;

    const plg = new THREE.Group();
    scene.add(plg);
    pulseGroup.current = plg;

    buildPond(pg, layers);
    buildRays(rg, layers, rayState);
    buildPulses(plg, layers, pulseState);
    clockRef.current.start();

    const target = new THREE.Vector3(-0.2, 0.55, 0);
    const sp = new THREE.Spherical(5.5, 1.0, 0.65);
    cam.position.setFromSpherical(sp).add(target);
    cam.lookAt(target);

    function onResize() {
      cam.aspect = el!.clientWidth / el!.clientHeight;
      cam.updateProjectionMatrix();
      rend.setSize(el!.clientWidth, el!.clientHeight);
    }
    window.addEventListener("resize", onResize);

    function tick() {
      const elapsed = clockRef.current.getElapsedTime();
      updateRays(rayState, elapsed);
      updatePulses(pulseState, elapsed);
      rend.render(scene, cam);
      frameId.current = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      cancelAnimationFrame(frameId.current);
      window.removeEventListener("resize", onResize);
      rend.dispose();
      if (el.contains(rend.domElement)) el.removeChild(rend.domElement);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pondGroup.current && pulseGroup.current && rayGroup.current) {
      buildPond(pondGroup.current, layers);
      buildPulses(pulseGroup.current, layers, pulseState);
      buildRays(rayGroup.current, layers, rayState);
    }
  }, [layers]);

  const LAYERED_DEPTH_MM = 300;
  const geo = useMemo(
    () => computeGeometry(DEFAULT_CONFIG.area_ha, DEFAULT_CONFIG.aspect_ratio, LAYERED_DEPTH_MM / 1000, DEFAULT_CONFIG.berm_width),
    [],
  );

  const volumeKL = Math.round(geo.V_liters / 1000);
  const perLayerMm = Math.round(LAYERED_DEPTH_MM / layers);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        userSelect: "none",
        overflow: "hidden",
        borderRadius: 8,
      }}
    >
      <div
        ref={mountRef}
        style={{ width: "100%", height: "100%" }}
      />

      {/* Bottom-left: pond dimensions */}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          left: 8,
          zIndex: 10,
        }}
      >
        <svg
          viewBox="0 0 206 76"
          className="w-[200px]"
          aria-label={`Pond: ${Math.round(geo.W)}m × ${Math.round(geo.Ltotal)}m, ${layers} layers × ${perLayerMm}mm`}
        >
          <text x="4" y="10" fill="#555" fontSize="10" fontFamily="monospace" fontWeight="600">
            1 acre | {layers} × {perLayerMm}mm layers
          </text>
          <rect x="4" y="29" width="168" height="22" rx="11" fill="none" stroke="#888" strokeWidth="1.2" />
          <text x="88" y="44" textAnchor="middle" fill="#666" fontSize="8.5" fontFamily="monospace">
            {LAYERED_DEPTH_MM}mm total depth
          </text>
          <line x1="180" y1="29" x2="180" y2="51" stroke="#888" strokeWidth="0.7" />
          <line x1="177" y1="29" x2="183" y2="29" stroke="#888" strokeWidth="0.7" />
          <line x1="177" y1="51" x2="183" y2="51" stroke="#888" strokeWidth="0.7" />
          <text x="196" y="44" textAnchor="middle" fill="#666" fontSize="8" fontFamily="monospace">
            {Math.round(geo.W)}m
          </text>
          <line x1="4" y1="62" x2="172" y2="62" stroke="#888" strokeWidth="0.7" />
          <line x1="4" y1="59" x2="4" y2="65" stroke="#888" strokeWidth="0.7" />
          <line x1="172" y1="59" x2="172" y2="65" stroke="#888" strokeWidth="0.7" />
          <text x="88" y="74" textAnchor="middle" fill="#666" fontSize="9" fontFamily="monospace">
            {Math.round(geo.Ltotal)}m
          </text>
        </svg>
      </div>

      {/* Top-right: dynamic volume */}
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 10,
        }}
      >
        <span style={{ color: "#555", fontSize: 11, fontFamily: "monospace", fontWeight: 600 }}>
          Volume: {volumeKL.toLocaleString()} kL
        </span>
      </div>
    </div>
  );
}

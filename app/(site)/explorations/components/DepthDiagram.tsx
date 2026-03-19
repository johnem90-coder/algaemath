"use client";

import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { computeGeometry } from "@/lib/simulation/simple-outdoor/geometry";
import { DEFAULT_CONFIG } from "@/lib/simulation/simple-outdoor/types";

/* ═══════════════════════ PALETTE ═══════════════════════ */
const PAL = {
  waterTop: new THREE.Color(0xae7f01),
  waterBottom: new THREE.Color(0x5a9a4a),
  gold: 0xf9b501,
  pulse: 0xd49a00,
  bg: 0x070710,
};

/* ═══════════════════════ GEOMETRY CONSTANTS ═══════════════════════ */
const POND_L = 3.2;
const POND_W = 1.3;
const SPHERE_R = 0.15;

const R_A = POND_W / 2;
const HL = POND_L / 2 - R_A;

const SUN_X = -(HL + R_A + 0.9);
const SURFACE_Y = 0.28;
const SPHERE_Y = 1.35;

const DEPTH_SCALE = 0.0008;
const depthToU = (mm: number) => mm * DEPTH_SCALE;

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
      c = colorBottom.clone().lerp(colorTop, 0.15);
    } else if (ny < -0.5) {
      c = colorBottom.clone();
    } else {
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

/* ═══════════════════════ INSIDE STADIUM CHECK ═══════════════════════ */

function isInsideStadium(x: number, z: number) {
  if (Math.abs(x) <= HL) return Math.abs(z) <= R_A;
  if (x > HL) {
    const dx = x - HL, dz = z;
    return dx * dx + dz * dz <= R_A * R_A;
  }
  const dx = x + HL, dz = z;
  return dx * dx + dz * dz <= R_A * R_A;
}

/* ═══════════════════════ BUILD POND ═══════════════════════ */

function buildPond(group: THREE.Group, depthMm: number) {
  disposeGroup(group);
  const depth = depthToU(depthMm);
  const waterBottom = SURFACE_Y - depth;

  const waterGeo = extrudeYWithGradient(
    stadiumShape(POND_L, POND_W), depth, waterBottom, PAL.waterTop, PAL.waterBottom
  );
  group.add(new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.05 })));

  const sphereMat = new THREE.MeshStandardMaterial({ color: 0xfcd34d, roughness: 0.85, metalness: 0.0, emissive: 0xf59e0b, emissiveIntensity: 0.4 });
  const sp = new THREE.Mesh(new THREE.SphereGeometry(SPHERE_R, 32, 32), sphereMat);
  sp.position.set(SUN_X, SPHERE_Y, 0);
  group.add(sp);

}

/* ═══════════════════════ BUILD RAYS ═══════════════════════ */

interface RayData {
  mesh: THREE.Line;
  startPt: THREE.Vector3;
  endPt: THREE.Vector3;
  pathLen: number;
  segLen: number;
  cycleDur: number;
  phase: number;
  peakOpacity: number;
}

function buildRays(rayGroup: THREE.Group, rayState: React.MutableRefObject<RayData[]>) {
  disposeGroup(rayGroup);
  rayState.current = [];

  const sunCenter = new THREE.Vector3(SUN_X, SPHERE_Y, 0);
  const landingY = SURFACE_Y;

  const landings: THREE.Vector3[] = [];
  const stepsX = 9, stepsZ = 7;
  for (let ix = 0; ix <= stepsX; ix++) {
    for (let iz = 0; iz <= stepsZ; iz++) {
      const x = -HL - R_A + POND_L * (ix / stepsX);
      const z = -R_A + POND_W * (iz / stepsZ);
      if (isInsideStadium(x, z)) {
        const jx = x + (Math.random() - 0.5) * 0.12;
        const jz = z + (Math.random() - 0.5) * 0.08;
        if (isInsideStadium(jx, jz)) {
          landings.push(new THREE.Vector3(jx, landingY, jz));
        }
      }
    }
  }

  for (const land of landings) {
    const dir = new THREE.Vector3().subVectors(land, sunCenter).normalize();
    const start = sunCenter.clone().addScaledVector(dir, SPHERE_R);
    const pathLen = start.distanceTo(land);

    const positions = new Float32Array(6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xf9b501,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.visible = false;
    rayGroup.add(line);

    rayState.current.push({
      mesh: line,
      startPt: start.clone(),
      endPt: land.clone(),
      pathLen,
      segLen: 0.15 + Math.random() * 0.25,
      cycleDur: 1.8 + Math.random() * 2.0,
      phase: Math.random(),
      peakOpacity: 0.2 + Math.random() * 0.25,
    });
  }
}

/* ═══════════════════════ BUILD WATER PULSES ═══════════════════════ */

const WATER_CYCLE = 4.0;
const WATER_WAVES = 5;
const WATER_END_PAD = 0.3;

interface WaterPulseData {
  mesh: THREE.Line;
  offset: number;
  waterYTop: number;
  waterYBottom: number;
  duration: number;
}

function buildWaterPulses(pulseGroup: THREE.Group, depthMm: number, pulseState: React.MutableRefObject<WaterPulseData[]>) {
  disposeGroup(pulseGroup);
  pulseState.current = [];

  const depth = depthToU(depthMm);
  const waterYTop = SURFACE_Y;
  const waterYBottom = SURFACE_Y - depth;
  const endTime = WATER_CYCLE - WATER_END_PAD;

  for (let w = 0; w < WATER_WAVES; w++) {
    const wPts = stadiumOutlinePts(POND_L + 0.02, POND_W + 0.02, 48);
    const wRing = new THREE.Line(new THREE.BufferGeometry().setFromPoints(wPts), pulseLineMat());
    wRing.visible = false;
    pulseGroup.add(wRing);

    pulseState.current.push({
      mesh: wRing,
      offset: (w / WATER_WAVES) * WATER_CYCLE,
      waterYTop,
      waterYBottom,
      duration: endTime,
    });
  }
}

/* ═══════════════════════ UPDATE ANIMATIONS ═══════════════════════ */

function updateRays(rayState: React.MutableRefObject<RayData[]>, time: number) {
  for (const ray of rayState.current) {
    const t = ((time / ray.cycleDur + ray.phase) % 1 + 1) % 1;
    const headT = -ray.segLen + t * (1 + ray.segLen * 2);
    const tailT = headT - ray.segLen;
    const visHead = Math.min(1, Math.max(0, headT));
    const visTail = Math.min(1, Math.max(0, tailT));

    if (visHead <= visTail + 0.001) {
      ray.mesh.visible = false;
      continue;
    }

    const posArr = (ray.mesh.geometry.attributes.position as THREE.Float32BufferAttribute).array as Float32Array;
    posArr[0] = ray.startPt.x + (ray.endPt.x - ray.startPt.x) * visTail;
    posArr[1] = ray.startPt.y + (ray.endPt.y - ray.startPt.y) * visTail;
    posArr[2] = ray.startPt.z + (ray.endPt.z - ray.startPt.z) * visTail;
    posArr[3] = ray.startPt.x + (ray.endPt.x - ray.startPt.x) * visHead;
    posArr[4] = ray.startPt.y + (ray.endPt.y - ray.startPt.y) * visHead;
    posArr[5] = ray.startPt.z + (ray.endPt.z - ray.startPt.z) * visHead;
    ray.mesh.geometry.attributes.position.needsUpdate = true;

    const midT = (visHead + visTail) / 2;
    let op = ray.peakOpacity;
    if (midT < 0.15) op *= midT / 0.15;
    if (midT > 0.85) op *= (1 - midT) / 0.15;
    (ray.mesh.material as THREE.LineBasicMaterial).opacity = op;
    ray.mesh.visible = true;
  }
}

function updateWaterPulses(pulseState: React.MutableRefObject<WaterPulseData[]>, time: number) {
  for (const p of pulseState.current) {
    const ct = ((time + p.offset) % WATER_CYCLE + WATER_CYCLE) % WATER_CYCLE;
    if (ct <= p.duration && p.duration > 0) {
      const vf = ct / p.duration;
      p.mesh.position.set(0, p.waterYTop + (p.waterYBottom - p.waterYTop) * vf, 0);
      let op = Math.max(0.03, 1 - vf * 0.95);
      if (vf < 0.08) op *= vf / 0.08;
      if (vf > 0.90) op *= (1 - vf) / 0.10;
      (p.mesh.material as THREE.LineBasicMaterial).opacity = op;
      p.mesh.visible = true;
    } else {
      p.mesh.visible = false;
    }
  }
}

/* ═══════════════════════ COMPONENT ═══════════════════════ */

export default function DepthDiagram({ depthMm }: { depthMm: number }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const frameId = useRef<number>(0);
  const pondGroup = useRef<THREE.Group | null>(null);
  const rayGroup = useRef<THREE.Group | null>(null);
  const rayState = useRef<RayData[]>([]);
  const pulseGroup = useRef<THREE.Group | null>(null);
  const pulseState = useRef<WaterPulseData[]>([]);
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

    buildPond(pg, depthMm);
    buildRays(rg, rayState);
    buildWaterPulses(plg, depthMm, pulseState);
    clockRef.current.start();

    const target = new THREE.Vector3(-0.2, 0.45, 0);
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
      const t = clockRef.current.getElapsedTime();
      updateRays(rayState, t);
      updateWaterPulses(pulseState, t);
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
    if (pondGroup.current && pulseGroup.current) {
      buildPond(pondGroup.current, depthMm);
      buildWaterPulses(pulseGroup.current, depthMm, pulseState);
    }
  }, [depthMm]);

  const geo = useMemo(
    () => computeGeometry(DEFAULT_CONFIG.area_ha, DEFAULT_CONFIG.aspect_ratio, depthMm / 1000, DEFAULT_CONFIG.berm_width),
    [depthMm],
  );

  const volumeKL = Math.round(geo.V_liters / 1000);

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
          aria-label={`Pond: ${Math.round(geo.W)}m × ${Math.round(geo.Ltotal)}m, ${depthMm}mm deep`}
        >
          <text x="4" y="10" fill="#555" fontSize="10" fontFamily="monospace" fontWeight="600">
            1 acre | {depthMm}mm deep
          </text>
          <rect x="4" y="29" width="168" height="22" rx="11" fill="none" stroke="#888" strokeWidth="1.2" />
          <text x="88" y="44" textAnchor="middle" fill="#666" fontSize="8.5" fontFamily="monospace">
            {depthMm}mm deep
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

"use client";

import { useRef, useEffect, useId } from "react";
import * as THREE from "three";

/* ═══════════════════════ PALETTE ═══════════════════════ */
const PAL = {
  waterBottom: new THREE.Color(0x5a9a4a),
  gold: 0xf9b501,
  goldPale: 0xf9d46b,
};

/* ═══════════════════════ GEOMETRY CONSTANTS ═══════════════════════ */
const POND_L = 4.4;
const POND_W = 1.4;
const WATER_H = 0.22; // total visual water height (divided among layers)
const GAP_H = 0.07; // visual gap between layers
const SPHERE_R = 0.15;

const R_A = POND_W / 2;
const HL = POND_L / 2 - R_A;
const SUN_X = -(HL + R_A + 0.9);

const ANCHOR_Y = WATER_H; // top of first water layer, always fixed
const VIS_MAX_LAYERS = 10;
const MAX_STACK = WATER_H + (VIS_MAX_LAYERS - 1) * GAP_H;
const SPHERE_Y = MAX_STACK + 0.35;

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

  // Sun sphere
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

  const waterPerLayer = WATER_H / layers;
  const baseOffset = ANCHOR_Y - waterPerLayer;
  const topSurfaceY = baseOffset + layers * waterPerLayer + (layers - 1) * GAP_H;

  const sunCenter = new THREE.Vector3(SUN_X, SPHERE_Y, 0);

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
    posArr[0] = r.startPt.x + (r.landPt.x - r.startPt.x) * visTail;
    posArr[1] = r.startPt.y + (r.landPt.y - r.startPt.y) * visTail;
    posArr[2] = r.startPt.z + (r.landPt.z - r.startPt.z) * visTail;
    posArr[3] = r.startPt.x + (r.landPt.x - r.startPt.x) * visHead;
    posArr[4] = r.startPt.y + (r.landPt.y - r.startPt.y) * visHead;
    posArr[5] = r.startPt.z + (r.landPt.z - r.startPt.z) * visHead;
    r.mesh.geometry.attributes.position.needsUpdate = true;

    const midT = (visHead + visTail) / 2;
    let op = r.peakOpacity;
    if (midT < 0.15) op *= midT / 0.15;
    else if (midT > 0.85) op *= (1 - midT) / 0.15;
    (r.mesh.material as THREE.LineBasicMaterial).opacity = op;
  }
}

/* ═══════════════════════ COMPONENT ═══════════════════════ */

export default function LayeredDiagram({ layers }: { layers: number }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const frameId = useRef<number>(0);
  const pondGroup = useRef<THREE.Group | null>(null);
  const rayGroup = useRef<THREE.Group | null>(null);
  const rayState = useRef<RayData[]>([]);
  const rendRef = useRef<THREE.WebGLRenderer | null>(null);
  const clockRef = useRef(new THREE.Clock());
  const uid = useId().replace(/:/g, "");

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

    buildPond(pg, layers);
    buildRays(rg, layers, rayState);
    clockRef.current.start();

    const target = new THREE.Vector3(-0.2, 0.55, 0);
    const sp = new THREE.Spherical(9.0, 1.0, 0.65);
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
    if (pondGroup.current && rayGroup.current) {
      buildPond(pondGroup.current, layers);
      buildRays(rayGroup.current, layers, rayState);
    }
  }, [layers]);

  const LAYERED_DEPTH_MM = 300;
  const volumeL = Math.round(4.4 * 1.4 * (LAYERED_DEPTH_MM / 1000) * 1000);
  const volumeKL = volumeL / 1000;
  const volumeLabel = volumeKL >= 20 ? Math.round(volumeKL).toLocaleString() : volumeKL.toFixed(1);
  const perLayerMm = Math.round(LAYERED_DEPTH_MM / layers);

  /* ── 2D Cross-Section SVG ── */
  const crossSection = (() => {
    const svgW = 220;
    const margin = { top: 32, bottom: 10, left: 12, right: 12 };
    const drawW = svgW - margin.left - margin.right;

    const pxPerMm = drawW / 600; // drawW represents 600mm channel width
    const maxTotalPx = 300 * pxPerMm; // 300mm total depth, proportional
    const gapPx = layers > 1 ? 5 : 0;
    const totalGapPx = (layers - 1) * gapPx;
    const availableForWater = maxTotalPx - totalGapPx;
    const layerPx = availableForWater / layers;

    const sunCx = svgW / 2;
    const sunCy = 14;
    const sunR = 5;

    const surfaceYSvg = margin.top + 6;

    const layerRects: { y: number; h: number }[] = [];
    let cursor = surfaceYSvg;
    for (let i = 0; i < layers; i++) {
      layerRects.push({ y: cursor, h: layerPx });
      cursor += layerPx + gapPx;
    }
    const bottomYSvg = cursor - gapPx;

    const contentBottom = bottomYSvg + 18;
    const offsetY = 0;

    const numRays = 8;
    const rayPositions: number[] = [];
    for (let i = 0; i < numRays; i++) {
      rayPositions.push(margin.left + (drawW / (numRays + 1)) * (i + 1));
    }

    return (
      <svg viewBox={`0 0 ${svgW} ${contentBottom}`} style={{ width: "100%" }} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={`layered-wg-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f9b501" />
            <stop offset="100%" stopColor="#5a9a4a" />
          </linearGradient>
        </defs>

        <g transform={`translate(0, ${offsetY})`}>
          <text x={margin.left} y={sunCy - 2} textAnchor="start" fill="#555" fontSize={10} fontWeight="700" letterSpacing={2} fontFamily="monospace" style={{ textTransform: "uppercase" as const }}>
            Cross-Section
          </text>

          <circle cx={sunCx} cy={sunCy + 12} r={sunR} fill="#F9B501" />

          {rayPositions.map((px, i) => (
            <line key={`ray-${i}`} x1={sunCx} y1={sunCy + 12 + sunR} x2={px} y2={surfaceYSvg - 2}
              stroke="#F9B501" strokeWidth={0.5} opacity={0.3} />
          ))}

          {layerRects.map((lr, i) => (
            <rect key={`layer-${i}`} x={margin.left} y={lr.y} width={drawW} height={lr.h} rx={2}
              fill={`url(#layered-wg-${uid})`} opacity={0.9} />
          ))}

          <line x1={margin.left} y1={surfaceYSvg} x2={margin.left} y2={bottomYSvg} stroke="#5a9a4a" strokeWidth={3} />
          <line x1={svgW - margin.right} y1={surfaceYSvg} x2={svgW - margin.right} y2={bottomYSvg} stroke="#5a9a4a" strokeWidth={3} />

          <text x={svgW / 2} y={bottomYSvg + 5} textAnchor="middle" fill="#666" fontSize={11} fontWeight="600" fontFamily="monospace" dominantBaseline="hanging">
            {layers} × {perLayerMm}mm layers
          </text>
        </g>
      </svg>
    );
  })();

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        userSelect: "none",
        overflow: "hidden",
        borderRadius: 8,
        display: "flex",
      }}
    >
      {/* Cross-section + dimensions — desktop only */}
      <div
        className="hidden md:flex flex-col items-center"
        style={{ flexShrink: 0, width: 220, padding: "4px 0", gap: 8 }}
      >
        <div style={{ flex: 1, minHeight: 0, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          {crossSection}
        </div>
        <svg viewBox="0 0 206 66" style={{ width: 180, flexShrink: 0 }}>
          <rect x="4" y="4" width="168" height="22" rx="11" fill="none" stroke="#888" strokeWidth="1.2" />
          <line x1="180" y1="4" x2="180" y2="26" stroke="#888" strokeWidth="0.7" />
          <line x1="177" y1="4" x2="183" y2="4" stroke="#888" strokeWidth="0.7" />
          <line x1="177" y1="26" x2="183" y2="26" stroke="#888" strokeWidth="0.7" />
          <text x="196" y="19" textAnchor="middle" fill="#666" fontSize="8" fontFamily="monospace">
            1.4m
          </text>
          <line x1="4" y1="37" x2="172" y2="37" stroke="#888" strokeWidth="0.7" />
          <line x1="4" y1="34" x2="4" y2="40" stroke="#888" strokeWidth="0.7" />
          <line x1="172" y1="34" x2="172" y2="40" stroke="#888" strokeWidth="0.7" />
          <text x="88" y="52" textAnchor="middle" fill="#666" fontSize="9" fontFamily="monospace">
            4.4m
          </text>
        </svg>
      </div>

      {/* 3D canvas + volume overlay */}
      <div style={{ position: "relative", flex: 1, minWidth: 0, height: "100%" }}>
        <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

        <div style={{ position: "absolute", top: 8, right: 8, zIndex: 10 }}>
          <span style={{ color: "#555", fontSize: 11, fontFamily: "monospace", fontWeight: 600 }}>
            Volume: {volumeLabel} kL
          </span>
        </div>
      </div>
    </div>
  );
}

/** Standalone cross-section + dimension diagram for use outside the 3D component */
export function LayeredCrossSection({ layers }: { layers: number }) {
  const uid = useId();
  const svgW = 220;
  const margin = { top: 32, bottom: 10, left: 12, right: 12 };
  const drawW = svgW - margin.left - margin.right;
  const pxPerMm = drawW / 600;
  const maxTotalPx = 300 * pxPerMm;
  const gapPx = layers > 1 ? 5 : 0;
  const totalGapPx = (layers - 1) * gapPx;
  const availableForWater = maxTotalPx - totalGapPx;
  const layerPx = availableForWater / layers;
  const perLayerMm = Math.round(300 / layers);
  const sunCx = svgW / 2;
  const sunCy = 14;
  const sunR = 5;
  const surfaceYSvg = margin.top + 6;
  const layerRects: { y: number; h: number }[] = [];
  let cursor = surfaceYSvg;
  for (let i = 0; i < layers; i++) {
    layerRects.push({ y: cursor, h: layerPx });
    cursor += layerPx + gapPx;
  }
  const bottomYSvg = cursor - gapPx;
  const contentBottom = bottomYSvg + 18;
  const numRays = 8;
  const rayPositions: number[] = [];
  for (let i = 0; i < numRays; i++) {
    rayPositions.push(margin.left + (drawW / (numRays + 1)) * (i + 1));
  }

  return (
    <div className="flex flex-row items-center justify-center gap-2">
      <svg viewBox={`0 0 ${svgW} ${contentBottom}`} style={{ width: 180 }} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={`layered-mob-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f9b501" />
            <stop offset="100%" stopColor="#5a9a4a" />
          </linearGradient>
        </defs>
        <g>
          <text x={margin.left} y={sunCy - 2} textAnchor="start" fill="#555" fontSize={10} fontWeight="700" letterSpacing={2} fontFamily="monospace" style={{ textTransform: "uppercase" as const }}>
            Cross-Section
          </text>
          <circle cx={sunCx} cy={sunCy + 12} r={sunR} fill="#F9B501" />
          {rayPositions.map((px, i) => (
            <line key={`ray-${i}`} x1={sunCx} y1={sunCy + 12 + sunR} x2={px} y2={surfaceYSvg - 2} stroke="#F9B501" strokeWidth={0.5} opacity={0.3} />
          ))}
          {layerRects.map((lr, i) => (
            <rect key={`layer-${i}`} x={margin.left} y={lr.y} width={drawW} height={lr.h} rx={2} fill={`url(#layered-mob-${uid})`} opacity={0.9} />
          ))}
          <line x1={margin.left} y1={surfaceYSvg} x2={margin.left} y2={bottomYSvg} stroke="#5a9a4a" strokeWidth={3} />
          <line x1={svgW - margin.right} y1={surfaceYSvg} x2={svgW - margin.right} y2={bottomYSvg} stroke="#5a9a4a" strokeWidth={3} />
          <text x={svgW / 2} y={bottomYSvg + 5} textAnchor="middle" fill="#666" fontSize={11} fontWeight="600" fontFamily="monospace" dominantBaseline="hanging">
            {layers} × {perLayerMm}mm layers
          </text>
        </g>
      </svg>
      <svg viewBox="0 0 206 66" style={{ width: 160, flexShrink: 0 }}>
        <rect x="4" y="4" width="168" height="22" rx="11" fill="none" stroke="#888" strokeWidth="1.2" />
        <line x1="180" y1="4" x2="180" y2="26" stroke="#888" strokeWidth="0.7" />
        <line x1="177" y1="4" x2="183" y2="4" stroke="#888" strokeWidth="0.7" />
        <line x1="177" y1="26" x2="183" y2="26" stroke="#888" strokeWidth="0.7" />
        <text x="196" y="19" textAnchor="middle" fill="#666" fontSize="8" fontFamily="monospace">1.4m</text>
        <line x1="4" y1="37" x2="172" y2="37" stroke="#888" strokeWidth="0.7" />
        <line x1="4" y1="34" x2="4" y2="40" stroke="#888" strokeWidth="0.7" />
        <line x1="172" y1="34" x2="172" y2="40" stroke="#888" strokeWidth="0.7" />
        <text x="88" y="52" textAnchor="middle" fill="#666" fontSize="9" fontFamily="monospace">4.4m</text>
      </svg>
    </div>
  );
}

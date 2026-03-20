"use client";

import { useRef, useEffect, useId } from "react";
import * as THREE from "three";
import { shouldYieldToInteraction } from "@/lib/simulation/shared-timer";

/* ═══════════════════════ PALETTE ═══════════════════════ */
const PAL = {
  waterBottom: new THREE.Color(0x5a9a4a),
  gold: 0xf9b501,
  panelGold: 0xd4a843,
  captureGold: 0xf0c040,
  capEdge: 0xc89e30,
  glowGold: new THREE.Color(0xf9b501),
  surfaceGreen: new THREE.Color(0x5a9a4a),
};

/* ═══════════════════════ GEOMETRY CONSTANTS ═══════════════════════ */
const POND_L = 4.4;
const POND_W = 1.4;
const SPHERE_R = 0.15;
const R_A = POND_W / 2;
const HL = POND_L / 2 - R_A;

const SUN_X = -(HL + R_A + 0.9);
const SURFACE_Y = 0.12;
const SPHERE_Y = 1.35;

const DEPTH_SCALE = 0.0004;
const depthToU = (mm: number) => mm * DEPTH_SCALE;

const PANEL_THICK = 0.006;
const CAPTURE_H = 0.06;
const CAP_H = 0.006;
const BERM_GAP = 0.12;

/* ═══════════════════════ GEOMETRY HELPERS ═══════════════════════ */

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

function extrudeY(shape: THREE.Shape, height: number, yOff: number) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 48 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, yOff, 0);
  return g;
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

function colorByPanelProximity(
  geo: THREE.BufferGeometry,
  panelZPositions: number[],
  panelSpacing: number,
  panelLength: number,
) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const halfSpacing = panelSpacing / 2;
  const halfPanelLen = panelLength / 2;
  const edgeFade = 0.08;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    const vy = pos.getY(i);

    const xOverhang = Math.max(0, Math.abs(vx) - halfPanelLen);
    const xFactor = Math.max(0, 1 - xOverhang / edgeFade);

    let minDist = Infinity;
    for (const pz of panelZPositions) {
      const d = Math.abs(vz - pz);
      if (d < minDist) minDist = d;
    }

    const t = Math.min(1, minDist / halfSpacing);
    const fade = t * t;
    const goldAmount = (1 - fade) * xFactor;
    const c = PAL.surfaceGreen.clone().lerp(PAL.glowGold, goldAmount);

    const yNorm = Math.max(0, Math.min(1, (vy - (SURFACE_Y - 0.2)) / 0.2));
    const depthDarken = 0.6 + 0.4 * yNorm;

    colors[i * 3] = c.r * depthDarken;
    colors[i * 3 + 1] = c.g * depthDarken;
    colors[i * 3 + 2] = c.b * depthDarken;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

function buildTopSurface(
  length: number,
  width: number,
  y: number,
  panelZPositions: number[],
  panelSpacing: number,
  panelLength: number,
) {
  const r = width / 2;
  const hl = length / 2 - r;
  const totalPanels = panelZPositions.length;
  const zSegs = Math.max(80, totalPanels * 6);
  const xSegs = 40;

  const vertices: number[] = [];
  const indices: number[] = [];
  let idx = 0;

  const zMin = -r, zMax = r;
  const xMin = -length / 2, xMax = length / 2;

  function insideStadium(x: number, z: number) {
    if (Math.abs(x) <= hl) return Math.abs(z) <= r;
    const cx = x > 0 ? hl : -hl;
    return (x - cx) * (x - cx) + z * z <= r * r + 0.001;
  }

  const xStep = (xMax - xMin) / xSegs;
  const zStep = (zMax - zMin) / zSegs;

  const gridW = xSegs + 1;
  const gridH = zSegs + 1;
  const gridIdx = new Int32Array(gridW * gridH).fill(-1);

  for (let zi = 0; zi <= zSegs; zi++) {
    for (let xi = 0; xi <= xSegs; xi++) {
      const x = xMin + xi * xStep;
      const z = zMin + zi * zStep;
      if (insideStadium(x, z)) {
        vertices.push(x, y, z);
        gridIdx[zi * gridW + xi] = idx++;
      }
    }
  }

  for (let zi = 0; zi < zSegs; zi++) {
    for (let xi = 0; xi < xSegs; xi++) {
      const a = gridIdx[zi * gridW + xi];
      const b = gridIdx[zi * gridW + xi + 1];
      const c = gridIdx[(zi + 1) * gridW + xi];
      const d = gridIdx[(zi + 1) * gridW + xi + 1];
      if (a >= 0 && b >= 0 && c >= 0) indices.push(a, c, b);
      if (b >= 0 && d >= 0 && c >= 0) indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const halfSpacing = panelSpacing / 2;
  const halfPanelLen = panelLength / 2;
  const edgeFade = 0.08;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);

    const xOverhang = Math.max(0, Math.abs(vx) - halfPanelLen);
    const xFactor = Math.max(0, 1 - xOverhang / edgeFade);

    let minDist = Infinity;
    for (const pz of panelZPositions) {
      const d = Math.abs(vz - pz);
      if (d < minDist) minDist = d;
    }

    const t = Math.min(1, minDist / halfSpacing);
    const fade = t * t;
    const goldAmount = (1 - fade) * xFactor;
    const c = PAL.surfaceGreen.clone().lerp(PAL.glowGold, goldAmount);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  return geo;
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

/* ═══════════════════════ PANEL BUILDER ═══════════════════════ */

function buildPanel(
  panelLength: number,
  plateHeight: number,
  captureWidth: number,
  plateBaseY: number,
  captureBaseY: number,
) {
  const group = new THREE.Group();
  const panelMat = new THREE.MeshStandardMaterial({ color: PAL.panelGold, roughness: 0.35, metalness: 0.15, side: THREE.DoubleSide });
  const captureMat = new THREE.MeshStandardMaterial({ color: PAL.captureGold, roughness: 0.25, metalness: 0.2 });
  const capMat = new THREE.MeshStandardMaterial({ color: PAL.capEdge, roughness: 0.35, metalness: 0.15 });

  if (plateHeight > 0) {
    const thinGeo = new THREE.BoxGeometry(panelLength, plateHeight, PANEL_THICK);
    thinGeo.translate(0, plateBaseY + plateHeight / 2, 0);
    group.add(new THREE.Mesh(thinGeo, panelMat.clone()));
  }

  const halfSpacing = captureWidth / 2;
  const halfThick = PANEL_THICK / 2;
  const halfLen = panelLength / 2;
  const wedgeShape = new THREE.Shape();
  wedgeShape.moveTo(-halfThick, 0);
  wedgeShape.lineTo(halfThick, 0);
  wedgeShape.lineTo(halfSpacing, CAPTURE_H);
  wedgeShape.lineTo(-halfSpacing, CAPTURE_H);
  wedgeShape.closePath();
  const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, { depth: panelLength, bevelEnabled: false });
  wedgeGeo.rotateY(Math.PI / 2);
  wedgeGeo.translate(-halfLen, captureBaseY, 0);
  group.add(new THREE.Mesh(wedgeGeo, captureMat.clone()));

  const capGeo = new THREE.BoxGeometry(panelLength, CAP_H, captureWidth);
  capGeo.translate(0, captureBaseY + CAPTURE_H + CAP_H / 2, 0);
  group.add(new THREE.Mesh(capGeo, capMat.clone()));

  return group;
}

/* ═══════════════════════ SUN RAYS ═══════════════════════ */

interface RayData {
  mesh: THREE.Line;
  startPt: THREE.Vector3;
  endPt: THREE.Vector3;
  segLen: number;
  cycleDur: number;
  phase: number;
  peakOpacity: number;
}

function buildRays(rayGroup: THREE.Group, captureTopY: number, rayState: React.MutableRefObject<RayData[]>) {
  disposeGroup(rayGroup);
  rayState.current = [];

  const sunCenter = new THREE.Vector3(SUN_X, SPHERE_Y, 0);
  const landingY = captureTopY;

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
      segLen: 0.15 + Math.random() * 0.25,
      cycleDur: 1.8 + Math.random() * 2.0,
      phase: Math.random(),
      peakOpacity: 0.2 + Math.random() * 0.25,
    });
  }
}

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

/* ═══════════════════════ BUILD POND ═══════════════════════ */

interface PondInfo {
  captureTopY: number;
}

function buildPond(group: THREE.Group, panelsPerSide: number, depthMm: number): PondInfo {
  disposeGroup(group);
  const depth = depthToU(depthMm);
  const waterBottom = SURFACE_Y - depth;

  const channelWidth = (POND_W - BERM_GAP) / 2 - 0.04;
  const panelSpacing = channelWidth / panelsPerSide;
  const panelLength = HL * 2 + R_A * 0.25;
  const plateHeight = depth;

  const panelZPositions: number[] = [];
  for (let side = 0; side < 2; side++) {
    const zSign = side === 0 ? 1 : -1;
    const channelStart = BERM_GAP / 2 + 0.01;
    for (let i = 0; i < panelsPerSide; i++) {
      const zPos = zSign * (channelStart + panelSpacing * (i + 0.5));
      panelZPositions.push(zPos);
    }
  }

  // Water body
  const waterGeo = extrudeY(stadiumShape(POND_L, POND_W), depth, waterBottom);
  colorByPanelProximity(waterGeo, panelZPositions, panelSpacing, panelLength);
  group.add(new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.05 })));

  // Top surface with gold stripes
  const topGeo = buildTopSurface(POND_L, POND_W, SURFACE_Y + 0.008, panelZPositions, panelSpacing, panelLength);
  group.add(new THREE.Mesh(topGeo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.35, metalness: 0.08,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  })));

  // Panels
  for (const zPos of panelZPositions) {
    const panel = buildPanel(panelLength, plateHeight, panelSpacing * 0.9, waterBottom, SURFACE_Y);
    panel.position.z = zPos;
    group.add(panel);
  }

  const captureTopY = SURFACE_Y + CAPTURE_H + CAP_H;

  // Sun sphere — match DepthDiagram style (no label)
  const sphereMat = new THREE.MeshStandardMaterial({ color: 0xfcd34d, roughness: 0.85, metalness: 0.0, emissive: 0xf59e0b, emissiveIntensity: 0.4 });
  const sp = new THREE.Mesh(new THREE.SphereGeometry(SPHERE_R, 32, 32), sphereMat);
  sp.position.set(SUN_X, SPHERE_Y, 0);
  group.add(sp);

  return { captureTopY };
}

/* ═══════════════════════ COMPONENT ═══════════════════════ */

interface LightGuidePanelDiagramProps {
  panelsPerSide: number;
  depthMm: number;
}

export default function LightGuidePanelDiagram({ panelsPerSide, depthMm }: LightGuidePanelDiagramProps) {
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

    const info = buildPond(pg, panelsPerSide, depthMm);
    buildRays(rg, info.captureTopY, rayState);
    clockRef.current.start();

    const target = new THREE.Vector3(-0.2, 0.45, 0);
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
      if (shouldYieldToInteraction()) {
        frameId.current = requestAnimationFrame(tick);
        return;
      }
      const t = clockRef.current.getElapsedTime();
      updateRays(rayState, t);
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
    if (!pondGroup.current || !rayGroup.current) return;
    const info = buildPond(pondGroup.current, panelsPerSide, depthMm);
    buildRays(rayGroup.current, info.captureTopY, rayState);
  }, [panelsPerSide, depthMm]);

  const volumeL = Math.round(4.4 * 1.4 * (depthMm / 1000) * 1000);
  const volumeKL = Math.round(volumeL / 1000);

  // ── 2D Cross-Section SVG ──
  const crossSection = (() => {
    const svgW = 220;
    const margin = { top: 32, bottom: 10, left: 10, right: 10 };
    const drawW = svgW - margin.left - margin.right;

    const pondWidthMm = POND_W * 1000;
    const mmToPx = drawW / pondWidthMm;

    const pxPerMm = drawW / 600; // drawW represents 600mm channel width
    const depthPx = depthMm * pxPerMm;
    const maxDepthPx = 500 * pxPerMm;
    const captureHPx = 24;
    const capHPx = 3;

    const sunCx = svgW / 2;
    const sunCy = 14;
    const sunR = 5;

    const surfaceYSvg = margin.top + captureHPx + capHPx + 4;
    const bottomYSvg = surfaceYSvg + depthPx;

    const channelWidthMm = ((POND_W - BERM_GAP) / 2 - 0.04) * 1000;
    const spacingMm = channelWidthMm / panelsPerSide;
    const bermGapPx = BERM_GAP * 1000 * mmToPx;

    const panelLines: number[] = [];
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? 1 : -1;
      const startMm = (BERM_GAP / 2 + 0.01) * 1000;
      for (let i = 0; i < panelsPerSide; i++) {
        const zMm = startMm + spacingMm * (i + 0.5);
        panelLines.push(sign * zMm * mmToPx);
      }
    }

    const captureWidthPx = spacingMm * mmToPx * 0.9;

    const contentBottomAt500 = surfaceYSvg + maxDepthPx + 18;
    const offsetY = 0;

    return (
      <svg viewBox={`0 0 ${svgW} ${contentBottomAt500}`} style={{ width: "100%" }} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={`lgp-glowR-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#F9B501" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#F9B501" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`lgp-glowL-${uid}`} x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="#F9B501" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#F9B501" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`lgp-depthFade-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a3a10" stopOpacity="0" />
            <stop offset="100%" stopColor="#1a3a10" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        <g transform={`translate(0, ${offsetY})`}>
          <text x={margin.left} y={sunCy - 2} textAnchor="start" fill="#555" fontSize={10} fontWeight="700" letterSpacing={2} fontFamily="monospace" style={{ textTransform: "uppercase" as const }}>
            Cross-Section
          </text>

          <circle cx={sunCx} cy={sunCy + 12} r={sunR} fill="#F9B501" />

          {panelLines.map((px, i) => (
            <line key={`ray-${i}`} x1={sunCx} y1={sunCy + 12 + sunR} x2={svgW / 2 + px} y2={surfaceYSvg - 2}
              stroke="#F9B501" strokeWidth={0.5} opacity={0.3} />
          ))}

          <rect x={margin.left} y={surfaceYSvg} width={drawW} height={depthPx} rx={3} fill="#5a9a4a" opacity={0.85} />

          {panelLines.map((px, i) => {
            const cx = svgW / 2 + px;
            const halfGlow = Math.min(captureWidthPx / 2, spacingMm * mmToPx * 0.45);
            return (
              <g key={`glow-${i}`}>
                <rect x={cx} y={surfaceYSvg + 1} width={halfGlow} height={depthPx - 2} fill={`url(#lgp-glowR-${uid})`} />
                <rect x={cx - halfGlow} y={surfaceYSvg + 1} width={halfGlow} height={depthPx - 2} fill={`url(#lgp-glowL-${uid})`} />
              </g>
            );
          })}

          <rect x={margin.left} y={surfaceYSvg} width={drawW} height={depthPx} rx={3} fill={`url(#lgp-depthFade-${uid})`} />

          {panelLines.map((px, i) => {
            const cx = svgW / 2 + px;
            const halfCap = Math.min(captureWidthPx / 2, spacingMm * mmToPx * 0.45);
            return (
              <g key={`panel-${i}`}>
                <line x1={cx} y1={surfaceYSvg} x2={cx} y2={bottomYSvg} stroke="#d4a843" strokeWidth={2} />
                <polygon
                  points={`${cx},${surfaceYSvg} ${cx - halfCap},${surfaceYSvg - captureHPx} ${cx + halfCap},${surfaceYSvg - captureHPx}`}
                  fill="#f0c040" stroke="#c89e30" strokeWidth={0.7} />
                <rect x={cx - halfCap} y={surfaceYSvg - captureHPx - capHPx} width={halfCap * 2} height={capHPx} fill="#c89e30" />
              </g>
            );
          })}

          <rect x={svgW / 2 - bermGapPx / 2} y={surfaceYSvg} width={bermGapPx} height={depthPx} fill="#3a6628" opacity={0.5} />

          <line x1={margin.left} y1={surfaceYSvg} x2={margin.left} y2={bottomYSvg} stroke="#5a9a4a" strokeWidth={3} />
          <line x1={svgW - margin.right} y1={surfaceYSvg} x2={svgW - margin.right} y2={bottomYSvg} stroke="#5a9a4a" strokeWidth={3} />

          <text x={svgW / 2} y={bottomYSvg + 5} textAnchor="middle" fill="#666" fontSize={11} fontWeight="600" fontFamily="monospace" dominantBaseline="hanging">
            {depthMm}mm · {Math.round(spacingMm)}mm spacing
          </text>
        </g>
      </svg>
    );
  })();

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", userSelect: "none", overflow: "hidden", borderRadius: 8, display: "flex" }}>
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
            Volume: {volumeKL.toLocaleString()} kL
          </span>
        </div>
      </div>
    </div>
  );
}

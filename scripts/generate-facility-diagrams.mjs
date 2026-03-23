/**
 * Reads the facility master diagram JSON and slices it into one file per
 * pond-count step (10, 12, 14, …, 120 ponds = 56 files).
 *
 * Usage: node scripts/generate-facility-diagrams.mjs
 *
 * Input:  public/diagrams/open-raceway-pond-facility.json
 * Output: public/diagrams/facility/open-raceway-pond-facility-{N}.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const MASTER_PATH = join(ROOT, "public", "diagrams", "open-raceway-pond-facility.json");
const OUT_DIR = join(ROOT, "public", "diagrams", "facility");

// Read master diagram
let master;
try {
  master = JSON.parse(readFileSync(MASTER_PATH, "utf8"));
} catch (err) {
  console.error(`Error: Could not read master diagram at ${MASTER_PATH}`);
  console.error("Make sure you have authored and saved the facility master diagram from the admin editor.");
  process.exit(1);
}

// Partition nodes
const pondNodes = (master.nodes || [])
  .filter((n) => n.data?.equipmentTypeId === "raceway-pond")
  .sort((a, b) => parseInt(a.data.label) - parseInt(b.data.label));

const contextNodes = (master.nodes || []).filter(
  (n) => n.data?.equipmentTypeId !== "raceway-pond"
);

console.log(`Found ${pondNodes.length} pond nodes and ${contextNodes.length} context nodes.`);

if (pondNodes.length < 120) {
  console.warn(`Warning: Only ${pondNodes.length} pond nodes found. Slices above ${pondNodes.length} ponds will include all available pond nodes.`);
}

// Compute fixed viewBox from the full extent (all nodes: context + all ponds)
const PAD = 30;
let fMinX = Infinity, fMinY = Infinity, fMaxX = -Infinity, fMaxY = -Infinity;
for (const node of [...contextNodes, ...pondNodes]) {
  const nx = node.position?.x ?? 0;
  const ny = node.position?.y ?? 0;
  const nw = node.style?.width ?? node.width ?? 0;
  const nh = node.style?.height ?? node.height ?? 0;
  if (nx < fMinX) fMinX = nx;
  if (ny < fMinY) fMinY = ny;
  if (nx + nw > fMaxX) fMaxX = nx + nw;
  if (ny + nh > fMaxY) fMaxY = ny + nh;
}
const fullViewBox = {
  x: fMinX - PAD,
  y: fMinY - PAD,
  width: fMaxX - fMinX + PAD * 2,
  height: fMaxY - fMinY + PAD * 2,
};
console.log(`Full viewBox: x=${fullViewBox.x.toFixed(0)} y=${fullViewBox.y.toFixed(0)} w=${fullViewBox.width.toFixed(0)} h=${fullViewBox.height.toFixed(0)}`);

// Ensure output directory exists
mkdirSync(OUT_DIR, { recursive: true });

// Generate one slice per step
const steps = [];
for (let n = 10; n <= 120; n += 2) steps.push(n);

for (const n of steps) {
  const sliceNodes = [...contextNodes, ...pondNodes.slice(0, n)];
  const slice = {
    name: master.name || "open-raceway-pond-facility",
    version: master.version ?? 2,
    nodes: sliceNodes,
    edges: master.edges || [],
    fullViewBox,
  };
  const outPath = join(OUT_DIR, `open-raceway-pond-facility-${n}.json`);
  writeFileSync(outPath, JSON.stringify(slice, null, 2), "utf8");
}

console.log(`Generated ${steps.length} slice files in ${OUT_DIR}`);

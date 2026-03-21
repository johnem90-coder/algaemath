// Shared section detection from diagram geometry
// Extracted from DiagramView.tsx for reuse by the diagram-driven TEA engine

export interface DiagramNodeGeometry {
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  data: {
    label: string;
    fillColor: string;
    borderColor: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
}

export interface SectionInfo {
  sectionId: string;
  containerId: string;
  containerBounds: { x: number; y: number; w: number; h: number };
  nodeIds: Set<string>;
}

/**
 * Detect sections from a diagram's node geometry.
 *
 * Sections are identified by:
 * 1. Label nodes matching "X Section" (e.g., "Inputs Section")
 * 2. Container rectangles: empty-label, transparent fill, visible border
 * 3. Label → container matching by proximity (label sits below container)
 * 4. Remaining nodes assigned by geometric containment in container bounds
 */
export function detectSections(nodes: DiagramNodeGeometry[]): {
  sections: SectionInfo[];
  nodeToSection: Map<string, string>;
} {
  const nodeToSection = new Map<string, string>();

  // 1. Find section labels: nodes whose label matches "X Section"
  const sectionLabels: { sectionId: string; node: DiagramNodeGeometry }[] = [];
  for (const n of nodes) {
    const m = n.data.label.match(/^(.+?)\s+Section$/);
    if (m) {
      const sid = m[1].toLowerCase();
      sectionLabels.push({ sectionId: sid, node: n });
      nodeToSection.set(n.id, sid);
    }
  }

  // 2. Find containers: empty-label, transparent fill, visible border
  const containers = nodes.filter(
    (n) => !n.data.label && n.data.fillColor === "transparent" && n.data.borderColor !== "none",
  );

  // 3. Match each label to its container (label sits at container bottom-left)
  const sections: SectionInfo[] = [];
  const usedContainers = new Set<string>();

  for (const sl of sectionLabels) {
    let best: DiagramNodeGeometry | null = null;
    let bestDist = Infinity;
    for (const c of containers) {
      if (usedContainers.has(c.id)) continue;
      const yDist = Math.abs(c.position.y + c.height - sl.node.position.y);
      const xDist = Math.abs(c.position.x - sl.node.position.x);
      const dist = yDist + xDist * 0.1;
      if (dist < bestDist && yDist < 50) {
        bestDist = dist;
        best = c;
      }
    }
    if (best) {
      usedContainers.add(best.id);
      nodeToSection.set(best.id, sl.sectionId);
      sections.push({
        sectionId: sl.sectionId,
        containerId: best.id,
        containerBounds: {
          x: best.position.x,
          y: best.position.y,
          w: best.width,
          h: best.height,
        },
        nodeIds: new Set([best.id, sl.node.id]),
      });
    }
  }

  // 4. Assign remaining nodes by geometric containment
  for (const n of nodes) {
    if (nodeToSection.has(n.id)) continue;
    const cx = n.position.x + n.width / 2;
    const cy = n.position.y + n.height / 2;
    for (const sec of sections) {
      const b = sec.containerBounds;
      if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
        nodeToSection.set(n.id, sec.sectionId);
        sec.nodeIds.add(n.id);
        break;
      }
    }
  }

  return { sections, nodeToSection };
}

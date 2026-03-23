import RectangleNode from "./RectangleNode";
import RoundedRectNode from "./RoundedRectNode";
import PillNode from "./PillNode";
import ChamferedRectNode from "./ChamferedRectNode";
import DiamondNode from "./DiamondNode";
import TriangleNode from "./TriangleNode";

export const nodeTypes = {
  rectangle: RectangleNode,
  roundedRect: RoundedRectNode,
  pill: PillNode,
  chamferedRect: ChamferedRectNode,
  diamond: DiamondNode,
  triangle: TriangleNode,
};

export type ShapeType = keyof typeof nodeTypes;

export const shapeDefaults: Record<ShapeType, { width: number; height: number }> = {
  rectangle: { width: 180, height: 60 },
  roundedRect: { width: 180, height: 60 },
  pill: { width: 180, height: 60 },
  chamferedRect: { width: 180, height: 60 },
  diamond: { width: 100, height: 100 },
  triangle: { width: 120, height: 100 },
};

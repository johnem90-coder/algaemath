import RectangleNode from "./RectangleNode";
import RoundedRectNode from "./RoundedRectNode";
import DiamondNode from "./DiamondNode";
import CircleNode from "./CircleNode";
import PillNode from "./PillNode";

export const nodeTypes = {
  rectangle: RectangleNode,
  roundedRect: RoundedRectNode,
  diamond: DiamondNode,
  circle: CircleNode,
  pill: PillNode,
};

export type ShapeType = keyof typeof nodeTypes;

export const shapeDefaults: Record<ShapeType, { width: number; height: number }> = {
  rectangle: { width: 180, height: 60 },
  roundedRect: { width: 180, height: 60 },
  diamond: { width: 120, height: 120 },
  circle: { width: 80, height: 80 },
  pill: { width: 200, height: 50 },
};

import { createContext } from "react";

export interface DiagramContextValue {
  snapGrid: number;
  onResizeStart: (nodeId: string, w: number, h: number) => void;
  onResizeDelta: (nodeId: string, dw: number, dh: number, primaryW: number, primaryH: number) => void;
}

export const DiagramContext = createContext<DiagramContextValue>({
  snapGrid: 10,
  onResizeStart: () => {},
  onResizeDelta: () => {},
});

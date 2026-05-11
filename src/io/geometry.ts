/**
 * Geometry helpers used by both the SVG renderer and the analysis engine path
 * extractor. Pure functions, no React or DOM.
 */

import { Position } from "@xyflow/react";

import { getSymbol } from "@/symbols/registry";
import type { DiagramNode } from "@/store/diagramStore";
import type { PortSide } from "@/types/diagram";

const SIDE_TO_POSITION: Record<PortSide, Position> = {
  top: Position.Top,
  bottom: Position.Bottom,
  left: Position.Left,
  right: Position.Right,
};

export function sideToPosition(side: PortSide): Position {
  return SIDE_TO_POSITION[side];
}

/**
 * Apply a clockwise 90° rotation to a port. The position fraction is flipped
 * on the two rotations that reverse the parameterisation of the new side so
 * that visually "the same end" of the symbol keeps the same handle.
 *
 * top    →  right (pos stays)
 * right  →  bottom (pos = 1 - pos)
 * bottom →  left   (pos = 1 - pos)
 * left   →  top    (pos stays)
 */
export function rotatePort(
  side: PortSide,
  position: number,
  rotationDeg: number,
): { side: PortSide; position: number } {
  const steps = (((Math.round(rotationDeg / 90) % 4) + 4) % 4) as 0 | 1 | 2 | 3;
  let s: PortSide = side;
  let p = position;
  for (let i = 0; i < steps; i++) {
    switch (s) {
      case "top":
        s = "right";
        break;
      case "right":
        s = "bottom";
        p = 1 - p;
        break;
      case "bottom":
        s = "left";
        p = 1 - p;
        break;
      case "left":
        s = "top";
        break;
    }
  }
  return { side: s, position: p };
}

export function portLocalXY(
  side: PortSide,
  position: number,
  width: number,
  height: number,
): { x: number; y: number } {
  switch (side) {
    case "top":
      return { x: width * position, y: 0 };
    case "bottom":
      return { x: width * position, y: height };
    case "left":
      return { x: 0, y: height * position };
    case "right":
      return { x: width, y: height * position };
  }
}

interface PortLookup {
  /** Absolute world position of the port (or node center as fallback). */
  x: number;
  y: number;
  side: PortSide;
  position: Position;
}

/**
 * Resolve the absolute coordinates of a node port. When `handleId` is null we
 * return the node center with no preferred side (used as a defensive fallback
 * for edges that don't reference a handle id).
 */
export function portWorldPosition(
  node: DiagramNode,
  handleId: string | null | undefined,
): PortLookup {
  const symbol = getSymbol(node.data.symbolType);
  const { width, height } = symbol?.size ?? { width: 64, height: 64 };
  const baseX = node.position.x;
  const baseY = node.position.y;

  if (handleId && symbol) {
    const port = symbol.ports.find((p) => p.id === handleId);
    if (port) {
      const rotation = (node.data.rotation as number | undefined) ?? 0;
      const rotated = rotatePort(port.side, port.position, rotation);
      const local = portLocalXY(
        rotated.side,
        rotated.position,
        width,
        height,
      );
      return {
        x: baseX + local.x,
        y: baseY + local.y,
        side: rotated.side,
        position: SIDE_TO_POSITION[rotated.side],
      };
    }
  }

  return {
    x: baseX + width / 2,
    y: baseY + height / 2,
    side: "right",
    position: Position.Right,
  };
}

/** Bounding box of all nodes in flow coordinates (incl. their dimensions). */
export function diagramBounds(nodes: DiagramNode[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const sym = getSymbol(node.data.symbolType);
    const w = sym?.size.width ?? 64;
    const h = sym?.size.height ?? 64;
    if (node.position.x < minX) minX = node.position.x;
    if (node.position.y < minY) minY = node.position.y;
    if (node.position.x + w > maxX) maxX = node.position.x + w;
    if (node.position.y + h > maxY) maxY = node.position.y + h;
  }
  return { minX, minY, maxX, maxY };
}

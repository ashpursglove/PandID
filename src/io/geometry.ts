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

/** Rotate a point around the node centre (same transform as the on-canvas symbol). */
export function rotateAroundNodeCenter(
  x: number,
  y: number,
  width: number,
  height: number,
  deg: number,
): { x: number; y: number } {
  const cx = width / 2;
  const cy = height / 2;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const ox = x - cx;
  const oy = y - cy;
  return {
    x: cos * ox - sin * oy + cx,
    y: sin * ox + cos * oy + cy,
  };
}

function flowPositionFromVector(dx: number, dy: number): Position {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? Position.Right : Position.Left;
  }
  return dy >= 0 ? Position.Bottom : Position.Top;
}

function portSideFromPosition(p: Position): PortSide {
  switch (p) {
    case Position.Top:
      return "top";
    case Position.Bottom:
      return "bottom";
    case Position.Left:
      return "left";
    case Position.Right:
      return "right";
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
      const local = portLocalXY(port.side, port.position, width, height);
      const rot = (node.data.rotation as number | undefined) ?? 0;
      const r = rotateAroundNodeCenter(local.x, local.y, width, height, rot);
      const wx = baseX + r.x;
      const wy = baseY + r.y;
      const cx = baseX + width / 2;
      const cy = baseY + height / 2;
      const pos = flowPositionFromVector(wx - cx, wy - cy);
      return {
        x: wx,
        y: wy,
        side: portSideFromPosition(pos),
        position: pos,
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

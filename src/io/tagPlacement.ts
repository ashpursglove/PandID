/**
 * Pick a tag/label side that avoids overlapping connection stubs and the
 * feeder/pipe paths that leave them. Counts ports per edge (after rotation)
 * and places the tag on the quietest side — preferring left, then right, top,
 * and only bottom when nothing else is free.
 */

import type { CSSProperties } from "react";

import { rotatePort } from "./geometry";
import type { PortSide } from "@/types/diagram";

export interface PortLike {
  side: PortSide;
  position: number;
}

const SIDE_PREF: PortSide[] = ["left", "right", "top", "bottom"];

/** Side of the symbol box where the tag should sit (outside the glyph). */
export function resolveTagSide(
  ports: PortLike[],
  rotationDeg = 0,
): PortSide {
  const counts: Record<PortSide, number> = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  };
  for (const port of ports) {
    const r = rotatePort(port.side, port.position, rotationDeg);
    counts[r.side]++;
  }
  let best: PortSide = "bottom";
  let bestCount = Infinity;
  for (const side of SIDE_PREF) {
    if (counts[side] < bestCount) {
      bestCount = counts[side];
      best = side;
    }
  }
  return best;
}

/** Tag position in the node's local coordinate space (same units as width/height). */
export function tagLocalCoords(
  side: PortSide,
  width: number,
  height: number,
  gap: number,
  fontSize: number,
): { x: number; y: number; anchor: "start" | "middle" | "end" } {
  const cx = width / 2;
  const cy = height / 2;
  switch (side) {
    case "left":
      return { x: -gap, y: cy + fontSize * 0.35, anchor: "end" };
    case "right":
      return { x: width + gap, y: cy + fontSize * 0.35, anchor: "start" };
    case "top":
      return { x: cx, y: -gap, anchor: "middle" };
    case "bottom":
      return { x: cx, y: height + fontSize + gap * 0.35, anchor: "middle" };
  }
}

/** Tag position in world coordinates before page scaling (mm or flow units). */
export function tagWorldCoords(
  side: PortSide,
  nodeX: number,
  nodeY: number,
  width: number,
  height: number,
  gap: number,
  fontSize: number,
): { x: number; y: number; anchor: "start" | "middle" | "end" } {
  const local = tagLocalCoords(side, width, height, gap, fontSize);
  return {
    x: nodeX + local.x,
    y: nodeY + local.y,
    anchor: local.anchor,
  };
}

/** Tag position on a scaled drawing sheet (mm SVG output). */
export function tagSvgCoords(
  side: PortSide,
  nodeX: number,
  nodeY: number,
  width: number,
  height: number,
  scale: number,
  offsetX: number,
  offsetY: number,
  fontSize: number,
  gapMm = 1.4,
): { x: number; y: number; anchor: "start" | "middle" | "end" } {
  const world = tagWorldCoords(
    side,
    nodeX,
    nodeY,
    width,
    height,
    gapMm,
    fontSize,
  );
  return {
    x: world.x * scale + offsetX,
    y: world.y * scale + offsetY,
    anchor: world.anchor,
  };
}

/** Absolute positioning for live editor node tags. */
export function tagEditorStyle(side: PortSide): CSSProperties {
  const base: CSSProperties = {
    pointerEvents: "none",
    position: "absolute",
    whiteSpace: "nowrap",
    fontSize: 11,
    fontWeight: 500,
    lineHeight: 1.2,
  };
  switch (side) {
    case "left":
      return {
        ...base,
        top: "50%",
        right: "100%",
        transform: "translateY(-50%)",
        paddingRight: 6,
        textAlign: "right",
      };
    case "right":
      return {
        ...base,
        top: "50%",
        left: "100%",
        transform: "translateY(-50%)",
        paddingLeft: 6,
        textAlign: "left",
      };
    case "top":
      return {
        ...base,
        bottom: "100%",
        left: "50%",
        transform: "translateX(-50%)",
        paddingBottom: 4,
        textAlign: "center",
      };
    case "bottom":
      return {
        ...base,
        top: "100%",
        left: "50%",
        transform: "translateX(-50%)",
        paddingTop: 4,
        textAlign: "center",
      };
  }
}

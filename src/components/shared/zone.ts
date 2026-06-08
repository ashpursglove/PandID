import type { Node } from "@xyflow/react";
import { nextNodeId } from "@/lib/ids";

/**
 * "Zones" are labelled rectangles the user drops behind the diagram to mark out
 * areas ("Pump room", "MCC", "Bioreactor hall", ...). They are ordinary React
 * Flow nodes with `type: "zone"`, so both the P&ID and electrical stores
 * persist, undo and capture them for free — they just carry a different `data`
 * shape and render behind everything else.
 *
 * The `symbolType: ""` keeps them invisible to the symbol registries (BOM,
 * auto-tag, analysis all skip an unknown/empty symbol type), while `isZone`
 * gives inspectors and renderers a cheap, explicit flag to branch on.
 */
export interface ZoneNodeData {
  [key: string]: unknown;
  symbolType: "";
  isZone: true;
  zoneLabel: string;
  zoneColor: string;
}

export type ZoneNode = Node<ZoneNodeData> & { type: "zone" };

export const ZONE_COLORS = [
  "#38bdf8", // sky
  "#34d399", // emerald
  "#f59e0b", // amber
  "#f472b6", // pink
  "#a78bfa", // violet
  "#f87171", // red
  "#94a3b8", // slate
] as const;

export const DEFAULT_ZONE_COLOR = ZONE_COLORS[0];

const DEFAULT_W = 320;
const DEFAULT_H = 220;

/** True for any node that is an area/zone rather than a real symbol. */
export function isZoneNode(node: {
  type?: string;
  data?: Record<string, unknown>;
}): boolean {
  return node.type === "zone" || node.data?.isZone === true;
}

/** Build a fresh zone node centred on `position`. */
export function createZoneNode(position: { x: number; y: number }): ZoneNode {
  return {
    id: nextNodeId(),
    type: "zone",
    position: { x: position.x - DEFAULT_W / 2, y: position.y - DEFAULT_H / 2 },
    width: DEFAULT_W,
    height: DEFAULT_H,
    // Sit behind real symbols so connections and equipment stay readable.
    zIndex: -1,
    data: {
      symbolType: "",
      isZone: true,
      zoneLabel: "Area",
      zoneColor: DEFAULT_ZONE_COLOR,
    },
  };
}

/**
 * Rendered px size of a node, matching how React Flow itself measures nodes:
 * it prefers the live-measured DOM size (`measured`) and only falls back to the
 * explicit `width`/`height` attributes. This matters for resized zones — the
 * NodeResizer's final commit updates `measured` but not always `width`/`height`,
 * so reading `width` alone makes a captured drawing's area box drift from what
 * the editor showed. Falls back to a sensible default when nothing is set yet.
 */
export function zoneBoxSize(
  node: {
    width?: number | null;
    height?: number | null;
    measured?: { width?: number | null; height?: number | null } | null;
  },
  fallbackW = 240,
  fallbackH = 160,
): { w: number; h: number } {
  const mW = node.measured?.width;
  const mH = node.measured?.height;
  const w =
    typeof mW === "number"
      ? mW
      : typeof node.width === "number"
        ? node.width
        : fallbackW;
  const h =
    typeof mH === "number"
      ? mH
      : typeof node.height === "number"
        ? node.height
        : fallbackH;
  return { w, h };
}

/** Hex (#rrggbb) → rgba() string with the given alpha. */
export function zoneRgba(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return hex;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

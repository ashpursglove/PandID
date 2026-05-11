/**
 * When the user drops an instrument near an existing process line, automatically:
 *   - insert a tap-point node at the closest point on the pipe
 *   - split the original pipe into two pipe edges (lengths divided proportionally)
 *   - connect the instrument's signal port to the tap with a pneumatic signal line
 *
 * This matches ISA-5.1 practice where an instrument bubble sits next to the
 * process line and connects via a thin signal line at a tap point.
 */

import type { DiagramEdge, DiagramNode } from "@/store/diagramStore";
import { getSymbol } from "@/symbols/registry";
import { portWorldPosition } from "@/io/geometry";
import type { PipeEdgeData } from "@/types/diagram";

const TAP_SIZE = 16;
/** Max distance (flow units) at which a dropped instrument auto-snaps to a pipe. */
export const TAP_THRESHOLD = 60;

interface Vec2 {
  x: number;
  y: number;
}

interface ClosestEdge {
  edge: DiagramEdge;
  point: Vec2;
  /** 0..1 parameter along the source→target straight line. */
  t: number;
  distance: number;
}

function closestPointOnSegment(p: Vec2, a: Vec2, b: Vec2): { t: number; point: Vec2; distance: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    const d = Math.hypot(p.x - a.x, p.y - a.y);
    return { t: 0, point: a, distance: d };
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const point = { x: a.x + t * dx, y: a.y + t * dy };
  return {
    t,
    point,
    distance: Math.hypot(p.x - point.x, p.y - point.y),
  };
}

export function findClosestProcessEdge(
  point: Vec2,
  edges: DiagramEdge[],
  nodes: DiagramNode[],
): ClosestEdge | null {
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  let best: ClosestEdge | null = null;
  for (const edge of edges) {
    const lineType = edge.data?.lineType ?? "process";
    if (lineType !== "process") continue;
    const src = nodesById.get(edge.source);
    const tgt = nodesById.get(edge.target);
    if (!src || !tgt) continue;
    const a = portWorldPosition(src, edge.sourceHandle);
    const b = portWorldPosition(tgt, edge.targetHandle);
    const hit = closestPointOnSegment(point, { x: a.x, y: a.y }, { x: b.x, y: b.y });
    if (!best || hit.distance < best.distance) {
      best = { edge, ...hit };
    }
  }
  return best;
}

/**
 * Build the set of changes to perform when attaching `instrument` to `edge`
 * at parameter `t`. The instrument node itself must already exist in
 * `instrument`. Returns null when the original edge has no source/target nodes.
 */
export function buildTapInsertion(args: {
  edge: DiagramEdge;
  tapAt: Vec2;
  tParam: number;
  instrument: DiagramNode;
  instrumentSignalHandle: string;
  newId: () => string;
}): {
  addNodes: DiagramNode[];
  addEdges: DiagramEdge[];
  removeEdges: string[];
} | null {
  const tap = getSymbol("tap-point");
  if (!tap) return null;
  const { edge, tapAt, tParam, instrument, instrumentSignalHandle, newId } = args;

  const tapNode: DiagramNode = {
    id: newId(),
    type: "symbol",
    position: { x: tapAt.x - TAP_SIZE / 2, y: tapAt.y - TAP_SIZE / 2 },
    data: { symbolType: "tap-point", label: "" },
  };

  const origData: PipeEdgeData = edge.data ?? {};
  const origPipe = origData.pipe ?? {};
  const lengthM = origPipe.lengthM ?? 1;
  const elevation = origPipe.elevationChangeM ?? 0;
  const fittings = origPipe.fittings ?? [];
  const lineType = origData.lineType ?? "process";

  const t = Math.max(0.05, Math.min(0.95, tParam));

  const e1: DiagramEdge = {
    id: newId(),
    type: "pipe",
    source: edge.source,
    sourceHandle: edge.sourceHandle ?? undefined,
    target: tapNode.id,
    targetHandle: "pipe-left",
    data: {
      lineType,
      tag: origData.tag,
      pipe: {
        ...origPipe,
        lengthM: lengthM * t,
        elevationChangeM: elevation * t,
        fittings,
      },
    },
  };

  const e2: DiagramEdge = {
    id: newId(),
    type: "pipe",
    source: tapNode.id,
    sourceHandle: "pipe-right",
    target: edge.target,
    targetHandle: edge.targetHandle ?? undefined,
    data: {
      lineType,
      pipe: {
        ...origPipe,
        lengthM: lengthM * (1 - t),
        elevationChangeM: elevation * (1 - t),
        fittings: [],
      },
    },
  };

  // Pick signal-top or signal-bottom based on which side of the pipe the
  // instrument was dropped on.
  const tapCentreY = tapAt.y;
  const instSymbol = getSymbol(instrument.data.symbolType);
  const instH = instSymbol?.size.height ?? 56;
  const instCentreY = instrument.position.y + instH / 2;
  const tapSignalHandle = instCentreY < tapCentreY ? "signal-top" : "signal-bottom";

  const signal: DiagramEdge = {
    id: newId(),
    type: "pipe",
    source: tapNode.id,
    sourceHandle: tapSignalHandle,
    target: instrument.id,
    targetHandle: instrumentSignalHandle,
    data: { lineType: "pneumatic" },
  };

  return {
    addNodes: [tapNode],
    addEdges: [e1, e2, signal],
    removeEdges: [edge.id],
  };
}

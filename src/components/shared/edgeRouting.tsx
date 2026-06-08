/**
 * Shared edge routing helpers used by both the P&ID pipe edges and the
 * electrical feeder edges.
 *
 * Two jobs:
 *  1. Let the user pin draggable "bend points" (waypoints) on a connection so
 *     they can arrange the drawing nicely. These are purely cosmetic — they do
 *     not change what the connection means electrically/hydraulically.
 *  2. Quietly straighten near-aligned connections so a tiny grid offset between
 *     two ports renders as a clean straight line instead of an ugly little
 *     dog-leg kink.
 */

import { memo, useCallback, useRef } from "react";
import {
  EdgeLabelRenderer,
  useReactFlow,
  type Position,
} from "@xyflow/react";

export interface RoutePoint {
  x: number;
  y: number;
}

/** Grid the dragged bend points snap to (matches the canvas snap grid). */
export const WAYPOINT_GRID = 5;

/**
 * Offsets within this distance (flow units) are treated as "aligned" and the
 * connection is drawn as a single straight line rather than a stepped path with
 * a tiny kink. A few px over a long run is visually indistinguishable from a
 * perfectly straight line, so this kills the jaggies the grid snap can leave.
 */
export const STRAIGHTEN_TOLERANCE = 6;

/**
 * How close (flow units) a dragged bend point must be to a neighbour's X or Y
 * before it locks onto that axis. This is what lets a line be pinned perfectly
 * horizontal or vertical even when the port it connects to sits off-grid.
 */
export const AXIS_SNAP = 9;

export function snapPoint(p: RoutePoint, grid = WAYPOINT_GRID): RoutePoint {
  return {
    x: Math.round(p.x / grid) * grid,
    y: Math.round(p.y / grid) * grid,
  };
}

/**
 * Lock a point onto a neighbour's axis when it's close enough, so the segment
 * joining them becomes exactly horizontal or vertical. Grid snapping runs
 * first; axis alignment then overrides a coordinate to the neighbour's exact
 * value (which may be off-grid, e.g. a busbar tap).
 */
export function alignToNeighbours(
  p: RoutePoint,
  neighbours: RoutePoint[],
): RoutePoint {
  let { x, y } = snapPoint(p);
  let bestDx = AXIS_SNAP;
  let bestDy = AXIS_SNAP;
  for (const n of neighbours) {
    const dx = Math.abs(p.x - n.x);
    const dy = Math.abs(p.y - n.y);
    if (dx <= bestDx) {
      bestDx = dx;
      x = n.x;
    }
    if (dy <= bestDy) {
      bestDy = dy;
      y = n.y;
    }
  }
  return { x, y };
}

function distance(a: RoutePoint, b: RoutePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(p: RoutePoint, a: RoutePoint, b: RoutePoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/**
 * Build an SVG path through a list of points with rounded corners at the
 * interior vertices, so manually-routed connections still look tidy.
 */
export function roundedPolylinePath(pts: RoutePoint[], radius: number): string {
  if (pts.length < 2) return "";
  if (pts.length === 2) {
    return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`;
  }
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    const len1 = distance(prev, cur);
    const len2 = distance(cur, next);
    const r = Math.min(radius, len1 / 2, len2 / 2);
    const v1 = { x: (prev.x - cur.x) / (len1 || 1), y: (prev.y - cur.y) / (len1 || 1) };
    const v2 = { x: (next.x - cur.x) / (len2 || 1), y: (next.y - cur.y) / (len2 || 1) };
    const p1 = { x: cur.x + v1.x * r, y: cur.y + v1.y * r };
    const p2 = { x: cur.x + v2.x * r, y: cur.y + v2.y * r };
    d += ` L ${p1.x.toFixed(2)},${p1.y.toFixed(2)} Q ${cur.x.toFixed(2)},${cur.y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x},${last.y}`;
  return d;
}

/** Midpoint of a polyline by arc length, used to anchor the edge label. */
function polylineMidpoint(pts: RoutePoint[]): RoutePoint {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return pts[0];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += distance(pts[i], pts[i + 1]);
  let target = total / 2;
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = distance(pts[i], pts[i + 1]);
    if (target <= seg) {
      const t = seg === 0 ? 0 : target / seg;
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * t,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * t,
      };
    }
    target -= seg;
  }
  return pts[Math.floor(pts.length / 2)];
}

export interface RouteArgs {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
}

type SmoothResult = [path: string, labelX: number, labelY: number, ...rest: number[]];
type SmoothFn = (args: RouteArgs) => SmoothResult;

/**
 * Resolve the SVG path + label anchor for an edge. When the edge has manual
 * waypoints, route straight through them. Otherwise straighten near-aligned
 * endpoints, falling back to the supplied smooth-step router.
 */
export function buildRoutedPath(
  args: RouteArgs,
  waypoints: RoutePoint[] | undefined,
  radius: number,
  smooth: SmoothFn,
): SmoothResult {
  if (waypoints && waypoints.length > 0) {
    const pts = [
      { x: args.sourceX, y: args.sourceY },
      ...waypoints,
      { x: args.targetX, y: args.targetY },
    ];
    const mid = polylineMidpoint(pts);
    return [roundedPolylinePath(pts, radius), mid.x, mid.y];
  }

  const dx = Math.abs(args.targetX - args.sourceX);
  const dy = Math.abs(args.targetY - args.sourceY);
  if (dx <= STRAIGHTEN_TOLERANCE || dy <= STRAIGHTEN_TOLERANCE) {
    const path = `M ${args.sourceX},${args.sourceY} L ${args.targetX},${args.targetY}`;
    return [
      path,
      (args.sourceX + args.targetX) / 2,
      (args.sourceY + args.targetY) / 2,
    ];
  }

  return smooth(args);
}

/** Per-node movement deltas between two node arrays (only moved nodes). */
export function nodeMoveDeltas<
  N extends { id: string; position: { x: number; y: number } },
>(prev: N[], next: N[]): Map<string, { dx: number; dy: number }> {
  const prevById = new Map(prev.map((n) => [n.id, n.position]));
  const out = new Map<string, { dx: number; dy: number }>();
  for (const n of next) {
    const p = prevById.get(n.id);
    if (!p) continue;
    const dx = n.position.x - p.x;
    const dy = n.position.y - p.y;
    if (dx !== 0 || dy !== 0) out.set(n.id, { dx, dy });
  }
  return out;
}

/**
 * Translate an edge's bend points when both of its endpoints move by the same
 * amount — i.e. the whole connection is being dragged as part of a selection.
 * If only one end moved (the user is reshaping a single connection) the points
 * stay put.
 */
export function shiftWaypointsForNodeMoves<
  E extends {
    source: string;
    target: string;
    data?: { waypoints?: RoutePoint[] };
  },
>(edges: E[], deltaById: Map<string, { dx: number; dy: number }>): E[] {
  if (deltaById.size === 0) return edges;
  let changed = false;
  const next = edges.map((e) => {
    const wps = e.data?.waypoints;
    if (!wps || wps.length === 0) return e;
    const ds = deltaById.get(e.source);
    const dt = deltaById.get(e.target);
    if (
      ds &&
      dt &&
      Math.abs(ds.dx - dt.dx) < 0.5 &&
      Math.abs(ds.dy - dt.dy) < 0.5
    ) {
      changed = true;
      return {
        ...e,
        data: {
          ...e.data,
          waypoints: wps.map((w) => ({ x: w.x + ds.dx, y: w.y + ds.dy })),
        },
      };
    }
    return e;
  });
  return changed ? next : edges;
}

/** Insert a new bend point into the segment nearest to `pt`. */
export function insertWaypoint(
  waypoints: RoutePoint[],
  source: RoutePoint,
  target: RoutePoint,
  pt: RoutePoint,
): RoutePoint[] {
  const pts = [source, ...waypoints, target];
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distanceToSegment(pt, pts[i], pts[i + 1]);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  const next = [...waypoints];
  next.splice(bestIdx, 0, pt);
  return next;
}

/**
 * Transparent fat path drawn over a selected edge that captures a double-click
 * to drop a new draggable bend point at the cursor.
 */
export function EdgeAddWaypointZone({
  path,
  selected,
  onAdd,
}: {
  path: string;
  selected: boolean;
  onAdd: (pt: RoutePoint) => void;
}) {
  const { screenToFlowPosition } = useReactFlow();
  if (!selected) return null;
  return (
    <path
      d={path}
      fill="none"
      stroke="transparent"
      strokeWidth={16}
      style={{ cursor: "copy" }}
      pointerEvents="stroke"
      onDoubleClick={(e) => {
        e.stopPropagation();
        const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        onAdd(snapPoint(p));
      }}
    />
  );
}

/** Draggable bend-point handles shown while an edge is selected. */
export const EdgeWaypoints = memo(function EdgeWaypoints({
  source,
  target,
  waypoints,
  selected,
  onChange,
}: {
  source: RoutePoint;
  target: RoutePoint;
  waypoints: RoutePoint[];
  selected: boolean;
  onChange: (next: RoutePoint[]) => void;
}) {
  if (!selected || waypoints.length === 0) return null;
  return (
    <EdgeLabelRenderer>
      {waypoints.map((wp, i) => {
        // Neighbours used for axis-snapping: the previous and next point along
        // the route (port at the ends, adjacent bend points in the middle).
        const prev = i === 0 ? source : waypoints[i - 1];
        const next = i === waypoints.length - 1 ? target : waypoints[i + 1];
        return (
          <WaypointDot
            key={i}
            x={wp.x}
            y={wp.y}
            neighbours={[prev, next]}
            onMove={(pt) => {
              const nextPts = [...waypoints];
              nextPts[i] = pt;
              onChange(nextPts);
            }}
            onRemove={() => onChange(waypoints.filter((_, j) => j !== i))}
          />
        );
      })}
    </EdgeLabelRenderer>
  );
});

function WaypointDot({
  x,
  y,
  neighbours,
  onMove,
  onRemove,
}: {
  x: number;
  y: number;
  neighbours: RoutePoint[];
  onMove: (pt: RoutePoint) => void;
  onRemove: () => void;
}) {
  const { screenToFlowPosition } = useReactFlow();
  const dragging = useRef(false);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      e.stopPropagation();
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      onMove(alignToNeighbours(p, neighbours));
    },
    [onMove, neighbours, screenToFlowPosition],
  );

  return (
    <div
      className="nodrag nopan"
      title="Drag to move · double-click to remove"
      style={{
        position: "absolute",
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        width: 11,
        height: 11,
        borderRadius: "9999px",
        background: "#7dd3fc",
        border: "1.5px solid #0c4a6e",
        boxShadow: "0 0 0 2px rgba(2,6,23,0.6)",
        cursor: "grab",
        pointerEvents: "all",
        touchAction: "none",
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        dragging.current = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => {
        dragging.current = false;
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
    />
  );
}

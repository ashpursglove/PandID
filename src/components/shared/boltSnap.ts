/**
 * Bolted "snap" connections shared by the P&ID and electrical canvases.
 *
 * A bolted join is a connection with no cable/pipe between the two parts — they
 * mount directly together (e.g. an ACB/MCCB bolted onto a distribution board's
 * bus, or a flange-mounted valve on a pump). In the data model it is just a
 * normal edge tagged "direct"; here we provide the pure geometry/graph helpers
 * the canvases use to:
 *   - work out where every port of a node sits in world space (after rotation),
 *   - find the closest port pair while a node is being dragged so we can snap
 *     and bolt it, and
 *   - walk a rigid "assembly" of parts joined by bolted edges so dragging one
 *     part drags the whole bolted group with it.
 *
 * Pure functions, no React/DOM — reused by both disciplines.
 */

import { portLocalXY, rotatePort } from "@/io/geometry";
import type { PortDef } from "@/types/diagram";

/** How close (world units) two ports must be before they snap-bolt. */
export const BOLT_SNAP_RADIUS = 16;

export interface BoltPort {
  handleId: string;
  x: number;
  y: number;
}

/** Minimal shape of a node needed to resolve its port world positions. */
export interface SnapNode {
  id: string;
  position: { x: number; y: number };
  rotation?: number;
  ports: PortDef[];
  size: { width: number; height: number };
}

/** World coordinates of every port of a node, accounting for its rotation. */
export function portWorldPoints(node: SnapNode): BoltPort[] {
  const { width, height } = node.size;
  const rotation = node.rotation ?? 0;
  return node.ports.map((p) => {
    const r = rotatePort(p.side, p.position, rotation);
    const local = portLocalXY(r.side, r.position, width, height);
    return {
      handleId: p.id,
      x: node.position.x + local.x,
      y: node.position.y + local.y,
    };
  });
}

export interface SnapCandidate {
  /** Handle on the dragged node that snaps. */
  fromHandle: string;
  toNodeId: string;
  /** Handle on the target node it snaps onto. */
  toHandle: string;
  /** Translation to apply to the dragged node so the two ports coincide. */
  dx: number;
  dy: number;
  /** World point where the two ports meet once snapped. */
  x: number;
  y: number;
  dist: number;
}

/**
 * Closest port pair between the dragged node and any other node within
 * `radius`, or null when nothing is near. Any port may snap to any other (the
 * nearest pair wins) so the gesture stays flexible.
 */
export function findSnap(
  dragged: SnapNode,
  others: SnapNode[],
  radius = BOLT_SNAP_RADIUS,
): SnapCandidate | null {
  const fromPts = portWorldPoints(dragged);
  if (fromPts.length === 0) return null;
  let best: SnapCandidate | null = null;
  for (const other of others) {
    if (other.id === dragged.id) continue;
    const toPts = portWorldPoints(other);
    for (const f of fromPts) {
      for (const tp of toPts) {
        const d = Math.hypot(f.x - tp.x, f.y - tp.y);
        if (d <= radius && (best === null || d < best.dist)) {
          best = {
            fromHandle: f.handleId,
            toNodeId: other.id,
            toHandle: tp.handleId,
            dx: tp.x - f.x,
            dy: tp.y - f.y,
            x: tp.x,
            y: tp.y,
            dist: d,
          };
        }
      }
    }
  }
  return best;
}

type DirectLink = { source: string; target: string };

function buildAdjacency(links: DirectLink[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const e of links) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source)!.push(e.target);
    adj.get(e.target)!.push(e.source);
  }
  return adj;
}

/**
 * Every node id reachable from `nodeId` over bolted (direct) edges, inclusive
 * of `nodeId` itself — i.e. the rigid assembly it belongs to.
 */
export function directAssembly(
  nodeId: string,
  directLinks: DirectLink[],
): Set<string> {
  const adj = buildAdjacency(directLinks);
  const seen = new Set<string>([nodeId]);
  const queue = [nodeId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const nb of adj.get(id) ?? []) {
      if (!seen.has(nb)) {
        seen.add(nb);
        queue.push(nb);
      }
    }
  }
  return seen;
}

/**
 * Rigid-assembly drag propagation. Given the node arrays before/after a React
 * Flow change plus the per-node movement deltas, translate every other member
 * of a moved node's bolted assembly by the same delta so the whole assembly
 * moves as one. Returns the adjusted nodes and a delta map augmented with the
 * propagated moves (so edge waypoints can be shifted to match).
 */
export function propagateDirectMoves<
  N extends { id: string; position: { x: number; y: number } },
>(
  next: N[],
  directLinks: DirectLink[],
  deltas: Map<string, { dx: number; dy: number }>,
): { nodes: N[]; deltas: Map<string, { dx: number; dy: number }> } {
  if (deltas.size === 0 || directLinks.length === 0) {
    return { nodes: next, deltas };
  }
  const adj = buildAdjacency(directLinks);
  const extra = new Map<string, { dx: number; dy: number }>();
  for (const [driverId, d] of deltas) {
    if (!adj.has(driverId)) continue;
    const seen = new Set<string>([driverId]);
    const queue = [driverId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      for (const nb of adj.get(id) ?? []) {
        if (seen.has(nb)) continue;
        seen.add(nb);
        queue.push(nb);
        // Don't override a node that is itself being dragged (it already moved)
        // or one a previous driver already claimed.
        if (!deltas.has(nb) && !extra.has(nb)) extra.set(nb, d);
      }
    }
  }
  if (extra.size === 0) return { nodes: next, deltas };
  const nodes = next.map((n) => {
    const e = extra.get(n.id);
    return e
      ? { ...n, position: { x: n.position.x + e.dx, y: n.position.y + e.dy } }
      : n;
  });
  const merged = new Map(deltas);
  for (const [id, d] of extra) merged.set(id, d);
  return { nodes, deltas: merged };
}

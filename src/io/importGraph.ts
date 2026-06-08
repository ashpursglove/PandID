/**
 * Merge-import helper. Takes a graph (nodes + edges) parsed from another save
 * file and prepares it to be dropped into the *current* diagram without landing
 * on top of what's already there: every part gets a fresh id, the whole group
 * is shifted to sit just above the existing content with a gap, edge waypoints
 * are shifted to match, and the imported parts come back pre-selected so the
 * user can immediately drag the group to wherever they want it.
 *
 * Pure and generic over the React Flow Node/Edge shapes, so the P&ID and SLD
 * stores share one implementation.
 */

import type { Edge, Node } from "@xyflow/react";

/** Fallback footprint for a node with no measured/explicit size. */
const DEFAULT_NODE_SIZE = 80;
/** Vertical breathing room left between imported parts and existing content. */
const IMPORT_GAP = 160;

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function sizeOf(n: Node): { w: number; h: number } {
  const w = n.measured?.width ?? (typeof n.width === "number" ? n.width : null);
  const h = n.measured?.height ?? (typeof n.height === "number" ? n.height : null);
  return { w: w ?? DEFAULT_NODE_SIZE, h: h ?? DEFAULT_NODE_SIZE };
}

function boundsOf(nodes: Node[]): Box | null {
  if (nodes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const { w, h } = sizeOf(n);
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + w);
    maxY = Math.max(maxY, n.position.y + h);
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Re-id and offset an imported graph so it sits above the existing nodes with a
 * gap. Returns the prepared nodes (selected) and edges (with remapped endpoints
 * and shifted waypoints) ready to be appended to the live arrays. When there is
 * nothing on the canvas yet the imported parts keep their original positions.
 */
export function prepareImportedGraph<N extends Node, E extends Edge>(
  existing: N[],
  importedNodes: N[],
  importedEdges: E[],
  newNodeId: () => string,
  newEdgeId: () => string,
  gap = IMPORT_GAP,
): { nodes: N[]; edges: E[] } {
  if (importedNodes.length === 0) return { nodes: [], edges: [] };

  const imp = boundsOf(importedNodes)!;
  let dx = 0;
  let dy = 0;
  const ex = boundsOf(existing);
  if (ex) {
    dx = ex.minX - imp.minX; // align the left edges
    dy = ex.minY - gap - imp.maxY; // float the group above existing content
  }

  const idMap = new Map<string, string>();
  const nodes = importedNodes.map((n) => {
    const id = newNodeId();
    idMap.set(n.id, id);
    return {
      ...n,
      id,
      position: { x: n.position.x + dx, y: n.position.y + dy },
      selected: true,
    } as N;
  });

  const edges = importedEdges
    .filter((e) => idMap.has(e.source) && idMap.has(e.target))
    .map((e) => {
      const data = e.data as
        | { waypoints?: { x: number; y: number }[] }
        | undefined;
      const waypoints = data?.waypoints?.map((w) => ({
        x: w.x + dx,
        y: w.y + dy,
      }));
      return {
        ...e,
        id: newEdgeId(),
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
        selected: false,
        ...(data
          ? { data: { ...data, ...(waypoints ? { waypoints } : {}) } }
          : {}),
      } as E;
    });

  return { nodes, edges };
}

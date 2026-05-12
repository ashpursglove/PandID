/**
 * Bridge from the diagram store's React Flow types into the engine's pure
 * graph types. Defaults are applied here so the engine can assume sane values.
 */

import type { DiagramEdge, DiagramNode } from "@/store/diagramStore";
import { getSymbol } from "@/symbols/registry";
import type { EngineModel } from "@/symbols/types";

import type { EngineGraph, EngineNode, EnginePipeEdge, PipeProps } from "./types";

const DEFAULT_PIPE: PipeProps = {
  lengthM: 1,
  innerDiameterMm: 50,
  roughnessMm: 0.045,
  elevationChangeM: 0,
  fittings: [],
};

/** Pipe size used by the K-based loss model when a component is dropped on
 *  the canvas without being wired to anything yet. Matches the sticky default
 *  pipe size (PVC DN50) so isolated previews still produce realistic numbers. */
const ORPHAN_CONNECTION_ID_MM = 50;

export function toEngineGraph(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): EngineGraph {
  const engineEdges: EnginePipeEdge[] = edges.map((e) => {
    const data = e.data ?? {};
    const userPipe = (data.pipe ?? {}) as Partial<PipeProps>;
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
      lineType: data.lineType ?? "process",
      pipe: { ...DEFAULT_PIPE, ...userPipe, fittings: userPipe.fittings ?? [] },
    };
  });

  const connectionIdMmByNode = computeConnectionIdMm(engineEdges);

  const engineNodes: EngineNode[] = nodes.map((n) => {
    const symbol = getSymbol(n.data.symbolType);
    return {
      id: n.id,
      symbolType: n.data.symbolType,
      engineModel: (symbol?.engineModel ?? "passive") as EngineModel,
      tag: n.data.tag ?? n.data.label,
      symbolLabel: symbol?.label,
      params: (n.data.params ?? {}) as Record<string, unknown>,
      connectionIdMm:
        connectionIdMmByNode.get(n.id) ?? ORPHAN_CONNECTION_ID_MM,
      hydraulics: symbol?.hydraulics,
    };
  });

  return { nodes: engineNodes, edges: engineEdges };
}

/**
 * For every node, pick the smallest inner diameter among the process pipes
 * connected to it. Using the smallest ID is the conservative "bottleneck"
 * choice: a valve straddling DN50→DN100 should size itself to the DN50 leg
 * (higher velocity → higher loss).
 */
function computeConnectionIdMm(
  edges: EnginePipeEdge[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of edges) {
    if (e.lineType !== "process") continue;
    const id = e.pipe.innerDiameterMm;
    if (!Number.isFinite(id) || id <= 0) continue;
    for (const nodeId of [e.source, e.target]) {
      const prev = out.get(nodeId);
      if (prev === undefined || id < prev) out.set(nodeId, id);
    }
  }
  return out;
}

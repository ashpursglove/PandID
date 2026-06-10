import { create } from "zustand";
import { temporal } from "zundo";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type Connection,
} from "@xyflow/react";

import type { ConnectionType, ElecEdgeData, ElecNodeData } from "@/electrical/types";
import { nextEdgeId, nextNodeId } from "@/lib/ids";
import {
  getElecSymbol,
  getNodePorts,
  getNodeSize,
} from "@/electrical/symbols/registry";
import { nextElecTag } from "@/electrical/symbols/autoTag";
import { defaultCableForConnection } from "@/electrical/symbols/cablePresets";
import {
  autoSizeCables as computeAutoSizedCables,
  type AutoSizeResult,
} from "@/electrical/analysis/autoSize";
import {
  nodeMoveDeltas,
  shiftWaypointsForNodeMoves,
} from "@/components/shared/edgeRouting";
import {
  directAssembly,
  portWorldPoints,
  propagateDirectMoves,
} from "@/components/shared/boltSnap";
import { prepareImportedGraph } from "@/io/importGraph";

export type ElecNode = Node<ElecNodeData>;
export type ElecEdge = Edge<ElecEdgeData>;

/** True for a bolted (direct, no-cable) connection. */
function isDirectEdge(e: ElecEdge): boolean {
  return (e.data?.connectionType ?? "lv-power") === "direct";
}

function directLinksOf(edges: ElecEdge[]): { source: string; target: string }[] {
  return edges
    .filter(isDirectEdge)
    .map((e) => ({ source: e.source, target: e.target }));
}

/** True for a board / busbar — the things components bolt onto. */
function isContainer(node: ElecNode): boolean {
  const m = getElecSymbol(node.data.symbolType)?.engineModel;
  return m === "board" || m === "busbar";
}

/** World coordinates of every port handle for a node, given a data payload. */
function portWorldMap(
  node: ElecNode,
  data: ElecNodeData,
): Map<string, { x: number; y: number }> {
  const symbol = getElecSymbol(data.symbolType);
  if (!symbol) return new Map();
  const pts = portWorldPoints({
    id: node.id,
    position: node.position,
    rotation: (data.rotation as number) ?? 0,
    ports: getNodePorts(symbol, data),
    size: getNodeSize(symbol, data),
  });
  return new Map(pts.map((p) => [p.handleId, { x: p.x, y: p.y }]));
}

interface ElecClipboard {
  nodes: ElecNode[];
  edges: ElecEdge[];
}

interface ElectricalState {
  nodes: ElecNode[];
  edges: ElecEdge[];

  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];

  clipboard: ElecClipboard | null;

  onNodesChange: (changes: NodeChange<ElecNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<ElecEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  onSelectionChange: (params: { nodes: ElecNode[]; edges: ElecEdge[] }) => void;

  focusElement: (nodeId?: string | null, edgeId?: string | null) => void;

  addNode: (node: ElecNode) => void;
  /** Snap a dragged node onto another's port and bolt them with a no-cable
   *  direct connection. Moves the dragged node's whole bolted assembly by
   *  (dx, dy) so the two ports coincide. */
  boltNodeTo: (
    draggedId: string,
    dx: number,
    dy: number,
    sourceHandle: string,
    targetNodeId: string,
    targetHandle: string,
  ) => void;
  /** Select a single edge (used by the bolted junction dot). */
  selectEdge: (id: string) => void;
  /** Delete one edge by id (used by the inspector's Unbolt action). */
  removeEdgeById: (id: string) => void;
  /** Break every direct (bolted) joint touching a node and nudge the node
   *  clear so the two parts visibly separate without deleting either. */
  unboltNode: (id: string) => void;
  updateNodeData: (id: string, patch: Partial<ElecNodeData>) => void;
  updateEdgeData: (id: string, patch: Partial<ElecEdgeData>) => void;
  rotateSelected: (deltaDeg: number) => void;
  /** Resize every power feeder's CSA (down or up) to the minimum that clears
   *  both overload errors and near-capacity warnings, and drop three-phase
   *  feeders to single-phase where nothing downstream needs three phases.
   *  Returns a summary of what changed. */
  autoSizeCables: () => AutoSizeResult;
  removeSelected: () => void;
  replaceAll: (nodes: ElecNode[], edges: ElecEdge[]) => void;
  /** Merge an imported SLD in above existing content, pre-selected so it can
   *  be dragged into place. */
  importGraph: (nodes: ElecNode[], edges: ElecEdge[]) => void;
  clear: () => void;

  copySelection: () => boolean;
  cutSelection: () => boolean;
  pasteClipboard: () => boolean;

  /** Active connection type stamped onto newly drawn feeders. */
  nextConnectionType: ConnectionType;
  setNextConnectionType: (t: ConnectionType) => void;
}

function debounceHistory<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  ms: number,
): (...args: TArgs) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: TArgs | null = null;
  return (...args: TArgs) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (lastArgs) fn(...lastArgs);
      lastArgs = null;
    }, ms);
  };
}

export const useElectricalStore = create<ElectricalState>()(
  temporal(
    (set, get) => ({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      clipboard: null,

      onNodesChange: (changes) => {
        const prev = get().nodes;
        const applied = applyNodeChanges(changes, prev);
        const baseDeltas = nodeMoveDeltas(prev, applied);
        // Bolted parts move as one rigid assembly: propagate a dragged node's
        // delta to everything reachable from it over direct edges.
        const { nodes, deltas } = propagateDirectMoves(
          applied,
          directLinksOf(get().edges),
          baseDeltas,
        );
        const edges = shiftWaypointsForNodeMoves(get().edges, deltas);
        set({ nodes, edges });
      },

      onEdgesChange: (changes) =>
        set({ edges: applyEdgeChanges(changes, get().edges) }),

      onConnect: (connection) => {
        const connectionType = get().nextConnectionType;
        const data: ElecEdgeData = { connectionType };

        // Inherit the cable spec from an existing same-type feeder already
        // attached to either endpoint, so wiring a device a second time keeps
        // whatever cable the user already set. Length is route-specific, so it
        // resets to 0 rather than being copied. Falls back to the type default.
        const existing = get().edges.find(
          (e) =>
            (e.data?.connectionType ?? "lv-power") === connectionType &&
            e.data?.cable &&
            (e.source === connection.source ||
              e.target === connection.source ||
              e.source === connection.target ||
              e.target === connection.target),
        );
        if (existing?.data?.cable) {
          data.cable = { ...existing.data.cable, lengthM: 0 };
        } else {
          data.cable = defaultCableForConnection(connectionType);
        }

        set({
          edges: addEdge<ElecEdge>(
            { ...connection, type: "feeder", data },
            get().edges,
          ),
        });
      },

      nextConnectionType: "lv-power",
      setNextConnectionType: (t) => set({ nextConnectionType: t }),

      onSelectionChange: ({ nodes, edges }) =>
        set({
          selectedNodeId: nodes[0]?.id ?? null,
          selectedEdgeId: edges[0]?.id ?? null,
          selectedNodeIds: nodes.map((n) => n.id),
          selectedEdgeIds: edges.map((e) => e.id),
        }),

      focusElement: (nodeId, edgeId) =>
        set({
          selectedNodeId: nodeId ?? null,
          selectedEdgeId: edgeId ?? null,
          selectedNodeIds: nodeId ? [nodeId] : [],
          selectedEdgeIds: edgeId ? [edgeId] : [],
        }),

      addNode: (node) => set({ nodes: [...get().nodes, node] }),

      boltNodeTo: (draggedId, dx, dy, sourceHandle, targetNodeId, targetHandle) => {
        const { nodes, edges } = get();
        const assembly = directAssembly(draggedId, directLinksOf(edges));
        const movedNodes =
          dx === 0 && dy === 0
            ? nodes
            : nodes.map((n) =>
                assembly.has(n.id)
                  ? {
                      ...n,
                      position: {
                        x: n.position.x + dx,
                        y: n.position.y + dy,
                      },
                    }
                  : n,
              );
        const exists = edges.some(
          (e) =>
            isDirectEdge(e) &&
            ((e.source === draggedId &&
              e.target === targetNodeId &&
              e.sourceHandle === sourceHandle &&
              e.targetHandle === targetHandle) ||
              (e.source === targetNodeId &&
                e.target === draggedId &&
                e.sourceHandle === targetHandle &&
                e.targetHandle === sourceHandle)),
        );
        const newEdge: ElecEdge = {
          id: nextEdgeId(),
          type: "feeder",
          source: draggedId,
          sourceHandle,
          target: targetNodeId,
          targetHandle,
          data: { connectionType: "direct" },
        };
        set({
          nodes: movedNodes,
          edges: exists ? edges : [...edges, newEdge],
        });
      },

      selectEdge: (id) =>
        set({
          nodes: get().nodes.map((n) =>
            n.selected ? { ...n, selected: false } : n,
          ),
          edges: get().edges.map((e) => ({ ...e, selected: e.id === id })),
          selectedNodeId: null,
          selectedNodeIds: [],
          selectedEdgeId: id,
          selectedEdgeIds: [id],
        }),

      removeEdgeById: (id) =>
        set({
          edges: get().edges.filter((e) => e.id !== id),
          selectedEdgeId: get().selectedEdgeId === id ? null : get().selectedEdgeId,
          selectedEdgeIds: get().selectedEdgeIds.filter((x) => x !== id),
        }),

      unboltNode: (id) => {
        const { nodes, edges } = get();
        const touching = edges.filter(
          (e) => isDirectEdge(e) && (e.source === id || e.target === id),
        );
        if (touching.length === 0) return;
        const gone = new Set(touching.map((e) => e.id));
        // Nudge the node down-right so it pops clear of its former partner.
        const OFFSET = 48;
        set({
          edges: edges.filter((e) => !gone.has(e.id)),
          nodes: nodes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  position: {
                    x: n.position.x + OFFSET,
                    y: n.position.y + OFFSET,
                  },
                }
              : n,
          ),
          selectedEdgeIds: get().selectedEdgeIds.filter((x) => !gone.has(x)),
          selectedEdgeId:
            get().selectedEdgeId && gone.has(get().selectedEdgeId!)
              ? null
              : get().selectedEdgeId,
        });
      },

      updateNodeData: (id, patch) => {
        const prevNodes = get().nodes;
        const target = prevNodes.find((n) => n.id === id);
        if (!target) return;
        const newData = { ...target.data, ...patch };
        let nodes = prevNodes.map((n) =>
          n.id === id ? { ...n, data: newData } : n,
        );

        // When a board/bus tap layout (count / spacing / drawn width) changes,
        // its port positions move — drag anything bolted onto those taps along
        // so the connected parts follow the taps instead of being left behind.
        if (isContainer(target) && patch.params) {
          const edges = get().edges;
          const before = portWorldMap(target, target.data);
          const after = portWorldMap(target, newData);
          const childMoves = new Map<string, { dx: number; dy: number }>();
          for (const e of edges) {
            if (!isDirectEdge(e)) continue;
            let childId: string | undefined;
            let handle: string | null | undefined;
            if (e.source === id) {
              childId = e.target;
              handle = e.sourceHandle;
            } else if (e.target === id) {
              childId = e.source;
              handle = e.targetHandle;
            } else continue;
            const b = before.get(handle ?? "");
            const a = after.get(handle ?? "");
            if (!b || !a) continue;
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            if (dx !== 0 || dy !== 0) childMoves.set(childId, { dx, dy });
          }
          if (childMoves.size > 0) {
            // Move each child's own bolted sub-assembly, but cut links through
            // the container so siblings on other taps aren't dragged too.
            const childLinks = directLinksOf(edges).filter(
              (l) => l.source !== id && l.target !== id,
            );
            const total = new Map<string, { dx: number; dy: number }>();
            for (const [childId, d] of childMoves) {
              for (const m of directAssembly(childId, childLinks)) {
                if (!total.has(m)) total.set(m, d);
              }
            }
            nodes = nodes.map((n) => {
              const d = total.get(n.id);
              return d
                ? {
                    ...n,
                    position: { x: n.position.x + d.dx, y: n.position.y + d.dy },
                  }
                : n;
            });
          }
        }

        set({ nodes });
      },

      updateEdgeData: (id, patch) =>
        set({
          edges: get().edges.map((e) =>
            e.id === id ? { ...e, data: { ...(e.data ?? {}), ...patch } } : e,
          ),
        }),

      rotateSelected: (deltaDeg) => {
        const { selectedNodeId, nodes } = get();
        if (!selectedNodeId) return;
        const node = nodes.find((n) => n.id === selectedNodeId);
        if (!node) return;
        const current = (node.data.rotation ?? 0) as number;
        const next = (((current + deltaDeg) % 360) + 360) % 360;
        set({
          nodes: nodes.map((n) =>
            n.id === selectedNodeId
              ? { ...n, data: { ...n.data, rotation: next } }
              : n,
          ),
        });
      },

      autoSizeCables: () => {
        const { nodes, edges } = get();
        const result = computeAutoSizedCables(nodes, edges);
        if (
          result.resized > 0 ||
          result.phaseReduced > 0 ||
          result.devicesResized > 0
        ) {
          set({ edges: result.edges, nodes: result.nodes });
        }
        return result;
      },

      removeSelected: () => {
        const { selectedNodeIds, selectedEdgeIds, nodes, edges } = get();
        if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) return;
        const killedNodeIds = new Set(selectedNodeIds);
        const killedEdgeIds = new Set(selectedEdgeIds);
        set({
          nodes: nodes.filter((n) => !killedNodeIds.has(n.id)),
          edges: edges.filter(
            (e) =>
              !killedEdgeIds.has(e.id) &&
              !killedNodeIds.has(e.source) &&
              !killedNodeIds.has(e.target),
          ),
          selectedNodeId: null,
          selectedEdgeId: null,
          selectedNodeIds: [],
          selectedEdgeIds: [],
        });
      },

      copySelection: () => {
        const { nodes, edges, selectedNodeIds, selectedEdgeIds } = get();
        if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) {
          return false;
        }
        const selectedSet = new Set(selectedNodeIds);
        const explicitEdges = new Set(selectedEdgeIds);
        const copiedNodes = nodes.filter((n) => selectedSet.has(n.id));
        const copiedEdges = edges.filter(
          (e) =>
            explicitEdges.has(e.id) ||
            (selectedSet.has(e.source) && selectedSet.has(e.target)),
        );
        set({ clipboard: { nodes: copiedNodes, edges: copiedEdges } });
        return true;
      },

      cutSelection: () => {
        const copied = get().copySelection();
        if (!copied) return false;
        get().removeSelected();
        return true;
      },

      pasteClipboard: () => {
        const { clipboard, nodes, edges } = get();
        if (!clipboard || clipboard.nodes.length === 0) return false;
        const offset = 30;
        const idMap = new Map<string, string>();
        const taggedSoFar: ElecNode[] = [...nodes];
        const newNodes: ElecNode[] = [];

        for (const src of clipboard.nodes) {
          const newId = nextNodeId();
          idMap.set(src.id, newId);
          const symbol = getElecSymbol(src.data.symbolType);
          const tag = symbol?.tagPrefix
            ? nextElecTag(symbol.tagPrefix, taggedSoFar)
            : undefined;
          const cloned: ElecNode = {
            ...src,
            id: newId,
            position: { x: src.position.x + offset, y: src.position.y + offset },
            selected: true,
            data: { ...src.data, tag },
          };
          newNodes.push(cloned);
          taggedSoFar.push(cloned);
        }

        const newEdges: ElecEdge[] = clipboard.edges
          .filter((e) => idMap.has(e.source) && idMap.has(e.target))
          .map((src) => ({
            ...src,
            id: nextEdgeId(),
            source: idMap.get(src.source)!,
            target: idMap.get(src.target)!,
            selected: false,
          }));

        set({
          nodes: [
            ...nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
            ...newNodes,
          ],
          edges: [
            ...edges.map((e) => (e.selected ? { ...e, selected: false } : e)),
            ...newEdges,
          ],
        });
        return true;
      },

      replaceAll: (nodes, edges) =>
        set({
          nodes,
          edges,
          selectedNodeId: null,
          selectedEdgeId: null,
          selectedNodeIds: [],
          selectedEdgeIds: [],
        }),

      importGraph: (incomingNodes, incomingEdges) => {
        const { nodes, edges } = get();
        const prepared = prepareImportedGraph(
          nodes,
          incomingNodes,
          incomingEdges,
          nextNodeId,
          nextEdgeId,
        );
        if (prepared.nodes.length === 0) return;
        set({
          nodes: [
            ...nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
            ...prepared.nodes,
          ],
          edges: [
            ...edges.map((e) => (e.selected ? { ...e, selected: false } : e)),
            ...prepared.edges,
          ],
          selectedNodeId: prepared.nodes[0]?.id ?? null,
          selectedNodeIds: prepared.nodes.map((n) => n.id),
          selectedEdgeId: null,
          selectedEdgeIds: [],
        });
      },

      clear: () =>
        set({
          nodes: [],
          edges: [],
          selectedNodeId: null,
          selectedEdgeId: null,
          selectedNodeIds: [],
          selectedEdgeIds: [],
        }),
    }),
    {
      partialize: (state) => ({ nodes: state.nodes, edges: state.edges }),
      limit: 100,
      handleSet: (handleSet) => debounceHistory(handleSet, 300),
    },
  ),
);

export function useElectricalHistory() {
  return useElectricalStore.temporal;
}

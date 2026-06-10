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

import type { LineType, PipeEdgeData, SymbolNodeData } from "@/types/diagram";
import { resolvePipePreset, type PipeMaterialId } from "@/presets/pipes";
import { nextEdgeId, nextNodeId } from "@/lib/ids";
import { nextTag } from "@/components/Canvas/autoTag";
import { getSymbol } from "@/symbols/registry";
import {
  nodeMoveDeltas,
  shiftWaypointsForNodeMoves,
} from "@/components/shared/edgeRouting";
import { directAssembly, propagateDirectMoves } from "@/components/shared/boltSnap";
import { prepareImportedGraph } from "@/io/importGraph";

export type DiagramNode = Node<SymbolNodeData>;
export type DiagramEdge = Edge<PipeEdgeData>;

/** True for a bolted (direct, no-pipe) connection. */
function isDirectEdge(e: DiagramEdge): boolean {
  return e.data?.direct === true;
}

function directLinksOf(edges: DiagramEdge[]): { source: string; target: string }[] {
  return edges
    .filter(isDirectEdge)
    .map((e) => ({ source: e.source, target: e.target }));
}

/**
 * Snapshot of nodes + connecting edges captured by copy/cut, ready to be
 * cloned into the live diagram by paste. Lives in-memory only — we don't
 * touch the OS clipboard because graph data doesn't survive a `text/plain`
 * round-trip and we don't want users pasting their diagram into Word.
 */
interface DiagramClipboard {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

interface DiagramState {
  nodes: DiagramNode[];
  edges: DiagramEdge[];

  /** First selected node/edge id — drives the single-pane inspector. */
  selectedNodeId: string | null;
  selectedEdgeId: string | null;

  /** Full multi-selection — drives copy/cut and the toolbar trash button. */
  selectedNodeIds: string[];
  selectedEdgeIds: string[];

  /** In-memory clipboard; null until the user copies something. */
  clipboard: DiagramClipboard | null;

  onNodesChange: (changes: NodeChange<DiagramNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<DiagramEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  onSelectionChange: (params: { nodes: DiagramNode[]; edges: DiagramEdge[] }) => void;

  addNode: (node: DiagramNode) => void;
  /** Atomic add nodes / add edges / remove edges (used for tap-point insertion). */
  applyChanges: (changes: {
    addNodes?: DiagramNode[];
    addEdges?: DiagramEdge[];
    removeEdges?: string[];
  }) => void;
  /** Snap a dragged node onto another's port and bolt them with a no-pipe
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
  updateNodeData: (id: string, patch: Partial<SymbolNodeData>) => void;
  updateEdgeData: (id: string, patch: Partial<PipeEdgeData>) => void;
  rotateSelected: (deltaDeg: number) => void;
  removeSelected: () => void;
  replaceAll: (nodes: DiagramNode[], edges: DiagramEdge[]) => void;
  /** Merge an imported graph in above existing content, pre-selected so it can
   *  be dragged into place. */
  importGraph: (nodes: DiagramNode[], edges: DiagramEdge[]) => void;
  clear: () => void;

  /** Clipboard operations. Return `true` if anything was copied/pasted. */
  copySelection: () => boolean;
  cutSelection: () => boolean;
  pasteClipboard: () => boolean;

  nextLineType: LineType;
  setNextLineType: (lineType: LineType) => void;

  /**
   * Sticky pipe preset applied to every new process line. Starts at PVC DN50
   * and updates whenever the user picks a different material/size in the
   * inspector, so the next line they draw inherits the same choice.
   */
  lastPipeMaterial: PipeMaterialId;
  lastPipeNominal: string;
  setLastPipePreset: (material: PipeMaterialId, nominal: string) => void;
}

/**
 * Coalesces rapid `set()` calls into a single zundo history entry. Without
 * this, every pixel of a node drag fires `onNodesChange` and gets recorded as
 * its own undo step — so Ctrl+Z reverts the diagram by one drag tick, which
 * is invisible to the user, and a single drag across the canvas exhausts the
 * 100-entry history limit. With it, a drag becomes one history entry, fired
 * ~300 ms after the user lets go.
 */
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

export const useDiagramStore = create<DiagramState>()(
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
        const lineType = get().nextLineType;
        const data: PipeEdgeData = { lineType };
        // Only process pipes carry hydraulic properties; utility/pneumatic
        // signal lines just need the line type.
        if (lineType === "process") {
          const m = get().lastPipeMaterial;
          const n = get().lastPipeNominal;
          const preset = resolvePipePreset(m, n);
          if (preset) {
            data.pipe = {
              innerDiameterMm: preset.innerDiameterMm,
              roughnessMm: preset.roughnessMm,
              presetMaterialId: m,
              presetNominalId: n,
              fittings: [],
              // length & elevation are deliberately left undefined so the
              // user is forced to enter the real route geometry.
            };
          }
        }
        set({
          edges: addEdge<DiagramEdge>(
            { ...connection, type: "pipe", data },
            get().edges,
          ),
        });
      },

      /**
       * Set by the UI before a connection is created so onConnect can stamp the
       * new edge with the active line type without a circular store dependency.
       */
      nextLineType: "process",
      setNextLineType: (lineType) => set({ nextLineType: lineType }),

      lastPipeMaterial: "pvc",
      lastPipeNominal: "dn50",
      setLastPipePreset: (material, nominal) =>
        set({ lastPipeMaterial: material, lastPipeNominal: nominal }),

      onSelectionChange: ({ nodes, edges }) =>
        set({
          selectedNodeId: nodes[0]?.id ?? null,
          selectedEdgeId: edges[0]?.id ?? null,
          selectedNodeIds: nodes.map((n) => n.id),
          selectedEdgeIds: edges.map((e) => e.id),
        }),

      addNode: (node) => set({ nodes: [...get().nodes, node] }),

      applyChanges: ({ addNodes, addEdges, removeEdges }) => {
        const removed = new Set(removeEdges ?? []);
        set({
          nodes: addNodes?.length
            ? [...get().nodes, ...addNodes]
            : get().nodes,
          edges: [
            ...get().edges.filter((e) => !removed.has(e.id)),
            ...(addEdges ?? []),
          ],
        });
      },

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
                      position: { x: n.position.x + dx, y: n.position.y + dy },
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
        const newEdge: DiagramEdge = {
          id: nextEdgeId(),
          type: "pipe",
          source: draggedId,
          sourceHandle,
          target: targetNodeId,
          targetHandle,
          data: { direct: true },
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

      updateNodeData: (id, patch) =>
        set({
          nodes: get().nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
          ),
        }),

      updateEdgeData: (id, patch) =>
        set({
          edges: get().edges.map((e) =>
            e.id === id
              ? { ...e, data: { ...(e.data ?? {}), ...patch } }
              : e,
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

      /**
       * Remove every selected node and every selected edge in one operation.
       * Also removes any edge incident on a selected node, otherwise the
       * graph is left with dangling references. Works whether the user has
       * a single thing selected (toolbar trash button) or a marquee
       * multi-selection.
       */
      removeSelected: () => {
        const { selectedNodeIds, selectedEdgeIds, nodes, edges } = get();
        if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) {
          return;
        }
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
            // Keep any explicitly-selected edge.
            explicitEdges.has(e.id) ||
            // Plus any edge whose *both* endpoints are in the selection — that
            // way a copied subgraph keeps its internal wiring. Edges with one
            // endpoint outside the selection would dangle on paste, so drop
            // them silently.
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

      /**
       * Paste the clipboard back into the diagram with:
       *  - fresh IDs (so paste-three-times doesn't collide),
       *  - positions offset by +30/+30 so the pasted copy is visible,
       *  - tags re-issued per the auto-tag convention (P-101 → P-102 etc.),
       *  - the previously selected stuff de-selected and the new stuff
       *    selected, matching every other graphical editor.
       */
      pasteClipboard: () => {
        const state = get();
        const { clipboard, nodes, edges } = state;
        if (!clipboard || clipboard.nodes.length === 0) {
          return false;
        }
        const offset = 30;

        // Work in two passes so newly-pasted nodes participate in auto-tag
        // lookup as we paginate through them — otherwise pasting three
        // identical pumps gives them all the same suggested tag.
        const idMap = new Map<string, string>();
        const taggedSoFar: DiagramNode[] = [...nodes];
        const newNodes: DiagramNode[] = [];

        for (const src of clipboard.nodes) {
          const newId = nextNodeId();
          idMap.set(src.id, newId);

          // Re-issue the tag if the symbol has a tag prefix; otherwise drop
          // it so duplicated pumps don't both claim P-101.
          const symbol = getSymbol(src.data.symbolType);
          const tag = symbol?.tagPrefix
            ? nextTag(symbol.tagPrefix, taggedSoFar)
            : undefined;

          const cloned: DiagramNode = {
            ...src,
            id: newId,
            position: {
              x: src.position.x + offset,
              y: src.position.y + offset,
            },
            selected: true,
            data: {
              ...src.data,
              tag,
            },
          };
          newNodes.push(cloned);
          taggedSoFar.push(cloned);
        }

        const newEdges: DiagramEdge[] = clipboard.edges
          // Only keep edges whose endpoints were both pasted; orphan edges
          // would dangle. (We already filtered to internal edges in
          // `copySelection`, but a stale clipboard from before a deletion
          // might still leak through.)
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
            ...nodes.map((n) =>
              n.selected ? { ...n, selected: false } : n,
            ),
            ...newNodes,
          ],
          edges: [
            ...edges.map((e) =>
              e.selected ? { ...e, selected: false } : e,
            ),
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
      // Only track diagram geometry/data in history, not transient selection
      // or the clipboard. Otherwise pressing Ctrl+C registers as an undoable
      // event, which is the kind of thing that makes me hate software.
      partialize: (state) => ({ nodes: state.nodes, edges: state.edges }),
      limit: 100,
      // Coalesce rapid changes (mid-drag, mid-resize) into a single history
      // step ~300 ms after the user stops moving. See `debounceHistory` above.
      handleSet: (handleSet) => debounceHistory(handleSet, 300),
    },
  ),
);

/** Convenience hook for the temporal API (undo/redo/clear). */
export function useDiagramHistory() {
  return useDiagramStore.temporal;
}

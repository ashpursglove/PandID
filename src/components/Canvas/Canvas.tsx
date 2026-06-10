import { useCallback, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  useReactFlow,
  type OnSelectionChangeParams,
  type Node as RFNode,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useShallow } from "zustand/react/shallow";

import {
  useDiagramStore,
  type DiagramEdge,
  type DiagramNode,
} from "@/store/diagramStore";
import { getSymbol } from "@/symbols/registry";
import { SymbolNode } from "@/components/Canvas/SymbolNode";
import { PipeEdge } from "@/components/Canvas/PipeEdge";
import { SendCurrentViewButton } from "@/components/Canvas/SendCurrentViewButton";
import { SendBomButton } from "@/components/Canvas/SendBomButton";
import { ZoneNode } from "@/components/shared/ZoneNode";
import { AddZoneButton } from "@/components/shared/AddZoneButton";
import {
  BOLT_SNAP_RADIUS,
  findSnap,
  type SnapCandidate,
  type SnapNode,
} from "@/components/shared/boltSnap";
import { BoltSnapIndicator } from "@/components/shared/BoltSnapIndicator";
import { DRAG_DATA_TYPE } from "@/components/Palette/dragMime";
import { nextTag } from "@/components/Canvas/autoTag";
import {
  TAP_THRESHOLD,
  buildTapInsertion,
  findClosestProcessEdge,
} from "@/components/Canvas/tapInsertion";
import { nextId, nextNodeId } from "@/lib/ids";
import { cn } from "@/lib/utils";

interface CanvasProps {
  className?: string;
}

const nodeTypes: NodeTypes = { symbol: SymbolNode, zone: ZoneNode };
const edgeTypes: EdgeTypes = { pipe: PipeEdge };

/** Resolve a node's ports + size into the geometry the snapper needs. */
function pidSnapNode(n: DiagramNode): SnapNode | null {
  if (n.type !== "symbol") return null;
  const symbol = getSymbol(n.data.symbolType);
  if (!symbol) return null;
  return {
    id: n.id,
    position: n.position,
    rotation: (n.data.rotation as number) ?? 0,
    ports: symbol.ports,
    size: symbol.size,
  };
}

export function Canvas({ className }: CanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const [snap, setSnap] = useState<SnapCandidate | null>(null);

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onSelectionChange,
    addNode,
    applyChanges,
    boltNodeTo,
  } = useDiagramStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      onNodesChange: s.onNodesChange,
      onEdgesChange: s.onEdgesChange,
      onConnect: s.onConnect,
      onSelectionChange: s.onSelectionChange,
      addNode: s.addNode,
      applyChanges: s.applyChanges,
      boltNodeTo: s.boltNodeTo,
    })),
  );

  // While a component is dragged, look for the nearest port on another node it
  // can bolt onto (no pipe). Shows a highlight ring; commits on drop.
  const computeSnap = useCallback((dragged: RFNode): SnapCandidate | null => {
    const dn = pidSnapNode(dragged as DiagramNode);
    if (!dn) return null;
    const others = useDiagramStore
      .getState()
      .nodes.map(pidSnapNode)
      .filter((x): x is SnapNode => x !== null && x.id !== dragged.id);
    return findSnap(dn, others, BOLT_SNAP_RADIUS);
  }, []);

  const onNodeDrag = useCallback(
    (_: unknown, node: RFNode) => setSnap(computeSnap(node)),
    [computeSnap],
  );

  const onNodeDragStop = useCallback(
    (_: unknown, node: RFNode) => {
      const cand = computeSnap(node);
      setSnap(null);
      if (cand) {
        boltNodeTo(
          node.id,
          cand.dx,
          cand.dy,
          cand.fromHandle,
          cand.toNodeId,
          cand.toHandle,
        );
      }
    },
    [computeSnap, boltNodeTo],
  );

  const handleSelection = useCallback(
    (params: OnSelectionChangeParams) => {
      onSelectionChange({
        nodes: params.nodes as DiagramNode[],
        edges: params.edges as DiagramEdge[],
      });
    },
    [onSelectionChange],
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const symbolType = event.dataTransfer.getData(DRAG_DATA_TYPE);
      if (!symbolType) return;
      const symbol = getSymbol(symbolType);
      if (!symbol) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Centre the symbol on the drop point.
      position.x -= symbol.size.width / 2;
      position.y -= symbol.size.height / 2;

      const tag = symbol.tagPrefix
        ? nextTag(symbol.tagPrefix, useDiagramStore.getState().nodes)
        : undefined;

      const node: DiagramNode = {
        id: nextNodeId(),
        type: "symbol",
        position,
        data: {
          symbolType,
          tag,
          label: symbol.defaultLabel,
          params: { ...(symbol.defaultParams ?? {}) },
        },
      };

      // If this is an instrument dropped near a process pipe, auto-attach by
      // splitting the pipe and inserting a tap point.
      if (symbol.category === "instrument") {
        const state = useDiagramStore.getState();
        const instCentre = {
          x: position.x + symbol.size.width / 2,
          y: position.y + symbol.size.height / 2,
        };
        const hit = findClosestProcessEdge(instCentre, state.edges, state.nodes);
        if (hit && hit.distance <= TAP_THRESHOLD) {
          const signalHandle = symbol.ports[0]?.id ?? "signal";
          const insertion = buildTapInsertion({
            edge: hit.edge,
            tapAt: hit.point,
            tParam: hit.t,
            instrument: node,
            instrumentSignalHandle: signalHandle,
            newId: () => nextId("auto"),
          });
          if (insertion) {
            applyChanges({
              addNodes: [node, ...insertion.addNodes],
              addEdges: insertion.addEdges,
              removeEdges: insertion.removeEdges,
            });
            return;
          }
        }
      }

      addNode(node);
    },
    [addNode, applyChanges, screenToFlowPosition],
  );

  const defaultEdgeOptions = useMemo(
    () => ({ type: "pipe" as const }),
    [],
  );

  return (
    <div
      ref={wrapperRef}
      className={cn("relative h-full w-full bg-[var(--color-canvas)]", className)}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionMode={ConnectionMode.Loose}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onSelectionChange={handleSelection}
        fitView
        minZoom={0.1}
        maxZoom={4}
        snapToGrid
        snapGrid={[5, 5]}
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <BoltSnapIndicator candidate={snap} />
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          maskColor="rgba(0,0,0,0.6)"
          nodeColor={() => "#52525b"}
        />
      </ReactFlow>
      <AddZoneButton onAdd={(node) => addNode(node as unknown as DiagramNode)} />
      <SendCurrentViewButton />
      <SendBomButton />
    </div>
  );
}

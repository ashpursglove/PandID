import { useCallback, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  useReactFlow,
  type OnSelectionChangeParams,
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
import { DRAG_DATA_TYPE } from "@/components/Palette/dragMime";
import { nextTag } from "@/components/Canvas/autoTag";
import {
  TAP_THRESHOLD,
  buildTapInsertion,
  findClosestProcessEdge,
} from "@/components/Canvas/tapInsertion";
import { cn } from "@/lib/utils";

interface CanvasProps {
  className?: string;
}

const nodeTypes: NodeTypes = { symbol: SymbolNode };
const edgeTypes: EdgeTypes = { pipe: PipeEdge };

let idCounter = 0;
function nextId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}
function nextNodeId() {
  return nextId("n");
}

export function Canvas({ className }: CanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onSelectionChange,
    addNode,
    applyChanges,
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
    })),
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
        onSelectionChange={handleSelection}
        fitView
        snapToGrid
        snapGrid={[10, 10]}
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Backspace", "Delete"]}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          maskColor="rgba(0,0,0,0.6)"
          nodeColor={() => "#52525b"}
        />
      </ReactFlow>
    </div>
  );
}

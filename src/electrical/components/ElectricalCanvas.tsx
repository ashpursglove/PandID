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
  useElectricalStore,
  type ElecEdge,
  type ElecNode,
} from "@/electrical/store/electricalStore";
import {
  getElecSymbol,
  getNodePorts,
  getNodeSize,
} from "@/electrical/symbols/registry";
import { ElectricalSymbolNode } from "./ElectricalSymbolNode";
import { FeederEdge } from "./FeederEdge";
import { SendSldViewButton } from "./SendSldViewButton";
import { AutoSizeButton } from "./AutoSizeButton";
import { ZoneNode } from "@/components/shared/ZoneNode";
import { AddZoneButton } from "@/components/shared/AddZoneButton";
import {
  BOLT_SNAP_RADIUS,
  findSnap,
  type SnapCandidate,
  type SnapNode,
} from "@/components/shared/boltSnap";
import { BoltSnapIndicator } from "@/components/shared/BoltSnapIndicator";
import { ELEC_DRAG_DATA_TYPE } from "./dragMime";
import { nextElecTag } from "@/electrical/symbols/autoTag";
import { nextNodeId } from "@/lib/ids";
import { cn } from "@/lib/utils";

/** Resolve a node's live ports + size into the geometry the snapper needs. */
function elecSnapNode(n: ElecNode): SnapNode | null {
  if (n.type !== "symbol") return null;
  const symbol = getElecSymbol(n.data.symbolType);
  if (!symbol) return null;
  return {
    id: n.id,
    position: n.position,
    rotation: (n.data.rotation as number) ?? 0,
    ports: getNodePorts(symbol, n.data),
    size: getNodeSize(symbol, n.data),
  };
}

interface CanvasProps {
  className?: string;
}

const nodeTypes: NodeTypes = { symbol: ElectricalSymbolNode, zone: ZoneNode };
const edgeTypes: EdgeTypes = { feeder: FeederEdge };

export function ElectricalCanvas({ className }: CanvasProps) {
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
    boltNodeTo,
  } = useElectricalStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      onNodesChange: s.onNodesChange,
      onEdgesChange: s.onEdgesChange,
      onConnect: s.onConnect,
      onSelectionChange: s.onSelectionChange,
      addNode: s.addNode,
      boltNodeTo: s.boltNodeTo,
    })),
  );

  // While a component is dragged, look for the nearest port on another node it
  // can bolt onto (no cable). Shows a highlight ring; commits on drop.
  const computeSnap = useCallback((dragged: RFNode): SnapCandidate | null => {
    const dn = elecSnapNode(dragged as ElecNode);
    if (!dn) return null;
    const others = useElectricalStore
      .getState()
      .nodes.map(elecSnapNode)
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
        nodes: params.nodes as ElecNode[],
        edges: params.edges as ElecEdge[],
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
      const symbolType = event.dataTransfer.getData(ELEC_DRAG_DATA_TYPE);
      if (!symbolType) return;
      const symbol = getElecSymbol(symbolType);
      if (!symbol) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      position.x -= symbol.size.width / 2;
      position.y -= symbol.size.height / 2;

      const tag = symbol.tagPrefix
        ? nextElecTag(symbol.tagPrefix, useElectricalStore.getState().nodes)
        : undefined;

      const node: ElecNode = {
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
      addNode(node);
    },
    [addNode, screenToFlowPosition],
  );

  const defaultEdgeOptions = useMemo(() => ({ type: "feeder" as const }), []);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative h-full w-full bg-[var(--color-canvas)]",
        className,
      )}
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
      <AddZoneButton onAdd={(node) => addNode(node as unknown as ElecNode)} />
      <SendSldViewButton />
      <AutoSizeButton />
    </div>
  );
}

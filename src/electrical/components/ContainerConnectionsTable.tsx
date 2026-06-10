import { useCallback, useMemo, useRef } from "react";
import { useReactFlow } from "@xyflow/react";

import { useElectricalStore } from "@/electrical/store/electricalStore";
import { buildBoltTableRows } from "@/electrical/analysis/boltTable";

/**
 * "Connections" schedule for a board / busbar: every component bolted onto it,
 * listed in a compact, draggable table instead of piling each tag on top of the
 * symbols. Rendered as a child of the node DOM (so pointer events always reach
 * it) and only mounted for container nodes, so the nodes/edges subscription cost
 * stays on the few boards/buses rather than every symbol.
 */
export function ContainerConnectionsTable({
  nodeId,
  defaultX,
}: {
  nodeId: string;
  defaultX: number;
}) {
  const nodes = useElectricalStore((s) => s.nodes);
  const edges = useElectricalStore((s) => s.edges);
  const updateNodeData = useElectricalStore((s) => s.updateNodeData);
  const { screenToFlowPosition } = useReactFlow();
  const last = useRef<{ x: number; y: number } | null>(null);

  const rows = useMemo(
    () => buildBoltTableRows(nodeId, nodes, edges),
    [nodeId, nodes, edges],
  );

  const offset = useMemo(() => {
    const data = nodes.find((n) => n.id === nodeId)?.data;
    return data?.boltTableOffset ?? { x: defaultX, y: 0 };
  }, [nodes, nodeId, defaultX]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!last.current) return;
      e.stopPropagation();
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      updateNodeData(nodeId, {
        boltTableOffset: {
          x: offset.x + (p.x - last.current.x),
          y: offset.y + (p.y - last.current.y),
        },
      });
      last.current = p;
    },
    [screenToFlowPosition, updateNodeData, nodeId, offset.x, offset.y],
  );

  if (rows.length === 0) return null;

  return (
    <div
      className="nodrag nopan"
      style={{
        pointerEvents: "auto",
        position: "absolute",
        left: offset.x,
        top: offset.y,
        width: 168,
        borderRadius: 4,
        overflow: "hidden",
        border: "1px solid #3f3f46",
        background: "rgba(9,9,11,0.96)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
        fontSize: 7,
        lineHeight: 1.25,
        color: "#e4e4e7",
        userSelect: "none",
        zIndex: 5,
      }}
    >
      <div
        onPointerDown={(e) => {
          e.stopPropagation();
          last.current = screenToFlowPosition({ x: e.clientX, y: e.clientY });
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => {
          last.current = null;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "3px 5px",
          background: "#18181b",
          borderBottom: "1px solid #3f3f46",
          fontWeight: 600,
          cursor: "grab",
          touchAction: "none",
        }}
        title="Drag to reposition"
      >
        <span style={{ opacity: 0.6 }}>⠿</span>
        <span>Connections</span>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ color: "#a1a1aa" }}>
            <Th>Way</Th>
            <Th>Tag</Th>
            <Th>Type</Th>
            <Th>Rating</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderTop: "1px solid #27272a" }}>
              <Td>{r.tap}</Td>
              <Td>{r.tag}</Td>
              <Td>{r.type}</Td>
              <Td>{r.rating}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ textAlign: "left", padding: "2px 5px", fontWeight: 600 }}>
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "2px 5px", verticalAlign: "top" }}>{children}</td>;
}

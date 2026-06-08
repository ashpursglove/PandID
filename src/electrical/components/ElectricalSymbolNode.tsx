import { memo, useEffect } from "react";
import {
  Handle,
  Position,
  useUpdateNodeInternals,
  type NodeProps,
} from "@xyflow/react";

import {
  getElecSymbol,
  getNodePorts,
  getNodeSize,
} from "@/electrical/symbols/registry";
import { rotatePort } from "@/io/geometry";
import { resolveTagSide, tagEditorStyle } from "@/io/tagPlacement";
import type { PortSide } from "@/types/diagram";
import { useElectricalStore, type ElecNode } from "@/electrical/store/electricalStore";
import { isBoltedChild } from "@/electrical/analysis/boltTable";
import { useNodeIssue } from "./issuesContext";
import { ContainerConnectionsTable } from "./ContainerConnectionsTable";
import { cn } from "@/lib/utils";

const SIDE_TO_POSITION: Record<PortSide, Position> = {
  top: Position.Top,
  bottom: Position.Bottom,
  left: Position.Left,
  right: Position.Right,
};

function handleOffset(
  side: PortSide,
  position: number,
  width: number,
  height: number,
) {
  switch (side) {
    case "top":
    case "bottom":
      return { left: width * position };
    case "left":
    case "right":
      return { top: height * position };
  }
}

export const ElectricalSymbolNode = memo(function ElectricalSymbolNode({
  id,
  data,
  selected,
}: NodeProps<ElecNode>) {
  const symbol = getElecSymbol(data.symbolType);
  const updateNodeInternals = useUpdateNodeInternals();
  const rotation = data.rotation ?? 0;
  const issue = useNodeIssue(id);
  // Bolted onto a board/bus? Its tag lives in that parent's schedule table, so
  // hide it here to stop the labels piling up on top of each other.
  const tagInTable = useElectricalStore((s) => isBoltedChild(id, s.nodes, s.edges));

  const ports = symbol ? getNodePorts(symbol, data) : [];
  // Live size — busbars / boards grow with their tap count so attached glyphs
  // never overlap.
  const size = symbol ? getNodeSize(symbol, data) : { width: 64, height: 64 };
  // A stable key for the live port set + size so React Flow re-reads the handle
  // geometry whenever rotation changes, taps are added/removed, or the symbol
  // resizes.
  const portsKey =
    ports.map((p) => `${p.id}:${p.side}:${p.position}`).join("|") +
    `#${size.width}x${size.height}`;

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, rotation, portsKey, updateNodeInternals]);

  if (!symbol) {
    return (
      <div className="rounded border border-red-500 bg-red-950 px-2 py-1 text-xs text-red-100">
        Unknown symbol: {data.symbolType}
      </div>
    );
  }

  const { Icon } = symbol;
  const label = data.tag ?? data.label ?? symbol.defaultLabel ?? "";
  const tagSide = resolveTagSide(ports, rotation);
  const isContainer =
    symbol.engineModel === "board" || symbol.engineModel === "busbar";

  return (
    <div
      className={cn(
        "group relative",
        selected && "drop-shadow-[0_0_6px_rgba(125,211,252,0.6)]",
        issue === "error" && "elec-node-throb-error",
        issue === "warning" && "elec-node-throb-warn",
      )}
      style={{ width: size.width, height: size.height }}
    >
      <div
        className="pointer-events-none absolute left-0 top-0"
        style={{
          width: size.width,
          height: size.height,
          transform: `rotate(${rotation}deg)`,
          transformOrigin: "center center",
        }}
      >
        <Icon width={size.width} height={size.height} selected={selected} />
      </div>

      {ports.map((port) => {
        const r = rotatePort(port.side, port.position, rotation);
        return (
          <Handle
            key={port.id}
            id={port.id}
            type="source"
            position={SIDE_TO_POSITION[r.side]}
            style={{
              ...handleOffset(r.side, r.position, size.width, size.height),
              width: 8,
              height: 8,
              background: selected ? "#7dd3fc" : "#71717a",
              border: "1px solid #18181b",
            }}
          />
        );
      })}

      {label && !tagInTable && (
        <span
          className="text-zinc-300"
          style={tagEditorStyle(tagSide)}
        >
          {label}
        </span>
      )}

      {isContainer && (
        <ContainerConnectionsTable nodeId={id} defaultX={size.width + 16} />
      )}
    </div>
  );
});

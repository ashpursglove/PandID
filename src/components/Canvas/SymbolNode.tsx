import { memo, useEffect } from "react";
import {
  Handle,
  Position,
  useUpdateNodeInternals,
  type NodeProps,
} from "@xyflow/react";

import { getSymbol } from "@/symbols/registry";
import type { PortSide } from "@/types/diagram";
import type { DiagramNode } from "@/store/diagramStore";
import { cn } from "@/lib/utils";

const SIDE_TO_POSITION: Record<PortSide, Position> = {
  top: Position.Top,
  bottom: Position.Bottom,
  left: Position.Left,
  right: Position.Right,
};

function portStyle(side: PortSide, position: number, width: number, height: number) {
  switch (side) {
    case "top":
    case "bottom":
      return { left: width * position };
    case "left":
    case "right":
      return { top: height * position };
  }
}

export const SymbolNode = memo(function SymbolNode({
  id,
  data,
  selected,
}: NodeProps<DiagramNode>) {
  const symbol = getSymbol(data.symbolType);
  const updateNodeInternals = useUpdateNodeInternals();
  const rotation = data.rotation ?? 0;

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, rotation, updateNodeInternals]);

  if (!symbol) {
    return (
      <div className="rounded border border-red-500 bg-red-950 px-2 py-1 text-xs text-red-100">
        Unknown symbol: {data.symbolType}
      </div>
    );
  }

  const { Icon, size, ports } = symbol;
  const label = data.tag ?? data.label ?? symbol.defaultLabel ?? "";

  return (
    <div
      className={cn(
        "group relative",
        selected && "drop-shadow-[0_0_6px_rgba(125,211,252,0.6)]",
      )}
      style={{ width: size.width, height: size.height }}
    >
      <div
        className="relative"
        style={{
          width: size.width,
          height: size.height,
          transform: `rotate(${rotation}deg)`,
          transformOrigin: "center center",
        }}
      >
        <div
          className="pointer-events-none absolute left-0 top-0"
          style={{ width: size.width, height: size.height }}
        >
          <Icon width={size.width} height={size.height} selected={selected} />
        </div>

        {ports.map((port) => (
          <Handle
            key={port.id}
            id={port.id}
            type="source"
            position={SIDE_TO_POSITION[port.side]}
            style={{
              ...portStyle(port.side, port.position, size.width, size.height),
              width: 8,
              height: 8,
              background: selected ? "#7dd3fc" : "#71717a",
              border: "1px solid #18181b",
            }}
          />
        ))}
      </div>

      {label && (
        <span className="pointer-events-none absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-medium text-zinc-300">
          {label}
        </span>
      )}
    </div>
  );
});

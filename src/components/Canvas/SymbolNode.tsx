import { memo, useEffect } from "react";
import {
  Handle,
  Position,
  useUpdateNodeInternals,
  type NodeProps,
} from "@xyflow/react";

import { getSymbol } from "@/symbols/registry";
import { rotatePort } from "@/io/geometry";
import type { PortSide } from "@/types/diagram";
import type { DiagramNode } from "@/store/diagramStore";
import { cn } from "@/lib/utils";

const SIDE_TO_POSITION: Record<PortSide, Position> = {
  top: Position.Top,
  bottom: Position.Bottom,
  left: Position.Left,
  right: Position.Right,
};

/**
 * Translate the discrete (side, fraction) port location into an absolute style
 * offset against the *unrotated* outer container. Only the side parallel to the
 * edge supplies an offset; the perpendicular axis is pinned by React Flow's
 * built-in handle CSS class (`react-flow__handle-top` / -right / etc.).
 */
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

export const SymbolNode = memo(function SymbolNode({
  id,
  data,
  selected,
}: NodeProps<DiagramNode>) {
  const symbol = getSymbol(data.symbolType);
  const updateNodeInternals = useUpdateNodeInternals();
  const rotation = data.rotation ?? 0;

  // Whenever rotation flips, re-measure handle positions so existing edges
  // re-route to the new geometry.
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
      {/*
        Icon spins inside its own wrapper so the SVG content matches the
        rotation visually; the outer container stays axis-aligned so the
        handles below live in the same coordinate space React Flow measures
        against.
      */}
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

      {/*
        Handles render in the unrotated outer box at their *post-rotation*
        coordinates. Passing the rotated `Position` is critical: it both
        positions the handle on the correct edge via React Flow's built-in
        handle CSS classes AND tells the smooth-step edge router which
        direction the pipe should leave.
      */}
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

      {label && (
        <span className="pointer-events-none absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-medium text-zinc-300">
          {label}
        </span>
      )}
    </div>
  );
});

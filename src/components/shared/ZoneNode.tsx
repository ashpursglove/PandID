import { memo } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";

import { DEFAULT_ZONE_COLOR, zoneRgba } from "./zone";

/**
 * Renders an area/zone box: a translucent, dashed rectangle with a label tab.
 * The body is `pointer-events: none` so clicks fall through to the symbols
 * sitting inside the area — you grab the zone by its label tab or resize it
 * from the edge handles (shown only while selected).
 */
function ZoneNodeImpl({ data, selected }: NodeProps) {
  const label = (data.zoneLabel as string | undefined) ?? "";
  const color = (data.zoneColor as string | undefined) ?? DEFAULT_ZONE_COLOR;

  return (
    <>
      <NodeResizer
        color={color}
        isVisible={!!selected}
        minWidth={120}
        minHeight={80}
        handleStyle={{ width: 8, height: 8, borderRadius: 2 }}
      />
      <div
        style={{
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          border: `1.5px dashed ${color}`,
          borderRadius: 6,
          background: zoneRgba(color, selected ? 0.1 : 0.06),
          boxShadow: selected ? `inset 0 0 0 1px ${zoneRgba(color, 0.35)}` : "none",
        }}
      >
        <div
          style={{
            pointerEvents: "auto",
            position: "absolute",
            top: -11,
            left: 8,
            maxWidth: "calc(100% - 16px)",
            padding: "1px 8px",
            borderRadius: 4,
            background: color,
            color: "#0b0f17",
            fontSize: 11,
            fontWeight: 600,
            lineHeight: "20px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            cursor: "grab",
            fontFamily: "Inter, Helvetica, Arial, sans-serif",
          }}
        >
          {label || "Area"}
        </div>
      </div>
    </>
  );
}

export const ZoneNode = memo(ZoneNodeImpl);

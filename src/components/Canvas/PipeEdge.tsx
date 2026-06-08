import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";

import { LINE_STYLES } from "@/symbols/lines/lineStyles";
import { useDiagramStore, type DiagramEdge } from "@/store/diagramStore";
import {
  buildRoutedPath,
  EdgeAddWaypointZone,
  EdgeWaypoints,
  insertWaypoint,
  type RouteArgs,
} from "@/components/shared/edgeRouting";

export const PipeEdge = memo(function PipeEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
  style: extraStyle,
}: EdgeProps<DiagramEdge>) {
  const lineType = data?.lineType ?? "process";
  const lineStyle = LINE_STYLES[lineType];

  const updateEdgeData = useDiagramStore((s) => s.updateEdgeData);
  const selectEdge = useDiagramStore((s) => s.selectEdge);

  // Bolted (direct) join: the two ports coincide and there's no pipe, so draw a
  // junction dot instead of a routed line. Clicking it selects the edge so
  // Delete (or the inspector's Unbolt) detaches it.
  if (data?.direct) {
    const cx = (sourceX + targetX) / 2;
    const cy = (sourceY + targetY) / 2;
    return (
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          title="Bolted connection (no pipe) — select and press Delete, or use Unbolt, to detach"
          onClick={(ev) => {
            ev.stopPropagation();
            selectEdge(id);
          }}
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${cx}px, ${cy}px)`,
            width: selected ? 14 : 10,
            height: selected ? 14 : 10,
            borderRadius: "9999px",
            background: selected ? "#7dd3fc" : "#cbd5e1",
            border: "2px solid #0f172a",
            boxShadow: "0 0 0 2px rgba(2,6,23,0.55)",
            cursor: "pointer",
            pointerEvents: "all",
          }}
        />
      </EdgeLabelRenderer>
    );
  }

  const waypoints = data?.waypoints ?? [];
  const routeArgs: RouteArgs = {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  };

  const [path, labelX, labelY] = buildRoutedPath(
    routeArgs,
    waypoints,
    18,
    (a) =>
      getSmoothStepPath({
        sourceX: a.sourceX,
        sourceY: a.sourceY,
        targetX: a.targetX,
        targetY: a.targetY,
        sourcePosition: a.sourcePosition,
        targetPosition: a.targetPosition,
        borderRadius: 18,
      }),
  );

  // Caller-supplied style (e.g. the analysis route preview) can override the
  // computed stroke / width / opacity for dimming or highlighting.
  const stroke =
    (extraStyle?.stroke as string | undefined) ??
    (selected ? "#7dd3fc" : lineStyle.stroke);
  const strokeWidth =
    (extraStyle?.strokeWidth as number | undefined) ??
    (lineStyle.strokeWidth ?? 2) + (selected ? 0.5 : 0);

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke,
          strokeWidth,
          strokeDasharray: lineStyle.strokeDasharray,
          fill: "none",
          ...extraStyle,
        }}
      />
      {/* Pneumatic-style hash overlay: stroke a dashed copy with short on/long off */}
      {lineStyle.pattern === "hash" && (
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth + 4}
          strokeDasharray="1 12"
          strokeLinecap="butt"
          style={{ opacity: extraStyle?.opacity }}
        />
      )}
      <EdgeAddWaypointZone
        path={path}
        selected={!!selected}
        onAdd={(pt) =>
          updateEdgeData(id, {
            waypoints: insertWaypoint(
              waypoints,
              { x: sourceX, y: sourceY },
              { x: targetX, y: targetY },
              pt,
            ),
          })
        }
      />
      <EdgeWaypoints
        source={{ x: sourceX, y: sourceY }}
        target={{ x: targetX, y: targetY }}
        waypoints={waypoints}
        selected={!!selected}
        onChange={(next) => updateEdgeData(id, { waypoints: next })}
      />
      {data?.tag && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded bg-zinc-900/90 px-1.5 py-0.5 text-[10px] text-zinc-200 ring-1 ring-zinc-700"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {data.tag}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

import { memo, useCallback, useRef } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";

import { CONNECTION_STYLES } from "@/electrical/symbols/connectionStyles";
import { cableSpecLabel } from "@/electrical/symbols/cablePresets";
import { specLabelOffset as resolveSpecOffset } from "@/electrical/symbols/edgeLabels";
import { feederCenter } from "@/electrical/symbols/feederRouting";
import { nodePhase, powerFeederPhase, PHASE1_EDITOR } from "@/electrical/symbols/phase";
import { useElectricalStore, type ElecEdge } from "@/electrical/store/electricalStore";
import {
  buildRoutedPath,
  EdgeAddWaypointZone,
  EdgeWaypoints,
  insertWaypoint,
  type RouteArgs,
} from "@/components/shared/edgeRouting";
import { useEdgeIssue } from "./issuesContext";

export const FeederEdge = memo(function FeederEdge({
  id,
  source,
  target,
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
}: EdgeProps<ElecEdge>) {
  const connectionType = data?.connectionType ?? "lv-power";
  const lineStyle = CONNECTION_STYLES[connectionType];

  const updateEdgeData = useElectricalStore((s) => s.updateEdgeData);
  const selectEdge = useElectricalStore((s) => s.selectEdge);
  // Single-phase feeders read green. We resolve phase from the two endpoint
  // components (a feeder to a single-phase motor is single-phase) and fall back
  // to the cable construction.
  const srcPhase = useElectricalStore((s) =>
    nodePhase(s.nodes.find((n) => n.id === source)),
  );
  const tgtPhase = useElectricalStore((s) =>
    nodePhase(s.nodes.find((n) => n.id === target)),
  );
  const phase = powerFeederPhase(connectionType, data?.cable?.presetId, [
    srcPhase,
    tgtPhase,
  ]);
  // Index of this edge in the store, used to pick a unique routing offset so
  // adjacent feeders separate instead of overlapping.
  const edgeIndex = useElectricalStore((s) =>
    s.edges.findIndex((e) => e.id === id),
  );
  const issue = useEdgeIssue(id);

  // Bolted (direct) join: the two ports coincide and there's no cable, so draw
  // a draggable-free junction dot instead of a routed line. Clicking it selects
  // the edge so Delete (or the inspector's Unbolt) detaches it.
  if (connectionType === "direct") {
    const cx = (sourceX + targetX) / 2;
    const cy = (sourceY + targetY) / 2;
    return (
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          title="Bolted connection (no cable) — select and press Delete, or use Unbolt, to detach"
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
    (a) => {
      const { centerX, centerY } = feederCenter(
        a.sourceX,
        a.sourceY,
        a.targetX,
        a.targetY,
        edgeIndex,
      );
      return getSmoothStepPath({
        sourceX: a.sourceX,
        sourceY: a.sourceY,
        targetX: a.targetX,
        targetY: a.targetY,
        sourcePosition: a.sourcePosition,
        targetPosition: a.targetPosition,
        borderRadius: 18,
        centerX,
        centerY,
      });
    },
  );

  const issueStroke =
    issue === "error" ? "#f87171" : issue === "warning" ? "#fbbf24" : undefined;

  const phaseStroke = phase === 1 ? PHASE1_EDITOR : lineStyle.stroke;
  const stroke =
    issueStroke ??
    (extraStyle?.stroke as string | undefined) ??
    (selected ? "#7dd3fc" : phaseStroke);
  const strokeWidth =
    (extraStyle?.strokeWidth as number | undefined) ??
    (lineStyle.strokeWidth ?? 2) + (selected ? 0.5 : 0) + (issue ? 1 : 0);

  const specLabel = data?.showSpec ? cableSpecLabel(data?.cable) : "";

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        className={issue ? "elec-edge-throb" : undefined}
        style={{
          stroke,
          strokeWidth,
          strokeDasharray: issue ? undefined : lineStyle.strokeDasharray,
          fill: "none",
          ...extraStyle,
          ...(issueStroke ? { stroke: issueStroke } : {}),
        }}
      />
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
      {(data?.tag || specLabel) && (
        <EdgeLabelRenderer>
          {data?.tag && (
            <div
              className="pointer-events-none absolute"
              style={{
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              }}
            >
              <span className="rounded bg-zinc-900/90 px-1.5 py-0.5 text-[10px] text-zinc-200 ring-1 ring-zinc-700">
                {data.tag}
              </span>
            </div>
          )}
          {specLabel && (
            <DraggableCableSpecLabel
              edgeId={id}
              label={specLabel}
              centerX={labelX}
              centerY={labelY}
              offset={data?.specLabelOffset}
              hasTag={!!data?.tag}
            />
          )}
        </EdgeLabelRenderer>
      )}
    </>
  );
});

function DraggableCableSpecLabel({
  edgeId,
  label,
  centerX,
  centerY,
  offset,
  hasTag,
}: {
  edgeId: string;
  label: string;
  centerX: number;
  centerY: number;
  offset?: { x: number; y: number };
  hasTag: boolean;
}) {
  const updateEdgeData = useElectricalStore((s) => s.updateEdgeData);
  const { screenToFlowPosition } = useReactFlow();
  const last = useRef<{ x: number; y: number } | null>(null);
  const pos = resolveSpecOffset(hasTag, offset);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!last.current) return;
      e.stopPropagation();
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      updateEdgeData(edgeId, {
        specLabelOffset: {
          x: pos.x + (p.x - last.current.x),
          y: pos.y + (p.y - last.current.y),
        },
      });
      last.current = p;
    },
    [edgeId, pos.x, pos.y, screenToFlowPosition, updateEdgeData],
  );

  return (
    <div
      className="nodrag nopan absolute"
      style={{
        transform: `translate(-50%, -50%) translate(${centerX + pos.x}px, ${centerY + pos.y}px)`,
      }}
    >
      <span
        title="Drag to reposition"
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
        className="inline-flex cursor-grab items-center gap-1 whitespace-nowrap rounded bg-sky-950/90 px-1.5 py-0.5 text-[9px] text-sky-200 ring-1 ring-sky-800 active:cursor-grabbing"
        style={{ touchAction: "none", pointerEvents: "all" }}
      >
        <span style={{ opacity: 0.55 }} aria-hidden>
          ⠿
        </span>
        {label}
      </span>
    </div>
  );
}

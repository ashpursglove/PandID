import { useMemo } from "react";
import { getSmoothStepPath } from "@xyflow/react";

import { getSymbol } from "@/symbols/registry";
import { LINE_STYLES } from "@/symbols/lines/lineStyles";
import { extractPath, NoPathError } from "@/engine/path";
import { toEngineGraph } from "@/engine/adapter";
import { diagramBounds, portWorldPosition } from "@/io/geometry";
import type { DiagramEdge, DiagramNode } from "@/store/diagramStore";

interface RoutePreviewProps {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  startId?: string;
  endId?: string;
}

const PREVIEW_HEIGHT_PX = 208; // matches Tailwind's h-52

/**
 * Read-only snapshot of the P&ID rendered as a single SVG. The route between
 * the user's start/end picks is drawn in amber and everything else dimmed,
 * giving a quick sanity check that "From" → "To" traces the intended path
 * before they hit Solve. Doing this as a pure SVG (rather than a second
 * `<ReactFlow>` instance) sidesteps the per-instance measurement lifecycle
 * which left edges with degenerate geometry on first paint.
 */
export function RoutePreview({
  nodes,
  edges,
  startId,
  endId,
}: RoutePreviewProps) {
  const { pathNodeIds, pathEdgeIds, hasPath, pathError } = useMemo(() => {
    const empty = {
      pathNodeIds: new Set<string>(),
      pathEdgeIds: new Set<string>(),
      hasPath: false,
      pathError: null as string | null,
    };
    if (!startId || !endId || startId === endId) return empty;
    try {
      const g = toEngineGraph(nodes, edges);
      const path = extractPath(g, startId, endId);
      return {
        pathNodeIds: new Set(path.map((s) => s.node.id)),
        pathEdgeIds: new Set(
          path.filter((s) => s.edge).map((s) => s.edge!.id),
        ),
        hasPath: true,
        pathError: null,
      };
    } catch (e) {
      return {
        ...empty,
        pathError:
          e instanceof NoPathError
            ? e.message
            : "Couldn't trace a route between those two components.",
      };
    }
  }, [nodes, edges, startId, endId]);

  const layout = useMemo(() => {
    if (nodes.length === 0) return null;
    const b = diagramBounds(nodes);
    const pad = 32;
    const minX = b.minX - pad;
    const minY = b.minY - pad;
    const width = Math.max(1, b.maxX - b.minX + 2 * pad);
    const height = Math.max(1, b.maxY - b.minY + 2 * pad);
    return { minX, minY, width, height };
  }, [nodes]);

  const nodesById = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes],
  );

  return (
    <section className="border-b border-zinc-800 bg-[var(--color-panel)] p-3">
      <header className="mb-1.5 flex items-baseline justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Selected route
        </h3>
        <p className="text-[10px] text-zinc-500">
          {hasPath ? (
            <>
              <span className="mr-2 inline-flex items-center gap-1">
                <span className="inline-block h-0.5 w-3 bg-[#fbbf24]" /> on route
              </span>
              <span className="inline-flex items-center gap-1 opacity-60">
                <span className="inline-block h-0.5 w-3 bg-zinc-500" /> rest of P&amp;ID
              </span>
            </>
          ) : startId && endId ? (
            <span className="text-amber-300">
              {pathError ?? "No path found."}
            </span>
          ) : (
            <span>Pick a From and To to see the route.</span>
          )}
        </p>
      </header>
      <div
        className="relative w-full overflow-hidden rounded border border-zinc-800 bg-[var(--color-canvas)]"
        style={{ height: PREVIEW_HEIGHT_PX }}
      >
        {!layout ? (
          <div className="flex h-full items-center justify-center text-[12px] text-zinc-500">
            Nothing to preview yet — draw a P&amp;ID first.
          </div>
        ) : (
          <svg
            width="100%"
            height="100%"
            viewBox={`${layout.minX} ${layout.minY} ${layout.width} ${layout.height}`}
            preserveAspectRatio="xMidYMid meet"
            className="text-zinc-200"
          >
            <defs>
              <pattern
                id="route-preview-dots"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="1" cy="1" r="0.75" fill="#27272a" />
              </pattern>
              <filter id="route-preview-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feColorMatrix
                  in="blur"
                  type="matrix"
                  values="0 0 0 0 0.984
                          0 0 0 0 0.749
                          0 0 0 0 0.141
                          0 0 0 1.4 0"
                  result="amberGlow"
                />
                <feMerge>
                  <feMergeNode in="amberGlow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <rect
              x={layout.minX}
              y={layout.minY}
              width={layout.width}
              height={layout.height}
              fill="url(#route-preview-dots)"
            />

            <g>
              {edges.map((e) => (
                <PreviewEdge
                  key={e.id}
                  edge={e}
                  nodesById={nodesById}
                  hasPath={hasPath}
                  onPath={pathEdgeIds.has(e.id)}
                />
              ))}
            </g>

            <g>
              {nodes.map((n) => (
                <PreviewNode
                  key={n.id}
                  node={n}
                  hasPath={hasPath}
                  onPath={pathNodeIds.has(n.id)}
                  isEndpoint={n.id === startId || n.id === endId}
                />
              ))}
            </g>
          </svg>
        )}
      </div>
    </section>
  );
}

/* ----- subcomponents ---------------------------------------------------- */

function PreviewEdge({
  edge,
  nodesById,
  hasPath,
  onPath,
}: {
  edge: DiagramEdge;
  nodesById: Map<string, DiagramNode>;
  hasPath: boolean;
  onPath: boolean;
}) {
  const source = nodesById.get(edge.source);
  const target = nodesById.get(edge.target);
  if (!source || !target) return null;

  const s = portWorldPosition(source, edge.sourceHandle);
  const t = portWorldPosition(target, edge.targetHandle);

  const [path] = getSmoothStepPath({
    sourceX: s.x,
    sourceY: s.y,
    targetX: t.x,
    targetY: t.y,
    sourcePosition: s.position,
    targetPosition: t.position,
    borderRadius: 6,
  });

  const lineType = edge.data?.lineType ?? "process";
  const baseStyle = LINE_STYLES[lineType];

  const stroke = hasPath
    ? onPath
      ? "#fbbf24"
      : "#52525b"
    : baseStyle.stroke ?? "#a1a1aa";
  const strokeWidth = hasPath && onPath ? 3 : (baseStyle.strokeWidth ?? 2);
  const opacity = hasPath ? (onPath ? 1 : 0.25) : 0.7;

  return (
    <g opacity={opacity}>
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={baseStyle.strokeDasharray ?? undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {baseStyle.pattern === "hash" && (
        <path
          d={path}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth + 3}
          strokeDasharray="1 9"
          strokeLinecap="butt"
        />
      )}
    </g>
  );
}

function PreviewNode({
  node,
  hasPath,
  onPath,
  isEndpoint,
}: {
  node: DiagramNode;
  hasPath: boolean;
  onPath: boolean;
  isEndpoint: boolean;
}) {
  const symbol = getSymbol(node.data.symbolType);
  if (!symbol) return null;
  const { Icon, size } = symbol;
  const rotation = (node.data.rotation as number | undefined) ?? 0;

  const opacity = hasPath ? (onPath ? 1 : 0.25) : 0.7;
  const tag = node.data.tag ?? node.data.label ?? symbol.defaultLabel ?? "";
  const labelColor = isEndpoint ? "#fbbf24" : "#a1a1aa";

  return (
    <g
      transform={`translate(${node.position.x}, ${node.position.y})`}
      opacity={opacity}
    >
      <g
        transform={
          rotation
            ? `rotate(${rotation} ${size.width / 2} ${size.height / 2})`
            : undefined
        }
        filter={isEndpoint ? "url(#route-preview-glow)" : undefined}
      >
        <Icon width={size.width} height={size.height} />
      </g>
      {tag && (
        <text
          x={size.width / 2}
          y={size.height + 12}
          textAnchor="middle"
          fontSize={11}
          fontFamily="Inter, Helvetica, Arial, sans-serif"
          fontWeight={isEndpoint ? 600 : 400}
          fill={labelColor}
        >
          {tag}
        </text>
      )}
    </g>
  );
}

/**
 * Renders a captured electrical single-line diagram (SLD) page body to an SVG
 * string (mm units), mirroring the P&ID `renderDiagramArea` but resolving
 * symbols / connection styles from the electrical registry. Kept separate from
 * the hydraulic renderer so the two disciplines stay decoupled.
 */

import { getSmoothStepPath, Position } from "@xyflow/react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  getElecSymbol,
  getNodePorts,
  getNodeSize,
} from "@/electrical/symbols/registry";
import { CONNECTION_STYLES } from "@/electrical/symbols/connectionStyles";
import { cableSpecLabel } from "@/electrical/symbols/cablePresets";
import { specLabelOffset } from "@/electrical/symbols/edgeLabels";
import { feederCenter } from "@/electrical/symbols/feederRouting";
import { buildRoutedPath, type RoutePoint } from "@/components/shared/edgeRouting";
import { rotatePort, portLocalXY } from "@/io/geometry";
import { resolveTagSide, tagSvgCoords } from "@/io/tagPlacement";
import {
  DRAW_X,
  DRAW_Y,
  DRAW_W,
  DRAW_H,
  escapeText,
  renderZoneLabel,
  renderZoneWorld,
  textAt,
} from "@/io/svgRender";
import { isZoneNode, zoneBoxSize } from "@/components/shared/zone";
import {
  boltedChildIds,
  buildBoltTableRows,
  isContainerNode,
} from "@/electrical/analysis/boltTable";
import type { DrawingPage } from "@/store/drawingsStore";
import type { ElecEdge, ElecNode } from "@/electrical/store/electricalStore";
import type { PortSide } from "@/types/diagram";

const SIDE_TO_POSITION: Record<PortSide, Position> = {
  top: Position.Top,
  bottom: Position.Bottom,
  left: Position.Left,
  right: Position.Right,
};

const STROKE_MM_FACTOR = 0.4;
const STROKE_MM_FLOOR = 0.55;
const INK = "#0f172a";

export function renderSldPageBody(page: DrawingPage): string {
  if (!page.sld) return "";
  const { nodes, edges, bounds } = page.sld;

  // Edge index keyed by the full captured edge order so the staggered routing
  // matches exactly what the user saw in the editor (FeederEdge uses the same
  // index → corridor mapping against the live store order).
  const indexById = new Map(edges.map((e, i) => [e.id, i]));

  // Reproduce the exact captured viewport (a screenshot of the current view):
  // render everything against the captured bounds and clip to the drawing area.
  return renderSldArea(nodes, edges, {
    bounds,
    padding: 4,
    topPadding: 12,
    clip: true,
    indexById,
    colorOverrides: page.colorOverrides,
    widthOverrides: page.widthOverrides,
  });
}

interface AreaOptions {
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
  padding?: number;
  topPadding?: number;
  indexById?: Map<string, number>;
  clip?: boolean;
  colorOverrides?: Record<string, string>;
  widthOverrides?: Record<string, number>;
}

function renderSldArea(
  nodes: ElecNode[],
  edges: ElecEdge[],
  options: AreaOptions = {},
): string {
  const padding = options.padding ?? 4;
  const topPad = options.topPadding ?? padding;
  const innerX = DRAW_X + padding;
  const innerY = DRAW_Y + topPad;
  const innerW = DRAW_W - 2 * padding;
  const innerH = DRAW_H - topPad - padding;

  if (nodes.length === 0) {
    return `<g>${textAt(innerX + innerW / 2, innerY + innerH / 2, "Drag SLD symbols onto the canvas to start.", 4, "middle")}</g>`;
  }

  const bounds = options.bounds ?? elecBounds(nodes);
  const dw = Math.max(1, bounds.maxX - bounds.minX);
  const dh = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min(innerW / dw, innerH / dh);
  const offsetX = innerX + (innerW - dw * scale) / 2 - bounds.minX * scale;
  const offsetY = innerY + (innerH - dh * scale) / 2 - bounds.minY * scale;

  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const indexById = options.indexById ?? new Map<string, number>();
  const overrides = options.colorOverrides ?? {};
  const widthOverrides = options.widthOverrides ?? {};

  const innerEdges = edges
    .map((e) =>
      renderEdgeWorld(
        e,
        nodesById,
        indexById.get(e.id) ?? 0,
        overrides[e.id],
        widthOverrides[e.id],
      ),
    )
    .filter(Boolean);
  const innerNodes = nodes
    .map((n) => renderNodeWorld(n, overrides[n.id]))
    .filter(Boolean);
  const innerZones = nodes
    .filter((n) => isZoneNode(n))
    .map((n) => renderZoneWorld(n))
    .filter(Boolean);
  // Tags of components bolted onto a board/bus move into that parent's
  // schedule table, so suppress them on the symbols (they'd just overlap).
  const hiddenTagIds = boltedChildIds(nodes, edges);
  const tagMarkup = nodes
    .filter((n) => !hiddenTagIds.has(n.id))
    .map((n) => renderNodeTag(n, scale, offsetX, offsetY, overrides[n.id]))
    .filter(Boolean)
    .join("");
  const boltTables = nodes
    .filter((n) => isContainerNode(n))
    .map((n) => renderBoltTable(n, nodes, edges, scale, offsetX, offsetY))
    .filter(Boolean)
    .join("");
  const edgeLabels = edges
    .map((e) =>
      renderEdgeLabel(e, nodesById, scale, offsetX, offsetY, overrides[e.id]),
    )
    .filter(Boolean)
    .join("");
  const zoneLabels = nodes
    .filter((n) => isZoneNode(n))
    .map((n) => renderZoneLabel(n, scale, offsetX, offsetY))
    .filter(Boolean)
    .join("");

  const clipId = `sclip-${Math.random().toString(36).slice(2, 8)}`;
  const clipDef = options.clip
    ? `<defs><clipPath id="${clipId}"><rect x="${innerX.toFixed(3)}" y="${innerY.toFixed(3)}" width="${innerW.toFixed(3)}" height="${innerH.toFixed(3)}" /></clipPath></defs>`
    : "";
  const clipAttr = options.clip ? ` clip-path="url(#${clipId})"` : "";

  return `<g class="sld">${clipDef}
    <g${clipAttr}>
      <g transform="translate(${offsetX.toFixed(3)} ${offsetY.toFixed(3)}) scale(${scale.toFixed(5)})">
        <g class="zones">${innerZones.join("")}</g>
        <g class="edges">${innerEdges.join("")}</g>
        <g class="nodes">${innerNodes.join("")}</g>
      </g>
      <g class="labels">${zoneLabels}${tagMarkup}${edgeLabels}${boltTables}</g>
    </g>
  </g>`;
}

function renderNodeWorld(node: ElecNode, override?: string): string {
  const symbol = getElecSymbol(node.data.symbolType);
  if (!symbol) return "";
  const { Icon } = symbol;
  const size = getNodeSize(symbol, node.data);
  const rotation = node.data.rotation ?? 0;
  const innerSvg = styleSymbolForPrint(
    renderToStaticMarkup(<Icon width={size.width} height={size.height} />),
    override ?? INK,
  );
  // Transparent hit area so clicks register on the symbol's interior
  // whitespace (most symbols are open outlines), enabling selection in the
  // Drawings tab style editor.
  const hitArea = `<rect x="0" y="0" width="${size.width}" height="${size.height}" fill="transparent" pointer-events="all" />`;
  return `<g data-element-id="${escapeText(node.id)}" data-element-kind="node" transform="translate(${node.position.x.toFixed(3)} ${node.position.y.toFixed(3)}) ${
    rotation
      ? `rotate(${rotation} ${(size.width / 2).toFixed(3)} ${(size.height / 2).toFixed(3)})`
      : ""
  }">${hitArea}${innerSvg}</g>`;
}

function renderNodeTag(
  node: ElecNode,
  scale: number,
  offsetX: number,
  offsetY: number,
  override?: string,
): string {
  const symbol = getElecSymbol(node.data.symbolType);
  if (!symbol) return "";
  const tag = node.data.tag ?? node.data.label ?? symbol.defaultLabel ?? "";
  if (!tag) return "";
  const size = getNodeSize(symbol, node.data);
  const rotation = node.data.rotation ?? 0;
  const side = resolveTagSide(getNodePorts(symbol, node.data), rotation);
  const fontSize = Math.max(2.6, Math.min(4.5, size.height * scale * 0.18));
  const { x, y, anchor } = tagSvgCoords(
    side,
    node.position.x,
    node.position.y,
    size.width,
    size.height,
    scale,
    offsetX,
    offsetY,
    fontSize,
  );
  return `<text x="${x.toFixed(3)}" y="${y.toFixed(3)}" text-anchor="${anchor}" font-size="${fontSize.toFixed(2)}" font-family="Inter, Helvetica, Arial, sans-serif" fill="${override ?? INK}" pointer-events="none">${escapeText(tag)}</text>`;
}

function renderEdgeWorld(
  edge: ElecEdge,
  nodesById: Map<string, ElecNode>,
  index: number,
  override?: string,
  widthMultiplier?: number,
): string {
  const source = nodesById.get(edge.source);
  const target = nodesById.get(edge.target);
  if (!source || !target) return "";
  const s = portWorldPosition(source, edge.sourceHandle);
  const t = portWorldPosition(target, edge.targetHandle);

  // Bolted (direct) joins carry no cable — the two ports coincide, so draw a
  // small junction dot rather than a routed line.
  if ((edge.data?.connectionType ?? "lv-power") === "direct") {
    const cx = (s.x + t.x) / 2;
    const cy = (s.y + t.y) / 2;
    const fill = override ?? INK;
    return `<g data-element-id="${escapeText(edge.id)}" data-element-kind="edge"><circle cx="${cx.toFixed(3)}" cy="${cy.toFixed(3)}" r="2.4" fill="${fill}" pointer-events="all" /></g>`;
  }

  const dist = Math.hypot(t.x - s.x, t.y - s.y);
  const borderRadius = Math.max(1, Math.min(18, dist * 0.35));
  const waypoints = (edge.data?.waypoints as RoutePoint[] | undefined) ?? [];
  const [path] = buildRoutedPath(
    {
      sourceX: s.x,
      sourceY: s.y,
      targetX: t.x,
      targetY: t.y,
      sourcePosition: s.position,
      targetPosition: t.position,
    },
    waypoints,
    borderRadius,
    (a) => {
      const { centerX, centerY } = feederCenter(
        a.sourceX,
        a.sourceY,
        a.targetX,
        a.targetY,
        index,
      );
      return getSmoothStepPath({
        sourceX: a.sourceX,
        sourceY: a.sourceY,
        targetX: a.targetX,
        targetY: a.targetY,
        sourcePosition: a.sourcePosition,
        targetPosition: a.targetPosition,
        borderRadius,
        centerX,
        centerY,
      });
    },
  );
  const style = CONNECTION_STYLES[edge.data?.connectionType ?? "lv-power"];
  const widthMult = widthMultiplier ?? 1;
  const stroke = override ?? INK;
  const baseW =
    Math.max(STROKE_MM_FLOOR, style.strokeWidth * STROKE_MM_FACTOR) * widthMult;
  const dash = style.strokeDasharray
    ? style.strokeDasharray
        .split(/\s+/)
        .map((n) => (Number.parseFloat(n) * 0.22 * widthMult).toFixed(2))
        .join(" ")
    : undefined;
  // Transparent hit path under the visible stroke for easy click selection.
  const hit = `<path d="${path}" fill="none" stroke="transparent" stroke-width="9" vector-effect="non-scaling-stroke" pointer-events="stroke" />`;
  const primary = `<path class="pid-stroke" d="${path}" fill="none" stroke="${stroke}" stroke-width="${baseW.toFixed(3)}" ${
    dash ? `stroke-dasharray="${dash}"` : ""
  } vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" pointer-events="none" />`;
  return `<g data-element-id="${escapeText(edge.id)}" data-element-kind="edge">${hit}${primary}</g>`;
}

function renderEdgeLabel(
  edge: ElecEdge,
  nodesById: Map<string, ElecNode>,
  scale: number,
  offsetX: number,
  offsetY: number,
  override?: string,
): string {
  const tag = edge.data?.tag;
  const spec = edge.data?.showSpec ? cableSpecLabel(edge.data?.cable) : "";
  if (!tag && !spec) return "";
  const source = nodesById.get(edge.source);
  const target = nodesById.get(edge.target);
  if (!source || !target) return "";
  const s = portWorldPosition(source, edge.sourceHandle);
  const t = portWorldPosition(target, edge.targetHandle);
  const waypoints = (edge.data?.waypoints as RoutePoint[] | undefined) ?? [];
  const [, lx, ly] = buildRoutedPath(
    {
      sourceX: s.x,
      sourceY: s.y,
      targetX: t.x,
      targetY: t.y,
      sourcePosition: s.position,
      targetPosition: t.position,
    },
    waypoints,
    1,
    (a) => ["", (a.sourceX + a.targetX) / 2, (a.sourceY + a.targetY) / 2],
  );
  const mx = lx * scale + offsetX;
  const my = ly * scale + offsetY - 1;
  const fill = override ?? INK;
  const parts: string[] = [];
  if (tag) {
    parts.push(
      `<text x="${mx.toFixed(3)}" y="${(spec ? my - 1.6 : my).toFixed(3)}" font-size="2.4" font-family="Inter, Helvetica, Arial, sans-serif" text-anchor="middle" fill="${fill}" pointer-events="none">${escapeText(tag)}</text>`,
    );
  }
  if (spec) {
    const off = specLabelOffset(!!tag, edge.data?.specLabelOffset);
    const specX = (lx + off.x) * scale + offsetX;
    const specY = (ly + off.y) * scale + offsetY - 1;
    parts.push(
      `<text x="${specX.toFixed(3)}" y="${specY.toFixed(3)}" font-size="2.1" font-family="Inter, Helvetica, Arial, sans-serif" text-anchor="middle" fill="${fill}" pointer-events="none">${escapeText(spec)}</text>`,
    );
  }
  return parts.join("");
}

/**
 * Schedule table beside a board / busbar listing everything bolted onto it
 * (way, tag, type, rating). Drawn in mm in the labels layer so it prints at a
 * fixed, readable size — mirrors the draggable editor table.
 */
function renderBoltTable(
  node: ElecNode,
  nodes: ElecNode[],
  edges: ElecEdge[],
  scale: number,
  offsetX: number,
  offsetY: number,
): string {
  const rows = buildBoltTableRows(node.id, nodes, edges);
  if (rows.length === 0) return "";
  const symbol = getElecSymbol(node.data.symbolType);
  const size = symbol ? getNodeSize(symbol, node.data) : { width: 96, height: 64 };
  const offset = node.data.boltTableOffset ?? { x: size.width + 16, y: 0 };
  const ox = (node.position.x + offset.x) * scale + offsetX;
  const oy = (node.position.y + offset.y) * scale + offsetY;

  const cols = [
    { x: 1, label: "Way" },
    { x: 7, label: "Tag" },
    { x: 23, label: "Type" },
    { x: 45, label: "Rating" },
  ];
  const W = 62;
  const titleH = 4.4;
  const headerH = 4;
  const rowH = 3.6;
  const H = titleH + headerH + rows.length * rowH;

  const parts: string[] = [];
  parts.push(
    `<rect x="${ox.toFixed(2)}" y="${oy.toFixed(2)}" width="${W}" height="${H.toFixed(2)}" fill="#ffffff" stroke="${INK}" stroke-width="0.3" rx="0.8" />`,
  );
  const owner = node.data.tag ?? node.data.label ?? "Board";
  const title = `${owner} — Connections`;
  parts.push(textAt(ox + 1.5, oy + titleH * 0.72, title, 2.5, "start", true));
  parts.push(
    `<line x1="${ox.toFixed(2)}" y1="${(oy + titleH).toFixed(2)}" x2="${(ox + W).toFixed(2)}" y2="${(oy + titleH).toFixed(2)}" stroke="${INK}" stroke-width="0.3" />`,
  );
  const headerY = oy + titleH + headerH * 0.72;
  for (const c of cols) {
    parts.push(textAt(ox + c.x, headerY, c.label, 2.1, "start", true));
  }
  parts.push(
    `<line x1="${ox.toFixed(2)}" y1="${(oy + titleH + headerH).toFixed(2)}" x2="${(ox + W).toFixed(2)}" y2="${(oy + titleH + headerH).toFixed(2)}" stroke="${INK}" stroke-width="0.25" />`,
  );
  rows.forEach((r, i) => {
    const rowTop = oy + titleH + headerH + i * rowH;
    const textY = rowTop + rowH * 0.72;
    parts.push(textAt(ox + cols[0].x, textY, r.tap, 2.0, "start"));
    parts.push(textAt(ox + cols[1].x, textY, clampText(r.tag, 11), 2.0, "start"));
    parts.push(textAt(ox + cols[2].x, textY, clampText(r.type, 15), 2.0, "start"));
    parts.push(textAt(ox + cols[3].x, textY, clampText(r.rating, 13), 2.0, "start"));
  });
  return `<g class="bolt-table">${parts.join("")}</g>`;
}

function clampText(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function styleSymbolForPrint(svg: string, ink: string): string {
  return svg
    .replace(/\sclass="[^"]*"/g, "")
    .replace(/currentColor/g, ink)
    .replace(
      /<(path|line|circle|ellipse|polyline|polygon|rect)\s/g,
      '<$1 class="pid-stroke" ',
    );
}

/* --------------------------- geometry helpers --------------------------- */

interface PortLookup {
  x: number;
  y: number;
  position: Position;
}

function portWorldPosition(
  node: ElecNode,
  handleId: string | null | undefined,
): PortLookup {
  const symbol = getElecSymbol(node.data.symbolType);
  const { width, height } = symbol
    ? getNodeSize(symbol, node.data)
    : { width: 64, height: 64 };
  const baseX = node.position.x;
  const baseY = node.position.y;
  if (handleId && symbol) {
    const port = getNodePorts(symbol, node.data).find((p) => p.id === handleId);
    if (port) {
      const rotation = node.data.rotation ?? 0;
      const rotated = rotatePort(port.side, port.position, rotation);
      const local = portLocalXY(rotated.side, rotated.position, width, height);
      return {
        x: baseX + local.x,
        y: baseY + local.y,
        position: SIDE_TO_POSITION[rotated.side],
      };
    }
  }
  return { x: baseX + width / 2, y: baseY + height / 2, position: Position.Right };
}

function elecBounds(nodes: ElecNode[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  if (nodes.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const sym = getElecSymbol(node.data.symbolType);
    // Match renderZoneWorld: prefer the measured DOM size so resized zones'
    // extents line up exactly with the editor when auto-fitting bounds.
    const zoneSize = zoneBoxSize(node, 64, 64);
    const symSize = sym ? getNodeSize(sym, node.data) : null;
    const w = symSize?.width ?? zoneSize.w;
    const h = symSize?.height ?? zoneSize.h;
    if (node.position.x < minX) minX = node.position.x;
    if (node.position.y < minY) minY = node.position.y;
    if (node.position.x + w > maxX) maxX = node.position.x + w;
    if (node.position.y + h > maxY) maxY = node.position.y + h;
  }
  return { minX, minY, maxX, maxY };
}

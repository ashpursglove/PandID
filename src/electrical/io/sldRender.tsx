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
import { feederPhase, nodePhase, PHASE1_PRINT } from "@/electrical/symbols/phase";
import { buildRoutedPath, type RoutePoint } from "@/components/shared/edgeRouting";
import { rotatePort, portLocalXY } from "@/io/geometry";
import { resolveTagSide, tagWorldCoords } from "@/io/tagPlacement";
import {
  DRAW_X,
  DRAW_Y,
  DRAW_W,
  DRAW_H,
  escapeText,
  renderZoneWorld,
  textAt,
} from "@/io/svgRender";
import {
  DEFAULT_ZONE_COLOR,
  isZoneNode,
  zoneBoxSize,
} from "@/components/shared/zone";
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
  //
  // Every label below is rendered in *world* coordinates and placed inside the
  // same scaled group as the symbols/zones, at the same font sizes the editor
  // uses (in world units). That makes the captured view scale uniformly — a
  // true screenshot of the editor — instead of text/tables keeping a fixed mm
  // size that drifts out of proportion as the page scale changes.
  const hiddenTagIds = boltedChildIds(nodes, edges);
  const tagMarkup = nodes
    .filter((n) => !hiddenTagIds.has(n.id))
    .map((n) => renderNodeTagWorld(n, overrides[n.id]))
    .filter(Boolean)
    .join("");
  const boltTables = nodes
    .filter((n) => isContainerNode(n))
    .map((n) => renderBoltTableWorld(n, nodes, edges))
    .filter(Boolean)
    .join("");
  const edgeLabels = edges
    .map((e) => renderEdgeLabelWorld(e, nodesById, overrides[e.id]))
    .filter(Boolean)
    .join("");
  const zoneLabels = nodes
    .filter((n) => isZoneNode(n))
    .map((n) => renderZoneLabelWorld(n))
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
        <g class="labels">${zoneLabels}${tagMarkup}${edgeLabels}${boltTables}</g>
      </g>
    </g>
  </g>`;
}

function renderNodeWorld(node: ElecNode, override?: string): string {
  const symbol = getElecSymbol(node.data.symbolType);
  if (!symbol) return "";
  const { Icon } = symbol;
  const size = getNodeSize(symbol, node.data);
  const rotation = node.data.rotation ?? 0;
  const phaseInk = nodePhase(node) === 1 ? PHASE1_PRINT : INK;
  const innerSvg = styleSymbolForPrint(
    renderToStaticMarkup(<Icon width={size.width} height={size.height} />),
    override ?? phaseInk,
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

/**
 * Component tag in world coordinates. Font size (11) and gap match the live
 * editor's `tagEditorStyle`, so once the whole group is page-scaled the tag
 * keeps the exact proportion to its symbol that the user saw on the canvas.
 */
function renderNodeTagWorld(node: ElecNode, override?: string): string {
  const symbol = getElecSymbol(node.data.symbolType);
  if (!symbol) return "";
  const tag = node.data.tag ?? node.data.label ?? symbol.defaultLabel ?? "";
  if (!tag) return "";
  const size = getNodeSize(symbol, node.data);
  const rotation = node.data.rotation ?? 0;
  const side = resolveTagSide(getNodePorts(symbol, node.data), rotation);
  const phaseInk = nodePhase(node) === 1 ? PHASE1_PRINT : INK;
  const fontSize = 11;
  const { x, y, anchor } = tagWorldCoords(
    side,
    node.position.x,
    node.position.y,
    size.width,
    size.height,
    5,
    fontSize,
  );
  return `<text x="${x.toFixed(3)}" y="${y.toFixed(3)}" text-anchor="${anchor}" font-size="${fontSize}" font-family="Inter, Helvetica, Arial, sans-serif" fill="${override ?? phaseInk}" pointer-events="none">${escapeText(tag)}</text>`;
}

/**
 * Zone label chip in world coordinates, matching the editor's `ZoneNode`
 * label tab (11 px, sitting just above the box's top-left corner).
 */
function renderZoneLabelWorld(node: ElecNode): string {
  const label = ((node.data.zoneLabel as string) || "Area").trim();
  if (!label) return "";
  const color = (node.data.zoneColor as string) || DEFAULT_ZONE_COLOR;
  const x = node.position.x;
  const y = node.position.y;
  const fs = 11;
  const padX = 8;
  const chipH = 18;
  const chipW = label.length * fs * 0.6 + padX * 2;
  return `<g pointer-events="none"><rect x="${(x + 8).toFixed(2)}" y="${(y - 11).toFixed(2)}" width="${chipW.toFixed(2)}" height="${chipH}" rx="4" fill="${color}" /><text x="${(x + 8 + padX).toFixed(2)}" y="${(y - 11 + 12.5).toFixed(2)}" font-size="${fs}" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="bold" fill="#0b0f17">${escapeText(label)}</text></g>`;
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
  const phaseInk =
    feederPhase(edge, source, target) === 1 ? PHASE1_PRINT : INK;
  const stroke = override ?? phaseInk;
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

/**
 * Feeder tag + cable-spec labels in world coordinates. Font sizes (10 / 9) and
 * the spec drag offset mirror the live `FeederEdge`, so the labels sit and
 * scale exactly as they did in the editor once the group is page-scaled.
 */
function renderEdgeLabelWorld(
  edge: ElecEdge,
  nodesById: Map<string, ElecNode>,
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
  const fill = override ?? INK;
  const parts: string[] = [];
  if (tag) {
    parts.push(
      `<text x="${lx.toFixed(3)}" y="${(ly + 3.5).toFixed(3)}" font-size="10" font-family="Inter, Helvetica, Arial, sans-serif" text-anchor="middle" fill="${fill}" pointer-events="none">${escapeText(tag)}</text>`,
    );
  }
  if (spec) {
    const off = specLabelOffset(!!tag, edge.data?.specLabelOffset);
    parts.push(
      `<text x="${(lx + off.x).toFixed(3)}" y="${(ly + off.y + 3).toFixed(3)}" font-size="9" font-family="Inter, Helvetica, Arial, sans-serif" text-anchor="middle" fill="${fill}" pointer-events="none">${escapeText(spec)}</text>`,
    );
  }
  return parts.join("");
}

/**
 * Schedule table beside a board / busbar listing everything bolted onto it
 * (way, tag, type, rating). Drawn in *world* coordinates (168 units wide,
 * 7-unit text) to mirror the editor's draggable Connections table exactly, so
 * it scales with the rest of the captured view instead of keeping a fixed mm
 * size that drifts out of proportion.
 */
function renderBoltTableWorld(
  node: ElecNode,
  nodes: ElecNode[],
  edges: ElecEdge[],
): string {
  const rows = buildBoltTableRows(node.id, nodes, edges);
  if (rows.length === 0) return "";
  const symbol = getElecSymbol(node.data.symbolType);
  const size = symbol ? getNodeSize(symbol, node.data) : { width: 96, height: 64 };
  const offset = node.data.boltTableOffset ?? { x: size.width + 16, y: 0 };
  const ox = node.position.x + offset.x;
  const oy = node.position.y + offset.y;

  // World-unit geometry matching ContainerConnectionsTable (168 wide, 7px text).
  const W = 168;
  const fs = 7;
  const lineH = 9; // per wrapped line (≈ fs · 1.25 line-height)
  const padV = 3; // top/bottom cell padding
  const titleH = 15;
  const headerH = 13;
  // Column x + character budget per column (so long cells wrap instead of
  // truncating, exactly like the editor's auto-wrapping table cells).
  const cols = [
    { x: 5, label: "Way", max: 5 },
    { x: 28, label: "Tag", max: 9 },
    { x: 64, label: "Type", max: 14 },
    { x: 120, label: "Rating", max: 11 },
  ];

  // Pre-wrap every cell and size each row to the tallest column in it.
  const wrapped = rows.map((r) => {
    const cells = [
      wrapText(r.tap, cols[0].max),
      wrapText(r.tag, cols[1].max),
      wrapText(r.type, cols[2].max),
      wrapText(r.rating, cols[3].max),
    ];
    const lineCount = Math.max(...cells.map((c) => c.length));
    return { cells, height: lineCount * lineH + padV * 2 };
  });
  const bodyH = wrapped.reduce((a, w) => a + w.height, 0);
  const H = titleH + headerH + bodyH;

  const owner = node.data.tag ?? node.data.label ?? "Board";
  const title = `${owner} — Connections`;
  const parts: string[] = [];
  // Body + title bar (print-friendly white/ink, like the rest of the drawing).
  parts.push(
    `<rect x="${ox.toFixed(2)}" y="${oy.toFixed(2)}" width="${W}" height="${H.toFixed(2)}" fill="#ffffff" stroke="${INK}" stroke-width="0.7" rx="3" />`,
  );
  parts.push(
    `<path d="M${ox.toFixed(2)} ${(oy + titleH).toFixed(2)} L${ox.toFixed(2)} ${(oy + 3).toFixed(2)} Q${ox.toFixed(2)} ${oy.toFixed(2)} ${(ox + 3).toFixed(2)} ${oy.toFixed(2)} L${(ox + W - 3).toFixed(2)} ${oy.toFixed(2)} Q${(ox + W).toFixed(2)} ${oy.toFixed(2)} ${(ox + W).toFixed(2)} ${(oy + 3).toFixed(2)} L${(ox + W).toFixed(2)} ${(oy + titleH).toFixed(2)} Z" fill="#e2e8f0" />`,
  );
  parts.push(textAt(ox + 5, oy + titleH * 0.7, title, fs, "start", true));
  parts.push(
    `<line x1="${ox.toFixed(2)}" y1="${(oy + titleH).toFixed(2)}" x2="${(ox + W).toFixed(2)}" y2="${(oy + titleH).toFixed(2)}" stroke="${INK}" stroke-width="0.5" />`,
  );
  const headerY = oy + titleH + headerH * 0.7;
  for (const c of cols) {
    parts.push(textAt(ox + c.x, headerY, c.label, fs, "start", true));
  }
  parts.push(
    `<line x1="${ox.toFixed(2)}" y1="${(oy + titleH + headerH).toFixed(2)}" x2="${(ox + W).toFixed(2)}" y2="${(oy + titleH + headerH).toFixed(2)}" stroke="${INK}" stroke-width="0.4" />`,
  );
  let rowTop = oy + titleH + headerH;
  wrapped.forEach((w, i) => {
    if (i > 0) {
      parts.push(
        `<line x1="${ox.toFixed(2)}" y1="${rowTop.toFixed(2)}" x2="${(ox + W).toFixed(2)}" y2="${rowTop.toFixed(2)}" stroke="#cbd5e1" stroke-width="0.3" />`,
      );
    }
    // Top-aligned cells (matches the editor), each line stacked downward.
    w.cells.forEach((lines, c) => {
      lines.forEach((line, li) => {
        const ly = rowTop + padV + fs + li * lineH;
        parts.push(textAt(ox + cols[c].x, ly, line, fs, "start"));
      });
    });
    rowTop += w.height;
  });
  return `<g class="bolt-table">${parts.join("")}</g>`;
}

/**
 * Word-wrap `s` into lines of at most `maxChars` characters, breaking on spaces
 * and hard-breaking any single word that's longer than the column allows — so
 * the drawing table shows every cell in full rather than truncating it.
 */
function wrapText(s: string, maxChars: number): string[] {
  const max = Math.max(1, Math.floor(maxChars));
  const words = (s ?? "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (let word of words) {
    while (word.length > max) {
      if (cur) {
        lines.push(cur);
        cur = "";
      }
      lines.push(word.slice(0, max));
      word = word.slice(max);
    }
    const candidate = cur ? `${cur} ${word}` : word;
    if (candidate.length <= max) {
      cur = candidate;
    } else {
      if (cur) lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
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

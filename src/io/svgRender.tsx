/**
 * Render the current diagram + ISO A3 title block to a single SVG string.
 *
 * Coordinate system is millimetres. The page is 420 × 297 mm (A3 landscape).
 * The diagram is fitted inside a drawing area; the title block lives in the
 * bottom-right corner.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { getSmoothStepPath } from "@xyflow/react";

import { getSymbol } from "@/symbols/registry";
import { LINE_STYLES } from "@/symbols/lines/lineStyles";
import type { DiagramEdge, DiagramNode } from "@/store/diagramStore";
import type { ProjectMeta } from "@/store/projectStore";
import { DEFAULT_ZONE_COLOR, isZoneNode, zoneBoxSize } from "@/components/shared/zone";

import { diagramBounds, portWorldPosition } from "./geometry";
import { resolveTagSide, tagSvgCoords } from "./tagPlacement";
import { buildRoutedPath, type RoutePoint } from "@/components/shared/edgeRouting";

/* ----- Shared zone (area-box) rendering --------------------------------- */

/** Render a zone/area box in world coordinates (sits behind everything). */
export function renderZoneWorld(node: { position: { x: number; y: number }; width?: number | null; height?: number | null; measured?: { width?: number | null; height?: number | null } | null; data: Record<string, unknown> }): string {
  const { w, h } = zoneBoxSize(node);
  const color = (node.data.zoneColor as string) || DEFAULT_ZONE_COLOR;
  return `<rect x="${node.position.x.toFixed(3)}" y="${node.position.y.toFixed(3)}" width="${w.toFixed(3)}" height="${h.toFixed(3)}" rx="4" fill="${color}" fill-opacity="0.07" stroke="${color}" stroke-width="0.7" stroke-dasharray="3 2" vector-effect="non-scaling-stroke" pointer-events="none" />`;
}

/** Render the zone's label chip in drawing-mm coordinates (top-left corner). */
export function renderZoneLabel(
  node: { position: { x: number; y: number }; data: Record<string, unknown> },
  scale: number,
  offsetX: number,
  offsetY: number,
): string {
  const label = ((node.data.zoneLabel as string) || "Area").trim();
  if (!label) return "";
  const color = (node.data.zoneColor as string) || DEFAULT_ZONE_COLOR;
  const x = node.position.x * scale + offsetX;
  const y = node.position.y * scale + offsetY;
  const fs = 3;
  const chipW = Math.max(8, label.length * fs * 0.58 + 4);
  return `<g pointer-events="none"><rect x="${(x + 2).toFixed(2)}" y="${(y - 1).toFixed(2)}" width="${chipW.toFixed(2)}" height="${(fs + 2).toFixed(2)}" rx="1" fill="${color}" /><text x="${(x + 4).toFixed(2)}" y="${(y + fs + 0.1).toFixed(2)}" font-size="${fs}" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="bold" fill="#0b0f17">${escapeText(label)}</text></g>`;
}

/* ----- Page geometry (mm) ----------------------------------------------- */

export const PAGE_W = 420;
export const PAGE_H = 297;
export const MARGIN = 8;
export const TITLE_W = 180;
export const TITLE_H = 56;

export const DRAW_X = MARGIN;
export const DRAW_Y = MARGIN;
export const DRAW_W = PAGE_W - 2 * MARGIN;
export const DRAW_H = PAGE_H - 2 * MARGIN - TITLE_H;

export const TITLE_X = PAGE_W - MARGIN - TITLE_W;
export const TITLE_Y = PAGE_H - MARGIN - TITLE_H;

const FRAME_STROKE = 0.4;
const FRAME_STROKE_OUTER = 0.6;

/* ----- Public API ------------------------------------------------------- */

export interface RenderSvgInput {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  meta: ProjectMeta;
}

/** Legacy single-page export — renders the full live diagram on one A3 sheet. */
export function renderDrawingSvg({ nodes, edges, meta }: RenderSvgInput): string {
  const diagram = renderDiagramArea(nodes, edges);
  const titleBlock = renderTitleBlock(meta);
  const frame = renderFrame();
  return wrapSvg(`${frame}\n${diagram}\n${titleBlock}`);
}

export function wrapSvg(inner: string): string {
  // Width/height as 100% lets the in-app preview fill its container while the
  // PDF exporter overrides with explicit mm dimensions in its embed call, so
  // both consumers behave correctly off the same string. The selection
  // highlight CSS lives in the global stylesheet (index.css) rather than
  // inside the SVG — svg2pdf can't handle filters/mm-units/attribute
  // selectors inside <style>, and the highlight is purely a live-UI concern
  // anyway.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${PAGE_W} ${PAGE_H}" preserveAspectRatio="xMidYMid meet" style="background:white">
${inner}
</svg>`;
}

/* ----- Frame + zone numbering ------------------------------------------- */

export function renderFrame(): string {
  const COLS = 8;
  const ROWS = 4;
  const colW = DRAW_W / COLS;
  const rowH = (PAGE_H - 2 * MARGIN) / ROWS;

  const ticks: string[] = [];
  for (let i = 1; i < COLS; i++) {
    const x = DRAW_X + i * colW;
    ticks.push(`<line x1="${x}" y1="${MARGIN}" x2="${x}" y2="${MARGIN + 3}" stroke="black" stroke-width="${FRAME_STROKE}" />`);
    ticks.push(`<line x1="${x}" y1="${PAGE_H - MARGIN}" x2="${x}" y2="${PAGE_H - MARGIN - 3}" stroke="black" stroke-width="${FRAME_STROKE}" />`);
  }
  for (let i = 1; i < ROWS; i++) {
    const y = MARGIN + i * rowH;
    ticks.push(`<line x1="${MARGIN}" y1="${y}" x2="${MARGIN + 3}" y2="${y}" stroke="black" stroke-width="${FRAME_STROKE}" />`);
    ticks.push(`<line x1="${PAGE_W - MARGIN}" y1="${y}" x2="${PAGE_W - MARGIN - 3}" y2="${y}" stroke="black" stroke-width="${FRAME_STROKE}" />`);
  }

  const labels: string[] = [];
  for (let i = 0; i < COLS; i++) {
    const x = DRAW_X + i * colW + colW / 2;
    labels.push(textAt(x, MARGIN - 2.2, `${i + 1}`, 3, "middle"));
    labels.push(textAt(x, PAGE_H - MARGIN + 4.5, `${i + 1}`, 3, "middle"));
  }
  for (let i = 0; i < ROWS; i++) {
    const y = MARGIN + i * rowH + rowH / 2;
    const letter = String.fromCharCode("A".charCodeAt(0) + i);
    labels.push(textAt(MARGIN - 2.5, y + 1, letter, 3, "middle"));
    labels.push(textAt(PAGE_W - MARGIN + 2.5, y + 1, letter, 3, "middle"));
  }

  return `<g>
    <rect x="${MARGIN / 2}" y="${MARGIN / 2}" width="${PAGE_W - MARGIN}" height="${PAGE_H - MARGIN}" fill="none" stroke="black" stroke-width="${FRAME_STROKE}" />
    <rect x="${MARGIN}" y="${MARGIN}" width="${PAGE_W - 2 * MARGIN}" height="${PAGE_H - 2 * MARGIN}" fill="none" stroke="black" stroke-width="${FRAME_STROKE_OUTER}" />
    ${ticks.join("\n")}
    ${labels.join("\n")}
  </g>`;
}

/* ----- Title block ------------------------------------------------------ */

export interface TitleBlockOptions {
  /** Optional company logo (data URL or http URL). Rendered in the title row. */
  logoDataUrl?: string | null;
  /** Override the displayed sheet/totalSheets at render time. */
  sheetOverride?: { sheet?: string; totalSheets?: string };
}

export function renderTitleBlock(
  meta: ProjectMeta,
  options: TitleBlockOptions = {},
): string {
  const rows: string[] = [];

  rows.push(
    `<rect x="${TITLE_X}" y="${TITLE_Y}" width="${TITLE_W}" height="${TITLE_H}" fill="white" stroke="black" stroke-width="${FRAME_STROKE_OUTER}" />`,
  );

  const colW = TITLE_W / 3;
  for (let i = 1; i < 3; i++) {
    const x = TITLE_X + i * colW;
    rows.push(line(x, TITLE_Y, x, TITLE_Y + TITLE_H));
  }
  const rowH = TITLE_H / 4;
  for (let i = 1; i < 4; i++) {
    const y = TITLE_Y + i * rowH;
    rows.push(line(TITLE_X, y, TITLE_X + TITLE_W, y));
  }

  function cell(col: number, row: number, label: string, value: string) {
    const cx = TITLE_X + col * colW + 1.5;
    const cy = TITLE_Y + row * rowH + 1.5;
    return `${textAt(cx, cy + 2.4, label, 2.0)}${textAt(cx, cy + 6.2, value, 3, "start", true)}`;
  }

  rows.push(cell(0, 0, "DRAWN BY", meta.drawnBy || "—"));
  rows.push(cell(1, 0, "CHECKED", meta.checkedBy || "—"));
  rows.push(cell(2, 0, "APPROVED", meta.approvedBy || "—"));
  rows.push(cell(0, 1, "DATE", meta.date || "—"));
  rows.push(cell(1, 1, "SCALE", meta.scale || "NTS"));
  rows.push(cell(2, 1, "REV", meta.revision || "0"));

  rows.push(
    `<rect x="${TITLE_X}" y="${TITLE_Y + 2 * rowH}" width="${TITLE_W}" height="${rowH * 2}" fill="white" stroke="black" stroke-width="${FRAME_STROKE}" />`,
  );

  // Bottom section is `rowH*2 = 28 mm` tall and currently shared between
  // the project title, drawing number, sheet info, and an optional logo on
  // the right. Stacking from the top:
  //   y+ 4   COMPANY label (tiny)
  //   y+ 8   company-name value (medium, bold)
  //   y+13   TITLE label (tiny)
  //   y+18   project-title value (large, bold)
  //   y+23   drawing-number value (small)
  //
  // The right-hand logo box keeps its full bottom-section height; the text
  // column above is sized so it never crosses into the logo zone.
  const bottomY = TITLE_Y + 2 * rowH;
  const logoBoxW = 26;
  const textRightCap = TITLE_X + TITLE_W - logoBoxW - 4;
  const textColW = Math.max(20, textRightCap - (TITLE_X + 2));
  const company = (meta.companyName ?? "").trim();
  rows.push(
    textAt(TITLE_X + 2, bottomY + 4, "COMPANY", 2.2, "start"),
  );
  rows.push(
    textAt(
      TITLE_X + 2,
      bottomY + 8,
      truncateForWidth(company || "—", 3.8, textColW),
      3.8,
      "start",
      true,
    ),
  );
  rows.push(
    textAt(TITLE_X + 2, bottomY + 13, "TITLE", 2.2, "start"),
  );
  rows.push(
    textAt(
      TITLE_X + 2,
      bottomY + 18,
      truncateForWidth(meta.title || "Untitled", 4.2, textColW),
      4.2,
      "start",
      true,
    ),
  );
  rows.push(
    textAt(
      TITLE_X + 2,
      bottomY + 23,
      truncateForWidth(meta.drawingNumber || "", 3.0, textColW),
      3.0,
      "start",
      false,
    ),
  );
  const sheet = options.sheetOverride?.sheet ?? meta.sheet ?? "1";
  const total = options.sheetOverride?.totalSheets ?? meta.totalSheets ?? "1";
  rows.push(
    textAt(
      TITLE_X + TITLE_W - 2,
      TITLE_Y + TITLE_H - 2,
      `SHEET ${sheet} OF ${total}`,
      2.8,
      "end",
    ),
  );

  if (options.logoDataUrl) {
    // Logo lives in the bottom-right corner of the bottom section. The text
    // column above was sized to leave this width clear.
    const logoBoxH = rowH * 2 - 3;
    const lx = TITLE_X + TITLE_W - logoBoxW - 2;
    const ly = TITLE_Y + 2 * rowH + 1.5;
    rows.push(
      `<image href="${options.logoDataUrl}" x="${lx}" y="${ly}" width="${logoBoxW}" height="${logoBoxH}" preserveAspectRatio="xMidYMid meet" />`,
    );
  }

  return `<g>${rows.join("")}</g>`;
}

/**
 * Roughly clamp a string to a given column width so long names don't bleed
 * into the logo column. Inter at the font sizes we use is approximately 0.55
 * × fontSize per character wide; we pad slightly and ellipsise.
 */
function truncateForWidth(text: string, fontSizeMm: number, maxMm: number): string {
  if (!text) return text;
  const charMm = fontSizeMm * 0.55;
  const maxChars = Math.max(4, Math.floor(maxMm / charMm));
  if (text.length <= maxChars) return text;
  return text.slice(0, Math.max(1, maxChars - 1)) + "…";
}

/* ----- Diagram area ----------------------------------------------------- */

export interface DiagramAreaOptions {
  /** Restrict the rendered window to the given world-space bounds instead of
   *  auto-fitting all nodes. Used by the Drawings tab to reproduce a saved
   *  viewport. */
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
  /** Inner padding inside the drawing region, in mm. */
  padding?: number;
  /** Override just the *top* padding (the rest stays at `padding`). Used by
   *  drawing pages that draw a title strip across the top of the body. */
  topPadding?: number;
  /** Per-element colour overrides, keyed by node.id / edge.id. Anything not
   *  present uses the default print colour. */
  colorOverrides?: Record<string, string>;
  /** Per-edge line-thickness multiplier (1.0 = default for the line type).
   *  Only applied to pipes — components have a single drawn outline so a
   *  user-tweakable width doesn't make sense there. */
  widthOverrides?: Record<string, number>;
  /** Clip the rendered diagram to the drawing-area rectangle. Used when the
   *  page reproduces an exact captured viewport (bounds = the framed window),
   *  so any nodes that were only partly on-screen get cropped at the page edge
   *  instead of spilling over the frame / title block. */
  clip?: boolean;
}

const DEFAULT_INK = "#000";
const TAG_INK = "#0f172a";
/** Stroke-width multiplier translating the editor's CSS-pixel widths into
 *  drawing-mm. Tuned to match the heavy line work expected on printed
 *  engineering drawings; the floor keeps even the thinnest line type
 *  (utility / signal) visible at small scales. */
const STROKE_MM_FACTOR = 0.4;
const STROKE_MM_FLOOR = 0.55;

export function renderDiagramArea(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  options: DiagramAreaOptions = {},
): string {
  const padding = options.padding ?? 4;
  const topPad = options.topPadding ?? padding;
  const overrides = options.colorOverrides ?? {};
  const widthOverrides = options.widthOverrides ?? {};
  const innerX = DRAW_X + padding;
  const innerY = DRAW_Y + topPad;
  const innerW = DRAW_W - 2 * padding;
  const innerH = DRAW_H - topPad - padding;

  if (nodes.length === 0) {
    return `<g>${textAt(innerX + innerW / 2, innerY + innerH / 2, "Drag P&ID symbols onto the canvas to start.", 4, "middle")}</g>`;
  }

  const bounds = options.bounds ?? diagramBounds(nodes);
  const dw = Math.max(1, bounds.maxX - bounds.minX);
  const dh = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min(innerW / dw, innerH / dh);
  const offsetX = innerX + (innerW - dw * scale) / 2 - bounds.minX * scale;
  const offsetY = innerY + (innerH - dh * scale) / 2 - bounds.minY * scale;

  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  // Render edges + symbols in WORLD coordinates inside a single inner group,
  // then pose the whole group onto the page via translate(...) scale(...).
  // This is critical: getSmoothStepPath has a built-in offset that confuses
  // edges when called in tiny coordinate spaces — passing world coords lets
  // the router produce the same elbows the editor does. Stroke widths use
  // `vector-effect="non-scaling-stroke"` so they stay legible regardless of
  // diagram size.
  const innerEdges = edges
    .map((edge) =>
      renderEdgeWorld(
        edge,
        nodesById,
        overrides[edge.id],
        widthOverrides[edge.id],
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

  // Tags and edge labels render OUTSIDE the scaling group, in drawing-mm
  // coordinates and at fixed mm font sizes. Pulling them out of the scale
  // transform also means component tags stay axis-aligned even when the
  // component itself is rotated — matching the editor where the label sits
  // on the unrotated outer container.
  const tagMarkup = nodes
    .map((n) => renderNodeTag(n, scale, offsetX, offsetY, overrides[n.id]))
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

  const clipId = `dclip-${Math.random().toString(36).slice(2, 8)}`;
  const clipDef = options.clip
    ? `<defs><clipPath id="${clipId}"><rect x="${innerX.toFixed(3)}" y="${innerY.toFixed(3)}" width="${innerW.toFixed(3)}" height="${innerH.toFixed(3)}" /></clipPath></defs>`
    : "";
  const clipAttr = options.clip ? ` clip-path="url(#${clipId})"` : "";

  return `<g class="diagram">${clipDef}
    <g${clipAttr}>
      <g transform="translate(${offsetX.toFixed(3)} ${offsetY.toFixed(3)}) scale(${scale.toFixed(5)})">
        <g class="zones">${innerZones.join("")}</g>
        <g class="edges">${innerEdges.join("")}</g>
        <g class="nodes">${innerNodes.join("")}</g>
      </g>
      <g class="labels">${zoneLabels}${tagMarkup}${edgeLabels}</g>
    </g>
  </g>`;
}

function renderNodeWorld(node: DiagramNode, override?: string): string {
  const symbol = getSymbol(node.data.symbolType);
  if (!symbol) return "";

  const { Icon, size } = symbol;
  const rotation = node.data.rotation ?? 0;
  const ink = override ?? TAG_INK;

  const innerSvg = styleSymbolForPrint(
    renderToStaticMarkup(<Icon width={size.width} height={size.height} />),
    ink,
  );

  // Hit-area rect lives inside the rotated frame so it tracks the visible
  // symbol bounds. `pointer-events="all"` ensures clicks register even on
  // interior whitespace (most symbols are pure outlines with transparent
  // interior, which otherwise wouldn't catch clicks).
  const hitArea = `<rect x="0" y="0" width="${size.width}" height="${size.height}" fill="transparent" pointer-events="all" />`;

  // Only the SVG content is rotated — exactly like SymbolNode in the editor,
  // where rotation lives on the inner icon wrapper and the outer container
  // (which carries the label) stays axis-aligned.
  return `<g data-element-id="${escapeText(node.id)}" data-element-kind="node" transform="translate(${node.position.x.toFixed(3)} ${node.position.y.toFixed(3)}) ${
    rotation
      ? `rotate(${rotation} ${(size.width / 2).toFixed(3)} ${(size.height / 2).toFixed(3)})`
      : ""
  }">${hitArea}${innerSvg}</g>`;
}

function renderNodeTag(
  node: DiagramNode,
  scale: number,
  offsetX: number,
  offsetY: number,
  override?: string,
): string {
  const symbol = getSymbol(node.data.symbolType);
  if (!symbol) return "";
  const tag = node.data.tag ?? node.data.label ?? symbol.defaultLabel ?? "";
  if (!tag) return "";

  const { size } = symbol;
  const rotation = node.data.rotation ?? 0;
  const side = resolveTagSide(symbol.ports, rotation);
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
  const fill = override ?? TAG_INK;
  return `<text x="${x.toFixed(3)}" y="${y.toFixed(3)}" text-anchor="${anchor}" font-size="${fontSize.toFixed(2)}" font-family="Inter, Helvetica, Arial, sans-serif" fill="${fill}" pointer-events="none">${escapeText(tag)}</text>`;
}

/**
 * Strip Tailwind colour classes from React-rendered symbol SVGs and bake in a
 * concrete stroke colour so the symbol stays sharp and legible on a white
 * drawing sheet. The runtime CSS that powers the editor's dark theme would
 * otherwise leak into static renders via `class="text-zinc-200"`, drowning
 * the strokes. Also marks every stroked element with `pid-stroke` so a
 * selection highlight rule can quickly retarget them via CSS.
 */
function styleSymbolForPrint(svg: string, ink: string): string {
  return svg
    .replace(/\sclass="[^"]*"/g, "")
    .replace(/currentColor/g, ink)
    .replace(/<(path|line|circle|ellipse|polyline|polygon|rect)\s/g, '<$1 class="pid-stroke" ');
}

function renderEdgeWorld(
  edge: DiagramEdge,
  nodesById: Map<string, DiagramNode>,
  override?: string,
  widthMultiplier?: number,
): string {
  const source = nodesById.get(edge.source);
  const target = nodesById.get(edge.target);
  if (!source || !target) return "";

  const s = portWorldPosition(source, edge.sourceHandle);
  const t = portWorldPosition(target, edge.targetHandle);

  // Bolted (direct) joins carry no pipe — the two ports coincide, so draw a
  // small junction dot rather than a routed line.
  if (edge.data?.direct) {
    const cx = (s.x + t.x) / 2;
    const cy = (s.y + t.y) / 2;
    const fill = override ?? DEFAULT_INK;
    return `<g data-element-id="${escapeText(edge.id)}" data-element-kind="edge"><circle cx="${cx.toFixed(3)}" cy="${cy.toFixed(3)}" r="2.4" fill="${fill}" pointer-events="all" /></g>`;
  }

  // Cap the elbow radius when source/target are close. The editor's smooth
  // step path uses radius 8 — but on a very short segment that radius gets
  // squeezed, which (combined with non-scaling-stroke + small parent scale)
  // produces visibly thinner / broken rendering at the elbow. Scaling the
  // radius down keeps the geometry well-formed for close components.
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
    (a) =>
      getSmoothStepPath({
        sourceX: a.sourceX,
        sourceY: a.sourceY,
        targetX: a.targetX,
        targetY: a.targetY,
        sourcePosition: a.sourcePosition,
        targetPosition: a.targetPosition,
        borderRadius,
      }),
  );

  const lineType = edge.data?.lineType ?? "process";
  const style = LINE_STYLES[lineType];
  const stroke = override ?? DEFAULT_INK;
  const widthMult = widthMultiplier ?? 1;

  // With vector-effect="non-scaling-stroke" both stroke-width and
  // stroke-dasharray are interpreted in the SVG root's user units (mm here),
  // so we express them directly in drawing-mm rather than world units.
  const baseW =
    Math.max(STROKE_MM_FLOOR, style.strokeWidth * STROKE_MM_FACTOR) *
    widthMult;
  const dash = style.strokeDasharray
    ? style.strokeDasharray
        .split(/\s+/)
        .map((n) => (Number.parseFloat(n) * 0.22 * widthMult).toFixed(2))
        .join(" ")
    : undefined;

  // Wider, transparent hit area for easy clicking. Drawn *under* the visible
  // path inside the same data-element group so a click anywhere along the
  // pipe selects it.
  const hit = `<path d="${path}" fill="none" stroke="transparent" stroke-width="9" vector-effect="non-scaling-stroke" pointer-events="stroke" />`;

  const primary = `<path class="pid-stroke" d="${path}" fill="none" stroke="${stroke}" stroke-width="${baseW.toFixed(3)}" ${
    dash ? `stroke-dasharray="${dash}"` : ""
  } vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" pointer-events="none" />`;

  const overlay =
    style.pattern === "hash"
      ? `<path class="pid-stroke" d="${path}" fill="none" stroke="${stroke}" stroke-width="${(baseW + 0.7).toFixed(3)}" stroke-dasharray="0.2 2" vector-effect="non-scaling-stroke" pointer-events="none" />`
      : "";

  return `<g data-element-id="${escapeText(edge.id)}" data-element-kind="edge">${hit}${primary}${overlay}</g>`;
}

function renderEdgeLabel(
  edge: DiagramEdge,
  nodesById: Map<string, DiagramNode>,
  scale: number,
  offsetX: number,
  offsetY: number,
  override?: string,
): string {
  const tag = edge.data?.tag;
  if (!tag) return "";
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
    (a) => [
      "",
      (a.sourceX + a.targetX) / 2,
      (a.sourceY + a.targetY) / 2,
    ],
  );
  const mx = lx * scale + offsetX;
  const my = ly * scale + offsetY - 1;
  const fill = override ?? TAG_INK;
  return `<text x="${mx}" y="${my}" font-size="2.4" font-family="Inter, Helvetica, Arial, sans-serif" text-anchor="middle" fill="${fill}" pointer-events="none">${escapeText(tag)}</text>`;
}

/* ----- SVG primitives --------------------------------------------------- */

function line(x1: number, y1: number, x2: number, y2: number): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="black" stroke-width="${FRAME_STROKE}" />`;
}

export function textAt(
  x: number,
  y: number,
  text: string,
  size = 3,
  anchor: "start" | "middle" | "end" = "start",
  bold = false,
): string {
  return `<text x="${x}" y="${y}" font-size="${size}" font-family="Inter, Helvetica, Arial, sans-serif" text-anchor="${anchor}" ${
    bold ? 'font-weight="bold"' : ""
  } fill="#0f172a">${escapeText(text)}</text>`;
}

export function escapeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

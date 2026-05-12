/**
 * Page-level renderer for the Drawings tab. Each call produces one complete
 * A3-landscape SVG string (mm units) for the given DrawingPage.
 *
 * All pages share the ISO frame + title block; the body region renders
 * differently per page type (diagram snapshot, analysis report, BOM, blank).
 * Annotations are drawn on top in page-mm coordinates.
 */

import { getSmoothStepPath } from "@xyflow/react";
import { renderToStaticMarkup } from "react-dom/server";

import { getSymbol } from "@/symbols/registry";
import type { DiagramEdge, DiagramNode } from "@/store/diagramStore";
import type { ProjectMeta } from "@/store/projectStore";
import type {
  Annotation,
  AnalysisSnapshot,
  DrawingPage,
} from "@/store/drawingsStore";
import type { ComponentLoss, SinglePathResult } from "@/engine/types";

import {
  diagramBounds,
  portWorldPosition,
} from "./geometry";
import {
  DRAW_W,
  DRAW_X,
  DRAW_Y,
  escapeText,
  PAGE_H,
  PAGE_W,
  renderDiagramArea,
  renderFrame,
  renderTitleBlock,
  textAt,
  wrapSvg,
} from "./svgRender";
import { buildBom } from "./bom";

export interface PageRenderContext {
  meta: ProjectMeta;
  liveNodes: DiagramNode[];
  liveEdges: DiagramEdge[];
  companyLogo: string | null;
  pageNumber: number;
  totalPages: number;
  /** Skip baking annotations into the SVG — used by the in-app preview which
   *  paints them in an interactive overlay instead, so they can be moved /
   *  selected live without re-rendering the underlying drawing on every
   *  pointer event. */
  omitAnnotations?: boolean;
}

/* ------------------------- top-level dispatch --------------------------- */

export function renderDrawingPage(
  page: DrawingPage,
  ctx: PageRenderContext,
): string {
  const mergedMeta: ProjectMeta = { ...ctx.meta, ...page.titleBlock };

  let body = "";
  switch (page.type) {
    case "diagram":
      body = renderDiagramPageBody(page);
      break;
    case "analysis":
      body = renderAnalysisPageBody(page);
      break;
    case "bom":
      body = renderBomPageBody(page, ctx);
      break;
    case "blank":
      body = "";
      break;
  }

  const annotations = ctx.omitAnnotations
    ? ""
    : renderAnnotations(page.annotations);
  const titleBlock = renderTitleBlock(mergedMeta, {
    logoDataUrl: ctx.companyLogo,
    sheetOverride: {
      sheet: `${ctx.pageNumber}`,
      totalSheets: `${ctx.totalPages}`,
    },
  });
  const frame = renderFrame();

  // Page title strip across the top of the drawing area
  const header = page.title
    ? textAt(DRAW_X + 4, DRAW_Y + 6, page.title, 4.8, "start", true)
    : "";

  return wrapSvg(
    `${frame}\n${body}\n${annotations}\n${header}\n${titleBlock}`,
  );
}

/* ---------------------------- diagram page ------------------------------ */

function renderDiagramPageBody(page: DrawingPage): string {
  if (!page.diagram) return "";
  const { nodes, edges, bounds } = page.diagram;

  // The captured viewport bounds often include a lot of empty padding around
  // the actual components (because the user framed the editor canvas, not
  // tight content). To make the drawing fill the sheet, render only the
  // nodes that overlap the captured viewport, and rescale to their *tight*
  // bbox. Edges follow when both endpoints survive the filter.
  const visibleNodes = nodes.filter((n) => nodeIntersectsBounds(n, bounds));
  const renderedNodes = visibleNodes.length > 0 ? visibleNodes : nodes;
  const idSet = new Set(renderedNodes.map((n) => n.id));
  const renderedEdges = edges.filter(
    (e) => idSet.has(e.source) && idSet.has(e.target),
  );

  // Pad the tight bounds slightly so symbols don't kiss the edge of the
  // drawing area.
  const tight = diagramBounds(renderedNodes);
  const padW = (tight.maxX - tight.minX) * 0.04;
  const padH = (tight.maxY - tight.minY) * 0.04;
  const paddedBounds = {
    minX: tight.minX - padW,
    minY: tight.minY - padH,
    maxX: tight.maxX + padW,
    maxY: tight.maxY + padH,
  };

  return renderDiagramArea(renderedNodes, renderedEdges, {
    bounds: paddedBounds,
    // Asymmetric padding: reserve a fatter top strip for the page title
    // header that gets drawn over the body, but keep left/right/bottom tight
    // so the diagram fills the sheet.
    padding: 4,
    topPadding: 12,
    colorOverrides: page.colorOverrides,
    widthOverrides: page.widthOverrides,
  });
}

function nodeIntersectsBounds(
  node: DiagramNode,
  b: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  const sym = getSymbol(node.data.symbolType);
  const w = sym?.size.width ?? 64;
  const h = sym?.size.height ?? 64;
  const x = node.position.x;
  const y = node.position.y;
  return x < b.maxX && x + w > b.minX && y < b.maxY && y + h > b.minY;
}

/* ---------------------------- analysis page ----------------------------- */

/* ----- Pagination of long component breakdowns -------------------------- */

const MAIN_ROW_H = 5.5;
const SUB_ROW_H = 19.5;
/** Vertical room available for the table on the first analysis sheet, after
 *  the route preview, KPI cards, warnings, and section header are drawn. */
const FIRST_PAGE_TABLE_BUDGET_MM = 100;
/** Continuation sheets only carry a small header + table header, so they have
 *  far more room for component rows. */
const CONTINUATION_TABLE_BUDGET_MM = 195;

function componentRowHeight(c: ComponentLoss): number {
  return MAIN_ROW_H + (c.kind === "pipe" ? SUB_ROW_H : 0);
}

/** Walk forward from `startIdx` packing as many components into a single page
 *  as fit within the given budget. Always advances at least one component so
 *  even an oversize row makes progress. */
function componentsFittingFrom(
  components: ComponentLoss[],
  startIdx: number,
  budget: number,
): number {
  let used = 0;
  let count = 0;
  for (let i = startIdx; i < components.length; i++) {
    const h = componentRowHeight(components[i]);
    if (count > 0 && used + h > budget) break;
    used += h;
    count++;
    if (used > budget) break;
  }
  return Math.max(1, count);
}

export function paginateAnalysisComponents(
  components: ComponentLoss[],
): Array<{ start: number; end: number }> {
  if (components.length === 0) return [{ start: 0, end: 0 }];
  const slices: Array<{ start: number; end: number }> = [];
  let i = 0;
  let pageIdx = 0;
  while (i < components.length) {
    const budget =
      pageIdx === 0
        ? FIRST_PAGE_TABLE_BUDGET_MM
        : CONTINUATION_TABLE_BUDGET_MM;
    const fit = componentsFittingFrom(components, i, budget);
    slices.push({ start: i, end: i + fit });
    i += fit;
    pageIdx++;
  }
  return slices;
}

/* ----- Page-body renderer ----------------------------------------------- */

function renderAnalysisPageBody(page: DrawingPage): string {
  if (!page.analysis) return "";
  const a = page.analysis;
  const isContinuation = (a.pageIndex ?? 0) > 0;
  return isContinuation
    ? renderAnalysisContinuationPage(a)
    : renderAnalysisFirstPage(a);
}

function sliceComponents(a: AnalysisSnapshot): ComponentLoss[] {
  const slice = a.componentSlice ?? {
    start: 0,
    end: a.result.components.length,
  };
  return a.result.components.slice(slice.start, slice.end);
}

function renderAnalysisFirstPage(a: AnalysisSnapshot): string {
  const r = a.result;
  const margin = 6;
  const startX = DRAW_X + margin;
  const top = DRAW_Y + 12;
  const innerW = DRAW_W - 2 * margin;

  const parts: string[] = [];

  // ----- Header ---------------------------------------------------------
  parts.push(textAt(startX, top, "Hydraulic Analysis", 5.6, "start", true));
  parts.push(
    textAt(
      startX,
      top + 6,
      `${a.startLabel} → ${a.endLabel}   ·   fluid: ${a.fluidName}   ·   mode: ${
        a.mode === "forward" ? "natural operating point" : "target flow"
      }${a.mode === "inverse" && a.targetQM3h != null ? ` (${a.targetQM3h.toFixed(2)} m³/h)` : ""}`,
      3.0,
    ),
  );

  // ----- Top row: route preview + pump/system chart + operating-point cards
  // 3-column band at 70mm tall. Route preview anchors the left, the chart
  // takes the middle (so the visual story sits together: "here's the path,
  // here's how it behaves"), and the KPI cards live on the right as a
  // 2-col × 3-row stack.
  const topRowY = top + 12;
  const gap = 3;
  const colW = (innerW - 2 * gap) / 3;
  const previewW = colW;
  const chartW = colW;
  const cardsW = innerW - previewW - chartW - 2 * gap;
  const previewH = 70;
  parts.push(renderRoutePreviewBlock(a, startX, topRowY, previewW, previewH));

  const chartX = startX + previewW + gap;
  parts.push(renderPumpSystemChartBlock(a, chartX, topRowY, chartW, previewH));

  const cardsX = chartX + chartW + gap;
  parts.push(
    renderOperatingPointCards(r, a, cardsX, topRowY, cardsW, previewH),
  );

  let cursorY = topRowY + previewH + 4;

  // ----- Warnings / feasibility -----------------------------------------
  if (r.feasibility.message) {
    parts.push(
      `<rect x="${startX}" y="${cursorY}" width="${innerW}" height="8" fill="#fff7ed" stroke="#fb923c" stroke-width="0.3" rx="1" />`,
    );
    parts.push(
      textAt(
        startX + 2,
        cursorY + 5.5,
        `WARNING  ${r.feasibility.message}`,
        2.8,
        "start",
        true,
      ),
    );
    cursorY += 10;
  }
  for (const w of r.warnings) {
    parts.push(textAt(startX + 2, cursorY + 3, `· ${w}`, 2.6, "start"));
    cursorY += 4.5;
  }

  // ----- Per-component breakdown table ----------------------------------
  cursorY += 4;
  const total = a.totalPages ?? 1;
  const sectionTitle =
    total > 1
      ? `Per-component breakdown — page 1 of ${total}`
      : "Per-component breakdown";
  parts.push(textAt(startX, cursorY, sectionTitle, 4.2, "start", true));
  cursorY += 3;

  const slice = sliceComponents(a);
  parts.push(renderComponentTable(slice, a, startX, cursorY, innerW));

  return `<g>${parts.join("")}</g>`;
}

function renderAnalysisContinuationPage(a: AnalysisSnapshot): string {
  const margin = 6;
  const startX = DRAW_X + margin;
  const top = DRAW_Y + 12;
  const innerW = DRAW_W - 2 * margin;
  const pageIndex = a.pageIndex ?? 0;
  const total = a.totalPages ?? 1;

  const parts: string[] = [];

  // Compact header — restates the route + page-of-N so the sheet is
  // self-identifying without re-rendering the (heavy) overview.
  parts.push(
    textAt(
      startX,
      top,
      `Hydraulic Analysis · ${a.startLabel} → ${a.endLabel} (continued)`,
      5.0,
      "start",
      true,
    ),
  );
  parts.push(
    textAt(
      startX,
      top + 6,
      `Per-component breakdown — page ${pageIndex + 1} of ${total}   ·   fluid: ${a.fluidName}   ·   Q = ${a.result.qM3h.toFixed(2)} m³/h`,
      2.8,
    ),
  );

  const tableY = top + 11;
  const slice = sliceComponents(a);
  parts.push(renderComponentTable(slice, a, startX, tableY, innerW));

  return `<g>${parts.join("")}</g>`;
}

function renderOperatingPointCards(
  r: SinglePathResult,
  a: AnalysisSnapshot,
  x: number,
  y: number,
  w: number,
  h: number,
): string {
  const cards = [
    {
      label: a.mode === "forward" ? "Predicted flow" : "Target flow",
      value: `${r.qM3h.toFixed(2)} m³/h`,
      hint: `${(r.qM3h / 3.6).toFixed(2)} L/s`,
    },
    {
      label: "Pump head delivered",
      value: `${r.pumpHeadM.toFixed(2)} m`,
      hint: `shutoff ${r.pumpShutoffHeadM.toFixed(2)} m`,
    },
    {
      label: "System head required",
      value: `${r.systemHeadM.toFixed(2)} m`,
      hint: `${(r.systemHeadM * 0.0981).toFixed(3)} bar (water-equivalent)`,
    },
    {
      label: "Elevation change",
      value: `${r.elevationDeltaM >= 0 ? "+" : ""}${r.elevationDeltaM.toFixed(2)} m`,
      hint: r.elevationDeltaM >= 0 ? "climb along route" : "drop along route",
    },
    {
      label: "Feasibility",
      value: r.feasibility.ok ? "OK" : "Infeasible",
      hint: r.feasibility.ok
        ? "duty point achievable"
        : r.feasibility.reason ?? "see warning",
    },
    {
      label: "Components",
      value: `${r.components.length}`,
      hint: `${r.components.filter((c) => c.kind === "pipe").length} pipes`,
    },
  ];

  const cols = 2;
  const rows = Math.ceil(cards.length / cols);
  const cellW = (w - (cols - 1) * 2) / cols;
  const cellH = (h - (rows - 1) * 2) / rows;
  const parts: string[] = [];
  cards.forEach((c, i) => {
    const cx = x + (i % cols) * (cellW + 2);
    const cy = y + Math.floor(i / cols) * (cellH + 2);
    parts.push(
      `<rect x="${cx}" y="${cy}" width="${cellW}" height="${cellH}" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.3" rx="1.5" />`,
    );
    parts.push(textAt(cx + 2, cy + 4, c.label, 2.3, "start"));
    parts.push(textAt(cx + 2, cy + 9, c.value, 4.2, "start", true));
    parts.push(textAt(cx + 2, cy + cellH - 1.5, c.hint, 2.2, "start"));
  });
  return parts.join("");
}

/* ----- Pump vs System chart (static SVG) -------------------------------- */

type Domain = [number, number];

/** Replicates the PumpSystemChart computeNaturalDomains so the drawing
 *  matches what the user saw in the live Analysis tab. */
function computeChartDomains(r: SinglePathResult): { x: Domain; y: Domain } {
  const opQ = Math.max(0, r.qM3h);
  const opH = Math.max(0, r.pumpHeadM);
  const shutoff = Math.max(0, r.pumpShutoffHeadM);
  const elev = Math.max(0, r.elevationDeltaM);
  const maxAchievable = Math.max(0, r.feasibility.maxAchievableQM3h ?? 0);
  const pumpEnd = lastNonZeroQ(r.pumpCurveSampled);

  let xMax = 0;
  if (opQ > 0) xMax = opQ * 1.6;
  else if (maxAchievable > 0) xMax = maxAchievable * 1.6;
  else if (shutoff > 0 && pumpEnd > 0) xMax = pumpEnd * 1.05;
  if (!Number.isFinite(xMax) || xMax <= 0) xMax = 10;
  xMax = niceCeil(xMax);

  let yMax = Math.max(opH * 1.3, shutoff * 1.15, elev * 1.4, r.systemHeadM * 1.3, 2);
  if (!Number.isFinite(yMax) || yMax <= 0) yMax = 10;
  yMax = niceCeil(yMax);

  return { x: [0, xMax], y: [0, yMax] };
}

function lastNonZeroQ(points: { q: number; h: number }[]): number {
  let last = 0;
  for (const p of points) {
    if (p.h > 0.05) last = p.q;
  }
  return last;
}

function niceCeil(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  const norm = v / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

/** Produce 4–6 "nice" tick values across the domain (Wilkinson-style but
 *  cheap: just pick 1/2/5 × 10^n that gives the right tick count). */
function niceTicks(min: number, max: number, target = 5): number[] {
  const range = Math.max(1e-9, max - min);
  const rough = range / target;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) {
    ticks.push(Number(v.toFixed(10)));
  }
  return ticks;
}

function fmtNumber(v: number): string {
  if (!Number.isFinite(v)) return "";
  const abs = Math.abs(v);
  if (abs >= 100) return v.toFixed(0);
  if (abs >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

function renderPumpSystemChartBlock(
  a: AnalysisSnapshot,
  x: number,
  y: number,
  w: number,
  h: number,
): string {
  const r = a.result;
  const parts: string[] = [];

  parts.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.3" rx="1.5" />`,
  );
  parts.push(textAt(x + 2, y + 4, "Pump vs system curve", 2.6, "start", true));

  // Inline legend along the title row, right-aligned.
  const legendY = y + 3.3;
  const legendItems = [
    { label: "Pump", color: "#0284c7" },
    { label: "System", color: "#e11d48" },
  ];
  let lx = x + w - 2;
  for (let i = legendItems.length - 1; i >= 0; i--) {
    const item = legendItems[i];
    parts.push(
      `<text x="${lx.toFixed(2)}" y="${(legendY + 1).toFixed(2)}" font-size="2.1" font-family="Inter, Helvetica, Arial, sans-serif" fill="#475569" text-anchor="end">${escapeText(item.label)}</text>`,
    );
    lx -= item.label.length * 1.1 + 1;
    parts.push(
      `<line x1="${(lx - 4).toFixed(2)}" y1="${(legendY).toFixed(2)}" x2="${lx.toFixed(2)}" y2="${(legendY).toFixed(2)}" stroke="${item.color}" stroke-width="0.8" />`,
    );
    lx -= 6;
  }

  // Inner plot area.
  const ml = 12; // left axis room
  const mr = 3;
  const mt = 7;
  const mb = 9;
  const px = x + ml;
  const py = y + mt;
  const pw = w - ml - mr;
  const ph = h - mt - mb;

  if (r.pumpCurveSampled.length === 0 && r.systemCurveSampled.length === 0) {
    parts.push(
      textAt(
        x + w / 2,
        y + h / 2,
        "(no curve data available)",
        2.6,
        "middle",
      ),
    );
    return parts.join("");
  }

  const { x: xDom, y: yDom } = computeChartDomains(r);
  const sx = (q: number) => px + ((q - xDom[0]) / (xDom[1] - xDom[0])) * pw;
  const sy = (head: number) =>
    py + ph - ((head - yDom[0]) / (yDom[1] - yDom[0])) * ph;

  // Plot background + gridlines.
  parts.push(
    `<rect x="${px.toFixed(2)}" y="${py.toFixed(2)}" width="${pw.toFixed(2)}" height="${ph.toFixed(2)}" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.25" />`,
  );

  const xTicks = niceTicks(xDom[0], xDom[1], 5);
  const yTicks = niceTicks(yDom[0], yDom[1], 4);

  for (const t of xTicks) {
    const tx = sx(t);
    parts.push(
      `<line x1="${tx.toFixed(2)}" y1="${py.toFixed(2)}" x2="${tx.toFixed(2)}" y2="${(py + ph).toFixed(2)}" stroke="#e2e8f0" stroke-width="0.2" stroke-dasharray="0.4 0.6" />`,
    );
    parts.push(
      `<text x="${tx.toFixed(2)}" y="${(py + ph + 3).toFixed(2)}" font-size="1.9" font-family="Inter, Helvetica, Arial, sans-serif" fill="#475569" text-anchor="middle">${escapeText(fmtNumber(t))}</text>`,
    );
  }
  for (const t of yTicks) {
    const ty = sy(t);
    parts.push(
      `<line x1="${px.toFixed(2)}" y1="${ty.toFixed(2)}" x2="${(px + pw).toFixed(2)}" y2="${ty.toFixed(2)}" stroke="#e2e8f0" stroke-width="0.2" stroke-dasharray="0.4 0.6" />`,
    );
    parts.push(
      `<text x="${(px - 1).toFixed(2)}" y="${(ty + 0.7).toFixed(2)}" font-size="1.9" font-family="Inter, Helvetica, Arial, sans-serif" fill="#475569" text-anchor="end">${escapeText(fmtNumber(t))}</text>`,
    );
  }

  // Axis titles.
  parts.push(
    `<text x="${(px + pw / 2).toFixed(2)}" y="${(py + ph + 6.5).toFixed(2)}" font-size="2.1" font-family="Inter, Helvetica, Arial, sans-serif" fill="#475569" text-anchor="middle">Q (m³/h)</text>`,
  );
  parts.push(
    `<text x="${(px - 8).toFixed(2)}" y="${(py + ph / 2).toFixed(2)}" font-size="2.1" font-family="Inter, Helvetica, Arial, sans-serif" fill="#475569" text-anchor="middle" transform="rotate(-90 ${(px - 8).toFixed(2)} ${(py + ph / 2).toFixed(2)})">H (m)</text>`,
  );

  // Optional elevation reference line.
  if (r.elevationDeltaM > 0.05 && r.elevationDeltaM >= yDom[0] && r.elevationDeltaM <= yDom[1]) {
    const ey = sy(r.elevationDeltaM);
    parts.push(
      `<line x1="${px.toFixed(2)}" y1="${ey.toFixed(2)}" x2="${(px + pw).toFixed(2)}" y2="${ey.toFixed(2)}" stroke="#94a3b8" stroke-width="0.35" stroke-dasharray="1.2 1.2" />`,
    );
    parts.push(
      `<text x="${(px + pw - 1).toFixed(2)}" y="${(ey - 0.8).toFixed(2)}" font-size="1.8" font-family="Inter, Helvetica, Arial, sans-serif" fill="#64748b" text-anchor="end">Static lift ${r.elevationDeltaM.toFixed(1)} m</text>`,
    );
  }

  // Curves: pump (cyan) and system (rose). Clip to the plot region so the
  // system curve doesn't shoot off the chart with Q² losses.
  const clipId = `pidchart-${Math.floor(Math.random() * 1e9).toString(36)}`;
  parts.push(
    `<defs><clipPath id="${clipId}"><rect x="${px.toFixed(2)}" y="${py.toFixed(2)}" width="${pw.toFixed(2)}" height="${ph.toFixed(2)}" /></clipPath></defs>`,
  );

  const pumpPath = curveToPath(r.pumpCurveSampled, sx, sy);
  const systemPath = curveToPath(r.systemCurveSampled, sx, sy);
  if (pumpPath) {
    parts.push(
      `<path d="${pumpPath}" fill="none" stroke="#0284c7" stroke-width="0.6" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#${clipId})" />`,
    );
  }
  if (systemPath) {
    parts.push(
      `<path d="${systemPath}" fill="none" stroke="#e11d48" stroke-width="0.6" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#${clipId})" />`,
    );
  }

  // Operating point dot — only meaningful when there's a real flow.
  if (r.qM3h > 0) {
    const ox = sx(r.qM3h);
    const oy = sy(r.pumpHeadM);
    parts.push(
      `<circle cx="${ox.toFixed(2)}" cy="${oy.toFixed(2)}" r="1.3" fill="#fde047" stroke="#0f172a" stroke-width="0.3" />`,
    );
    parts.push(
      `<text x="${(ox + 2).toFixed(2)}" y="${(oy - 0.6).toFixed(2)}" font-size="2.0" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="600" fill="#0f172a">${escapeText(`Q=${r.qM3h.toFixed(2)} m³/h, H=${r.pumpHeadM.toFixed(2)} m`)}</text>`,
    );
  }

  return parts.join("");
}

function curveToPath(
  points: { q: number; h: number }[],
  sx: (q: number) => number,
  sy: (h: number) => number,
): string {
  if (points.length === 0) return "";
  const sorted = [...points].sort((a, b) => a.q - b.q);
  const segs: string[] = [];
  let pen = false;
  for (const p of sorted) {
    if (!Number.isFinite(p.h)) {
      pen = false;
      continue;
    }
    const X = sx(p.q).toFixed(2);
    const Y = sy(p.h).toFixed(2);
    segs.push(`${pen ? "L" : "M"}${X} ${Y}`);
    pen = true;
  }
  return segs.join(" ");
}

function renderRoutePreviewBlock(
  a: AnalysisSnapshot,
  x: number,
  y: number,
  w: number,
  h: number,
): string {
  const parts: string[] = [];
  parts.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.3" rx="1.5" />`,
  );
  parts.push(textAt(x + 2, y + 4, "Route preview", 2.6, "start", true));
  parts.push(
    `<line x1="${x + w - 24}" y1="${y + 3}" x2="${x + w - 20}" y2="${y + 3}" stroke="#f59e0b" stroke-width="0.8" />`,
  );
  parts.push(textAt(x + w - 19, y + 4, "on route", 2.1, "start"));

  // Inner draw area.
  const ix = x + 2;
  const iy = y + 6;
  const iw = w - 4;
  const ih = h - 8;

  if (a.nodes.length === 0) {
    parts.push(
      textAt(ix + iw / 2, iy + ih / 2, "(no diagram captured)", 2.6, "middle"),
    );
    return parts.join("");
  }

  const pathNodeIds = new Set(a.pathNodeIds);
  const pathEdgeIds = new Set(a.pathEdgeIds);
  const hasPath = pathNodeIds.size > 0;

  // Compute fit transform from world coords → drawing-mm. Critically, we
  // call getSmoothStepPath at WORLD scale (matching the editor + Analysis
  // RoutePreview) and wrap the whole group in a scaling transform with
  // `vector-effect="non-scaling-stroke"`, so the elbow geometry is identical
  // to what the user sees in the editor — no extra bends from a tiny coord
  // space confusing React Flow's default offset.
  const bounds = diagramBounds(a.nodes);
  const dw = Math.max(1, bounds.maxX - bounds.minX);
  const dh = Math.max(1, bounds.maxY - bounds.minY);
  const pad = Math.max(dw, dh) * 0.06;
  const padded = {
    minX: bounds.minX - pad,
    minY: bounds.minY - pad,
    maxX: bounds.maxX + pad,
    maxY: bounds.maxY + pad,
  };
  const padW = padded.maxX - padded.minX;
  const padH = padded.maxY - padded.minY;
  const scale = Math.min(iw / padW, ih / padH);
  const offX = ix + (iw - padW * scale) / 2 - padded.minX * scale;
  const offY = iy + (ih - padH * scale) / 2 - padded.minY * scale;

  const nodesById = new Map(a.nodes.map((n) => [n.id, n]));
  const innerParts: string[] = [];

  // Edges in world coords (so routing matches the editor exactly).
  for (const edge of a.edges) {
    const source = nodesById.get(edge.source);
    const target = nodesById.get(edge.target);
    if (!source || !target) continue;
    const s = portWorldPosition(source, edge.sourceHandle);
    const t = portWorldPosition(target, edge.targetHandle);
    const [d] = getSmoothStepPath({
      sourceX: s.x,
      sourceY: s.y,
      targetX: t.x,
      targetY: t.y,
      sourcePosition: s.position,
      targetPosition: t.position,
      borderRadius: 8,
    });
    const onPath = pathEdgeIds.has(edge.id);
    const stroke = hasPath ? (onPath ? "#f59e0b" : "#94a3b8") : "#0f172a";
    // Stroke widths in *output mm* (after the parent scale transform thanks
    // to vector-effect="non-scaling-stroke").
    const sw = hasPath && onPath ? 1.1 : 0.5;
    const opacity = hasPath ? (onPath ? 1 : 0.35) : 0.85;
    innerParts.push(
      `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-opacity="${opacity}" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" />`,
    );
  }

  // Nodes in world coords.
  for (const node of a.nodes) {
    const symbol = getSymbol(node.data.symbolType);
    if (!symbol) continue;
    const { Icon, size } = symbol;
    const rotation = (node.data.rotation as number | undefined) ?? 0;
    const onPath = pathNodeIds.has(node.id);
    const isEndpoint = node.id === a.startId || node.id === a.endId;
    const opacity = hasPath ? (onPath ? 1 : 0.35) : 0.85;
    const symbolSvg = stylePreviewSymbol(
      renderToStaticMarkup(<Icon width={size.width} height={size.height} />),
      isEndpoint ? "#b45309" : "#0f172a",
    );
    innerParts.push(
      `<g transform="translate(${node.position.x} ${node.position.y}) ${
        rotation
          ? `rotate(${rotation} ${size.width / 2} ${size.height / 2})`
          : ""
      }" opacity="${opacity}">${symbolSvg}</g>`,
    );
  }

  // Outer wrapper: pose the preview onto the page using a single scale + translate
  // transform. Stroke widths above already opt out of scaling so they stay legible.
  parts.push(
    `<g transform="translate(${offX.toFixed(3)} ${offY.toFixed(3)}) scale(${scale.toFixed(5)})">${innerParts.join(
      "",
    )}</g>`,
  );

  // Endpoint tag labels rendered OUTSIDE the scaling group so font-size stays
  // in drawing-mm units.
  for (const node of a.nodes) {
    if (node.id !== a.startId && node.id !== a.endId) continue;
    const symbol = getSymbol(node.data.symbolType);
    if (!symbol) continue;
    const cx = (node.position.x + symbol.size.width / 2) * scale + offX;
    const cy = (node.position.y + symbol.size.height) * scale + offY;
    const tag = node.data.tag ?? node.data.label ?? symbol.defaultLabel ?? "";
    parts.push(
      `<text x="${cx.toFixed(3)}" y="${(cy + 2.4).toFixed(3)}" font-size="2.3" font-family="Inter, Helvetica, Arial, sans-serif" text-anchor="middle" font-weight="600" fill="#b45309">${escapeText(tag)}</text>`,
    );
  }

  return parts.join("");
}

/** Replicate the symbol post-processing from svgRender, parameterised on the
 *  stroke colour, so the route preview can highlight endpoints in amber. */
function stylePreviewSymbol(svg: string, color: string): string {
  return svg
    .replace(/\sclass="[^"]*"/g, "")
    .replace(/currentColor/g, color);
}

/**
 * Per-component breakdown laid out like the Analysis tab's "Where does the
 * head go?" table: one summary row per component, with an indented two-column
 * sub-block (Loss breakdown / Pipe geometry) under each pipe.
 *
 * `slice` is the pre-paginated subset of components we render here. The
 * caller is responsible for choosing what fits — this function will draw the
 * whole slice and only emit a defensive truncation notice if some genuinely
 * undersized layout still overflows.
 */
function renderComponentTable(
  slice: ComponentLoss[],
  a: AnalysisSnapshot,
  x: number,
  y: number,
  w: number,
): string {
  const parts: string[] = [];

  // Columns mirror the Analysis tab: Component | Type | Δp (bar) | Head (m) |
  // Speed (m/s) | Flow regime | Re. The remaining width is left padding.
  const cols = [
    { label: "Component", w: w * 0.32, align: "start" as const },
    { label: "Type", w: w * 0.1, align: "start" as const },
    {
      label: "Pressure drop",
      unit: "bar",
      w: w * 0.13,
      align: "end" as const,
    },
    { label: "Head loss", unit: "m", w: w * 0.1, align: "end" as const },
    { label: "Speed", unit: "m/s", w: w * 0.09, align: "end" as const },
    { label: "Flow regime", w: w * 0.13, align: "start" as const },
    { label: "Re", w: w * 0.13, align: "end" as const },
  ];

  // Header row
  parts.push(
    `<rect x="${x}" y="${y}" width="${w}" height="7" fill="#0f172a" />`,
  );
  let cx = x;
  cols.forEach((c) => {
    const tx = c.align === "end" ? cx + c.w - 1.5 : cx + 1.5;
    parts.push(
      `<text x="${tx}" y="${y + 3.6}" font-size="2.3" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="600" fill="#e2e8f0" text-anchor="${c.align}">${escapeText(c.label.toUpperCase())}</text>`,
    );
    if (c.unit) {
      parts.push(
        `<text x="${tx}" y="${y + 6}" font-size="1.8" font-family="Inter, Helvetica, Arial, sans-serif" fill="#64748b" text-anchor="${c.align}">${escapeText(c.unit)}</text>`,
      );
    }
    cx += c.w;
  });

  let rowY = y + 7;
  const mainRowH = 5.5;
  const subRowH = 18;
  const sliceOffset = a.componentSlice?.start ?? 0;

  // Room available until the title block / page footer. We pre-paginated so
  // this should never trigger, but it's a defensive backstop for unusually
  // tall content.
  const availableBottomY = PAGE_H - 65;
  let truncated = 0;

  for (let i = 0; i < slice.length; i++) {
    const c = slice[i];
    const needsSub = c.kind === "pipe";
    const totalRowH = mainRowH + (needsSub ? subRowH : 0);
    if (rowY + totalRowH > availableBottomY) {
      truncated = slice.length - i;
      break;
    }

    // Zebra-stripe by global component index so striping stays continuous
    // across continuation pages.
    const globalIdx = sliceOffset + i;
    const stripe = globalIdx % 2 === 0 ? "#ffffff" : "#f8fafc";
    parts.push(
      `<rect x="${x}" y="${rowY}" width="${w}" height="${totalRowH}" fill="${stripe}" />`,
    );

    // ---- main row ----
    const kind = c.kind === "pipe" ? "Pipe" : prettyKind(c.kind);
    const dpBar = (c.deltaPpa / 1e5).toFixed(4);
    const headM = c.headM.toFixed(3);
    const speed = c.velocityMs != null ? c.velocityMs.toFixed(2) : "—";
    const re =
      c.reynolds != null ? Math.round(c.reynolds).toLocaleString() : "—";

    const values: { text: string; bold?: boolean }[] = [
      { text: truncate(c.label, cols[0].w), bold: true },
      { text: kind },
      { text: dpBar },
      { text: headM },
      { text: speed },
      { text: "" }, // regime drawn as a badge separately
      { text: re },
    ];
    cx = x;
    values.forEach((v, idx) => {
      const col = cols[idx];
      const tx =
        col.align === "end" ? cx + col.w - 1.5 : cx + 1.5;
      parts.push(
        `<text x="${tx}" y="${rowY + 3.8}" font-size="2.5" font-family="Inter, Helvetica, Arial, sans-serif" ${
          v.bold ? 'font-weight="600"' : ""
        } fill="#0f172a" text-anchor="${col.align}">${escapeText(v.text)}</text>`,
      );
      cx += col.w;
    });

    const regimeColX = x + cols.slice(0, 5).reduce((a, b) => a + b.w, 0);
    parts.push(renderRegimeBadge(c.reynolds, regimeColX + 1.5, rowY + 1));

    rowY += mainRowH;

    if (needsSub) {
      const subX = x + 4;
      const subW = w - 8;
      const colW = (subW - 8) / 2;
      renderLossBreakdownBlock(parts, c, subX, rowY + 1, colW);
      renderPipeGeometryBlock(parts, c, subX + colW + 8, rowY + 1, colW);
      rowY += subRowH;
    }
  }

  if (truncated > 0) {
    parts.push(
      textAt(
        x,
        rowY + 3,
        `… ${truncated} more component${truncated === 1 ? "" : "s"} omitted on this sheet.`,
        2.2,
        "start",
      ),
    );
  }

  return parts.join("");
}

/** Inline regime pill — colour-coded laminar / transition / turbulent. */
function renderRegimeBadge(
  re: number | null | undefined,
  x: number,
  y: number,
): string {
  if (re == null || !Number.isFinite(re)) {
    return `<text x="${x}" y="${y + 3}" font-size="2.4" fill="#94a3b8">—</text>`;
  }
  let label: string;
  let fill: string;
  let stroke: string;
  if (re < 2300) {
    label = "Laminar";
    fill = "#dbeafe";
    stroke = "#3b82f6";
  } else if (re < 4000) {
    label = "Transition";
    fill = "#fef3c7";
    stroke = "#f59e0b";
  } else {
    label = "Turbulent";
    fill = "#dcfce7";
    stroke = "#16a34a";
  }
  const padX = 1.2;
  const w = label.length * 1.45 + 2 * padX;
  const h = 3.4;
  return (
    `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h}" rx="1" fill="${fill}" stroke="${stroke}" stroke-width="0.3" />` +
    `<text x="${(x + w / 2).toFixed(2)}" y="${(y + 2.4).toFixed(2)}" font-size="2.1" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="600" fill="${stroke}" text-anchor="middle">${escapeText(label)}</text>`
  );
}

/** "LOSS BREAKDOWN" sub-block with three lines + percentages. */
function renderLossBreakdownBlock(
  out: string[],
  c: ComponentLoss,
  x: number,
  y: number,
  w: number,
) {
  out.push(
    `<text x="${x}" y="${y + 2.2}" font-size="2.0" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="600" fill="#64748b" letter-spacing="0.4">${escapeText("LOSS BREAKDOWN")}</text>`,
  );
  const lines: { label: string; v?: number }[] = [
    { label: "Friction (pipe wall)", v: c.frictionHeadM },
    { label: "Fittings (minor losses)", v: c.fittingsHeadM },
    {
      label:
        (c.elevationHeadM ?? 0) >= 0
          ? "Elevation rise"
          : "Elevation drop (recovers head)",
      v: c.elevationHeadM,
    },
  ];
  let cy = y + 5.5;
  for (const ln of lines) {
    if (ln.v == null) continue;
    const sign = ln.v >= 0 ? "+" : "−";
    const mag = Math.abs(ln.v).toFixed(3);
    const pct =
      c.headM !== 0 ? ` (${Math.round((ln.v / c.headM) * 100)} %)` : "";
    out.push(
      `<text x="${x}" y="${cy}" font-size="2.2" font-family="Inter, Helvetica, Arial, sans-serif" fill="#475569">${escapeText(ln.label)}</text>`,
    );
    out.push(
      `<text x="${x + w - 1}" y="${cy}" font-size="2.2" font-family="Courier, monospace" fill="#0f172a" text-anchor="end">${escapeText(sign + mag + " m" + pct)}</text>`,
    );
    cy += 3.6;
  }
}

/** "PIPE GEOMETRY" sub-block with length / inner ⌀ / roughness / fittings. */
function renderPipeGeometryBlock(
  out: string[],
  c: ComponentLoss,
  x: number,
  y: number,
  w: number,
) {
  out.push(
    `<text x="${x}" y="${y + 2.2}" font-size="2.0" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="600" fill="#64748b" letter-spacing="0.4">${escapeText("PIPE GEOMETRY")}</text>`,
  );
  const rows: { label: string; value: string }[] = [
    {
      label: "Length:",
      value: c.lengthM != null ? `${c.lengthM.toFixed(2)} m` : "—",
    },
    {
      label: "Inner ⌀:",
      value:
        c.innerDiameterMm != null
          ? `${c.innerDiameterMm.toFixed(2)} mm`
          : "—",
    },
    {
      label: "Wall roughness:",
      value:
        c.roughnessMm != null ? `${c.roughnessMm.toFixed(3)} mm` : "—",
    },
    {
      label: "Fittings:",
      value:
        c.fittingsSummary && c.fittingsSummary.length > 0
          ? truncate(c.fittingsSummary, w)
          : "none",
    },
  ];
  let cy = y + 5.5;
  for (const r of rows) {
    out.push(
      `<text x="${x}" y="${cy}" font-size="2.2" font-family="Inter, Helvetica, Arial, sans-serif" fill="#64748b">${escapeText(r.label)}</text>`,
    );
    out.push(
      `<text x="${x + 22}" y="${cy}" font-size="2.2" font-family="Inter, Helvetica, Arial, sans-serif" font-weight="600" fill="#0f172a">${escapeText(r.value)}</text>`,
    );
    cy += 3.4;
  }
}

function prettyKind(kind: string): string {
  switch (kind) {
    case "pump":
      return "Pump";
    case "valve":
      return "Valve";
    case "pipe":
      return "Pipe";
    case "fitting":
      return "Fitting";
    case "vessel":
      return "Vessel";
    case "passive":
      return "Equipment";
    default:
      return kind
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
  }
}

/* --------------------------- BOM page ----------------------------------- */

function renderBomPageBody(page: DrawingPage, ctx: PageRenderContext): string {
  const cfg = page.bom ?? { includePipes: true };
  const bom = buildBom(ctx.liveNodes, ctx.liveEdges, { includePipes: cfg.includePipes });

  const lines: string[] = [];
  const startX = DRAW_X + 6;
  let cursorY = DRAW_Y + 14;

  lines.push(
    textAt(startX, cursorY, "Bill of Materials", 5.6, "start", true),
  );
  cursorY += 4;
  lines.push(
    textAt(
      startX,
      cursorY,
      `${bom.equipment.length} equipment items · ${bom.pipes.length} pipe specs · ${bom.fittings.length} fitting types`,
      3,
    ),
  );
  cursorY += 6;

  // Equipment table
  const tableW = DRAW_W - 12;
  const eqCols = [
    { label: "#", w: tableW * 0.04 },
    { label: "Tag", w: tableW * 0.1 },
    { label: "Description", w: tableW * 0.24 },
    { label: "Category", w: tableW * 0.12 },
    { label: "Size", w: tableW * 0.1 },
    { label: "Material", w: tableW * 0.12 },
    { label: "Qty", w: tableW * 0.05 },
    { label: "Remarks", w: tableW * 0.23 },
  ];
  cursorY = drawTableHeader(
    lines,
    startX,
    cursorY,
    "Equipment",
    eqCols.map((c) => c.label),
    eqCols.map((c) => c.w),
  );

  const eqRowH = 4.4;
  for (const row of bom.equipment) {
    cursorY = drawTableRow(
      lines,
      startX,
      cursorY,
      [
        String(row.itemNo),
        row.tag,
        row.description,
        row.category,
        row.size ?? "—",
        row.material ?? "—",
        String(row.quantity),
        row.remarks ?? "",
      ],
      eqCols.map((c) => c.w),
      eqRowH,
      row.itemNo % 2 === 0,
    );
    if (cursorY > PAGE_H - 70) {
      lines.push(textAt(startX, cursorY + 2, "… truncated to fit page", 2.6));
      break;
    }
  }

  cursorY += 4;

  if (cfg.includePipes && bom.pipes.length > 0 && cursorY < PAGE_H - 90) {
    const pipeCols = [
      { label: "#", w: tableW * 0.04 },
      { label: "Description", w: tableW * 0.32 },
      { label: "Material", w: tableW * 0.2 },
      { label: "Size", w: tableW * 0.18 },
      { label: "Length (m)", w: tableW * 0.13 },
      { label: "Segments", w: tableW * 0.13 },
    ];
    cursorY = drawTableHeader(
      lines,
      startX,
      cursorY,
      "Process pipes",
      pipeCols.map((c) => c.label),
      pipeCols.map((c) => c.w),
    );
    for (const row of bom.pipes) {
      cursorY = drawTableRow(
        lines,
        startX,
        cursorY,
        [
          String(row.itemNo),
          row.description,
          row.material ?? "—",
          row.size ?? "—",
          row.totalLengthM.toFixed(2),
          String(row.segments),
        ],
        pipeCols.map((c) => c.w),
        eqRowH,
        row.itemNo % 2 === 0,
      );
      if (cursorY > PAGE_H - 70) {
        lines.push(textAt(startX, cursorY + 2, "… truncated to fit page", 2.6));
        break;
      }
    }
    cursorY += 4;
  }

  if (cfg.includePipes && bom.fittings.length > 0 && cursorY < PAGE_H - 90) {
    const fittingCols = [
      { label: "#", w: tableW * 0.04 },
      { label: "Description", w: tableW * 0.42 },
      { label: "Material", w: tableW * 0.2 },
      { label: "Size", w: tableW * 0.18 },
      { label: "Qty", w: tableW * 0.16 },
    ];
    cursorY = drawTableHeader(
      lines,
      startX,
      cursorY,
      "Pipe fittings",
      fittingCols.map((c) => c.label),
      fittingCols.map((c) => c.w),
    );
    for (const row of bom.fittings) {
      cursorY = drawTableRow(
        lines,
        startX,
        cursorY,
        [
          String(row.itemNo),
          row.description,
          row.material ?? "—",
          row.size ?? "—",
          String(row.totalCount),
        ],
        fittingCols.map((c) => c.w),
        eqRowH,
        row.itemNo % 2 === 0,
      );
      if (cursorY > PAGE_H - 70) {
        lines.push(textAt(startX, cursorY + 2, "… truncated to fit page", 2.6));
        break;
      }
    }
  }

  return `<g>${lines.join("")}</g>`;
}

function drawTableHeader(
  lines: string[],
  x: number,
  y: number,
  title: string,
  headers: string[],
  widths: number[],
): number {
  lines.push(textAt(x, y, title, 3.6, "start", true));
  y += 3;
  const totalW = widths.reduce((a, b) => a + b, 0);
  lines.push(
    `<rect x="${x}" y="${y}" width="${totalW}" height="6" fill="#e2e8f0" />`,
  );
  let cx = x + 1.5;
  headers.forEach((h, i) => {
    lines.push(textAt(cx, y + 4.2, h, 2.6, "start", true));
    cx += widths[i];
  });
  return y + 6;
}

function drawTableRow(
  lines: string[],
  x: number,
  y: number,
  cells: string[],
  widths: number[],
  rowH: number,
  shaded: boolean,
): number {
  const totalW = widths.reduce((a, b) => a + b, 0);
  if (shaded) {
    lines.push(
      `<rect x="${x}" y="${y}" width="${totalW}" height="${rowH}" fill="#f1f5f9" />`,
    );
  }
  let cx = x + 1.5;
  cells.forEach((c, i) => {
    lines.push(textAt(cx, y + 3.2, truncate(c, widths[i]), 2.6));
    cx += widths[i];
  });
  return y + rowH;
}

function truncate(s: string, widthMm: number): string {
  // ~1.5 mm per character at 2.6mm font size — a rough heuristic.
  const maxChars = Math.max(4, Math.floor(widthMm / 1.4));
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars - 1) + "…";
}

/* ---------------------------- annotations -------------------------------- */

function renderAnnotations(anns: Annotation[]): string {
  if (anns.length === 0) return "";
  const parts: string[] = [];
  for (const a of anns) {
    if (a.kind === "text") {
      const fontSize = a.fontSize ?? 4;
      // Hanging baseline so the text starts AT the click point (top-left),
      // not above it — keeping the preview and the PDF visually aligned.
      parts.push(
        `<text x="${a.x}" y="${a.y}" font-size="${fontSize}" font-family="Inter, Helvetica, Arial, sans-serif" fill="#0f172a" dominant-baseline="hanging">${escapeText(a.text ?? "")}</text>`,
      );
    } else if (a.kind === "note") {
      const fontSize = a.fontSize ?? 3.2;
      const lines = (a.text ?? "").split("\n");
      const padding = 1.5;
      const charW = fontSize * 0.55;
      const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
      const boxW = Math.max(20, longest * charW + 2 * padding);
      const boxH = lines.length * (fontSize + 0.6) + 2 * padding;
      parts.push(
        `<rect x="${a.x}" y="${a.y}" width="${boxW.toFixed(2)}" height="${boxH.toFixed(2)}" fill="#fffbeb" stroke="#f59e0b" stroke-width="0.3" rx="1" />`,
      );
      lines.forEach((l, i) => {
        parts.push(
          `<text x="${a.x + padding}" y="${a.y + padding + i * (fontSize + 0.6)}" font-size="${fontSize}" font-family="Inter, Helvetica, Arial, sans-serif" fill="#0f172a" dominant-baseline="hanging">${escapeText(l)}</text>`,
        );
      });
    } else if (a.kind === "arrow" && a.x2 != null && a.y2 != null) {
      parts.push(
        `<defs><marker id="arr-${escapeText(a.id)}" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="3" markerHeight="3" orient="auto-start-reverse"><path d="M 0 0 L 8 4 L 0 8 z" fill="#0f172a" /></marker></defs>`,
      );
      parts.push(
        `<line x1="${a.x}" y1="${a.y}" x2="${a.x2}" y2="${a.y2}" stroke="#0f172a" stroke-width="0.5" marker-end="url(#arr-${escapeText(a.id)})" />`,
      );
      if (a.text) {
        const mx = (a.x + a.x2) / 2;
        const my = (a.y + a.y2) / 2 - 1.2;
        parts.push(textAt(mx, my, a.text, a.fontSize ?? 3, "middle"));
      }
    }
  }
  return `<g class="annotations">${parts.join("")}</g>`;
}

/* ----- exports needed elsewhere ----------------------------------------- */

export { PAGE_H, PAGE_W };

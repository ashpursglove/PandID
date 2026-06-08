/**
 * Multi-page PDF export driven by the Drawings tab.
 *
 * Pipeline per page: drawingsRender → SVG string → svg2pdf → jsPDF (A3
 * landscape). We add one PDF page per DrawingPage and concatenate them, then
 * write the result via Tauri fs or a browser download fallback.
 */

import { jsPDF } from "jspdf";
import { svg2pdf } from "svg2pdf.js";

import type { DiagramEdge, DiagramNode } from "@/store/diagramStore";
import type { ProjectMeta } from "@/store/projectStore";
import type { DrawingPage } from "@/store/drawingsStore";

import { renderDrawingPage } from "./drawingsRender";
import { ensureInterFont } from "./pdfFonts";
import { isTauriRuntime } from "./runtime";

export interface DrawingsPdfInput {
  pages: DrawingPage[];
  meta: ProjectMeta;
  liveNodes: DiagramNode[];
  liveEdges: DiagramEdge[];
  companyLogo: string | null;
}

/**
 * svg2pdf converts a nested SVG `<image>` (an SVG logo) by re-drawing its text
 * with its own Times fallback — which is why an SVG logo comes out in a serif
 * font that doesn't match the on-screen preview. Rasterising the logo to a PNG
 * with the browser first means the PDF embeds the exact pixels the app shows.
 * Raster logos (PNG/JPG) are passed through untouched.
 */
async function rasterizeLogoIfSvg(dataUrl: string | null): Promise<string | null> {
  if (!dataUrl || !dataUrl.startsWith("data:image/svg")) return dataUrl;
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("logo failed to load"));
      img.src = dataUrl;
    });
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (!w || !h) {
      const size = parseSvgIntrinsicSize(dataUrl);
      w = size.w;
      h = size.h;
    }
    // Render crisp enough for print: aim for ~1000px on the long edge.
    const scale = Math.max(1, Math.ceil(1000 / Math.max(w, h, 1)));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } catch {
    return dataUrl;
  }
}

function parseSvgIntrinsicSize(dataUrl: string): { w: number; h: number } {
  try {
    const comma = dataUrl.indexOf(",");
    const header = dataUrl.slice(0, comma);
    const body = dataUrl.slice(comma + 1);
    const svg = header.includes("base64") ? atob(body) : decodeURIComponent(body);
    const vb = svg.match(
      /viewBox\s*=\s*["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)/i,
    );
    if (vb) return { w: parseFloat(vb[1]), h: parseFloat(vb[2]) };
    const wM = svg.match(/\bwidth\s*=\s*["']([\d.]+)/i);
    const hM = svg.match(/\bheight\s*=\s*["']([\d.]+)/i);
    if (wM && hM) return { w: parseFloat(wM[1]), h: parseFloat(hM[1]) };
  } catch {
    /* fall through to default */
  }
  return { w: 600, h: 300 };
}

async function buildDrawingsPdf(input: DrawingsPdfInput): Promise<ArrayBuffer> {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a3",
  });
  await ensureInterFont(doc);

  // Bake an SVG logo down to a bitmap so it matches the on-screen preview.
  const logo = await rasterizeLogoIfSvg(input.companyLogo);

  const stage = document.createElement("div");
  stage.style.position = "fixed";
  stage.style.left = "-10000px";
  stage.style.top = "-10000px";
  document.body.appendChild(stage);

  try {
    for (let i = 0; i < input.pages.length; i++) {
      const page = input.pages[i];
      const svgString = renderDrawingPage(page, {
        meta: input.meta,
        liveNodes: input.liveNodes,
        liveEdges: input.liveEdges,
        companyLogo: logo,
        pageNumber: i + 1,
        totalPages: input.pages.length,
      });
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
      const svgEl = svgDoc.documentElement as unknown as SVGSVGElement;
      stage.appendChild(svgEl);
      try {
        if (i > 0) doc.addPage("a3", "landscape");
        await svg2pdf(svgEl, doc, { x: 0, y: 0, width: 420, height: 297 });
      } finally {
        stage.removeChild(svgEl);
      }
    }
    return doc.output("arraybuffer");
  } finally {
    stage.remove();
  }
}

export async function exportDrawingsPdf(
  input: DrawingsPdfInput,
): Promise<string | null> {
  const buffer = await buildDrawingsPdf(input);
  const bytes = new Uint8Array(buffer);
  const defaultName = `${(input.meta.drawingNumber || "drawings").replace(/[\\/:*?"<>|]/g, "_")}.pdf`;

  if (isTauriRuntime()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      filters: [{ name: "PDF", extensions: ["pdf"] }],
      defaultPath: defaultName,
    });
    if (!path) return null;
    await writeFile(path, bytes);
    return path;
  }

  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return defaultName;
}

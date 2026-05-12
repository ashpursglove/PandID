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

async function buildDrawingsPdf(input: DrawingsPdfInput): Promise<ArrayBuffer> {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a3",
  });
  await ensureInterFont(doc);

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
        companyLogo: input.companyLogo,
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

/**
 * Build an A3-landscape PDF from the current diagram and write it to disk.
 *
 * Pipeline: state -> svgRender (full-page SVG, mm units) -> svg2pdf (vector
 * embed into jsPDF) -> arraybuffer -> Tauri fs (or browser download).
 */

import { jsPDF } from "jspdf";
import { svg2pdf } from "svg2pdf.js";

import type { ProjectMeta } from "@/store/projectStore";
import type { DiagramEdge, DiagramNode } from "@/store/diagramStore";

import { renderDrawingSvg } from "./svgRender";
import { ensureInterFont } from "./pdfFonts";
import { isTauriRuntime } from "./runtime";

export interface PdfExportInput {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  meta: ProjectMeta;
}

async function buildPdfBuffer(input: PdfExportInput): Promise<ArrayBuffer> {
  const svgString = renderDrawingSvg(input);

  // Parse to DOM so svg2pdf can read it. svg2pdf needs a real DOM element.
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
  const svgEl = svgDoc.documentElement as unknown as SVGSVGElement;

  // Append off-screen so styles resolve (svg2pdf reads computed styles for some props).
  const stage = document.createElement("div");
  stage.style.position = "fixed";
  stage.style.left = "-10000px";
  stage.style.top = "-10000px";
  stage.appendChild(svgEl);
  document.body.appendChild(stage);

  try {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a3",
    });
    await ensureInterFont(doc);
    await svg2pdf(svgEl, doc, { x: 0, y: 0, width: 420, height: 297 });
    return doc.output("arraybuffer");
  } finally {
    stage.remove();
  }
}

export async function exportPdf(input: PdfExportInput): Promise<string | null> {
  const buffer = await buildPdfBuffer(input);
  const bytes = new Uint8Array(buffer);
  const defaultName = `${(input.meta.drawingNumber || "drawing").replace(/[\\/:*?"<>|]/g, "_")}.pdf`;

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

  // Browser fallback — trigger download
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

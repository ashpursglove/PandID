import type { DiagramEdge, DiagramNode } from "@/store/diagramStore";
import type { ProjectMeta } from "@/store/projectStore";

import { buildBom } from "./bom";
import { isTauriRuntime } from "./runtime";

export interface BomExportInput {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  meta: ProjectMeta;
}

function toCsvRow(cells: (string | number | undefined)[]): string {
  return cells
    .map((c) => {
      const s = c == null ? "" : String(c);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    })
    .join(",");
}

function buildBomCsv(input: BomExportInput): string {
  const bom = buildBom(input.nodes, input.edges, { includePipes: true });
  const lines: string[] = [];
  lines.push(`Project,${input.meta.title}`);
  lines.push(`Drawing,${input.meta.drawingNumber}`);
  lines.push("");
  lines.push("EQUIPMENT");
  lines.push(
    toCsvRow(["#", "Tag", "Description", "Category", "Size", "Material", "Qty", "Remarks"]),
  );
  for (const r of bom.equipment) {
    lines.push(
      toCsvRow([
        r.itemNo,
        r.tag,
        r.description,
        r.category,
        r.size,
        r.material,
        r.quantity,
        r.remarks,
      ]),
    );
  }
  lines.push("");
  lines.push("PROCESS PIPES");
  lines.push(
    toCsvRow(["#", "Description", "Material", "Size", "Length (m)", "Segments"]),
  );
  for (const r of bom.pipes) {
    lines.push(
      toCsvRow([
        r.itemNo,
        r.description,
        r.material,
        r.size,
        r.totalLengthM.toFixed(2),
        r.segments,
      ]),
    );
  }
  lines.push("");
  lines.push("PIPE FITTINGS");
  lines.push(toCsvRow(["#", "Description", "Material", "Size", "Qty"]));
  for (const r of bom.fittings) {
    lines.push(
      toCsvRow([r.itemNo, r.description, r.material, r.size, r.totalCount]),
    );
  }
  return lines.join("\n");
}

export async function exportBomCsv(input: BomExportInput): Promise<string | null> {
  const csv = buildBomCsv(input);
  const bytes = new TextEncoder().encode(csv);
  const defaultName = `${(input.meta.drawingNumber || "bom").replace(/[\\/:*?"<>|]/g, "_")}_bom.csv`;

  if (isTauriRuntime()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      filters: [{ name: "CSV", extensions: ["csv"] }],
      defaultPath: defaultName,
    });
    if (!path) return null;
    await writeFile(path, bytes);
    return path;
  }

  const blob = new Blob([bytes], { type: "text/csv" });
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

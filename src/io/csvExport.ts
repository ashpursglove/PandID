/**
 * Equipment list CSV export. One row per node, with category and a flattened
 * params blob for the "Notes" column. Output is RFC-4180 compliant.
 */

import { getSymbol } from "@/symbols/registry";
import type { DiagramNode } from "@/store/diagramStore";
import { includeInReports } from "@/io/reporting";

import { isTauriRuntime } from "./runtime";

const COLUMNS = ["Tag", "Type", "Category", "Symbol", "X", "Y", "Notes"];

export function buildEquipmentCsv(nodes: DiagramNode[]): string {
  const rows = [COLUMNS.join(",")];
  for (const n of nodes) {
    if (!includeInReports(n.data)) continue;
    const sym = getSymbol(n.data.symbolType);
    if (!sym) continue;
    const tag = n.data.tag ?? n.data.label ?? "";
    const notes = flattenParams(n.data.params);
    rows.push(
      [
        csv(tag),
        csv(sym.label),
        csv(sym.category),
        csv(sym.type),
        csv(Math.round(n.position.x)),
        csv(Math.round(n.position.y)),
        csv(notes),
      ].join(","),
    );
  }
  return rows.join("\r\n");
}

function flattenParams(params: unknown): string {
  if (!params || typeof params !== "object") return "";
  return Object.entries(params as Record<string, unknown>)
    .filter(([, v]) => v != null && !Array.isArray(v))
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function csv(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function exportEquipmentCsv(
  nodes: DiagramNode[],
  defaultName = "equipment-list.csv",
): Promise<string | null> {
  const csvText = buildEquipmentCsv(nodes);

  if (isTauriRuntime()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      filters: [{ name: "CSV", extensions: ["csv"] }],
      defaultPath: defaultName,
    });
    if (!path) return null;
    await writeTextFile(path, csvText);
    return path;
  }

  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
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

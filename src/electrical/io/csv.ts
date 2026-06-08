/** Generic CSV writer + saver for electrical schedules (RFC-4180 quoting). */

import { isTauriRuntime } from "@/io/runtime";

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const r of rows) lines.push(r.map(csvCell).join(","));
  return lines.join("\r\n");
}

function csvCell(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function saveCsv(
  csvText: string,
  defaultName: string,
): Promise<string | null> {
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

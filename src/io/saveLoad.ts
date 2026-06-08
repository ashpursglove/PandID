/**
 * High-level Save / Open / Save-As. Wraps the Tauri dialog + fs plugins when
 * running in the desktop shell, and falls back to browser download/upload when
 * running in plain Vite.
 */

import { isTauriRuntime } from "./runtime";
import {
  deserialise,
  serialise,
  type ProjectFile,
  type SerialiseInput,
} from "./projectFile";

const FILE_FILTER = { name: "MEP Playground Project", extensions: ["pid"] };

interface DiskFile {
  path: string;
  content: string;
}

export async function pickAndReadFile(): Promise<DiskFile | null> {
  if (isTauriRuntime()) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const selected = await open({
      multiple: false,
      filters: [FILE_FILTER],
    });
    if (typeof selected !== "string") return null;
    const content = await readTextFile(selected);
    return { path: selected, content };
  }

  // Browser fallback — synthesise an <input type=file> dialog
  return new Promise<DiskFile | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pid,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const content = await file.text();
      resolve({ path: file.name, content });
    };
    input.click();
  });
}

export async function pickAndWriteFile(
  defaultPath: string | null,
  content: string,
): Promise<string | null> {
  if (isTauriRuntime()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      filters: [FILE_FILTER],
      defaultPath: defaultPath ?? "untitled.pid",
    });
    if (!path) return null;
    await writeTextFile(path, content);
    return path;
  }

  // Browser fallback — trigger a download
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = defaultPath ?? "untitled.pid";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return defaultPath ?? "untitled.pid";
}

export async function writeFileAt(
  path: string,
  content: string,
): Promise<void> {
  if (isTauriRuntime()) {
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    await writeTextFile(path, content);
    return;
  }
  // Browser: behave like Save As when no file handle is available
  await pickAndWriteFile(path, content);
}

export function makeProjectJson(input: SerialiseInput): string {
  return serialise(input);
}

export function parseProjectJson(text: string): ProjectFile {
  return deserialise(text);
}

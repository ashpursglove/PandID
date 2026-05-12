/**
 * Embed the same Inter font the live app uses into a jsPDF document so the
 * exported PDF matches what the user sees on screen.
 *
 * jsPDF only ships the standard PDF Type-1 fonts (Helvetica, Times, Courier).
 * Anything else has to be added explicitly: load the TTF, base64-encode it,
 * register it in jsPDF's virtual file system, then expose it under the same
 * family name the SVG references (`Inter`). svg2pdf then resolves
 * `font-family="Inter, ..."` against this registry instead of falling back
 * to Helvetica.
 *
 * The TTF is a variable font (opsz + wght axes) so a single file gives us
 * regular AND bold without shipping two assets. Both styles are aliased to
 * the same file — jsPDF doesn't drive variable axes itself, but svg2pdf
 * still picks `bold` for `font-weight >= 600`, and the renderer just uses
 * the embedded glyphs as-is.
 */

import type { jsPDF } from "jspdf";

import interTtfUrl from "@/assets/fonts/Inter.ttf?url";

const FONT_FILE = "Inter.ttf";
const FONT_NAME = "Inter";

let cachedBase64: Promise<string> | null = null;

async function loadInterBase64(): Promise<string> {
  if (!cachedBase64) {
    cachedBase64 = fetch(interTtfUrl)
      .then((r) => r.arrayBuffer())
      .then((buf) => arrayBufferToBase64(buf));
  }
  return cachedBase64;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // Chunked conversion — String.fromCharCode chokes on giant spreads, but
  // 32k slices keep us comfortably under the call-stack limit.
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + CHUNK) as unknown as number[],
    );
  }
  return btoa(binary);
}

/**
 * Register Inter with the given jsPDF document and select it as the active
 * font. Safe to call multiple times — jsPDF dedupes by file name.
 */
export async function ensureInterFont(doc: jsPDF): Promise<void> {
  const base64 = await loadInterBase64();
  doc.addFileToVFS(FONT_FILE, base64);
  doc.addFont(FONT_FILE, FONT_NAME, "normal");
  // Alias bold to the same variable file. svg2pdf still requests "bold"
  // for elements with font-weight >= 600 — without this alias it would
  // silently fall back to Helvetica-Bold and break visual consistency.
  doc.addFont(FONT_FILE, FONT_NAME, "bold");
  doc.setFont(FONT_NAME, "normal");
}

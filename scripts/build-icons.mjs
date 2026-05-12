/**
 * Convert src-tauri/icons/icon.svg → icon-master.png (1024×1024), then hand
 * that off to `tauri icon` which rasterises every platform-specific size we
 * need (32×32, 128×128, .icns, .ico, Windows Store assets, etc.).
 *
 * Re-run whenever you change `icon.svg`:
 *
 *   node scripts/build-icons.mjs
 *
 * The intermediate PNG is committed alongside the SVG so non-Node tooling
 * (Inkscape, Figma) can also consume it.
 */

import { Resvg } from "@resvg/resvg-js";
import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SVG_PATH = path.join(ROOT, "src-tauri", "icons", "icon.svg");
const PNG_PATH = path.join(ROOT, "src-tauri", "icons", "icon-master.png");

async function svgToPng() {
  // Read as UTF-8 string and strip a leading BOM if the editor inserted one;
  // resvg-js rejects non-UTF8 input outright, BOM included.
  let svg = await readFile(SVG_PATH, "utf8");
  if (svg.charCodeAt(0) === 0xfeff) svg = svg.slice(1);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1024 },
    background: "transparent",
  });
  const pngBuffer = resvg.render().asPng();
  await writeFile(PNG_PATH, pngBuffer);
  console.log(`Wrote ${path.relative(ROOT, PNG_PATH)} (${pngBuffer.length} bytes)`);
}

function regenerateTauriIcons() {
  console.log("Regenerating Tauri icon set…");
  // `tauri icon <png>` writes into src-tauri/icons/ next to where the binary
  // is invoked, so we run from src-tauri/.
  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["--yes", "@tauri-apps/cli", "icon", path.join("icons", "icon-master.png")],
    { stdio: "inherit", cwd: path.join(ROOT, "src-tauri") },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

await svgToPng();
regenerateTauriIcons();

# PandID

A local desktop P&ID editor and hydraulic analysis tool.

- **Editor** — drag-and-drop ISO-style P&ID symbols onto an infinite canvas, connect them with process / utility / pneumatic / electric line types, edit per-component parameters in a schema-driven inspector, save/load versioned `.pid` JSON, and export an A3-landscape PDF with an ISO title block.
- **Analysis** — pick two endpoints in the diagram, define a fluid, and the engine solves the single-path hydraulics: pump-curve vs system-curve intersection (forward) or required pump head for a target flow (inverse), with per-component Δp / head / Reynolds / velocity, plus a chart of pump and system curves with the operating point.

Architected to grow into branched-network solving in v2 without breaking the project file format or symbol library.

## Stack

| Layer    | Tech                                                                          |
| -------- | ----------------------------------------------------------------------------- |
| Shell    | [Tauri 2](https://tauri.app) (Rust) — produces a small native `.exe`          |
| Frontend | Vite + React 18 + TypeScript                                                  |
| Canvas   | [`@xyflow/react`](https://reactflow.dev) v12                                  |
| State    | Zustand + [`zundo`](https://github.com/charkour/zundo) (undo/redo)            |
| Styling  | Tailwind CSS v4                                                               |
| PDF      | `jspdf` + `svg2pdf.js` (vector, no rasterisation)                             |
| Plotting | [`recharts`](https://recharts.org)                                            |

## Prerequisites

- **Node.js** 20 or newer.
- **Rust** (stable) via [rustup](https://rustup.rs) — only needed to launch the desktop window or build the `.exe`. The frontend runs fine in a plain browser without Rust.

On Windows, the rustup installer will offer to install the Microsoft C++ Build Tools — accept it.

## Install

```bash
npm install
```

## Run

```bash
# Desktop window (Tauri shell). Needs Rust.
npm run tauri dev

# Browser-only (no Rust required). Save/Open use download/upload fallbacks.
npm run dev
```

## Build

```bash
# Bundles the .exe / .msi / .app installer:
npm run tauri build
```

Output lands in `src-tauri/target/release/bundle/`.

## Keyboard shortcuts

| Action                       | Shortcut              |
| ---------------------------- | --------------------- |
| New project                  | Ctrl + N              |
| Open                         | Ctrl + O              |
| Save                         | Ctrl + S              |
| Save As                      | Ctrl + Shift + S      |
| Undo                         | Ctrl + Z              |
| Redo                         | Ctrl + Y or Shift + Z |
| Delete selected              | Delete / Backspace    |
| Rotate selected 90° CW       | R                     |
| Rotate selected 90° CCW      | Shift + R             |

## Tips

- **Attach an instrument to a pipe** — just drop the instrument near the pipe. The editor automatically inserts a tap point and splits the pipe, then runs a pneumatic signal line from the tap to the instrument. (You can also drop a stand-alone tap point from the Connectors section of the palette.)
- **Skip the lookups** — every component has a Preset selector in the inspector. Pumps, valves, pipes, and fluids all ship with curated common values (DN sizes × materials, vendor-style pump curves, fluid properties from 20 °C water to glycerine).
- **Rotate after placing** — select a component and press R (or use the rotate buttons in the inspector). Port positions follow the rotation, so connections stay valid.

## Project file format

`.pid` files are JSON with a `version` field so old files keep opening as the schema evolves. See [`src/io/projectFile.ts`](src/io/projectFile.ts) for the schema and `migrate()` step.

## Layout

```
src/
  components/   UI: Canvas, Palette, Inspector, Toolbar
  symbols/      ISO-style SVG symbols + registry + line styles
  engine/       Pure-TS hydraulics engine (no React)
  store/        Zustand stores (diagram, project, ui)
  io/           Save/load, SVG render, PDF export, CSV export
  pages/        Editor, Analysis
src-tauri/      Rust shell
```

The engine is intentionally framework-agnostic: `engine/adapter.ts` is the only file that knows about React Flow's types. To move the engine to Rust later, replace the TS implementations in `engine/` while keeping the adapter and `solve()` signature.

## Roadmap

- v2 — branched / looped network solver (Newton-Raphson over node mass-balance)
- v2 — off-page connectors, instrument loops, layered visibility
- v2 — comparison mode (diff two `.pid` files for design review)
- v2 — alignment guides during drag

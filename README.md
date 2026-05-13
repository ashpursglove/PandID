# Ash's P&ID Playground

### Because Aveva, Hexagon, AutoCAD, and Aspen can collectively go fuck themselves if they think drawing a centrifugal pump should require a licence server, a VPN, and a phone call to a sales rep

[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-24C8DB?logo=tauri&logoColor=white)](https://tauri.app)
[![React](https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Rust](https://img.shields.io/badge/rust-stable-orange?logo=rust&logoColor=white)](https://rustup.rs)
[![Licence: MIT](https://img.shields.io/badge/licence-MIT-green)](#licence)
[![Internet required: no](https://img.shields.io/badge/internet%20required-no-success)]()
[![Account required: also no](https://img.shields.io/badge/account%20required-also%20no-success)]()
[![Account required: also no]]()

<p align="center">
<img width="1917" height="986" alt="image" src="https://github.com/user-attachments/assets/b0b157b2-4abd-4373-9870-52a113a986dd" />

</p>

---

## What The Hell Is This?

This is a **local, offline, no-licence, no-login, no-corporate-spaff** desktop application for:

1. **Drawing piping & instrumentation diagrams (P&IDs)** with proper ISO-style symbology.
2. **Solving the hydraulics** of a path through that diagram — actual Darcy-Weisbach friction losses, actual pump curves, actual operating points.
3. **Issuing a multi-page drawing pack PDF** with a real title block, sheet numbering, revisions, and a bill of materials, like a grown-up engineer.

It runs entirely on your machine. There is no cloud. There is no telemetry. There is no licence server. There is nobody in a Salesforce dashboard somewhere watching you place a ball valve.

You launch the app. You draw. You save. You export. The end.

---

## Why This Exists (AKA: An Incomplete List Of Things That Made Me Snap)

The "industry-standard" P&ID and hydraulics toolchain currently consists of:

- **AutoCAD P&ID** — $2,000+/year, requires a network licence, ships with stencils that look like they were drawn during the Cold War. By a man with the shakes.
- **Aveva Diagrams / E3D / PDMS** — costs roughly the same as a small car. Requires you to **install a database**. To draw a vessel. With a triangle on it.
- **Hexagon SmartPlant P&ID** — sales process so abusive you basically have to file a Freedom of Information request to find out what it costs.
- **AutoPLANT / OpenPlant / Bentley anything** — same shit, different acronym, different consultant invoice.
- **Aspen HYSYS / PIPESYS / Hydra** — for a flow rate calculation. **A flow rate calculation.** Tens of thousands of pounds a year so a tool can solve a quadratic. We have GCSE textbooks that solve quadratics. We have *calculators* that solve quadratics. We have *abacuses* that solve quadratics.
- **AFT Fathom / PIPENET / PIPEFLO** — perfectly fine software that nonetheless charges you what a structural engineer earns in a quarter to add up some pipe lengths.
- **Visio with the engineering stencil pack** — somehow still the actual fallback in 2026. Microsoft's contribution to engineering is **a flowchart program with a triangle that says "pump" on it**. Bravo.

All of these tools share a few innovations:

- A licence dongle that breaks if you sneeze
- A "cloud workspace" that's just somebody else's hard drive with a markup
- A subscription model that converts you into livestock
- An EULA written by a 38-year-old in a Patagonia vest who has never seen a pipe
- A "training-required" workflow because the UI was last redesigned during the Blair government
- A file format that **stops opening** the moment you let the support contract lapse

Meanwhile, what you actually need to do is:

- Drag a pump onto a canvas
- Connect it to a tank with a pipe
- Decide whether the pipe is DN50 or DN80
- Punch in fluid properties
- Get a number out the other end
- Print a PDF that looks like an engineering drawing and not like clip-art

That is the **entire job**. It is approximately three hundred lines of code's worth of actual engineering. Everything else is rent-seeking.

So I wrote this.

It does that.

For free.

In a 12 MB executable.

That works offline.

Forever.

---

## What It Actually Does (Concretely, Without The Sales Pitch)

<p align="center">
<img width="1590" height="917" alt="image" src="https://github.com/user-attachments/assets/775acfbd-a29c-404b-9a3b-deaf247bf6ee" /> 


</p>

## The Editor

- **Infinite canvas** built on React Flow. Pan, zoom, drag. It does what a canvas should do, which is shut up and let you draw.
- **~133 ISO-style P&ID symbols** out of the box — pumps, compressors, vessels, columns, heat exchangers, separators, mixers, valves, instruments, fittings, the works. Listed in full further down.
- **4 line types**: process, utility, pneumatic signal, electric signal. Each one has its own visual style. Each one is just a click in the palette.
- **Drag-and-drop placement** from the palette onto the canvas.
- **Drop an instrument near a pipe** and the editor automatically inserts a tap point, splits the pipe, and runs a pneumatic signal line from the tap to the instrument. Because typing in coordinates by hand is a war crime.
- **Schema-driven inspector** on the right. Pick a pump and you get rated flow, rated head, shutoff, NPSH, motor power. Pick a pipe and you get nominal size, material, length, elevation change, roughness, fittings. Pick a valve and you get Cv, K-factor, open fraction. No two symbols pretend they're the same thing.
- **Presets for everything that matters**: 12 fluid presets (water at three temperatures, glycol mixes, hydrocarbons, glycerine, air), 27 pump curves, 77 pipe size × material combinations (DN15 to DN200 across PVC, HDPE, carbon steel, stainless, copper, galvanised, cast iron, concrete), 185 valve sizing presets, 504 filter/strainer presets. So you don't have to type "0.000045" into a roughness field every time you draw a pipe.
- **Auto-routing of pipe corners** with right-angle elbows that route around things instead of stabbing through them.
- **Multi-select, group operations, rotation in 90° steps**, copy/paste/delete via the keyboard like every other piece of software written since 1984.
- **Undo / redo** that actually works, powered by zundo, with no maximum depth and no "your trial of unlimited undo has expired".
- **Auto-tagging** — drop a second centrifugal pump and it becomes P-102 because P-101 already exists. You can override it. Nobody is forcing you. It's just not 1997 here.

<p align="center">
<img width="270" height="682" alt="image" src="https://github.com/user-attachments/assets/9a789127-c4b2-4283-b140-57bb03aec42a" /> <img width="370" height="922" alt="image" src="https://github.com/user-attachments/assets/854afc95-c1f3-4797-9204-f0ab292c39f7" />

</p>

## The Hydraulics Engine
#### Pick a start node, pick an end node, pick a fluid, hit **Solve**.

<p align="center">
<img width="455" height="237" alt="image" src="https://github.com/user-attachments/assets/a5ba2f5d-761f-43f3-9e67-a3e574d45641" />
</p>

When solve is clicked, the engine:

1. **Walks the graph** to find a route between the two nodes via process-line edges only.
2. **Builds a system curve** out of the components on that path:
   - **Pipes**: Darcy-Weisbach friction, with friction factor from **Colebrook-White via the Swamee-Jain explicit approximation** in the turbulent regime, \( f = 64/Re \) in laminar, and a log-space blend across the 2300-4000 transition so the curve doesn't kink.
   - **Fittings** on pipes: minor losses summed as \( \sum K_i \cdot \tfrac{1}{2}\rho v^2 \), Crane-style.
   - **Valves**: either Cv-based (imperial sizing equation, partial-open scales Cv linearly) or K-based (partial-open scales \( K \) as \( 1/\text{open}^2 \)). Check valves get an optional cracking pressure.
   - **Filters, strainers, fittings, heat exchangers**: either a fixed bar drop or a K-factor on the connected pipe velocity. Defaults are sensible. Override per component.
   - **Elevation**: \( \rho g \Delta z \) per pipe segment, added to static lift.
3. **Builds a pump curve** by least-squares-fitting a quadratic to your curve points (or to synthesised points if you only gave it a rated duty + shutoff).
4. **Finds the operating point** as the root of \( H_\text{pump}(Q) = H_\text{static} + H_\text{loss}(Q) \) using bracketed bisection on \( Q \in [0, 2000~\text{m}^3/\text{h}] \).
5. **Tells you whether the pump is undersized**, whether the shutoff head clears the static lift, and what the operating flow rate is in m³/h, m³/s, and L/s.

**Two modes:**
<p align="center">
<img width="360" height="271" alt="image" src="https://github.com/user-attachments/assets/51efff38-221f-4f84-b5dd-be13a1ff56e4" />
</p>
- **Predict the flow rate** (forward) — given the system and the pump, what flow do you actually get?
- **Solve for a target flow** (inverse) — given a flow you want, what head does the system need? Does the installed pump deliver that head? If not, by how much is it short?

**Outputs:**

- Operating point on a pump-vs-system chart you can pan and zoom.
- KPI cards: flow, pump head delivered, system head required, total elevation.
- A per-component breakdown table showing ΔP, head, velocity, Reynolds, flow regime (laminar / transitional / turbulent), and for pipes a sub-row breaking out friction vs fittings vs elevation.
- Warnings if the engine is unhappy with you (multiple pumps on the path, no intersection, etc.).
- A **"Send report to Drawings"** button that paginates the whole thing into your drawing pack as one or more analysis sheets.

<p align="center">
<img width="1496" height="570" alt="image" src="https://github.com/user-attachments/assets/e98c4b22-54b9-4d69-9d4f-67395ba02531" />
<img width="1477" height="727" alt="image" src="https://github.com/user-attachments/assets/3475ce6f-9b0e-4a23-89f1-862387b6ef54" />

</p>

## The Drawings Tab

<p align="center">
<img width="1912" height="967" alt="image" src="https://github.com/user-attachments/assets/5560fe0d-f163-45aa-84f5-bcf54bf5dd39" />

</p>

This is where you go from "I have a diagram" to "I have a deliverable".

- **Multi-page A3-landscape PDF pack** with a proper ISO title block on every sheet.
- **Four page types:**
  - **Diagram pages** — snapshot of the canvas (either the current viewport via the "Send current view to Drawings" button on the canvas, or the full diagram via the Drawings sidebar). The snapshot is frozen at capture time, so editing the live diagram afterwards doesn't break your already-issued sheets.
  - **Analysis pages** — paginated hydraulic reports with route preview, chart, KPIs, and the breakdown table.
  - **BoM pages** — auto-generated bill of materials from the live diagram: equipment grouped by tag, process pipes grouped by material × size with totals, fittings grouped by kind × size with counts.
  - **Blank annotation pages** — just an ISO frame and a title block. Add text, notes, and arrows on top.
- **Title block** with project name, drawing number, drawn by, checked, approved, date, scale, revision, sheet *n* of *m*. Every field falls back to the project-wide meta, or you can override per page.
- **Company logo** embedded once, appears on every sheet.
- **Annotations**: text, boxed notes, arrows with optional labels. Drag to position. Double-click to edit. Delete to delete. Because that is how a computer is supposed to work.
- **Per-page colour and line-weight overrides** on diagram pages — make the path-of-interest red and 1.5× wider for the issued PDF without touching the live diagram.
- **Vector PDF output** via `jspdf` + `svg2pdf.js`. No rasterisation. Zoom in until the lines are atoms. Lines remain lines. Text remains text. You can highlight it. You can search it. You can sleep at night.

<p align="center">
<img width="1052" height="370" alt="image" src="https://github.com/user-attachments/assets/52de9692-28c6-4fd8-9ab3-e4ece1880cab" />

</p>

<p align="center">
<img width="1096" height="772" alt="image" src="https://github.com/user-attachments/assets/ddf2847e-cc16-4c45-aed6-01aa4879e118" />

</p>

---

## Quick Start

### Just give me the .exe

A Windows MSI installer is built via `npm run tauri build` (see **Building** below). After install you get:

- Start menu shortcut with the proper icon
- A `.pid` file association so double-clicking a project opens it
- An uninstaller in Add/Remove Programs
- An `Ash's PID Playground` folder under `%LOCALAPPDATA%\Programs\`

If you only want to try it without installing, the standalone `pandid.exe` from `src-tauri/target/release/` runs on its own. WebView2 is shipped with Windows 10 1803+ and all Windows 11, so there's nothing to install.

### Run from source (dev mode)

```bash
git clone https://github.com/<you>/PandID.git
cd PandID
npm install
npm run tauri dev
```

You'll need:

- **Node.js 20** or newer
- **Rust stable** via [rustup](https://rustup.rs) — on Windows let the installer pull in the Microsoft C++ Build Tools when it offers

If you don't have Rust, you can still run the **frontend only** in a browser:

```bash
npm run dev
```

In browser mode Save/Open use download/upload fallbacks instead of native file dialogs. Everything else works identically. The hydraulic engine doesn't care.

---

## Building A Real .exe

```bash
npm run tauri build
```

First run takes 5–10 minutes (Rust compiles from scratch). Subsequent rebuilds are 30–60 seconds. The output lands in:

```
src-tauri/target/release/
├── pandid.exe                                                  ← raw executable, runnable on its own
└── bundle/
    └── msi/
        └── Ash's PID Playground_1.0.0_x64_en-US.msi             ← installer, ship this
```

Yes, MSI not NSIS. There's an upstream Tauri bug in the NSIS bundler (`nsis_tauri_utils` macro mismatch in tauri-cli 2.11.x) that makes NSIS bundling fail with a `NSISCOMCALL requires 4 parameter(s), passed 8` error. MSI uses an entirely different bundler (WiX), is unaffected, and is arguably the more professional Windows installer format anyway. To re-enable NSIS later, edit `src-tauri/tauri.conf.json` and put `"nsis"` back into `bundle.targets`.

To regenerate the app icon after editing `src-tauri/icons/icon.svg`:

```bash
npm run icons
```

That rasterises the SVG to PNG at 1024×1024 and then has `@tauri-apps/cli icon` regenerate `icon.ico`, `icon.icns`, all the Windows tile sizes, and the platform PNGs.

---

## Keyboard Shortcuts

Because moving the mouse is for people with patience.

| Action                       | Shortcut                     |
| ---------------------------- | ---------------------------- |
| New project                  | Ctrl + N                     |
| Open                         | Ctrl + O                     |
| Save                         | Ctrl + S                     |
| Save As                      | Ctrl + Shift + S             |
| Undo                         | Ctrl + Z                     |
| Redo                         | Ctrl + Y or Ctrl + Shift + Z |
| Cut selection                | Ctrl + X                     |
| Copy selection               | Ctrl + C                     |
| Paste                        | Ctrl + V                     |
| Delete selected              | Delete / Backspace           |
| Rotate selected 90° CW       | R                            |
| Rotate selected 90° CCW      | Shift + R                    |

Copy/cut grab every node and edge currently selected (single-click or marquee-drag a box around several). Paste drops the copies back in offset by 30 px so you can see them, gives them fresh IDs, and re-issues tag numbers so two P-101s never exist on the same diagram. Internal wiring between copied nodes is preserved; edges with one foot outside the selection are dropped (they'd dangle).

Shortcuts ignore key presses when you're typing into a text field, so you can't accidentally cut a pump by typing "cut" into a tag, and Ctrl+C inside a parameter field copies the *text*, not the diagram. You're welcome.

Undo coalesces rapid changes — a node drag becomes one history entry, not 200, so Ctrl+Z actually goes somewhere visible instead of reverting the position by a sub-pixel.

---

## Stack

| Layer    | Tech                                                                          |
| -------- | ----------------------------------------------------------------------------- |
| Shell    | [Tauri 2](https://tauri.app) (Rust) — produces a ~12 MB native `.exe`         |
| Frontend | Vite 5 + React 18 + TypeScript                                                |
| Canvas   | [`@xyflow/react`](https://reactflow.dev) v12                                  |
| State    | Zustand v5 + [`zundo`](https://github.com/charkour/zundo) (undo/redo)         |
| Styling  | Tailwind CSS v4                                                               |
| PDF      | `jspdf` + `svg2pdf.js` (true vector, no rasterisation)                        |
| Plotting | [`recharts`](https://recharts.org) for the pump-vs-system chart               |
| Icons    | [`lucide-react`](https://lucide.dev)                                          |

Total cold-launch time on a midrange laptop: about a second. Compare and contrast.

---

## Symbol Library (Full Inventory)

133 symbols at last count, grouped by category. If you need one that isn't here, the registry in `src/symbols/registry.tsx` is a flat declarative file. Adding a symbol is a single object literal plus a tiny SVG component. No plugin architecture. No marketplace. No "submit your symbol to our review board".

<details>
<summary><b>Equipment</b> — pumps, compressors, vessels, heat exchangers, columns, etc.</summary>

| Category | Symbols |
|---|---|
| Pumps | centrifugal, vertical centrifugal, submersible, gear, piston, screw, diaphragm, peristaltic, vacuum, positive-displacement |
| Compressors & blowers | centrifugal compressor, reciprocating compressor, screw compressor, fan |
| Tanks & vessels | vertical vessel, horizontal vessel, horizontal tank, open-top tank, cone-roof tank, floating-roof tank, spherical tank, silo |
| Heat transfer | shell-and-tube exchanger, plate exchanger, air-cooled exchanger, kettle reboiler, condenser, fired heater, cooling tower |
| Separation & columns | distillation column, packed column, cyclone, two-phase separator, three-phase separator, knockout drum |
| Mixing | static mixer, agitated tank |
| Bioreactors & aquaculture | raceway bioreactor, tubular photobioreactor, round culture tank, moving-bed bioreactor, protein skimmer, paddlewheel aerator, oxygen cone, settling cone, biomass collection vessel |
| Storage & containers | IBC container, chemical drum |

</details>

<details>
<summary><b>Valves</b> — every kind you've ever specified plus several you haven't</summary>

| Subcategory | Symbols |
|---|---|
| Isolation | gate, ball, butterfly, plug, diaphragm, pinch, needle, hand, priming |
| Check | check, lift-check, foot |
| Actuated & control | control, motor-operated, solenoid, pressure regulator |
| Pressure relief & safety | relief, rupture disc, breather, flame arrestor |
| Specialty | globe, angle, three-way |

</details>

<details>
<summary><b>Filters & strainers</b></summary>

Y-strainer, T-strainer, basket strainer, simplex filter, duplex filter, bag filter, cartridge filter, sand filter, vibration filter, drum filter.

</details>

<details>
<summary><b>Inline components & fittings</b></summary>

| Subcategory | Symbols |
|---|---|
| Flow elements | orifice plate, venturi, rotameter, pitot probe |
| Traps & vents | steam trap, air vent, drain |
| Sample & sight | sight glass, sample point |
| Mechanical | concentric reducer, eccentric reducer, expansion joint, spectacle blind, pipe cap, spray nozzle |
| Disinfection & gas | UV sterilizer, CO₂ injector, air diffuser |

</details>

<details>
<summary><b>Connectors</b></summary>

Tap point, pipe tee, off-page connector.

</details>

<details>
<summary><b>Instruments</b> — ISA-style bubbles</summary>

| Subcategory | Symbols |
|---|---|
| Pressure | PI, PT, PIC, PSL, PSH, PDT |
| Flow | FI, FT, FIC, FE, FQ, FAL |
| Temperature | TI, TT, TIC, TE, TSL, TSH |
| Level | LI, LT, LIC, LG, LSL, LSH |
| Analysis & misc | AI, AT, DT, VT, ST, HS, ESD |

</details>

### Line types

| Slug | Label | Style |
|------|-------|-------|
| `process` | Process | solid heavy stroke |
| `utility` | Utility | solid lighter stroke |
| `pneumatic` | Pneumatic signal | crosshatched |
| `electric` | Electric signal | dashed |

---

## Architecture (For The Curious)

```
src/
  components/   UI: Toolbar, Palette, Canvas, Inspector, Analysis, Drawings
  symbols/      All 133 ISO-style symbols + the registry + line styles
  engine/       Pure-TS hydraulics engine. No React. No DOM. No JSX.
  presets/      Curated common values: fluids, pumps, pipes, valves, filters
  store/        Zustand stores: diagram, project, drawings, UI
  io/           Save/load, SVG render, PDF export, BoM, CSV, geometry
  pages/        Editor, Analysis, Drawings
  hooks/        Useful React hooks
  lib/          Small generic utilities
src-tauri/      Rust shell (Tauri 2). Windows file-association hook. Splash log.
```

The engine in `src/engine/` is **deliberately framework-agnostic**. `engine/adapter.ts` is the only file that knows about React Flow's data shapes. To rewrite the engine in Rust later (which is on the roadmap), you replace the implementations in `engine/` while keeping `adapter.ts` and the `solve()` signature. The UI never knew anything about how the math got done.

---

## Project File Format

`.pid` files are pretty-printed JSON with a `version` field. Current schema is **v2**. The migration path from v1 → v2 is in `src/io/projectFile.ts`. Old files keep opening as the schema evolves, because forwards-incompatible breakage is what corporate software does to you and I refuse to do it to anyone.

A v2 file contains:

- **Project meta** — title, drawing number, drawn-by / checked / approved, revision, date, scale, etc.
- **Fluids** — your project fluid library
- **Diagram** — the full graph: nodes, edges, every parameter
- **Analyses** — saved analysis configurations and last results
- **Drawings** — every page in your drawing pack with annotations, overrides, page-level title block overrides
- **Company logo** — embedded as a data URL

It's just JSON. You can `cat` it. You can `git diff` it. You can write a Python script that mangles it. You can read it on a Casio fx-991 if you have enough time. No proprietary format. No "premium tier required to export". No "schema documented under NDA".

---

## What This Is NOT (Read This Before Opening An Issue Saying "Why Doesn't It Do X")

- **Not a multi-path / branched network solver.** Single series path only. Pick a start node, pick an end node, and the engine walks the process-line graph between them. Branched networks with parallel paths and loops are explicitly v2 (see **Roadmap**).
- **Not 3D.** This is a P&ID tool. P&IDs are 2D. If you wanted a 3D model you would not be reading this.
- **Not a stress analyser.** It doesn't care about pipe wall thickness vs. design pressure, support locations, expansion loops, or seismic loading. It cares about flow.
- **Not a CFD package.** It will not tell you about secondary flows in your elbow. It will tell you the velocity. You can decide whether you care.
- **Not a transient solver.** Steady-state, incompressible, single-phase. No water hammer. No surge analysis. No NPSH calculation (yet).
- **Not multi-phase.** Density and viscosity are constants for the solve. The "air" fluid preset exists but the physics is still incompressible.
- **Not a heat balance.** Temperature on the fluid row is a label. The engine does not march temperature along the pipe. If you need that, use somebody else's $40,000/year product, or wait for v2 and complain at me when it's not ready.
- **Not parametric.** No constraints. No mates. No assemblies. Dassault Systèmes have no business model to defend here.

These are not bugs. They are the deliberate scope. The scope is:

> Draw the diagram. Solve the hydraulics. Issue the PDF.

If the scope grows, it grows because I want it to, not because a roadmap committee in San Jose decided it should.

---

## Limitations (Honestly Listed Because I'm Not A Marketing Department)

1. **Single series path only.** Branched networks are v2.
2. **One pump curve contributes** if multiple pumps sit on the same path. Others are ignored and you get a warning. v2 will handle pumps in series and in parallel.
3. **Path uniqueness** — BFS returns one shortest-hop route. If there's more than one valid route between your start and end, the chosen one might not be the one you mean. The amber-highlighted **route preview** on the Analysis page shows you exactly which path the solver picked. Look at it before trusting the numbers.
4. **Pump curve fitting** is a global quadratic least-squares fit. Unusual manufacturer shapes (s-curves, dropping characteristics) may fit poorly. Provide more curve points if you care, or call me a hack on the issue tracker.
5. **Fixed-bar-drop equipment** (some heat exchanger defaults) doesn't vary with Q. v2 will let you specify a quadratic-in-Q drop for those.
6. **Forward-solve flow bracket is capped at 2000 m³/h.** Larger systems can have their bracket extended in code (one constant).
7. **Cv-vs-opening and K-vs-opening models are engineering approximations** (linear and inverse-square respectively), not full inherent characteristic curves. Use the preset values for ballpark; override for hero work.
8. **Browser fallback mode** (no Tauri) loses native file dialogs and recents. Save is "Save As to your Downloads folder". This is a browser security limitation, not laziness.

If you find a bug, open an issue. If you find a limitation that's marked above as "limitation", *don't* open an issue saying you found a bug.

---

## Tips That Will Save You Time

- **Attach an instrument to a pipe**: drop the instrument near the pipe. The editor inserts a tap point, splits the pipe, runs a signal line. No manual node-on-edge plumbing required.
- **Drop a stand-alone tap point** from the Connectors section if you want one without an attached instrument.
- **Skip the lookups**: every parameterised component has a **Preset** selector in the inspector. Pumps, valves, pipes, filters, fluids — all ship with curated common values. Pick a preset, tweak the field that's actually different.
- **Rotate after placing**: select, press **R**. Shift+R for the other way. Ports follow the rotation, so connections stay valid.
- **Trace your analysis path** by looking at the amber RoutePreview on the Analysis page. If the highlight is the wrong path, your start/end picks are ambiguous — drop in an extra component on the path you mean so BFS picks it.
- **"Send current view to Drawings"** captures whatever's in your viewport right now, not the whole diagram. Frame your shot, then click. Great for detail sheets.
- **Per-page title-block overrides** mean every sheet can have a different title or revision without breaking the project-level meta. Useful when you've got a vendor sheet at rev B in a pack at rev 0.

---

## Roadmap

In rough order of "things I'll get round to":

- [ ] **Branched / looped network solver** — Newton-Raphson over node mass balance. Same `solve()` signature so the UI doesn't change.
- [ ] **Pumps in series / parallel** — first-class handling, not a warning.
- [ ] **Off-page connector resolution** — connectors as actual graph bridges between sheets.
- [ ] **Instrument loops** — visualise control loops as logical groups.
- [ ] **Layered visibility** — toggle utilities, signals, etc. on/off.
- [ ] **Comparison mode** — diff two `.pid` files visually for design review.
- [ ] **Alignment guides during drag** — Visio-style snap lines.
- [ ] **NPSH and cavitation check** on the suction side of pumps.
- [ ] **Temperature marching** along pipes with rho/mu as functions of T.
- [ ] **Code signing certificate** so Windows SmartScreen stops complaining on first launch.
- [ ] **Auto-updater** via Tauri's first-party updater + GitHub Releases.

If you want one of these faster than I'm doing it, open an issue. Bonus points if you bring a PR. Maximum points if the PR doesn't introduce a licence server.

---

## Philosophy

- **If it's your drawing, you should be allowed to print it.** Without a subscription. Without a phone call. Without a checkbox saying "I agree to receive marketing emails from our Innovation Solutions division."
- **A pump and a pipe should not cost a four-figure annual fee to put on a diagram.** They cost about £200 in real life. The software to draw them should cost less than the pump.
- **Solving a quadratic for a flow rate is not a service. It is one line of code.** It is not "an enterprise capability". It is not "a premium analytics feature". It is `(-b + sqrt(b² - 4ac)) / 2a`, which is on Wikipedia.
- **Software should shut the fuck up and do the job.** No splash screen for the renewal team. No nag dialog. No "please review us on G2". No.
- **Tools should not expire because accounting said so.** If it worked yesterday, it should work today. Forever. Even if I get hit by a bus, this thing keeps working. That is a feature.

No cloud. No accounts. No "trial expired". No watermark threatening legal action. No auto-renew. No "your administrator has disabled this feature". No "this requires the Enterprise tier". No.

---

## Status

Used on real projects. Trusted more than licence servers. Maintained out of pure spite.

If it breaks, it's because **I** broke it — not because a vendor flipped a switch in a config file on a server in Massachusetts.

The codebase is roughly **16,000 lines of TypeScript** + about **300 lines of Rust**. Type-checked with `tsc --strict`. Linted with ESLint. Builds in a minute. Boots in under a second. Compiles to a ~12 MB executable.

For comparison, the Aveva E3D installer is 4.7 GB and takes about twenty minutes to install on an SSD. It also can't draw a centrifugal pump until you've created a database and configured a project catalogue. I'm not making this up.

---

## Contributing

Yes please. The codebase tries hard to be readable:

- Every file has a docstring at the top explaining what it does and why
- The engine is pure functions with explicit types
- The symbols registry is a flat list — adding a symbol is one object + one tiny SVG component
- Presets are flat data files — adding a preset is one row

Open issues, open PRs. The only thing I won't merge is anything that:

- Adds a phone-home
- Adds telemetry
- Adds a licence check
- Adds a "log in to continue"
- Adds an EULA longer than this README
- Imports a 200 MB dependency to do something three lines of regex would handle

---

## Licence

**MIT.**

Do whatever you want with it. Fork it. Ship it. Rename it. Sell it. Use it in commercial projects. Modify it past recognition. Print the source code and bind it as a book.

Just don't:

- Add a login screen
- Add a watermark
- Add "phone home to check licence"
- Submit it to the Microsoft Store as a $5.99/month subscription
- Rename it to "PiperPro™ AI Edition Now With Blockchain" and post it on Product Hunt

If you do any of the above, I will personally show up and read this README to you in front of your investors.

---

## Final Thought

The idea behind this entire program is exactly one sentence long:

> **You should not need an annual five-figure software contract to draw a pump and work out how much water comes out of it.**

The big CAD and process-simulation vendors decided otherwise. They built their entire business around making sure that you do. They lock files behind subscriptions. They sunset features to force upgrades. They invent "AI-powered" reasons to charge more for the same screen with a different gradient on the buttons. They treat the act of *drawing a diagram* — the most basic possible act of engineering communication — as an enterprise SaaS opportunity.

It is, to be perfectly clear, **fucking absurd**.

This tool exists because that situation is absurd.

It will keep existing because that situation isn't going away.

Enjoy.

— Ash

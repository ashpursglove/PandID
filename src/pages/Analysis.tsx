import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ClipboardList,
  HelpCircle,
  Info,
  Play,
  Send,
} from "lucide-react";

import { sendPidBomToDrawings } from "@/components/Drawings/sendBomPage";

import { useDiagramStore } from "@/store/diagramStore";
import { useProjectStore } from "@/store/projectStore";
import { useUIStore } from "@/store/uiStore";
import { newPageId, useDrawingsStore } from "@/store/drawingsStore";
import { toEngineGraph } from "@/engine/adapter";
import { extractPath, NoPathError } from "@/engine/path";
import { solve } from "@/engine/solver";
import type { SinglePathResult } from "@/engine/types";
import { paginateAnalysisComponents } from "@/io/drawingsRender";
import { TextInput } from "@/components/Inspector/fields/TextInput";
import { Select } from "@/components/Inspector/fields/Select";
import { PresetDropdown } from "@/components/Inspector/PresetDropdown";
import { PumpSystemChart } from "@/components/Analysis/PumpSystemChart";
import { RoutePreview } from "@/components/Analysis/RoutePreview";
import {
  FLUID_CATEGORY_OPTIONS,
  type FluidCategoryId,
  FLUID_PRESETS,
  fluidPresetsForCategory,
} from "@/presets/fluids";
import { cn } from "@/lib/utils";

type Mode = "forward" | "inverse";

export function Analysis() {
  const nodes = useDiagramStore((s) => s.nodes);
  const edges = useDiagramStore((s) => s.edges);
  const fluids = useProjectStore((s) => s.fluids);
  const addFluid = useProjectStore((s) => s.addFluid);
  const updateFluid = useProjectStore((s) => s.updateFluid);

  // Persist these picks in the UI store so swapping to the editor and back
  // doesn't wipe the From/To/fluid selections.
  const startId = useUIStore((s) => s.analysisStartId);
  const endId = useUIStore((s) => s.analysisEndId);
  const storedFluidId = useUIStore((s) => s.analysisFluidId);
  const mode = useUIStore((s) => s.analysisMode);
  const targetQM3h = useUIStore((s) => s.analysisTargetQM3h);
  const setAnalysisSelection = useUIStore((s) => s.setAnalysisSelection);

  // Resolve the fluid: explicit pick if still valid, otherwise the first
  // available fluid (water 20 °C by default).
  const fluidId =
    storedFluidId && fluids.some((f) => f.id === storedFluidId)
      ? storedFluidId
      : fluids[0]?.id ?? "";

  const setStartId = (v: string) => setAnalysisSelection({ startId: v });
  const setEndId = (v: string) => setAnalysisSelection({ endId: v });

  // Click-to-pick from the preview: first click sets From, second sets To,
  // and a third (or clicking the current From) starts a fresh From selection.
  const pickNode = (id: string) => {
    if (!startId || (startId && endId)) {
      setAnalysisSelection({ startId: id, endId: "" });
    } else if (id !== startId) {
      setAnalysisSelection({ endId: id });
    }
  };
  const setFluidId = (v: string) => setAnalysisSelection({ fluidId: v });
  const setMode = (v: Mode) => setAnalysisSelection({ mode: v });
  const setTargetQM3h = (v: number) =>
    setAnalysisSelection({ targetQM3h: v });

  const [result, setResult] = useState<SinglePathResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const addDrawingPage = useDrawingsStore((s) => s.addPage);
  const drawingPages = useDrawingsStore((s) => s.pages);

  function sendReportToDrawings() {
    if (!result || !fluid) return;
    const startNode = nodes.find((n) => n.id === startId);
    const endNode = nodes.find((n) => n.id === endId);
    const startLabel = startNode?.data.tag || startNode?.data.label || startId;
    const endLabel = endNode?.data.tag || endNode?.data.label || endId;

    // Re-extract the path so we capture the exact set of nodes/edges that the
    // route preview is currently highlighting — frozen onto the drawing page
    // so future edits to the live diagram don't invalidate the report.
    let pathNodeIds: string[] = [];
    let pathEdgeIds: string[] = [];
    try {
      const g = toEngineGraph(nodes, edges);
      const path = extractPath(g, startId, endId);
      pathNodeIds = path.map((s) => s.node.id);
      pathEdgeIds = path.filter((s) => s.edge).map((s) => s.edge!.id);
    } catch {
      // Solve succeeded so a path exists, but if extraction fails fall through
      // with empty highlight sets — the page still renders, just without the
      // amber overlay.
    }

    const idx = drawingPages.filter((p) => p.type === "analysis").length + 1;

    // Partition the component breakdown across as many sheets as it takes to
    // fit. The first sheet always carries the route preview + KPI cards;
    // subsequent sheets are continuation pages with only the breakdown.
    const slices = paginateAnalysisComponents(result.components);
    const total = slices.length;
    const frozenNodes = structuredClone(nodes);
    const frozenEdges = structuredClone(edges);

    slices.forEach((slice, pageIdx) => {
      const isCont = pageIdx > 0;
      const pageSuffix =
        total > 1 ? ` — page ${pageIdx + 1}/${total}` : "";
      addDrawingPage({
        id: newPageId(),
        title: isCont
          ? `Analysis (cont.) — ${startLabel} → ${endLabel} (#${idx})${pageSuffix}`
          : `Analysis — ${startLabel} → ${endLabel} (#${idx})${pageSuffix}`,
        type: "analysis",
        titleBlock: {},
        annotations: [],
        analysis: {
          startId,
          endId,
          startLabel,
          endLabel,
          fluidName: fluid.name,
          mode,
          targetQM3h: mode === "inverse" ? targetQM3h : undefined,
          result,
          // Continuation pages don't draw the route preview so they don't
          // need the diagram payload — keep the .pid file lean.
          nodes: isCont ? [] : frozenNodes,
          edges: isCont ? [] : frozenEdges,
          pathNodeIds: isCont ? [] : pathNodeIds,
          pathEdgeIds: isCont ? [] : pathEdgeIds,
          pageIndex: pageIdx,
          totalPages: total,
          componentSlice: { start: slice.start, end: slice.end },
        },
      });
    });
  }

  const nodeOptions = useMemo(
    () =>
      nodes.map((n) => ({
        value: n.id,
        label: n.data.tag || n.data.label || n.id,
      })),
    [nodes],
  );

  const fluid = fluids.find((f) => f.id === fluidId) ?? fluids[0];

  function runSolve() {
    setError(null);
    setResult(null);
    if (!fluid) {
      setError("Select a fluid first.");
      return;
    }
    if (!startId || !endId) {
      setError("Pick both start and end components.");
      return;
    }
    try {
      const graph = toEngineGraph(nodes, edges);
      const r = solve(
        mode === "forward"
          ? { mode, graph, fluid, startNodeId: startId, endNodeId: endId }
          : {
              mode,
              graph,
              fluid,
              startNodeId: startId,
              endNodeId: endId,
              targetQM3h,
            },
      );
      setResult(r);
    } catch (e) {
      if (e instanceof NoPathError) {
        setError(e.message);
      } else {
        setError(`Solver failed: ${(e as Error).message}`);
      }
    }
  }

  function createFluid() {
    const id = `fluid-${Date.now().toString(36)}`;
    addFluid({
      id,
      name: "New fluid",
      densityKgM3: 1000,
      viscosityPaS: 1e-3,
      temperatureC: 20,
    });
    setFluidId(id);
  }

  return (
    <div className="flex h-full w-full">
      <aside className="flex w-80 shrink-0 flex-col border-r border-zinc-800 bg-[var(--color-panel)] overflow-y-auto">
        <header className="border-b border-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Analysis input
        </header>
        <div className="flex flex-col gap-4 p-3 text-sm">
          <Section
            step={1}
            title="Where does the flow go?"
            help="Pick two components in your drawing. We'll trace the route between them and analyse every pipe and fitting in between."
          >
            <Field label="From">
              <Select
                value={startId}
                options={[{ value: "", label: "— select —" }, ...nodeOptions]}
                onChange={setStartId}
              />
            </Field>
            <Field label="To">
              <Select
                value={endId}
                options={[{ value: "", label: "— select —" }, ...nodeOptions]}
                onChange={setEndId}
              />
            </Field>
          </Section>

          <Section
            step={2}
            title="What's flowing?"
            help="Density and viscosity decide how easily the fluid moves. Use a preset for common fluids or enter the numbers manually."
            action={
              <button
                type="button"
                onClick={createFluid}
                className="text-[10px] text-sky-400 hover:text-sky-300"
              >
                + new
              </button>
            }
          >
            <Field label="Active fluid">
              <Select
                value={fluidId}
                options={fluids.map((f) => ({ value: f.id, label: f.name }))}
                onChange={setFluidId}
              />
            </Field>
            {fluid && (
              <>
                <Field label="Fluid group">
                  <Select
                    value={fluid.presetCategory ?? ""}
                    options={[
                      { value: "", label: "All presets" },
                      ...FLUID_CATEGORY_OPTIONS.map((c) => ({
                        value: c.id,
                        label: c.label,
                      })),
                    ]}
                    onChange={(c) =>
                      updateFluid(fluid.id, {
                        presetCategory: (c || undefined) as
                          | FluidCategoryId
                          | undefined,
                        presetId: undefined,
                      })
                    }
                  />
                </Field>
                <label className="flex flex-col gap-1">
                  <span className="px-1 text-[11px] font-medium text-zinc-400">
                    Preset
                  </span>
                  <PresetDropdown
                    items={fluidPresetsForCategory(
                      (fluid.presetCategory as FluidCategoryId) || "",
                    ).map((f) => ({
                      id: f.id,
                      label: f.label,
                      values: f.values,
                    }))}
                    selectedId={fluid.presetId}
                    placeholder="Choose a fluid preset…"
                    onSelect={(item) => {
                      const preset = FLUID_PRESETS.find((p) => p.id === item.id);
                      if (!preset) return;
                      updateFluid(fluid.id, {
                        ...preset.values,
                        presetId: preset.id,
                        presetCategory: preset.category,
                      });
                    }}
                    onClear={() =>
                      updateFluid(fluid.id, { presetId: undefined })
                    }
                  />
                </label>
                <Field label="Name">
                  <TextInput
                    value={fluid.name}
                    onChange={(v) => updateFluid(fluid.id, { name: v })}
                  />
                </Field>
                <Field label="Density">
                  <TextInput
                    type="number"
                    unit="kg/m³"
                    value={String(fluid.densityKgM3)}
                    onChange={(v) =>
                      updateFluid(fluid.id, {
                        densityKgM3: parseFinite(v, fluid.densityKgM3),
                      })
                    }
                  />
                </Field>
                <Field label="Viscosity">
                  <TextInput
                    type="number"
                    unit="Pa·s"
                    step={1e-5}
                    value={String(fluid.viscosityPaS)}
                    onChange={(v) =>
                      updateFluid(fluid.id, {
                        viscosityPaS: parseFinite(v, fluid.viscosityPaS),
                      })
                    }
                  />
                </Field>
                <Field label="Temperature">
                  <TextInput
                    type="number"
                    unit="°C"
                    value={String(fluid.temperatureC)}
                    onChange={(v) =>
                      updateFluid(fluid.id, {
                        temperatureC: parseFinite(v, fluid.temperatureC),
                      })
                    }
                  />
                </Field>
              </>
            )}
          </Section>

          <Section
            step={3}
            title="What should we calculate?"
            help="Choose what you're trying to find out."
          >
            <div className="flex flex-col gap-1.5">
              <ModeChoice
                active={mode === "forward"}
                onClick={() => setMode("forward")}
                title="Predict the flow rate"
                blurb="I've drawn the pumps and pipes. Tell me how fast the fluid will actually move (where the pump curve meets the system curve)."
              />
              <ModeChoice
                active={mode === "inverse"}
                onClick={() => setMode("inverse")}
                title="Solve for a target flow"
                blurb="I want a specific flow rate. Tell me what pump head is needed and where it gets lost."
              />
            </div>
            {mode === "inverse" && (
              <Field label="Target flow">
                <TextInput
                  type="number"
                  unit="m³/h"
                  value={String(targetQM3h)}
                  onChange={(v) =>
                    setTargetQM3h(parseFinite(v, targetQM3h))
                  }
                />
              </Field>
            )}
          </Section>

          <button
            type="button"
            onClick={runSolve}
            className="mt-2 flex items-center justify-center gap-2 rounded bg-sky-500 px-3 py-2 text-sm font-medium text-zinc-950 transition hover:bg-sky-400"
          >
            <Play size={14} /> Solve
          </button>

          <button
            type="button"
            onClick={() => sendPidBomToDrawings()}
            title="Build a Bill of Materials from this P&ID and add it to the Drawings tab"
            className="flex items-center justify-center gap-2 rounded border border-zinc-700 bg-[var(--color-panel-2)] px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-sky-500 hover:text-sky-200"
          >
            <ClipboardList size={14} /> Send BOM to Drawings
          </button>

          {error && (
            <p className="rounded border border-red-800 bg-red-950/60 px-2 py-1.5 text-[11px] text-red-200">
              <AlertTriangle size={12} className="-mt-0.5 mr-1 inline" />
              {error}
            </p>
          )}
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-y-auto">
        <RoutePreview
          nodes={nodes}
          edges={edges}
          startId={startId}
          endId={endId}
          onPickNode={pickNode}
        />
        {result ? (
          <ResultView
            result={result}
            mode={mode}
            onSendToDrawings={sendReportToDrawings}
          />
        ) : (
          <EmptyState onSolve={runSolve} />
        )}
      </main>
    </div>
  );
}

function ResultView({
  result,
  mode,
  onSendToDrawings,
}: {
  result: SinglePathResult;
  mode: Mode;
  onSendToDrawings: () => void;
}) {
  const [sent, setSent] = useState(false);
  function handleSend() {
    onSendToDrawings();
    setSent(true);
    window.setTimeout(() => setSent(false), 1500);
  }
  return (
    <div className="flex flex-col">
      {/* Sticky top bar — the result view can be very tall, so we pin the
       *  "Send to Drawings" action to the top of the scroll viewport. The
       *  parent <main> uses overflow-y-auto, which forms the scroll context
       *  this element sticks within. Mid-page and footer copies of the button
       *  also exist below so users hitting the bottom don't have to scroll
       *  back up. */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-[var(--color-panel)]/95 px-3 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-panel)]/80">
        <span className="text-[11px] uppercase tracking-wider text-zinc-500">
          Result
        </span>
        <SendToDrawingsButton
          variant="outline"
          sent={sent}
          onSend={handleSend}
        />
      </div>

      <PlainEnglishSummary result={result} mode={mode} />

      <div className="grid grid-cols-4 gap-2 border-b border-zinc-800 p-3 text-xs">
        <StatCard
          label={mode === "forward" ? "Predicted flow" : "Target flow"}
          value={`${result.qM3h.toFixed(2)} m³/h`}
          hint={`≈ ${(result.qM3h / 3.6).toFixed(2)} L/s`}
        />
        <StatCard
          label="Pump head delivered"
          value={`${result.pumpHeadM.toFixed(2)} m`}
          hint="How hard the pump has to push."
        />
        <StatCard
          label="System head required"
          value={`${result.systemHeadM.toFixed(2)} m`}
          hint="What the pipes and fittings cost."
        />
        <StatCard
          label="Elevation change"
          value={`${result.elevationDeltaM.toFixed(2)} m`}
          hint="Climb (+) or drop (−) along the route."
        />
      </div>

      <section className="border-b border-zinc-800 p-3">
        <h3 className="mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          <span className="flex items-center gap-1">
            Pump vs. system curve
            <HelpHint text="The pump curve shows how much head it produces at each flow. The system curve shows how much head the pipes need at each flow. Where they cross is the operating point." />
          </span>
          <SendToDrawingsButton
            variant="outline"
            sent={sent}
            onSend={handleSend}
          />
        </h3>
        <p className="mb-2 text-[11px] leading-relaxed text-zinc-500">
          The yellow dot marks the operating point — where the two curves
          meet. Scroll over the chart to zoom, drag to pan, double-click to
          reset.
        </p>
        <div className="h-72">
          <PumpSystemChart result={result} />
        </div>
      </section>

      <section className="border-b border-zinc-800 p-3">
        <h3 className="mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          <span className="flex items-center gap-1">
            Where does the head go?
            <HelpHint text="Every pipe and fitting steals a little head from the pump. This table tells you exactly how much, and how fast the fluid is moving through each one." />
          </span>
          <SendToDrawingsButton
            variant="outline"
            sent={sent}
            onSend={handleSend}
          />
        </h3>
        <ComponentsTable result={result} />
      </section>

      {result.warnings.length > 0 && (
        <section className="border-b border-zinc-800 p-3">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Things to double-check
          </h3>
          <ul className="space-y-1 text-[12px] text-amber-300">
            {result.warnings.map((w, i) => (
              <li key={i}>
                <AlertTriangle size={12} className="-mt-0.5 mr-1 inline" />
                {w}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Footer CTA — last chance for users who scrolled to the bottom. The
       *  prominent (filled) variant signals it's the primary next-action
       *  after reading the breakdown. */}
      <section className="flex flex-col items-center gap-2 border-b border-zinc-800 bg-[var(--color-panel)] p-4 text-center">
        <p className="text-xs text-zinc-400">
          Happy with this result? Pin it to the Drawings tab as a report
          page.
        </p>
        <SendToDrawingsButton
          variant="primary"
          sent={sent}
          onSend={handleSend}
        />
      </section>

      <Glossary />
    </div>
  );
}

/**
 * Single source of truth for the "Send report to Drawings" action — we drop
 * several of these around the ResultView so the user never has to scroll
 * back to a specific spot to issue the action. All instances share the same
 * `sent` flash (lifted into the parent ResultView) so the confirmation
 * appears on every copy at once.
 */
function SendToDrawingsButton({
  variant,
  sent,
  onSend,
}: {
  variant: "outline" | "primary";
  sent: boolean;
  onSend: () => void;
}) {
  const base = "inline-flex items-center gap-1.5 rounded text-[11px] transition";
  const styles =
    variant === "primary"
      ? "bg-sky-500 px-3 py-1.5 text-zinc-950 font-medium shadow-sm shadow-sky-500/20 hover:bg-sky-400"
      : "border border-zinc-700 bg-[var(--color-panel-2)] px-2.5 py-1 text-zinc-200 hover:border-sky-500 hover:text-sky-200";
  return (
    <button
      type="button"
      onClick={onSend}
      title="Add this report as a new page in the Drawings tab"
      className={cn(base, styles)}
    >
      <Send size={variant === "primary" ? 13 : 11} />
      {sent ? "Sent ✓" : "Send report to Drawings"}
    </button>
  );
}

function PlainEnglishSummary({
  result,
  mode,
}: {
  result: SinglePathResult;
  mode: Mode;
}) {
  const q = result.qM3h;
  const qLs = q / 3.6;
  const pumpH = result.pumpHeadM;
  const sysH = result.systemHeadM;
  const elev = result.elevationDeltaM;
  const direction = elev > 0.05 ? "climb" : elev < -0.05 ? "drop" : "level run";
  const feas = result.feasibility;

  if (feas && !feas.ok) {
    return (
      <section className="border-b border-red-900/70 bg-red-950/30 p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-400" />
          <div className="flex flex-col gap-1 text-sm leading-relaxed text-red-100">
            <p className="font-semibold text-red-200">
              {infeasibleHeadline(feas.reason)}
            </p>
            {feas.message && (
              <p className="text-[12px] leading-relaxed text-red-100/90">
                {feas.message}
              </p>
            )}
            <p className="text-[12px] text-red-200/80">
              {feasibilityFigures(result)}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const lead =
    mode === "forward"
      ? `At equilibrium, about ${q.toFixed(1)} m³/h (~${qLs.toFixed(2)} L/s) will flow through this path.`
      : `To move ${q.toFixed(1)} m³/h (~${qLs.toFixed(2)} L/s), here's what the system has to overcome.`;

  return (
    <section className="border-b border-zinc-800 bg-[var(--color-panel)] p-3">
      <div className="flex items-start gap-2">
        <Info size={14} className="mt-0.5 shrink-0 text-sky-400" />
        <div className="flex flex-col gap-1 text-sm leading-relaxed text-zinc-200">
          <p>{lead}</p>
          <p className="text-[12px] text-zinc-400">
            The pump delivers <strong className="text-zinc-200">{pumpH.toFixed(2)} m</strong> of head;
            the pipes and fittings need <strong className="text-zinc-200">{sysH.toFixed(2)} m</strong> to push the fluid
            through that {direction}
            {Math.abs(elev) > 0.05
              ? ` of ${Math.abs(elev).toFixed(2)} m`
              : ""}.
            {mode === "forward" &&
              " That's why the operating point sits where it does on the chart below."}
          </p>
        </div>
      </div>
    </section>
  );
}

function infeasibleHeadline(reason: SinglePathResult["feasibility"]["reason"]): string {
  switch (reason) {
    case "no-pump":
      return "No pump in the path";
    case "shutoff-below-static":
      return "Pump can't lift the fluid";
    case "no-intersection":
      return "Pump is too small for this system";
    case "pump-undersized":
      return "Pump can't deliver the requested flow";
    default:
      return "Not physically achievable";
  }
}

function feasibilityFigures(result: SinglePathResult): string {
  const parts: string[] = [];
  parts.push(`Pump shut-off head: ${result.pumpShutoffHeadM.toFixed(2)} m`);
  parts.push(`Static lift on this path: ${result.elevationDeltaM.toFixed(2)} m`);
  const max = result.feasibility.maxAchievableQM3h;
  if (typeof max === "number")
    parts.push(`Max achievable flow: ${max.toFixed(2)} m³/h`);
  return parts.join("  •  ");
}

function flowRegime(re: number | null | undefined): {
  label: string;
  tone: "laminar" | "transition" | "turbulent" | "none";
  blurb: string;
} {
  if (re == null || !Number.isFinite(re))
    return { label: "—", tone: "none", blurb: "" };
  if (re < 2300)
    return {
      label: "Laminar",
      tone: "laminar",
      blurb: "Smooth, layered flow — friction is low.",
    };
  if (re < 4000)
    return {
      label: "Transition",
      tone: "transition",
      blurb: "Switching between smooth and turbulent — predictions are less precise.",
    };
  return {
    label: "Turbulent",
    tone: "turbulent",
    blurb: "Mixed, swirling flow — the friction factor depends on pipe roughness.",
  };
}

function RegimeBadge({ re }: { re: number | null | undefined }) {
  const { label, tone, blurb } = flowRegime(re);
  if (tone === "none")
    return <span className="text-zinc-600">—</span>;
  const cls =
    tone === "laminar"
      ? "border-sky-700 bg-sky-950/60 text-sky-200"
      : tone === "transition"
        ? "border-amber-700 bg-amber-950/60 text-amber-200"
        : "border-emerald-700 bg-emerald-950/60 text-emerald-200";
  return (
    <span
      title={blurb}
      className={cn(
        "inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium",
        cls,
      )}
    >
      {label}
    </span>
  );
}

function Glossary() {
  const [open, setOpen] = useState(false);
  return (
    <section className="border-t border-zinc-800 p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-200"
      >
        <HelpCircle size={12} />
        {open ? "Hide glossary" : "What do these numbers mean?"}
      </button>
      {open && (
        <dl className="mt-3 grid grid-cols-1 gap-3 text-[12px] leading-relaxed text-zinc-300 md:grid-cols-2">
          <Term name="Flow rate (Q)">
            How much fluid passes per unit time. In m³/h, L/s, or US GPM. Bigger
            pipes can carry more for the same speed.
          </Term>
          <Term name="Head (m)">
            Pump head is how high a column of the fluid the pump can hold up.
            It's a fluid-agnostic way to talk about pressure: 10 m of water
            head ≈ 1 bar.
          </Term>
          <Term name="System head">
            The total head the system needs the pump to provide to move the
            requested flow: friction losses + elevation change.
          </Term>
          <Term name="Pressure drop (ΔP)">
            How much pressure each component subtracts from the fluid. Add them
            up and you get the system head (in pressure units).
          </Term>
          <Term name="Speed (v)">
            How fast the fluid moves through each pipe. Typical liquid lines
            run 1–3 m/s. Too slow → things settle; too fast → erosion, noise.
          </Term>
          <Term name="Reynolds number (Re)">
            A dimensionless ratio that decides whether flow is laminar,
            transitional, or turbulent. Most process flows are turbulent
            (Re ≥ 4 000).
          </Term>
          <Term name="Friction factor">
            How rough the inside of the pipe is, relative to the flow. We
            compute it from Reynolds and the pipe roughness using the
            Colebrook–White equation.
          </Term>
        </dl>
      )}
    </section>
  );
}

function Term({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-zinc-800 bg-[var(--color-panel)] p-2">
      <dt className="text-[11px] font-semibold text-zinc-100">{name}</dt>
      <dd className="mt-0.5 text-zinc-400">{children}</dd>
    </div>
  );
}

function HelpHint({ text }: { text: string }) {
  return (
    <span
      title={text}
      className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-zinc-700 text-[8px] font-bold text-zinc-400 normal-case"
    >
      ?
    </span>
  );
}

function ComponentsTable({ result }: { result: SinglePathResult }) {
  return (
    <div className="overflow-x-auto rounded border border-zinc-800">
      <table className="w-full text-xs">
        <thead className="bg-zinc-900 text-[10px] uppercase tracking-wider text-zinc-500">
          <tr>
            <th className="px-2 py-1 text-left">Component</th>
            <th className="px-2 py-1 text-left">Type</th>
            <th
              className="px-2 py-1 text-right"
              title="How much pressure the fluid loses across this component."
            >
              Pressure drop
              <div className="text-[9px] text-zinc-600 normal-case">bar</div>
            </th>
            <th
              className="px-2 py-1 text-right"
              title="The pressure drop expressed as height of the working fluid."
            >
              Head loss
              <div className="text-[9px] text-zinc-600 normal-case">m</div>
            </th>
            <th
              className="px-2 py-1 text-right"
              title="How fast the fluid is moving through this pipe."
            >
              Speed
              <div className="text-[9px] text-zinc-600 normal-case">m/s</div>
            </th>
            <th
              className="px-2 py-1 text-left"
              title="Laminar / Transition / Turbulent — based on the Reynolds number."
            >
              Flow regime
            </th>
            <th className="px-2 py-1 text-right" title="Reynolds number (dimensionless).">
              Re
            </th>
          </tr>
        </thead>
        <tbody>
          {result.components.map((c, i) => (
            <ComponentRow key={i} c={c} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComponentRow({ c }: { c: SinglePathResult["components"][number] }) {
  const isPipe = c.kind === "pipe";
  return (
    <>
      <tr className="border-t border-zinc-800 text-zinc-300 odd:bg-zinc-950 even:bg-[var(--color-panel)]">
        <td className="px-2 py-1 font-medium text-zinc-100">{c.label}</td>
        <td className="px-2 py-1">{displayKind(c.kind)}</td>
        <td className="px-2 py-1 text-right">
          {(c.deltaPpa / 1e5).toFixed(4)}
        </td>
        <td className="px-2 py-1 text-right">{c.headM.toFixed(3)}</td>
        <td className="px-2 py-1 text-right">
          {c.velocityMs != null ? c.velocityMs.toFixed(2) : "—"}
        </td>
        <td className="px-2 py-1">
          <RegimeBadge re={c.reynolds} />
        </td>
        <td className="px-2 py-1 text-right">
          {c.reynolds != null
            ? Math.round(c.reynolds).toLocaleString()
            : "—"}
        </td>
      </tr>
      {isPipe && <PipeBreakdownRow c={c} />}
    </>
  );
}

function PipeBreakdownRow({
  c,
}: {
  c: SinglePathResult["components"][number];
}) {
  const frac = (v?: number) => {
    if (v == null || c.headM === 0) return null;
    return (v / c.headM) * 100;
  };
  const friction = c.frictionHeadM;
  const fittings = c.fittingsHeadM;
  const elev = c.elevationHeadM;

  const dim = (v?: number) => (typeof v === "number" ? v.toFixed(2) : "?");

  return (
    <tr className="border-t border-zinc-900 text-[11px] text-zinc-500 odd:bg-zinc-950 even:bg-[var(--color-panel)]">
      <td colSpan={7} className="px-3 py-2">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
          <div className="min-w-[220px] flex-1">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
              Loss breakdown
            </p>
            <ul className="space-y-0.5 font-mono text-[11px] text-zinc-300">
              <BreakdownLine
                label="Friction (pipe wall)"
                value={friction}
                pct={frac(friction)}
              />
              <BreakdownLine
                label="Fittings (minor losses)"
                value={fittings}
                pct={frac(fittings)}
              />
              <BreakdownLine
                label={
                  (elev ?? 0) >= 0 ? "Elevation rise" : "Elevation drop (recovers head)"
                }
                value={elev}
                pct={frac(elev)}
              />
            </ul>
          </div>
          <div className="min-w-[220px] flex-1">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
              Pipe geometry
            </p>
            <ul className="space-y-0.5 text-[11px] text-zinc-400">
              <li>
                Length:{" "}
                <span className="font-mono text-zinc-200">{dim(c.lengthM)} m</span>
              </li>
              <li>
                Inner ⌀:{" "}
                <span className="font-mono text-zinc-200">
                  {dim(c.innerDiameterMm)} mm
                </span>
              </li>
              <li>
                Wall roughness:{" "}
                <span className="font-mono text-zinc-200">
                  {dim(c.roughnessMm)} mm
                </span>
              </li>
              <li>
                Fittings:{" "}
                <span className="text-zinc-200">{c.fittingsSummary ?? "—"}</span>
              </li>
            </ul>
          </div>
        </div>
      </td>
    </tr>
  );
}

function BreakdownLine({
  label,
  value,
  pct,
}: {
  label: string;
  value: number | undefined;
  pct: number | null;
}) {
  if (value == null) return null;
  const sign = value >= 0 ? "+" : "−";
  const mag = Math.abs(value);
  return (
    <li className="flex justify-between gap-3">
      <span className="text-zinc-400">{label}</span>
      <span className="tabular-nums">
        {sign}
        {mag.toFixed(3)} m
        {pct != null && (
          <span className="ml-2 text-zinc-600">
            ({pct >= 0 ? pct.toFixed(0) : `−${Math.abs(pct).toFixed(0)}`} %)
          </span>
        )}
      </span>
    </li>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded border border-zinc-800 bg-[var(--color-panel)] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-zinc-100">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-zinc-500">{hint}</p>}
    </div>
  );
}

function EmptyState({ onSolve }: { onSolve: () => void }) {
  return (
    <div className="flex min-h-[40vh] flex-1 flex-col items-center justify-center gap-5 px-6 text-center text-zinc-400">
      <Play size={28} className="text-zinc-700" />
      <div className="max-w-xl space-y-3">
        <p className="text-base font-medium text-zinc-100">
          Configure the analysis on the left, then run the solver.
        </p>
        <p className="text-[12px] leading-relaxed text-zinc-500">
          The solver traces the route between the selected start and end
          components, applies the chosen fluid properties, and computes the
          resulting flow rate, fluid velocity, pump head, and stage-by-stage
          pressure-drop budget for every pipe, fitting, valve, and item of
          equipment along the path. Use{" "}
          <span className="font-medium text-zinc-300">Predict the flow rate</span>{" "}
          to find the natural operating point where the pump and system curves
          intersect, or{" "}
          <span className="font-medium text-zinc-300">Solve for a target flow</span>{" "}
          to back-calculate the head required for a specified throughput.
        </p>
      </div>
      {/* Convenience-run button — mirrors the sidebar Solve so users with a
       *  ready setup don't have to reach back across the layout. Any missing
       *  prerequisites (fluid / endpoints / route) are surfaced as inline
       *  errors by runSolve itself. */}
      <button
        type="button"
        onClick={onSolve}
        className="inline-flex items-center gap-2 rounded bg-sky-500 px-4 py-2 text-sm font-medium text-zinc-950 shadow-md shadow-sky-500/20 transition hover:bg-sky-400"
      >
        <Play size={14} /> Solve
      </button>
    </div>
  );
}

function Section({
  step,
  title,
  help,
  children,
  action,
}: {
  step?: number;
  title: string;
  help?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-start justify-between gap-2 px-1">
        <div className="flex items-start gap-2">
          {step != null && (
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-[10px] font-semibold text-sky-300">
              {step}
            </span>
          )}
          <div>
            <h3 className="text-[12px] font-semibold text-zinc-200">{title}</h3>
            {help && (
              <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">
                {help}
              </p>
            )}
          </div>
        </div>
        {action}
      </header>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="px-1 text-[11px] font-medium text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function ModeChoice({
  active,
  onClick,
  title,
  blurb,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  blurb: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-md border px-2 py-1.5 text-left transition",
        active
          ? "border-sky-500 bg-sky-500/10"
          : "border-zinc-800 bg-[var(--color-panel-2)] hover:border-zinc-600",
      )}
    >
      <span
        className={cn(
          "text-[12px] font-semibold",
          active ? "text-sky-200" : "text-zinc-200",
        )}
      >
        {title}
      </span>
      <span className="text-[11px] leading-snug text-zinc-500">{blurb}</span>
    </button>
  );
}

function parseFinite(v: string, fallback: number): number {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Friendly label for a component breakdown row. The engine reports the raw
 * dispatch key ("pump", "valve", "fitting", "passive", "vessel", "pipe") —
 * we want the analysis table to read naturally, especially for the catch-all
 * "passive" bucket (typically heat exchangers in this codebase).
 */
function displayKind(kind: SinglePathResult["components"][number]["kind"]): string {
  switch (kind) {
    case "pump":
      return "Pump";
    case "valve":
      return "Valve";
    case "pipe":
      return "Pipe";
    case "fitting":
      return "Fitting";
    case "vessel":
      return "Vessel";
    case "passive":
      return "Equipment";
    default:
      return kind;
  }
}

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, HelpCircle, Info, Play } from "lucide-react";

import { useDiagramStore } from "@/store/diagramStore";
import { useProjectStore } from "@/store/projectStore";
import { toEngineGraph } from "@/engine/adapter";
import { NoPathError } from "@/engine/path";
import { solve } from "@/engine/solver";
import type { SinglePathResult } from "@/engine/types";
import { TextInput } from "@/components/Inspector/fields/TextInput";
import { Select } from "@/components/Inspector/fields/Select";
import { PresetDropdown } from "@/components/Inspector/PresetDropdown";
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

  const [startId, setStartId] = useState<string>("");
  const [endId, setEndId] = useState<string>("");
  const [fluidId, setFluidId] = useState<string>(fluids[0]?.id ?? "");
  const [mode, setMode] = useState<Mode>("forward");
  const [targetQM3h, setTargetQM3h] = useState<number>(50);
  const [result, setResult] = useState<SinglePathResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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

          {error && (
            <p className="rounded border border-red-800 bg-red-950/60 px-2 py-1.5 text-[11px] text-red-200">
              <AlertTriangle size={12} className="-mt-0.5 mr-1 inline" />
              {error}
            </p>
          )}
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        {result ? <ResultView result={result} mode={mode} /> : <EmptyState />}
      </main>
    </div>
  );
}

function ResultView({
  result,
  mode,
}: {
  result: SinglePathResult;
  mode: Mode;
}) {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
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
        <h3 className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Pump vs. system curve
          <HelpHint text="The pump curve shows how much head it produces at each flow. The system curve shows how much head the pipes need at each flow. Where they cross is the operating point." />
        </h3>
        <p className="mb-2 text-[11px] leading-relaxed text-zinc-500">
          The yellow dot marks the operating point — where the two curves meet.
        </p>
        <div className="h-64">
          <PumpSystemChart result={result} />
        </div>
      </section>

      <section className="border-b border-zinc-800 p-3">
        <h3 className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Where does the head go?
          <HelpHint text="Every pipe and fitting steals a little head from the pump. This table tells you exactly how much, and how fast the fluid is moving through each one." />
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

      <Glossary />
    </div>
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

function PumpSystemChart({ result }: { result: SinglePathResult }) {
  const data: { q: number; pump?: number; system?: number }[] = [];
  const map = new Map<number, { q: number; pump?: number; system?: number }>();
  for (const p of result.pumpCurveSampled) {
    const key = Number(p.q.toFixed(2));
    map.set(key, { ...(map.get(key) ?? { q: key }), pump: p.h });
  }
  for (const p of result.systemCurveSampled) {
    const key = Number(p.q.toFixed(2));
    map.set(key, { ...(map.get(key) ?? { q: key }), system: p.h });
  }
  for (const [, v] of [...map.entries()].sort((a, b) => a[0] - b[0])) {
    data.push(v);
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid stroke="#27272a" strokeDasharray="2 3" />
        <XAxis
          dataKey="q"
          type="number"
          domain={[0, "dataMax"]}
          stroke="#71717a"
          tick={{ fill: "#a1a1aa", fontSize: 11 }}
          label={{
            value: "Q (m³/h)",
            position: "insideBottom",
            offset: -2,
            fill: "#71717a",
            fontSize: 11,
          }}
        />
        <YAxis
          stroke="#71717a"
          tick={{ fill: "#a1a1aa", fontSize: 11 }}
          label={{
            value: "H (m)",
            angle: -90,
            position: "insideLeft",
            fill: "#71717a",
            fontSize: 11,
          }}
        />
        <Tooltip
          contentStyle={{
            background: "#18181b",
            border: "1px solid #3f3f46",
            color: "#e4e4e7",
            fontSize: 11,
          }}
          formatter={(v: number) => (typeof v === "number" ? v.toFixed(2) : v)}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line
          type="monotone"
          dataKey="pump"
          name="Pump"
          stroke="#7dd3fc"
          dot={false}
          strokeWidth={2}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="system"
          name="System"
          stroke="#fda4af"
          dot={false}
          strokeWidth={2}
          connectNulls
        />
        {result.qM3h > 0 && (
          <ReferenceDot
            x={result.qM3h}
            y={result.pumpHeadM}
            r={5}
            fill="#fde047"
            stroke="#000"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
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
            <tr
              key={i}
              className="border-t border-zinc-800 text-zinc-300 odd:bg-zinc-950 even:bg-[var(--color-panel)]"
            >
              <td className="px-2 py-1">{c.label}</td>
              <td className="px-2 py-1 capitalize">{c.kind}</td>
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
          ))}
        </tbody>
      </table>
    </div>
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

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-zinc-400">
      <Play size={28} className="text-zinc-700" />
      <div className="max-w-lg space-y-2">
        <p className="text-base text-zinc-200">
          Tell me where the flow starts and ends, what's flowing, then hit
          <span className="mx-1 inline-flex items-center gap-1 rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-300">
            <Play size={11} /> Solve
          </span>
          .
        </p>
        <p className="text-[12px] leading-relaxed text-zinc-500">
          I'll walk the path between the two components you pick, look up every
          pipe and fitting along the way, and work out how fast the fluid moves
          and where the pressure goes. You can compare a "what will it actually
          do" prediction against "what would it need to do my target flow".
        </p>
      </div>
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

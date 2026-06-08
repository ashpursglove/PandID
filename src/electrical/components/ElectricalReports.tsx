import { useMemo, useRef, useState } from "react";
import { Download, HelpCircle, ImagePlus } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import { useElectricalStore } from "@/electrical/store/electricalStore";
import type { ElecEdge, ElecNode } from "@/electrical/store/electricalStore";
import {
  buildCableSchedule,
  buildCableSummary,
  buildElectricalBom,
  buildLoadSchedule,
  type BoardSchedule,
} from "@/electrical/analysis/schedules";
import { saveCsv, toCsv } from "@/electrical/io/csv";
import { useDrawingsStore, newPageId } from "@/store/drawingsStore";
import { elecSchedulePageCount } from "@/io/drawingsRender";

/* ------------------------------ shared bits ----------------------------- */

function Page({
  title,
  subtitle,
  onExport,
  sendButton,
  children,
}: {
  title: string;
  subtitle?: string;
  onExport?: () => void;
  sendButton?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col bg-[var(--color-canvas)]">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-5 py-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
          {subtitle && <p className="text-[11px] text-zinc-500">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {sendButton}
          {onExport && (
            <button
              type="button"
              onClick={onExport}
              className="flex items-center gap-1.5 rounded border border-zinc-700 bg-[var(--color-panel-2)] px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:border-sky-500 hover:text-sky-200"
            >
              <Download size={13} strokeWidth={1.75} /> Export CSV
            </button>
          )}
        </div>
      </header>
      <div className="flex-1 overflow-auto p-5">{children}</div>
    </div>
  );
}

/** Freezes the current SLD into a schedule/BOM drawing sheet in the Drawings tab. */
function SendToDrawingsButton({
  kind,
  title,
  nodes,
  edges,
}: {
  kind: "loads" | "cables" | "bom";
  title: string;
  nodes: ElecNode[];
  edges: ElecEdge[];
}) {
  const addPage = useDrawingsStore((s) => s.addPage);
  const pages = useDrawingsStore((s) => s.pages);
  const [confirming, setConfirming] = useState(false);

  function onClick() {
    const idx =
      pages.filter(
        (p) => p.type === "elec-schedule" && p.elecSchedule?.kind === kind,
      ).length + 1;
    const frozenNodes = structuredClone(nodes);
    const frozenEdges = structuredClone(edges);
    // Split the table across as many sheets as the data needs.
    const totalPages = elecSchedulePageCount({
      kind,
      nodes: frozenNodes,
      edges: frozenEdges,
    });
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      const suffix =
        totalPages > 1 ? ` — sheet ${pageIndex + 1}/${totalPages}` : "";
      const base = idx > 1 ? `${title} (${idx})` : title;
      addPage({
        id: newPageId(),
        title: `${base}${suffix}`,
        type: "elec-schedule",
        titleBlock: {},
        elecSchedule: {
          kind,
          nodes: frozenNodes,
          edges: frozenEdges,
          pageIndex,
          totalPages,
        },
        annotations: [],
      });
    }
    setConfirming(true);
    window.setTimeout(() => setConfirming(false), 1400);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title="Add this schedule as a sheet in the Drawings tab"
      className="flex items-center gap-1.5 rounded border border-zinc-700 bg-[var(--color-panel-2)] px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 transition hover:border-sky-500 hover:text-sky-200"
    >
      <ImagePlus size={13} strokeWidth={1.75} />
      {confirming ? "Sent ✓" : "Send to Drawings"}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="max-w-md text-center text-sm text-zinc-500">{message}</p>
    </div>
  );
}

const TH =
  "border-b border-zinc-700 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-400";
const TD = "border-b border-zinc-800 px-2 py-1.5 text-xs text-zinc-200";
const TDR = `${TD} text-right tabular-nums`;

/**
 * A table header cell with a hover tooltip explaining what the column means.
 * The tooltip is rendered with fixed positioning so it never gets clipped by
 * the table's scroll/overflow container.
 */
function HeaderCell({
  label,
  help,
  align = "left",
}: {
  label: string;
  help: string;
  align?: "left" | "right";
}) {
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  function show() {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTip({ x: r.left, y: r.bottom + 4 });
  }

  return (
    <th className={`${TH} ${align === "right" ? "text-right" : ""}`}>
      <span
        ref={ref}
        onMouseEnter={show}
        onMouseLeave={() => setTip(null)}
        className={`inline-flex cursor-help items-center gap-1 border-b border-dotted border-zinc-600/70 ${
          align === "right" ? "flex-row-reverse" : ""
        }`}
      >
        {label}
        <HelpCircle size={11} className="shrink-0 text-zinc-500" />
      </span>
      {tip && (
        <span
          role="tooltip"
          className="pointer-events-none fixed z-50 w-60 whitespace-normal break-words rounded-md border border-zinc-700 bg-zinc-900/95 p-2 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-zinc-200 shadow-xl backdrop-blur"
          style={{
            left: Math.min(tip.x, window.innerWidth - 252),
            top: tip.y,
          }}
        >
          {help}
        </span>
      )}
    </th>
  );
}

function n0(v: number) {
  return Number.isFinite(v) ? Math.round(v).toString() : "—";
}
function n1(v: number) {
  return Number.isFinite(v) ? v.toFixed(1) : "—";
}
function n2(v: number) {
  return Number.isFinite(v) ? v.toFixed(2) : "—";
}

/* --------------------------- schedule of loads -------------------------- */

export function LoadScheduleReport() {
  const { nodes, edges } = useElectricalStore(
    useShallow((s) => ({ nodes: s.nodes, edges: s.edges })),
  );
  const schedule = useMemo(() => buildLoadSchedule(nodes, edges), [nodes, edges]);
  const allBoards = schedule.unassigned
    ? [...schedule.boards, schedule.unassigned]
    : schedule.boards;

  const hasContent = allBoards.some((b) => b.rows.length > 0);

  function onExport() {
    const headers = [
      "Board",
      "Load tag",
      "Description",
      "Phases",
      "Voltage (V)",
      "Connected (kW)",
      "Demand factor",
      "Demand (kW)",
      "PF",
      "Demand (kVA)",
      "FLC (A)",
    ];
    const rows: (string | number)[][] = [];
    for (const b of allBoards) {
      for (const r of b.rows) {
        rows.push([
          b.boardTag,
          r.tag,
          r.description,
          r.phases,
          r.voltageV,
          r.connectedKW.toFixed(2),
          r.demandFactor,
          r.demandKW.toFixed(2),
          r.powerFactor,
          r.demandKVA.toFixed(2),
          r.fullLoadCurrentA.toFixed(1),
        ]);
      }
    }
    void saveCsv(toCsv(headers, rows), "schedule-of-loads.csv");
  }

  if (!hasContent) {
    return (
      <Page title="Schedule of loads">
        <EmptyState message="No loads found. Add distribution boards / MCCs and connect motors, lighting, or other loads downstream of them on the single-line diagram." />
      </Page>
    );
  }

  return (
    <Page
      title="Schedule of loads"
      subtitle={`Total connected ${n1(schedule.grand.connectedKW)} kW · maximum demand ${n1(
        schedule.grand.demandKW,
      )} kW (${n1(schedule.grand.demandKVA)} kVA)`}
      onExport={onExport}
      sendButton={
        <SendToDrawingsButton
          kind="loads"
          title="Schedule of loads"
          nodes={nodes}
          edges={edges}
        />
      }
    >
      <div className="flex flex-col gap-6">
        {allBoards.map((b) => (
          <BoardTable key={b.boardId} board={b} />
        ))}
      </div>
    </Page>
  );
}

function BoardTable({ board }: { board: BoardSchedule }) {
  if (board.rows.length === 0) return null;
  const level = board.level ?? 0;
  return (
    <div
      className="overflow-hidden rounded-lg border border-zinc-800"
      style={level > 0 ? { marginLeft: level * 20 } : undefined}
    >
      <div className="flex items-baseline justify-between bg-[var(--color-panel)] px-3 py-2">
        <h3 className="text-xs font-semibold text-zinc-100">
          {level > 0 && (
            <span className="mr-1.5 rounded bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-sky-200">
              Sub-board · L{level}
            </span>
          )}
          {board.boardTag}
          <span className="ml-2 font-normal text-zinc-500">
            {board.boardDescription} · {board.voltageV} V
          </span>
        </h3>
        <span className="text-[11px] text-zinc-400">
          {n1(board.totalDemandKW)} kW · {n1(board.totalDemandKVA)} kVA ·{" "}
          {n1(board.totalCurrentA)} A
        </span>
      </div>
      <table className="w-full border-collapse">
        <thead className="bg-[var(--color-panel-2)]">
          <tr>
            <HeaderCell
              label="Tag"
              help="Unique identifier for this load on the single-line diagram."
            />
            <HeaderCell
              label="Description"
              help="Plain-language name and type of the connected load."
            />
            <HeaderCell
              label="Phases (Ph)"
              help="Number of supply phases — 1 for single-phase, 3 for three-phase."
            />
            <HeaderCell
              align="right"
              label="Voltage (V)"
              help="Nominal supply voltage at the load (line-to-line for three-phase)."
            />
            <HeaderCell
              align="right"
              label="Connected (kW)"
              help="Installed/rated real power of the load before any diversity is applied."
            />
            <HeaderCell
              align="right"
              label="Demand factor (DF)"
              help="Fraction of the connected load expected to run at the same time (0–1)."
            />
            <HeaderCell
              align="right"
              label="Demand (kW)"
              help="Maximum real-power demand = connected kW × demand factor."
            />
            <HeaderCell
              align="right"
              label="Power factor (PF)"
              help="Ratio of real to apparent power. A lower PF draws more current for the same kW."
            />
            <HeaderCell
              align="right"
              label="Apparent demand (kVA)"
              help="Demand kW ÷ power factor — the apparent power the supply must actually deliver."
            />
            <HeaderCell
              align="right"
              label="Full-load current (FLC, A)"
              help="Steady-state current the load draws at full demand. Sizes the feeder and protection."
            />
          </tr>
        </thead>
        <tbody>
          {board.rows.map((r, i) => (
            <tr
              key={`${r.tag}-${i}`}
              className={
                r.isSubBoard
                  ? "bg-sky-500/10 text-sky-100"
                  : "even:bg-zinc-900/40"
              }
            >
              <td className={TD}>
                {r.isSubBoard ? `› ${r.tag}` : r.tag}
              </td>
              <td className={TD}>{r.description}</td>
              <td className={TD}>{r.phases}</td>
              <td className={TDR}>{r.voltageV}</td>
              <td className={TDR}>{n2(r.connectedKW)}</td>
              <td className={TDR}>{n2(r.demandFactor)}</td>
              <td className={TDR}>{n2(r.demandKW)}</td>
              <td className={TDR}>{n2(r.powerFactor)}</td>
              <td className={TDR}>{n2(r.demandKVA)}</td>
              <td className={TDR}>{n1(r.fullLoadCurrentA)}</td>
            </tr>
          ))}
          <tr className="bg-[var(--color-panel)] font-semibold">
            <td className={TD} colSpan={4}>
              {board.rows.some((r) => r.isSubBoard)
                ? "Board total (incl. sub-boards)"
                : "Board total"}
            </td>
            <td className={TDR}>{n2(board.totalConnectedKW)}</td>
            <td className={TDR}></td>
            <td className={TDR}>{n2(board.totalDemandKW)}</td>
            <td className={TDR}></td>
            <td className={TDR}>{n2(board.totalDemandKVA)}</td>
            <td className={TDR}>{n1(board.totalCurrentA)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------- cable schedule ---------------------------- */

export function CableScheduleReport() {
  const { nodes, edges } = useElectricalStore(
    useShallow((s) => ({ nodes: s.nodes, edges: s.edges })),
  );
  const rows = useMemo(() => buildCableSchedule(nodes, edges), [nodes, edges]);

  function onExport() {
    const headers = [
      "Cable tag",
      "From",
      "To",
      "Type",
      "Size",
      "Cores",
      "CSA (mm²)",
      "Material",
      "Insulation",
      "Length (m)",
      "Parallel runs",
      "Phases",
      "Nominal V",
      "Design current Ib (A)",
      "Ampacity Iz (A)",
      "Utilisation (%)",
      "Operating temp (°C)",
      "Max temp (°C)",
      "Resistance (Ω)",
      "Reactance (Ω)",
      "Volt drop (V)",
      "Volt drop (%)",
    ];
    const dash = "—";
    const noLen = "no length given";
    void saveCsv(
      toCsv(
        headers,
        rows.map((r) => [
          r.tag,
          r.from,
          r.to,
          r.connectionType,
          r.sizeDescription,
          r.cores,
          r.csaMm2,
          r.material,
          r.insulation,
          r.lengthM || noLen,
          r.parallelRuns,
          r.phases,
          r.nominalV,
          r.hasLoad ? r.designCurrentA.toFixed(1) : "no load",
          r.ampacityA.toFixed(1),
          r.hasLoad ? r.utilizationPct.toFixed(0) : "no load",
          r.hasLoad ? r.operatingTempC.toFixed(0) : dash,
          r.maxTempC,
          r.resistanceOhm != null ? r.resistanceOhm.toFixed(4) : noLen,
          r.reactanceOhm != null ? r.reactanceOhm.toFixed(4) : noLen,
          r.voltageDropV != null ? (r.hasLoad ? r.voltageDropV.toFixed(2) : "0") : noLen,
          r.voltageDropPct != null ? (r.hasLoad ? r.voltageDropPct.toFixed(2) : "0") : noLen,
        ]),
      ),
      "cable-schedule.csv",
    );
  }

  if (rows.length === 0) {
    return (
      <Page title="Cable schedule">
        <EmptyState message="No power feeders found. Draw LV or MV power connections between components on the single-line diagram to populate the cable schedule." />
      </Page>
    );
  }

  const totalLength = rows.reduce((a, r) => a + r.lengthM, 0);
  const overloaded = rows.filter((r) => r.hasLoad && r.utilizationPct > 100).length;
  const worstVd = rows.reduce(
    (m, r) => (r.voltageDropPct != null ? Math.max(m, r.voltageDropPct) : m),
    0,
  );
  const subtitleBits = [
    `${rows.length} feeders`,
    `${n1(totalLength)} m total routed length`,
  ];
  if (worstVd > 0) subtitleBits.push(`worst volt drop ${n1(worstVd)}%`);
  if (overloaded > 0) subtitleBits.push(`${overloaded} overloaded`);

  return (
    <Page
      title="Cable schedule & analysis"
      subtitle={subtitleBits.join(" · ")}
      onExport={onExport}
      sendButton={
        <SendToDrawingsButton
          kind="cables"
          title="Cable schedule"
          nodes={nodes}
          edges={edges}
        />
      }
    >
      <div className="overflow-auto rounded-lg border border-zinc-800">
        <table className="w-full border-collapse whitespace-nowrap">
          <thead className="bg-[var(--color-panel-2)]">
            <tr>
              <HeaderCell
                label="Cable tag"
                help="Unique identifier for this feeder / cable."
              />
              <HeaderCell
                label="From"
                help="Component the cable runs from (the supply / source end)."
              />
              <HeaderCell
                label="To"
                help="Component the cable runs to (the load end)."
              />
              <HeaderCell
                label="Type"
                help="LV = low-voltage or MV = medium-voltage power feeder."
              />
              <HeaderCell
                label="Cable size / specification"
                help="Cores × cross-sectional area, conductor material (Cu = copper / Al = aluminium) and insulation (PVC / XLPE)."
              />
              <HeaderCell
                align="right"
                label="Length (m)"
                help="Routed cable run length. Needed for volt-drop; shows 'no length given' if left at the default 0."
              />
              <HeaderCell
                align="right"
                label="Design current (Ib, A)"
                help="The load current the cable actually carries, derived from the downstream demand on the SLD."
              />
              <HeaderCell
                align="right"
                label="Ampacity (Iz, A)"
                help="Continuous current the cable can carry without overheating, after material / insulation derating."
              />
              <HeaderCell
                align="right"
                label="Utilisation (%)"
                help="Ib ÷ Iz. Over 100% means the cable is overloaded for its rating (shown in red)."
              />
              <HeaderCell
                align="right"
                label="Op. temp (°C)"
                help="Estimated steady-state conductor temperature at the design current, shown against the insulation's maximum."
              />
              <HeaderCell
                align="right"
                label="Volt drop (V)"
                help="Voltage lost along the cable at the design current. Needs a cable length to compute."
              />
              <HeaderCell
                align="right"
                label="Volt drop (%)"
                help="Volt drop as a percentage of nominal voltage. Over 5% is flagged amber."
              />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const over = r.hasLoad && r.utilizationPct > 100;
              const vdHigh = r.voltageDropPct != null && r.voltageDropPct > 5;
              return (
                <tr key={r.tag} className="even:bg-zinc-900/40">
                  <td className={TD}>{r.tag}</td>
                  <td className={TD}>{r.from}</td>
                  <td className={TD}>{r.to}</td>
                  <td className={TD}>{r.connectionType}</td>
                  <td className={TD}>{r.sizeDescription}</td>
                  <td className={TDR}>
                    {r.hasLength ? n1(r.lengthM) : (
                      <span className="text-zinc-500">no length given</span>
                    )}
                  </td>
                  <td className={TDR}>
                    {r.hasLoad ? n1(r.designCurrentA) : (
                      <span className="text-zinc-500">no load</span>
                    )}
                  </td>
                  <td className={TDR}>{n1(r.ampacityA)}</td>
                  <td className={`${TDR} ${over ? "text-red-400 font-semibold" : ""}`}>
                    {r.hasLoad ? `${n0(r.utilizationPct)}%` : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </td>
                  <td className={`${TDR} ${over ? "text-red-400 font-semibold" : ""}`}>
                    {r.hasLoad ? `${n0(r.operatingTempC)} / ${r.maxTempC}` : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </td>
                  <td className={TDR}>
                    {!r.hasLength ? (
                      <span className="text-zinc-500">no length given</span>
                    ) : r.hasLoad ? (
                      n2(r.voltageDropV ?? 0)
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </td>
                  <td className={`${TDR} ${vdHigh ? "text-amber-400 font-semibold" : ""}`}>
                    {!r.hasLength ? (
                      <span className="text-zinc-500">no length given</span>
                    ) : r.hasLoad ? (
                      `${n2(r.voltageDropPct ?? 0)}%`
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[11px] leading-snug text-zinc-500">
        Ampacity, volt drop and operating temperature are approximate IEC-style
        estimates (single-circuit, 30 °C ambient, ~0.08 mΩ/m reactance). Volt
        drop uses the cable length and the load-side power factor; operating
        temperature rises with the square of the loading. They flag problems —
        they aren't a substitute for a full cable-sizing calc with grouping and
        installation-method derating.
      </p>
    </Page>
  );
}

/* -------------------------------- BOM ----------------------------------- */

export function ElectricalBomReport() {
  const { nodes, edges } = useElectricalStore(
    useShallow((s) => ({ nodes: s.nodes, edges: s.edges })),
  );
  const rows = useMemo(() => buildElectricalBom(nodes), [nodes]);
  const cableSummary = useMemo(
    () => buildCableSummary(nodes, edges),
    [nodes, edges],
  );

  function onExport() {
    const headers = ["Item", "Description", "Rating", "Qty", "Tags"];
    const out: (string | number)[][] = rows.map((r) => [
      r.itemNo,
      r.description,
      r.rating,
      r.quantity,
      r.tags,
    ]);
    if (cableSummary.length > 0) {
      out.push(["", "", "", "", ""]);
      out.push(["", "CABLE SUMMARY (total length by type)", "", "", ""]);
      for (const c of cableSummary) {
        out.push([
          "",
          c.specification,
          c.hasLength ? `${c.totalLengthM.toFixed(1)} m total` : "no length given",
          c.runs,
          "",
        ]);
      }
    }
    void saveCsv(toCsv(headers, out), "electrical-bom.csv");
  }

  if (rows.length === 0) {
    return (
      <Page title="Bill of materials">
        <EmptyState message="No components yet. Drop equipment onto the single-line diagram to build the electrical BOM." />
      </Page>
    );
  }

  const totalItems = rows.reduce((a, r) => a + r.quantity, 0);
  const totalCableLength = cableSummary.reduce((a, c) => a + c.totalLengthM, 0);

  return (
    <Page
      title="Bill of materials"
      subtitle={`${rows.length} line items · ${totalItems} components${
        cableSummary.length > 0
          ? ` · ${cableSummary.length} cable types · ${n1(totalCableLength)} m cable total`
          : ""
      }`}
      onExport={onExport}
      sendButton={
        <SendToDrawingsButton
          kind="bom"
          title="Electrical BOM"
          nodes={nodes}
          edges={edges}
        />
      }
    >
      <div className="flex flex-col gap-6">
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full border-collapse">
            <thead className="bg-[var(--color-panel-2)]">
              <tr>
                <th className={`${TH} text-right`}>Item (#)</th>
                <th className={TH}>Description</th>
                <th className={TH}>Rating</th>
                <th className={`${TH} text-right`}>Quantity (Qty)</th>
                <th className={TH}>Tags</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.itemNo} className="even:bg-zinc-900/40">
                  <td className={TDR}>{r.itemNo}</td>
                  <td className={TD}>{r.description}</td>
                  <td className={TD}>{r.rating || "—"}</td>
                  <td className={TDR}>{r.quantity}</td>
                  <td className={`${TD} text-zinc-400`}>{r.tags || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {cableSummary.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-zinc-800">
            <div className="flex items-baseline justify-between bg-[var(--color-panel)] px-3 py-2">
              <h3 className="text-xs font-semibold text-zinc-100">
                Cable summary
                <span className="ml-2 font-normal text-zinc-500">
                  total length needed by cable type
                </span>
              </h3>
              <span className="text-[11px] text-zinc-400">
                {n1(totalCableLength)} m across {cableSummary.length} types
              </span>
            </div>
            <table className="w-full border-collapse">
              <thead className="bg-[var(--color-panel-2)]">
                <tr>
                  <HeaderCell
                    label="Cable type / specification"
                    help="Cores × cross-sectional area, conductor material (Cu / Al) and insulation (PVC / XLPE). Parallel runs are counted individually."
                  />
                  <HeaderCell
                    align="right"
                    label="Runs"
                    help="Total number of physical cable runs of this type across the whole SLD (sums parallel runs)."
                  />
                  <HeaderCell
                    align="right"
                    label="Total length (m)"
                    help="Sum of every run's routed length for this cable type — the quantity to order. Excludes feeders left with no length."
                  />
                </tr>
              </thead>
              <tbody>
                {cableSummary.map((c) => (
                  <tr key={c.specification} className="even:bg-zinc-900/40">
                    <td className={TD}>{c.specification}</td>
                    <td className={TDR}>{c.runs}</td>
                    <td className={TDR}>
                      {c.hasLength ? n1(c.totalLengthM) : (
                        <span className="text-zinc-500">no length given</span>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[var(--color-panel)] font-semibold">
                  <td className={TD}>Total</td>
                  <td className={TDR}>
                    {cableSummary.reduce((a, c) => a + c.runs, 0)}
                  </td>
                  <td className={TDR}>{n1(totalCableLength)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Page>
  );
}

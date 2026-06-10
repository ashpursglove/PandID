/**
 * Electrical schedule + BOM derivations from the SLD graph.
 *
 * Pure functions over the electrical nodes/edges — no React, no store access —
 * so they can feed on-screen tables, CSV export, and (later) drawing pages.
 *
 * Conventions: IEC / metric. Three-phase full-load current uses
 *   I = S / (√3 · V)   with S in VA, V the line voltage.
 * Single-phase uses I = S / V.
 */

import type { ElecEdge, ElecNode } from "@/electrical/store/electricalStore";
import { includeInReports } from "@/io/reporting";
import { getElecSymbol } from "@/electrical/symbols/registry";
import type { ElecEngineModel } from "@/electrical/types";
import { analyseCable } from "./cableAnalysis";
import { edgeCurrents } from "./validate";
import { getCablePreset } from "@/electrical/symbols/cablePresets";

const SQRT3 = Math.sqrt(3);

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function param(node: ElecNode, key: string): unknown {
  return (node.data.params as Record<string, unknown> | undefined)?.[key];
}

function engineModel(node: ElecNode): ElecEngineModel | undefined {
  return getElecSymbol(node.data.symbolType)?.engineModel;
}

function nodeLabel(node: ElecNode): string {
  const sym = getElecSymbol(node.data.symbolType);
  return (
    (node.data.tag as string) ||
    (node.data.label as string) ||
    sym?.defaultLabel ||
    sym?.label ||
    node.data.symbolType
  );
}

function isLoad(node: ElecNode): boolean {
  const m = engineModel(node);
  return m === "load" || m === "motor";
}

/** Spare (reserved) breaker — its rated current stands in as a future load. */
function isSpare(node: ElecNode): boolean {
  return param(node, "spare") === true;
}

/** Single ("1") vs three ("3") phase from a protective device's pole count. */
function phasesFromPoles(poles: unknown): "1" | "3" {
  return /[34]/.test(String(poles ?? "3")) ? "3" : "1";
}

/* ----------------------------- load schedule ---------------------------- */

export interface LoadRow {
  tag: string;
  description: string;
  phases: string;
  voltageV: number;
  connectedKW: number;
  demandFactor: number;
  demandKW: number;
  powerFactor: number;
  demandKVA: number;
  fullLoadCurrentA: number;
  /** True when this row stands in for a downstream sub-board, summarised as a
   *  single cumulative "load" on its parent board's schedule. */
  isSubBoard?: boolean;
  /** Id of the sub-board this row summarises (for cross-referencing its own
   *  detailed table further down the schedule). */
  subBoardId?: string;
}

export interface BoardSchedule {
  boardId: string;
  boardTag: string;
  boardDescription: string;
  voltageV: number;
  rows: LoadRow[];
  totalConnectedKW: number;
  totalDemandKW: number;
  totalDemandKVA: number;
  totalCurrentA: number;
  /** Depth in the distribution hierarchy: 0 = root board (fed straight from a
   *  source), 1 = sub-board of a root, etc. Used to indent the schedule. */
  level: number;
  /** Parent board id, or null for a root board. */
  parentBoardId: string | null;
}

export interface LoadScheduleResult {
  boards: BoardSchedule[];
  /** Loads not reachable from any board (wired straight to a source, or
   *  orphaned). Grouped under a synthetic "Unassigned" board. */
  unassigned: BoardSchedule | null;
  grand: {
    connectedKW: number;
    demandKW: number;
    demandKVA: number;
  };
}

function loadRow(node: ElecNode, boardVoltage: number): LoadRow {
  // Spare ways carry no kW rating — their reserved current is the rated current,
  // converted to an equivalent kVA/kW at the board voltage and assumed PF.
  if (isSpare(node)) {
    const phases = phasesFromPoles(param(node, "poles"));
    const v = num(param(node, "voltageV"), boardVoltage || 380) || 380;
    const ratedA = num(param(node, "ratedCurrentA"));
    const pf = num(param(node, "powerFactor"), 0.8) || 0.8;
    const demandKVA =
      phases === "1" ? (v * ratedA) / 1000 : (SQRT3 * v * ratedA) / 1000;
    const demandKW = demandKVA * pf;
    return {
      tag: nodeLabel(node),
      description: `${getElecSymbol(node.data.symbolType)?.label ?? "Spare"} (reserved)`,
      phases,
      voltageV: v,
      connectedKW: demandKW,
      demandFactor: 1,
      demandKW,
      powerFactor: pf,
      demandKVA,
      fullLoadCurrentA: ratedA,
    };
  }

  const phases = String(param(node, "phases") ?? "3");
  const voltageV = num(param(node, "voltageV"), boardVoltage || 380);
  const connectedKW = num(param(node, "ratedKW"));
  const demandFactor = num(param(node, "demandFactor"), 1);
  const pf = num(param(node, "powerFactor"), 0.85) || 0.85;
  const eff = num(param(node, "efficiencyPct"), 100) / 100 || 1;

  const demandKW = connectedKW * demandFactor;
  // Motors draw input power = shaft / efficiency.
  const inputKW = engineModel(node) === "motor" ? demandKW / eff : demandKW;
  const demandKVA = pf > 0 ? inputKW / pf : inputKW;
  const v = voltageV || 380;
  const fullLoadCurrentA =
    phases === "1" ? (demandKVA * 1000) / v : (demandKVA * 1000) / (SQRT3 * v);

  return {
    tag: nodeLabel(node),
    description: getElecSymbol(node.data.symbolType)?.label ?? node.data.symbolType,
    phases,
    voltageV: v,
    connectedKW,
    demandFactor,
    demandKW,
    powerFactor: pf,
    demandKVA,
    fullLoadCurrentA,
  };
}

function boardVoltage(board: ElecNode): number {
  return num(param(board, "voltageV"), 380) || 380;
}

interface BoardTotals {
  connectedKW: number;
  demandKW: number;
  demandKVA: number;
}

/** Summarise a downstream sub-board as a single cumulative row on its parent. */
function subBoardRow(
  board: ElecNode,
  cumulative: BoardTotals,
  voltageV: number,
): LoadRow {
  const v = voltageV || 380;
  // Three-phase assumption for board-to-board feeders; a board fed single-phase
  // is unusual and the kVA→current conversion below stays conservative either way.
  const demandFactor =
    cumulative.connectedKW > 0 ? cumulative.demandKW / cumulative.connectedKW : 1;
  const powerFactor =
    cumulative.demandKVA > 0 ? cumulative.demandKW / cumulative.demandKVA : 0.9;
  const fullLoadCurrentA = (cumulative.demandKVA * 1000) / (SQRT3 * v);
  return {
    tag: nodeLabel(board),
    description: `${getElecSymbol(board.data.symbolType)?.label ?? "Sub-board"} (sub-total)`,
    phases: "3",
    voltageV: v,
    connectedKW: cumulative.connectedKW,
    demandFactor,
    demandKW: cumulative.demandKW,
    powerFactor,
    demandKVA: cumulative.demandKVA,
    fullLoadCurrentA,
    isSubBoard: true,
    subBoardId: board.id,
  };
}

export function buildLoadSchedule(
  nodes: ElecNode[],
  edges: ElecEdge[],
): LoadScheduleResult {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Undirected adjacency.
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if (adj.has(e.source) && adj.has(e.target)) {
      adj.get(e.source)!.push(e.target);
      adj.get(e.target)!.push(e.source);
    }
  }

  const allBoards = nodes.filter(
    (n) => engineModel(n) === "board" || engineModel(n) === "busbar",
  );
  // A board switched out of "Include in BOM & schedules" is treated as
  // *transparent*: it gets no section of its own and its loads roll up to the
  // nearest reported board upstream (just like a pass-through device). Only
  // reported boards are scheduled and form the hierarchy.
  const boards = allBoards.filter((b) => includeInReports(b.data));
  const reportedBoardIds = new Set(boards.map((b) => b.id));
  // Supply origins seed the hierarchy orientation. A transformer counts as an
  // origin too, so a system fed straight from a transformer (with no separate
  // utility-incomer / generator "source" node) still orients correctly — the
  // board nearest the supply becomes the top of the tree.
  const supplyOrigins = nodes.filter(
    (n) => engineModel(n) === "source" || engineModel(n) === "transformer",
  );

  // Distance of every node from the nearest supply origin, used to pick the
  // root of each board hierarchy (parent = adjacent board closer to a supply).
  const supplyDist = new Map<string, number>();
  {
    const queue: Array<[string, number]> = [];
    for (const s of supplyOrigins) {
      supplyDist.set(s.id, 0);
      queue.push([s.id, 0]);
    }
    while (queue.length > 0) {
      const [id, d] = queue.shift()!;
      for (const next of adj.get(id) ?? []) {
        if (!supplyDist.has(next)) {
          supplyDist.set(next, d + 1);
          queue.push([next, d + 1]);
        }
      }
    }
  }

  // For each board: collect its directly-attributed loads (nearest upstream
  // board wins) and the set of *adjacent* boards reachable through nothing but
  // pass-through devices (breakers, drives, meters…).
  const directLoads = new Map<string, ElecNode[]>();
  const adjacentBoards = new Map<string, Set<string>>();
  const assigned = new Set<string>();

  for (const board of boards) {
    const loads: ElecNode[] = [];
    const neighbours = new Set<string>();
    const seen = new Set<string>([board.id]);
    const queue = [...(adj.get(board.id) ?? [])];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const node = byId.get(id);
      if (!node) continue;
      if (isLoad(node) || isSpare(node)) {
        if (includeInReports(node.data)) {
          loads.push(node);
          assigned.add(node.id);
        }
        continue; // loads (and spare ways) are leaves
      }
      const m = engineModel(node);
      if ((m === "board" || m === "busbar") && reportedBoardIds.has(id)) {
        neighbours.add(id); // adjacent reported board — record but don't cross
        continue;
      }
      if (m === "source") continue; // don't cross back through the source
      // Excluded boards fall through to the pass-through walk below so their
      // loads roll up to the nearest reported board.
      // pass-through device: keep walking downstream
      for (const next of adj.get(id) ?? []) {
        if (!seen.has(next)) queue.push(next);
      }
    }
    directLoads.set(board.id, loads);
    adjacentBoards.set(board.id, neighbours);
  }

  // Orient the boards into a parent/child forest by walking a spanning tree of
  // the board-adjacency graph. The root of each connected group is the board
  // nearest a supply (lowest supplyDist); ties fall back to the busiest board
  // then its label. This works even with no source/transformer at all (every
  // board still lands in the tree), so a board that only distributes to
  // sub-boards is never dropped from the schedule.
  const supplyRank = (id: string) => supplyDist.get(id) ?? Infinity;
  const boardNeighbourCount = (id: string) => adjacentBoards.get(id)?.size ?? 0;
  const directLoadCount = (id: string) => directLoads.get(id)?.length ?? 0;
  // Root preference: nearest a supply first; with no supply node at all, the
  // busiest distribution hub (most adjacent boards) anchors the tree.
  const boardOrder = (a: string, b: string) =>
    supplyRank(a) - supplyRank(b) ||
    boardNeighbourCount(b) - boardNeighbourCount(a) ||
    directLoadCount(b) - directLoadCount(a) ||
    nodeLabel(byId.get(a)!).localeCompare(nodeLabel(byId.get(b)!));

  const parentOf = new Map<string, string | null>();
  const childrenOf = new Map<string, string[]>();
  for (const b of boards) childrenOf.set(b.id, []);

  const placed = new Set<string>();
  // Seed roots in supply order so the most-upstream board anchors each group.
  const seeds = [...boards].sort((a, b) => boardOrder(a.id, b.id));
  for (const seed of seeds) {
    if (placed.has(seed.id)) continue;
    placed.add(seed.id);
    parentOf.set(seed.id, null);
    const queue: string[] = [seed.id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const neighbours = [...(adjacentBoards.get(cur) ?? [])].sort(boardOrder);
      for (const nb of neighbours) {
        if (placed.has(nb)) continue;
        placed.add(nb);
        parentOf.set(nb, cur);
        childrenOf.get(cur)!.push(nb);
        queue.push(nb);
      }
    }
  }

  // Cumulative totals for a board = its own direct loads + every descendant
  // board's cumulative totals. Memoised, with a cycle guard for ring feeds.
  const cumCache = new Map<string, BoardTotals>();
  function cumulative(boardId: string, stack: Set<string>): BoardTotals {
    const cached = cumCache.get(boardId);
    if (cached) return cached;
    if (stack.has(boardId)) return { connectedKW: 0, demandKW: 0, demandKVA: 0 };
    stack.add(boardId);
    const board = byId.get(boardId);
    const v = board ? boardVoltage(board) : 380;
    let connectedKW = 0;
    let demandKW = 0;
    let demandKVA = 0;
    for (const ln of directLoads.get(boardId) ?? []) {
      const r = loadRow(ln, v);
      connectedKW += r.connectedKW;
      demandKW += r.demandKW;
      demandKVA += r.demandKVA;
    }
    for (const childId of childrenOf.get(boardId) ?? []) {
      const c = cumulative(childId, stack);
      connectedKW += c.connectedKW;
      demandKW += c.demandKW;
      demandKVA += c.demandKVA;
    }
    stack.delete(boardId);
    const totals = { connectedKW, demandKW, demandKVA };
    cumCache.set(boardId, totals);
    return totals;
  }

  function buildBoardSchedule(board: ElecNode, level: number): BoardSchedule {
    const v = boardVoltage(board);
    const rows = (directLoads.get(board.id) ?? []).map((n) => loadRow(n, v));
    // Append each child sub-board as a cumulative "load" row.
    const children = [...(childrenOf.get(board.id) ?? [])].sort((a, b) =>
      nodeLabel(byId.get(a)!).localeCompare(nodeLabel(byId.get(b)!)),
    );
    for (const childId of children) {
      const child = byId.get(childId);
      if (!child) continue;
      rows.push(subBoardRow(child, cumulative(childId, new Set()), boardVoltage(child)));
    }
    const totalConnectedKW = rows.reduce((a, r) => a + r.connectedKW, 0);
    const totalDemandKW = rows.reduce((a, r) => a + r.demandKW, 0);
    const totalDemandKVA = rows.reduce((a, r) => a + r.demandKVA, 0);
    const totalCurrentA = (totalDemandKVA * 1000) / (SQRT3 * v);
    return {
      boardId: board.id,
      boardTag: nodeLabel(board),
      boardDescription: getElecSymbol(board.data.symbolType)?.label ?? "Board",
      voltageV: v,
      rows,
      totalConnectedKW,
      totalDemandKW,
      totalDemandKVA,
      totalCurrentA,
      level,
      parentBoardId: parentOf.get(board.id) ?? null,
    };
  }

  // Emit boards in hierarchical pre-order: each root followed by its descendants.
  const boardSchedules: BoardSchedule[] = [];
  const emitted = new Set<string>();
  function visit(boardId: string, level: number) {
    if (emitted.has(boardId)) return;
    emitted.add(boardId);
    const board = byId.get(boardId);
    if (!board) return;
    boardSchedules.push(buildBoardSchedule(board, level));
    const children = [...(childrenOf.get(boardId) ?? [])].sort((a, b) =>
      nodeLabel(byId.get(a)!).localeCompare(nodeLabel(byId.get(b)!)),
    );
    for (const childId of children) visit(childId, level + 1);
  }
  const roots = boards
    .filter((b) => !parentOf.get(b.id))
    .sort((a, b) => boardOrder(a.id, b.id));
  for (const r of roots) visit(r.id, 0);
  // Catch any board left out by an unusual topology (e.g. a ring with no clear root).
  for (const b of boards) if (!emitted.has(b.id)) visit(b.id, 0);

  const unassignedLoads = nodes.filter(
    (n) =>
      (isLoad(n) || isSpare(n)) &&
      includeInReports(n.data) &&
      !assigned.has(n.id),
  );
  let unassigned: BoardSchedule | null = null;
  if (unassignedLoads.length > 0) {
    const rows = unassignedLoads.map((n) => loadRow(n, 380));
    const totalConnectedKW = rows.reduce((a, r) => a + r.connectedKW, 0);
    const totalDemandKW = rows.reduce((a, r) => a + r.demandKW, 0);
    const totalDemandKVA = rows.reduce((a, r) => a + r.demandKVA, 0);
    unassigned = {
      boardId: "__unassigned__",
      boardTag: "Unassigned",
      boardDescription: "Direct / orphaned loads",
      voltageV: 380,
      rows,
      totalConnectedKW,
      totalDemandKW,
      totalDemandKVA,
      totalCurrentA: (totalDemandKVA * 1000) / (SQRT3 * 380),
      level: 0,
      parentBoardId: null,
    };
  }

  // Grand totals sum every individual load exactly once (direct loads on every
  // board, plus unassigned) — never the cumulative sub-board roll-ups, which
  // would double-count.
  let connectedKW = 0;
  let demandKW = 0;
  let demandKVA = 0;
  for (const b of boards) {
    const v = boardVoltage(b);
    for (const ln of directLoads.get(b.id) ?? []) {
      const r = loadRow(ln, v);
      connectedKW += r.connectedKW;
      demandKW += r.demandKW;
      demandKVA += r.demandKVA;
    }
  }
  if (unassigned) {
    connectedKW += unassigned.totalConnectedKW;
    demandKW += unassigned.totalDemandKW;
    demandKVA += unassigned.totalDemandKVA;
  }

  return {
    boards: boardSchedules,
    unassigned,
    grand: { connectedKW, demandKW, demandKVA },
  };
}

/* ----------------------------- cable schedule --------------------------- */

export interface CableRow {
  tag: string;
  from: string;
  to: string;
  connectionType: string;
  sizeDescription: string;
  cores: number;
  csaMm2: number;
  material: string;
  insulation: string;
  lengthM: number;
  parallelRuns: number;

  /* --- analysis --- */
  phases: number;
  nominalV: number;
  /** Design (load) current the cable carries, A. 0 when undeterminable. */
  designCurrentA: number;
  hasLoad: boolean;
  ampacityA: number;
  utilizationPct: number;
  operatingTempC: number;
  maxTempC: number;
  hasLength: boolean;
  resistanceOhm: number | null;
  reactanceOhm: number | null;
  voltageDropV: number | null;
  /** Volt drop as a % of nominal voltage (null when no length given). */
  voltageDropPct: number | null;
}

/**
 * Pick the "load-side" context (phases / pf / voltage) for a feeder by looking
 * at its endpoints: prefer a connected load, then a board, else fall back to a
 * 3-phase 380 V assumption.
 */
function feederContext(
  edge: ElecEdge,
  byId: Map<string, ElecNode>,
): { phases: 1 | 3; powerFactor: number; nominalV: number } {
  const a = byId.get(edge.source);
  const b = byId.get(edge.target);
  const pick =
    [a, b].find((n) => n && isLoad(n)) ??
    [a, b].find(
      (n) => n && (engineModel(n) === "board" || engineModel(n) === "busbar"),
    ) ??
    a ??
    b;

  const phasesStr = pick ? String(param(pick, "phases") ?? "3") : "3";
  const phases: 1 | 3 = phasesStr === "1" ? 1 : 3;
  const powerFactor = pick ? num(param(pick, "powerFactor"), 0.85) || 0.85 : 0.85;
  // Loads without an explicit voltage default to the system nominal implied by
  // their phase count (line-to-line for 3φ, line-to-neutral for 1φ).
  const explicitV = pick ? num(param(pick, "voltageV")) : 0;
  const nominalV = explicitV > 0 ? explicitV : phases === 1 ? 230 : 380;
  return { phases, powerFactor, nominalV };
}

export function buildCableSchedule(
  nodes: ElecNode[],
  edges: ElecEdge[],
): CableRow[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const currents = edgeCurrents(nodes, edges);
  const rows: CableRow[] = [];
  let counter = 0;
  for (const e of edges) {
    if (!includeInReports(e.data)) continue;
    const type = e.data?.connectionType ?? "lv-power";
    if (type !== "lv-power" && type !== "mv-power") continue;
    counter += 1;
    const cable = e.data?.cable ?? {};
    const cores = num(cable.cores, 4);
    const csa = num(cable.csaMm2, 2.5);
    const material = cable.material === "aluminium" ? "Al" : "Cu";
    const insulation = cable.insulation ?? "XLPE";
    const runs = num(cable.parallelRuns, 1);
    const runPrefix = runs > 1 ? `${runs} × ` : "";
    const conductors =
      getCablePreset(cable.presetId)?.conductors ?? `${cores}C`;

    const { phases, powerFactor, nominalV } = feederContext(e, byId);
    const designCurrentA = currents.get(e.id) ?? 0;
    const a = analyseCable({
      cable,
      currentA: designCurrentA,
      phases,
      powerFactor,
      voltageV: nominalV,
    });

    rows.push({
      tag: (e.data?.tag as string) || `W-${100 + counter}`,
      from: byId.get(e.source) ? nodeLabel(byId.get(e.source)!) : "?",
      to: byId.get(e.target) ? nodeLabel(byId.get(e.target)!) : "?",
      connectionType: type === "mv-power" ? "MV" : "LV",
      sizeDescription: `${runPrefix}${conductors} × ${csa} mm² ${material} ${insulation}`,
      cores,
      csaMm2: csa,
      material,
      insulation,
      lengthM: num(cable.lengthM),
      parallelRuns: runs,
      phases,
      nominalV,
      designCurrentA,
      hasLoad: designCurrentA > 0,
      ampacityA: a.ampacityA,
      utilizationPct: a.utilizationPct,
      operatingTempC: a.operatingTempC,
      maxTempC: a.maxTempC,
      hasLength: a.hasLength,
      resistanceOhm: a.resistanceOhm,
      reactanceOhm: a.reactanceOhm,
      voltageDropV: a.voltageDropV,
      voltageDropPct: a.voltageDropPct,
    });
  }
  return rows;
}

/* -------------------------------- BOM ----------------------------------- */

export interface ElecBomRow {
  itemNo: number;
  type: string;
  description: string;
  rating: string;
  quantity: number;
  tags: string;
}

/** Build a short rating summary string from a node's key params. */
function ratingSummary(node: ElecNode): string {
  const p = (node.data.params as Record<string, unknown> | undefined) ?? {};
  const bits: string[] = [];
  if (p.ratedKVA != null) bits.push(`${num(p.ratedKVA)} kVA`);
  if (p.ratedKW != null) bits.push(`${num(p.ratedKW)} kW`);
  if (p.ratedKVAr != null) bits.push(`${num(p.ratedKVAr)} kVAr`);
  if (p.ratedCurrentA != null) bits.push(`${num(p.ratedCurrentA)} A`);
  if (p.breakingCapacityKA != null) bits.push(`${num(p.breakingCapacityKA)} kA`);
  if (p.poles != null) bits.push(String(p.poles));
  if (p.primaryV != null && p.secondaryV != null)
    bits.push(`${num(p.primaryV)}/${num(p.secondaryV)} V`);
  else if (p.voltageV != null) bits.push(`${num(p.voltageV)} V`);
  return bits.join(", ");
}

/**
 * Roll-up of every power cable by its construction (cores × CSA × material ×
 * insulation), with the *total length* of each type needed across the whole
 * SLD. Parallel runs count as separate physical cables, so a 50 m feeder with
 * two parallel runs contributes 100 m to its type's total.
 */
export interface CableSummaryRow {
  specification: string;
  /** Number of physical cable runs of this type (sums parallel runs). */
  runs: number;
  totalLengthM: number;
  /** False when none of the contributing feeders have a length entered. */
  hasLength: boolean;
}

export function buildCableSummary(
  nodes: ElecNode[],
  edges: ElecEdge[],
): CableSummaryRow[] {
  const cables = buildCableSchedule(nodes, edges);
  const groups = new Map<
    string,
    { runs: number; totalLengthM: number; lengthKnown: boolean }
  >();
  for (const c of cables) {
    // Drop the leading "N × " parallel-runs prefix so identical constructions
    // group together regardless of how many runs any single feeder has.
    const spec = c.sizeDescription.replace(/^\s*\d+\s*×\s*/, "");
    const runs = Math.max(1, c.parallelRuns || 1);
    const g = groups.get(spec) ?? { runs: 0, totalLengthM: 0, lengthKnown: false };
    g.runs += runs;
    g.totalLengthM += c.lengthM * runs;
    if (c.lengthM > 0) g.lengthKnown = true;
    groups.set(spec, g);
  }
  return [...groups.entries()]
    .map(([specification, g]) => ({
      specification,
      runs: g.runs,
      totalLengthM: g.totalLengthM,
      hasLength: g.lengthKnown,
    }))
    .sort((a, b) => a.specification.localeCompare(b.specification));
}

export function buildElectricalBom(nodes: ElecNode[]): ElecBomRow[] {
  // Group by symbol type + rating summary so identical items roll up.
  const groups = new Map<
    string,
    { type: string; description: string; rating: string; tags: string[] }
  >();
  for (const n of nodes) {
    if (!includeInReports(n.data)) continue;
    const sym = getElecSymbol(n.data.symbolType);
    if (!sym) continue;
    const rating = ratingSummary(n);
    const key = `${n.data.symbolType}::${rating}`;
    if (!groups.has(key)) {
      groups.set(key, {
        type: n.data.symbolType,
        description: sym.label,
        rating,
        tags: [],
      });
    }
    const tag = (n.data.tag as string) || "";
    if (tag) groups.get(key)!.tags.push(tag);
  }

  return [...groups.values()]
    .sort((a, b) => a.description.localeCompare(b.description))
    .map((g, i) => ({
      itemNo: i + 1,
      type: g.type,
      description: g.description,
      rating: g.rating,
      quantity: Math.max(g.tags.length, 1),
      tags: g.tags.sort().join(", "),
    }));
}

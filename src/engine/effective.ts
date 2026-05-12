/**
 * Pure helpers for *describing* the effective hydraulic parameters that the
 * engine would use for a given node — without actually running a solve. The
 * inspector uses this to render an "Effective values" hint next to the input
 * fields so the user understands what the auto-sizing produced.
 */

import type { DiagramEdge, DiagramNode } from "@/store/diagramStore";
import { getSymbol } from "@/symbols/registry";
import type { HydraulicsHint } from "@/symbols/types";

const ORPHAN_CONNECTION_ID_MM = 50;

export interface EffectiveHydraulics {
  /** Pipe ID (mm) the node would see at solve time. */
  connectionIdMm: number;
  /** True when the user has explicitly chosen a connection ID. */
  connectionIdManual: boolean;
  /** Loss model the engine will dispatch to. */
  lossModel: HydraulicsHint["lossModel"] | undefined;
  /** Effective Cv (Cv branch). */
  effectiveCv?: number;
  /** Effective K (K branch). */
  effectiveK?: number;
  /** Effective fixed ΔP in bar (deltaP branch). */
  effectiveDeltaPbar?: number;
  /** True when the value above is a registry / auto default, not user-set. */
  isAuto: boolean;
  /** "Cv ≈ 90 (gate valve default for DN50)" etc. Free-form text for the UI. */
  description: string;
}

/**
 * Compute the smallest connected process-pipe ID (mm) for a node, mirroring
 * the engine adapter's bottleneck rule. Returns `null` when nothing process
 * is wired up yet.
 */
export function connectedPipeIdMm(
  nodeId: string,
  edges: DiagramEdge[],
): number | null {
  let smallest: number | null = null;
  for (const e of edges) {
    const lt = e.data?.lineType ?? "process";
    if (lt !== "process") continue;
    if (e.source !== nodeId && e.target !== nodeId) continue;
    const id = e.data?.pipe?.innerDiameterMm;
    if (typeof id !== "number" || !Number.isFinite(id) || id <= 0) continue;
    if (smallest === null || id < smallest) smallest = id;
  }
  return smallest;
}

/**
 * Resolve what the engine would actually plug into the K / Cv / ΔP formula
 * for `node`, given the live `edges` set. Mirrors the dispatch rules in
 * `engine/models/{valve,fitting}.ts`.
 */
export function describeEffectiveHydraulics(
  node: DiagramNode,
  edges: DiagramEdge[],
): EffectiveHydraulics | null {
  const symbol = getSymbol(node.data.symbolType);
  if (!symbol) return null;
  const hyd = symbol.hydraulics;
  const params = (node.data.params ?? {}) as Record<string, unknown>;

  const connected = connectedPipeIdMm(node.id, edges);
  const manualId = numOrNaN(params.innerDiameterMm);
  const connectionIdMm = Number.isFinite(manualId)
    ? manualId
    : (connected ?? ORPHAN_CONNECTION_ID_MM);
  const connectionIdManual = Number.isFinite(manualId);

  const out: EffectiveHydraulics = {
    connectionIdMm,
    connectionIdManual,
    lossModel: hyd?.lossModel,
    isAuto: false,
    description: "",
  };

  // 1) Fixed-ΔP devices (heat exchangers, etc.).
  {
    const userDp = numOrNaN(params.deltaPbar);
    const def = hyd?.lossModel === "deltaP" ? hyd?.defaultDeltaPbar : undefined;
    if (Number.isFinite(userDp)) {
      out.effectiveDeltaPbar = userDp;
      out.isAuto = false;
      out.description = `ΔP ≈ ${formatNumber(userDp)} bar (user)`;
      return out;
    }
    if (Number.isFinite(def ?? NaN)) {
      out.effectiveDeltaPbar = def;
      out.isAuto = true;
      out.description = `ΔP ≈ ${formatNumber(def!)} bar (catalogue default)`;
      return out;
    }
  }

  // 2) Cv branch (control valves, regulators).
  {
    const userCv = numOrNaN(params.Cv);
    const def = hyd?.lossModel === "cv" ? hyd?.defaultCv : undefined;
    const open = clamp(numFieldDefault(params.openFraction, 1), 0.0001, 1);
    if (Number.isFinite(userCv) && (userCv as number) > 0) {
      out.effectiveCv = (userCv as number) * open;
      out.isAuto = false;
      out.description = `Cv ≈ ${formatNumber(out.effectiveCv)} (user${
        open < 1 ? ` × ${formatNumber(open)} open` : ""
      })`;
      return out;
    }
    if (Number.isFinite(def ?? NaN)) {
      out.effectiveCv = (def as number) * open;
      out.isAuto = true;
      out.description = `Cv ≈ ${formatNumber(out.effectiveCv)} (catalogue default${
        open < 1 ? ` × ${formatNumber(open)} open` : ""
      })`;
      return out;
    }
  }

  // 3) K branch (everything else with a K hint).
  {
    const userK = numOrNaN(params.K);
    const def = hyd?.defaultK;
    const open = clamp(numFieldDefault(params.openFraction, 1), 0.0001, 1);
    const Kraw = Number.isFinite(userK)
      ? (userK as number)
      : Number.isFinite(def ?? NaN)
        ? (def as number)
        : NaN;
    if (Number.isFinite(Kraw) && Kraw > 0) {
      const Keff = Kraw / (open * open);
      out.effectiveK = Keff;
      out.isAuto = !Number.isFinite(userK);
      const auto = out.isAuto ? " (catalogue default" : " (user";
      const openPart = open < 1 ? `, × 1/${formatNumber(open)}² open` : "";
      out.description = `K ≈ ${formatNumber(Keff)}${auto}${openPart}) on ${
        connectionIdManual ? "" : "≈"
      }DN${Math.round(connectionIdMm)}`;
      return out;
    }
  }

  return null;
}

function formatNumber(x: number): string {
  if (!Number.isFinite(x)) return "—";
  if (Math.abs(x) >= 100) return Math.round(x).toString();
  if (Math.abs(x) >= 10) return x.toFixed(1);
  return x.toFixed(2);
}

function numOrNaN(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : Number.NaN;
}

function numFieldDefault(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

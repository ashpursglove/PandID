/**
 * "Auto Size" optimisation for SLD power feeders.
 *
 * Two passes, both pure (no React / store access):
 *   1. CSA — resize every power feeder's conductor (down OR up) to the smallest
 *      standard cross-section that carries its downstream design current with a
 *      clean bill of health: no overload error AND no "near capacity" warning,
 *      i.e. Iz ≥ Ib / 0.85. An undersized cable is grown until it clears both.
 *   2. Phases — drop a three-phase feeder to its single-phase equivalent when
 *      nothing downstream of it actually needs three phases.
 *
 * Like the rest of the analysis these are approximate IEC-style sizings — they
 * clear the error/warning the validator raises, not a substitute for a full
 * cable-sizing calc with grouping / installation-method derating.
 */

import type { ElecEdge, ElecNode } from "@/electrical/store/electricalStore";
import { getElecSymbol } from "@/electrical/symbols/registry";
import type { ElecEngineModel } from "@/electrical/types";
import {
  STANDARD_CSA,
  STANDARD_DEVICE_RATINGS_A,
  cableFromPreset,
  getCablePreset,
  type Cable,
} from "@/electrical/symbols/cablePresets";
import { cableAmpacity } from "./cableAnalysis";
import { edgeCurrents } from "./validate";

/**
 * Target loading headroom. The validator flags a feeder "near capacity"
 * (amber warning) once the design current exceeds 85% of the cable's ampacity,
 * so to come out clean — no error AND no warning — Auto Size leaves at least
 * that 15% margin: it sizes so that Ib ≤ 0.85·Iz, i.e. Iz ≥ Ib / 0.85.
 */
const WARNING_FREE_RATIO = 0.85;

/** Three-phase preset → its closest single-phase equivalent (earth preserved). */
const THREE_TO_SINGLE: Record<string, string> = {
  "ac-3p-3": "ac-1p-ln", // 3L → L+N
  "ac-3p-n": "ac-1p-ln", // 3L+N → L+N
  "ac-3p-e": "ac-1p-lne", // 3L+E → L+N+E
  "ac-3p-npe": "ac-1p-lne", // 3L+N+E → L+N+E
  "ac-3p-npe-al": "ac-1p-lne", // aluminium 3L+N+E → L+N+E (material preserved)
};

function model(node: ElecNode): ElecEngineModel | undefined {
  return getElecSymbol(node.data.symbolType)?.engineModel;
}

function isLoad(node: ElecNode): boolean {
  const m = model(node);
  return m === "load" || m === "motor";
}

function loadPhases(node: ElecNode): 1 | 3 {
  const p = String(
    (node.data.params as Record<string, unknown> | undefined)?.phases ?? "3",
  );
  return p === "1" ? 1 : 3;
}

/**
 * Radial spanning tree rooted at the supply source(s) — mirrors `edgeCurrents`
 * so "downstream" is oriented the same way the current flow is.
 */
function radialTree(nodes: ElecNode[], edges: ElecEdge[]) {
  const adj = new Map<string, { nb: string; edge: string }[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if (adj.has(e.source) && adj.has(e.target)) {
      adj.get(e.source)!.push({ nb: e.target, edge: e.id });
      adj.get(e.target)!.push({ nb: e.source, edge: e.id });
    }
  }
  let roots = nodes.filter((n) => model(n) === "source").map((n) => n.id);
  if (roots.length === 0) {
    roots = nodes
      .filter((n) => model(n) === "board" || model(n) === "busbar")
      .map((n) => n.id);
  }
  if (roots.length === 0 && nodes.length > 0) roots = [nodes[0].id];

  const parentEdge = new Map<string, string>();
  const order: string[] = [];
  const visited = new Set<string>();
  const queue: string[] = [];
  for (const r of roots) {
    if (!visited.has(r)) {
      visited.add(r);
      queue.push(r);
    }
  }
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const { nb, edge } of adj.get(id) ?? []) {
      if (!visited.has(nb)) {
        visited.add(nb);
        parentEdge.set(nb, edge);
        queue.push(nb);
      }
    }
  }
  return { order, parentEdge };
}

/** Edge ids that have at least one three-phase load somewhere downstream. */
function edgesNeedingThreePhase(
  nodes: ElecNode[],
  edges: ElecEdge[],
): Set<string> {
  const { order, parentEdge } = radialTree(nodes, edges);
  const edgeById = new Map(edges.map((e) => [e.id, e]));
  const node3 = new Map<string, boolean>();
  for (const n of nodes) node3.set(n.id, isLoad(n) && loadPhases(n) === 3);

  const needs = new Set<string>();
  // Children precede parents in reverse BFS order, so propagating a node's
  // "needs 3φ" flag up its parent edge reaches every edge on the path to root.
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    if (!node3.get(id)) continue;
    const pe = parentEdge.get(id);
    if (pe === undefined) continue;
    needs.add(pe);
    const e = edgeById.get(pe);
    if (e) {
      const parent = e.source === id ? e.target : e.source;
      node3.set(parent, true);
    }
  }
  return needs;
}

/**
 * Smallest standard CSA whose ampacity leaves the full headroom margin (no
 * error and no near-capacity warning), or null if none in the range do.
 */
function minCsaFor(cable: Cable, requiredA: number): number | null {
  const targetAmpacity = requiredA / WARNING_FREE_RATIO;
  for (const csa of STANDARD_CSA) {
    if (cableAmpacity({ ...cable, csaMm2: csa }) >= targetAmpacity) return csa;
  }
  return null;
}

/**
 * Smallest standard device rating (A) that carries `requiredA` clean — no
 * overload and no near-capacity warning (rating ≥ Ib / 0.85). Falls back to the
 * largest standard frame if nothing fits.
 */
function minDeviceRatingFor(requiredA: number): number {
  const target = requiredA / WARNING_FREE_RATIO;
  for (const r of STANDARD_DEVICE_RATINGS_A) {
    if (r >= target) return r;
  }
  return STANDARD_DEVICE_RATINGS_A[STANDARD_DEVICE_RATINGS_A.length - 1];
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export interface AutoSizeResult {
  edges: ElecEdge[];
  nodes: ElecNode[];
  /** Power feeders examined (those with a determinable downstream load). */
  considered: number;
  /** Cables whose CSA was changed. */
  resized: number;
  /** Cables dropped from three-phase to single-phase. */
  phaseReduced: number;
  /** Cables that can't reach a clean (warning-free) size even at the largest
   *  CSA — they need parallel runs or the load split. */
  undersizedRemaining: number;
  /** Protective devices (breakers/MCCBs/ACBs…) whose rating was changed. */
  devicesResized: number;
}

/**
 * Return a new edge array with every power feeder's cable optimised. Edges with
 * no determinable downstream load (loops, spares, non-power lines) are left
 * untouched — we can't safely size or down-phase what we can't measure.
 */
export function autoSizeCables(
  nodes: ElecNode[],
  edges: ElecEdge[],
): AutoSizeResult {
  const currents = edgeCurrents(nodes, edges);
  const needs3 = edgesNeedingThreePhase(nodes, edges);

  let considered = 0;
  let resized = 0;
  let phaseReduced = 0;
  let undersizedRemaining = 0;

  const newEdges = edges.map((e) => {
    const type = e.data?.connectionType ?? "lv-power";
    if (type !== "lv-power" && type !== "mv-power") return e;

    const required = currents.get(e.id) ?? 0;
    if (required <= 0) return e; // no determinable downstream load
    considered += 1;

    let c: Cable = { ...(e.data?.cable ?? {}) };
    let changed = false;

    // 1. Phase reduction (only known three-phase presets feeding no 3φ load).
    const singleId = c.presetId ? THREE_TO_SINGLE[c.presetId] : undefined;
    if (singleId && !needs3.has(e.id)) {
      const preset = getCablePreset(singleId);
      if (preset) {
        const material = c.material;
        const insulation = c.insulation;
        c = cableFromPreset(preset, c);
        if (material) c.material = material; // keep aluminium etc.
        if (insulation) c.insulation = insulation;
        phaseReduced += 1;
        changed = true;
      }
    }

    // 2. CSA: smallest standard size that clears both the overload error and
    //    the near-capacity warning (skip fixed-build data/signal cables).
    const preset = getCablePreset(c.presetId);
    if (!preset?.fixedSize) {
      const minCsa = minCsaFor(c, required);
      if (minCsa == null) {
        const max = STANDARD_CSA[STANDARD_CSA.length - 1];
        if (c.csaMm2 !== max) {
          c.csaMm2 = max;
          resized += 1;
          changed = true;
        }
        undersizedRemaining += 1;
      } else if (c.csaMm2 !== minCsa) {
        c.csaMm2 = minCsa;
        resized += 1;
        changed = true;
      }
    }

    if (!changed) return e;
    return { ...e, data: { ...(e.data ?? {}), cable: c } };
  });

  // Device pass: pick the smallest standard frame that carries the current
  // through each breaker / MCCB / ACB / switch with no error and no warning.
  const incident = new Map<string, string[]>();
  const addIncident = (nodeId: string, edgeId: string) => {
    const list = incident.get(nodeId);
    if (list) list.push(edgeId);
    else incident.set(nodeId, [edgeId]);
  };
  for (const e of edges) {
    addIncident(e.source, e.id);
    addIncident(e.target, e.id);
  }
  let devicesResized = 0;
  const newNodes = nodes.map((n) => {
    if (model(n) !== "breaker") return n;
    let through = 0;
    for (const eid of incident.get(n.id) ?? []) {
      through = Math.max(through, currents.get(eid) ?? 0);
    }
    if (through <= 0) return n; // no determinable load through it
    const target = minDeviceRatingFor(through);
    const params = (n.data.params ?? {}) as Record<string, unknown>;
    if (num(params.ratedCurrentA) === target) return n;
    devicesResized += 1;
    return {
      ...n,
      data: { ...n.data, params: { ...params, ratedCurrentA: target } },
    };
  });

  return {
    edges: newEdges,
    nodes: newNodes,
    considered,
    resized,
    phaseReduced,
    undersizedRemaining,
    devicesResized,
  };
}

/**
 * Electrical sanity checks over the SLD graph. Pure functions — no React, no
 * store access — so they feed both the on-canvas fault highlighting and the
 * warnings panel.
 *
 * The headline check is cable adequacy: each power feeder's conductor is sized
 * against the full-load current of everything it carries downstream of the
 * supply. Ampacities are approximate IEC-style values (single circuit, ~method
 * C) — enough to flag a 2.5 mm² cable feeding a 30 kW motor, not a substitute
 * for a full cable-sizing calculation with derating factors.
 */

import type { ElecEdge, ElecNode } from "@/electrical/store/electricalStore";
import { getElecSymbol } from "@/electrical/symbols/registry";
import type { ElecEngineModel } from "@/electrical/types";
import { cableAmpacity, type CableSpec } from "./cableAnalysis";

export { cableAmpacity, type CableSpec };

const SQRT3 = Math.sqrt(3);

export type ElecIssueSeverity = "error" | "warning";

export interface ElecIssue {
  id: string;
  severity: ElecIssueSeverity;
  title: string;
  detail: string;
  nodeIds: string[];
  edgeIds: string[];
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function model(node: ElecNode): ElecEngineModel | undefined {
  return getElecSymbol(node.data.symbolType)?.engineModel;
}

function isLoad(node: ElecNode): boolean {
  const m = model(node);
  return m === "load" || m === "motor";
}

/** A spare (reserved) breaker — fed but with no outgoing connection. Its rated
 *  current is treated as a phantom load so upstream feeders and devices get
 *  sized for the future load it represents. */
function isSpare(node: ElecNode): boolean {
  return param(node, "spare") === true;
}

/** Phantom load current (A) for a spare way: simply its rated current. */
function spareLoadCurrent(node: ElecNode): number {
  return num(param(node, "ratedCurrentA"));
}

function nodeLabel(node: ElecNode): string {
  const sym = getElecSymbol(node.data.symbolType);
  return (
    (node.data.tag as string) ||
    (node.data.label as string) ||
    sym?.defaultLabel ||
    sym?.label ||
    node.data.symbolType ||
    "component"
  );
}

function param(node: ElecNode, key: string): unknown {
  return (node.data.params as Record<string, unknown> | undefined)?.[key];
}

/** Full-load current (A) drawn by a single load node. Mirrors the load-schedule maths. */
function loadFullLoadCurrent(node: ElecNode): number {
  const phases = String(param(node, "phases") ?? "3");
  const v = num(param(node, "voltageV"), 380) || 380;
  const kw = num(param(node, "ratedKW"));
  const df = num(param(node, "demandFactor"), 1);
  const pf = num(param(node, "powerFactor"), 0.85) || 0.85;
  const eff = num(param(node, "efficiencyPct"), 100) / 100 || 1;
  const demandKW = kw * df;
  const inputKW = model(node) === "motor" ? demandKW / eff : demandKW;
  const kVA = pf > 0 ? inputKW / pf : inputKW;
  return phases === "1" ? (kVA * 1000) / v : (kVA * 1000) / (SQRT3 * v);
}

function describeCable(cable: CableSpec): string {
  const cores = num(cable.cores, 4);
  const csa = num(cable.csaMm2);
  const mat = cable.material === "aluminium" ? "Al" : "Cu";
  const ins = cable.insulation ?? "XLPE";
  const runs = Math.max(1, num(cable.parallelRuns, 1));
  const prefix = runs > 1 ? `${runs} × ` : "";
  return `${prefix}${cores}C × ${csa} mm² ${mat} ${ins}`;
}

/* --------------------------- graph current flow ------------------------- */

/**
 * Current carried by each edge, assuming radial distribution from the supply
 * source(s). Builds a spanning tree rooted at the sources and sums the
 * downstream load full-load currents through each tree edge. Loop / mesh edges
 * that aren't part of the tree are left unset (we can't attribute a direction).
 */
export function edgeCurrents(
  nodes: ElecNode[],
  edges: ElecEdge[],
): Map<string, number> {
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

  const edgeById = new Map(edges.map((e) => [e.id, e]));
  const nodeCurrent = new Map<string, number>();
  for (const n of nodes) {
    nodeCurrent.set(
      n.id,
      isLoad(n)
        ? loadFullLoadCurrent(n)
        : isSpare(n)
          ? spareLoadCurrent(n)
          : 0,
    );
  }

  const edgeCurrent = new Map<string, number>();
  // Process deepest-first so children are summed before their parents.
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i];
    const cur = nodeCurrent.get(id) ?? 0;
    const pe = parentEdge.get(id);
    if (pe === undefined) continue;
    edgeCurrent.set(pe, (edgeCurrent.get(pe) ?? 0) + cur);
    const e = edgeById.get(pe);
    if (e) {
      const parent = e.source === id ? e.target : e.source;
      nodeCurrent.set(parent, (nodeCurrent.get(parent) ?? 0) + cur);
    }
  }
  return edgeCurrent;
}

function reachableFromSources(
  nodes: ElecNode[],
  edges: ElecEdge[],
): Set<string> {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    if (adj.has(e.source) && adj.has(e.target)) {
      adj.get(e.source)!.push(e.target);
      adj.get(e.target)!.push(e.source);
    }
  }
  const seen = new Set<string>();
  const queue = nodes.filter((n) => model(n) === "source").map((n) => n.id);
  for (const id of queue) seen.add(id);
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const nb of adj.get(id) ?? []) {
      if (!seen.has(nb)) {
        seen.add(nb);
        queue.push(nb);
      }
    }
  }
  return seen;
}

/* ------------------------------- validate ------------------------------- */

export function validateElectrical(
  nodes: ElecNode[],
  edges: ElecEdge[],
): ElecIssue[] {
  const issues: ElecIssue[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const currents = edgeCurrents(nodes, edges);

  const hasSource = nodes.some((n) => model(n) === "source");
  const hasLoad = nodes.some((n) => isLoad(n));

  if (hasLoad && !hasSource) {
    issues.push({
      id: "no-source",
      severity: "warning",
      title: "No supply source",
      detail:
        "There are loads on the diagram but no supply source (utility incomer, generator, PV…). Add a source so feeder currents can be checked against the actual feed.",
      nodeIds: [],
      edgeIds: [],
    });
  }

  for (const e of edges) {
    const type = e.data?.connectionType ?? "lv-power";
    if (type !== "lv-power" && type !== "mv-power") continue;

    const cable = (e.data?.cable ?? {}) as CableSpec;
    const tag = (e.data?.tag as string) || "feeder";
    const fromL = byId.get(e.source) ? nodeLabel(byId.get(e.source)!) : "?";
    const toL = byId.get(e.target) ? nodeLabel(byId.get(e.target)!) : "?";
    const route = `${fromL} → ${toL}`;
    const csa = num(cable.csaMm2);

    if (csa <= 0) {
      issues.push({
        id: `cable-nosize-${e.id}`,
        severity: "warning",
        title: `Cable size not set (${tag})`,
        detail: `The feeder ${route} has no conductor size specified. Set a CSA in the inspector so it can be checked against the load.`,
        nodeIds: [],
        edgeIds: [e.id],
      });
      continue;
    }

    const required = currents.get(e.id) ?? 0;
    if (required <= 0) continue; // no determinable downstream load

    const amp = cableAmpacity(cable);
    if (required > amp) {
      issues.push({
        id: `cable-under-${e.id}`,
        severity: "error",
        title: `Cable undersized (${tag})`,
        detail: `${route}: downstream load draws ≈ ${required.toFixed(0)} A, but ${describeCable(cable)} is only rated ≈ ${amp.toFixed(0)} A. Increase the conductor size, add parallel runs, or split the load.`,
        nodeIds: [],
        edgeIds: [e.id],
      });
    } else if (required > 0.85 * amp) {
      issues.push({
        id: `cable-marginal-${e.id}`,
        severity: "warning",
        title: `Cable near capacity (${tag})`,
        detail: `${route}: load ≈ ${required.toFixed(0)} A is within 15% of the ≈ ${amp.toFixed(0)} A rating of ${describeCable(cable)}. Consider the next size up to allow for derating and future load.`,
        nodeIds: [],
        edgeIds: [e.id],
      });
    }
  }

  // Protective-device adequacy: breakers / MCCBs / ACBs / switches must be
  // rated for the current that actually flows through them.
  const incidentEdges = new Map<string, string[]>();
  const addIncident = (nodeId: string, edgeId: string) => {
    const list = incidentEdges.get(nodeId);
    if (list) list.push(edgeId);
    else incidentEdges.set(nodeId, [edgeId]);
  };
  for (const e of edges) {
    addIncident(e.source, e.id);
    addIncident(e.target, e.id);
  }
  for (const n of nodes) {
    if (model(n) !== "breaker") continue;
    // A spare way is intentionally rated at (or above) its own phantom load, so
    // it would always read "at capacity" — skip checking it against itself. It
    // still loads everything upstream of it.
    if (isSpare(n)) continue;
    let through = 0;
    for (const eid of incidentEdges.get(n.id) ?? []) {
      through = Math.max(through, currents.get(eid) ?? 0);
    }
    if (through <= 0) continue; // no determinable load through it
    const rating = num(param(n, "ratedCurrentA"));
    const label = nodeLabel(n);
    if (rating <= 0) {
      issues.push({
        id: `device-norating-${n.id}`,
        severity: "warning",
        title: `Device rating not set (${label})`,
        detail: `${label} carries ≈ ${through.toFixed(0)} A but has no rated current set. Pick a rating so it can be checked against the load it protects.`,
        nodeIds: [n.id],
        edgeIds: [],
      });
      continue;
    }
    if (through > rating) {
      issues.push({
        id: `device-under-${n.id}`,
        severity: "error",
        title: `Device underrated (${label})`,
        detail: `${label} carries ≈ ${through.toFixed(0)} A but is only rated ${rating} A. Select a higher-rated device for this duty.`,
        nodeIds: [n.id],
        edgeIds: [],
      });
    } else if (through > 0.85 * rating) {
      issues.push({
        id: `device-marginal-${n.id}`,
        severity: "warning",
        title: `Device near capacity (${label})`,
        detail: `${label} carries ≈ ${through.toFixed(0)} A, within 15% of its ${rating} A rating. Consider the next frame size up for headroom.`,
        nodeIds: [n.id],
        edgeIds: [],
      });
    }
  }

  if (hasSource) {
    const reach = reachableFromSources(nodes, edges);
    for (const n of nodes) {
      if ((isLoad(n) || isSpare(n)) && !reach.has(n.id)) {
        issues.push({
          id: `load-unsupplied-${n.id}`,
          severity: "warning",
          title: `${isSpare(n) ? "Spare" : "Load"} not supplied (${nodeLabel(n)})`,
          detail: `${nodeLabel(n)} isn't connected back to any supply source. Wire it to a board or source so it's ${isSpare(n) ? "counted in the upstream sizing" : "actually fed"}.`,
          nodeIds: [n.id],
          edgeIds: [],
        });
      }
    }
  }

  return issues;
}

/* --------------------------- severity lookups --------------------------- */

export interface ElecIssueMaps {
  nodeSeverity: Map<string, ElecIssueSeverity>;
  edgeSeverity: Map<string, ElecIssueSeverity>;
  errors: number;
  warnings: number;
}

/** Collapse a list of issues into per-element severity maps (error wins). */
export function issueMaps(issues: ElecIssue[]): ElecIssueMaps {
  const nodeSeverity = new Map<string, ElecIssueSeverity>();
  const edgeSeverity = new Map<string, ElecIssueSeverity>();
  let errors = 0;
  let warnings = 0;
  for (const issue of issues) {
    if (issue.severity === "error") errors += 1;
    else warnings += 1;
    for (const id of issue.nodeIds) {
      if (issue.severity === "error" || !nodeSeverity.has(id)) {
        nodeSeverity.set(id, issue.severity);
      }
    }
    for (const id of issue.edgeIds) {
      if (issue.severity === "error" || !edgeSeverity.has(id)) {
        edgeSeverity.set(id, issue.severity);
      }
    }
  }
  return { nodeSeverity, edgeSeverity, errors, warnings };
}

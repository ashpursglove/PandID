/**
 * Single-path hydraulic solver. v1 walks a single chain of components in
 * series; v2 will swap this for a branched / looped solver behind the same
 * `solve()` signature without touching the UI or engine models.
 */

import type {
  ComponentLoss,
  EngineFluid,
  EngineGraph,
  EngineNode,
  FeasibilityReport,
  PumpCurvePoint,
  SinglePathResult,
} from "./types";

import { extractPath, type PathStep } from "./path";
import { m3hToM3s, m3sToM3h, paToHead } from "./fluid";
import { buildPumpCurve, type PumpCurveFn } from "./models/pump";
import { pipeLoss } from "./models/pipe";
import { valveLoss } from "./models/valve";
import { fittingNodeLoss } from "./models/fitting";

export interface SolveInput {
  graph: EngineGraph;
  fluid: EngineFluid;
  startNodeId: string;
  endNodeId: string;
}

export interface ForwardSolveInput extends SolveInput {
  mode: "forward";
}

export interface InverseSolveInput extends SolveInput {
  mode: "inverse";
  /** Desired operating flow in m³/h. */
  targetQM3h: number;
}

export type Solve = ForwardSolveInput | InverseSolveInput;

const MAX_PROBE_QM3H = 2000; // search range upper bound; covers most real pumps

export function solve(input: Solve): SinglePathResult {
  const path = extractPath(input.graph, input.startNodeId, input.endNodeId);
  const warnings: string[] = [];

  const pumps = path
    .map((step) => ({ step, curve: buildPumpCurve(step.node) }))
    .filter((x) => x.curve);
  const pumpCurve = pumps[0]?.curve ?? null;
  if (pumps.length === 0) warnings.push("No pump found along the selected path.");
  if (pumps.length > 1)
    warnings.push("Multiple pumps in series — using the first only (v1).");

  if (input.mode === "forward") {
    return solveForward(input, path, pumpCurve, warnings);
  }
  return solveInverse(input, path, pumpCurve, warnings);
}

/* ----- Forward (find Q given pump) -------------------------------------- */

function solveForward(
  input: ForwardSolveInput,
  path: PathStep[],
  pumpCurve: PumpCurveFn | null,
  warnings: string[],
): SinglePathResult {
  const elevationDelta = sumElevation(path);
  const shutoffHead = pumpShutoffHead(pumpCurve);

  if (!pumpCurve) {
    return buildResult({
      input,
      path,
      qM3s: 0,
      pumpCurve,
      warnings,
      elevationDelta,
      feasibility: {
        ok: false,
        reason: "no-pump",
        message:
          "No pump in the selected path, so the analyser can't determine an operating flow on its own.",
        maxAchievableQM3h: 0,
        availablePumpHeadM: 0,
        requiredHeadM: elevationDelta,
      },
    });
  }

  // The pump can't even lift the static head — flow is zero in real life.
  if (shutoffHead < elevationDelta - 1e-6) {
    warnings.push(
      `Pump shut-off head ${shutoffHead.toFixed(2)} m is below the ${elevationDelta.toFixed(
        2,
      )} m static lift on this path. Real flow is zero.`,
    );
    return buildResult({
      input,
      path,
      qM3s: 0,
      pumpCurve,
      warnings,
      elevationDelta,
      feasibility: {
        ok: false,
        reason: "shutoff-below-static",
        message: `The pump can produce at most ${shutoffHead.toFixed(
          2,
        )} m of head at zero flow, but the route climbs ${elevationDelta.toFixed(
          2,
        )} m. The pump can't lift the fluid that high, so no flow is established.`,
        maxAchievableQM3h: 0,
        availablePumpHeadM: shutoffHead,
        requiredHeadM: elevationDelta,
      },
    });
  }

  // f(Q) = pump head - (elevation gain + total head loss)
  const f = (qM3s: number) => {
    const head = pumpCurve.headAtQM3s(qM3s);
    const lossHead = paToHead(
      totalLossPa(path, qM3s, input.fluid),
      input.fluid,
    );
    return head - (elevationDelta + lossHead);
  };

  const qM3s = findRoot(f, m3hToM3s(MAX_PROBE_QM3H));
  if (!Number.isFinite(qM3s)) {
    warnings.push(
      "Pump curve and system curve don't intersect inside the search range — pump is undersized for this system.",
    );
    return buildResult({
      input,
      path,
      qM3s: 0,
      pumpCurve,
      warnings,
      elevationDelta,
      feasibility: {
        ok: false,
        reason: "no-intersection",
        message:
          "The pump curve never crosses the system curve at any positive flow. Either the pump is undersized for this route, or the system has unusually high resistance.",
        maxAchievableQM3h: 0,
        availablePumpHeadM: shutoffHead,
        requiredHeadM: elevationDelta,
      },
    });
  }

  return buildResult({
    input,
    path,
    qM3s,
    pumpCurve,
    warnings,
    elevationDelta,
    feasibility: { ok: true },
  });
}

/* ----- Inverse (given Q, what pump head?) ------------------------------- */

function solveInverse(
  input: InverseSolveInput,
  path: PathStep[],
  pumpCurve: PumpCurveFn | null,
  warnings: string[],
): SinglePathResult {
  const elevationDelta = sumElevation(path);
  const shutoffHead = pumpShutoffHead(pumpCurve);
  const qM3s = m3hToM3s(Math.max(0, input.targetQM3h));

  const requiredHead =
    elevationDelta +
    paToHead(totalLossPa(path, qM3s, input.fluid), input.fluid);

  let feasibility: FeasibilityReport = { ok: true, requiredHeadM: requiredHead };

  if (pumpCurve) {
    const availableHead = Math.max(0, pumpCurve.headAtQM3s(qM3s));
    feasibility = {
      ok: true,
      availablePumpHeadM: availableHead,
      requiredHeadM: requiredHead,
    };

    // Max achievable Q for this pump on this path (where curves cross).
    const fIntersect = (q: number) => {
      const h = pumpCurve.headAtQM3s(q);
      const losses = paToHead(totalLossPa(path, q, input.fluid), input.fluid);
      return h - (elevationDelta + losses);
    };
    let maxAchievable = 0;
    if (shutoffHead > elevationDelta) {
      const root = findRoot(fIntersect, m3hToM3s(MAX_PROBE_QM3H));
      if (Number.isFinite(root)) maxAchievable = m3sToM3h(root);
    }
    feasibility.maxAchievableQM3h = maxAchievable;

    if (shutoffHead < elevationDelta - 1e-6) {
      warnings.push(
        `Pump shut-off head ${shutoffHead.toFixed(2)} m is below the ${elevationDelta.toFixed(
          2,
        )} m static lift — no real flow is possible with this pump.`,
      );
      feasibility = {
        ok: false,
        reason: "shutoff-below-static",
        message: `Even at zero flow the pump only produces ${shutoffHead.toFixed(
          2,
        )} m of head, but the route needs at least ${elevationDelta.toFixed(
          2,
        )} m just to overcome elevation. This duty point is not achievable with this pump.`,
        availablePumpHeadM: shutoffHead,
        requiredHeadM: requiredHead,
        maxAchievableQM3h: 0,
      };
    } else if (availableHead + 1e-6 < requiredHead) {
      warnings.push(
        `Pump is undersized at this flow: produces ${availableHead.toFixed(
          2,
        )} m but the system needs ${requiredHead.toFixed(2)} m.`,
      );
      feasibility = {
        ok: false,
        reason: "pump-undersized",
        message: `At ${input.targetQM3h.toFixed(
          1,
        )} m³/h the pump delivers about ${availableHead.toFixed(
          2,
        )} m of head, but the route needs ${requiredHead.toFixed(
          2,
        )} m. The pump curve sits below the system curve, so this flow can't be reached in steady state. The actual operating flow would settle near ${maxAchievable.toFixed(
          1,
        )} m³/h.`,
        availablePumpHeadM: availableHead,
        requiredHeadM: requiredHead,
        maxAchievableQM3h: maxAchievable,
      };
    }
  }

  return buildResult({
    input,
    path,
    qM3s,
    pumpCurve,
    warnings,
    elevationDelta,
    feasibility,
  });
}

/* ----- Common assembly -------------------------------------------------- */

function buildResult(args: {
  input: SolveInput;
  path: PathStep[];
  qM3s: number;
  pumpCurve: PumpCurveFn | null;
  warnings: string[];
  elevationDelta: number;
  feasibility: FeasibilityReport;
}): SinglePathResult {
  const { input, path, qM3s, pumpCurve, warnings, elevationDelta, feasibility } =
    args;
  const components: ComponentLoss[] = [];

  for (let i = 0; i < path.length; i++) {
    const step = path[i];
    const nextStep = path[i + 1];
    const node = step.node;
    if (node.engineModel === "pump" && pumpCurve) {
      const head = pumpCurve.headAtQM3s(qM3s);
      components.push({
        nodeId: node.id,
        label: nodeLabel(node),
        kind: "pump",
        deltaPpa: -head * input.fluid.densityKgM3 * 9.80665, // negative = adds head
        headM: -head,
      });
    } else if (node.engineModel === "valve") {
      const out = valveLoss(node, qM3s, input.fluid);
      if (out.deltaPpa !== 0 || out.source !== "none") {
        components.push({
          nodeId: node.id,
          label: nodeLabel(node),
          kind: "valve",
          deltaPpa: out.deltaPpa,
          headM: paToHead(out.deltaPpa, input.fluid),
        });
      }
    } else if (
      node.engineModel === "fitting" ||
      node.engineModel === "passive" ||
      node.engineModel === "vessel"
    ) {
      // Filters, strainers, static mixers, heat exchangers, vessels, ... all
      // share the same generic K / fixed-ΔP path. We only emit a row when the
      // device actually impedes flow so passive flow-through nodes (instrument
      // tap points, off-page connectors, simple vessels) stay invisible.
      const out = fittingNodeLoss(node, qM3s, input.fluid);
      if (out.source !== "none" && out.deltaPpa > 0) {
        components.push({
          nodeId: node.id,
          label: nodeLabel(node),
          kind: node.engineModel,
          deltaPpa: out.deltaPpa,
          headM: paToHead(out.deltaPpa, input.fluid),
        });
      }
    }
    if (step.edge && nextStep) {
      const loss = pipeLoss(step.edge, qM3s, input.fluid);
      const fromTag = step.node.tag ?? step.node.id;
      const toTag = nextStep.node.tag ?? nextStep.node.id;
      const fittings = step.edge.pipe.fittings ?? [];
      const fittingsSummary = fittings.length
        ? fittings
            .map((f) => `${f.count}× ${humaniseFittingKind(f.kind)}`)
            .join(", ")
        : "none";
      components.push({
        edgeId: step.edge.id,
        label: `Pipe ${fromTag} → ${toTag}`,
        kind: "pipe",
        deltaPpa: loss.totalPa,
        headM: paToHead(loss.totalPa, input.fluid),
        reynolds: loss.reynolds,
        velocityMs: loss.velocityMs,
        frictionHeadM: paToHead(loss.frictionPa, input.fluid),
        fittingsHeadM: paToHead(loss.fittingsPa, input.fluid),
        elevationHeadM: paToHead(loss.elevationPa, input.fluid),
        lengthM: step.edge.pipe.lengthM,
        innerDiameterMm: step.edge.pipe.innerDiameterMm,
        roughnessMm: step.edge.pipe.roughnessMm,
        fittingsSummary,
      });
    }
  }

  const pumpHeadM = pumpCurve ? pumpCurve.headAtQM3s(qM3s) : 0;
  const pumpShutoffHeadM = pumpShutoffHead(pumpCurve);
  const systemHeadM = components
    .filter((c) => c.kind !== "pump")
    .reduce((acc, c) => acc + c.headM, 0);

  // The system curve typically scales with Q² (turbulent friction), so a flat
  // uniform sweep across 0–MAX_PROBE leaves only one or two samples inside the
  // tight operating region where the curves actually cross. Bias the samples
  // so ~3/4 of them land in the focus zone (around the operating point /
  // achievable flow), and the rest fan out for context when the user pans/zooms.
  const focusQM3s = computeFocusQM3s(qM3s, feasibility);
  const sampleQs = focusedSamples(
    0,
    m3hToM3s(MAX_PROBE_QM3H),
    focusQM3s,
    240,
  );
  const pumpCurveSampled: PumpCurvePoint[] = pumpCurve
    ? sampleQs.map((q) => ({
        q: m3sToM3h(q),
        h: Math.max(0, pumpCurve.headAtQM3s(q)),
      }))
    : [];
  const systemCurveSampled: PumpCurvePoint[] = sampleQs.map((q) => {
    const lossHead = paToHead(totalLossPa(path, q, input.fluid), input.fluid);
    return { q: m3sToM3h(q), h: elevationDelta + lossHead };
  });

  return {
    qM3s,
    qM3h: m3sToM3h(qM3s),
    systemHeadM,
    pumpHeadM,
    pumpShutoffHeadM,
    elevationDeltaM: elevationDelta,
    components,
    pumpCurveSampled,
    systemCurveSampled,
    warnings,
    feasibility,
  };
}

/* ----- Helpers ---------------------------------------------------------- */

function pumpShutoffHead(curve: PumpCurveFn | null): number {
  if (!curve) return 0;
  return Math.max(0, curve.headAtQM3s(0));
}

function sumElevation(path: PathStep[]): number {
  let total = 0;
  for (const step of path) {
    if (step.edge) total += step.edge.pipe.elevationChangeM || 0;
  }
  return total;
}

function totalLossPa(
  path: PathStep[],
  qM3s: number,
  fluid: EngineFluid,
): number {
  let total = 0;
  for (const step of path) {
    if (step.edge) {
      const loss = pipeLoss(step.edge, qM3s, fluid);
      total += loss.frictionPa + loss.fittingsPa; // elevation kept separate
    }
    total += componentDeltaPpa(step.node, qM3s, fluid);
  }
  return total;
}

/**
 * Dispatch a single node to the right loss model. Everything that isn't a
 * pump (handled separately) or a pure pass-through node funnels through here
 * so the forward / inverse solvers see the *same* system curve that the
 * per-component breakdown reports.
 */
function componentDeltaPpa(
  node: EngineNode,
  qM3s: number,
  fluid: EngineFluid,
): number {
  switch (node.engineModel) {
    case "valve":
      return valveLoss(node, qM3s, fluid).deltaPpa;
    case "fitting":
    case "passive":
    case "vessel":
      return fittingNodeLoss(node, qM3s, fluid).deltaPpa;
    default:
      return 0;
  }
}

function nodeLabel(node: EngineNode): string {
  return node.tag ?? node.symbolLabel ?? node.id;
}

function findRoot(f: (q: number) => number, hiM3s: number): number {
  // f(0) should be > 0 (pump shutoff head exceeds zero loss + zero elevation)
  // f(hi) should be < 0 (system head exceeds pump head at high Q)
  const fLo = f(0);
  const fHi = f(hiM3s);
  if (!Number.isFinite(fLo) || !Number.isFinite(fHi)) return Number.NaN;
  if (Math.sign(fLo) === Math.sign(fHi)) return Number.NaN;

  let lo = 0;
  let hi = hiM3s;
  for (let i = 0; i < 80; i++) {
    const mid = 0.5 * (lo + hi);
    const fMid = f(mid);
    if (Math.abs(fMid) < 1e-3 || hi - lo < 1e-8) return mid;
    if (Math.sign(fMid) === Math.sign(fLo)) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/**
 * Pick a "focus" flow (m³/s) for biased sample density: the operating point if
 * we have one, otherwise the achievable-flow ceiling from inverse mode, with a
 * gentle floor so we still sample sensibly when the pump can't establish flow
 * at all.
 */
function computeFocusQM3s(qM3s: number, feasibility: FeasibilityReport): number {
  if (qM3s > 0) return qM3s;
  if (feasibility.maxAchievableQM3h && feasibility.maxAchievableQM3h > 0) {
    return m3hToM3s(feasibility.maxAchievableQM3h);
  }
  // Infeasible case: a small floor so we still see some curve resolution.
  return m3hToM3s(20);
}

/**
 * Build a non-uniform sample set across [lo, hi]: about 75% of the samples are
 * packed into [lo, 2·focus] (clamped to hi) so the chart picks up the curve's
 * real shape around the operating region, and the remaining 25% fan out
 * uniformly across the rest of the range for context.
 */
function focusedSamples(
  lo: number,
  hi: number,
  focus: number,
  total: number,
): number[] {
  const focusEnd = Math.min(hi, Math.max(focus * 2, hi * 0.02));
  const focusN = Math.max(8, Math.floor(total * 0.75));
  const wideN = Math.max(8, total - focusN);

  const out = new Set<number>();
  out.add(lo);
  for (let i = 1; i <= focusN; i++) {
    out.add(lo + (i / focusN) * (focusEnd - lo));
  }
  if (focusEnd < hi) {
    for (let i = 1; i <= wideN; i++) {
      out.add(focusEnd + (i / wideN) * (hi - focusEnd));
    }
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * Convert the internal fitting kind ids (e.g. "elbow-90-standard") into a
 * compact label suitable for the analysis-table summary line.
 */
function humaniseFittingKind(kind: string): string {
  const map: Record<string, string> = {
    "elbow-90-standard": "90° elbow",
    "elbow-90-long": "90° LR elbow",
    "elbow-45": "45° elbow",
    "tee-through": "tee (run)",
    "tee-branch": "tee (branch)",
    "gate-open": "gate (open)",
    "ball-open": "ball (open)",
    "check-swing": "swing check",
    "entrance-sharp": "sharp entrance",
    exit: "exit",
  };
  return map[kind] ?? kind.replace(/-/g, " ");
}

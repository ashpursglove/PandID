/**
 * Engine types. Pure data; no React, no React Flow. The diagram store has an
 * adapter that converts DiagramNode/DiagramEdge into these shapes.
 */

import type { EngineModel, HydraulicsHint } from "@/symbols/types";
import type { LineType } from "@/types/diagram";

export interface EngineFluid {
  id?: string;
  name?: string;
  densityKgM3: number;
  viscosityPaS: number;
  temperatureC: number;
}

export interface PumpCurvePoint {
  /** Volumetric flow (m³/h). */
  q: number;
  /** Total head (m). */
  h: number;
}

export interface PipeProps {
  lengthM: number;
  innerDiameterMm: number;
  roughnessMm: number;
  elevationChangeM: number;
  fittings: { kind: string; k: number; count: number }[];
}

export interface EngineNode {
  id: string;
  /** Original symbol-registry key (centrifugal-pump, gate-valve, …). */
  symbolType: string;
  /** Dispatch key for the analysis engine. */
  engineModel: EngineModel;
  /** Display tag (P-101 etc.). */
  tag?: string;
  /** Raw user-edited parameters (pump curve, Cv, volume, …). */
  params: Record<string, unknown>;
  /** Symbol's catalogue label, e.g. "Y-strainer". Used as a fallback when
   *  no user tag is set so the analysis breakdown still reads as English. */
  symbolLabel?: string;
  /** Effective inner diameter of the pipe(s) this node is connected to. The
   *  K-based loss model auto-sizes itself to this when the user hasn't
   *  overridden the connection ID on the component. */
  connectionIdMm?: number;
  /** Type-level hydraulic defaults from the symbol registry. */
  hydraulics?: HydraulicsHint;
}

export interface EnginePipeEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  lineType: LineType;
  pipe: PipeProps;
}

export interface EngineGraph {
  nodes: EngineNode[];
  edges: EnginePipeEdge[];
}

/* ----- Result shapes ---------------------------------------------------- */

export interface ComponentLoss {
  nodeId?: string;
  edgeId?: string;
  label: string;
  kind: EngineModel | "pipe";
  /** Pressure drop at the solved flow (Pa). Positive = consumes head. */
  deltaPpa: number;
  /** Head loss (m). */
  headM: number;
  /** Reynolds number (pipes only). */
  reynolds?: number;
  /** Velocity m/s (pipes only). */
  velocityMs?: number;
  /* ----- Pipe-only breakdown of where the head loss is going --------- */
  /** Friction (Darcy-Weisbach) component, m. */
  frictionHeadM?: number;
  /** Sum of all fittings' minor-loss head, m. */
  fittingsHeadM?: number;
  /** Static elevation gain (+) or drop (−), m. */
  elevationHeadM?: number;
  /* ----- Pipe geometry that produced the breakdown ------------------- */
  lengthM?: number;
  innerDiameterMm?: number;
  roughnessMm?: number;
  /** Short human-readable summary of fittings on this pipe. */
  fittingsSummary?: string;
}

/** Why the operating point we returned isn't physically achievable, if so. */
export type InfeasibilityReason =
  | "no-pump"
  | "shutoff-below-static"
  | "no-intersection"
  | "pump-undersized";

export interface FeasibilityReport {
  /** True when the operating point can actually be delivered by this pump. */
  ok: boolean;
  reason?: InfeasibilityReason;
  /** Human-readable explanation suitable for the analysis UI. */
  message?: string;
  /** Maximum flow the pump can actually establish through this path (m³/h). */
  maxAchievableQM3h?: number;
  /** Pump head supplied at the requested operating point (m). */
  availablePumpHeadM?: number;
  /** System head required at that flow (m), including elevation. */
  requiredHeadM?: number;
}

export interface SinglePathResult {
  /** Operating volumetric flow (m³/s). */
  qM3s: number;
  /** Same as qM3s but in user units (m³/h). */
  qM3h: number;
  /** Total head loss across the path (m), excluding the pump. */
  systemHeadM: number;
  /** Pump head supplied (m). */
  pumpHeadM: number;
  /** Pump shut-off head (m) — i.e. head at Q=0. Zero if no pump. */
  pumpShutoffHeadM: number;
  /** Static elevation difference end - start (m). */
  elevationDeltaM: number;
  /** Per-component breakdown, in path order. */
  components: ComponentLoss[];
  /** Pump curve sample for plotting. */
  pumpCurveSampled: PumpCurvePoint[];
  /** System curve sample for plotting. */
  systemCurveSampled: PumpCurvePoint[];
  /** Diagnostic warnings (e.g. "no pump in path"). */
  warnings: string[];
  /** Whether the reported flow is actually physically achievable. */
  feasibility: FeasibilityReport;
}

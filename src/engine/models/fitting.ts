/**
 * Generic loss model for in-line components that aren't pumps, pipes, or
 * Cv-rated valves — filters, strainers, static mixers, orifice plates,
 * heat exchangers, ... Two flavours are supported:
 *
 *   1. K-based loss   ΔP = K · ½ ρ v²
 *      Velocity is computed from the *connected pipe ID* so the user doesn't
 *      have to retype the diameter on every fitting.
 *
 *   2. Fixed ΔP       ΔP = const  (bar → Pa)
 *      Heat exchangers and similar equipment with a published tube-side drop
 *      use this branch — the drop is independent of Q at the v1 level.
 *
 * The model honours user overrides: any explicit `K`, `Cv`, `deltaPbar`, or
 * `innerDiameterMm` in `node.params` takes priority over the registry hints.
 */

import type { EngineFluid, EngineNode } from "@/engine/types";
import { fittingDeltaP } from "@/engine/hydraulics";

const BAR_TO_PA = 1e5;

export interface FittingLossOutcome {
  /** Pressure drop in Pa at the requested flow. */
  deltaPpa: number;
  /** Which branch produced the number — useful for the inspector hint. */
  source: "k" | "deltaP" | "none";
  /** Effective K used in the K-branch (NaN when not applicable). */
  effectiveK: number;
  /** Effective hydraulic diameter used in the K-branch (mm, NaN otherwise). */
  effectiveIdMm: number;
}

export function fittingNodeLoss(
  node: EngineNode,
  qM3s: number,
  fluid: EngineFluid,
): FittingLossOutcome {
  const params = node.params ?? {};
  const hyd = node.hydraulics ?? {};

  // 1) Fixed-ΔP devices: a user-specified value wins, otherwise fall back to
  //    the symbol's catalogue hint. Either way the drop is constant w.r.t. Q.
  const userDpBar = numOrNaN(params.deltaPbar);
  const defaultDpBar =
    hyd.lossModel === "deltaP" ? hyd.defaultDeltaPbar : undefined;
  const dpBar = Number.isFinite(userDpBar)
    ? userDpBar
    : Number.isFinite(defaultDpBar ?? NaN)
      ? (defaultDpBar as number)
      : NaN;
  if (Number.isFinite(dpBar) && dpBar > 0) {
    return {
      deltaPpa: dpBar * BAR_TO_PA,
      source: "deltaP",
      effectiveK: Number.NaN,
      effectiveIdMm: Number.NaN,
    };
  }

  // 2) K-based devices. Pull K from params, then registry default. Fitting
  //    sees the diameter of its (smallest) attached process pipe so it
  //    auto-scales with the line size.
  const K = pickNumber(params.K, hyd.defaultK);
  if (!Number.isFinite(K) || K <= 0) {
    return {
      deltaPpa: 0,
      source: "none",
      effectiveK: Number.NaN,
      effectiveIdMm: Number.NaN,
    };
  }
  const dMm = pickNumber(params.innerDiameterMm, node.connectionIdMm);
  const D = (Number.isFinite(dMm) && dMm > 0 ? dMm : 50) / 1000;
  return {
    deltaPpa: fittingDeltaP(qM3s, D, K, fluid),
    source: "k",
    effectiveK: K,
    effectiveIdMm: D * 1000,
  };
}

function pickNumber(...candidates: unknown[]): number {
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) return c;
  }
  return Number.NaN;
}

function numOrNaN(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : Number.NaN;
}

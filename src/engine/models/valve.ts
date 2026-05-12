import type { EngineFluid, EngineNode } from "@/engine/types";
import { fittingDeltaP } from "@/engine/hydraulics";

/**
 * Unified pressure-drop model for every "valve" engine node — isolation,
 * specialty, check, control, and actuated. Two co-existing formulations are
 * supported so we can route catalogue valves through their natural parameter:
 *
 *   • Cv-based  (control valves, regulators, anything with a rated Cv):
 *
 *       Q [gpm] = Cv · √(ΔP [psi] / SG)
 *       ⇒ ΔP_Pa  = (Q_gpm / Cv_eff)² · SG · PSI_TO_PA
 *
 *     Effective Cv = Cv_rated · openFraction (≈ linear inherent trim).
 *
 *   • K-based   (gate, ball, butterfly, check, foot, ... any time Cv isn't
 *     given but a type-level K hint is):
 *
 *       ΔP_Pa = K_eff · ½ ρ v²   where v is taken at the connected pipe ID.
 *
 *     Partial opening multiplies K like ~ 1/openFraction² (Crane TP-410
 *     approximation for throttling losses). Check valves add a constant
 *     cracking-pressure term on top once flow is established.
 *
 * Selection rule:
 *   - `params.Cv` set  → Cv branch.
 *   - else `params.K` set, or registry has `defaultK` → K branch.
 *   - else returns 0 (e.g. relief valves under normal operation).
 */

const GPM_TO_M3S = 6.30902e-5;
const PSI_TO_PA = 6894.76;
const BAR_TO_PA = 1e5;

export interface ValveLossOutcome {
  deltaPpa: number;
  /** Which branch produced the number. Useful for inspector hints. */
  source: "cv" | "k" | "none";
  /** Effective Cv used in the Cv branch (NaN otherwise). */
  effectiveCv: number;
  /** Effective K used in the K branch (NaN otherwise). */
  effectiveK: number;
  /** Effective hydraulic ID used in the K branch (mm, NaN otherwise). */
  effectiveIdMm: number;
}

export function valveLoss(
  node: EngineNode,
  qM3s: number,
  fluid: EngineFluid,
): ValveLossOutcome {
  const params = node.params ?? {};
  const hyd = node.hydraulics ?? {};
  const open = clamp(numField(params.openFraction, 1), 0.0001, 1);

  // ----- Cv branch (explicit user Cv, or symbol whose hint is "cv") -----
  const userCv = numOrNaN(params.Cv);
  const defaultCv = hyd.lossModel === "cv" ? hyd.defaultCv : undefined;
  const cvRated = Number.isFinite(userCv)
    ? userCv
    : Number.isFinite(defaultCv ?? NaN)
      ? (defaultCv as number)
      : NaN;
  if (Number.isFinite(cvRated) && cvRated > 0) {
    const cvEff = cvRated * open;
    const dp =
      cvEff > 0 && qM3s > 0
        ? ((qM3s / GPM_TO_M3S / cvEff) ** 2 * (fluid.densityKgM3 / 1000)) *
          PSI_TO_PA
        : 0;
    return {
      deltaPpa: dp,
      source: "cv",
      effectiveCv: cvEff,
      effectiveK: Number.NaN,
      effectiveIdMm: Number.NaN,
    };
  }

  // ----- K branch (filter-style ΔP using connected pipe ID) -----
  const Kbase = numOrNaN(params.K);
  const defaultK = hyd.defaultK;
  const Kraw = Number.isFinite(Kbase)
    ? Kbase
    : Number.isFinite(defaultK ?? NaN)
      ? (defaultK as number)
      : NaN;

  if (Number.isFinite(Kraw) && Kraw > 0) {
    // Throttling multiplier: K scales like ~ 1/open² as the trim closes.
    // This is a smooth approximation — real inherent characteristics
    // (equal-percentage, linear, quick-open) differ, but ~1/x² captures the
    // gross effect for non-control valves.
    const Keff = Kraw / (open * open);
    const dMm = pickNumber(params.innerDiameterMm, node.connectionIdMm);
    const D = (Number.isFinite(dMm) && dMm > 0 ? dMm : 50) / 1000;
    let dp = fittingDeltaP(qM3s, D, Keff, fluid);

    // Check valves: cracking pressure adds a constant pressure overhead once
    // the valve has lifted off its seat. Modelled as an additive Pa offset
    // (small but non-zero for low-flow / low-velocity cases).
    if (hyd.isCheck && qM3s > 0) {
      const cracking = numOrNaN(params.crackingPressureBar);
      if (Number.isFinite(cracking) && cracking > 0) {
        dp += cracking * BAR_TO_PA;
      }
    }

    return {
      deltaPpa: dp,
      source: "k",
      effectiveCv: Number.NaN,
      effectiveK: Keff,
      effectiveIdMm: D * 1000,
    };
  }

  return {
    deltaPpa: 0,
    source: "none",
    effectiveCv: Number.NaN,
    effectiveK: Number.NaN,
    effectiveIdMm: Number.NaN,
  };
}

/** Convenience wrapper for solver call-sites that only need the Pa figure. */
export function valveDeltaP(
  node: EngineNode,
  qM3s: number,
  fluid: EngineFluid,
): number {
  return valveLoss(node, qM3s, fluid).deltaPpa;
}

function pickNumber(...candidates: unknown[]): number {
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) return c;
  }
  return Number.NaN;
}

function numField(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function numOrNaN(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : Number.NaN;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

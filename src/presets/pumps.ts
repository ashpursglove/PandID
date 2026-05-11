/**
 * Representative centrifugal pump curves grouped by duty tier. Tier feeds the
 * first stage of the two-step picker in the inspector; the second stage shows
 * the individual rating you want to load.
 *
 * Each entry stores the rated point (Q,H), shutoff head, and a sampled curve.
 * Curves use {@link synthesizeCentrifugalCurve} so they all share the same
 * shape — that keeps the analysis output predictable while still spanning the
 * realistic range users want to design around.
 */

import type { PumpCurvePoint } from "@/engine/types";

export type PumpTierId =
  | "light"
  | "medium"
  | "large"
  | "boost"
  | "hvac";

export const PUMP_TIER_OPTIONS: { id: PumpTierId; label: string }[] = [
  { id: "light", label: "Light process (≤25 m³/h)" },
  { id: "medium", label: "Medium process (25–100 m³/h)" },
  { id: "large", label: "Large process (≥100 m³/h)" },
  { id: "boost", label: "High-head booster / multistage" },
  { id: "hvac", label: "HVAC / circulation" },
];

export interface PumpPresetValues {
  ratedHeadM: number;
  ratedFlowM3H: number;
  shutoffHeadM: number;
  curve: PumpCurvePoint[];
}

export interface PumpPreset {
  id: string;
  label: string;
  tier: PumpTierId;
  values: PumpPresetValues;
}

/**
 * Build a smooth, monotonically decreasing centrifugal-style curve from the
 * rated point. The curve is parameterised as
 *
 *   H(Q) = H_shutoff · (1 − (Q / Q_max)^n)
 *
 * where Q_max is fixed at 1.5 × Q_rated (typical runout location) and the
 * exponent `n` is solved so the curve passes through (Q_rated, H_rated).
 *
 * The result is sampled at seven points from 0 to Q_max so it plots cleanly in
 * the analysis tab without anyone having to draw a curve by hand.
 */
export function synthesizeCentrifugalCurve(
  ratedQ: number,
  ratedH: number,
  shutoffH?: number,
  samples = 7,
): PumpCurvePoint[] {
  const safeQ = Math.max(ratedQ, 0.01);
  const safeH = Math.max(ratedH, 0.01);
  const shutoff = Math.max(shutoffH ?? safeH * 1.25, safeH * 1.05);
  const Qmax = safeQ * 1.5;
  // headRatio = 1 - H_rated / H_shutoff, must be in (0,1).
  const headRatio = 1 - safeH / shutoff;
  // (Qr/Qmax)^n = headRatio  =>  n = log(headRatio) / log(Qr/Qmax)
  const ratio = safeQ / Qmax; // < 1 by construction
  const exponent =
    Math.log(headRatio) / Math.log(ratio);

  const out: PumpCurvePoint[] = [];
  for (let i = 0; i < samples; i++) {
    const q = (i / (samples - 1)) * Qmax;
    const h = shutoff * (1 - Math.pow(q / Qmax, exponent));
    out.push({
      q: roundTo(q, q < 10 ? 2 : 1),
      h: roundTo(Math.max(0, h), 2),
    });
  }
  return out;
}

function roundTo(x: number, decimals: number): number {
  const k = Math.pow(10, decimals);
  return Math.round(x * k) / k;
}

/** Build a `PumpPreset` from a compact catalogue row. */
function preset(
  id: string,
  tier: PumpTierId,
  ratedFlowM3H: number,
  ratedHeadM: number,
  description: string,
  opts: { shutoffHeadM?: number } = {},
): PumpPreset {
  const shutoffHeadM =
    opts.shutoffHeadM ?? Math.round(ratedHeadM * 1.25 * 10) / 10;
  return {
    id,
    tier,
    label: `${ratedFlowM3H} m³/h @ ${ratedHeadM} m — ${description}`,
    values: {
      ratedFlowM3H,
      ratedHeadM,
      shutoffHeadM,
      curve: synthesizeCentrifugalCurve(ratedFlowM3H, ratedHeadM, shutoffHeadM),
    },
  };
}

export const PUMP_PRESETS: PumpPreset[] = [
  // Light process pumps (≤25 m³/h)
  preset("light-5-25", "light", 5, 25, "lab / skid duty"),
  preset("light-10-15", "light", 10, 15, "small end-suction"),
  preset("light-10-40", "light", 10, 40, "small high-head"),
  preset("light-15-20", "light", 15, 20, "transfer pump"),
  preset("light-20-30", "light", 20, 30, "process feed"),
  preset("light-25-50", "light", 25, 50, "small high-head transfer"),

  // Medium process (25–100 m³/h)
  preset("med-30-25", "medium", 30, 25, "process transfer"),
  preset("med-40-40", "medium", 40, 40, "mid-pressure process"),
  preset("med-50-30", "medium", 50, 30, "general process duty"),
  preset("med-60-60", "medium", 60, 60, "boiler feed (small)"),
  preset("med-80-25", "medium", 80, 25, "low-head transfer"),
  preset("med-100-50", "medium", 100, 50, "process workhorse"),

  // Large process (≥100 m³/h)
  preset("large-150-30", "large", 150, 30, "low-head bulk transfer"),
  preset("large-150-80", "large", 150, 80, "high-pressure process"),
  preset("large-200-50", "large", 200, 50, "large base-load"),
  preset("large-300-40", "large", 300, 40, "raw-water / cooling tower"),
  preset("large-400-60", "large", 400, 60, "main process loop"),
  preset("large-500-80", "large", 500, 80, "main feed pump"),

  // High-head boosters / multistage
  preset("boost-15-100", "boost", 15, 100, "skid booster"),
  preset("boost-25-80", "boost", 25, 80, "multistage booster"),
  preset("boost-50-150", "boost", 50, 150, "boiler feed / RO"),
  preset("boost-100-200", "boost", 100, 200, "high-pressure injection"),

  // HVAC / chilled-water / heating
  preset("hvac-30-8", "hvac", 30, 8, "small heating loop"),
  preset("hvac-75-10", "hvac", 75, 10, "secondary chilled-water"),
  preset("hvac-150-12", "hvac", 150, 12, "primary chilled-water"),
  preset("hvac-300-18", "hvac", 300, 18, "large chilled-water"),
  preset("hvac-500-25", "hvac", 500, 25, "district heating"),
];

export function pumpPresetsForTier(tier: PumpTierId): PumpPreset[] {
  return PUMP_PRESETS.filter((p) => p.tier === tier);
}

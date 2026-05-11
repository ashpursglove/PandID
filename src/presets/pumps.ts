/**
 * Representative centrifugal pump curves. Tier groups the duty for a two-step
 * picker in the inspector.
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
  { id: "boost", label: "High-head booster" },
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

export const PUMP_PRESETS: PumpPreset[] = [
  {
    id: "small-cent-10-15",
    tier: "light",
    label: "10 m³/h @ 15 m (small end-suction)",
    values: {
      ratedFlowM3H: 10,
      ratedHeadM: 15,
      shutoffHeadM: 20,
      curve: [
        { q: 0, h: 20 },
        { q: 5, h: 18.8 },
        { q: 10, h: 15 },
        { q: 15, h: 9 },
        { q: 20, h: 0 },
      ],
    },
  },
  {
    id: "boost-25-80",
    tier: "boost",
    label: "25 m³/h @ 80 m (multistage / high-head)",
    values: {
      ratedFlowM3H: 25,
      ratedHeadM: 80,
      shutoffHeadM: 105,
      curve: [
        { q: 0, h: 105 },
        { q: 12, h: 95 },
        { q: 25, h: 80 },
        { q: 40, h: 45 },
        { q: 55, h: 0 },
      ],
    },
  },
  {
    id: "med-cent-50-30",
    tier: "medium",
    label: "50 m³/h @ 30 m (general process)",
    values: {
      ratedFlowM3H: 50,
      ratedHeadM: 30,
      shutoffHeadM: 42,
      curve: [
        { q: 0, h: 42 },
        { q: 25, h: 39 },
        { q: 50, h: 30 },
        { q: 75, h: 18 },
        { q: 100, h: 0 },
      ],
    },
  },
  {
    id: "large-cent-200-50",
    tier: "large",
    label: "200 m³/h @ 50 m (large base-load)",
    values: {
      ratedFlowM3H: 200,
      ratedHeadM: 50,
      shutoffHeadM: 65,
      curve: [
        { q: 0, h: 65 },
        { q: 100, h: 60 },
        { q: 200, h: 50 },
        { q: 300, h: 30 },
        { q: 400, h: 0 },
      ],
    },
  },
  {
    id: "circ-150-12",
    tier: "hvac",
    label: "150 m³/h @ 12 m (heating / chilled-water loop)",
    values: {
      ratedFlowM3H: 150,
      ratedHeadM: 12,
      shutoffHeadM: 18,
      curve: [
        { q: 0, h: 18 },
        { q: 75, h: 16 },
        { q: 150, h: 12 },
        { q: 225, h: 6 },
        { q: 300, h: 0 },
      ],
    },
  },
];

export function pumpPresetsForTier(tier: PumpTierId): PumpPreset[] {
  return PUMP_PRESETS.filter((p) => p.tier === tier);
}

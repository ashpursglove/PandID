/**
 * Common process fluids with density and dynamic viscosity at typical operating
 * temperatures. Values from NIST / engineering references. `category` drives the
 * two-step picker in Analysis.
 */

import type { Fluid } from "@/store/projectStore";

export type FluidCategoryId =
  | "water"
  | "brine"
  | "hydrocarbon"
  | "chemical"
  | "gas";

export const FLUID_CATEGORY_OPTIONS: { id: FluidCategoryId; label: string }[] = [
  { id: "water", label: "Water & brine" },
  { id: "brine", label: "Glycols & thermal fluids" },
  { id: "hydrocarbon", label: "Hydrocarbons" },
  { id: "chemical", label: "Chemicals" },
  { id: "gas", label: "Gases" },
];

export interface FluidPreset {
  id: string;
  category: FluidCategoryId;
  label: string;
  values: Omit<Fluid, "id" | "presetCategory" | "presetId">;
}

export const FLUID_PRESETS: FluidPreset[] = [
  {
    id: "water-20",
    category: "water",
    label: "Water (20 °C)",
    values: { name: "Water (20 °C)", densityKgM3: 998.2, viscosityPaS: 1.002e-3, temperatureC: 20 },
  },
  {
    id: "water-60",
    category: "water",
    label: "Water (60 °C)",
    values: { name: "Water (60 °C)", densityKgM3: 983.2, viscosityPaS: 4.66e-4, temperatureC: 60 },
  },
  {
    id: "water-90",
    category: "water",
    label: "Hot water (90 °C)",
    values: { name: "Water (90 °C)", densityKgM3: 965.3, viscosityPaS: 3.15e-4, temperatureC: 90 },
  },
  {
    id: "seawater-15",
    category: "water",
    label: "Seawater (15 °C)",
    values: { name: "Seawater (15 °C)", densityKgM3: 1025, viscosityPaS: 1.22e-3, temperatureC: 15 },
  },
  {
    id: "pg50-20",
    category: "brine",
    label: "Propylene glycol 50/50 (20 °C)",
    values: { name: "PG 50/50 (20 °C)", densityKgM3: 1040, viscosityPaS: 6.5e-3, temperatureC: 20 },
  },
  {
    id: "eg50-20",
    category: "brine",
    label: "Ethylene glycol 50/50 (20 °C)",
    values: { name: "EG 50/50 (20 °C)", densityKgM3: 1066, viscosityPaS: 4.8e-3, temperatureC: 20 },
  },
  {
    id: "diesel-20",
    category: "hydrocarbon",
    label: "Diesel (20 °C)",
    values: { name: "Diesel (20 °C)", densityKgM3: 832, viscosityPaS: 2.4e-3, temperatureC: 20 },
  },
  {
    id: "kerosene-20",
    category: "hydrocarbon",
    label: "Kerosene (20 °C)",
    values: { name: "Kerosene (20 °C)", densityKgM3: 810, viscosityPaS: 1.6e-3, temperatureC: 20 },
  },
  {
    id: "crude-light-20",
    category: "hydrocarbon",
    label: "Crude oil — light (20 °C)",
    values: { name: "Crude oil (light, 20 °C)", densityKgM3: 850, viscosityPaS: 5e-3, temperatureC: 20 },
  },
  {
    id: "crude-heavy-20",
    category: "hydrocarbon",
    label: "Crude oil — heavy (20 °C)",
    values: { name: "Crude oil (heavy, 20 °C)", densityKgM3: 920, viscosityPaS: 100e-3, temperatureC: 20 },
  },
  {
    id: "glycerine-20",
    category: "chemical",
    label: "Glycerine (20 °C)",
    values: { name: "Glycerine (20 °C)", densityKgM3: 1260, viscosityPaS: 1.41, temperatureC: 20 },
  },
  {
    id: "air-stp",
    category: "gas",
    label: "Air (20 °C, ~1 atm)",
    values: { name: "Air (20 °C)", densityKgM3: 1.204, viscosityPaS: 1.81e-5, temperatureC: 20 },
  },
];

export function fluidPresetsForCategory(
  category: FluidCategoryId | "",
): FluidPreset[] {
  if (!category) return FLUID_PRESETS;
  return FLUID_PRESETS.filter((f) => f.category === category);
}

/**
 * Common cable / conductor presets for the electrical SLD.
 *
 * Picking a preset stamps a sensible conductor make-up (cores, with/without
 * neutral & earth) and material/insulation onto a feeder. The cross-sectional
 * area (CSA) is chosen separately from `STANDARD_CSA` for sized cables; data
 * and signal cables have a fixed make-up so their CSA selector is hidden.
 */

import type { ConnectionType, ElecEdgeData } from "@/electrical/types";

export type Cable = NonNullable<ElecEdgeData["cable"]>;

export type CableKind = "power" | "dc" | "signal" | "earth";

export interface CablePreset {
  id: string;
  label: string;
  kind: CableKind;
  /** Sub-group used for <optgroup> headings in the dropdown. */
  group: string;
  cores?: number;
  /** Short conductor make-up shown in the inspector / cable schedule. */
  conductors?: string;
  material?: "copper" | "aluminium";
  insulation?: "PVC" | "XLPE";
  /** Fixed-construction cables (CAT6, coax, fibre…) hide the CSA selector. */
  fixedSize?: boolean;
  note?: string;
}

/** Standard conductor cross-sectional areas (mm²). */
export const STANDARD_CSA = [
  1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400,
  500, 630,
];

/**
 * Standard "available" rated currents (A) for protective devices — MCBs / MCCBs
 * / ACBs / switch-disconnectors etc. Roughly the IEC 60898 / 60947 preferred
 * frame & trip values. Used to drive the rated-current dropdown in the inspector
 * and the breaker auto-sizing pass.
 */
export const STANDARD_DEVICE_RATINGS_A = [
  6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500,
  630, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000,
];

export const CABLE_PRESETS: CablePreset[] = [
  /* ------------------------------- AC power ------------------------------ */
  {
    id: "ac-1p-ln",
    label: "Single-phase, 2 core (L + N)",
    kind: "power",
    group: "Single-phase",
    cores: 2,
    conductors: "L+N (2C)",
    material: "copper",
    insulation: "XLPE",
  },
  {
    id: "ac-1p-lne",
    label: "Single-phase + earth, 3 core (L + N + E)",
    kind: "power",
    group: "Single-phase",
    cores: 3,
    conductors: "L+N+E (3C)",
    material: "copper",
    insulation: "XLPE",
  },
  {
    id: "ac-3p-3",
    label: "Three-phase, 3 core (3L)",
    kind: "power",
    group: "Three-phase",
    cores: 3,
    conductors: "3L (3C)",
    material: "copper",
    insulation: "XLPE",
  },
  {
    id: "ac-3p-e",
    label: "Three-phase + earth, 4 core (3L + E)",
    kind: "power",
    group: "Three-phase",
    cores: 4,
    conductors: "3L+E (4C)",
    material: "copper",
    insulation: "XLPE",
  },
  {
    id: "ac-3p-n",
    label: "Three-phase + neutral, 4 core (3L + N)",
    kind: "power",
    group: "Three-phase",
    cores: 4,
    conductors: "3L+N (4C)",
    material: "copper",
    insulation: "XLPE",
  },
  {
    id: "ac-3p-npe",
    label: "Three-phase + neutral + earth, 5 core (3L + N + E)",
    kind: "power",
    group: "Three-phase",
    cores: 5,
    conductors: "3L+N+E (5C)",
    material: "copper",
    insulation: "XLPE",
  },
  {
    id: "ac-1c",
    label: "Single core (1C) — one cable per conductor",
    kind: "power",
    group: "Single core",
    cores: 1,
    conductors: "1C",
    material: "copper",
    insulation: "XLPE",
  },
  {
    id: "ac-3p-npe-al",
    label: "Three-phase + N + E, 5 core — aluminium",
    kind: "power",
    group: "Aluminium",
    cores: 5,
    conductors: "3L+N+E (5C)",
    material: "aluminium",
    insulation: "XLPE",
  },
  {
    id: "ac-1c-al",
    label: "Single core (1C) — aluminium",
    kind: "power",
    group: "Aluminium",
    cores: 1,
    conductors: "1C",
    material: "aluminium",
    insulation: "XLPE",
  },

  /* --------------------------------- DC ---------------------------------- */
  {
    id: "dc-2c",
    label: "DC, 2 core (+ / −)",
    kind: "dc",
    group: "DC",
    cores: 2,
    conductors: "+/− (2C)",
    material: "copper",
    insulation: "XLPE",
  },
  {
    id: "dc-2c-e",
    label: "DC, 2 core + earth (+ / − + E)",
    kind: "dc",
    group: "DC",
    cores: 3,
    conductors: "+/−+E (3C)",
    material: "copper",
    insulation: "XLPE",
  },
  {
    id: "dc-1c",
    label: "DC single core (1C)",
    kind: "dc",
    group: "DC",
    cores: 1,
    conductors: "1C",
    material: "copper",
    insulation: "XLPE",
  },

  /* -------------------------------- earth -------------------------------- */
  {
    id: "earth-1c",
    label: "Earth conductor, green/yellow (1C)",
    kind: "earth",
    group: "Earthing",
    cores: 1,
    conductors: "E (1C)",
    material: "copper",
    insulation: "PVC",
  },
  {
    id: "earth-bare",
    label: "Bare copper earth / CPC (1C)",
    kind: "earth",
    group: "Earthing",
    cores: 1,
    conductors: "E (bare)",
    material: "copper",
    insulation: "PVC",
  },
  {
    id: "earth-strap",
    label: "Earth bonding strap",
    kind: "earth",
    group: "Earthing",
    cores: 1,
    conductors: "bond",
    material: "copper",
    fixedSize: true,
    note: "Flat tinned-copper bonding strap for equipotential bonding.",
  },

  /* ----------------------------- signal / data --------------------------- */
  {
    id: "cat5e",
    label: "CAT5e U/UTP (4 pair)",
    kind: "signal",
    group: "Data & network",
    cores: 8,
    conductors: "4 pair",
    fixedSize: true,
    note: "Ethernet up to 1 Gbit/s. 100 m channel maximum.",
  },
  {
    id: "cat6",
    label: "CAT6 U/UTP (4 pair)",
    kind: "signal",
    group: "Data & network",
    cores: 8,
    conductors: "4 pair",
    fixedSize: true,
    note: "Gigabit / short-run 10G Ethernet. 100 m channel maximum.",
  },
  {
    id: "cat6a",
    label: "CAT6A F/UTP (4 pair, screened)",
    kind: "signal",
    group: "Data & network",
    cores: 8,
    conductors: "4 pair + screen",
    fixedSize: true,
    note: "10 Gbit/s Ethernet to 100 m. Foil-screened pairs.",
  },
  {
    id: "fibre-om3",
    label: "Fibre optic — multimode OM3",
    kind: "signal",
    group: "Data & network",
    fixedSize: true,
    note: "Laser-optimised 50/125 µm multimode fibre.",
  },
  {
    id: "fibre-os2",
    label: "Fibre optic — single-mode OS2",
    kind: "signal",
    group: "Data & network",
    fixedSize: true,
    note: "9/125 µm single-mode fibre for long-distance links.",
  },
  {
    id: "coax-rg6",
    label: "Coaxial RG6 (75 Ω)",
    kind: "signal",
    group: "Coaxial",
    fixedSize: true,
    note: "75 Ω video / CCTV / aerial coax.",
  },
  {
    id: "coax-rg59",
    label: "Coaxial RG59 (75 Ω)",
    kind: "signal",
    group: "Coaxial",
    fixedSize: true,
    note: "75 Ω analogue CCTV coax, shorter runs.",
  },
  {
    id: "belden-9841",
    label: "Belden 9841 — RS-485 (1 pair + screen)",
    kind: "signal",
    group: "Instrumentation & fieldbus",
    cores: 2,
    conductors: "1 pair + screen",
    fixedSize: true,
    note: "120 Ω data pair for RS-485 / Profibus.",
  },
  {
    id: "belden-8760",
    label: "Belden 8760 — instrument (1 pair)",
    kind: "signal",
    group: "Instrumentation & fieldbus",
    cores: 2,
    conductors: "1 pair",
    fixedSize: true,
    note: "18 AWG twisted instrument pair.",
  },
  {
    id: "belden-8723",
    label: "Belden 8723 — instrument (2 pair, screened)",
    kind: "signal",
    group: "Instrumentation & fieldbus",
    cores: 4,
    conductors: "2 pair + screen",
    fixedSize: true,
    note: "Individually-screened twisted pairs.",
  },
  {
    id: "inst-1pr",
    label: "Instrumentation — 1 pair + overall screen",
    kind: "signal",
    group: "Instrumentation & fieldbus",
    cores: 2,
    conductors: "1 pair + screen",
    fixedSize: true,
    note: "4–20 mA / analogue signal pair.",
  },
  {
    id: "inst-mpr",
    label: "Instrumentation — multipair + screen",
    kind: "signal",
    group: "Instrumentation & fieldbus",
    fixedSize: true,
    note: "Collective and/or individually screened multipair.",
  },
  {
    id: "profibus",
    label: "Profibus DP (purple)",
    kind: "signal",
    group: "Instrumentation & fieldbus",
    cores: 2,
    conductors: "1 pair + screen",
    fixedSize: true,
    note: "Profibus DP fieldbus, one screened data pair.",
  },
  {
    id: "modbus",
    label: "Modbus / RS-485 twisted pair",
    kind: "signal",
    group: "Instrumentation & fieldbus",
    cores: 2,
    conductors: "1 pair + screen",
    fixedSize: true,
    note: "Screened twisted pair for Modbus RTU.",
  },
  {
    id: "tc-k",
    label: "Thermocouple extension — Type K",
    kind: "signal",
    group: "Instrumentation & fieldbus",
    cores: 2,
    conductors: "1 pair",
    fixedSize: true,
    note: "Compensating cable for Type K thermocouples.",
  },
  {
    id: "ctrl-7c",
    label: "Multicore control — 7 core",
    kind: "signal",
    group: "Control multicore",
    cores: 7,
    conductors: "7C",
    material: "copper",
    insulation: "PVC",
  },
  {
    id: "ctrl-12c",
    label: "Multicore control — 12 core",
    kind: "signal",
    group: "Control multicore",
    cores: 12,
    conductors: "12C",
    material: "copper",
    insulation: "PVC",
  },
  {
    id: "ctrl-19c",
    label: "Multicore control — 19 core",
    kind: "signal",
    group: "Control multicore",
    cores: 19,
    conductors: "19C",
    material: "copper",
    insulation: "PVC",
  },
];

const PRESET_BY_ID = new Map(CABLE_PRESETS.map((p) => [p.id, p]));

export function getCablePreset(id: string | undefined): CablePreset | undefined {
  return id ? PRESET_BY_ID.get(id) : undefined;
}

export function kindForConnection(ct: ConnectionType): CableKind {
  switch (ct) {
    case "lv-power":
    case "mv-power":
      return "power";
    case "dc-power":
      return "dc";
    case "control":
      return "signal";
    case "earth":
      return "earth";
    default:
      return "power";
  }
}

export function presetsForConnection(ct: ConnectionType): CablePreset[] {
  const kind = kindForConnection(ct);
  return CABLE_PRESETS.filter((p) => p.kind === kind);
}

/** Presets for a connection type, grouped by their `group` for <optgroup>s. */
export function groupedPresetsForConnection(
  ct: ConnectionType,
): { group: string; presets: CablePreset[] }[] {
  const out: { group: string; presets: CablePreset[] }[] = [];
  for (const p of presetsForConnection(ct)) {
    let bucket = out.find((b) => b.group === p.group);
    if (!bucket) {
      bucket = { group: p.group, presets: [] };
      out.push(bucket);
    }
    bucket.presets.push(p);
  }
  return out;
}

/** Build a cable spec from a preset, preserving carry-over fields from `prev`. */
export function cableFromPreset(preset: CablePreset, prev: Cable = {}): Cable {
  const c: Cable = { ...prev, presetId: preset.id };
  if (preset.cores != null) c.cores = preset.cores;
  if (preset.material) c.material = preset.material;
  if (preset.insulation) c.insulation = preset.insulation;
  if (preset.fixedSize) {
    c.csaMm2 = undefined;
  } else if (c.csaMm2 == null) {
    c.csaMm2 = 2.5;
  }
  if (c.parallelRuns == null) c.parallelRuns = 1;
  if (c.lengthM == null) c.lengthM = 0;
  return c;
}

/** Factory default feeder: 3-phase + neutral + earth, 2.5 mm² copper XLPE. */
export const DEFAULT_POWER_CABLE: Cable = cableFromPreset(
  getCablePreset("ac-3p-npe")!,
);

/**
 * Compact human-readable cable spec for on-diagram labels, e.g.
 * "3L+N+E (5C) × 2.5 mm² Cu XLPE" for sized cables, or the conductor make-up
 * (e.g. "4 pair") for fixed-build data/signal cables.
 */
export function cableSpecLabel(cable: Cable | undefined): string {
  if (!cable) return "";
  const preset = getCablePreset(cable.presetId);
  const cores = cable.cores;
  const conductors = preset?.conductors ?? (cores != null ? `${cores}C` : "");
  if (preset?.fixedSize || cable.csaMm2 == null) {
    return conductors || preset?.label || "";
  }
  const material = cable.material === "aluminium" ? "Al" : "Cu";
  const insulation = cable.insulation ?? "XLPE";
  const runs = cable.parallelRuns && cable.parallelRuns > 1 ? `${cable.parallelRuns} × ` : "";
  const left = conductors ? `${conductors} × ` : "";
  return `${runs}${left}${cable.csaMm2} mm² ${material} ${insulation}`.trim();
}

/** A sensible default cable for a freshly drawn feeder of the given type. */
export function defaultCableForConnection(ct: ConnectionType): Cable {
  switch (kindForConnection(ct)) {
    case "dc":
      return cableFromPreset(getCablePreset("dc-2c-e")!);
    case "signal":
      return cableFromPreset(getCablePreset("cat6")!);
    case "earth":
      return cableFromPreset(getCablePreset("earth-1c")!);
    case "power":
    default:
      return { ...DEFAULT_POWER_CABLE };
  }
}

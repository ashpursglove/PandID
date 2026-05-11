/**
 * Representative valve Cv values for fully-open valves across the common
 * nominal sizes. Numbers are order-of-magnitude correct (Crane TP-410 / vendor
 * datasheets) and meant as a sensible starting point; refine in the inspector
 * for specific products.
 */

export interface ValvePresetValues {
  Cv: number;
  openFraction?: number;
}

export interface ValvePreset {
  id: string;
  nominalId: string;
  label: string;
  values: ValvePresetValues;
}

interface ValveTable {
  prefix: string;
  family: string;
  sizes: { dn: string; cv: number }[];
}

/** Standard DN list used as the "spine" for every valve family. */
const STANDARD_DN = [
  "DN15",
  "DN20",
  "DN25",
  "DN40",
  "DN50",
  "DN80",
  "DN100",
  "DN150",
  "DN200",
  "DN250",
  "DN300",
];

/**
 * Build a Cv table for a valve family from a base Cv at DN50 and an exponent
 * that captures how Cv scales with size. Real valves don't follow a clean power
 * law, but Cv ∝ d^n with n≈2 is a useful first pass for sizing estimates.
 */
function family(
  prefix: string,
  name: string,
  cvAtDn50: number,
  exponent = 2,
): ValveTable {
  return {
    prefix,
    family: name,
    sizes: STANDARD_DN.map((dn) => {
      const dnNum = Number.parseInt(dn.replace(/\D/g, ""), 10);
      const ratio = dnNum / 50;
      const cv = Math.round(cvAtDn50 * Math.pow(ratio, exponent) * 10) / 10;
      return { dn, cv };
    }),
  };
}

const TABLES: Record<string, ValveTable> = {
  "gate-valve": family("gate", "Gate valve", 90),
  "globe-valve": family("globe", "Globe valve", 25),
  "ball-valve": family("ball", "Ball valve", 120),
  "butterfly-valve": family("bfv", "Butterfly valve", 200),
  "plug-valve": family("plug", "Plug valve", 100),
  "diaphragm-valve": family("dpv", "Diaphragm valve", 30),
  "pinch-valve": family("pnv", "Pinch valve", 35),
  "needle-valve": family("nv", "Needle valve", 1.5),
  "angle-valve": family("av", "Angle valve", 20),
  "three-way-valve": family("3wv", "Three-way valve", 80),
  "hand-valve": family("hv", "Hand valve (generic)", 50),
  "check-valve": family("check", "Swing check valve", 55),
  "lift-check-valve": family("lift", "Lift check valve", 25),
  "foot-valve": family("foot", "Foot valve", 35),
  "control-valve": family("control", "Control valve (linear)", 40),
  "solenoid-valve": family("sol", "Solenoid valve", 5),
  "motor-operated-valve": family("mov", "Motor-operated valve", 100),
  "pressure-regulator": family("pcv", "Pressure regulator", 20),
  "relief-valve": {
    prefix: "psv",
    family: "Relief valve",
    sizes: [
      { dn: "DN15", cv: 5 },
      { dn: "DN25", cv: 15 },
      { dn: "DN40", cv: 35 },
      { dn: "DN50", cv: 60 },
      { dn: "DN80", cv: 130 },
    ],
  },
};

export const VALVE_PRESETS: Record<string, ValvePreset[]> = Object.fromEntries(
  Object.entries(TABLES).map(([key, table]) => [
    key,
    table.sizes.map((s) => ({
      id: `${table.prefix}-${s.dn}`,
      nominalId: s.dn,
      label: `${s.dn} — ${table.family}, Cv ≈ ${s.cv}`,
      values: { Cv: s.cv, openFraction: 1 },
    })),
  ]),
);

/** Unique nominal sizes (DN…) across all valve tables, sorted. */
export const VALVE_NOMINAL_ALL: string[] = (() => {
  const set = new Set<string>();
  for (const table of Object.values(TABLES)) {
    for (const s of table.sizes) set.add(s.dn);
  }
  return [...set].sort((a, b) => {
    const na = Number.parseInt(a.replace(/\D/g, ""), 10);
    const nb = Number.parseInt(b.replace(/\D/g, ""), 10);
    return na - nb || a.localeCompare(b);
  });
})();

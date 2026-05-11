/**
 * Representative valve Cv values for fully-open / typical sizes. Numbers are
 * order-of-magnitude correct (Crane TP-410 / vendor data) and intended to give
 * a sensible starting point. Refine in the inspector for specific products.
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

const TABLES: Record<string, ValveTable> = {
  "gate-valve": {
    prefix: "gate",
    family: "Gate valve",
    sizes: [
      { dn: "DN15", cv: 12 },
      { dn: "DN25", cv: 30 },
      { dn: "DN50", cv: 90 },
      { dn: "DN80", cv: 200 },
      { dn: "DN100", cv: 350 },
      { dn: "DN150", cv: 700 },
    ],
  },
  "globe-valve": {
    prefix: "globe",
    family: "Globe valve",
    sizes: [
      { dn: "DN15", cv: 4 },
      { dn: "DN25", cv: 9 },
      { dn: "DN50", cv: 25 },
      { dn: "DN80", cv: 60 },
      { dn: "DN100", cv: 110 },
      { dn: "DN150", cv: 240 },
    ],
  },
  "ball-valve": {
    prefix: "ball",
    family: "Ball valve",
    sizes: [
      { dn: "DN15", cv: 14 },
      { dn: "DN25", cv: 38 },
      { dn: "DN50", cv: 120 },
      { dn: "DN80", cv: 280 },
      { dn: "DN100", cv: 500 },
      { dn: "DN150", cv: 1100 },
    ],
  },
  "check-valve": {
    prefix: "check",
    family: "Check valve (swing)",
    sizes: [
      { dn: "DN15", cv: 6 },
      { dn: "DN25", cv: 18 },
      { dn: "DN50", cv: 55 },
      { dn: "DN80", cv: 120 },
      { dn: "DN100", cv: 220 },
      { dn: "DN150", cv: 480 },
    ],
  },
  "control-valve": {
    prefix: "control",
    family: "Control valve (linear)",
    sizes: [
      { dn: "DN15", cv: 4 },
      { dn: "DN25", cv: 12 },
      { dn: "DN50", cv: 40 },
      { dn: "DN80", cv: 110 },
      { dn: "DN100", cv: 180 },
      { dn: "DN150", cv: 360 },
    ],
  },
  "relief-valve": {
    prefix: "psv",
    family: "Relief valve",
    sizes: [
      { dn: "DN15", cv: 5 },
      { dn: "DN25", cv: 15 },
      { dn: "DN50", cv: 60 },
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

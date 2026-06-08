/**
 * Cable physics shared by the cable schedule and the SLD validator.
 *
 * Everything here is approximate, IEC-flavoured engineering — good enough to
 * size conductors, flag undersized cables and estimate volt drop / operating
 * temperature, but not a substitute for a full BS 7671 / IEC 60364 calc with
 * grouping, ambient and installation-method derating.
 */

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export interface CableSpec {
  csaMm2?: number;
  cores?: number;
  material?: string;
  insulation?: string;
  lengthM?: number;
  parallelRuns?: number;
}

/* ------------------------------- ampacity ------------------------------- */

// Base copper, PVC-insulated, single circuit (~IEC method C), in amps.
const AMP_BASE: [number, number][] = [
  [1, 14],
  [1.5, 18],
  [2.5, 25],
  [4, 34],
  [6, 43],
  [10, 60],
  [16, 80],
  [25, 101],
  [35, 126],
  [50, 153],
  [70, 196],
  [95, 238],
  [120, 276],
  [150, 319],
  [185, 364],
  [240, 430],
  [300, 497],
];

function baseAmp(csa: number): number {
  if (csa <= 0) return 0;
  const t = AMP_BASE;
  if (csa <= t[0][0]) return t[0][1] * (csa / t[0][0]);
  for (let i = 0; i < t.length - 1; i++) {
    const [c0, a0] = t[i];
    const [c1, a1] = t[i + 1];
    if (csa >= c0 && csa <= c1) {
      const f = (csa - c0) / (c1 - c0);
      return a0 + f * (a1 - a0);
    }
  }
  const [cl, al] = t[t.length - 1];
  return al * (csa / cl);
}

/** Approximate continuous current rating (A) for a cable spec. */
export function cableAmpacity(cable: CableSpec): number {
  const csa = num(cable.csaMm2);
  if (csa <= 0) return 0;
  const insMult = cable.insulation === "PVC" ? 1 : 1.28; // XLPE runs hotter
  const matMult = cable.material === "aluminium" ? 0.78 : 1;
  const runs = Math.max(1, num(cable.parallelRuns, 1));
  return baseAmp(csa) * insMult * matMult * runs;
}

/** Max permitted conductor temperature for the insulation (°C). */
export function maxConductorTempC(cable: CableSpec): number {
  return cable.insulation === "PVC" ? 70 : 90;
}

/* ------------------------- resistance / reactance ----------------------- */

// Resistivity at 20 °C (Ω·mm²/m) and temperature coefficient per °C.
const RHO_20 = { copper: 0.0172, aluminium: 0.0282 };
const ALPHA = { copper: 0.00393, aluminium: 0.00403 };
// Typical line reactance for LV cables (Ω/m). Small but matters at low PF.
const REACTANCE_PER_M = 0.00008;
// Reference ambient temperature the ampacity tables assume (°C).
const AMBIENT_C = 30;

/* ------------------------------ analysis -------------------------------- */

export interface CableAnalysisInput {
  cable: CableSpec;
  /** Design (load) current carried by the cable, A. */
  currentA: number;
  phases: 1 | 3;
  powerFactor: number;
  /** Nominal reference voltage for the %-drop (line for 3φ, phase for 1φ). */
  voltageV: number;
}

export interface CableAnalysis {
  ampacityA: number;
  /** Design current ÷ ampacity, %. */
  utilizationPct: number;
  /** Estimated steady-state conductor temperature at the design current, °C. */
  operatingTempC: number;
  maxTempC: number;
  hasLength: boolean;
  /** Total one-way conductor resistance at operating temperature, Ω. */
  resistanceOhm: number | null;
  reactanceOhm: number | null;
  voltageDropV: number | null;
  voltageDropPct: number | null;
}

/**
 * Full per-cable analysis. Length-dependent figures (resistance, reactance,
 * volt drop) come back `null` when no length has been entered; loading figures
 * (ampacity, utilisation, operating temperature) don't need a length and are
 * always computed.
 */
export function analyseCable(input: CableAnalysisInput): CableAnalysis {
  const { cable, currentA, phases, powerFactor, voltageV } = input;
  const csa = num(cable.csaMm2);
  const runs = Math.max(1, num(cable.parallelRuns, 1));
  const length = num(cable.lengthM);
  const material = cable.material === "aluminium" ? "aluminium" : "copper";

  const ampacityA = cableAmpacity(cable);
  const maxTempC = maxConductorTempC(cable);
  const ratio = ampacityA > 0 ? currentA / ampacityA : 0;
  const utilizationPct = ratio * 100;
  // Conductor temperature rises with the square of the loading ratio between
  // ambient and the insulation's rated maximum.
  const operatingTempC = AMBIENT_C + (maxTempC - AMBIENT_C) * ratio * ratio;

  if (length <= 0 || csa <= 0) {
    return {
      ampacityA,
      utilizationPct,
      operatingTempC,
      maxTempC,
      hasLength: false,
      resistanceOhm: null,
      reactanceOhm: null,
      voltageDropV: null,
      voltageDropPct: null,
    };
  }

  const rPerM20 = RHO_20[material] / csa;
  const rPerM = rPerM20 * (1 + ALPHA[material] * (operatingTempC - 20));
  const resistanceOhm = (rPerM * length) / runs;
  const reactanceOhm = (REACTANCE_PER_M * length) / runs;

  const cos = Math.min(1, Math.max(0, powerFactor || 0.85));
  const sin = Math.sqrt(Math.max(0, 1 - cos * cos));
  const k = phases === 1 ? 2 : Math.sqrt(3);
  const voltageDropV =
    k * currentA * (resistanceOhm * cos + reactanceOhm * sin);
  const voltageDropPct = voltageV > 0 ? (voltageDropV / voltageV) * 100 : 0;

  return {
    ampacityA,
    utilizationPct,
    operatingTempC,
    maxTempC,
    hasLength: true,
    resistanceOhm,
    reactanceOhm,
    voltageDropV,
    voltageDropPct,
  };
}

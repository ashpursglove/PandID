/**
 * Pipe presets split into material and nominal size. Inner diameters are
 * approximate Schedule 40 IDs unless noted; roughness from Moody / Crane TP-410.
 */

export interface PipePresetValues {
  innerDiameterMm: number;
  roughnessMm: number;
}

/** Absolute roughness for common pipe materials (mm). */
export const MATERIAL_ROUGHNESS: Record<string, number> = {
  "PVC / HDPE": 0.0015,
  "Drawn copper": 0.0015,
  "Stainless steel": 0.015,
  "Carbon steel (commercial)": 0.046,
  "Galvanised steel": 0.15,
  "Cast iron": 0.26,
  "Concrete": 1.0,
};

export type PipeMaterialId =
  | "pvc"
  | "steel"
  | "ss"
  | "copper"
  | "galv"
  | "ci"
  | "conc";

export const PIPE_MATERIAL_OPTIONS: { id: PipeMaterialId; label: string }[] = [
  { id: "pvc", label: "PVC / HDPE (Sch 40)" },
  { id: "steel", label: "Carbon steel (Sch 40)" },
  { id: "ss", label: "Stainless 316 (Sch 10 approx.)" },
  { id: "copper", label: "Drawn copper" },
  { id: "galv", label: "Galvanised steel" },
  { id: "ci", label: "Cast iron" },
  { id: "conc", label: "Concrete" },
];

interface NominalRow {
  id: string;
  dn: string;
  nps: string;
  steelSch40Id: number;
  pvcSch40Id: number;
}

const NOMINAL: NominalRow[] = [
  { id: "dn15", dn: "DN15", nps: "½″", steelSch40Id: 15.8, pvcSch40Id: 13.8 },
  { id: "dn20", dn: "DN20", nps: "¾″", steelSch40Id: 20.9, pvcSch40Id: 18.0 },
  { id: "dn25", dn: "DN25", nps: "1″", steelSch40Id: 26.6, pvcSch40Id: 24.3 },
  { id: "dn32", dn: "DN32", nps: "1¼″", steelSch40Id: 35.1, pvcSch40Id: 32.5 },
  { id: "dn40", dn: "DN40", nps: "1½″", steelSch40Id: 40.9, pvcSch40Id: 38.1 },
  { id: "dn50", dn: "DN50", nps: "2″", steelSch40Id: 52.5, pvcSch40Id: 49.3 },
  { id: "dn65", dn: "DN65", nps: "2½″", steelSch40Id: 62.7, pvcSch40Id: 58.4 },
  { id: "dn80", dn: "DN80", nps: "3″", steelSch40Id: 77.9, pvcSch40Id: 73.7 },
  { id: "dn100", dn: "DN100", nps: "4″", steelSch40Id: 102.3, pvcSch40Id: 96.5 },
  { id: "dn150", dn: "DN150", nps: "6″", steelSch40Id: 154.1, pvcSch40Id: 146.3 },
  { id: "dn200", dn: "DN200", nps: "8″", steelSch40Id: 202.7, pvcSch40Id: 193.7 },
];

export const PIPE_NOMINAL_OPTIONS = NOMINAL.map((r) => ({
  id: r.id,
  label: `${r.dn} — ${r.nps} NPS`,
}));

export function resolvePipePreset(
  materialId: PipeMaterialId,
  nominalId: string,
): PipePresetValues | null {
  const row = NOMINAL.find((r) => r.id === nominalId);
  if (!row) return null;

  switch (materialId) {
    case "pvc":
      return {
        innerDiameterMm: row.pvcSch40Id,
        roughnessMm: MATERIAL_ROUGHNESS["PVC / HDPE"],
      };
    case "steel":
      return {
        innerDiameterMm: row.steelSch40Id,
        roughnessMm: MATERIAL_ROUGHNESS["Carbon steel (commercial)"],
      };
    case "ss":
      return {
        innerDiameterMm: row.steelSch40Id * 1.05,
        roughnessMm: MATERIAL_ROUGHNESS["Stainless steel"],
      };
    case "copper":
      return {
        innerDiameterMm: row.steelSch40Id * 0.97,
        roughnessMm: MATERIAL_ROUGHNESS["Drawn copper"],
      };
    case "galv":
      return {
        innerDiameterMm: row.steelSch40Id,
        roughnessMm: MATERIAL_ROUGHNESS["Galvanised steel"],
      };
    case "ci":
      return {
        innerDiameterMm: row.steelSch40Id * 1.02,
        roughnessMm: MATERIAL_ROUGHNESS["Cast iron"],
      };
    case "conc":
      return {
        innerDiameterMm: row.steelSch40Id * 1.15,
        roughnessMm: MATERIAL_ROUGHNESS["Concrete"],
      };
    default:
      return null;
  }
}

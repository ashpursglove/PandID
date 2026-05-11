/**
 * Filter / strainer presets keyed off line size + element rating.
 * `K` values are typical clean-element loss coefficients referenced to
 * line velocity. Treat as starting points; vendor curves give the truth.
 */

export interface FilterPresetValues {
  K: number;
  innerDiameterMm: number;
  filtrationMicron?: number;
}

export interface FilterPreset {
  id: string;
  label: string;
  values: FilterPresetValues;
}

interface SizeRow {
  id: string;
  dn: string;
  nps: string;
  idMm: number;
}

const SIZES: SizeRow[] = [
  { id: "dn15", dn: "DN15", nps: "½″", idMm: 15.8 },
  { id: "dn20", dn: "DN20", nps: "¾″", idMm: 20.9 },
  { id: "dn25", dn: "DN25", nps: "1″", idMm: 26.6 },
  { id: "dn40", dn: "DN40", nps: "1½″", idMm: 40.9 },
  { id: "dn50", dn: "DN50", nps: "2″", idMm: 52.5 },
  { id: "dn80", dn: "DN80", nps: "3″", idMm: 77.9 },
  { id: "dn100", dn: "DN100", nps: "4″", idMm: 102.3 },
  { id: "dn150", dn: "DN150", nps: "6″", idMm: 154.1 },
  { id: "dn200", dn: "DN200", nps: "8″", idMm: 202.7 },
];

export const FILTER_SIZE_OPTIONS = SIZES.map((s) => ({
  id: s.id,
  label: `${s.dn} — ${s.nps} NPS`,
}));

/** Mesh / micron ratings offered by the inspector. */
export const FILTER_MESH_OPTIONS = [
  { id: "coarse", label: "Coarse (~600 µm / 30 mesh)", micron: 600 },
  { id: "med", label: "Medium (~150 µm / 100 mesh)", micron: 150 },
  { id: "fine", label: "Fine (~75 µm / 200 mesh)", micron: 75 },
  { id: "p25", label: "25 µm element", micron: 25 },
  { id: "p10", label: "10 µm element", micron: 10 },
  { id: "p5", label: "5 µm absolute", micron: 5 },
  { id: "p1", label: "1 µm absolute", micron: 1 },
];

interface FamilyParams {
  /** Loss coefficient K for the "medium" mesh as a baseline. */
  kBase: number;
  /** Multiplier applied as the mesh gets finer (per step down the list). */
  meshFactor: number;
}

const FAMILY_PARAMS: Record<string, FamilyParams> = {
  "y-strainer": { kBase: 8, meshFactor: 1.3 },
  "t-strainer": { kBase: 6, meshFactor: 1.25 },
  "basket-strainer": { kBase: 3.5, meshFactor: 1.4 },
  "simplex-filter": { kBase: 4, meshFactor: 1.6 },
  "duplex-filter": { kBase: 4.5, meshFactor: 1.6 },
  "bag-filter": { kBase: 6, meshFactor: 1.7 },
  "cartridge-filter": { kBase: 5, meshFactor: 1.8 },
  "sand-filter": { kBase: 10, meshFactor: 1.2 },
};

export const FILTER_PRESETS: Record<string, FilterPreset[]> = Object.fromEntries(
  Object.entries(FAMILY_PARAMS).map(([family, params]) => {
    const presets: FilterPreset[] = [];
    SIZES.forEach((size) => {
      FILTER_MESH_OPTIONS.forEach((mesh, idx) => {
        // Index 0 is coarse, 6 is the finest — pivot around "medium" (index 1).
        const meshSteps = idx - 1;
        const k =
          Math.round(params.kBase * Math.pow(params.meshFactor, meshSteps) * 10) /
          10;
        presets.push({
          id: `${family}-${size.id}-${mesh.id}`,
          label: `${size.dn} — ${mesh.label.split(" ")[0]} (K ≈ ${k})`,
          values: {
            K: k,
            innerDiameterMm: size.idMm,
            filtrationMicron: mesh.micron,
          },
        });
      });
    });
    return [family, presets];
  }),
);

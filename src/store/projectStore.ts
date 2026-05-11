import { create } from "zustand";

export interface ProjectMeta {
  title: string;
  drawingNumber: string;
  drawnBy: string;
  checkedBy: string;
  approvedBy: string;
  date: string;
  scale: string;
  sheet: string;
  totalSheets: string;
  revision: string;
}

export interface Fluid {
  id: string;
  name: string;
  densityKgM3: number;
  viscosityPaS: number;
  temperatureC: number;
  /** Inspector: last fluid preset category / id for two-step preset UI. */
  presetCategory?: string;
  presetId?: string;
}

interface ProjectState {
  filePath: string | null;
  isDirty: boolean;
  meta: ProjectMeta;
  fluids: Fluid[];

  setFilePath: (path: string | null) => void;
  markDirty: () => void;
  markClean: () => void;
  setMeta: (patch: Partial<ProjectMeta>) => void;

  addFluid: (fluid: Fluid) => void;
  updateFluid: (id: string, patch: Partial<Fluid>) => void;
  removeFluid: (id: string) => void;

  /**
   * Replace meta + fluids + path atomically (used by load + new). Resets dirty.
   */
  loadProjectMeta: (input: {
    meta: ProjectMeta;
    fluids: Fluid[];
    filePath: string | null;
  }) => void;

  resetToDefaults: () => void;
}

export function defaultMeta(): ProjectMeta {
  return {
    title: "Untitled Project",
    drawingNumber: "DWG-0001",
    drawnBy: "",
    checkedBy: "",
    approvedBy: "",
    date: new Date().toISOString().slice(0, 10),
    scale: "NTS",
    sheet: "1",
    totalSheets: "1",
    revision: "0",
  };
}

export const DEFAULT_FLUID: Fluid = {
  id: "water-20c",
  name: "Water (20 °C)",
  densityKgM3: 998.2,
  viscosityPaS: 1.002e-3,
  temperatureC: 20,
};

export const useProjectStore = create<ProjectState>((set, get) => ({
  filePath: null,
  isDirty: false,
  meta: defaultMeta(),
  fluids: [DEFAULT_FLUID],

  setFilePath: (path) => set({ filePath: path }),
  markDirty: () => {
    if (!get().isDirty) set({ isDirty: true });
  },
  markClean: () => set({ isDirty: false }),
  setMeta: (patch) =>
    set({ meta: { ...get().meta, ...patch }, isDirty: true }),

  addFluid: (fluid) =>
    set({ fluids: [...get().fluids, fluid], isDirty: true }),
  updateFluid: (id, patch) =>
    set({
      fluids: get().fluids.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      isDirty: true,
    }),
  removeFluid: (id) =>
    set({ fluids: get().fluids.filter((f) => f.id !== id), isDirty: true }),

  loadProjectMeta: ({ meta, fluids, filePath }) =>
    set({ meta, fluids, filePath, isDirty: false }),

  resetToDefaults: () =>
    set({
      meta: defaultMeta(),
      fluids: [DEFAULT_FLUID],
      filePath: null,
      isDirty: false,
    }),
}));

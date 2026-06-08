import { create } from "zustand";

import type { LineType } from "@/types/diagram";

export type AppTab =
  | "editor"
  | "analysis"
  | "drawings"
  | "electrical";

export type AnalysisMode = "forward" | "inverse";

interface UIState {
  tab: AppTab;
  setTab: (tab: AppTab) => void;

  /** Default line type applied to newly drawn connections. */
  activeLineType: LineType;
  setActiveLineType: (lineType: LineType) => void;

  /**
   * Last selections on the Analysis tab. Persisting them in the UI store (not
   * local component state) means tab-switching to the Editor and back doesn't
   * wipe the user's From/To/fluid/mode picks, so re-solving after a tweak is
   * one click away.
   */
  analysisStartId: string;
  analysisEndId: string;
  analysisFluidId: string;
  analysisMode: AnalysisMode;
  analysisTargetQM3h: number;
  setAnalysisSelection: (patch: {
    startId?: string;
    endId?: string;
    fluidId?: string;
    mode?: AnalysisMode;
    targetQM3h?: number;
  }) => void;
}

export const useUIStore = create<UIState>((set) => ({
  tab: "editor",
  setTab: (tab) => set({ tab }),

  activeLineType: "process",
  setActiveLineType: (activeLineType) => set({ activeLineType }),

  analysisStartId: "",
  analysisEndId: "",
  analysisFluidId: "",
  analysisMode: "forward",
  analysisTargetQM3h: 50,
  setAnalysisSelection: (patch) =>
    set((s) => ({
      analysisStartId: patch.startId ?? s.analysisStartId,
      analysisEndId: patch.endId ?? s.analysisEndId,
      analysisFluidId: patch.fluidId ?? s.analysisFluidId,
      analysisMode: patch.mode ?? s.analysisMode,
      analysisTargetQM3h: patch.targetQM3h ?? s.analysisTargetQM3h,
    })),
}));

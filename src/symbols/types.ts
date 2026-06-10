import type { ComponentType } from "react";

import type { LineType, PortDef } from "@/types/diagram";

export type SymbolCategory =
  | "equipment"
  | "valve"
  | "filter"
  | "inline"
  | "instrument"
  | "connector";

/** Forms the schema-driven Inspector form. */
export interface ParamFieldSchema {
  key: string;
  label: string;
  kind: "number" | "text" | "select" | "fittings" | "curve";
  /** Engineering unit, displayed in the inspector after the value. */
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  options?: string[];
  default?: unknown;
  group?: string;
  description?: string;
}

/** Engine model identifier — `solver.ts` dispatches on this string. */
export type EngineModel =
  | "pump"
  | "pipe"
  | "fitting"
  | "valve"
  | "vessel"
  | "instrument"
  | "passive";

/**
 * Static, type-level hydraulic defaults — used by the engine to auto-size a
 * component to whatever pipe size it's wired into when the user hasn't
 * explicitly set Cv / K / ΔP. Looked up via the symbol registry.
 *
 * Sensible defaults (Crane TP-410 / Perry's order of magnitude):
 * - gate / ball — K ≈ 0.05–0.2 (essentially full-port)
 * - butterfly — K ≈ 0.6–1.0
 * - globe — K ≈ 6
 * - swing check — K ≈ 2; lift check — K ≈ 8; foot — K ≈ 13
 * - y-strainer (clean) — K ≈ 1.5; basket — K ≈ 3; bag — K ≈ 10
 * - shell&tube HX — ΔP ≈ 0.3 bar (tube side, full pass)
 */
export interface HydraulicsHint {
  /** Which formula the loss is built from. */
  lossModel?: "k" | "cv" | "deltaP" | "none";
  /** Default loss coefficient K (used when neither K nor Cv is in params). */
  defaultK?: number;
  /** Default Cv (used when params has no Cv but the loss model is Cv-based). */
  defaultCv?: number;
  /** Default fixed pressure drop in bar (e.g. HX tube-side). */
  defaultDeltaPbar?: number;
  /** True for non-return valves — additionally applies cracking pressure. */
  isCheck?: boolean;
}

export interface SymbolIconProps {
  width: number;
  height: number;
  selected?: boolean;
}

export interface SymbolDef {
  /** Registry key, e.g. "centrifugal-pump". Must be stable across versions. */
  type: string;
  category: SymbolCategory;
  /** Sub-grouping inside a category (e.g. "Pumps", "Compressors") for the
   *  palette tree. Symbols without a subcategory go into a default group. */
  subcategory?: string;
  /** Palette label. */
  label: string;
  description?: string;
  /** Display size on the canvas (px). */
  size: { width: number; height: number };
  /** Connection ports around the bounding box. */
  ports: PortDef[];
  /** Tag prefix for auto-numbering, e.g. "P", "V", "E", "T". */
  tagPrefix?: string;
  /** SVG renderer. */
  Icon: ComponentType<SymbolIconProps>;
  /** Inspector form fields. */
  paramSchema?: ParamFieldSchema[];
  /** Engine model dispatch key. */
  engineModel?: EngineModel;
  /** Initial `data.params` when this symbol is dropped onto the canvas. */
  defaultParams?: Record<string, unknown>;
  /** Default tag label shown under the symbol. */
  defaultLabel?: string;
  /** Static type-level hydraulic defaults — fall-backs when the user hasn't
   *  explicitly set Cv / K / ΔP on the node. */
  hydraulics?: HydraulicsHint;
  /** Connectors are skipped from the BOM by default (tap points, off-page
   *  refs…). Set this true for connector-category parts that ARE real,
   *  purchaseable items — e.g. a pipe tee — so they're listed. */
  countInBom?: boolean;
}

/** Visual style applied to an edge depending on its `lineType`. */
export interface LineStyleDef {
  type: LineType;
  label: string;
  description: string;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  /** Optional overlay pattern drawn along the edge (// hashes for pneumatic). */
  pattern?: "hash" | null;
}

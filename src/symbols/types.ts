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

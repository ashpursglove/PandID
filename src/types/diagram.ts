/**
 * Shared diagram types. Used by both the React Flow UI layer and (after a
 * thin adapter) the framework-agnostic analysis engine.
 */

export type PortSide = "top" | "right" | "bottom" | "left";

export interface PortDef {
  id: string;
  side: PortSide;
  /** 0..1 along the chosen side, where 0 is top/left and 1 is bottom/right */
  position: number;
}

export type LineType = "process" | "utility" | "pneumatic" | "electric";

/** Default React Flow node `data` payload for every P&ID symbol. */
export interface SymbolNodeData {
  [key: string]: unknown;
  /** Symbol registry key, e.g. "centrifugal-pump". */
  symbolType: string;
  /** Equipment tag, e.g. "P-101". */
  tag?: string;
  /** Free-form display label. */
  label?: string;
  /** Per-symbol parameters (pump curve, valve Cv, vessel volume, ...) */
  params?: Record<string, unknown>;
  /** Optional rotation in degrees, multiples of 90. */
  rotation?: number;
  /** When false, omit from equipment BOM / equipment CSV. Default: included. */
  includeInReports?: boolean;
}

/** Default React Flow edge `data` payload. */
export interface PipeEdgeData {
  [key: string]: unknown;
  lineType?: LineType;
  /** Bolted / direct connection — components mounted together with no pipe
   *  between them (e.g. a flange-mounted valve on a pump). Drawn as a junction
   *  dot rather than a routed line. */
  direct?: boolean;
  tag?: string;
  /** When false, omit from pipe / fitting BOM. Default: included. */
  includeInReports?: boolean;
  /** Manual routing bend points (flow coords). Cosmetic only — they arrange the
   *  drawing and have no process meaning. */
  waypoints?: { x: number; y: number }[];
  /** Pipe parameters (length, diameter, roughness, fittings...) */
  pipe?: {
    lengthM?: number;
    innerDiameterMm?: number;
    roughnessMm?: number;
    elevationChangeM?: number;
    fittings?: { kind: string; k: number; count: number }[];
    /** Last pipe preset picks (material × nominal) from the inspector. */
    presetMaterialId?: string;
    presetNominalId?: string;
  };
}

/**
 * Shared types for the electrical Single-Line Diagram (SLD) discipline.
 *
 * Mirrors the structure of the hydraulic P&ID types in `@/types/diagram`, but
 * is kept entirely separate so the two disciplines never collide: an SLD is a
 * different drawing from a P&ID, with its own symbols, connection types, and
 * (eventually) its own analysis engine.
 */

import type { ComponentType } from "react";
import type { PortDef, PortSide } from "@/types/diagram";

export type { PortDef, PortSide };

/* ----------------------------- connections ------------------------------ */

/**
 * Conductor / connection types on an SLD. Power feeders carry current and
 * participate in volt-drop / fault analysis; control and earth lines are
 * drawn but don't carry load.
 */
export type ConnectionType =
  | "lv-power" // low-voltage power feeder (≤1 kV)
  | "mv-power" // medium-voltage feeder (>1 kV)
  | "dc-power" // DC link (PV strings, battery)
  | "control" // control / signal wiring
  | "earth" // protective earth / bonding
  | "direct"; // bolted / direct connection — no cable (e.g. ACB bolted into a DB)

export interface ConnectionStyleDef {
  type: ConnectionType;
  label: string;
  description: string;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
}

/* ------------------------------- symbols -------------------------------- */

export type ElecCategory =
  | "source" // supply & generation
  | "transformer" // transformers
  | "protection" // breakers, fuses, switches, relays
  | "distribution" // busbars, boards, MCCs
  | "drive" // starters, VFDs, soft starters
  | "load" // motors, lighting, small power, generic loads
  | "instrument" // CT, VT, metering
  | "control" // PLC, control panels, ELV / fire / CCTV
  | "earthing"; // earthing & surge protection

/** A single field in the schema-driven electrical inspector form. */
export interface ElecParamField {
  key: string;
  label: string;
  kind: "number" | "text" | "select" | "slider";
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  options?: string[];
  /** For `select` fields whose options are numbers: store/emit the value as a
   *  number rather than a string (e.g. a breaker's rated current in amps). */
  numeric?: boolean;
  default?: unknown;
  group?: string;
  description?: string;
}

/**
 * Engine model dispatch key. The electrical analysis engine (Phase 3) will
 * branch on this the same way the hydraulic solver branches on `engineModel`.
 * Defined now so symbols can be tagged as we add them.
 */
export type ElecEngineModel =
  | "source" // injects available fault level + nominal voltage
  | "transformer" // impedance element, voltage transform
  | "breaker" // protective device, series impedance ~0
  | "cable" // series R + X (the edge)
  | "busbar" // node / bus
  | "board" // distribution node, aggregates downstream load
  | "drive" // motor controller
  | "motor" // rotating load (kW, pf, efficiency)
  | "load" // static load (kW/kVA, pf, demand factor)
  | "passive"; // metering, earthing — electrically transparent

export interface ElecSymbolIconProps {
  width: number;
  height: number;
  selected?: boolean;
  /** Override glyph colour (e.g. green for single-phase). Wins over the
   *  selected/idle class so phase colouring shows in editor and drawings. */
  color?: string;
}

export interface ElecSymbolDef {
  /** Registry key, e.g. "circuit-breaker". Stable across versions. */
  type: string;
  category: ElecCategory;
  /** Sub-grouping within a category for the palette tree. */
  subcategory?: string;
  label: string;
  description?: string;
  size: { width: number; height: number };
  ports: PortDef[];
  /** Tag prefix for auto-numbering, e.g. "Q" (breaker), "M" (motor), "T". */
  tagPrefix?: string;
  Icon: ComponentType<ElecSymbolIconProps>;
  paramSchema?: ElecParamField[];
  engineModel?: ElecEngineModel;
  defaultParams?: Record<string, unknown>;
  defaultLabel?: string;
  /**
   * Optional per-instance port generator. When present, the live count /
   * placement of connection handles is derived from the node's own data
   * (e.g. a busbar whose number of outgoing taps is user-configurable) instead
   * of the static `ports` array.
   */
  getPorts?: (data: ElecNodeData) => PortDef[];
  /**
   * Optional per-instance size. When present the symbol grows/shrinks with its
   * own data — e.g. a busbar or board widens as outgoing taps are added so the
   * connection points (and anything bolted to them) never overlap.
   */
  getSize?: (data: ElecNodeData) => { width: number; height: number };
}

/* ---------------------------- node / edge data --------------------------- */

/** React Flow node `data` payload for every SLD symbol. */
export interface ElecNodeData {
  [key: string]: unknown;
  /** Registry key, e.g. "circuit-breaker". */
  symbolType: string;
  /** Equipment tag, e.g. "Q-101", "M-201", "TX-1". */
  tag?: string;
  label?: string;
  params?: Record<string, unknown>;
  rotation?: number;
  /** For boards/busbars: position (relative to the symbol) of the draggable
   *  bolt-schedule table that lists everything bolted onto it. */
  boltTableOffset?: { x: number; y: number };
  /** When false, omit from electrical BOM and load schedule. Default: included. */
  includeInReports?: boolean;
}

/** React Flow edge `data` payload — a conductor / feeder. */
export interface ElecEdgeData {
  [key: string]: unknown;
  connectionType?: ConnectionType;
  tag?: string;
  /** When false, omit from cable schedule and cable BOM summary. Default: included. */
  includeInReports?: boolean;
  /** Show the cable type / size as a label next to the feeder on the diagram. */
  showSpec?: boolean;
  /** Drag offset (flow coords) of the cable spec label from the feeder midpoint. */
  specLabelOffset?: { x: number; y: number };
  /** Manual routing bend points (flow coords). Cosmetic only — they arrange the
   *  drawing and have no electrical meaning. */
  waypoints?: { x: number; y: number }[];
  /** Cable / conductor parameters (feed the cable schedule + analysis). */
  cable?: {
    cores?: number;
    csaMm2?: number;
    material?: "copper" | "aluminium";
    insulation?: "PVC" | "XLPE";
    lengthM?: number;
    parallelRuns?: number;
    installMethod?: string;
    presetId?: string;
  };
}

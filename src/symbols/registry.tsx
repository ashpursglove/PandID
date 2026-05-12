import { CentrifugalPump } from "@/symbols/equipment/CentrifugalPump";
import { PositiveDisplacementPump } from "@/symbols/equipment/PositiveDisplacementPump";
import { Column } from "@/symbols/equipment/Column";
import { HeatExchanger } from "@/symbols/equipment/HeatExchanger";
import { TankHorizontal } from "@/symbols/equipment/TankHorizontal";
import { VesselVertical } from "@/symbols/equipment/VesselVertical";
import {
  DiaphragmPump,
  GearPump,
  PeristalticPump,
  PistonPump,
  ScrewPump,
  SubmersiblePump,
  VacuumPump,
  VerticalCentrifugalPump,
} from "@/symbols/equipment/pumps";
import {
  CentrifugalCompressor,
  Fan,
  ReciprocatingCompressor,
  ScrewCompressor,
} from "@/symbols/equipment/compressors";
import {
  ConeRoofTank,
  FloatingRoofTank,
  HorizontalVessel,
  KnockoutDrum,
  OpenTopTank,
  Silo,
  SphericalTank,
} from "@/symbols/equipment/tanks";
import {
  AirCooledExchanger,
  Condenser,
  CoolingTower,
  FiredHeater,
  KettleReboiler,
  PlateHeatExchanger,
} from "@/symbols/equipment/heatTransfer";
import {
  Cyclone,
  PackedColumn,
  ThreePhaseSeparator,
  TwoPhaseSeparator,
} from "@/symbols/equipment/separation";
import { AgitatedTank, StaticMixer } from "@/symbols/equipment/mixing";

import { BallValve } from "@/symbols/valves/BallValve";
import { CheckValve } from "@/symbols/valves/CheckValve";
import { ControlValve } from "@/symbols/valves/ControlValve";
import { GateValve } from "@/symbols/valves/GateValve";
import { GlobeValve } from "@/symbols/valves/GlobeValve";
import { ReliefValve } from "@/symbols/valves/ReliefValve";
import {
  AngleValve,
  BreatherValve,
  ButterflyValve,
  DiaphragmValve,
  FlameArrestor,
  FootValve,
  HandValve,
  LiftCheckValve,
  MotorOperatedValve,
  NeedleValve,
  PinchValve,
  PlugValve,
  PressureRegulator,
  RuptureDisc,
  SolenoidValve,
  ThreeWayValve,
} from "@/symbols/valves/extra";

import {
  BagFilter,
  BasketStrainer,
  CartridgeFilter,
  DuplexFilter,
  SandFilter,
  SimplexFilter,
  TStrainer,
  YStrainer,
} from "@/symbols/filters";

import {
  AirVent,
  ConcentricReducer,
  Drain,
  EccentricReducer,
  ExpansionJoint,
  OrificePlate,
  PipeCap,
  PitotProbe,
  Rotameter,
  SamplePoint,
  SightGlass,
  SpectacleBlind,
  SprayNozzle,
  SteamTrap,
  Venturi,
} from "@/symbols/inline";

import { InstrumentBubble } from "@/symbols/instruments/InstrumentBubble";
import { TapPoint } from "@/symbols/connectors/TapPoint";
import { OffPageConnector, PipeTee } from "@/symbols/connectors/extra";

import type {
  HydraulicsHint,
  SymbolCategory,
  SymbolDef,
} from "@/symbols/types";

/** Ports shared across all simple inline (2-port) symbols. */
const INLINE_PORTS = [
  { id: "in", side: "left" as const, position: 0.5 },
  { id: "out", side: "right" as const, position: 0.5 },
];

/** ISA 5.1 two-letter instrument code helper. */
function instrumentSymbol(
  type: string,
  code: string,
  description: string,
  subcategory: string,
): SymbolDef {
  return {
    type,
    category: "instrument",
    subcategory,
    label: `${code} — ${description}`,
    description: `${code} (${description})`,
    size: { width: 56, height: 56 },
    ports: [{ id: "signal", side: "bottom", position: 0.5 }],
    tagPrefix: code,
    engineModel: "instrument",
    Icon: (props) => <InstrumentBubble {...props} code={code} />,
    paramSchema: [
      { key: "code", label: "ISA code", kind: "text", default: code },
      {
        key: "location",
        label: "Location",
        kind: "select",
        options: ["field", "panel-main", "panel-local"],
        default: "field",
      },
    ],
    defaultParams: { code, location: "field" },
    defaultLabel: `${code}-101`,
  };
}

/**
 * Schema for valves whose loss is driven by a Cv (control valves, regulators,
 * solenoids — anything where the manufacturer publishes a rated Cv).
 */
const VALVE_CV_SCHEMA = [
  {
    key: "Cv",
    label: "Flow coefficient",
    unit: "Cv",
    kind: "number" as const,
    min: 0,
    description: "Rated Cv (US gpm/√psi). Leave blank to auto-size from K.",
  },
  {
    key: "openFraction",
    label: "Open fraction",
    kind: "number" as const,
    default: 1,
    min: 0,
    max: 1,
    step: 0.05,
  },
];

/**
 * Schema for isolation / specialty valves whose loss is driven by a
 * dimensionless K. The K stays put as the user picks bigger or smaller pipes
 * — only the velocity (taken from the connected pipe ID) changes.
 */
const VALVE_K_SCHEMA = [
  {
    key: "K",
    label: "Loss coefficient K (full open)",
    kind: "number" as const,
    min: 0,
    description:
      "Leave blank to use the catalogue default for this valve type.",
  },
  {
    key: "openFraction",
    label: "Open fraction",
    kind: "number" as const,
    default: 1,
    min: 0,
    max: 1,
    step: 0.05,
  },
  {
    key: "innerDiameterMm",
    label: "Connection ID override",
    unit: "mm",
    kind: "number" as const,
    min: 1,
    description: "Optional — defaults to the smallest connected pipe.",
  },
];

/** Lightweight definition builder for inline valve / fitting glyphs. */
function inlineValve(
  type: string,
  subcategory: string,
  label: string,
  tagPrefix: string,
  Icon: SymbolDef["Icon"],
  hydraulics: HydraulicsHint,
  opts: Partial<SymbolDef> = {},
): SymbolDef {
  return {
    type,
    category: "valve",
    subcategory,
    label,
    size: { width: 48, height: 48 },
    ports: INLINE_PORTS,
    tagPrefix,
    engineModel: "valve",
    Icon,
    defaultLabel: `${tagPrefix}-101`,
    paramSchema: VALVE_K_SCHEMA,
    defaultParams: { openFraction: 1 },
    hydraulics,
    ...opts,
  };
}

function inlineFitting(
  type: string,
  subcategory: string,
  label: string,
  Icon: SymbolDef["Icon"],
  hydraulics: HydraulicsHint | undefined,
  opts: Partial<SymbolDef> = {},
): SymbolDef {
  return {
    type,
    category: "inline",
    subcategory,
    label,
    size: { width: 48, height: 48 },
    ports: INLINE_PORTS,
    engineModel: "fitting",
    Icon,
    defaultLabel: "",
    hydraulics,
    ...opts,
  };
}

function filterSymbol(
  type: string,
  label: string,
  tagPrefix: string,
  Icon: SymbolDef["Icon"],
  hydraulics: HydraulicsHint,
  opts: Partial<SymbolDef> = {},
): SymbolDef {
  return {
    type,
    category: "filter",
    label,
    size: { width: 56, height: 56 },
    ports: INLINE_PORTS,
    tagPrefix,
    engineModel: "fitting",
    Icon,
    defaultLabel: `${tagPrefix}-101`,
    hydraulics,
    paramSchema: [
      {
        key: "K",
        label: "Loss coefficient K (clean)",
        kind: "number",
        min: 0,
        description:
          "Leave blank to use the catalogue default for this filter.",
      },
      {
        key: "innerDiameterMm",
        label: "Connection ID override",
        unit: "mm",
        kind: "number",
        min: 1,
        description: "Optional — defaults to the smallest connected pipe.",
      },
    ],
    ...opts,
  };
}

export const SYMBOL_REGISTRY: Record<string, SymbolDef> = {
  // ===== EQUIPMENT =========================================================

  // --- Pumps -------------------------------------------------------------
  "centrifugal-pump": {
    type: "centrifugal-pump",
    category: "equipment",
    subcategory: "Pumps",
    label: "Centrifugal pump",
    size: { width: 64, height: 64 },
    ports: [
      // Suction enters axially at the impeller eye (bottom of the symbol)
      // and discharge leaves at the top of the volute — 180° apart.
      { id: "suction", side: "bottom", position: 0.5 },
      { id: "discharge", side: "top", position: 0.5 },
    ],
    tagPrefix: "P",
    engineModel: "pump",
    Icon: CentrifugalPump,
    defaultLabel: "P-101",
    paramSchema: [
      { key: "curve", label: "Pump curve", kind: "curve", description: "Manufacturer Q vs H points" },
      { key: "ratedHeadM", label: "Rated head", unit: "m", kind: "number", default: 30, min: 0 },
      { key: "ratedFlowM3H", label: "Rated flow", unit: "m³/h", kind: "number", default: 50, min: 0 },
      { key: "shutoffHeadM", label: "Shut-off head", unit: "m", kind: "number", default: 40, min: 0 },
    ],
    defaultParams: {
      ratedHeadM: 30,
      ratedFlowM3H: 50,
      shutoffHeadM: 40,
      curve: [
        { q: 0, h: 40 },
        { q: 25, h: 38 },
        { q: 50, h: 30 },
        { q: 75, h: 18 },
        { q: 100, h: 0 },
      ],
    },
  },
  "vertical-centrifugal-pump": {
    type: "vertical-centrifugal-pump",
    category: "equipment",
    subcategory: "Pumps",
    label: "Vertical centrifugal pump",
    size: { width: 56, height: 80 },
    ports: [
      // In-line pump: suction at the bottom, discharge straight up.
      { id: "suction", side: "bottom", position: 0.5 },
      { id: "discharge", side: "top", position: 0.5 },
    ],
    tagPrefix: "P",
    engineModel: "pump",
    Icon: VerticalCentrifugalPump,
    defaultLabel: "P-102",
    paramSchema: [
      { key: "ratedHeadM", label: "Rated head", unit: "m", kind: "number", default: 40, min: 0 },
      { key: "ratedFlowM3H", label: "Rated flow", unit: "m³/h", kind: "number", default: 30, min: 0 },
    ],
    defaultParams: { ratedHeadM: 40, ratedFlowM3H: 30 },
  },
  "submersible-pump": {
    type: "submersible-pump",
    category: "equipment",
    subcategory: "Pumps",
    label: "Submersible pump",
    size: { width: 56, height: 80 },
    ports: [{ id: "discharge", side: "top", position: 0.5 }],
    tagPrefix: "P",
    engineModel: "pump",
    Icon: SubmersiblePump,
    defaultLabel: "P-103",
    defaultParams: { ratedHeadM: 25, ratedFlowM3H: 40 },
  },
  "gear-pump": {
    type: "gear-pump",
    category: "equipment",
    subcategory: "Pumps",
    label: "Gear pump",
    size: { width: 64, height: 64 },
    ports: INLINE_PORTS,
    tagPrefix: "P",
    engineModel: "pump",
    Icon: GearPump,
    defaultLabel: "P-201",
    paramSchema: [
      { key: "displacementFlowM3H", label: "Displacement flow", unit: "m³/h", kind: "number", default: 8 },
    ],
    defaultParams: { displacementFlowM3H: 8 },
  },
  "piston-pump": {
    type: "piston-pump",
    category: "equipment",
    subcategory: "Pumps",
    label: "Piston / reciprocating pump",
    size: { width: 64, height: 64 },
    ports: INLINE_PORTS,
    tagPrefix: "P",
    engineModel: "pump",
    Icon: PistonPump,
    defaultLabel: "P-211",
    paramSchema: [
      { key: "displacementFlowM3H", label: "Displacement flow", unit: "m³/h", kind: "number", default: 4 },
    ],
    defaultParams: { displacementFlowM3H: 4 },
  },
  "screw-pump": {
    type: "screw-pump",
    category: "equipment",
    subcategory: "Pumps",
    label: "Screw / progressive cavity pump",
    size: { width: 64, height: 64 },
    ports: INLINE_PORTS,
    tagPrefix: "P",
    engineModel: "pump",
    Icon: ScrewPump,
    defaultLabel: "P-221",
    defaultParams: { displacementFlowM3H: 12 },
  },
  "diaphragm-pump": {
    type: "diaphragm-pump",
    category: "equipment",
    subcategory: "Pumps",
    label: "Diaphragm pump",
    size: { width: 64, height: 64 },
    ports: INLINE_PORTS,
    tagPrefix: "P",
    engineModel: "pump",
    Icon: DiaphragmPump,
    defaultLabel: "P-231",
    defaultParams: { displacementFlowM3H: 2 },
  },
  "peristaltic-pump": {
    type: "peristaltic-pump",
    category: "equipment",
    subcategory: "Pumps",
    label: "Peristaltic pump",
    size: { width: 64, height: 64 },
    ports: INLINE_PORTS,
    tagPrefix: "P",
    engineModel: "pump",
    Icon: PeristalticPump,
    defaultLabel: "P-241",
    defaultParams: { displacementFlowM3H: 0.5 },
  },
  "vacuum-pump": {
    type: "vacuum-pump",
    category: "equipment",
    subcategory: "Pumps",
    label: "Vacuum pump",
    size: { width: 64, height: 64 },
    ports: INLINE_PORTS,
    tagPrefix: "VP",
    engineModel: "pump",
    Icon: VacuumPump,
    defaultLabel: "VP-101",
    defaultParams: { ratedFlowM3H: 50 },
  },
  // Backwards-compat alias — the old generic PD pump entry is now a gear pump.
  "pd-pump": {
    type: "pd-pump",
    category: "equipment",
    subcategory: "Pumps",
    label: "Positive-displacement pump",
    size: { width: 64, height: 64 },
    ports: INLINE_PORTS,
    tagPrefix: "P",
    engineModel: "pump",
    Icon: PositiveDisplacementPump,
    defaultLabel: "P-301",
    paramSchema: [
      { key: "displacementFlowM3H", label: "Displacement flow", unit: "m³/h", kind: "number", default: 10 },
    ],
    defaultParams: { displacementFlowM3H: 10 },
  },

  // --- Compressors & blowers --------------------------------------------
  "centrifugal-compressor": {
    type: "centrifugal-compressor",
    category: "equipment",
    subcategory: "Compressors & blowers",
    label: "Centrifugal compressor",
    size: { width: 80, height: 64 },
    ports: INLINE_PORTS,
    tagPrefix: "K",
    engineModel: "pump",
    Icon: CentrifugalCompressor,
    defaultLabel: "K-101",
    defaultParams: { ratedFlowM3H: 1000 },
  },
  "reciprocating-compressor": {
    type: "reciprocating-compressor",
    category: "equipment",
    subcategory: "Compressors & blowers",
    label: "Reciprocating compressor",
    size: { width: 64, height: 80 },
    ports: [
      { id: "in", side: "left", position: 0.75 },
      { id: "out", side: "right", position: 0.75 },
    ],
    tagPrefix: "K",
    engineModel: "pump",
    Icon: ReciprocatingCompressor,
    defaultLabel: "K-201",
    defaultParams: { ratedFlowM3H: 300 },
  },
  "screw-compressor": {
    type: "screw-compressor",
    category: "equipment",
    subcategory: "Compressors & blowers",
    label: "Rotary-screw compressor",
    size: { width: 80, height: 56 },
    ports: INLINE_PORTS,
    tagPrefix: "K",
    engineModel: "pump",
    Icon: ScrewCompressor,
    defaultLabel: "K-301",
    defaultParams: { ratedFlowM3H: 500 },
  },
  "fan": {
    type: "fan",
    category: "equipment",
    subcategory: "Compressors & blowers",
    label: "Fan / blower",
    size: { width: 64, height: 64 },
    ports: INLINE_PORTS,
    tagPrefix: "B",
    engineModel: "pump",
    Icon: Fan,
    defaultLabel: "B-101",
    defaultParams: { ratedFlowM3H: 2000 },
  },

  // --- Tanks & vessels ---------------------------------------------------
  "vessel-vertical": {
    type: "vessel-vertical",
    category: "equipment",
    subcategory: "Tanks & vessels",
    label: "Vertical vessel (dished heads)",
    size: { width: 56, height: 96 },
    ports: [
      { id: "top", side: "top", position: 0.5 },
      { id: "bottom", side: "bottom", position: 0.5 },
      { id: "side-left", side: "left", position: 0.4 },
      { id: "side-right", side: "right", position: 0.4 },
    ],
    tagPrefix: "V",
    engineModel: "vessel",
    Icon: VesselVertical,
    defaultLabel: "V-101",
    paramSchema: [
      { key: "volumeM3", label: "Volume", unit: "m³", kind: "number", default: 2, min: 0 },
      { key: "designPressureBar", label: "Design pressure", unit: "bar(g)", kind: "number", default: 6 },
    ],
    defaultParams: { volumeM3: 2, designPressureBar: 6 },
  },
  "vessel-horizontal": {
    type: "vessel-horizontal",
    category: "equipment",
    subcategory: "Tanks & vessels",
    label: "Horizontal vessel (dished heads)",
    size: { width: 96, height: 56 },
    ports: [
      { id: "left", side: "left", position: 0.5 },
      { id: "right", side: "right", position: 0.5 },
      { id: "top", side: "top", position: 0.5 },
      { id: "bottom", side: "bottom", position: 0.5 },
    ],
    tagPrefix: "V",
    engineModel: "vessel",
    Icon: HorizontalVessel,
    defaultLabel: "V-102",
    defaultParams: { volumeM3: 5, designPressureBar: 10 },
  },
  "tank-horizontal": {
    type: "tank-horizontal",
    category: "equipment",
    subcategory: "Tanks & vessels",
    label: "Horizontal tank",
    size: { width: 96, height: 56 },
    ports: [
      { id: "left", side: "left", position: 0.5 },
      { id: "right", side: "right", position: 0.5 },
      { id: "top", side: "top", position: 0.5 },
      { id: "bottom", side: "bottom", position: 0.5 },
    ],
    tagPrefix: "T",
    engineModel: "vessel",
    Icon: TankHorizontal,
    defaultLabel: "T-101",
    defaultParams: { volumeM3: 10 },
  },
  "open-top-tank": {
    type: "open-top-tank",
    category: "equipment",
    subcategory: "Tanks & vessels",
    label: "Open-top tank",
    size: { width: 80, height: 80 },
    ports: [
      { id: "top", side: "top", position: 0.5 },
      { id: "bottom", side: "bottom", position: 0.5 },
      { id: "side", side: "left", position: 0.8 },
    ],
    tagPrefix: "T",
    engineModel: "vessel",
    Icon: OpenTopTank,
    defaultLabel: "T-201",
    defaultParams: { volumeM3: 50 },
  },
  "cone-roof-tank": {
    type: "cone-roof-tank",
    category: "equipment",
    subcategory: "Tanks & vessels",
    label: "Cone-roof tank",
    size: { width: 96, height: 96 },
    ports: [
      { id: "top", side: "top", position: 0.5 },
      { id: "bottom", side: "bottom", position: 0.5 },
      { id: "side", side: "left", position: 0.8 },
    ],
    tagPrefix: "T",
    engineModel: "vessel",
    Icon: ConeRoofTank,
    defaultLabel: "T-301",
    defaultParams: { volumeM3: 500 },
  },
  "floating-roof-tank": {
    type: "floating-roof-tank",
    category: "equipment",
    subcategory: "Tanks & vessels",
    label: "Floating-roof tank",
    size: { width: 96, height: 96 },
    ports: [
      { id: "top", side: "top", position: 0.5 },
      { id: "bottom", side: "bottom", position: 0.5 },
      { id: "side", side: "left", position: 0.8 },
    ],
    tagPrefix: "T",
    engineModel: "vessel",
    Icon: FloatingRoofTank,
    defaultLabel: "T-401",
    defaultParams: { volumeM3: 1000 },
  },
  "spherical-tank": {
    type: "spherical-tank",
    category: "equipment",
    subcategory: "Tanks & vessels",
    label: "Spherical pressure tank",
    size: { width: 96, height: 96 },
    ports: [
      { id: "top", side: "top", position: 0.5 },
      { id: "bottom", side: "bottom", position: 0.5 },
    ],
    tagPrefix: "TK",
    engineModel: "vessel",
    Icon: SphericalTank,
    defaultLabel: "TK-101",
    defaultParams: { volumeM3: 200, designPressureBar: 16 },
  },
  "silo": {
    type: "silo",
    category: "equipment",
    subcategory: "Tanks & vessels",
    label: "Silo / hopper",
    size: { width: 80, height: 96 },
    ports: [
      { id: "top", side: "top", position: 0.5 },
      { id: "bottom", side: "bottom", position: 0.5 },
    ],
    tagPrefix: "SH",
    engineModel: "vessel",
    Icon: Silo,
    defaultLabel: "SH-101",
    defaultParams: { volumeM3: 80 },
  },

  // --- Heat transfer -----------------------------------------------------
  "heat-exchanger": {
    type: "heat-exchanger",
    category: "equipment",
    subcategory: "Heat transfer",
    label: "Shell & tube exchanger",
    size: { width: 96, height: 56 },
    ports: [
      { id: "tube-in", side: "top", position: 0.25 },
      { id: "tube-out", side: "top", position: 0.75 },
      { id: "shell-in", side: "bottom", position: 0.25 },
      { id: "shell-out", side: "bottom", position: 0.75 },
    ],
    tagPrefix: "E",
    engineModel: "passive",
    Icon: HeatExchanger,
    defaultLabel: "E-101",
    paramSchema: [
      { key: "dutyKW", label: "Heat duty", unit: "kW", kind: "number", default: 100 },
      {
        key: "deltaPbar",
        label: "ΔP (tube side)",
        unit: "bar",
        kind: "number",
        min: 0,
        description:
          "Leave blank to use a typical 0.3 bar tube-side drop for this exchanger.",
      },
    ],
    defaultParams: { dutyKW: 100 },
    hydraulics: { lossModel: "deltaP", defaultDeltaPbar: 0.3 },
  },
  "plate-heat-exchanger": {
    type: "plate-heat-exchanger",
    category: "equipment",
    subcategory: "Heat transfer",
    label: "Plate heat exchanger",
    size: { width: 80, height: 64 },
    ports: [
      { id: "hot-in", side: "top", position: 0.2 },
      { id: "hot-out", side: "top", position: 0.8 },
      { id: "cold-in", side: "bottom", position: 0.2 },
      { id: "cold-out", side: "bottom", position: 0.8 },
    ],
    tagPrefix: "E",
    engineModel: "passive",
    Icon: PlateHeatExchanger,
    defaultLabel: "E-201",
    defaultParams: { dutyKW: 200 },
    hydraulics: { lossModel: "deltaP", defaultDeltaPbar: 0.5 },
  },
  "air-cooled-exchanger": {
    type: "air-cooled-exchanger",
    category: "equipment",
    subcategory: "Heat transfer",
    label: "Air-cooled (fin-fan) exchanger",
    size: { width: 96, height: 80 },
    ports: [
      { id: "in", side: "left", position: 0.25 },
      { id: "out", side: "right", position: 0.25 },
    ],
    tagPrefix: "AC",
    engineModel: "passive",
    Icon: AirCooledExchanger,
    defaultLabel: "AC-101",
    defaultParams: { dutyKW: 500 },
    hydraulics: { lossModel: "deltaP", defaultDeltaPbar: 0.1 },
  },
  "kettle-reboiler": {
    type: "kettle-reboiler",
    category: "equipment",
    subcategory: "Heat transfer",
    label: "Kettle reboiler",
    size: { width: 96, height: 64 },
    ports: [
      { id: "tube-in", side: "bottom", position: 0.25 },
      { id: "tube-out", side: "bottom", position: 0.6 },
      { id: "vapor", side: "top", position: 0.4 },
      { id: "liquid", side: "right", position: 0.8 },
    ],
    tagPrefix: "E",
    engineModel: "passive",
    Icon: KettleReboiler,
    defaultLabel: "E-301",
    defaultParams: { dutyKW: 800 },
    hydraulics: { lossModel: "deltaP", defaultDeltaPbar: 0.3 },
  },
  "condenser": {
    type: "condenser",
    category: "equipment",
    subcategory: "Heat transfer",
    label: "Condenser",
    size: { width: 96, height: 56 },
    ports: [
      { id: "vapor-in", side: "left", position: 0.5 },
      { id: "condensate-out", side: "right", position: 0.5 },
      { id: "cw-in", side: "bottom", position: 0.25 },
      { id: "cw-out", side: "bottom", position: 0.75 },
    ],
    tagPrefix: "E",
    engineModel: "passive",
    Icon: Condenser,
    defaultLabel: "E-401",
    defaultParams: { dutyKW: 400 },
    hydraulics: { lossModel: "deltaP", defaultDeltaPbar: 0.2 },
  },
  "fired-heater": {
    type: "fired-heater",
    category: "equipment",
    subcategory: "Heat transfer",
    label: "Fired heater / furnace",
    size: { width: 80, height: 96 },
    ports: [
      { id: "in", side: "left", position: 0.5 },
      { id: "out", side: "right", position: 0.5 },
      { id: "flue", side: "top", position: 0.5 },
    ],
    tagPrefix: "H",
    engineModel: "passive",
    Icon: FiredHeater,
    defaultLabel: "H-101",
    defaultParams: { dutyKW: 2000 },
  },
  "cooling-tower": {
    type: "cooling-tower",
    category: "equipment",
    subcategory: "Heat transfer",
    label: "Cooling tower",
    size: { width: 96, height: 96 },
    ports: [
      { id: "warm-in", side: "top", position: 0.7 },
      { id: "cool-out", side: "bottom", position: 0.3 },
      { id: "makeup", side: "left", position: 0.5 },
    ],
    tagPrefix: "CT",
    engineModel: "passive",
    Icon: CoolingTower,
    defaultLabel: "CT-101",
    defaultParams: { dutyKW: 1500 },
  },

  // --- Separation & columns ---------------------------------------------
  "column": {
    type: "column",
    category: "equipment",
    subcategory: "Separation & columns",
    label: "Distillation column (tray)",
    size: { width: 56, height: 128 },
    ports: [
      { id: "top", side: "top", position: 0.5 },
      { id: "bottom", side: "bottom", position: 0.5 },
      { id: "feed", side: "left", position: 0.5 },
      { id: "side-right", side: "right", position: 0.5 },
    ],
    tagPrefix: "C",
    engineModel: "vessel",
    Icon: Column,
    defaultLabel: "C-101",
    paramSchema: [
      { key: "stages", label: "Theoretical stages", kind: "number", default: 20 },
    ],
    defaultParams: { stages: 20 },
  },
  "packed-column": {
    type: "packed-column",
    category: "equipment",
    subcategory: "Separation & columns",
    label: "Packed column",
    size: { width: 56, height: 128 },
    ports: [
      { id: "top", side: "top", position: 0.5 },
      { id: "bottom", side: "bottom", position: 0.5 },
      { id: "feed", side: "left", position: 0.5 },
    ],
    tagPrefix: "C",
    engineModel: "vessel",
    Icon: PackedColumn,
    defaultLabel: "C-201",
    defaultParams: { packingHeightM: 6 },
  },
  "cyclone-separator": {
    type: "cyclone-separator",
    category: "equipment",
    subcategory: "Separation & columns",
    label: "Cyclone separator",
    size: { width: 64, height: 96 },
    ports: [
      { id: "feed", side: "left", position: 0.3 },
      { id: "overhead", side: "top", position: 0.5 },
      { id: "underflow", side: "bottom", position: 0.5 },
    ],
    tagPrefix: "S",
    engineModel: "passive",
    Icon: Cyclone,
    defaultLabel: "S-101",
    defaultParams: { efficiency: 0.95 },
  },
  "two-phase-separator": {
    type: "two-phase-separator",
    category: "equipment",
    subcategory: "Separation & columns",
    label: "Two-phase separator",
    size: { width: 96, height: 64 },
    ports: [
      { id: "feed", side: "left", position: 0.5 },
      { id: "vapor", side: "top", position: 0.7 },
      { id: "liquid", side: "bottom", position: 0.3 },
    ],
    tagPrefix: "V",
    engineModel: "vessel",
    Icon: TwoPhaseSeparator,
    defaultLabel: "V-201",
    defaultParams: { volumeM3: 5 },
  },
  "three-phase-separator": {
    type: "three-phase-separator",
    category: "equipment",
    subcategory: "Separation & columns",
    label: "Three-phase separator",
    size: { width: 112, height: 64 },
    ports: [
      { id: "feed", side: "left", position: 0.5 },
      { id: "vapor", side: "top", position: 0.7 },
      { id: "water", side: "bottom", position: 0.25 },
      { id: "oil", side: "bottom", position: 0.75 },
    ],
    tagPrefix: "V",
    engineModel: "vessel",
    Icon: ThreePhaseSeparator,
    defaultLabel: "V-301",
    defaultParams: { volumeM3: 8 },
  },
  "knockout-drum": {
    type: "knockout-drum",
    category: "equipment",
    subcategory: "Separation & columns",
    label: "Knock-out drum",
    size: { width: 96, height: 64 },
    ports: [
      { id: "feed", side: "left", position: 0.5 },
      { id: "vapor", side: "top", position: 0.5 },
      { id: "liquid", side: "bottom", position: 0.5 },
    ],
    tagPrefix: "V",
    engineModel: "vessel",
    Icon: KnockoutDrum,
    defaultLabel: "V-401",
    defaultParams: { volumeM3: 3 },
  },

  // --- Mixing -----------------------------------------------------------
  "static-mixer": {
    type: "static-mixer",
    category: "equipment",
    subcategory: "Mixing",
    label: "Static mixer",
    size: { width: 80, height: 48 },
    ports: INLINE_PORTS,
    tagPrefix: "MX",
    engineModel: "fitting",
    Icon: StaticMixer,
    defaultLabel: "MX-101",
    paramSchema: [
      {
        key: "K",
        label: "Loss coefficient K",
        kind: "number",
        min: 0,
        description: "Leave blank to use the catalogue default for this mixer.",
      },
      {
        key: "innerDiameterMm",
        label: "Connection ID override",
        unit: "mm",
        kind: "number",
        min: 1,
        description: "Optional — defaults to the smallest connected pipe.",
      },
    ],
    hydraulics: { lossModel: "k", defaultK: 8 },
  },
  "agitated-tank": {
    type: "agitated-tank",
    category: "equipment",
    subcategory: "Mixing",
    label: "Agitated tank",
    size: { width: 80, height: 96 },
    ports: [
      { id: "in", side: "left", position: 0.4 },
      { id: "out", side: "bottom", position: 0.5 },
      { id: "top", side: "top", position: 0.7 },
    ],
    tagPrefix: "T",
    engineModel: "vessel",
    Icon: AgitatedTank,
    defaultLabel: "T-501",
    defaultParams: { volumeM3: 5 },
  },

  // ===== VALVES ============================================================

  // Isolation
  "gate-valve": inlineValve(
    "gate-valve",
    "Isolation",
    "Gate valve",
    "GV",
    GateValve,
    { lossModel: "k", defaultK: 0.15 },
  ),
  "ball-valve": inlineValve(
    "ball-valve",
    "Isolation",
    "Ball valve",
    "BV",
    BallValve,
    { lossModel: "k", defaultK: 0.05 },
  ),
  "butterfly-valve": inlineValve(
    "butterfly-valve",
    "Isolation",
    "Butterfly valve",
    "BFV",
    ButterflyValve,
    { lossModel: "k", defaultK: 0.7 },
  ),
  "plug-valve": inlineValve(
    "plug-valve",
    "Isolation",
    "Plug valve",
    "PV",
    PlugValve,
    { lossModel: "k", defaultK: 0.4 },
  ),
  "diaphragm-valve": inlineValve(
    "diaphragm-valve",
    "Isolation",
    "Diaphragm valve",
    "DPV",
    DiaphragmValve,
    { lossModel: "k", defaultK: 2.3 },
  ),
  "pinch-valve": inlineValve(
    "pinch-valve",
    "Isolation",
    "Pinch valve",
    "PNV",
    PinchValve,
    { lossModel: "k", defaultK: 1.5 },
  ),
  "needle-valve": inlineValve(
    "needle-valve",
    "Isolation",
    "Needle valve",
    "NV",
    NeedleValve,
    { lossModel: "k", defaultK: 5 },
  ),
  "hand-valve": inlineValve(
    "hand-valve",
    "Isolation",
    "Hand valve (generic)",
    "HV",
    HandValve,
    { lossModel: "k", defaultK: 0.5 },
  ),

  // Specialty body
  "globe-valve": inlineValve(
    "globe-valve",
    "Specialty",
    "Globe valve",
    "GLV",
    GlobeValve,
    { lossModel: "k", defaultK: 6 },
  ),
  "angle-valve": inlineValve(
    "angle-valve",
    "Specialty",
    "Angle valve",
    "AV",
    AngleValve,
    { lossModel: "k", defaultK: 4 },
  ),
  "three-way-valve": {
    type: "three-way-valve",
    category: "valve",
    subcategory: "Specialty",
    label: "Three-way valve",
    size: { width: 64, height: 64 },
    ports: [
      { id: "in", side: "left", position: 0.5 },
      { id: "out", side: "right", position: 0.5 },
      { id: "branch", side: "bottom", position: 0.5 },
    ],
    tagPrefix: "3WV",
    engineModel: "valve",
    Icon: ThreeWayValve,
    defaultLabel: "3WV-101",
    paramSchema: VALVE_K_SCHEMA,
    defaultParams: { openFraction: 1 },
    hydraulics: { lossModel: "k", defaultK: 6 },
  },

  // Check
  "check-valve": inlineValve(
    "check-valve",
    "Check",
    "Swing check valve",
    "CV",
    CheckValve,
    { lossModel: "k", defaultK: 2, isCheck: true },
    {
      paramSchema: [
        {
          key: "crackingPressureBar",
          label: "Cracking pressure",
          unit: "bar",
          kind: "number",
          default: 0.05,
        },
        ...VALVE_K_SCHEMA,
      ],
      defaultParams: { crackingPressureBar: 0.05, openFraction: 1 },
    },
  ),
  "lift-check-valve": inlineValve(
    "lift-check-valve",
    "Check",
    "Lift check valve",
    "CV",
    LiftCheckValve,
    { lossModel: "k", defaultK: 8, isCheck: true },
    {
      paramSchema: [
        {
          key: "crackingPressureBar",
          label: "Cracking pressure",
          unit: "bar",
          kind: "number",
          default: 0.1,
        },
        ...VALVE_K_SCHEMA,
      ],
      defaultParams: { crackingPressureBar: 0.1, openFraction: 1 },
    },
  ),
  "foot-valve": inlineValve(
    "foot-valve",
    "Check",
    "Foot valve (with strainer)",
    "FV",
    FootValve,
    { lossModel: "k", defaultK: 13, isCheck: true },
    {
      size: { width: 64, height: 64 },
      defaultParams: { openFraction: 1 },
    },
  ),

  // Actuated / control
  "control-valve": {
    type: "control-valve",
    category: "valve",
    subcategory: "Actuated & control",
    label: "Control valve (pneumatic)",
    size: { width: 64, height: 72 },
    ports: [
      { id: "in", side: "left", position: 0.65 },
      { id: "out", side: "right", position: 0.65 },
      { id: "signal", side: "top", position: 0.5 },
    ],
    tagPrefix: "FV",
    engineModel: "valve",
    Icon: ControlValve,
    defaultLabel: "FV-101",
    paramSchema: VALVE_CV_SCHEMA,
    defaultParams: { openFraction: 0.5 },
    hydraulics: { lossModel: "cv", defaultCv: 40 },
  },
  "motor-operated-valve": inlineValve(
    "motor-operated-valve",
    "Actuated & control",
    "Motor-operated valve (MOV)",
    "MOV",
    MotorOperatedValve,
    { lossModel: "k", defaultK: 0.15 },
    { size: { width: 64, height: 72 } },
  ),
  "solenoid-valve": inlineValve(
    "solenoid-valve",
    "Actuated & control",
    "Solenoid valve",
    "SV",
    SolenoidValve,
    { lossModel: "k", defaultK: 4 },
    { size: { width: 64, height: 72 } },
  ),
  "pressure-regulator": inlineValve(
    "pressure-regulator",
    "Actuated & control",
    "Pressure regulator (self-acting)",
    "PCV",
    PressureRegulator,
    { lossModel: "cv", defaultCv: 20 },
    {
      size: { width: 64, height: 72 },
      paramSchema: [
        {
          key: "setPressureBar",
          label: "Set pressure",
          unit: "bar(g)",
          kind: "number",
          default: 3,
        },
        ...VALVE_CV_SCHEMA,
      ],
      defaultParams: { setPressureBar: 3, openFraction: 1 },
    },
  ),

  // Pressure relief & safety
  "relief-valve": {
    type: "relief-valve",
    category: "valve",
    subcategory: "Pressure relief & safety",
    label: "Pressure-relief valve (PSV)",
    size: { width: 48, height: 64 },
    ports: [
      { id: "in", side: "left", position: 0.7 },
      { id: "out", side: "top", position: 0.5 },
    ],
    tagPrefix: "PSV",
    engineModel: "valve",
    Icon: ReliefValve,
    defaultLabel: "PSV-101",
    paramSchema: [
      { key: "setPressureBar", label: "Set pressure", unit: "bar(g)", kind: "number", default: 10 },
    ],
    defaultParams: { setPressureBar: 10 },
  },
  "rupture-disc": inlineFitting(
    "rupture-disc",
    "Pressure relief & safety",
    "Rupture disc",
    RuptureDisc,
    // Closed under normal operation — adds no head loss to a steady-state path.
    undefined,
    {
      tagPrefix: "RD",
      defaultLabel: "RD-101",
      paramSchema: [
        {
          key: "burstPressureBar",
          label: "Burst pressure",
          unit: "bar(g)",
          kind: "number",
          default: 12,
        },
      ],
      defaultParams: { burstPressureBar: 12 },
    },
  ),
  "breather-valve": inlineFitting(
    "breather-valve",
    "Pressure relief & safety",
    "Breather / vacuum vent",
    BreatherValve,
    undefined,
    {
      size: { width: 56, height: 64 },
      tagPrefix: "PV",
      defaultLabel: "PV-101",
      ports: [{ id: "in", side: "bottom", position: 0.5 }],
    },
  ),
  "flame-arrestor": inlineFitting(
    "flame-arrestor",
    "Pressure relief & safety",
    "Flame arrestor",
    FlameArrestor,
    { lossModel: "k", defaultK: 5 },
    {
      size: { width: 64, height: 48 },
      tagPrefix: "FA",
      defaultLabel: "FA-101",
    },
  ),

  // ===== FILTERS & STRAINERS ==============================================
  // Loss coefficients are Crane / manufacturer-typical for *clean* media. Real
  // dirty-filter drops can be much higher — users override per-symbol once a
  // process is in service.
  "y-strainer": filterSymbol("y-strainer", "Y-strainer", "ST", YStrainer, {
    lossModel: "k",
    defaultK: 1.5,
  }),
  "t-strainer": filterSymbol("t-strainer", "T-strainer", "ST", TStrainer, {
    lossModel: "k",
    defaultK: 2.0,
  }),
  "basket-strainer": filterSymbol(
    "basket-strainer",
    "Basket strainer",
    "ST",
    BasketStrainer,
    { lossModel: "k", defaultK: 3.0 },
    { size: { width: 64, height: 64 } },
  ),
  "simplex-filter": filterSymbol(
    "simplex-filter",
    "Simplex filter",
    "F",
    SimplexFilter,
    { lossModel: "k", defaultK: 5.0 },
    { size: { width: 64, height: 64 } },
  ),
  "duplex-filter": filterSymbol(
    "duplex-filter",
    "Duplex filter",
    "F",
    DuplexFilter,
    { lossModel: "k", defaultK: 6.0 },
    { size: { width: 80, height: 64 } },
  ),
  "bag-filter": filterSymbol(
    "bag-filter",
    "Bag filter",
    "F",
    BagFilter,
    { lossModel: "k", defaultK: 10.0 },
    { size: { width: 64, height: 64 } },
  ),
  "cartridge-filter": filterSymbol(
    "cartridge-filter",
    "Cartridge filter",
    "F",
    CartridgeFilter,
    { lossModel: "k", defaultK: 8.0 },
    { size: { width: 64, height: 80 } },
  ),
  "sand-filter": filterSymbol(
    "sand-filter",
    "Multimedia / sand filter",
    "F",
    SandFilter,
    { lossModel: "k", defaultK: 4.0 },
    { size: { width: 64, height: 80 } },
  ),

  // ===== INLINE & FITTINGS ================================================
  "orifice-plate": inlineFitting(
    "orifice-plate",
    "Flow elements",
    "Orifice plate",
    OrificePlate,
    // K ~ ((1 − β²)/β²)² ≈ 9 for β = 0.5 — common process-flow metering plate.
    { lossModel: "k", defaultK: 9 },
    {
      size: { width: 64, height: 48 },
      tagPrefix: "FE",
      defaultLabel: "FE-101",
      paramSchema: [
        {
          key: "boreMm",
          label: "Bore diameter",
          unit: "mm",
          kind: "number",
          default: 25,
        },
        { key: "betaRatio", label: "β ratio", kind: "number", default: 0.5 },
        {
          key: "K",
          label: "Loss coefficient K",
          kind: "number",
          min: 0,
          description: "Leave blank to use the catalogue default (β-derived).",
        },
      ],
      defaultParams: { boreMm: 25, betaRatio: 0.5 },
    },
  ),
  "venturi": inlineFitting(
    "venturi",
    "Flow elements",
    "Venturi meter",
    Venturi,
    { lossModel: "k", defaultK: 0.2 },
    {
      size: { width: 80, height: 48 },
      tagPrefix: "FE",
      defaultLabel: "FE-102",
    },
  ),
  "rotameter": inlineFitting(
    "rotameter",
    "Flow elements",
    "Rotameter (VA meter)",
    Rotameter,
    { lossModel: "k", defaultK: 1.5 },
    {
      size: { width: 56, height: 80 },
      tagPrefix: "FI",
      defaultLabel: "FI-101",
    },
  ),
  "pitot-probe": inlineFitting(
    "pitot-probe",
    "Flow elements",
    "Pitot probe",
    PitotProbe,
    // Insertion probe — sees essentially the line ΔP it's sampling.
    undefined,
    {
      size: { width: 64, height: 64 },
      tagPrefix: "FE",
      defaultLabel: "FE-103",
    },
  ),
  "steam-trap": inlineFitting(
    "steam-trap",
    "Traps & vents",
    "Steam trap",
    SteamTrap,
    undefined,
    {
      size: { width: 64, height: 48 },
      tagPrefix: "ST",
      defaultLabel: "ST-101",
    },
  ),
  "air-vent": inlineFitting(
    "air-vent",
    "Traps & vents",
    "Air vent",
    AirVent,
    undefined,
    {
      size: { width: 56, height: 64 },
      ports: [{ id: "in", side: "bottom", position: 0.5 }],
    },
  ),
  "drain": inlineFitting(
    "drain",
    "Traps & vents",
    "Drain",
    Drain,
    undefined,
    {
      size: { width: 56, height: 64 },
      ports: [{ id: "in", side: "top", position: 0.5 }],
    },
  ),
  "sight-glass": inlineFitting(
    "sight-glass",
    "Sample & sight",
    "Sight glass",
    SightGlass,
    { lossModel: "k", defaultK: 0.5 },
    {
      size: { width: 64, height: 48 },
      tagPrefix: "SG",
      defaultLabel: "SG-101",
    },
  ),
  "sample-point": inlineFitting(
    "sample-point",
    "Sample & sight",
    "Sample point",
    SamplePoint,
    undefined,
    {
      size: { width: 64, height: 64 },
      tagPrefix: "SP",
      defaultLabel: "SP-101",
      ports: [{ id: "tap", side: "top", position: 0.5 }],
    },
  ),
  "concentric-reducer": inlineFitting(
    "concentric-reducer",
    "Mechanical",
    "Concentric reducer",
    ConcentricReducer,
    { lossModel: "k", defaultK: 0.2 },
  ),
  "eccentric-reducer": inlineFitting(
    "eccentric-reducer",
    "Mechanical",
    "Eccentric reducer",
    EccentricReducer,
    { lossModel: "k", defaultK: 0.3 },
  ),
  "expansion-joint": inlineFitting(
    "expansion-joint",
    "Mechanical",
    "Expansion joint",
    ExpansionJoint,
    { lossModel: "k", defaultK: 0.3 },
  ),
  "spectacle-blind": inlineFitting(
    "spectacle-blind",
    "Mechanical",
    "Spectacle blind",
    SpectacleBlind,
    undefined,
  ),
  "pipe-cap": inlineFitting(
    "pipe-cap",
    "Mechanical",
    "Pipe cap / blank",
    PipeCap,
    undefined,
    { ports: [{ id: "in", side: "left", position: 0.5 }] },
  ),
  "spray-nozzle": inlineFitting(
    "spray-nozzle",
    "Mechanical",
    "Spray nozzle",
    SprayNozzle,
    undefined,
    { ports: [{ id: "in", side: "left", position: 0.5 }] },
  ),

  // ===== CONNECTORS =======================================================
  "tap-point": {
    type: "tap-point",
    category: "connector",
    subcategory: "Connectors",
    label: "Tap point",
    description: "Process-line tap for instruments",
    size: { width: 16, height: 16 },
    ports: [
      { id: "pipe-left", side: "left", position: 0.5 },
      { id: "pipe-right", side: "right", position: 0.5 },
      { id: "signal-top", side: "top", position: 0.5 },
      { id: "signal-bottom", side: "bottom", position: 0.5 },
    ],
    engineModel: "passive",
    Icon: TapPoint,
    defaultLabel: "",
  },
  "pipe-tee": {
    type: "pipe-tee",
    category: "connector",
    subcategory: "Connectors",
    label: "Pipe tee / junction",
    size: { width: 32, height: 32 },
    ports: [
      { id: "in", side: "left", position: 0.5 },
      { id: "out", side: "right", position: 0.5 },
      { id: "branch", side: "bottom", position: 0.5 },
    ],
    engineModel: "passive",
    Icon: PipeTee,
    defaultLabel: "",
  },
  "off-page-connector": {
    type: "off-page-connector",
    category: "connector",
    subcategory: "Connectors",
    label: "Off-page connector",
    size: { width: 64, height: 48 },
    ports: [
      { id: "in", side: "left", position: 0.5 },
      { id: "out", side: "right", position: 0.5 },
    ],
    tagPrefix: "OPC",
    engineModel: "passive",
    Icon: OffPageConnector,
    defaultLabel: "→ A",
  },

  // ===== INSTRUMENTS =======================================================
  // --- Pressure ----------------------------------------------------------
  "instrument-pi": instrumentSymbol("instrument-pi", "PI", "Pressure indicator", "Pressure"),
  "instrument-pt": instrumentSymbol("instrument-pt", "PT", "Pressure transmitter", "Pressure"),
  "instrument-pic": instrumentSymbol("instrument-pic", "PIC", "Pressure indicating controller", "Pressure"),
  "instrument-psl": instrumentSymbol("instrument-psl", "PSL", "Pressure switch low", "Pressure"),
  "instrument-psh": instrumentSymbol("instrument-psh", "PSH", "Pressure switch high", "Pressure"),
  "instrument-pdt": instrumentSymbol("instrument-pdt", "PDT", "Differential-pressure transmitter", "Pressure"),

  // --- Flow --------------------------------------------------------------
  "instrument-fi": instrumentSymbol("instrument-fi", "FI", "Flow indicator", "Flow"),
  "instrument-ft": instrumentSymbol("instrument-ft", "FT", "Flow transmitter", "Flow"),
  "instrument-fic": instrumentSymbol("instrument-fic", "FIC", "Flow indicating controller", "Flow"),
  "instrument-fe": instrumentSymbol("instrument-fe", "FE", "Flow element", "Flow"),
  "instrument-fq": instrumentSymbol("instrument-fq", "FQ", "Flow totaliser", "Flow"),
  "instrument-fal": instrumentSymbol("instrument-fal", "FAL", "Flow alarm low", "Flow"),

  // --- Temperature -------------------------------------------------------
  "instrument-ti": instrumentSymbol("instrument-ti", "TI", "Temperature indicator", "Temperature"),
  "instrument-tt": instrumentSymbol("instrument-tt", "TT", "Temperature transmitter", "Temperature"),
  "instrument-tic": instrumentSymbol("instrument-tic", "TIC", "Temperature indicating controller", "Temperature"),
  "instrument-te": instrumentSymbol("instrument-te", "TE", "Temperature element (RTD/TC)", "Temperature"),
  "instrument-tsl": instrumentSymbol("instrument-tsl", "TSL", "Temperature switch low", "Temperature"),
  "instrument-tsh": instrumentSymbol("instrument-tsh", "TSH", "Temperature switch high", "Temperature"),

  // --- Level -------------------------------------------------------------
  "instrument-li": instrumentSymbol("instrument-li", "LI", "Level indicator", "Level"),
  "instrument-lt": instrumentSymbol("instrument-lt", "LT", "Level transmitter", "Level"),
  "instrument-lic": instrumentSymbol("instrument-lic", "LIC", "Level indicating controller", "Level"),
  "instrument-lg": instrumentSymbol("instrument-lg", "LG", "Level gauge (sight)", "Level"),
  "instrument-lsl": instrumentSymbol("instrument-lsl", "LSL", "Level switch low", "Level"),
  "instrument-lsh": instrumentSymbol("instrument-lsh", "LSH", "Level switch high", "Level"),

  // --- Analysis & misc ---------------------------------------------------
  "instrument-ai": instrumentSymbol("instrument-ai", "AI", "Analysis indicator", "Analysis & misc"),
  "instrument-at": instrumentSymbol("instrument-at", "AT", "Analysis transmitter", "Analysis & misc"),
  "instrument-dt": instrumentSymbol("instrument-dt", "DT", "Density transmitter", "Analysis & misc"),
  "instrument-vt": instrumentSymbol("instrument-vt", "VT", "Vibration transmitter", "Analysis & misc"),
  "instrument-st": instrumentSymbol("instrument-st", "ST", "Speed transmitter", "Analysis & misc"),
  "instrument-hs": instrumentSymbol("instrument-hs", "HS", "Hand switch", "Analysis & misc"),
  "instrument-esd": instrumentSymbol("instrument-esd", "ESD", "Emergency shutdown", "Analysis & misc"),
};

export const CATEGORY_LABELS: Record<SymbolCategory, string> = {
  equipment: "Equipment",
  valve: "Valves",
  filter: "Filters & strainers",
  inline: "Inline & fittings",
  instrument: "Instruments",
  connector: "Connectors",
};

/** Render order for the palette. */
export const CATEGORY_ORDER: SymbolCategory[] = [
  "equipment",
  "valve",
  "filter",
  "inline",
  "instrument",
  "connector",
];

/** Display order for subcategories within each category. */
export const SUBCATEGORY_ORDER: Partial<Record<SymbolCategory, string[]>> = {
  equipment: [
    "Pumps",
    "Compressors & blowers",
    "Tanks & vessels",
    "Heat transfer",
    "Separation & columns",
    "Mixing",
  ],
  valve: [
    "Isolation",
    "Check",
    "Actuated & control",
    "Pressure relief & safety",
    "Specialty",
  ],
  inline: [
    "Flow elements",
    "Traps & vents",
    "Sample & sight",
    "Mechanical",
  ],
  instrument: ["Pressure", "Flow", "Temperature", "Level", "Analysis & misc"],
  connector: ["Connectors"],
};

export function getSymbol(type: string): SymbolDef | undefined {
  return SYMBOL_REGISTRY[type];
}

export function symbolsByCategory(category: SymbolCategory): SymbolDef[] {
  return Object.values(SYMBOL_REGISTRY).filter((s) => s.category === category);
}

export function groupedSubcategories(
  category: SymbolCategory,
): { name: string; symbols: SymbolDef[] }[] {
  const symbols = symbolsByCategory(category);
  const order = SUBCATEGORY_ORDER[category] ?? [];
  const groups = new Map<string, SymbolDef[]>();
  for (const s of symbols) {
    const key = s.subcategory ?? "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  const keys: string[] = [];
  for (const k of order) if (groups.has(k)) keys.push(k);
  for (const k of [...groups.keys()].sort()) {
    if (!keys.includes(k)) keys.push(k);
  }
  return keys.map((name) => ({ name, symbols: groups.get(name)! }));
}

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
import {
  BiomassCollectionVessel,
  BioreactorRaceway,
  ChemicalDrum,
  IbcContainer,
  MovingBedBioreactor,
  OxygenCone,
  PaddlewheelAerator,
  ProteinSkimmer,
  RoundCultureTank,
  SettlingCone,
  TubularPhotobioreactor,
} from "@/symbols/equipment/aquaculture";

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
  PrimingValve,
  RuptureDisc,
  SolenoidValve,
  ThreeWayValve,
} from "@/symbols/valves/extra";

import {
  BagFilter,
  BasketStrainer,
  CartridgeFilter,
  DrumFilter,
  DuplexFilter,
  SandFilter,
  SimplexFilter,
  TStrainer,
  VibrationFilter,
  YStrainer,
} from "@/symbols/filters";

import {
  AirDiffuser,
  AirVent,
  Co2Injector,
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
  UvSterilizer,
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
import { PIPE_MATERIAL_OPTIONS, PIPE_NOMINAL_OPTIONS } from "@/presets/pipes";

const PIPE_MATERIAL_LABELS = PIPE_MATERIAL_OPTIONS.map((m) => m.label);
const PIPE_NOMINAL_LABELS = PIPE_NOMINAL_OPTIONS.map((n) => n.label);
const DEFAULT_TEE_SIZE = PIPE_NOMINAL_LABELS[4]; // DN40
const DEFAULT_TEE_MATERIAL = PIPE_MATERIAL_LABELS[0]; // PVC / HDPE

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

  // --- Bioreactors & aquaculture ----------------------------------------
  // Open / closed cultivation systems for algae, fish, and shrimp. Hydraulic
  // models treat them as vessels (no internal ΔP at v1) unless an explicit
  // deltaPbar is set per node.
  "bioreactor-raceway": {
    type: "bioreactor-raceway",
    category: "equipment",
    subcategory: "Bioreactors & aquaculture",
    label: "Raceway pond bioreactor",
    description:
      "Paddlewheel-driven raceway pond for open algae cultivation.",
    size: { width: 144, height: 96 },
    ports: [
      { id: "feed", side: "left", position: 0.3 },
      { id: "harvest", side: "right", position: 0.7 },
      { id: "co2", side: "top", position: 0.3 },
      { id: "drain", side: "bottom", position: 0.5 },
    ],
    tagPrefix: "BR",
    engineModel: "vessel",
    Icon: BioreactorRaceway,
    defaultLabel: "BR-101",
    paramSchema: [
      {
        key: "depthM",
        label: "Pond depth",
        unit: "m",
        kind: "number",
        default: 0.3,
        min: 0,
      },
      {
        key: "areaM2",
        label: "Surface area",
        unit: "m²",
        kind: "number",
        default: 100,
        min: 0,
      },
      {
        key: "paddlewheelKW",
        label: "Paddlewheel power",
        unit: "kW",
        kind: "number",
        default: 1.5,
        min: 0,
      },
    ],
    defaultParams: { depthM: 0.3, areaM2: 100, paddlewheelKW: 1.5 },
  },
  "tubular-photobioreactor": {
    type: "tubular-photobioreactor",
    category: "equipment",
    subcategory: "Bioreactors & aquaculture",
    label: "Tubular photobioreactor",
    description: "Closed serpentine PBR for high-density algae cultivation.",
    size: { width: 96, height: 80 },
    ports: [
      { id: "feed", side: "left", position: 0.3 },
      { id: "harvest", side: "right", position: 0.8 },
      { id: "gas-in", side: "top", position: 0.2 },
      { id: "gas-out", side: "top", position: 0.8 },
    ],
    tagPrefix: "PBR",
    engineModel: "passive",
    Icon: TubularPhotobioreactor,
    defaultLabel: "PBR-101",
    paramSchema: [
      {
        key: "volumeM3",
        label: "Working volume",
        unit: "m³",
        kind: "number",
        default: 1,
        min: 0,
      },
      {
        key: "tubeLengthM",
        label: "Total tube length",
        unit: "m",
        kind: "number",
        default: 200,
        min: 0,
      },
      {
        key: "deltaPbar",
        label: "Loop ΔP",
        unit: "bar",
        kind: "number",
        min: 0,
        description: "Leave blank for a typical 0.2 bar serpentine loss.",
      },
    ],
    defaultParams: { volumeM3: 1, tubeLengthM: 200 },
    hydraulics: { lossModel: "deltaP", defaultDeltaPbar: 0.2 },
  },
  "round-culture-tank": {
    type: "round-culture-tank",
    category: "equipment",
    subcategory: "Bioreactors & aquaculture",
    label: "Round culture tank",
    description: "Circular tank with centre drain — fish or shrimp culture.",
    size: { width: 96, height: 96 },
    ports: [
      { id: "inlet", side: "left", position: 0.5 },
      { id: "centre-drain", side: "bottom", position: 0.5 },
      { id: "overflow", side: "top", position: 0.5 },
      { id: "sample", side: "right", position: 0.5 },
    ],
    tagPrefix: "CT",
    engineModel: "vessel",
    Icon: RoundCultureTank,
    defaultLabel: "CT-101",
    paramSchema: [
      {
        key: "volumeM3",
        label: "Working volume",
        unit: "m³",
        kind: "number",
        default: 10,
        min: 0,
      },
      {
        key: "diameterM",
        label: "Inside diameter",
        unit: "m",
        kind: "number",
        default: 3,
        min: 0,
      },
    ],
    defaultParams: { volumeM3: 10, diameterM: 3 },
  },
  "moving-bed-bioreactor": {
    type: "moving-bed-bioreactor",
    category: "equipment",
    subcategory: "Bioreactors & aquaculture",
    label: "Moving-bed bioreactor (MBBR)",
    description: "Aerated tank with floating biofilm carriers (nitrification).",
    size: { width: 80, height: 96 },
    ports: [
      { id: "in", side: "left", position: 0.3 },
      { id: "out", side: "right", position: 0.3 },
      { id: "air", side: "bottom", position: 0.5 },
    ],
    tagPrefix: "BF",
    engineModel: "vessel",
    Icon: MovingBedBioreactor,
    defaultLabel: "BF-101",
    paramSchema: [
      {
        key: "volumeM3",
        label: "Working volume",
        unit: "m³",
        kind: "number",
        default: 4,
        min: 0,
      },
      {
        key: "carrierFillPct",
        label: "Carrier fill",
        unit: "%",
        kind: "number",
        default: 50,
        min: 0,
        max: 70,
      },
    ],
    defaultParams: { volumeM3: 4, carrierFillPct: 50 },
  },
  "protein-skimmer": {
    type: "protein-skimmer",
    category: "equipment",
    subcategory: "Bioreactors & aquaculture",
    label: "Protein skimmer (foam fractionator)",
    description: "Air-injection column that strips dissolved organics.",
    size: { width: 64, height: 112 },
    ports: [
      { id: "in", side: "right", position: 0.7 },
      { id: "out", side: "bottom", position: 0.5 },
      { id: "foam", side: "top", position: 0.5 },
      { id: "air", side: "bottom", position: 0.3 },
    ],
    tagPrefix: "PS",
    engineModel: "passive",
    Icon: ProteinSkimmer,
    defaultLabel: "PS-101",
    paramSchema: [
      {
        key: "throughputM3H",
        label: "Rated throughput",
        unit: "m³/h",
        kind: "number",
        default: 4,
        min: 0,
      },
      {
        key: "deltaPbar",
        label: "ΔP",
        unit: "bar",
        kind: "number",
        min: 0,
        description: "Leave blank for a typical 0.05 bar drop.",
      },
    ],
    defaultParams: { throughputM3H: 4 },
    hydraulics: { lossModel: "deltaP", defaultDeltaPbar: 0.05 },
  },
  "paddlewheel-aerator": {
    type: "paddlewheel-aerator",
    category: "equipment",
    subcategory: "Bioreactors & aquaculture",
    label: "Paddlewheel aerator",
    description:
      "Surface aerator commonly used in shrimp ponds and raceways.",
    size: { width: 96, height: 80 },
    ports: [{ id: "air", side: "bottom", position: 0.5 }],
    tagPrefix: "PA",
    engineModel: "passive",
    Icon: PaddlewheelAerator,
    defaultLabel: "PA-101",
    paramSchema: [
      {
        key: "powerKW",
        label: "Motor power",
        unit: "kW",
        kind: "number",
        default: 2,
        min: 0,
      },
      {
        key: "rpm",
        label: "Wheel speed",
        unit: "rpm",
        kind: "number",
        default: 90,
        min: 0,
      },
    ],
    defaultParams: { powerKW: 2, rpm: 90 },
  },
  "oxygen-cone": {
    type: "oxygen-cone",
    category: "equipment",
    subcategory: "Bioreactors & aquaculture",
    label: "Oxygen cone (low-head oxygenator)",
    description: "Pressurised cone for dissolving pure O₂ into water (RAS).",
    size: { width: 80, height: 112 },
    ports: [
      { id: "water-in", side: "top", position: 0.5 },
      { id: "oxygen-in", side: "left", position: 0.25 },
      { id: "water-out", side: "bottom", position: 0.5 },
    ],
    tagPrefix: "OX",
    engineModel: "passive",
    Icon: OxygenCone,
    defaultLabel: "OX-101",
    paramSchema: [
      {
        key: "ratedFlowM3H",
        label: "Rated throughput",
        unit: "m³/h",
        kind: "number",
        default: 10,
        min: 0,
      },
      {
        key: "deltaPbar",
        label: "ΔP",
        unit: "bar",
        kind: "number",
        min: 0,
        description: "Leave blank for a typical 0.4 bar drop.",
      },
    ],
    defaultParams: { ratedFlowM3H: 10 },
    hydraulics: { lossModel: "deltaP", defaultDeltaPbar: 0.4 },
  },
  "settling-cone": {
    type: "settling-cone",
    category: "equipment",
    subcategory: "Bioreactors & aquaculture",
    label: "Settling cone / clarifier",
    description:
      "Cone-bottom settler — biomass thickening and water clarification.",
    size: { width: 80, height: 96 },
    ports: [
      { id: "feed", side: "top", position: 0.5 },
      { id: "overflow", side: "right", position: 0.15 },
      { id: "underflow", side: "bottom", position: 0.5 },
    ],
    tagPrefix: "SC",
    engineModel: "vessel",
    Icon: SettlingCone,
    defaultLabel: "SC-101",
    paramSchema: [
      {
        key: "volumeM3",
        label: "Volume",
        unit: "m³",
        kind: "number",
        default: 2,
        min: 0,
      },
    ],
    defaultParams: { volumeM3: 2 },
  },
  "biomass-collection-vessel": {
    type: "biomass-collection-vessel",
    category: "equipment",
    subcategory: "Bioreactors & aquaculture",
    label: "Biomass collection vessel",
    description:
      "Cone-bottom holding vessel for harvested algae / wet biomass.",
    size: { width: 80, height: 112 },
    ports: [
      { id: "feed", side: "top", position: 0.5 },
      { id: "vent", side: "top", position: 0.25 },
      { id: "side-in", side: "right", position: 0.3 },
      { id: "drain", side: "bottom", position: 0.5 },
    ],
    tagPrefix: "BV",
    engineModel: "vessel",
    Icon: BiomassCollectionVessel,
    defaultLabel: "BV-101",
    paramSchema: [
      {
        key: "volumeM3",
        label: "Volume",
        unit: "m³",
        kind: "number",
        default: 1,
        min: 0,
      },
    ],
    defaultParams: { volumeM3: 1 },
  },

  // --- Storage & containers ---------------------------------------------
  // Standalone holding / shipping containers, distinct from fixed plant
  // vessels. Often gravity-feed sources of chemicals and bulk media.
  "ibc-container": {
    type: "ibc-container",
    category: "equipment",
    subcategory: "Storage & containers",
    label: "IBC tote (1000 L)",
    description: "Caged plastic intermediate-bulk container on a pallet base.",
    size: { width: 96, height: 96 },
    ports: [
      { id: "fill", side: "top", position: 0.25 },
      { id: "vent", side: "top", position: 0.75 },
      { id: "outlet", side: "bottom", position: 0.85 },
    ],
    tagPrefix: "IBC",
    engineModel: "vessel",
    Icon: IbcContainer,
    defaultLabel: "IBC-101",
    paramSchema: [
      {
        key: "volumeM3",
        label: "Capacity",
        unit: "m³",
        kind: "number",
        default: 1,
        min: 0,
      },
      {
        key: "contents",
        label: "Contents",
        kind: "text",
        default: "Process chemical",
      },
    ],
    defaultParams: { volumeM3: 1, contents: "Process chemical" },
  },
  "chemical-drum": {
    type: "chemical-drum",
    category: "equipment",
    subcategory: "Storage & containers",
    label: "Chemical drum (200 L)",
    description: "Standard 55 gal / 200 L steel or plastic drum.",
    size: { width: 64, height: 96 },
    ports: [
      { id: "bung", side: "top", position: 0.5 },
      { id: "vent", side: "top", position: 0.75 },
      { id: "outlet", side: "bottom", position: 0.5 },
    ],
    tagPrefix: "DR",
    engineModel: "vessel",
    Icon: ChemicalDrum,
    defaultLabel: "DR-101",
    paramSchema: [
      {
        key: "volumeM3",
        label: "Capacity",
        unit: "m³",
        kind: "number",
        default: 0.2,
        min: 0,
      },
      {
        key: "contents",
        label: "Contents",
        kind: "text",
        default: "Process chemical",
      },
    ],
    defaultParams: { volumeM3: 0.2, contents: "Process chemical" },
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
  // Self-priming pumps and gravity-fed suction lines need a fill port to
  // charge the pump with liquid before startup — that's this glyph. Vents
  // back to atmosphere when fully open, so we treat it as a hand valve with
  // a slightly higher K (the funnel restricts at the seat).
  "priming-valve": inlineValve(
    "priming-valve",
    "Isolation",
    "Priming valve",
    "PV",
    PrimingValve,
    { lossModel: "k", defaultK: 1.5 },
    { defaultLabel: "PV-101" },
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

  // --- Solids separation (aquaculture / process) -------------------------
  // Both of these split the feed into two streams (filtrate + rejects), so
  // we override INLINE_PORTS with explicit 1-in / 2-out topology.
  "vibration-filter": filterSymbol(
    "vibration-filter",
    "Vibration filter (shaker screen)",
    "VF",
    VibrationFilter,
    { lossModel: "k", defaultK: 7.0 },
    {
      subcategory: "Solids separation",
      size: { width: 80, height: 64 },
      ports: [
        { id: "in", side: "left", position: 0.35 },
        { id: "filtrate", side: "right", position: 0.5 },
        { id: "reject", side: "bottom", position: 0.75 },
      ],
    },
  ),
  "drum-filter": filterSymbol(
    "drum-filter",
    "Rotary drum filter",
    "DF",
    DrumFilter,
    { lossModel: "k", defaultK: 5.0 },
    {
      subcategory: "Solids separation",
      size: { width: 80, height: 80 },
      ports: [
        { id: "in", side: "left", position: 0.35 },
        { id: "filtrate", side: "right", position: 0.7 },
        { id: "reject", side: "bottom", position: 0.5 },
        { id: "backwash", side: "top", position: 0.5 },
      ],
    },
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

  // --- Disinfection & gas transfer --------------------------------------
  // Inline devices that change water/process chemistry without removing
  // solids. UV pulls a modest pressure drop from its quartz sleeve; the gas
  // injectors are modeled as low-K elements driven by a separate gas feed.
  "uv-sterilizer": inlineFitting(
    "uv-sterilizer",
    "Disinfection & gas",
    "UV sterilizer",
    UvSterilizer,
    { lossModel: "k", defaultK: 2 },
    {
      size: { width: 64, height: 64 },
      tagPrefix: "UV",
      defaultLabel: "UV-101",
      paramSchema: [
        {
          key: "lampPowerW",
          label: "Lamp power",
          unit: "W",
          kind: "number",
          default: 80,
          min: 0,
        },
        {
          key: "uvDoseMjCm2",
          label: "UV dose",
          unit: "mJ/cm²",
          kind: "number",
          default: 40,
          min: 0,
        },
        {
          key: "K",
          label: "Loss coefficient K",
          kind: "number",
          min: 0,
          description: "Leave blank for ~2 (clean quartz sleeve).",
        },
      ],
      defaultParams: { lampPowerW: 80, uvDoseMjCm2: 40 },
    },
  ),
  "co2-injector": inlineFitting(
    "co2-injector",
    "Disinfection & gas",
    "CO₂ injector",
    Co2Injector,
    { lossModel: "k", defaultK: 1.5 },
    {
      size: { width: 56, height: 56 },
      tagPrefix: "CI",
      defaultLabel: "CI-101",
      ports: [
        { id: "in", side: "left", position: 0.6 },
        { id: "out", side: "right", position: 0.6 },
        { id: "gas", side: "top", position: 0.45 },
      ],
      paramSchema: [
        {
          key: "gasFlowNm3H",
          label: "Gas flow",
          unit: "Nm³/h",
          kind: "number",
          default: 1,
          min: 0,
        },
        {
          key: "K",
          label: "Loss coefficient K",
          kind: "number",
          min: 0,
          description: "Leave blank for ~1.5 (diffuser tee).",
        },
      ],
      defaultParams: { gasFlowNm3H: 1 },
    },
  ),
  "air-diffuser": inlineFitting(
    "air-diffuser",
    "Disinfection & gas",
    "Air / O₂ diffuser",
    AirDiffuser,
    undefined,
    {
      size: { width: 56, height: 64 },
      tagPrefix: "AD",
      defaultLabel: "AD-101",
      ports: [{ id: "gas", side: "left", position: 0.8 }],
      paramSchema: [
        {
          key: "ratedFlowNm3H",
          label: "Rated air flow",
          unit: "Nm³/h",
          kind: "number",
          default: 2,
          min: 0,
        },
        {
          key: "porePitchMm",
          label: "Pore pitch",
          unit: "mm",
          kind: "number",
          default: 1,
          min: 0,
        },
      ],
      defaultParams: { ratedFlowNm3H: 2, porePitchMm: 1 },
    },
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
    tagPrefix: "T",
    // A real, purchaseable fitting: carries a pipe size + material and lists in
    // the BOM like any other component.
    countInBom: true,
    paramSchema: [
      {
        key: "material",
        label: "Material",
        kind: "select",
        options: PIPE_MATERIAL_LABELS,
        default: DEFAULT_TEE_MATERIAL,
        group: "Pipe spec",
      },
      {
        key: "nominalDn",
        label: "Size",
        kind: "select",
        options: PIPE_NOMINAL_LABELS,
        default: DEFAULT_TEE_SIZE,
        group: "Pipe spec",
      },
    ],
    defaultParams: { material: DEFAULT_TEE_MATERIAL, nominalDn: DEFAULT_TEE_SIZE },
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
    "Bioreactors & aquaculture",
    "Storage & containers",
  ],
  valve: [
    "Isolation",
    "Check",
    "Actuated & control",
    "Pressure relief & safety",
    "Specialty",
  ],
  filter: ["Solids separation"],
  inline: [
    "Flow elements",
    "Traps & vents",
    "Sample & sight",
    "Mechanical",
    "Disinfection & gas",
  ],
  instrument: ["Pressure", "Flow", "Temperature", "Level", "Analysis & misc"],
  connector: ["Connectors"],
};

export function getSymbol(type: string): SymbolDef | undefined {
  return SYMBOL_REGISTRY[type];
}

/**
 * Plain-language "what is this and what does it do" blurb shown when hovering a
 * palette symbol. Instruments are decoded from their ISA-5.1 tag rather than
 * listed one-by-one (see `instrumentHelp`).
 */
export const SYMBOL_HELP: Record<string, string> = {
  /* Pumps */
  "centrifugal-pump":
    "The workhorse pump — a spinning impeller flings liquid outward to add pressure. Great for moving lots of clean-ish liquid; flow falls as the head it must push against rises.",
  "vertical-centrifugal-pump":
    "A centrifugal pump on a vertical shaft, motor on top. Saves floor space and suits sump / inline duties.",
  "submersible-pump":
    "A pump that sits underwater with the liquid it's moving, motor sealed inside. Common for boreholes, sumps and wells — no priming needed.",
  "gear-pump":
    "A positive-displacement pump using meshing gears to push a fixed slug of fluid per turn. Smooth, steady flow — ideal for viscous liquids and dosing.",
  "piston-pump":
    "A reciprocating positive-displacement pump — a piston draws in and pushes out liquid. Delivers high pressure; flow pulses with each stroke.",
  "screw-pump":
    "A progressive-cavity / screw pump that gently moves fluid along rotating screws. Handles thick, shear-sensitive or solids-laden liquids with low pulsation.",
  "diaphragm-pump":
    "A flexing diaphragm draws and expels fluid, so nothing leaks past a shaft seal. Perfect for nasty, abrasive or hazardous fluids.",
  "peristaltic-pump":
    "A roller squeezes a flexible tube to push fluid along — the liquid only ever touches the tube. Excellent for precise, sterile or chemical dosing.",
  "vacuum-pump":
    "Removes gas from a system to create vacuum, rather than moving liquid.",
  "pd-pump":
    "A generic positive-displacement pump — moves a fixed volume per cycle, so flow stays roughly constant regardless of pressure.",

  /* Compressors & blowers */
  "centrifugal-compressor":
    "Raises gas pressure with a high-speed impeller. Smooth, high-flow gas compression for continuous duty.",
  "reciprocating-compressor":
    "A piston compressor for high-pressure gas. Delivers in pulses; great for high compression ratios at modest flow.",
  "screw-compressor":
    "A rotary-screw compressor — two meshing rotors give continuous, oil-flooded or oil-free gas compression.",
  fan: "A fan / blower moves large volumes of air or gas at low pressure rise — ventilation, combustion air, aeration.",

  /* Tanks & vessels */
  "vessel-vertical":
    "A vertical pressure vessel with dished ends — used for surge, separation or as a process drum.",
  "vessel-horizontal":
    "A horizontal pressure vessel with dished ends — gives a large liquid surface for separation or buffering.",
  "tank-horizontal":
    "A horizontal storage tank for bulk liquid.",
  "open-top-tank":
    "An open-topped tank, vented to atmosphere — for non-volatile liquids at ambient pressure.",
  "cone-roof-tank":
    "An atmospheric storage tank with a fixed conical roof — standard for bulk liquid storage.",
  "floating-roof-tank":
    "A storage tank whose roof floats on the liquid surface, cutting vapour losses on volatile products like fuels.",
  "spherical-tank":
    "A sphere — the strongest shape for storing gases or volatiles under pressure (LPG, etc.).",
  silo: "A silo / hopper for storing and discharging dry bulk solids or powders.",

  /* Heat transfer */
  "heat-exchanger":
    "A shell & tube heat exchanger — transfers heat between two fluids kept apart by tube walls. The plant's general-purpose heater/cooler.",
  "plate-heat-exchanger":
    "Stacked thin plates give a huge heat-transfer area in a small box — compact, efficient, easy to clean.",
  "air-cooled-exchanger":
    "A fin-fan cooler — fans blow ambient air over finned tubes to reject process heat without cooling water.",
  "kettle-reboiler":
    "Boils up liquid at the bottom of a distillation column to generate the vapour that drives separation.",
  condenser:
    "Cools and condenses vapour back to liquid — typically the overheads of a column or a refrigeration loop.",
  "fired-heater":
    "A furnace that burns fuel to heat a process fluid directly in tubes — for high-temperature duties.",
  "cooling-tower":
    "Rejects waste heat to atmosphere by evaporating a little of the cooling water. The site's heat sink.",

  /* Separation & columns */
  column:
    "A tray distillation column — separates a mixture into fractions by repeated boiling and condensing up the trays.",
  "packed-column":
    "A column filled with packing instead of trays — separation or absorption with a low pressure drop.",
  "cyclone-separator":
    "Spins the fluid so heavier solids/droplets fling to the wall and drop out — no moving parts.",
  "two-phase-separator":
    "A vessel that lets gas and liquid disengage and leave by separate outlets.",
  "three-phase-separator":
    "Separates gas, oil/organic and water into three streams by letting them settle out.",
  "knockout-drum":
    "A vessel that 'knocks out' entrained liquid from a gas stream to protect downstream compressors/flares.",

  /* Mixing */
  "static-mixer":
    "Fixed internal elements blend two streams as they flow through — mixing with no moving parts.",
  "agitated-tank":
    "A tank with a powered impeller to keep contents mixed, suspended or reacting.",

  /* Bioreactors & aquaculture */
  "bioreactor-raceway":
    "An open raceway pond where a paddlewheel circulates algae culture under sunlight — the classic low-cost algae growth system.",
  "tubular-photobioreactor":
    "A closed loop of transparent tubes for high-density algae growth with tight control and low contamination.",
  "round-culture-tank":
    "A circular culture / grow-out tank for algae or aquaculture.",
  "moving-bed-bioreactor":
    "A tank filled with carrier media that microbes grow on (MBBR) — used for biological water treatment.",
  "protein-skimmer":
    "Uses fine bubbles to strip dissolved organics and proteins out of water — common in aquaculture and aquaria.",
  "paddlewheel-aerator":
    "A surface paddlewheel that both circulates and aerates pond water by churning the surface.",
  "oxygen-cone":
    "A cone that dissolves pure oxygen into a water stream under pressure for high transfer efficiency.",
  "settling-cone":
    "A cone-bottomed vessel where solids settle and concentrate at the tip for draw-off.",
  "biomass-collection-vessel":
    "A vessel that collects and holds harvested biomass slurry.",
  "ibc-container":
    "An Intermediate Bulk Container (IBC) — the ~1 m³ caged tote for transporting and storing liquids.",
  "chemical-drum":
    "A standard chemical drum for storing or dosing smaller quantities of process chemicals.",

  /* Valves — isolation */
  "gate-valve":
    "An isolation valve with a sliding gate — fully open or fully shut. Very low pressure drop when open; not for throttling.",
  "ball-valve":
    "A quarter-turn valve with a bored ball — quick, tight shut-off and almost no restriction when open.",
  "butterfly-valve":
    "A quarter-turn disc valve — compact and cheap for larger lines; can isolate and roughly throttle.",
  "plug-valve":
    "A quarter-turn tapered/cylindrical plug — robust isolation, good for slurries and frequent operation.",
  "diaphragm-valve":
    "A flexible diaphragm seals against a weir — no crevices, so ideal for sterile, hygienic or corrosive duties.",
  "pinch-valve":
    "Pinches a flexible sleeve shut — the only wetted part is the sleeve, perfect for slurries and abrasives.",
  "needle-valve":
    "A fine-tapered stem gives precise low-flow throttling — for sampling, instruments and metering.",
  "hand-valve":
    "A generic manually-operated valve where the exact type isn't specified.",
  "priming-valve":
    "A small fill/vent valve used to charge a pump with liquid before start-up (self-priming / suction lift).",

  /* Valves — specialty */
  "globe-valve":
    "A valve built for throttling — flow turns through a globe-shaped seat. Good control, higher pressure drop.",
  "angle-valve":
    "A globe-type throttling valve with inlet and outlet at 90°, saving an elbow.",
  "three-way-valve":
    "One valve, three ports — diverts flow to one of two paths or mixes two streams into one.",

  /* Valves — check */
  "check-valve":
    "A non-return (swing) valve — lets flow go one way and slams shut if it tries to reverse.",
  "lift-check-valve":
    "A check valve whose disc lifts off its seat with forward flow and drops back to block reverse flow.",
  "foot-valve":
    "A check valve with a strainer on a pump's suction inlet — keeps the line primed and debris out.",

  /* Valves — actuated & control */
  "control-valve":
    "An automatically-actuated valve that throttles flow to a setpoint from the control system — the final element of most control loops.",
  "motor-operated-valve":
    "A valve driven open/closed by an electric motor actuator (MOV) for remote operation.",
  "solenoid-valve":
    "An electrically-operated on/off valve — energise the coil to switch flow. Fast, common in interlocks.",
  "pressure-regulator":
    "A self-acting valve that holds a set downstream pressure regardless of upstream changes.",

  /* Valves — relief & safety */
  "relief-valve":
    "A safety valve that pops open if pressure exceeds its set point, protecting equipment from over-pressure.",
  "rupture-disc":
    "A one-shot burst disc that ruptures at a set pressure for instant over-pressure relief.",
  "breather-valve":
    "A pressure/vacuum vent that lets a tank breathe as it fills/empties while limiting vapour loss.",
  "flame-arrestor":
    "A mesh device that lets gas pass but quenches any flame, stopping a fire propagating along the line.",

  /* Filters & strainers */
  "y-strainer":
    "A Y-shaped body holding a screen that catches debris — protects pumps and valves. Low cost, cleanable.",
  "t-strainer":
    "An inline T-body strainer for larger lines — screens out solids with easy basket access.",
  "basket-strainer":
    "A larger basket screen for higher dirt loads — the basket lifts out for cleaning.",
  "simplex-filter":
    "A single filter housing for fine filtration — must be taken offline to change the element.",
  "duplex-filter":
    "Two filter housings with a changeover valve — switch to the spare and clean one without stopping flow.",
  "bag-filter":
    "A filter bag in a housing catches fine solids — high dirt capacity, swap the bag when it loads up.",
  "cartridge-filter":
    "Replaceable cartridge elements for fine/polishing filtration.",
  "sand-filter":
    "A bed of sand/media for bulk water clarification — backwashed to clean.",
  "vibration-filter":
    "A vibrating-screen filter that shakes solids across a mesh to separate them from liquid.",
  "drum-filter":
    "A rotating drum screen — continuous fine solids removal, common in aquaculture and water treatment.",

  /* Inline — flow elements */
  "orifice-plate":
    "A plate with a precise hole — the pressure drop across it is measured to infer flow rate. Cheap and standard.",
  venturi:
    "A smooth contraction/expansion that measures flow from its pressure drop with far less permanent loss than an orifice.",
  rotameter:
    "A variable-area flow meter — a float rises in a tapered tube to show flow at a glance.",
  "pitot-probe":
    "A probe that senses velocity pressure in the line to infer flow.",

  /* Inline — traps & vents */
  "steam-trap":
    "Automatically drains condensate from steam lines while holding back live steam.",
  "air-vent":
    "Lets trapped air/gas escape from a high point so it doesn't airlock the line.",
  drain: "A low-point drain for emptying or removing condensate/sediment from a line.",

  /* Inline — sample & sight */
  "sight-glass":
    "A clear window in the line so operators can see flow, colour or level.",
  "sample-point":
    "A tapping fitted with a valve to draw a representative sample of the process fluid.",

  /* Inline — mechanical */
  "concentric-reducer":
    "Changes pipe size on a shared centreline — used on vertical runs and where symmetry suits.",
  "eccentric-reducer":
    "Changes pipe size with one flat side — keeps a flat top (or bottom) to avoid trapping gas or liquid on pump suctions.",
  "expansion-joint":
    "A flexible section that absorbs thermal growth, vibration or slight misalignment.",
  "spectacle-blind":
    "A figure-8 plate swung between flanges to positively blank off or open a line for isolation.",
  "pipe-cap":
    "Seals the end of a pipe — a dead end or future tie-in point.",

  /* Inline — disinfection & gas */
  "spray-nozzle":
    "Atomises liquid into a spray pattern — washing, cooling, scrubbing or dosing.",
  "uv-sterilizer":
    "Passes fluid past UV lamps to kill microorganisms without chemicals.",
  "co2-injector":
    "Injects and dissolves CO₂ into a liquid stream — for pH control or feeding algae cultures.",
  "air-diffuser":
    "Releases fine air bubbles to aerate / oxygenate liquid (aeration tanks, ponds).",

  /* Connectors */
  "tap-point":
    "A process-line tap where an instrument connection is taken off the pipe.",
  "pipe-tee":
    "A tee junction joining or splitting flow between three pipe runs.",
  "off-page-connector":
    "A reference flag showing a line continues on another drawing/page — keeps big systems readable.",
};

/** Decodes an ISA-5.1 instrument into a readable "what it does" sentence. */
function instrumentHelp(symbol: SymbolDef): string {
  const m = symbol.description?.match(/^(\S+)\s*\((.+)\)$/);
  const code = m?.[1] ?? symbol.tagPrefix ?? "";
  const name = m?.[2] ?? symbol.label;
  const lower = name.toLowerCase();
  let role: string;
  if (lower.includes("indicating controller"))
    role =
      "compares the reading to a setpoint and drives a final element (e.g. a control valve) to hold it";
  else if (lower.includes("controller"))
    role = "regulates the variable to a setpoint via a final element";
  else if (lower.includes("transmitter"))
    role =
      "measures the variable and sends a 4–20 mA / digital signal to the control system";
  else if (lower.includes("indicator"))
    role = "displays the value locally for the operator";
  else if (lower.includes("element"))
    role = "is the primary sensor the rest of the loop reads";
  else if (lower.includes("totaliser") || lower.includes("totalizer"))
    role = "integrates flow over time to give a running total";
  else if (lower.includes("switch low"))
    role = "trips a contact when the value falls below its limit (alarm / interlock)";
  else if (lower.includes("switch high"))
    role = "trips a contact when the value rises above its limit (alarm / interlock)";
  else if (lower.includes("alarm low"))
    role = "annunciates when the value falls below its limit";
  else if (lower.includes("gauge"))
    role = "gives a direct local indication";
  else if (lower.includes("emergency shutdown"))
    role = "initiates a safe shutdown when triggered";
  else if (lower.includes("hand switch"))
    role = "is an operator-actuated switch in the control scheme";
  else role = "monitors this process variable";
  return `${name} (${code}) — ${role}. Drawn as an ISA-5.1 balloon; the dashed signal line shows where it connects.`;
}

/** "What is it / what does it do" help text for a palette symbol. */
export function getSymbolHelp(symbol: SymbolDef): string {
  const explicit = SYMBOL_HELP[symbol.type];
  if (explicit) return explicit;
  if (symbol.type.startsWith("instrument-")) return instrumentHelp(symbol);
  return symbol.description ?? symbol.label;
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

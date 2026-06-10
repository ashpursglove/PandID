import type {
  ElecCategory,
  ElecNodeData,
  ElecParamField,
  ElecSymbolDef,
  PortDef,
} from "@/electrical/types";
import { STANDARD_DEVICE_RATINGS_A } from "./cablePresets";

import {
  Battery,
  Generator,
  PvInverter,
  Ups,
  UtilityIncomer,
} from "./icons/sources";
import {
  AutoTransformer,
  Transformer2W,
  Transformer3W,
} from "./icons/transformers";
import {
  CircuitBreaker,
  CircuitBreakerSpare,
  Contactor,
  ControlSwitch,
  EmergencyStop,
  Fuse,
  FusedSwitch,
  HoaSwitch,
  Isolator1P,
  Isolator3P,
  KeySwitch,
  LimitSwitch,
  Mcb,
  McbSpare,
  Mccb,
  MccbSpare,
  ProtectionRelay,
  PushButton,
  SelectorSwitch,
  SwitchDisconnector,
  ThermalOverload,
  TwoWaySwitch,
} from "./icons/protection";
import { Busbar, BusTie, DistributionBoard, Mcc } from "./icons/distribution";
import { MotorStarter, SoftStarter, Vfd } from "./icons/drives";
import {
  CapacitorBank,
  GenericLoad,
  Heater,
  LightingLoad,
  Motor,
  SocketLoad,
  VibrationFilter,
} from "./icons/loads";
import {
  CentrifugalPump,
  DiaphragmPump,
  PeristalticPump,
  ProgressiveCavityPump,
  SumpPump,
} from "./icons/pumps";
import {
  CurrentTransformer,
  GdtSensorBox,
  Meter,
  VoltageTransformer,
} from "./icons/instruments";
import { EarthElectrode, Spd } from "./icons/earthing";
import {
  Cctv,
  ChangeoverSwitch,
  ChargeController,
  EarthBar,
  EmergencyLight,
  EvCharger,
  Fan,
  FireAlarmPanel,
  Floodlight,
  Hvac,
  JunctionBox,
  Mpcb,
  MpcbSpare,
  Plc,
  PvArray,
  Rcbo,
  Rcd,
  WaterHeater,
  WindTurbine,
} from "./icons/install";
import { Blower, Chiller, GrowLight, UvSteriliser } from "./icons/algae";

/* --------------------------- port helpers ------------------------------- */

/** Two-terminal vertical device: line in at top, load out at bottom. */
const PORTS_INLINE: PortDef[] = [
  { id: "in", side: "top", position: 0.5 },
  { id: "out", side: "bottom", position: 0.5 },
];

/** Source: single output at the bottom. */
const PORTS_SOURCE: PortDef[] = [{ id: "out", side: "bottom", position: 0.5 }];

/** Load: single input at the top. */
const PORTS_LOAD: PortDef[] = [{ id: "in", side: "top", position: 0.5 }];

const TAP_MIN_OUTPUTS = 1;
const TAP_MAX_OUTPUTS = 12;

const TAP_SPACING_MIN = 24;
const TAP_SPACING_MAX = 160;
const TAP_SPACING_DEFAULT = 72;
const WIDTH_MIN = 80;
const WIDTH_MAX = 800;

/** Clamped outgoing-tap count read from a node's params. */
function tapCount(data: ElecNodeData, fallback: number): number {
  const raw = Number((data.params as Record<string, unknown> | undefined)?.outputs);
  return Math.max(
    TAP_MIN_OUTPUTS,
    Math.min(
      TAP_MAX_OUTPUTS,
      Number.isFinite(raw) ? Math.round(raw) : fallback,
    ),
  );
}

/** User-set spacing between adjacent outgoing taps (falls back to default). */
function tapSpacingOf(data: ElecNodeData): number {
  const raw = Number((data.params as Record<string, unknown> | undefined)?.tapSpacing);
  if (!Number.isFinite(raw) || raw <= 0) return TAP_SPACING_DEFAULT;
  return Math.max(TAP_SPACING_MIN, Math.min(TAP_SPACING_MAX, raw));
}

/** User-set overall drawn width, or null to auto-size from spacing × taps. */
function drawnWidthOf(data: ElecNodeData): number | null {
  const raw = Number((data.params as Record<string, unknown> | undefined)?.drawnWidth);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return Math.max(WIDTH_MIN, Math.min(WIDTH_MAX, raw));
}

/**
 * Drawn width of a distribution element: the user's slider value, or an
 * auto-size that leaves `tapSpacing` between every tap when unset.
 */
function distributionWidth(
  data: ElecNodeData,
  baseMin: number,
  fallbackTaps: number,
): number {
  const explicit = drawnWidthOf(data);
  if (explicit) return explicit;
  const n = tapCount(data, fallbackTaps);
  return Math.max(baseMin, (n - 1) * tapSpacingOf(data) + 48);
}

/**
 * Ports for a distribution element (busbar, board, MCC): one incomer on top
 * centre plus a user-configurable number of outgoing taps along the bottom,
 * laid out centred with the chosen separation. Tap ids stay stable (`t1`,
 * `t2`, …) so existing feeders keep their handle when the count changes.
 */
function tappedPorts(
  data: ElecNodeData,
  baseMin: number,
  fallbackTaps: number,
): PortDef[] {
  const n = tapCount(data, fallbackTaps);
  const width = distributionWidth(data, baseMin, fallbackTaps);
  const spacing = tapSpacingOf(data);
  const center = width / 2;
  const ports: PortDef[] = [{ id: "in", side: "top", position: 0.5 }];
  for (let i = 0; i < n; i++) {
    const x = center + (i - (n - 1) / 2) * spacing;
    const pos = Math.min(0.98, Math.max(0.02, x / width));
    ports.push({ id: `t${i + 1}`, side: "bottom", position: pos });
  }
  return ports;
}

function busbarPorts(data: ElecNodeData): PortDef[] {
  return tappedPorts(data, 128, 4);
}

function boardPorts(data: ElecNodeData): PortDef[] {
  return tappedPorts(data, 96, 3);
}

function busbarSize(data: ElecNodeData): { width: number; height: number } {
  return { width: distributionWidth(data, 128, 4), height: 32 };
}

function boardSize(data: ElecNodeData): { width: number; height: number } {
  return { width: distributionWidth(data, 96, 3), height: 64 };
}

/** Slider fields for the separation + drawn width of a distribution element. */
const LAYOUT_FIELDS: ElecParamField[] = [
  {
    key: "tapSpacing",
    label: "Tap separation",
    kind: "slider",
    unit: "px",
    min: TAP_SPACING_MIN,
    max: TAP_SPACING_MAX,
    step: 4,
    default: TAP_SPACING_DEFAULT,
    group: "Layout",
    description: "Gap between outgoing taps (and anything bolted to them)",
  },
  {
    key: "drawnWidth",
    label: "Drawn width",
    kind: "slider",
    unit: "px",
    min: WIDTH_MIN,
    max: WIDTH_MAX,
    step: 10,
    default: 260,
    group: "Layout",
    description: "Overall drawn width of the symbol on the diagram",
  },
];

const TAP_FIELD: ElecParamField = {
  key: "outputs",
  label: "Outgoing taps",
  kind: "number",
  min: TAP_MIN_OUTPUTS,
  max: TAP_MAX_OUTPUTS,
  default: 4,
  group: "Ratings",
  description: "Number of outgoing connection points shown on the symbol",
};

/* --------------------------- shared schema ------------------------------ */

const VOLTAGE_FIELD: ElecParamField = {
  key: "voltageV",
  label: "Voltage",
  kind: "number",
  unit: "V",
  default: 380,
  group: "Ratings",
};

const PHASE_FIELD: ElecParamField = {
  key: "phases",
  label: "Phases",
  kind: "select",
  options: ["1", "3"],
  default: "3",
  group: "Ratings",
};

const PF_FIELD: ElecParamField = {
  key: "powerFactor",
  label: "Power factor",
  kind: "number",
  step: 0.01,
  min: 0,
  max: 1,
  default: 0.85,
  group: "Loading",
};

/* ------------------------------ registry -------------------------------- */

export const ELEC_SYMBOL_REGISTRY: Record<string, ElecSymbolDef> = {
  /* ===== Sources & supply ============================================== */
  "utility-incomer": {
    type: "utility-incomer",
    category: "source",
    subcategory: "Supply",
    label: "Utility incomer",
    description: "Incoming grid supply (AC source)",
    size: { width: 64, height: 64 },
    ports: PORTS_SOURCE,
    tagPrefix: "SUP",
    Icon: UtilityIncomer,
    engineModel: "source",
    defaultLabel: "Utility",
    paramSchema: [
      VOLTAGE_FIELD,
      { key: "frequencyHz", label: "Frequency", kind: "number", unit: "Hz", default: 50, group: "Ratings" },
      { key: "faultLevelKA", label: "Fault level", kind: "number", unit: "kA", default: 25, group: "Ratings", description: "Prospective short-circuit current at the point of supply" },
      { key: "phases", label: "Phases", kind: "select", options: ["1", "3"], default: "3", group: "Ratings" },
    ],
    defaultParams: { voltageV: 380, frequencyHz: 50, faultLevelKA: 25, phases: "3" },
  },
  generator: {
    type: "generator",
    category: "source",
    subcategory: "Supply",
    label: "Generator",
    description: "Standby diesel generator (genset)",
    size: { width: 64, height: 64 },
    ports: PORTS_SOURCE,
    tagPrefix: "G",
    Icon: Generator,
    engineModel: "source",
    defaultLabel: "Genset",
    paramSchema: [
      { key: "ratedKVA", label: "Rating", kind: "number", unit: "kVA", default: 500, group: "Ratings" },
      VOLTAGE_FIELD,
      PF_FIELD,
      { key: "subtransientReactancePct", label: "X″d", kind: "number", unit: "%", default: 15, group: "Ratings", description: "Sub-transient reactance for fault calcs" },
    ],
    defaultParams: { ratedKVA: 500, voltageV: 380, powerFactor: 0.8, subtransientReactancePct: 15 },
  },
  ups: {
    type: "ups",
    category: "source",
    subcategory: "Supply",
    label: "UPS",
    description: "Uninterruptible power supply",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "UPS",
    Icon: Ups,
    engineModel: "source",
    defaultLabel: "UPS",
    paramSchema: [
      { key: "ratedKVA", label: "Rating", kind: "number", unit: "kVA", default: 20, group: "Ratings" },
      VOLTAGE_FIELD,
      { key: "autonomyMin", label: "Autonomy", kind: "number", unit: "min", default: 15, group: "Ratings" },
    ],
    defaultParams: { ratedKVA: 20, voltageV: 380, autonomyMin: 15 },
  },
  "pv-inverter": {
    type: "pv-inverter",
    category: "source",
    subcategory: "Renewables",
    label: "PV inverter",
    description: "Solar PV grid-tie inverter",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "INV",
    Icon: PvInverter,
    engineModel: "source",
    defaultLabel: "PV",
    paramSchema: [
      { key: "ratedKW", label: "AC rating", kind: "number", unit: "kW", default: 50, group: "Ratings" },
      VOLTAGE_FIELD,
      { key: "dcVoltageV", label: "DC voltage", kind: "number", unit: "V", default: 600, group: "Ratings" },
    ],
    defaultParams: { ratedKW: 50, voltageV: 380, dcVoltageV: 600 },
  },
  battery: {
    type: "battery",
    category: "source",
    subcategory: "Renewables",
    label: "Battery / BESS",
    description: "Battery energy storage",
    size: { width: 64, height: 64 },
    ports: PORTS_SOURCE,
    tagPrefix: "BAT",
    Icon: Battery,
    engineModel: "source",
    defaultLabel: "BESS",
    paramSchema: [
      { key: "capacityKWh", label: "Capacity", kind: "number", unit: "kWh", default: 100, group: "Ratings" },
      { key: "dcVoltageV", label: "DC voltage", kind: "number", unit: "V", default: 800, group: "Ratings" },
    ],
    defaultParams: { capacityKWh: 100, dcVoltageV: 800 },
  },

  /* ===== Transformers ================================================== */
  "transformer-2w": {
    type: "transformer-2w",
    category: "transformer",
    subcategory: "Transformers",
    label: "Transformer (2-winding)",
    description: "Two-winding power transformer",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "TX",
    Icon: Transformer2W,
    engineModel: "transformer",
    defaultLabel: "TX",
    paramSchema: [
      { key: "ratedKVA", label: "Rating", kind: "number", unit: "kVA", default: 1000, group: "Ratings" },
      { key: "primaryV", label: "Primary", kind: "number", unit: "V", default: 11000, group: "Ratings" },
      { key: "secondaryV", label: "Secondary", kind: "number", unit: "V", default: 400, group: "Ratings" },
      { key: "impedancePct", label: "Impedance", kind: "number", unit: "%", default: 5, group: "Ratings", description: "Per-unit impedance (Z%) for fault & volt-drop calcs" },
      { key: "vectorGroup", label: "Vector group", kind: "select", options: ["Dyn11", "Dyn1", "Yyn0", "Dd0"], default: "Dyn11", group: "Ratings" },
    ],
    defaultParams: { ratedKVA: 1000, primaryV: 11000, secondaryV: 400, impedancePct: 5, vectorGroup: "Dyn11" },
  },
  "transformer-3w": {
    type: "transformer-3w",
    category: "transformer",
    subcategory: "Transformers",
    label: "Transformer (3-winding)",
    description: "Three-winding transformer",
    size: { width: 64, height: 72 },
    ports: [
      { id: "in", side: "top", position: 0.5 },
      { id: "out1", side: "bottom", position: 0.35 },
      { id: "out2", side: "bottom", position: 0.65 },
    ],
    tagPrefix: "TX",
    Icon: Transformer3W,
    engineModel: "transformer",
    defaultLabel: "TX",
    paramSchema: [
      { key: "ratedKVA", label: "Rating", kind: "number", unit: "kVA", default: 2000, group: "Ratings" },
      { key: "primaryV", label: "Primary", kind: "number", unit: "V", default: 33000, group: "Ratings" },
      { key: "secondaryV", label: "Secondary", kind: "number", unit: "V", default: 11000, group: "Ratings" },
      { key: "tertiaryV", label: "Tertiary", kind: "number", unit: "V", default: 400, group: "Ratings" },
      { key: "impedancePct", label: "Impedance", kind: "number", unit: "%", default: 8, group: "Ratings" },
    ],
    defaultParams: { ratedKVA: 2000, primaryV: 33000, secondaryV: 11000, tertiaryV: 400, impedancePct: 8 },
  },
  "auto-transformer": {
    type: "auto-transformer",
    category: "transformer",
    subcategory: "Transformers",
    label: "Auto-transformer",
    description: "Single-winding auto-transformer",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "TX",
    Icon: AutoTransformer,
    engineModel: "transformer",
    defaultLabel: "ATX",
    paramSchema: [
      { key: "ratedKVA", label: "Rating", kind: "number", unit: "kVA", default: 500, group: "Ratings" },
      { key: "primaryV", label: "Primary", kind: "number", unit: "V", default: 400, group: "Ratings" },
      { key: "secondaryV", label: "Secondary", kind: "number", unit: "V", default: 230, group: "Ratings" },
      { key: "impedancePct", label: "Impedance", kind: "number", unit: "%", default: 4, group: "Ratings" },
    ],
    defaultParams: { ratedKVA: 500, primaryV: 400, secondaryV: 230, impedancePct: 4 },
  },

  /* ===== Protection & switching ======================================== */
  "circuit-breaker": {
    type: "circuit-breaker",
    category: "protection",
    subcategory: "Breakers",
    label: "Circuit breaker (ACB)",
    description: "Air circuit breaker / generic breaker",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "Q",
    Icon: CircuitBreaker,
    engineModel: "breaker",
    defaultLabel: "CB",
    paramSchema: [
      { key: "ratedCurrentA", label: "Rated current", kind: "number", unit: "A", default: 630, group: "Ratings" },
      { key: "breakingCapacityKA", label: "Breaking cap.", kind: "number", unit: "kA", default: 50, group: "Ratings" },
      { key: "poles", label: "Poles", kind: "select", options: ["1P", "2P", "3P", "4P"], default: "3P", group: "Ratings" },
      { key: "tripSettingA", label: "Trip setting", kind: "number", unit: "A", default: 630, group: "Protection" },
    ],
    defaultParams: { ratedCurrentA: 630, breakingCapacityKA: 50, poles: "3P", tripSettingA: 630 },
  },
  mccb: {
    type: "mccb",
    category: "protection",
    subcategory: "Breakers",
    label: "MCCB",
    description: "Moulded-case circuit breaker",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "Q",
    Icon: Mccb,
    engineModel: "breaker",
    defaultLabel: "MCCB",
    paramSchema: [
      { key: "ratedCurrentA", label: "Rated current", kind: "number", unit: "A", default: 250, group: "Ratings" },
      { key: "breakingCapacityKA", label: "Breaking cap.", kind: "number", unit: "kA", default: 36, group: "Ratings" },
      { key: "poles", label: "Poles", kind: "select", options: ["1P", "2P", "3P", "4P"], default: "3P", group: "Ratings" },
      { key: "tripSettingA", label: "Trip setting", kind: "number", unit: "A", default: 250, group: "Protection" },
    ],
    defaultParams: { ratedCurrentA: 250, breakingCapacityKA: 36, poles: "3P", tripSettingA: 250 },
  },
  mcb: {
    type: "mcb",
    category: "protection",
    subcategory: "Breakers",
    label: "MCB",
    description: "Miniature circuit breaker",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "Q",
    Icon: Mcb,
    engineModel: "breaker",
    defaultLabel: "MCB",
    paramSchema: [
      { key: "ratedCurrentA", label: "Rated current", kind: "number", unit: "A", default: 32, group: "Ratings" },
      { key: "curve", label: "Trip curve", kind: "select", options: ["B", "C", "D"], default: "C", group: "Protection" },
      { key: "breakingCapacityKA", label: "Breaking cap.", kind: "number", unit: "kA", default: 10, group: "Ratings" },
      { key: "poles", label: "Poles", kind: "select", options: ["1P", "1P+N", "3P", "3P+N"], default: "1P+N", group: "Ratings" },
    ],
    defaultParams: { ratedCurrentA: 32, curve: "C", breakingCapacityKA: 10, poles: "1P+N" },
  },
  "circuit-breaker-spare": {
    type: "circuit-breaker-spare",
    category: "protection",
    subcategory: "Breakers",
    label: "Circuit breaker (ACB) — spare",
    description:
      "Reserved ACB way. No outgoing connection; its rated current is carried upstream so feeders and devices are sized for a future load.",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "Q",
    Icon: CircuitBreakerSpare,
    engineModel: "breaker",
    defaultLabel: "CB (spare)",
    paramSchema: [
      { key: "ratedCurrentA", label: "Rated current", kind: "number", unit: "A", default: 630, group: "Ratings" },
      { key: "poles", label: "Poles", kind: "select", options: ["1P", "2P", "3P", "4P"], default: "3P", group: "Ratings" },
      { key: "powerFactor", label: "Assumed PF", kind: "number", default: 0.8, min: 0.1, max: 1, step: 0.05, group: "Reserved load" },
    ],
    defaultParams: { ratedCurrentA: 630, poles: "3P", powerFactor: 0.8, spare: true },
  },
  "mccb-spare": {
    type: "mccb-spare",
    category: "protection",
    subcategory: "Breakers",
    label: "MCCB — spare",
    description:
      "Reserved MCCB way. No outgoing connection; its rated current is carried upstream so feeders and devices are sized for a future load.",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "Q",
    Icon: MccbSpare,
    engineModel: "breaker",
    defaultLabel: "MCCB (spare)",
    paramSchema: [
      { key: "ratedCurrentA", label: "Rated current", kind: "number", unit: "A", default: 250, group: "Ratings" },
      { key: "poles", label: "Poles", kind: "select", options: ["1P", "2P", "3P", "4P"], default: "3P", group: "Ratings" },
      { key: "powerFactor", label: "Assumed PF", kind: "number", default: 0.8, min: 0.1, max: 1, step: 0.05, group: "Reserved load" },
    ],
    defaultParams: { ratedCurrentA: 250, poles: "3P", powerFactor: 0.8, spare: true },
  },
  "mcb-spare": {
    type: "mcb-spare",
    category: "protection",
    subcategory: "Breakers",
    label: "MCB — spare",
    description:
      "Reserved MCB way. No outgoing connection; its rated current is carried upstream so feeders and devices are sized for a future load.",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "Q",
    Icon: McbSpare,
    engineModel: "breaker",
    defaultLabel: "MCB (spare)",
    paramSchema: [
      { key: "ratedCurrentA", label: "Rated current", kind: "number", unit: "A", default: 32, group: "Ratings" },
      { key: "poles", label: "Poles", kind: "select", options: ["1P", "1P+N", "3P", "3P+N"], default: "1P+N", group: "Ratings" },
      { key: "powerFactor", label: "Assumed PF", kind: "number", default: 0.9, min: 0.1, max: 1, step: 0.05, group: "Reserved load" },
    ],
    defaultParams: { ratedCurrentA: 32, poles: "1P+N", powerFactor: 0.9, spare: true },
  },
  "mpcb-spare": {
    type: "mpcb-spare",
    category: "protection",
    subcategory: "Breakers",
    label: "MPCB — spare",
    description:
      "Reserved MPCB way. No outgoing connection; its rated current is carried upstream so feeders and devices are sized for a future load.",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "Q",
    Icon: MpcbSpare,
    engineModel: "breaker",
    defaultLabel: "MPCB (spare)",
    paramSchema: [
      { key: "ratedCurrentA", label: "Rated current", kind: "number", unit: "A", default: 16, group: "Ratings" },
      { key: "poles", label: "Poles", kind: "select", options: ["1P", "3P"], default: "3P", group: "Ratings" },
      { key: "powerFactor", label: "Assumed PF", kind: "number", default: 0.85, min: 0.1, max: 1, step: 0.05, group: "Reserved load" },
    ],
    defaultParams: { ratedCurrentA: 16, poles: "3P", powerFactor: 0.85, spare: true },
  },
  fuse: {
    type: "fuse",
    category: "protection",
    subcategory: "Fuses",
    label: "Fuse",
    description: "HRC / cartridge fuse",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "F",
    Icon: Fuse,
    engineModel: "breaker",
    defaultLabel: "Fuse",
    paramSchema: [
      { key: "ratedCurrentA", label: "Rated current", kind: "number", unit: "A", default: 100, group: "Ratings" },
      { key: "breakingCapacityKA", label: "Breaking cap.", kind: "number", unit: "kA", default: 80, group: "Ratings" },
      { key: "type", label: "Type", kind: "select", options: ["gG", "gM", "aM"], default: "gG", group: "Protection" },
    ],
    defaultParams: { ratedCurrentA: 100, breakingCapacityKA: 80, type: "gG" },
  },
  "switch-disconnector": {
    type: "switch-disconnector",
    category: "protection",
    subcategory: "Isolators & disconnectors",
    label: "Switch-disconnector",
    description: "Isolator / load-break switch",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "QS",
    Icon: SwitchDisconnector,
    engineModel: "breaker",
    defaultLabel: "Isolator",
    paramSchema: [
      { key: "ratedCurrentA", label: "Rated current", kind: "number", unit: "A", default: 160, group: "Ratings" },
      { key: "poles", label: "Poles", kind: "select", options: ["3P", "4P"], default: "3P", group: "Ratings" },
    ],
    defaultParams: { ratedCurrentA: 160, poles: "3P" },
  },
  "fused-switch": {
    type: "fused-switch",
    category: "protection",
    subcategory: "Fuses",
    label: "Fused switch",
    description: "Fused switch-disconnector",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "QS",
    Icon: FusedSwitch,
    engineModel: "breaker",
    defaultLabel: "Fused sw.",
    paramSchema: [
      { key: "ratedCurrentA", label: "Switch rating", kind: "number", unit: "A", default: 160, group: "Ratings" },
      { key: "fuseRatingA", label: "Fuse rating", kind: "number", unit: "A", default: 125, group: "Protection" },
    ],
    defaultParams: { ratedCurrentA: 160, fuseRatingA: 125 },
  },
  contactor: {
    type: "contactor",
    category: "protection",
    subcategory: "Contactors & relays",
    label: "Contactor",
    description: "Electrically operated contactor with control coil",
    size: { width: 64, height: 64 },
    // Power pole (in/out) on the left; coil terminals A1/A2 on the right so the
    // contactor can be wired into a control circuit.
    ports: [
      { id: "in", side: "top", position: 0.375 },
      { id: "out", side: "bottom", position: 0.375 },
      { id: "a1", side: "top", position: 0.766 },
      { id: "a2", side: "bottom", position: 0.766 },
    ],
    tagPrefix: "KM",
    Icon: Contactor,
    engineModel: "breaker",
    defaultLabel: "Contactor",
    paramSchema: [
      { key: "ratedCurrentA", label: "Rated current", kind: "number", unit: "A", default: 40, group: "Ratings" },
      { key: "coilV", label: "Coil voltage", kind: "number", unit: "V", default: 230, group: "Ratings", description: "Voltage applied to the A1–A2 control coil" },
      { key: "auxContacts", label: "Aux contacts", kind: "text", default: "1NO+1NC", group: "Ratings" },
    ],
    defaultParams: { ratedCurrentA: 40, coilV: 230, auxContacts: "1NO+1NC" },
  },
  "protection-relay": {
    type: "protection-relay",
    category: "protection",
    subcategory: "Contactors & relays",
    label: "Protection relay",
    description: "Overcurrent / multifunction relay",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "RLY",
    Icon: ProtectionRelay,
    engineModel: "passive",
    defaultLabel: "Relay",
    paramSchema: [
      { key: "functions", label: "ANSI functions", kind: "text", default: "50/51", group: "Protection", description: "e.g. 50/51 (overcurrent), 87 (differential)" },
    ],
    defaultParams: { functions: "50/51" },
  },

  /* ===== Distribution ================================================== */
  busbar: {
    type: "busbar",
    category: "distribution",
    subcategory: "Busbars & boards",
    label: "Busbar",
    description: "Distribution busbar",
    size: { width: 128, height: 32 },
    ports: busbarPorts({ symbolType: "busbar", params: { outputs: 4 } }),
    getPorts: busbarPorts,
    getSize: busbarSize,
    tagPrefix: "BB",
    Icon: Busbar,
    engineModel: "busbar",
    defaultLabel: "Busbar",
    paramSchema: [
      VOLTAGE_FIELD,
      { key: "ratedCurrentA", label: "Bar rating", kind: "number", unit: "A", default: 1600, group: "Ratings" },
      { ...TAP_FIELD, description: "Number of outgoing connection points along the bottom of the bar" },
      ...LAYOUT_FIELDS,
    ],
    defaultParams: {
      voltageV: 380,
      ratedCurrentA: 1600,
      outputs: 4,
      tapSpacing: TAP_SPACING_DEFAULT,
      drawnWidth: 264,
    },
  },
  "distribution-board": {
    type: "distribution-board",
    category: "distribution",
    subcategory: "Busbars & boards",
    label: "Distribution board",
    description: "LV distribution board (DB / panelboard)",
    size: { width: 96, height: 64 },
    ports: boardPorts({ symbolType: "distribution-board", params: { outputs: 3 } }),
    getPorts: boardPorts,
    getSize: boardSize,
    tagPrefix: "DB",
    Icon: DistributionBoard,
    engineModel: "board",
    defaultLabel: "DB",
    paramSchema: [
      VOLTAGE_FIELD,
      { key: "ratedCurrentA", label: "Incomer rating", kind: "number", unit: "A", default: 250, group: "Ratings" },
      { key: "ways", label: "Ways", kind: "number", default: 12, group: "Ratings", description: "Number of outgoing circuit positions the board can hold (its breaker capacity)" },
      { ...TAP_FIELD, default: 3, description: "Number of outgoing feeders drawn on this board's symbol" },
      { key: "ipRating", label: "IP rating", kind: "select", options: ["IP31", "IP41", "IP54", "IP65"], default: "IP41", group: "Build" },
      ...LAYOUT_FIELDS,
    ],
    defaultParams: {
      voltageV: 380,
      ratedCurrentA: 250,
      ways: 12,
      outputs: 3,
      ipRating: "IP41",
      tapSpacing: TAP_SPACING_DEFAULT,
      drawnWidth: 200,
    },
  },
  mcc: {
    type: "mcc",
    category: "distribution",
    subcategory: "Busbars & boards",
    label: "Motor control centre",
    description: "MCC with multiple motor feeders",
    size: { width: 96, height: 64 },
    ports: boardPorts({ symbolType: "mcc", params: { outputs: 3 } }),
    getPorts: boardPorts,
    getSize: boardSize,
    tagPrefix: "MCC",
    Icon: Mcc,
    engineModel: "board",
    defaultLabel: "MCC",
    paramSchema: [
      VOLTAGE_FIELD,
      { key: "ratedCurrentA", label: "Bus rating", kind: "number", unit: "A", default: 800, group: "Ratings" },
      { ...TAP_FIELD, default: 3, description: "Number of outgoing motor feeders drawn on this MCC's symbol" },
      { key: "formType", label: "Form", kind: "select", options: ["Form 1", "Form 2", "Form 3b", "Form 4b"], default: "Form 4b", group: "Build" },
      ...LAYOUT_FIELDS,
    ],
    defaultParams: {
      voltageV: 380,
      ratedCurrentA: 800,
      outputs: 3,
      formType: "Form 4b",
      tapSpacing: TAP_SPACING_DEFAULT,
      drawnWidth: 200,
    },
  },
  "bus-tie": {
    type: "bus-tie",
    category: "distribution",
    subcategory: "Busbars & boards",
    label: "Bus tie",
    description: "Bus-section / tie breaker",
    size: { width: 64, height: 32 },
    ports: [
      { id: "left", side: "left", position: 0.5 },
      { id: "right", side: "right", position: 0.5 },
    ],
    tagPrefix: "Q",
    Icon: BusTie,
    engineModel: "breaker",
    defaultLabel: "Tie",
    paramSchema: [
      { key: "ratedCurrentA", label: "Rated current", kind: "number", unit: "A", default: 1600, group: "Ratings" },
    ],
    defaultParams: { ratedCurrentA: 1600 },
  },

  /* ===== Drives & starters ============================================= */
  vfd: {
    type: "vfd",
    category: "drive",
    subcategory: "Drives",
    label: "VFD / VSD",
    description: "Variable-frequency drive",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "VFD",
    Icon: Vfd,
    engineModel: "drive",
    defaultLabel: "VFD",
    paramSchema: [
      { key: "ratedKW", label: "Rating", kind: "number", unit: "kW", default: 22, group: "Ratings" },
      VOLTAGE_FIELD,
      { key: "ratedCurrentA", label: "Output current", kind: "number", unit: "A", default: 45, group: "Ratings" },
    ],
    defaultParams: { ratedKW: 22, voltageV: 380, ratedCurrentA: 45 },
  },
  "soft-starter": {
    type: "soft-starter",
    category: "drive",
    subcategory: "Drives",
    label: "Soft starter",
    description: "Reduced-voltage soft starter",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "SS",
    Icon: SoftStarter,
    engineModel: "drive",
    defaultLabel: "Soft starter",
    paramSchema: [
      { key: "ratedKW", label: "Rating", kind: "number", unit: "kW", default: 30, group: "Ratings" },
      VOLTAGE_FIELD,
    ],
    defaultParams: { ratedKW: 30, voltageV: 380 },
  },
  "motor-starter": {
    type: "motor-starter",
    category: "drive",
    subcategory: "Drives",
    label: "Motor starter",
    description: "DOL / star-delta starter",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "ST",
    Icon: MotorStarter,
    engineModel: "drive",
    defaultLabel: "Starter",
    paramSchema: [
      { key: "startMethod", label: "Method", kind: "select", options: ["DOL", "Star-delta", "Auto-transformer"], default: "DOL", group: "Ratings" },
      { key: "ratedKW", label: "Motor rating", kind: "number", unit: "kW", default: 11, group: "Ratings" },
    ],
    defaultParams: { startMethod: "DOL", ratedKW: 11 },
  },

  /* ===== Loads ========================================================= */
  motor: {
    type: "motor",
    category: "load",
    subcategory: "Motors",
    label: "Motor",
    description: "Induction motor",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "M",
    Icon: Motor,
    engineModel: "motor",
    defaultLabel: "M",
    paramSchema: [
      { key: "ratedKW", label: "Rating", kind: "number", unit: "kW", default: 7.5, group: "Ratings" },
      VOLTAGE_FIELD,
      PHASE_FIELD,
      { key: "efficiencyPct", label: "Efficiency", kind: "number", unit: "%", default: 90, group: "Loading" },
      PF_FIELD,
      { key: "demandFactor", label: "Demand factor", kind: "number", step: 0.05, min: 0, max: 1, default: 1, group: "Loading" },
    ],
    defaultParams: { ratedKW: 7.5, voltageV: 380, phases: "3", efficiencyPct: 90, powerFactor: 0.85, demandFactor: 1 },
  },

  /* ===== Pumps ========================================================= */
  "pump-centrifugal": {
    type: "pump-centrifugal",
    category: "load",
    subcategory: "Pumps",
    label: "Centrifugal pump",
    description: "Motor-driven centrifugal pump",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "P",
    Icon: CentrifugalPump,
    engineModel: "motor",
    defaultLabel: "Pump",
    paramSchema: [
      { key: "ratedKW", label: "Motor rating", kind: "number", unit: "kW", default: 5.5, group: "Ratings" },
      VOLTAGE_FIELD,
      PHASE_FIELD,
      { key: "efficiencyPct", label: "Efficiency", kind: "number", unit: "%", default: 88, group: "Loading" },
      PF_FIELD,
      { key: "demandFactor", label: "Demand factor", kind: "number", step: 0.05, min: 0, max: 1, default: 1, group: "Loading" },
    ],
    defaultParams: { ratedKW: 5.5, voltageV: 380, phases: "3", efficiencyPct: 88, powerFactor: 0.85, demandFactor: 1 },
  },
  "pump-sump": {
    type: "pump-sump",
    category: "load",
    subcategory: "Pumps",
    label: "Sump / submersible pump",
    description: "Submersible sump / drainage pump",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "P",
    Icon: SumpPump,
    engineModel: "motor",
    defaultLabel: "Sump pump",
    paramSchema: [
      { key: "ratedKW", label: "Motor rating", kind: "number", unit: "kW", default: 2.2, group: "Ratings" },
      VOLTAGE_FIELD,
      PHASE_FIELD,
      { key: "efficiencyPct", label: "Efficiency", kind: "number", unit: "%", default: 84, group: "Loading" },
      PF_FIELD,
      { key: "demandFactor", label: "Demand factor", kind: "number", step: 0.05, min: 0, max: 1, default: 0.6, group: "Loading" },
    ],
    defaultParams: { ratedKW: 2.2, voltageV: 380, phases: "3", efficiencyPct: 84, powerFactor: 0.8, demandFactor: 0.6 },
  },
  "pump-peristaltic": {
    type: "pump-peristaltic",
    category: "load",
    subcategory: "Pumps",
    label: "Peristaltic pump",
    description: "Hose / peristaltic metering pump",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "P",
    Icon: PeristalticPump,
    engineModel: "motor",
    defaultLabel: "Peristaltic",
    paramSchema: [
      { key: "ratedKW", label: "Motor rating", kind: "number", unit: "kW", default: 0.37, group: "Ratings" },
      { key: "voltageV", label: "Voltage", kind: "number", unit: "V", default: 230, group: "Ratings" },
      { key: "phases", label: "Phases", kind: "select", options: ["1", "3"], default: "1", group: "Ratings" },
      { key: "efficiencyPct", label: "Efficiency", kind: "number", unit: "%", default: 78, group: "Loading" },
      PF_FIELD,
      { key: "demandFactor", label: "Demand factor", kind: "number", step: 0.05, min: 0, max: 1, default: 1, group: "Loading" },
    ],
    defaultParams: { ratedKW: 0.37, voltageV: 230, phases: "1", efficiencyPct: 78, powerFactor: 0.8, demandFactor: 1 },
  },
  "pump-diaphragm": {
    type: "pump-diaphragm",
    category: "load",
    subcategory: "Pumps",
    label: "Diaphragm pump",
    description: "Diaphragm / dosing pump",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "P",
    Icon: DiaphragmPump,
    engineModel: "motor",
    defaultLabel: "Diaphragm",
    paramSchema: [
      { key: "ratedKW", label: "Motor rating", kind: "number", unit: "kW", default: 0.55, group: "Ratings" },
      { key: "voltageV", label: "Voltage", kind: "number", unit: "V", default: 230, group: "Ratings" },
      { key: "phases", label: "Phases", kind: "select", options: ["1", "3"], default: "1", group: "Ratings" },
      { key: "efficiencyPct", label: "Efficiency", kind: "number", unit: "%", default: 80, group: "Loading" },
      PF_FIELD,
      { key: "demandFactor", label: "Demand factor", kind: "number", step: 0.05, min: 0, max: 1, default: 1, group: "Loading" },
    ],
    defaultParams: { ratedKW: 0.55, voltageV: 230, phases: "1", efficiencyPct: 80, powerFactor: 0.8, demandFactor: 1 },
  },
  "pump-progressive-cavity": {
    type: "pump-progressive-cavity",
    category: "load",
    subcategory: "Pumps",
    label: "Progressive-cavity pump",
    description: "Progressive-cavity / screw pump",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "P",
    Icon: ProgressiveCavityPump,
    engineModel: "motor",
    defaultLabel: "PC pump",
    paramSchema: [
      { key: "ratedKW", label: "Motor rating", kind: "number", unit: "kW", default: 4, group: "Ratings" },
      VOLTAGE_FIELD,
      PHASE_FIELD,
      { key: "efficiencyPct", label: "Efficiency", kind: "number", unit: "%", default: 86, group: "Loading" },
      PF_FIELD,
      { key: "demandFactor", label: "Demand factor", kind: "number", step: 0.05, min: 0, max: 1, default: 1, group: "Loading" },
    ],
    defaultParams: { ratedKW: 4, voltageV: 380, phases: "3", efficiencyPct: 86, powerFactor: 0.85, demandFactor: 1 },
  },
  "vibration-filter": {
    type: "vibration-filter",
    category: "load",
    subcategory: "Algae bioreactor site",
    label: "Vibration filter / screen",
    description: "Vibratory filter / sieve screen",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "VF",
    Icon: VibrationFilter,
    engineModel: "motor",
    defaultLabel: "Vib. filter",
    paramSchema: [
      { key: "ratedKW", label: "Vibratory motor", kind: "number", unit: "kW", default: 1.1, group: "Ratings" },
      VOLTAGE_FIELD,
      PHASE_FIELD,
      { key: "efficiencyPct", label: "Efficiency", kind: "number", unit: "%", default: 80, group: "Loading" },
      PF_FIELD,
      { key: "demandFactor", label: "Demand factor", kind: "number", step: 0.05, min: 0, max: 1, default: 0.8, group: "Loading" },
    ],
    defaultParams: { ratedKW: 1.1, voltageV: 380, phases: "3", efficiencyPct: 80, powerFactor: 0.8, demandFactor: 0.8 },
  },
  "lighting-load": {
    type: "lighting-load",
    category: "load",
    subcategory: "Loads",
    label: "Lighting load",
    description: "Lighting circuit / luminaire group",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "L",
    Icon: LightingLoad,
    engineModel: "load",
    defaultLabel: "Lighting",
    paramSchema: [
      { key: "ratedKW", label: "Connected load", kind: "number", unit: "kW", default: 3, group: "Loading" },
      PHASE_FIELD,
      PF_FIELD,
      { key: "demandFactor", label: "Demand factor", kind: "number", step: 0.05, min: 0, max: 1, default: 0.9, group: "Loading" },
    ],
    defaultParams: { ratedKW: 3, phases: "1", powerFactor: 0.95, demandFactor: 0.9 },
  },
  "socket-load": {
    type: "socket-load",
    category: "load",
    subcategory: "Loads",
    label: "Small power",
    description: "Socket-outlet / small-power circuit",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "SP",
    Icon: SocketLoad,
    engineModel: "load",
    defaultLabel: "Small power",
    paramSchema: [
      { key: "ratedKW", label: "Connected load", kind: "number", unit: "kW", default: 5, group: "Loading" },
      PHASE_FIELD,
      PF_FIELD,
      { key: "demandFactor", label: "Demand factor", kind: "number", step: 0.05, min: 0, max: 1, default: 0.5, group: "Loading" },
    ],
    defaultParams: { ratedKW: 5, phases: "1", powerFactor: 0.9, demandFactor: 0.5 },
  },
  heater: {
    type: "heater",
    category: "load",
    subcategory: "Loads",
    label: "Heater",
    description: "Resistive heating load",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "H",
    Icon: Heater,
    engineModel: "load",
    defaultLabel: "Heater",
    paramSchema: [
      { key: "ratedKW", label: "Rating", kind: "number", unit: "kW", default: 9, group: "Loading" },
      PHASE_FIELD,
      { key: "demandFactor", label: "Demand factor", kind: "number", step: 0.05, min: 0, max: 1, default: 1, group: "Loading" },
    ],
    defaultParams: { ratedKW: 9, phases: "3", powerFactor: 1, demandFactor: 1 },
  },
  "generic-load": {
    type: "generic-load",
    category: "load",
    subcategory: "Loads",
    label: "Generic load",
    description: "General electrical load",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "LD",
    Icon: GenericLoad,
    engineModel: "load",
    defaultLabel: "Load",
    paramSchema: [
      { key: "ratedKW", label: "Connected load", kind: "number", unit: "kW", default: 10, group: "Loading" },
      PHASE_FIELD,
      PF_FIELD,
      { key: "demandFactor", label: "Demand factor", kind: "number", step: 0.05, min: 0, max: 1, default: 0.8, group: "Loading" },
    ],
    defaultParams: { ratedKW: 10, phases: "3", powerFactor: 0.85, demandFactor: 0.8 },
  },
  "capacitor-bank": {
    type: "capacitor-bank",
    category: "load",
    subcategory: "Power quality",
    label: "Capacitor bank",
    description: "Power-factor correction bank",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "PFC",
    Icon: CapacitorBank,
    engineModel: "passive",
    defaultLabel: "PFC",
    paramSchema: [
      { key: "ratedKVAr", label: "Rating", kind: "number", unit: "kVAr", default: 50, group: "Ratings" },
      VOLTAGE_FIELD,
      { key: "steps", label: "Steps", kind: "number", default: 6, group: "Ratings" },
    ],
    defaultParams: { ratedKVAr: 50, voltageV: 380, steps: 6 },
  },

  /* ===== Instruments & metering ======================================== */
  ct: {
    type: "ct",
    category: "instrument",
    subcategory: "Metering",
    label: "Current transformer",
    description: "Measurement / protection CT",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "CT",
    Icon: CurrentTransformer,
    engineModel: "passive",
    defaultLabel: "CT",
    paramSchema: [
      { key: "ratio", label: "Ratio", kind: "text", default: "200/5", group: "Ratings", description: "Primary/secondary, e.g. 200/5 A" },
      { key: "classAccuracy", label: "Class", kind: "text", default: "0.5", group: "Ratings" },
    ],
    defaultParams: { ratio: "200/5", classAccuracy: "0.5" },
  },
  vt: {
    type: "vt",
    category: "instrument",
    subcategory: "Metering",
    label: "Voltage transformer",
    description: "Measurement VT / PT",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "VT",
    Icon: VoltageTransformer,
    engineModel: "passive",
    defaultLabel: "VT",
    paramSchema: [
      { key: "ratio", label: "Ratio", kind: "text", default: "11000/110", group: "Ratings" },
      { key: "classAccuracy", label: "Class", kind: "text", default: "0.5", group: "Ratings" },
    ],
    defaultParams: { ratio: "11000/110", classAccuracy: "0.5" },
  },
  meter: {
    type: "meter",
    category: "instrument",
    subcategory: "Metering",
    label: "Meter",
    description: "Energy / multifunction meter",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "MET",
    Icon: Meter,
    engineModel: "passive",
    defaultLabel: "Meter",
    paramSchema: [
      { key: "meterType", label: "Type", kind: "select", options: ["Energy (kWh)", "Multifunction", "Sub-meter"], default: "Multifunction", group: "Ratings" },
    ],
    defaultParams: { meterType: "Multifunction" },
  },

  /* ===== Earthing & protection ========================================= */
  "earth-electrode": {
    type: "earth-electrode",
    category: "earthing",
    subcategory: "Earthing",
    label: "Earth electrode",
    description: "Earth electrode / earthing point",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "E",
    Icon: EarthElectrode,
    engineModel: "passive",
    defaultLabel: "Earth",
    paramSchema: [
      { key: "resistanceOhm", label: "Resistance", kind: "number", unit: "Ω", default: 1, group: "Ratings", description: "Target earth electrode resistance" },
      { key: "system", label: "Earthing system", kind: "select", options: ["TN-S", "TN-C-S", "TT", "IT"], default: "TN-S", group: "Ratings" },
    ],
    defaultParams: { resistanceOhm: 1, system: "TN-S" },
  },
  spd: {
    type: "spd",
    category: "earthing",
    subcategory: "Earthing",
    label: "Surge protection",
    description: "Surge protection device (SPD)",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "SPD",
    Icon: Spd,
    engineModel: "passive",
    defaultLabel: "SPD",
    paramSchema: [
      { key: "spdType", label: "Type", kind: "select", options: ["Type 1", "Type 2", "Type 1+2", "Type 3"], default: "Type 2", group: "Ratings" },
      { key: "ratedVoltageV", label: "Voltage", kind: "number", unit: "V", default: 380, group: "Ratings" },
    ],
    defaultParams: { spdType: "Type 2", ratedVoltageV: 380 },
  },

  /* ===== Protection extras ============================================= */
  rcbo: {
    type: "rcbo",
    category: "protection",
    subcategory: "Residual current",
    label: "RCBO",
    description: "Combined RCD + overcurrent breaker",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "Q",
    Icon: Rcbo,
    engineModel: "breaker",
    defaultLabel: "RCBO",
    paramSchema: [
      { key: "ratedCurrentA", label: "Rated current", kind: "number", unit: "A", default: 32, group: "Ratings" },
      { key: "sensitivityMA", label: "Sensitivity", kind: "number", unit: "mA", default: 30, group: "Protection" },
      { key: "curve", label: "Trip curve", kind: "select", options: ["B", "C", "D"], default: "C", group: "Protection" },
    ],
    defaultParams: { ratedCurrentA: 32, sensitivityMA: 30, curve: "C" },
  },
  mpcb: {
    type: "mpcb",
    category: "protection",
    subcategory: "Breakers",
    label: "MPCB",
    description: "Motor protection circuit breaker",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "Q",
    Icon: Mpcb,
    engineModel: "breaker",
    defaultLabel: "MPCB",
    paramSchema: [
      { key: "rangeA", label: "Setting range", kind: "text", default: "9–14 A", group: "Protection" },
      { key: "breakingCapacityKA", label: "Breaking cap.", kind: "number", unit: "kA", default: 50, group: "Ratings" },
    ],
    defaultParams: { rangeA: "9–14 A", breakingCapacityKA: 50 },
  },
  rcd: {
    type: "rcd",
    category: "protection",
    subcategory: "Residual current",
    label: "RCD / RCCB",
    description: "Residual current device",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "RCD",
    Icon: Rcd,
    engineModel: "breaker",
    defaultLabel: "RCD",
    paramSchema: [
      { key: "ratedCurrentA", label: "Rated current", kind: "number", unit: "A", default: 63, group: "Ratings" },
      { key: "sensitivityMA", label: "Sensitivity", kind: "number", unit: "mA", default: 30, group: "Protection" },
      { key: "poles", label: "Poles", kind: "select", options: ["2P", "4P"], default: "4P", group: "Ratings" },
    ],
    defaultParams: { ratedCurrentA: 63, sensitivityMA: 30, poles: "4P" },
  },
  "changeover-switch": {
    type: "changeover-switch",
    category: "protection",
    subcategory: "Isolators & disconnectors",
    label: "Change-over switch",
    description: "Manual / automatic transfer switch (2 sources)",
    size: { width: 64, height: 64 },
    ports: [
      { id: "in1", side: "top", position: 0.3 },
      { id: "in2", side: "top", position: 0.7 },
      { id: "out", side: "bottom", position: 0.5 },
    ],
    tagPrefix: "QC",
    Icon: ChangeoverSwitch,
    engineModel: "breaker",
    defaultLabel: "ATS",
    paramSchema: [
      { key: "ratedCurrentA", label: "Rated current", kind: "number", unit: "A", default: 250, group: "Ratings" },
      { key: "type", label: "Type", kind: "select", options: ["Manual", "Automatic (ATS)"], default: "Automatic (ATS)", group: "Ratings" },
    ],
    defaultParams: { ratedCurrentA: 250, type: "Automatic (ATS)" },
  },

  /* ===== Isolators ===================================================== */
  "isolator-1p": {
    type: "isolator-1p",
    category: "protection",
    subcategory: "Isolators & disconnectors",
    label: "Isolator (1-phase)",
    description: "Single-phase isolator / disconnector",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "QS",
    Icon: Isolator1P,
    engineModel: "breaker",
    defaultLabel: "Isolator",
    paramSchema: [
      { key: "ratedCurrentA", label: "Rated current", kind: "number", unit: "A", default: 32, group: "Ratings" },
    ],
    defaultParams: { ratedCurrentA: 32, poles: "1P" },
  },
  "isolator-3p": {
    type: "isolator-3p",
    category: "protection",
    subcategory: "Isolators & disconnectors",
    label: "Isolator (3-phase)",
    description: "Three-phase isolator / disconnector",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "QS",
    Icon: Isolator3P,
    engineModel: "breaker",
    defaultLabel: "Isolator",
    paramSchema: [
      { key: "ratedCurrentA", label: "Rated current", kind: "number", unit: "A", default: 63, group: "Ratings" },
    ],
    defaultParams: { ratedCurrentA: 63, poles: "3P" },
  },

  /* ===== Switches & control =========================================== */
  switch: {
    type: "switch",
    category: "protection",
    subcategory: "Switches & control",
    label: "Switch",
    description: "On/off control switch (SPST)",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "SW",
    Icon: ControlSwitch,
    engineModel: "breaker",
    defaultLabel: "SW",
    paramSchema: [
      { key: "ratedCurrentA", label: "Rated current", kind: "number", unit: "A", default: 16, group: "Ratings" },
      { key: "poles", label: "Poles", kind: "select", options: ["1P", "2P", "3P", "4P"], default: "1P", group: "Ratings" },
    ],
    defaultParams: { ratedCurrentA: 16, poles: "1P" },
  },
  "two-way-switch": {
    type: "two-way-switch",
    category: "protection",
    subcategory: "Switches & control",
    label: "Two-way switch",
    description: "Changeover / three-way switch (1 common, 2 ways)",
    size: { width: 64, height: 64 },
    ports: [
      { id: "c", side: "bottom", position: 0.5 },
      { id: "a", side: "top", position: 0.34 },
      { id: "b", side: "top", position: 0.66 },
    ],
    tagPrefix: "SW",
    Icon: TwoWaySwitch,
    engineModel: "breaker",
    defaultLabel: "SW",
    paramSchema: [
      { key: "ratedCurrentA", label: "Rated current", kind: "number", unit: "A", default: 16, group: "Ratings" },
    ],
    defaultParams: { ratedCurrentA: 16 },
  },
  "hoa-switch": {
    type: "hoa-switch",
    category: "protection",
    subcategory: "Switches & control",
    label: "HOA selector",
    description: "Hand-Off-Auto selector switch",
    size: { width: 64, height: 64 },
    ports: [
      { id: "in", side: "top", position: 0.5 },
      { id: "hand", side: "bottom", position: 0.375 },
      { id: "auto", side: "bottom", position: 0.625 },
    ],
    tagPrefix: "HOA",
    Icon: HoaSwitch,
    engineModel: "passive",
    defaultLabel: "HOA",
    paramSchema: [
      { key: "positions", label: "Positions", kind: "text", default: "Hand / Off / Auto", group: "Ratings" },
    ],
    defaultParams: { positions: "Hand / Off / Auto" },
  },
  "selector-switch": {
    type: "selector-switch",
    category: "protection",
    subcategory: "Switches & control",
    label: "Selector switch",
    description: "Multi-position selector switch",
    size: { width: 64, height: 64 },
    ports: [
      { id: "in", side: "top", position: 0.5 },
      { id: "a", side: "bottom", position: 0.4 },
      { id: "b", side: "bottom", position: 0.6 },
    ],
    tagPrefix: "SA",
    Icon: SelectorSwitch,
    engineModel: "passive",
    defaultLabel: "Selector",
    paramSchema: [
      { key: "positions", label: "Positions", kind: "number", default: 2, group: "Ratings" },
    ],
    defaultParams: { positions: 2 },
  },
  "push-button": {
    type: "push-button",
    category: "protection",
    subcategory: "Switches & control",
    label: "Push-button",
    description: "Momentary push-button (start/stop)",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "SB",
    Icon: PushButton,
    engineModel: "passive",
    defaultLabel: "PB",
    paramSchema: [
      { key: "contact", label: "Contact", kind: "select", options: ["NO", "NC", "NO+NC"], default: "NO", group: "Ratings" },
    ],
    defaultParams: { contact: "NO" },
  },
  "emergency-stop": {
    type: "emergency-stop",
    category: "protection",
    subcategory: "Switches & control",
    label: "Emergency stop",
    description: "Latching mushroom-head E-stop",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "ES",
    Icon: EmergencyStop,
    engineModel: "breaker",
    defaultLabel: "E-stop",
    paramSchema: [
      { key: "contact", label: "Contact", kind: "select", options: ["NC", "2×NC"], default: "NC", group: "Ratings" },
    ],
    defaultParams: { contact: "NC" },
  },
  "limit-switch": {
    type: "limit-switch",
    category: "protection",
    subcategory: "Switches & control",
    label: "Limit switch",
    description: "Position / limit switch",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "LS",
    Icon: LimitSwitch,
    engineModel: "passive",
    defaultLabel: "LS",
    paramSchema: [
      { key: "contact", label: "Contact", kind: "select", options: ["NO", "NC", "NO+NC"], default: "NO", group: "Ratings" },
    ],
    defaultParams: { contact: "NO" },
  },
  "key-switch": {
    type: "key-switch",
    category: "protection",
    subcategory: "Switches & control",
    label: "Key switch",
    description: "Key-operated switch",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "KS",
    Icon: KeySwitch,
    engineModel: "passive",
    defaultLabel: "Key sw.",
    paramSchema: [
      { key: "contact", label: "Contact", kind: "select", options: ["NO", "NC", "NO+NC"], default: "NO", group: "Ratings" },
    ],
    defaultParams: { contact: "NO" },
  },
  "thermal-overload": {
    type: "thermal-overload",
    category: "protection",
    subcategory: "Contactors & relays",
    label: "Overload relay",
    description: "Thermal overload relay (motor O/L)",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "OL",
    Icon: ThermalOverload,
    engineModel: "breaker",
    defaultLabel: "O/L",
    paramSchema: [
      { key: "rangeA", label: "Setting range", kind: "text", default: "9–13 A", group: "Protection" },
      { key: "class", label: "Trip class", kind: "select", options: ["10", "10A", "20", "30"], default: "10", group: "Protection" },
    ],
    defaultParams: { rangeA: "9–13 A", class: "10" },
  },

  /* ===== Renewables ==================================================== */
  "pv-array": {
    type: "pv-array",
    category: "source",
    subcategory: "Renewables",
    label: "PV array",
    description: "Solar PV array / string",
    size: { width: 64, height: 64 },
    ports: PORTS_SOURCE,
    tagPrefix: "PV",
    Icon: PvArray,
    engineModel: "source",
    defaultLabel: "PV array",
    paramSchema: [
      { key: "ratedKWp", label: "Peak power", kind: "number", unit: "kWp", default: 100, group: "Ratings" },
      { key: "dcVoltageV", label: "String voltage", kind: "number", unit: "V", default: 600, group: "Ratings" },
      { key: "modules", label: "Modules", kind: "number", default: 200, group: "Ratings" },
    ],
    defaultParams: { ratedKWp: 100, dcVoltageV: 600, modules: 200 },
  },
  "wind-turbine": {
    type: "wind-turbine",
    category: "source",
    subcategory: "Renewables",
    label: "Wind turbine",
    description: "Wind turbine generator",
    size: { width: 64, height: 64 },
    ports: PORTS_SOURCE,
    tagPrefix: "WT",
    Icon: WindTurbine,
    engineModel: "source",
    defaultLabel: "Wind",
    paramSchema: [
      { key: "ratedKW", label: "Rating", kind: "number", unit: "kW", default: 50, group: "Ratings" },
      VOLTAGE_FIELD,
    ],
    defaultParams: { ratedKW: 50, voltageV: 380 },
  },
  "charge-controller": {
    type: "charge-controller",
    category: "source",
    subcategory: "Renewables",
    label: "Charge controller",
    description: "Solar MPPT charge controller",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "CC",
    Icon: ChargeController,
    engineModel: "passive",
    defaultLabel: "MPPT",
    paramSchema: [
      { key: "ratedCurrentA", label: "Rated current", kind: "number", unit: "A", default: 100, group: "Ratings" },
      { key: "dcVoltageV", label: "DC voltage", kind: "number", unit: "V", default: 48, group: "Ratings" },
    ],
    defaultParams: { ratedCurrentA: 100, dcVoltageV: 48 },
  },

  /* ===== Loads (general) =============================================== */
  "ev-charger": {
    type: "ev-charger",
    category: "load",
    subcategory: "Loads",
    label: "EV charger",
    description: "Electric vehicle charge point",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "EV",
    Icon: EvCharger,
    engineModel: "load",
    defaultLabel: "EV charger",
    paramSchema: [
      { key: "ratedKW", label: "Rating", kind: "number", unit: "kW", default: 22, group: "Loading" },
      PHASE_FIELD,
      PF_FIELD,
      { key: "demandFactor", label: "Demand factor", kind: "number", step: 0.05, min: 0, max: 1, default: 1, group: "Loading" },
    ],
    defaultParams: { ratedKW: 22, phases: "3", powerFactor: 0.95, demandFactor: 1 },
  },
  hvac: {
    type: "hvac",
    category: "load",
    subcategory: "Loads",
    label: "HVAC / AHU",
    description: "Air-conditioning / air-handling unit",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "AC",
    Icon: Hvac,
    engineModel: "load",
    defaultLabel: "HVAC",
    paramSchema: [
      { key: "ratedKW", label: "Rating", kind: "number", unit: "kW", default: 15, group: "Loading" },
      PHASE_FIELD,
      PF_FIELD,
      { key: "demandFactor", label: "Demand factor", kind: "number", step: 0.05, min: 0, max: 1, default: 0.8, group: "Loading" },
    ],
    defaultParams: { ratedKW: 15, phases: "3", powerFactor: 0.85, demandFactor: 0.8 },
  },
  fan: {
    type: "fan",
    category: "load",
    subcategory: "Loads",
    label: "Fan",
    description: "Ventilation / extract fan",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "FN",
    Icon: Fan,
    engineModel: "motor",
    defaultLabel: "Fan",
    paramSchema: [
      { key: "ratedKW", label: "Rating", kind: "number", unit: "kW", default: 2.2, group: "Ratings" },
      VOLTAGE_FIELD,
      PHASE_FIELD,
      { key: "efficiencyPct", label: "Efficiency", kind: "number", unit: "%", default: 88, group: "Loading" },
      PF_FIELD,
    ],
    defaultParams: { ratedKW: 2.2, voltageV: 380, phases: "3", efficiencyPct: 88, powerFactor: 0.82 },
  },
  "water-heater": {
    type: "water-heater",
    category: "load",
    subcategory: "Loads",
    label: "Water heater",
    description: "Immersion / water heating load",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "WH",
    Icon: WaterHeater,
    engineModel: "load",
    defaultLabel: "Water heater",
    paramSchema: [
      { key: "ratedKW", label: "Rating", kind: "number", unit: "kW", default: 3, group: "Loading" },
      PHASE_FIELD,
      { key: "demandFactor", label: "Demand factor", kind: "number", step: 0.05, min: 0, max: 1, default: 1, group: "Loading" },
    ],
    defaultParams: { ratedKW: 3, phases: "1", powerFactor: 1, demandFactor: 1 },
  },
  "emergency-light": {
    type: "emergency-light",
    category: "load",
    subcategory: "Loads",
    label: "Emergency light",
    description: "Emergency / battery-backed luminaire",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "EL",
    Icon: EmergencyLight,
    engineModel: "load",
    defaultLabel: "Emergency",
    paramSchema: [
      { key: "ratedKW", label: "Connected load", kind: "number", unit: "kW", default: 0.5, group: "Loading" },
      PHASE_FIELD,
      { key: "demandFactor", label: "Demand factor", kind: "number", step: 0.05, min: 0, max: 1, default: 1, group: "Loading" },
    ],
    defaultParams: { ratedKW: 0.5, phases: "1", powerFactor: 0.95, demandFactor: 1 },
  },
  floodlight: {
    type: "floodlight",
    category: "load",
    subcategory: "Loads",
    label: "Floodlight",
    description: "External floodlight / area lighting",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "FL",
    Icon: Floodlight,
    engineModel: "load",
    defaultLabel: "Floodlight",
    paramSchema: [
      { key: "ratedKW", label: "Connected load", kind: "number", unit: "kW", default: 1, group: "Loading" },
      PHASE_FIELD,
      PF_FIELD,
      { key: "demandFactor", label: "Demand factor", kind: "number", step: 0.05, min: 0, max: 1, default: 0.9, group: "Loading" },
    ],
    defaultParams: { ratedKW: 1, phases: "1", powerFactor: 0.95, demandFactor: 0.9 },
  },

  /* ===== Control & ELV ================================================= */
  plc: {
    type: "plc",
    category: "control",
    subcategory: "Automation",
    label: "PLC / control panel",
    description: "Programmable controller / control panel",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "PLC",
    Icon: Plc,
    engineModel: "load",
    defaultLabel: "PLC",
    paramSchema: [
      { key: "ratedKW", label: "Control load", kind: "number", unit: "kW", default: 0.5, group: "Loading" },
      { key: "ioPoints", label: "I/O points", kind: "number", default: 64, group: "Ratings" },
    ],
    defaultParams: { ratedKW: 0.5, ioPoints: 64, phases: "1", powerFactor: 0.9, demandFactor: 1 },
  },
  "gdt-sensor-box": {
    type: "gdt-sensor-box",
    category: "control",
    subcategory: "Monitoring",
    label: "GDT sensor box",
    description: "Reactor monitoring box feeding the GDT hub",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "GDT",
    Icon: GdtSensorBox,
    engineModel: "load",
    defaultLabel: "GDT",
    paramSchema: [
      { key: "ratedKW", label: "Load", kind: "number", unit: "kW", default: 0.03, group: "Loading" },
      { key: "voltageV", label: "Supply voltage", kind: "number", unit: "V", default: 230, group: "Ratings" },
      { key: "channels", label: "Sensor channels", kind: "number", default: 8, group: "Ratings" },
      { key: "phases", label: "Phases", kind: "select", options: ["1", "3"], default: "1", group: "Loading" },
    ],
    defaultParams: { ratedKW: 0.03, voltageV: 230, channels: 8, phases: "1", powerFactor: 0.9, demandFactor: 1 },
  },
  "fire-alarm-panel": {
    type: "fire-alarm-panel",
    category: "control",
    subcategory: "Life safety",
    label: "Fire alarm panel",
    description: "Fire detection & alarm control panel",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "FACP",
    Icon: FireAlarmPanel,
    engineModel: "load",
    defaultLabel: "FACP",
    paramSchema: [
      { key: "ratedKW", label: "Load", kind: "number", unit: "kW", default: 0.3, group: "Loading" },
      { key: "zones", label: "Zones", kind: "number", default: 8, group: "Ratings" },
    ],
    defaultParams: { ratedKW: 0.3, zones: 8, phases: "1", powerFactor: 0.9, demandFactor: 1 },
  },
  cctv: {
    type: "cctv",
    category: "control",
    subcategory: "Security",
    label: "CCTV camera",
    description: "Surveillance camera (ELV)",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "CAM",
    Icon: Cctv,
    engineModel: "load",
    defaultLabel: "CCTV",
    paramSchema: [
      { key: "ratedKW", label: "Load", kind: "number", unit: "kW", default: 0.03, group: "Loading" },
    ],
    defaultParams: { ratedKW: 0.03, phases: "1", powerFactor: 0.9, demandFactor: 1 },
  },

  /* ===== Distribution / earthing extras ================================ */
  "junction-box": {
    type: "junction-box",
    category: "distribution",
    subcategory: "Accessories",
    label: "Junction box",
    description: "Junction / pull box",
    size: { width: 64, height: 64 },
    ports: PORTS_INLINE,
    tagPrefix: "JB",
    Icon: JunctionBox,
    engineModel: "passive",
    defaultLabel: "JB",
    paramSchema: [
      { key: "ipRating", label: "IP rating", kind: "select", options: ["IP54", "IP65", "IP66", "IP67"], default: "IP65", group: "Build" },
    ],
    defaultParams: { ipRating: "IP65" },
  },
  "earth-bar": {
    type: "earth-bar",
    category: "earthing",
    subcategory: "Earthing",
    label: "Earth bar",
    description: "Main earthing / equipotential bonding bar",
    size: { width: 96, height: 40 },
    ports: [
      { id: "in", side: "top", position: 0.5 },
      { id: "t1", side: "bottom", position: 0.3 },
      { id: "t2", side: "bottom", position: 0.7 },
      { id: "left", side: "left", position: 0.5 },
      { id: "right", side: "right", position: 0.5 },
    ],
    tagPrefix: "MEB",
    Icon: EarthBar,
    engineModel: "passive",
    defaultLabel: "Earth bar",
    paramSchema: [
      { key: "ways", label: "Ways", kind: "number", default: 10, group: "Ratings" },
    ],
    defaultParams: { ways: 10 },
  },

  /* ===== Algae bioreactor site ========================================= */
  "grow-light": {
    type: "grow-light",
    category: "load",
    subcategory: "Algae bioreactor site",
    label: "LED grow-light array",
    description: "Photobioreactor LED lighting bank",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "GL",
    Icon: GrowLight,
    engineModel: "load",
    defaultLabel: "Grow light",
    paramSchema: [
      { key: "ratedKW", label: "Connected load", kind: "number", unit: "kW", default: 12, group: "Loading" },
      PHASE_FIELD,
      PF_FIELD,
      { key: "demandFactor", label: "Demand factor", kind: "number", step: 0.05, min: 0, max: 1, default: 1, group: "Loading" },
    ],
    defaultParams: { ratedKW: 12, phases: "3", powerFactor: 0.95, demandFactor: 1 },
  },
  "aeration-blower": {
    type: "aeration-blower",
    category: "load",
    subcategory: "Algae bioreactor site",
    label: "Aeration blower",
    description: "Air / CO₂ aeration blower",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "BL",
    Icon: Blower,
    engineModel: "motor",
    defaultLabel: "Blower",
    paramSchema: [
      { key: "ratedKW", label: "Rating", kind: "number", unit: "kW", default: 7.5, group: "Ratings" },
      VOLTAGE_FIELD,
      PHASE_FIELD,
      { key: "efficiencyPct", label: "Efficiency", kind: "number", unit: "%", default: 90, group: "Loading" },
      PF_FIELD,
    ],
    defaultParams: { ratedKW: 7.5, voltageV: 380, phases: "3", efficiencyPct: 90, powerFactor: 0.85 },
  },
  "circulation-pump": {
    type: "circulation-pump",
    category: "load",
    subcategory: "Algae bioreactor site",
    label: "Circulation pump",
    description: "Culture circulation / transfer pump",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "P",
    Icon: Motor,
    engineModel: "motor",
    defaultLabel: "Circ. pump",
    paramSchema: [
      { key: "ratedKW", label: "Rating", kind: "number", unit: "kW", default: 5.5, group: "Ratings" },
      VOLTAGE_FIELD,
      PHASE_FIELD,
      { key: "efficiencyPct", label: "Efficiency", kind: "number", unit: "%", default: 89, group: "Loading" },
      PF_FIELD,
    ],
    defaultParams: { ratedKW: 5.5, voltageV: 380, phases: "3", efficiencyPct: 89, powerFactor: 0.85 },
  },
  paddlewheel: {
    type: "paddlewheel",
    category: "load",
    subcategory: "Algae bioreactor site",
    label: "Paddlewheel drive",
    description: "Raceway pond paddlewheel motor",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "PW",
    Icon: Motor,
    engineModel: "motor",
    defaultLabel: "Paddlewheel",
    paramSchema: [
      { key: "ratedKW", label: "Rating", kind: "number", unit: "kW", default: 3, group: "Ratings" },
      VOLTAGE_FIELD,
      { key: "efficiencyPct", label: "Efficiency", kind: "number", unit: "%", default: 88, group: "Loading" },
      PF_FIELD,
    ],
    defaultParams: { ratedKW: 3, voltageV: 380, efficiencyPct: 88, powerFactor: 0.83 },
  },
  "harvest-centrifuge": {
    type: "harvest-centrifuge",
    category: "load",
    subcategory: "Algae bioreactor site",
    label: "Harvest centrifuge",
    description: "Biomass dewatering centrifuge",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "CF",
    Icon: Motor,
    engineModel: "motor",
    defaultLabel: "Centrifuge",
    paramSchema: [
      { key: "ratedKW", label: "Rating", kind: "number", unit: "kW", default: 11, group: "Ratings" },
      VOLTAGE_FIELD,
      { key: "efficiencyPct", label: "Efficiency", kind: "number", unit: "%", default: 91, group: "Loading" },
      PF_FIELD,
    ],
    defaultParams: { ratedKW: 11, voltageV: 380, efficiencyPct: 91, powerFactor: 0.86 },
  },
  "dosing-pump": {
    type: "dosing-pump",
    category: "load",
    subcategory: "Algae bioreactor site",
    label: "Dosing pump",
    description: "Nutrient / pH dosing pump",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "DP",
    Icon: Motor,
    engineModel: "motor",
    defaultLabel: "Dosing pump",
    paramSchema: [
      { key: "ratedKW", label: "Rating", kind: "number", unit: "kW", default: 0.55, group: "Ratings" },
      VOLTAGE_FIELD,
      { key: "efficiencyPct", label: "Efficiency", kind: "number", unit: "%", default: 80, group: "Loading" },
      PF_FIELD,
    ],
    defaultParams: { ratedKW: 0.55, voltageV: 380, efficiencyPct: 80, powerFactor: 0.78 },
  },
  mixer: {
    type: "mixer",
    category: "load",
    subcategory: "Algae bioreactor site",
    label: "Mixer / agitator",
    description: "Tank mixer / agitator motor",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "MX",
    Icon: Motor,
    engineModel: "motor",
    defaultLabel: "Mixer",
    paramSchema: [
      { key: "ratedKW", label: "Rating", kind: "number", unit: "kW", default: 4, group: "Ratings" },
      VOLTAGE_FIELD,
      { key: "efficiencyPct", label: "Efficiency", kind: "number", unit: "%", default: 88, group: "Loading" },
      PF_FIELD,
    ],
    defaultParams: { ratedKW: 4, voltageV: 380, efficiencyPct: 88, powerFactor: 0.84 },
  },
  "uv-steriliser": {
    type: "uv-steriliser",
    category: "load",
    subcategory: "Algae bioreactor site",
    label: "UV steriliser",
    description: "UV water disinfection unit",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "UV",
    Icon: UvSteriliser,
    engineModel: "load",
    defaultLabel: "UV",
    paramSchema: [
      { key: "ratedKW", label: "Connected load", kind: "number", unit: "kW", default: 1.5, group: "Loading" },
      PHASE_FIELD,
      PF_FIELD,
      { key: "demandFactor", label: "Demand factor", kind: "number", step: 0.05, min: 0, max: 1, default: 1, group: "Loading" },
    ],
    defaultParams: { ratedKW: 1.5, phases: "1", powerFactor: 0.95, demandFactor: 1 },
  },
  chiller: {
    type: "chiller",
    category: "load",
    subcategory: "Algae bioreactor site",
    label: "Process chiller",
    description: "Culture temperature control chiller",
    size: { width: 64, height: 64 },
    ports: PORTS_LOAD,
    tagPrefix: "CH",
    Icon: Chiller,
    engineModel: "load",
    defaultLabel: "Chiller",
    paramSchema: [
      { key: "ratedKW", label: "Rating", kind: "number", unit: "kW", default: 18, group: "Loading" },
      PHASE_FIELD,
      PF_FIELD,
      { key: "demandFactor", label: "Demand factor", kind: "number", step: 0.05, min: 0, max: 1, default: 0.8, group: "Loading" },
    ],
    defaultParams: { ratedKW: 18, phases: "3", powerFactor: 0.85, demandFactor: 0.8 },
  },
};

/**
 * Make the rated-current of every protective device (MCB / MCCB / ACB /
 * switch-disconnector / contactor …) a dropdown of standard "available" amp
 * ratings rather than a free-text number, so users pick from real frame sizes
 * and Auto Size can snap to the same set.
 */
const DEVICE_RATING_OPTIONS = STANDARD_DEVICE_RATINGS_A.map(String);
for (const sym of Object.values(ELEC_SYMBOL_REGISTRY)) {
  if (sym.engineModel !== "breaker" || !sym.paramSchema) continue;
  sym.paramSchema = sym.paramSchema.map((f) =>
    f.key === "ratedCurrentA"
      ? { ...f, kind: "select", numeric: true, options: DEVICE_RATING_OPTIONS }
      : f,
  );
}

/* --------------------------- registry helpers --------------------------- */

/**
 * Legacy type aliases. The single/three-phase motor, fan and pump variants were
 * merged into one component each with a phase dropdown, so diagrams saved with
 * the old split types still resolve (their stored params carry the phase). New
 * placements only ever use the consolidated keys.
 */
const ELEC_TYPE_ALIASES: Record<string, string> = {
  "motor-1ph": "motor",
  "motor-3ph": "motor",
  "fan-1ph": "fan",
  "pump-centrifugal-1ph": "pump-centrifugal",
};

export function getElecSymbol(type: string): ElecSymbolDef | undefined {
  return (
    ELEC_SYMBOL_REGISTRY[type] ??
    ELEC_SYMBOL_REGISTRY[ELEC_TYPE_ALIASES[type] ?? ""]
  );
}

/**
 * Live ports for a node — dynamic if the symbol generates them from instance
 * data (e.g. a busbar's tap count), otherwise the static schema array.
 */
export function getNodePorts(
  symbol: ElecSymbolDef,
  data: ElecNodeData,
): PortDef[] {
  return symbol.getPorts ? symbol.getPorts(data) : symbol.ports;
}

/**
 * Live size of a node, honouring any per-instance `getSize` (e.g. a busbar or
 * board that grows with its tap count) and falling back to the static size.
 */
export function getNodeSize(
  symbol: ElecSymbolDef,
  data: ElecNodeData,
): { width: number; height: number } {
  return symbol.getSize ? symbol.getSize(data) : symbol.size;
}

/**
 * Plain-language "what is this and what does it do" blurb shown when hovering a
 * palette component. Acronyms are spelled out so newcomers aren't left guessing
 * what an MPCB or RCBO actually is.
 */
export const ELEC_SYMBOL_HELP: Record<string, string> = {
  /* Sources & supply */
  "utility-incomer":
    "The incoming supply from the electricity network — the point where the grid hands power over to the site. Everything downstream is fed from here.",
  generator:
    "A standby diesel/gas generator (genset) that supplies power when the grid fails. Sized in kVA and a key input to fault-level calculations.",
  ups: "Uninterruptible Power Supply — bridges the gap between a mains failure and the generator starting, keeping critical loads alive on battery with no break.",
  "pv-inverter":
    "Converts DC from solar panels into grid-synchronised AC. The point where a PV system ties into the building's electrical supply.",
  battery:
    "Battery Energy Storage System (BESS) — stores energy for backup, peak-shaving or solar self-consumption. Rated in kWh of capacity.",

  /* Transformers */
  "transformer-2w":
    "A two-winding transformer that steps voltage up or down between two systems (e.g. 11 kV to 400 V). Its impedance (Z%) drives fault current and volt-drop.",
  "transformer-3w":
    "A three-winding transformer feeding two different secondary voltages from one primary — common on larger distribution substations.",
  "auto-transformer":
    "A single-winding transformer that gives a small voltage change cheaply (e.g. 400 V to 230 V). No galvanic isolation between sides.",

  /* Protection & switching */
  "circuit-breaker":
    "Air Circuit Breaker (ACB) — a large frame breaker for main incomers and big feeders. Switches load and trips automatically on overload or short circuit.",
  mccb: "Moulded-Case Circuit Breaker — a compact breaker for sub-mains and larger final circuits, with adjustable trip settings and a high breaking capacity.",
  mcb: "Miniature Circuit Breaker — the everyday breaker protecting final circuits. Trips on overload/short circuit; the B/C/D curve sets how fast it reacts to surges.",
  fuse: "A fuse (HRC/cartridge) — a sacrificial link that melts to break the circuit under fault. Simple, fast and with a very high breaking capacity.",
  "switch-disconnector":
    "An isolator / load-break switch — safely makes and breaks load and provides a lockable isolation point for maintenance. No automatic tripping.",
  "fused-switch":
    "A switch-disconnector with integral fuses — combines isolation with fuse protection in one unit.",
  contactor:
    "An electrically operated switch used to start/stop motors and loads. The power pole (top/bottom) carries the load; energising the A1–A2 coil pulls it in, so wire the coil into your control circuit (HOA, PLC, push-buttons). Not a protective device on its own.",
  "protection-relay":
    "An overcurrent / multifunction protection relay. Monitors current and voltage and trips a breaker when it detects a fault (ANSI functions e.g. 50/51, 87).",
  rcbo: "Residual Current Breaker with Overcurrent — one device combining an MCB (overload/short-circuit) with an RCD (earth-leakage), protecting against both.",
  mpcb: "Motor Protection Circuit Breaker — a breaker tailored to motors. Provides isolation, manual control and adjustable overload + short-circuit protection in one unit.",
  rcd: "Residual Current Device (RCCB) — trips when it detects leakage current to earth (e.g. someone touching a live part). Protects people against electric shock.",
  "changeover-switch":
    "A transfer switch that selects between two supplies (e.g. mains and generator). Manual, or automatic (ATS) which switches over by itself on supply loss.",
  "isolator-1p":
    "A single-phase isolator (disconnector) — provides a lockable, no-load break point so a circuit can be safely worked on. Switches off but doesn't trip on faults.",
  "isolator-3p":
    "A three-phase isolator (disconnector) — gangs all three phases so they break together, giving a safe isolation point for three-phase equipment.",
  switch:
    "A plain on/off control switch. Makes or breaks a circuit by hand; carries load but offers no automatic protection.",
  "two-way-switch":
    "A two-way (changeover) switch — one common terminal that connects to either of two ways. The classic 'three-way' arrangement for switching one circuit from two places.",
  "hoa-switch":
    "Hand-Off-Auto selector — picks how a load (usually a motor) is controlled: Hand runs it manually, Off stops it, Auto hands control to the PLC / automation.",
  "selector-switch":
    "A multi-position rotary selector that routes a circuit to one of several positions — used to choose modes, sources or settings.",
  "push-button":
    "A momentary push-button (e.g. Start/Stop). Springs back when released; normally-open or normally-closed contacts drive control circuits.",
  "emergency-stop":
    "A latching mushroom-head emergency stop. Pressing it breaks the circuit and stays latched until twisted/released — a safety device to kill power fast.",
  "limit-switch":
    "A position / limit switch tripped by a moving part reaching a set point (via a roller or lever) — tells the controls where equipment is.",
  "key-switch":
    "A key-operated switch — only someone with the key can change its state. Used to lock out or authorise functions.",
  "thermal-overload":
    "A thermal overload relay (motor O/L). Sits with a contactor and trips it if the motor draws too much current for too long, protecting the windings from burning out.",

  /* Distribution */
  busbar:
    "A common conductor bar that distributes one incoming supply to several outgoing circuits. Set the number of outgoing taps in the inspector.",
  "distribution-board":
    "A Distribution Board (DB / panelboard) — houses the final-circuit breakers and splits a supply into many smaller circuits around a building.",
  mcc: "Motor Control Centre — a cabinet grouping the starters, breakers and controls for many motors in one place. Built to a 'Form' of internal separation.",
  "bus-tie":
    "A bus-section / tie breaker linking two busbars. Normally open; closed to feed one section from the other during maintenance or supply loss.",
  "junction-box":
    "A junction / pull box where cables are joined or drawn through. Rated to an IP code for dust/water ingress.",

  /* Drives & starters */
  vfd: "Variable-Frequency Drive (VFD/VSD) — controls a motor's speed by varying supply frequency, saving energy on pumps and fans and giving soft starts.",
  "soft-starter":
    "Ramps a motor up to speed by gradually raising voltage, reducing the big inrush current and mechanical shock of a direct start.",
  "motor-starter":
    "A motor starter (Direct-On-Line or star-delta) — switches and protects a fixed-speed motor. Star-delta reduces starting current on larger motors.",

  /* Loads */
  motor: "An induction motor — the workhorse rotating load. Rated in kW with an efficiency and power factor that set its full-load current draw.",
  "motor-1ph":
    "A single-phase induction motor (1~) — for small loads on a line-and-neutral supply (typically 230 V). Draws more current than a three-phase motor of the same kW.",
  "motor-3ph":
    "A three-phase induction motor (3~) — the standard for anything above a couple of kW. Smoother, more efficient and lower current than single-phase.",
  "pump-centrifugal":
    "A motor-driven centrifugal pump — the most common pump type for moving liquids. Sized by its motor rating in kW.",
  "pump-sump":
    "A submersible sump / drainage pump that sits in a pit and runs on a level switch. Often intermittent, so it carries a low demand factor.",
  "pump-peristaltic":
    "A peristaltic (hose) pump — rollers squeeze a flexible tube to meter fluid precisely. Common for dosing chemicals and nutrients. Usually a small single-phase motor.",
  "pump-diaphragm":
    "A diaphragm / dosing pump — a flexing membrane pushes fluid in pulses. Good for accurate, low-flow chemical dosing.",
  "pump-progressive-cavity":
    "A progressive-cavity (screw) pump — a rotor turning inside a stator moves viscous or solids-laden fluids smoothly. Sized by its motor kW.",
  "vibration-filter":
    "A vibratory filter / sieve screen driven by a vibratory motor — shakes product across a mesh to separate or dewater solids. Modelled as a motor load.",
  "lighting-load":
    "A lighting circuit or group of luminaires, entered as a connected kW load with a demand factor for diversity.",
  "socket-load":
    "Small-power / socket-outlet circuits. A diversified load — rarely is every socket in use at once, hence the low demand factor.",
  heater: "A resistive heating load (unity power factor) — heaters, trace heating, process heat, etc.",
  "generic-load":
    "A catch-all electrical load when no specific symbol fits. Enter its kW, power factor and demand factor.",
  "capacitor-bank":
    "Power-Factor Correction (PFC) bank — injects reactive power (kVAr) to improve a poor power factor, cutting current and utility penalties.",
  "ev-charger":
    "An electric-vehicle charge point. A continuous, often three-phase load that needs careful diversity and cable sizing.",
  hvac: "Heating, Ventilation & Air-Conditioning plant / Air-Handling Unit — a sizeable motor-driven load serving building climate control.",
  fan: "A ventilation or extract fan motor — a motor load whose full-load current is set by its kW, efficiency and power factor. Set Phases to 1 for a small single-phase fan.",
  "water-heater": "An immersion heater / water heating element — a resistive load, usually at unity power factor.",
  "emergency-light":
    "A battery-backed emergency luminaire that stays lit on supply failure to mark escape routes. Small connected load.",
  floodlight: "External area / floodlighting — an outdoor lighting load.",

  /* Control & ELV */
  plc: "Programmable Logic Controller / control panel — the brains that automate the plant. A small but critical control load.",
  "gdt-sensor-box":
    "A GDT sensor box — monitors reactor conditions (e.g. temperature, pH, dissolved gas) and streams the readings to the GDT hub. A small, always-on ELV monitoring load.",
  "fire-alarm-panel":
    "Fire Alarm Control Panel (FACP) — monitors detectors and drives sounders. A life-safety load that typically needs a dedicated, protected supply.",
  cctv: "A surveillance camera — an Extra-Low-Voltage (ELV) security load, usually powered over its network cable or a local supply.",

  /* Instruments & metering */
  ct: "Current Transformer — steps a large primary current down to a safe small secondary (e.g. 200/5 A) so meters and relays can measure it.",
  vt: "Voltage Transformer (VT/PT) — steps a high voltage down to a standard measurable level (e.g. 110 V) for metering and protection.",
  meter: "An energy or multifunction meter — measures kWh, current, voltage and power quality at a point in the system.",

  /* Earthing & surge */
  "earth-electrode":
    "The connection to earth (rod/mat) that fixes the installation's reference to ground and provides a path for fault current. Aim for low resistance.",
  spd: "Surge Protection Device — diverts transient over-voltages (lightning, switching surges) to earth, protecting sensitive equipment. Types 1/2/3 by location.",
  "earth-bar":
    "Main Earthing / equipotential bonding bar — the central point where protective and bonding conductors are brought together.",

  /* Algae bioreactor site */
  "grow-light":
    "An LED grow-light bank that drives photosynthesis in a photobioreactor. A significant, often continuous lighting load.",
  "aeration-blower":
    "A blower that bubbles air/CO₂ through the culture to keep algae suspended and fed. A motor load that often runs continuously.",
  "circulation-pump":
    "Pumps culture around the system or between tanks. A motor load sized in kW.",
  paddlewheel:
    "The paddlewheel motor that gently circulates an open raceway pond to keep the algae moving and evenly lit.",
  "harvest-centrifuge":
    "A centrifuge that spins harvested culture to separate (dewater) the algae biomass from the water. A high-inertia motor load.",
  "dosing-pump":
    "A small metering pump that doses nutrients or pH-correcting chemicals into the culture in precise amounts.",
  mixer: "A tank mixer / agitator motor that keeps the contents homogeneous.",
  "uv-steriliser":
    "A UV disinfection unit that kills contaminants in process/make-up water using ultraviolet lamps.",
  chiller:
    "A process chiller that holds the culture at its optimum temperature by rejecting heat. A sizeable, intermittent load.",
};

export function getElecHelp(symbol: ElecSymbolDef): string {
  return ELEC_SYMBOL_HELP[symbol.type] ?? symbol.description ?? "";
}

export const ELEC_CATEGORY_LABELS: Record<ElecCategory, string> = {
  source: "Sources & supply",
  transformer: "Transformers",
  protection: "Protection & switching",
  distribution: "Distribution",
  drive: "Drives & starters",
  load: "Loads",
  instrument: "Instruments & metering",
  control: "Control & ELV",
  earthing: "Earthing & surge",
};

export const ELEC_CATEGORY_ORDER: ElecCategory[] = [
  "source",
  "distribution",
  "protection",
  "drive",
  "load",
  "instrument",
  "transformer",
  "control",
  "earthing",
];

const ELEC_SUBCATEGORY_ORDER: Partial<Record<ElecCategory, string[]>> = {
  source: ["Supply", "Renewables"],
  protection: [
    "Breakers",
    "Residual current",
    "Fuses",
    "Isolators & disconnectors",
    "Switches & control",
    "Contactors & relays",
  ],
  distribution: ["Busbars & boards", "Accessories"],
  load: ["Motors", "Pumps", "Loads", "Algae bioreactor site", "Power quality"],
  control: ["Automation", "Monitoring", "Life safety", "Security"],
  earthing: ["Earthing", "Surge"],
};

export function elecSymbolsByCategory(category: ElecCategory): ElecSymbolDef[] {
  return Object.values(ELEC_SYMBOL_REGISTRY).filter(
    (s) => s.category === category,
  );
}

export function elecGroupedSubcategories(
  category: ElecCategory,
): { name: string; symbols: ElecSymbolDef[] }[] {
  const symbols = elecSymbolsByCategory(category);
  const order = ELEC_SUBCATEGORY_ORDER[category] ?? [];
  const groups = new Map<string, ElecSymbolDef[]>();
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

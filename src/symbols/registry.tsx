import { Column } from "@/symbols/equipment/Column";
import { CentrifugalPump } from "@/symbols/equipment/CentrifugalPump";
import { HeatExchanger } from "@/symbols/equipment/HeatExchanger";
import { PositiveDisplacementPump } from "@/symbols/equipment/PositiveDisplacementPump";
import { TankHorizontal } from "@/symbols/equipment/TankHorizontal";
import { VesselVertical } from "@/symbols/equipment/VesselVertical";

import { BallValve } from "@/symbols/valves/BallValve";
import { CheckValve } from "@/symbols/valves/CheckValve";
import { ControlValve } from "@/symbols/valves/ControlValve";
import { GateValve } from "@/symbols/valves/GateValve";
import { GlobeValve } from "@/symbols/valves/GlobeValve";
import { ReliefValve } from "@/symbols/valves/ReliefValve";

import { InstrumentBubble } from "@/symbols/instruments/InstrumentBubble";

import { TapPoint } from "@/symbols/connectors/TapPoint";

import type { SymbolCategory, SymbolDef } from "@/symbols/types";

/** ISA 5.1 two-letter instrument code helper. */
function instrumentSymbol(
  type: string,
  code: string,
  description: string,
): SymbolDef {
  return {
    type,
    category: "instrument",
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

export const SYMBOL_REGISTRY: Record<string, SymbolDef> = {
  // --- Equipment ----------------------------------------------------------
  "centrifugal-pump": {
    type: "centrifugal-pump",
    category: "equipment",
    label: "Centrifugal pump",
    size: { width: 64, height: 64 },
    ports: [
      { id: "suction", side: "left", position: 0.56 },
      { id: "discharge", side: "top", position: 0.5 },
    ],
    tagPrefix: "P",
    engineModel: "pump",
    Icon: CentrifugalPump,
    defaultLabel: "P-101",
    paramSchema: [
      {
        key: "curve",
        label: "Pump curve",
        kind: "curve",
        description: "Manufacturer Q vs H points",
      },
      {
        key: "ratedHeadM",
        label: "Rated head",
        unit: "m",
        kind: "number",
        default: 30,
        min: 0,
      },
      {
        key: "ratedFlowM3H",
        label: "Rated flow",
        unit: "m³/h",
        kind: "number",
        default: 50,
        min: 0,
      },
      {
        key: "shutoffHeadM",
        label: "Shut-off head",
        unit: "m",
        kind: "number",
        default: 40,
        min: 0,
      },
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
  "pd-pump": {
    type: "pd-pump",
    category: "equipment",
    label: "Positive displacement pump",
    size: { width: 64, height: 64 },
    ports: [
      { id: "suction", side: "left", position: 0.5 },
      { id: "discharge", side: "right", position: 0.5 },
    ],
    tagPrefix: "P",
    engineModel: "pump",
    Icon: PositiveDisplacementPump,
    defaultLabel: "P-201",
    paramSchema: [
      {
        key: "displacementFlowM3H",
        label: "Displacement flow",
        unit: "m³/h",
        kind: "number",
        default: 10,
        min: 0,
      },
    ],
    defaultParams: { displacementFlowM3H: 10 },
  },
  "vessel-vertical": {
    type: "vessel-vertical",
    category: "equipment",
    label: "Vertical vessel",
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
      {
        key: "volumeM3",
        label: "Volume",
        unit: "m³",
        kind: "number",
        default: 2,
        min: 0,
      },
      {
        key: "designPressureBar",
        label: "Design pressure",
        unit: "bar(g)",
        kind: "number",
        default: 6,
      },
    ],
    defaultParams: { volumeM3: 2, designPressureBar: 6 },
  },
  "tank-horizontal": {
    type: "tank-horizontal",
    category: "equipment",
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
    paramSchema: [
      {
        key: "volumeM3",
        label: "Volume",
        unit: "m³",
        kind: "number",
        default: 10,
        min: 0,
      },
    ],
    defaultParams: { volumeM3: 10 },
  },
  "heat-exchanger": {
    type: "heat-exchanger",
    category: "equipment",
    label: "Heat exchanger (shell & tube)",
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
      {
        key: "dutyKW",
        label: "Heat duty",
        unit: "kW",
        kind: "number",
        default: 100,
      },
      {
        key: "deltaPbar",
        label: "ΔP (tube side)",
        unit: "bar",
        kind: "number",
        default: 0.3,
      },
    ],
    defaultParams: { dutyKW: 100, deltaPbar: 0.3 },
  },
  column: {
    type: "column",
    category: "equipment",
    label: "Column",
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
      {
        key: "stages",
        label: "Theoretical stages",
        kind: "number",
        default: 20,
      },
    ],
    defaultParams: { stages: 20 },
  },

  // --- Valves -------------------------------------------------------------
  "gate-valve": {
    type: "gate-valve",
    category: "valve",
    label: "Gate valve",
    size: { width: 48, height: 48 },
    ports: [
      { id: "in", side: "left", position: 0.5 },
      { id: "out", side: "right", position: 0.5 },
    ],
    tagPrefix: "GV",
    engineModel: "valve",
    Icon: GateValve,
    defaultLabel: "GV-101",
    paramSchema: [
      {
        key: "Cv",
        label: "Flow coefficient",
        unit: "Cv (US gal/min, 1 psi)",
        kind: "number",
        default: 50,
        min: 0,
      },
      {
        key: "openFraction",
        label: "Open fraction",
        kind: "number",
        default: 1,
        min: 0,
        max: 1,
        step: 0.05,
      },
    ],
    defaultParams: { Cv: 50, openFraction: 1 },
  },
  "globe-valve": {
    type: "globe-valve",
    category: "valve",
    label: "Globe valve",
    size: { width: 48, height: 48 },
    ports: [
      { id: "in", side: "left", position: 0.5 },
      { id: "out", side: "right", position: 0.5 },
    ],
    tagPrefix: "GLV",
    engineModel: "valve",
    Icon: GlobeValve,
    defaultLabel: "GLV-101",
    paramSchema: [
      { key: "Cv", label: "Flow coefficient", unit: "Cv", kind: "number", default: 25, min: 0 },
      { key: "openFraction", label: "Open fraction", kind: "number", default: 1, min: 0, max: 1, step: 0.05 },
    ],
    defaultParams: { Cv: 25, openFraction: 1 },
  },
  "ball-valve": {
    type: "ball-valve",
    category: "valve",
    label: "Ball valve",
    size: { width: 48, height: 48 },
    ports: [
      { id: "in", side: "left", position: 0.5 },
      { id: "out", side: "right", position: 0.5 },
    ],
    tagPrefix: "BV",
    engineModel: "valve",
    Icon: BallValve,
    defaultLabel: "BV-101",
    paramSchema: [
      { key: "Cv", label: "Flow coefficient", unit: "Cv", kind: "number", default: 100, min: 0 },
      { key: "openFraction", label: "Open fraction", kind: "number", default: 1, min: 0, max: 1, step: 0.05 },
    ],
    defaultParams: { Cv: 100, openFraction: 1 },
  },
  "check-valve": {
    type: "check-valve",
    category: "valve",
    label: "Check valve",
    size: { width: 48, height: 48 },
    ports: [
      { id: "in", side: "left", position: 0.5 },
      { id: "out", side: "right", position: 0.5 },
    ],
    tagPrefix: "CV",
    engineModel: "valve",
    Icon: CheckValve,
    defaultLabel: "CV-101",
    paramSchema: [
      { key: "crackingPressureBar", label: "Cracking pressure", unit: "bar", kind: "number", default: 0.05 },
      { key: "K", label: "Loss coefficient K", kind: "number", default: 2 },
    ],
    defaultParams: { crackingPressureBar: 0.05, K: 2 },
  },
  "control-valve": {
    type: "control-valve",
    category: "valve",
    label: "Control valve",
    size: { width: 56, height: 64 },
    ports: [
      { id: "in", side: "left", position: 0.65 },
      { id: "out", side: "right", position: 0.65 },
      { id: "signal", side: "top", position: 0.5 },
    ],
    tagPrefix: "FV",
    engineModel: "valve",
    Icon: ControlValve,
    defaultLabel: "FV-101",
    paramSchema: [
      { key: "Cv", label: "Rated Cv", unit: "Cv", kind: "number", default: 40 },
      { key: "openFraction", label: "Open fraction (signal)", kind: "number", default: 0.5, min: 0, max: 1, step: 0.05 },
    ],
    defaultParams: { Cv: 40, openFraction: 0.5 },
  },
  "relief-valve": {
    type: "relief-valve",
    category: "valve",
    label: "Relief valve",
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

  // --- Connectors ---------------------------------------------------------
  "tap-point": {
    type: "tap-point",
    category: "connector",
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

  // --- Instruments --------------------------------------------------------
  "instrument-pi": instrumentSymbol("instrument-pi", "PI", "Pressure indicator"),
  "instrument-pt": instrumentSymbol("instrument-pt", "PT", "Pressure transmitter"),
  "instrument-fi": instrumentSymbol("instrument-fi", "FI", "Flow indicator"),
  "instrument-ft": instrumentSymbol("instrument-ft", "FT", "Flow transmitter"),
  "instrument-ti": instrumentSymbol("instrument-ti", "TI", "Temperature indicator"),
  "instrument-li": instrumentSymbol("instrument-li", "LI", "Level indicator"),
};

/** Palette order — keeps the panel layout deterministic. */
export const SYMBOL_ORDER: Record<SymbolCategory, string[]> = {
  equipment: [
    "centrifugal-pump",
    "pd-pump",
    "vessel-vertical",
    "tank-horizontal",
    "heat-exchanger",
    "column",
  ],
  valve: [
    "gate-valve",
    "globe-valve",
    "ball-valve",
    "check-valve",
    "control-valve",
    "relief-valve",
  ],
  instrument: [
    "instrument-pi",
    "instrument-pt",
    "instrument-fi",
    "instrument-ft",
    "instrument-ti",
    "instrument-li",
  ],
  connector: ["tap-point"],
};

export const CATEGORY_LABELS: Record<SymbolCategory, string> = {
  equipment: "Equipment",
  valve: "Valves",
  instrument: "Instruments",
  connector: "Connectors",
};

export function getSymbol(type: string): SymbolDef | undefined {
  return SYMBOL_REGISTRY[type];
}

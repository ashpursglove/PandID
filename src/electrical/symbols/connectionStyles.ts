import type { ConnectionStyleDef, ConnectionType } from "@/electrical/types";

/**
 * Visual styles for SLD connections. Colours are chosen to read clearly on the
 * dark canvas and to map to common single-line conventions (MV distinct from
 * LV, earth in green, control dashed).
 */
export const CONNECTION_STYLES: Record<ConnectionType, ConnectionStyleDef> = {
  "lv-power": {
    type: "lv-power",
    label: "LV power",
    description: "Low-voltage power feeder (≤ 1 kV)",
    stroke: "#e5e7eb",
    strokeWidth: 2.25,
  },
  "mv-power": {
    type: "mv-power",
    label: "MV power",
    description: "Medium-voltage feeder (> 1 kV)",
    stroke: "#fca5a5",
    strokeWidth: 3,
  },
  "dc-power": {
    type: "dc-power",
    label: "DC power",
    description: "DC link (PV strings, battery)",
    stroke: "#fcd34d",
    strokeWidth: 2.25,
  },
  control: {
    type: "control",
    label: "Control / signal",
    description: "Control or signal wiring",
    stroke: "#93c5fd",
    strokeWidth: 1.25,
    strokeDasharray: "5 3",
  },
  earth: {
    type: "earth",
    label: "Earth / bonding",
    description: "Protective earth / bonding conductor",
    stroke: "#86efac",
    strokeWidth: 1.5,
    strokeDasharray: "2 2",
  },
  direct: {
    type: "direct",
    label: "Bolted (direct)",
    description:
      "Direct bolted connection with no cable — e.g. a breaker bolted onto a board's bus. Drawn as a junction dot.",
    stroke: "#cbd5e1",
    strokeWidth: 2,
  },
};

export const CONNECTION_TYPE_ORDER: ConnectionType[] = [
  "lv-power",
  "mv-power",
  "dc-power",
  "control",
  "earth",
];

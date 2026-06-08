import type { ElecSymbolIconProps } from "@/electrical/types";
import { ElecSvg, StubBottom, StubTop } from "./base";

/** Instrument bubble with a two-letter function code. */
function Bubble({ code }: { code: string }) {
  return (
    <>
      <circle cx={32} cy={32} r={14} />
      <text
        x={32}
        y={37}
        fontSize={11}
        fill="currentColor"
        stroke="none"
        textAnchor="middle"
        fontFamily="Inter, Helvetica, Arial, sans-serif"
      >
        {code}
      </text>
    </>
  );
}

/** Current transformer — bubble on the conductor. */
export function CurrentTransformer(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <Bubble code="CT" />
      <StubBottom />
    </ElecSvg>
  );
}

/** Voltage / potential transformer. */
export function VoltageTransformer(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <Bubble code="VT" />
      <StubBottom />
    </ElecSvg>
  );
}

/** Multifunction / energy meter. */
export function Meter(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <circle cx={32} cy={32} r={14} />
      <line x1={32} y1={32} x2={40} y2={24} />
      <circle cx={32} cy={32} r={1.6} fill="currentColor" />
      <StubBottom />
    </ElecSvg>
  );
}

/**
 * GDT sensor box — a monitoring enclosure that reads reactor signals and
 * transmits data to the GDT hub. Drawn as an enclosure with a "GDT" legend
 * and wireless data arcs.
 */
export function GdtSensorBox(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={16} y={24} width={32} height={24} rx={2} />
      <text
        x={32}
        y={41}
        fontSize={9}
        fill="currentColor"
        stroke="none"
        textAnchor="middle"
        fontFamily="Inter, Helvetica, Arial, sans-serif"
      >
        GDT
      </text>
      {/* wireless data arcs transmitting to the hub */}
      <path d="M 40 22 a 5 5 0 0 1 5 5" />
      <path d="M 40 18 a 9 9 0 0 1 9 9" />
      <circle cx={40} cy={27} r={1.3} fill="currentColor" stroke="none" />
    </ElecSvg>
  );
}

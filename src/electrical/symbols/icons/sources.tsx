import type { ElecSymbolIconProps } from "@/electrical/types";
import { ElecSvg, StubBottom } from "./base";

/** AC sine glyph centred at (cx, cy) spanning `w`. */
function Sine({ cx, cy, w }: { cx: number; cy: number; w: number }) {
  const h = w / 4;
  const x0 = cx - w / 2;
  return (
    <path
      d={`M ${x0} ${cy} q ${w / 4} ${-h} ${w / 2} 0 q ${w / 4} ${h} ${w / 2} 0`}
    />
  );
}

/** Utility / grid incoming supply — AC source. */
export function UtilityIncomer(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <circle cx={32} cy={28} r={16} />
      <Sine cx={32} cy={28} w={20} />
      <StubBottom />
    </ElecSvg>
  );
}

/** Standby generator (genset). */
export function Generator(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <circle cx={32} cy={28} r={16} />
      <text
        x={32}
        y={34}
        fontSize={18}
        fill="currentColor"
        stroke="none"
        textAnchor="middle"
        fontFamily="Inter, Helvetica, Arial, sans-serif"
      >
        G
      </text>
      <StubBottom />
    </ElecSvg>
  );
}

/** Uninterruptible power supply. */
export function Ups(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <line x1={32} y1={2} x2={32} y2={12} />
      <rect x={14} y={12} width={36} height={32} rx={2} />
      <Sine cx={24} cy={28} w={12} />
      <line x1={38} y1={22} x2={46} y2={22} />
      <line x1={38} y1={28} x2={46} y2={28} strokeDasharray="2 2" />
      <line x1={38} y1={34} x2={46} y2={34} />
      <StubBottom />
    </ElecSvg>
  );
}

/** PV / solar inverter (DC in → AC out). */
export function PvInverter(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <line x1={32} y1={2} x2={32} y2={12} />
      <rect x={14} y={12} width={36} height={32} rx={2} />
      <line x1={20} y1={20} x2={44} y2={36} />
      {/* DC side (=) */}
      <line x1={19} y1={22} x2={27} y2={22} />
      <line x1={19} y1={26} x2={27} y2={26} strokeDasharray="2 2" />
      {/* AC side (~) */}
      <path d="M 35 33 q 2 -3 4 0 q 2 3 4 0" />
      <StubBottom />
    </ElecSvg>
  );
}

/** Battery / BESS. */
export function Battery(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <line x1={32} y1={2} x2={32} y2={18} />
      {/* alternating long/short plates */}
      <line x1={20} y1={22} x2={44} y2={22} />
      <line x1={26} y1={28} x2={38} y2={28} />
      <line x1={20} y1={34} x2={44} y2={34} />
      <line x1={26} y1={40} x2={38} y2={40} />
      <line x1={32} y1={44} x2={32} y2={62} />
    </ElecSvg>
  );
}

import type { ElecSymbolIconProps } from "@/electrical/types";
import { ElecSvg, FanBlades, StubTop } from "./base";

/** LED grow-light array for photobioreactors. */
export function GrowLight(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={14} y={18} width={36} height={16} rx={2} />
      {[20, 26, 32, 38, 44].map((x) => (
        <circle key={x} cx={x} cy={26} r={1.4} fill="currentColor" />
      ))}
      {/* light rays */}
      <line x1={20} y1={36} x2={18} y2={44} />
      <line x1={32} y1={36} x2={32} y2={46} />
      <line x1={44} y1={36} x2={46} y2={44} />
    </ElecSvg>
  );
}

/** UV steriliser (water disinfection). */
export function UvSteriliser(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={16} y={26} width={32} height={14} rx={7} />
      <path d="M 22 33 q 2.5 -3.5 5 0 q 2.5 3.5 5 0 q 2.5 -3.5 5 0 q 2.5 3.5 5 0" />
      <text x={32} y={24} fontSize={6} fill="currentColor" stroke="none" textAnchor="middle" fontFamily="Inter, Helvetica, Arial, sans-serif">UV</text>
    </ElecSvg>
  );
}

/** Process chiller / heat pump. */
export function Chiller(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={16} y={18} width={32} height={28} rx={2} />
      {/* snowflake */}
      <line x1={32} y1={24} x2={32} y2={40} />
      <line x1={25} y1={28} x2={39} y2={36} />
      <line x1={25} y1={36} x2={39} y2={28} />
      <line x1={32} y1={24} x2={29} y2={27} />
      <line x1={32} y1={24} x2={35} y2={27} />
    </ElecSvg>
  );
}

/** Centrifugal blower / aeration. */
export function Blower(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <circle cx={30} cy={36} r={14} />
      <FanBlades cx={30} cy={36} r={10} />
      {/* discharge outlet */}
      <line x1={44} y1={36} x2={50} y2={36} />
    </ElecSvg>
  );
}

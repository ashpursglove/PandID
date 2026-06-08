import type { ElecSymbolIconProps } from "@/electrical/types";
import { ElecSvg, StubBottom, StubTop } from "./base";

/** Variable-frequency drive — box, AC→DC→AC. */
export function Vfd(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={16} y={18} width={32} height={28} rx={2} />
      <path d="M 20 26 q 2 -3 4 0 q 2 3 4 0" />
      <line x1={36} y1={24} x2={44} y2={24} />
      <line x1={36} y1={28} x2={44} y2={28} strokeDasharray="2 2" />
      {/* stepped output wave */}
      <path d="M 20 40 h 4 v -5 h 5 v 5 h 5 v -5 h 5" />
      <StubBottom />
    </ElecSvg>
  );
}

/** Soft starter — box with a ramp. */
export function SoftStarter(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={18} y={18} width={28} height={28} rx={2} />
      <line x1={22} y1={42} x2={42} y2={22} />
      <line x1={22} y1={42} x2={42} y2={42} />
      <StubBottom />
    </ElecSvg>
  );
}

/** Direct-on-line / generic motor starter — contactor + overload box. */
export function MotorStarter(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <circle cx={32} cy={18} r={1.6} fill="currentColor" />
      <line x1={32} y1={18} x2={42} y2={30} />
      <path d="M 32 32 a 5 5 0 0 1 10 0" />
      <rect x={26} y={38} width={12} height={8} rx={1} />
      <line x1={32} y1={46} x2={32} y2={62} />
    </ElecSvg>
  );
}

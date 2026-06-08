import type { ElecSymbolIconProps } from "@/electrical/types";
import { ElecSvg, StubTop } from "./base";

/**
 * Pump glyphs for the SLD. These are motor-driven loads, so each carries the
 * standard top connection stub plus a recognisable pump symbol body.
 */

/** Centrifugal pump — circle with an impeller triangle pointing to discharge. */
export function CentrifugalPump(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <circle cx={32} cy={36} r={15} />
      <path d="M 26 28 L 44 36 L 26 44 Z" />
    </ElecSvg>
  );
}

/** Sump / submersible pump — motor block above, impeller, suction strainer. */
export function SumpPump(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={24} y={16} width={16} height={9} rx={1.5} />
      <circle cx={32} cy={40} r={12} />
      <path d="M 32 31 L 39 47 L 25 47 Z" />
      {/* suction strainer */}
      <line x1={22} y1={55} x2={42} y2={55} />
      <line x1={25} y1={55} x2={25} y2={52} />
      <line x1={29} y1={55} x2={29} y2={52} />
      <line x1={32} y1={55} x2={32} y2={52} />
      <line x1={35} y1={55} x2={35} y2={52} />
      <line x1={39} y1={55} x2={39} y2={52} />
    </ElecSvg>
  );
}

/** Peristaltic pump — circle with three rollers around an inner hose loop. */
export function PeristalticPump(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <circle cx={32} cy={36} r={17} />
      <circle cx={32} cy={36} r={10} />
      <circle cx={32} cy={22} r={2.6} fill="currentColor" stroke="none" />
      <circle cx={44.1} cy={43} r={2.6} fill="currentColor" stroke="none" />
      <circle cx={19.9} cy={43} r={2.6} fill="currentColor" stroke="none" />
    </ElecSvg>
  );
}

/** Diaphragm pump — circle with a diaphragm dome and a bottom port. */
export function DiaphragmPump(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <circle cx={32} cy={36} r={15} />
      <path d="M 19 38 Q 32 26, 45 38" />
      <line x1={32} y1={38} x2={32} y2={51} />
    </ElecSvg>
  );
}

/** Progressive-cavity / screw pump — circle with diagonal screw threads. */
export function ProgressiveCavityPump(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <circle cx={32} cy={36} r={15} />
      <path d="M 22 30 L 42 38" />
      <path d="M 20 36 L 40 44" />
      <path d="M 24 24 L 44 32" />
    </ElecSvg>
  );
}

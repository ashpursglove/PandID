import type { ElecSymbolIconProps } from "@/electrical/types";
import { ElecSvg, StubTop } from "./base";

/** Earth electrode — descending earth lines. */
export function EarthElectrode(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <line x1={32} y1={16} x2={32} y2={34} />
      <line x1={18} y1={34} x2={46} y2={34} />
      <line x1={23} y1={40} x2={41} y2={40} />
      <line x1={27} y1={46} x2={37} y2={46} />
    </ElecSvg>
  );
}

/** Surge protection device — box discharging to earth. */
export function Spd(p: ElecSymbolIconProps) {
  return (
    <ElecSvg {...p}>
      <StubTop />
      <rect x={22} y={18} width={20} height={20} rx={1} />
      <path d="M 30 22 L 26 30 L 34 30 L 30 34" />
      {/* earth */}
      <line x1={32} y1={38} x2={32} y2={46} />
      <line x1={24} y1={46} x2={40} y2={46} />
      <line x1={27} y1={50} x2={37} y2={50} />
      <line x1={30} y1={54} x2={34} y2={54} />
    </ElecSvg>
  );
}

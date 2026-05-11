import type { SymbolIconProps } from "@/symbols/types";
import { SvgFrame } from "@/symbols/svgUtil";

/** Static mixer — pipe with internal helical pattern. */
export function StaticMixer(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <rect x={6} y={24} width={52} height={16} />
      <path d="M 10 24 L 22 40 M 22 24 L 34 40 M 34 24 L 46 40 M 46 24 L 58 40" />
      <path d="M 10 40 L 22 24 M 22 40 L 34 24 M 34 40 L 46 24 M 46 40 L 58 24" />
    </SvgFrame>
  );
}

/** Tank with agitator / stirrer — vessel with motor on top + impeller. */
export function AgitatedTank(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <rect x={14} y={16} width={36} height={42} rx={4} />
      <path d="M 14 16 C 14 22, 50 22, 50 16" />
      <rect x={26} y={4} width={12} height={10} />
      <line x1={32} y1={14} x2={32} y2={44} />
      <line x1={22} y1={44} x2={42} y2={44} />
    </SvgFrame>
  );
}

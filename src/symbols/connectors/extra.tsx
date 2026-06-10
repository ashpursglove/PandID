import type { SymbolIconProps } from "@/symbols/types";
import { SvgFrame } from "@/symbols/svgUtil";

/** Off-page connector — pentagon pointing right with reference label area. */
export function OffPageConnector(props: SymbolIconProps) {
  return (
    <SvgFrame {...props}>
      <path d="M 6 16 L 40 16 L 56 32 L 40 48 L 6 48 Z" />
    </SvgFrame>
  );
}

/** Pipe junction / tee — three short stubs meeting at a node. Drawn with a
 *  heavier stroke (the glyph sits on a 64-unit grid but renders at 32 px, so
 *  the line weight is scaled down) so it reads at the same weight as the pipes
 *  it joins. */
export function PipeTee(props: SymbolIconProps) {
  return (
    <SvgFrame {...props} strokeWidth={4}>
      <line x1={2} y1={32} x2={62} y2={32} />
      <line x1={32} y1={32} x2={32} y2={62} />
      <circle cx={32} cy={32} r={4} fill="currentColor" stroke="none" />
    </SvgFrame>
  );
}
